/**
 * Custom Notification System
 * Replaces browser alerts with beautiful, user-friendly notifications
 */

class NotificationSystem {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // Create notification container if it doesn't exist
        if (!document.getElementById('notification-container')) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            this.container.className = 'notification-container';
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('notification-container');
        }
    }

    /**
     * Show a notification
     * @param {string} message - The message to display
     * @param {string} type - Type of notification: 'success', 'error', 'warning', 'info'
     * @param {number} duration - How long to show the notification (ms), 0 for persistent
     */
    show(message, type = 'info', duration = 4000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type} notification-enter`;

        // Icon based on type
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        notification.innerHTML = `
            <div class="notification-icon">${icons[type] || icons.info}</div>
            <div class="notification-message">${message}</div>
            <button class="notification-close" onclick="notificationSystem.close(this.parentElement)">&times;</button>
        `;

        this.container.appendChild(notification);

        // Trigger animation
        setTimeout(() => {
            notification.classList.remove('notification-enter');
            notification.classList.add('notification-visible');
        }, 10);

        // Auto-remove after duration (if not persistent)
        if (duration > 0) {
            setTimeout(() => {
                this.close(notification);
            }, duration);
        }

        return notification;
    }

    close(notification) {
        if (!notification) return;
        
        notification.classList.remove('notification-visible');
        notification.classList.add('notification-exit');
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.parentElement.removeChild(notification);
            }
        }, 300);
    }

    // Convenience methods
    success(message, duration = 4000) {
        return this.show(message, 'success', duration);
    }

    error(message, duration = 5000) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration = 4000) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration = 4000) {
        return this.show(message, 'info', duration);
    }

    /**
     * Show a loading notification that persists until closed manually
     * @param {string} message - The loading message
     * @returns {object} Notification element
     */
    loading(message) {
        const notification = this.show(message, 'info', 0);
        notification.classList.add('notification-loading');
        
        // Add spinner
        const icon = notification.querySelector('.notification-icon');
        icon.innerHTML = '<div class="notification-spinner"></div>';
        
        // Remove close button for loading
        const closeBtn = notification.querySelector('.notification-close');
        if (closeBtn) closeBtn.style.display = 'none';
        
        return notification;
    }

    /**
     * Update a loading notification to success/error
     * @param {object} notification - The notification element
     * @param {string} message - New message
     * @param {string} type - 'success' or 'error'
     */
    updateLoading(notification, message, type = 'success') {
        if (!notification) return;
        
        notification.classList.remove('notification-loading', 'notification-info');
        notification.classList.add(`notification-${type}`);
        
        const icons = {
            success: '✓',
            error: '✕'
        };
        
        const icon = notification.querySelector('.notification-icon');
        icon.innerHTML = icons[type];
        
        const messageEl = notification.querySelector('.notification-message');
        messageEl.textContent = message;
        
        // Show close button
        const closeBtn = notification.querySelector('.notification-close');
        if (closeBtn) closeBtn.style.display = 'block';
        
        // Auto-close after delay
        setTimeout(() => {
            this.close(notification);
        }, 4000);
    }
}

// Create global instance
const notificationSystem = new NotificationSystem();

// Make it available globally
window.notificationSystem = notificationSystem;

// Convenience global functions (optional - can use window.alert replacement)
window.showNotification = (message, type, duration) => notificationSystem.show(message, type, duration);
window.showSuccess = (message, duration) => notificationSystem.success(message, duration);
window.showError = (message, duration) => notificationSystem.error(message, duration);
window.showWarning = (message, duration) => notificationSystem.warning(message, duration);
window.showInfo = (message, duration) => notificationSystem.info(message, duration);
