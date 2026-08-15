// ============================================
// JoullyAI - Клиентский JavaScript
// ============================================

class JoullyAI {
    constructor() {
        // Конфигурация
        this.API_URL = 'http://localhost:8000/api';
        this.MODEL = 'openai/gpt-3.5-turbo';
        
        // Информация о создателе
        this.CREATOR = 'qp0zen';
        this.NAME = 'JoullyAI';
        
        // Состояние пользователя
        this.user = null;
        this.isAuthenticated = false;
        this.jwtToken = null;
        
        // Состояние
        this.messages = [];
        this.history = [];
        this.isLoading = false;
        
        // DOM элементы
        this.elements = {
            messages: document.getElementById('messages'),
            input: document.getElementById('input'),
            sendBtn: document.getElementById('sendBtn'),
            newChatBtn: document.querySelector('.new-chat-btn'),
            historyList: document.querySelector('.history'),
            welcome: document.querySelector('.welcome'),
            
            // Auth элементы
            authContainer: document.getElementById('authContainer'),
            authLogin: document.getElementById('authLogin'),
            authUser: document.getElementById('authUser'),
            googleLoginBtn: document.getElementById('googleLoginBtn'),
            logoutBtn: document.getElementById('logoutBtn'),
            userName: document.getElementById('userName'),
            userEmail: document.getElementById('userEmail'),
            userAvatarImg: document.getElementById('userAvatarImg'),
            userAvatarLetter: document.getElementById('userAvatarLetter')
        };
        
        // Инициализация
        this.init();
    }
    
    init() {
        // Обработчики событий
        this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        this.elements.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        this.elements.newChatBtn.addEventListener('click', () => this.newChat());
        this.elements.googleLoginBtn.addEventListener('click', () => this.loginWithGoogle());
        this.elements.logoutBtn.addEventListener('click', () => this.logout());
        
        // Загружаем историю
        this.loadHistory();
        
        // Автофокус
        this.elements.input.focus();
        
        // Обновляем приветствие
        this.updateWelcome();
        
        // Проверяем сохраненную сессию
        this.checkSavedSession();
        
        // Обработка токена из URL (после редиректа от Google)
        this.handleTokenFromUrl();

    }

    handleTokenFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const userName = urlParams.get('user');
        const error = urlParams.get('error');
        
        if (error) {
            this.showNotification('Ошибка авторизации. Попробуйте позже.', 'error');
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }
        
