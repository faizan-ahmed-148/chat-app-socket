// Scripts for firebase and firebase messaging
importScripts("https://www.gstatic.com/firebasejs/8.2.0/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/8.2.0/firebase-messaging.js");

const firebaseConfig = {
    apiKey: "AIzaSyAqHlBvNSnoN4spbGD0YcQtvevZXx8FpxE",
    authDomain: "groupveil.firebaseapp.com",
    projectId: "groupveil",
    storageBucket: "groupveil.firebasestorage.app",
    messagingSenderId: "87756380609",
    appId: "1:87756380609:web:e564241cd83b1391def740", 
    measurementId: "G-XTHB5PF4BX"
  };
  firebase.initializeApp(firebaseConfig);// Retrieve firebase messaging
  const messaging = firebase.messaging();

  
  messaging.onBackgroundMessage(async function (payload) {
    console.log('Background message received:', payload);
    
    // Handle both notification and data payloads
    const notificationTitle = payload?.notification?.title || payload?.data?.title || "New Message";
    const notificationBody = payload?.notification?.body || payload?.data?.body || "You have a new message.";
    const notificationIcon = payload?.notification?.icon || payload?.data?.icon || '/groupveil.png';
    const notificationImage = payload?.notification?.image || payload?.data?.image;
    
    // Get click action from payload
    const clickAction = payload?.notification?.click_action || payload?.data?.click_action || '/dashboard';
    
    // Prepare notification data
    const notificationData = {
      groupId: payload?.data?.groupId,
      senderId: payload?.data?.senderId,
      type: payload?.data?.type || 'message',
      groupName: payload?.data?.groupName,
      senderName: payload?.data?.senderName,
      ...payload?.data
    };
    
    const notificationOptions = {
      body: notificationBody,
      icon: notificationIcon,
      badge: '/groupveil.png',
      image: notificationImage,
      tag: notificationData.groupId || 'groupveil-notification',
      data: notificationData,
      requireInteraction: false,
      silent: false,
      actions: [
        {
          action: 'view',
          title: 'View Message',
          icon: '/groupveil.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/groupveil.png'
        }
      ]
    };
    
    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
  
  self.addEventListener("notificationclick", function (event) {
    console.log("Notification clicked:", event);
  
    const clickedAction = event.action; // The action clicked (if any)
    const notificationData = event.notification?.data; // Retrieve data from notification
  
    event.notification.close(); // Close the notification
  
    event.waitUntil(
      (async () => {
        try {
          // Handle different actions
          if (clickedAction === 'dismiss') {
            // Just close the notification, do nothing else
            return;
          }
          
          // Default action or 'view' action
          let targetUrl = '/dashboard'; // Default fallback
          
          const clientList = await self.clients.matchAll({ type: "window" });
          const existingClient = clientList.find((client) => {
            const url = new URL(client.url);
            return targetUrl;
          });
          
          if (existingClient) {
            // Focus existing window and navigate if needed
            await existingClient.focus();
            if (existingClient.navigate) {
              existingClient.navigate(targetUrl);
            }
            return existingClient;
          } else {
            // Open new window
            return self.clients.openWindow(targetUrl);
          }
        } catch (error) {
          console.error("Error handling notification click:", error);
          // Fallback to opening the app
          return self.clients.openWindow('/dashboard');
        }
      })()
    );
  });