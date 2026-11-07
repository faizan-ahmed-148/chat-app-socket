import { getMessaging, onMessage } from 'firebase/messaging';
import { messaging } from '../helper/firebaseinit';

class NotificationService {
  constructor() {
    this.messaging = messaging;
    this.setupMessageListener();
  }

  /**
   * Setup listener for foreground messages
   */
  setupMessageListener() {
    if (this.messaging) {
      onMessage(this.messaging, (payload) => {
        console.log('Message received in foreground:', payload);
        
        // Show notification even when app is in foreground
        if (payload.notification) {
          this.showNotification(
            payload.notification.title,
            payload.notification.body,
            payload.notification.icon,
            payload.data
          );
        }
      });
    }
  }

  /**
   * Show browser notification
   * @param {string} title - Notification title
   * @param {string} body - Notification body
   * @param {string} icon - Notification icon
   * @param {object} data - Additional data
   */
  showNotification(title, body, icon, data = {}) {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body: body,
        icon: icon || '/groupveil.png',
        badge: '/groupveil.png',
        tag: data.groupId || 'groupveil-notification',
        data: data,
        requireInteraction: false,
        silent: false
      });

      // Handle notification click
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        
        // Navigate to the group if groupId is provided
        if (data.groupId) {
          window.location.href = `/group/${data.groupId}`;
        } else {
          window.location.href = '/dashboard';
        }
        
        notification.close();
      };

      // Auto close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);
    }
  }

  /**
   * Request notification permission
   * @returns {Promise<boolean>} - Whether permission was granted
   */
  async requestPermission() {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      console.log('Notification permission denied');
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  /**
   * Check if notifications are supported and enabled
   * @returns {boolean}
   */
  isNotificationSupported() {
    return 'Notification' in window && Notification.permission === 'granted';
  }

  /**
   * Get notification permission status
   * @returns {string}
   */
  getPermissionStatus() {
    if (!('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  }
}

// Create and export singleton instance
const notificationService = new NotificationService();
export default notificationService;