        if (token) {
            
            // Очищаем URL
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Сохраняем токен
            this.jwtToken = token;
            
            // Проверяем токен и получаем данные пользователя
            this.verifyToken(token);
        }
    }
    
    async verifyToken(token) {
        try {
            const response = await fetch(`${this.API_URL}/auth/verify?token=${encodeURIComponent(token)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.setUser(data.user);
                    this.showNotification(`Добро пожаловать, ${data.user.name}! 👋`, 'success');
                    return;
                }
            }
            
            this.showNotification('Ошибка проверки токена', 'error');
            localStorage.removeItem('joullyai_token');
            localStorage.removeItem('joullyai_user');
            
        } catch (error) {
            console.error('Ошибка проверки токена:', error);
            this.showNotification('Ошибка проверки токена', 'error');
        }
    }
    
    // ============================================
    // Авторизация через сервер
    // ============================================
    
    async loginWithGoogle() {
        try {
            this.showNotification('Открываем окно авторизации...', 'info');
            
            // Получаем URL для авторизации
            const response = await fetch(`${this.API_URL}/auth/google/url`);
            const data = await response.json();
            
            if (!data.success) {
                throw new Error('Не удалось получить URL авторизации');
            }
            
            // Редиректим на страницу авторизации Google
            window.location.href = data.auth_url;
            
        } catch (error) {
            console.error('Ошибка авторизации:', error);
            this.showNotification('Ошибка авторизации. Попробуйте позже.', 'error');
        }
    }
    
    async exchangeCodeForToken(code) {
        try {
            this.showNotification('Авторизация...', 'info');
            
            const response = await fetch(`${this.API_URL}/auth/google/callback?code=${encodeURIComponent(code)}`);
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Ошибка авторизации');
            }
            
            // Сохраняем токен и данные пользователя
            this.jwtToken = data.token;
            this.setUser(data.user);
            
            this.showNotification(`Добро пожаловать, ${data.user.name}! 👋`, 'success');
            
        } catch (error) {
            console.error('Ошибка обмена кода:', error);
            this.showNotification('Ошибка авторизации. Попробуйте позже.', 'error');
        }
    }
    
    setUser(userData) {
        this.user = userData;
        this.isAuthenticated = true;
        
        // Сохраняем в localStorage
        localStorage.setItem('joullyai_token', this.jwtToken);
        localStorage.setItem('joullyai_user', JSON.stringify(userData));
        
        // Обновляем UI
        this.updateAuthUI();
        this.updateWelcome();
        
    }
    
    async logout() {
        try {
            await fetch(`${this.API_URL}/auth/logout`, { method: 'POST' });
        } catch (error) {
            console.log('Ошибка при выходе');
        }
        
        this.user = null;
        this.isAuthenticated = false;
        this.jwtToken = null;
        localStorage.removeItem('joullyai_token');
        localStorage.removeItem('joullyai_user');
        
        this.updateAuthUI();
        this.updateWelcome();
        
        this.showNotification('Вы вышли из системы', 'info');
    }
    
    async checkSavedSession() {
        const token = localStorage.getItem('joullyai_token');
        const userData = localStorage.getItem('joullyai_user');
        
        if (token && userData) {
            try {
                // Проверяем токен на сервере
                const response = await fetch(`${this.API_URL}/auth/verify`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ token: token })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        this.jwtToken = token;
                        this.setUser(JSON.parse(userData));
                        return;
                    }
                }
                
                // Если токен невалидный - удаляем
                localStorage.removeItem('joullyai_token');
                localStorage.removeItem('joullyai_user');
                
            } catch (error) {
                console.log('Ошибка проверки сессии');
                localStorage.removeItem('joullyai_token');
                localStorage.removeItem('joullyai_user');
            }
        }
    }
    
    updateAuthUI() {
        if (this.isAuthenticated && this.user) {
            this.elements.authLogin.style.display = 'none';
            this.elements.authUser.style.display = 'flex';
            
            this.elements.userName.textContent = this.user.name || 'Пользователь';
            this.elements.userEmail.textContent = this.user.email || '';
            
            // Аватар
            if (this.user.picture) {
                this.elements.userAvatarImg.src = this.user.picture;
                this.elements.userAvatarImg.style.display = 'block';
                this.elements.userAvatarLetter.style.display = 'none';
            } else {
                this.elements.userAvatarImg.style.display = 'none';
                this.elements.userAvatarLetter.style.display = 'block';
                this.elements.userAvatarLetter.textContent = (this.user.name || 'U')[0].toUpperCase();
            }
        } else {
            this.elements.authLogin.style.display = 'block';
            this.elements.authUser.style.display = 'none';
        }
    }
    
    updateWelcome() {
        const welcome = this.elements.welcome;
        if (this.isAuthenticated && this.user) {
            welcome.innerHTML = `
                <h3>Привет, ${this.user.name || 'друг'}! 👋</h3>
                <p>Чем могу помочь тебе сегодня?</p>
                <div class="creator-info">🤖 ${this.NAME} · создан ${this.CREATOR}</div>
            `;
        } else {
            welcome.innerHTML = `
                <h3>Чем могу помочь?</h3>
                <p>Задайте вопрос или начните новый диалог</p>
                <div style="margin-top: 20px; font-size: 14px; color: #888;">
                    🔑 Войдите через Google, чтобы начать общение
                </div>
            `;
        }
    }
    
    // ============================================
    // Отправка сообщения
    // ============================================
    async sendMessage() {
        const message = this.elements.input.value.trim();
        
        if (!message || this.isLoading) return;
        
        // Проверка авторизации
        if (!this.isAuthenticated) {
            this.showNotification('Пожалуйста, авторизуйтесь через Google', 'warning');
            return;
        }
        
        // Скрываем приветствие
        this.elements.welcome.style.display = 'none';
        
        // Добавляем сообщение пользователя
        this.addMessage('user', message);
        
        // Очищаем поле ввода
        this.elements.input.value = '';
        this.elements.input.disabled = true;
        this.elements.sendBtn.disabled = true;
        
        // Показываем индикатор загрузки
        this.showLoading();
        
        try {
            // Отправляем запрос на сервер с JWT токеном
            const response = await this.fetchAIResponse(message);
            
            // Убираем индикатор загрузки
            this.removeLoading();
            
            // Добавляем ответ AI
            this.addMessage('assistant', response);
            
            // Сохраняем в историю
            this.history.push({
                role: 'user',
                content: message
            });
            this.history.push({
                role: 'assistant',
                content: response
            });
            
            // Обновляем историю чатов
            this.updateHistoryList();
            
        } catch (error) {
            console.error('Ошибка:', error);
            this.removeLoading();
            this.addMessage('assistant', '❌ Извините, произошла ошибка. Попробуйте позже.');
        }
        
        // Восстанавливаем поле ввода
        this.elements.input.disabled = false;
        this.elements.sendBtn.disabled = false;
        this.elements.input.focus();
        this.isLoading = false;
    }
    
    async fetchAIResponse(message) {
        try {
            const historyForServer = this.history.slice(-10);
            
            const response = await fetch(`${this.API_URL}/chat/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.jwtToken}`
                },
                body: JSON.stringify({
                    message: message,
                    history: historyForServer,
                    temperature: 0.8,
                    max_tokens: 1000
                })
            });
            
            if (response.status === 401) {
                this.showNotification('Сессия истекла. Войдите заново.', 'warning');
                this.logout();
                throw new Error('Unauthorized');
            }
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Ошибка сервера');
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Неизвестная ошибка');
            }
            
            if (data.tokens_used) {
                console.log(`📊 Использовано токенов: ${data.tokens_used}`);
            }
            
            return data.response;
            
        } catch (error) {
            console.error('Ошибка запроса:', error);
            
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                console.warn('⚠️ Сервер недоступен, использую демо-режим');
                return this.getDemoResponse(message);
            }
            
            throw error;
        }
    }
    
    // ============================================
    // Демо-режим
    // ============================================
    getDemoResponse(message) {
        const msg = message.toLowerCase();
        
        if (msg.includes('привет') || msg.includes('здрав')) {
            return `Привет! На данный момент, сервер недоступен, следите за новостями в ТГК:@joullyai`;
        }
        
        const responses = [
            `Привет! Я ${this.NAME}, созданная ${this.CREATOR}. Чем могу помочь? 🚀`,
            `Интересный вопрос! Я ${this.NAME} от ${this.CREATOR}, давай подумаем вместе. 💭`,
            `Хорошо, давайте разберемся. Я ${this.NAME}, меня создал ${this.CREATOR}. ✨`,
            `Отличная идея! Я ${this.NAME}, созданная ${this.CREATOR}. Вот что я думаю... 💡`
        ];
        
        return responses[Math.floor(Math.random() * responses.length)];
    }

    addMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const formattedContent = content.replace(/\n/g, '<br>');
        
        let avatarContent;
        if (role === 'user') {
            if (this.user && this.user.picture) {
                avatarContent = `<img src="${this.user.picture}" alt="${this.user.name}" class="avatar-logo" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">`;
            } else {
                avatarContent = `<span style="font-weight: 600; font-size: 16px; color: white;">${this.user ? this.user.name[0].toUpperCase() : 'U'}</span>`;
            }
        } else {
            avatarContent = `<img src="../logo.png" alt="${this.NAME}" class="avatar-logo" onerror="this.style.display='none'; this.parentElement.textContent='🤖';">`;
        }
        
        messageDiv.innerHTML = `
            <div class="message-avatar ${role}">${avatarContent}</div>
            <div class="message-content ${role}">${formattedContent}</div>
            <div class="message-time">${this.getTime()}</div>
        `;
        
        this.elements.messages.appendChild(messageDiv);
        this.scrollToBottom();
        
        this.messages.push({ role, content, time: new Date() });
    }
    
    showLoading() {
        this.isLoading = true;
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'message assistant loading';
        loadingDiv.id = 'loadingMessage';
        loadingDiv.innerHTML = `
            <div class="message-avatar assistant">
                <img src="../logo.png" alt="${this.NAME}" class="avatar-logo" onerror="this.style.display='none'; this.parentElement.textContent='🤖';">
            </div>
            <div class="message-content assistant">
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        this.elements.messages.appendChild(loadingDiv);
        this.scrollToBottom();
    }
    
    removeLoading() {
        const loading = document.getElementById('loadingMessage');
        if (loading) {
            loading.remove();
        }
        this.isLoading = false;
    }

    async loadHistory() {
        try {
            const response = await fetch(`${this.API_URL}/chat/history`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.history) {
                    this.history = data.history;
                    this.updateHistoryList();
                }
            }
        } catch (error) {
            console.log('История не загружена');
        }
    }
    
    updateHistoryList() {
        const historyList = this.elements.historyList;
        historyList.innerHTML = '';
        
        if (this.history.length > 0) {
            const chats = this.groupChats(this.history);
            chats.slice(-10).forEach((chat, index) => {
                const chatItem = document.createElement('div');
                chatItem.className = 'history-item';
                chatItem.innerHTML = `
                    <span>${chat.title || `Чат ${index + 1}`}</span>
                    <span class="history-date">${chat.date || ''}</span>
                `;
                chatItem.addEventListener('click', () => this.loadChat(chat));
                historyList.appendChild(chatItem);
            });
        } else {
            historyList.innerHTML = `
                <div class="history-empty">
                    <span>Нет истории</span>
                    <span class="history-hint">Начните новый чат</span>
                </div>
            `;
        }
    }
    
    groupChats(messages) {
        const chats = [];
        let currentChat = { messages: [], title: '' };
        
        messages.forEach((msg, index) => {
            if (msg.role === 'user' && currentChat.messages.length === 0) {
                currentChat.title = msg.content.slice(0, 30) + (msg.content.length > 30 ? '...' : '');
                currentChat.messages.push(msg);
            } else if (msg.role === 'user' && index > 0 && messages[index - 1].role === 'assistant') {
                if (currentChat.messages.length > 0) {
                    currentChat.date = new Date().toLocaleDateString();
                    chats.push({ ...currentChat });
                }
                currentChat = { 
                    messages: [msg], 
                    title: msg.content.slice(0, 30) + (msg.content.length > 30 ? '...' : '') 
                };
            } else {
                currentChat.messages.push(msg);
            }
        });
        
        if (currentChat.messages.length > 0) {
            currentChat.date = new Date().toLocaleDateString();
            chats.push(currentChat);
        }
        
        return chats;
    }
    
    loadChat(chat) {
        console.log('Загрузка чата:', chat);
    }
    
    newChat() {
        if (this.messages.length > 0 && !confirm('Начать новый чат? Текущий диалог будет очищен.')) {
            return;
        }
        
        this.elements.messages.innerHTML = '';
        this.messages = [];
        this.history = [];
        
        this.elements.welcome.style.display = 'flex';
        this.elements.input.focus();
        
        console.log(`🆕 Новый чат с ${this.NAME} создан!`);
    }
    
    showNotification(message, type = 'info') {
        const colors = {
            info: '#667eea',
            success: '#51cf66',
            warning: '#ff6b6b',
            error: '#ff6b6b'
        };
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 24px;
            border-radius: 12px;
            background: ${colors[type] || colors.info};
            color: white;
            font-weight: 500;
            z-index: 9999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideDown 0.3s ease;
            font-family: 'Inter', sans-serif;
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideUp 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    getTime() {
        const now = new Date();
        return now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    
    scrollToBottom() {
        const chatArea = this.elements.messages;
        setTimeout(() => {
            chatArea.scrollTop = chatArea.scrollHeight;
        }, 100);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.joullyAI = new JoullyAI();
});
