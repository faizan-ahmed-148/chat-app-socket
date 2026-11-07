# Notification System Setup Guide

This guide explains how to set up and use the notification functionality in the Groupveil chat application.

## Overview

The notification system uses Firebase Cloud Messaging (FCM) to send push notifications to users when:
- A new message is sent in a group
- A new group is created
- A new member joins a group

## Backend Setup

### 1. Firebase Admin SDK Configuration

The backend uses Firebase Admin SDK to send notifications. You have two options:

#### Option A: Service Account Key (Recommended for Production)

1. **Download Service Account Key**:
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate new private key"
   - Download the JSON file
   - Rename it to `serviceAccountKey.json` and place it in the backend root directory

2. **Service Account Key Format**:
   ```json
   {
     "type": "service_account",
     "project_id": "groupveil",
     "private_key_id": "...",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "firebase-adminsdk-xxxxx@groupveil.iam.gserviceaccount.com",
     "client_id": "...",
     "auth_uri": "https://accounts.google.com/o/oauth2/auth",
     "token_uri": "https://oauth2.googleapis.com/token",
     "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
     "client_x509_cert_url": "..."
   }
   ```

#### Option B: Environment Variables (For Development)

If you don't have a service account key, the system will fall back to using environment variables or default credentials. Add these to your backend `.env` file:

```env
FIREBASE_PROJECT_ID=groupveil
GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccountKey.json
```

### 2. Environment Variables

Add these environment variables to your backend `.env` file:

```env
MONGODB_URI=mongodb://localhost:27017/groupveil
FRONTEND_URL=http://localhost:3000
```

### 3. Dependencies

The following packages are already included in `package.json`:
- `firebase-admin`: ^13.5.0
- `firebase`: ^12.3.0

## Frontend Setup

### 1. Environment Variables

Create a `.env` file in the frontend directory with these variables:

```env
# Firebase Configuration
VITE_API_FIREBASE_KEY=your_firebase_api_key
VITE_API_FIREBASE_AUTH_DOMAIN=groupveil.firebaseapp.com
VITE_API_FIREBASE_PROJECT_ID=groupveil
VITE_API_FIREBASE_STORAGE_BUCKET=groupveil.firebasestorage.app
VITE_API_FIREBASE_SENDER_ID=87756380609
VITE_API_FIREBASE_APP_ID=1:87756380609:web:e564241cd83b1391def740
VITE_API_VPID_KEY=your_vapid_key

# Backend API URL
VITE_API_BASE_URL=http://localhost:5000
```

### 2. Service Worker

The Firebase messaging service worker is already configured at `/public/firebase-messaging-sw.js`.

### 3. Notification Service

A notification service is available at `/src/services/notificationService.js` that handles:
- Permission requests
- Foreground message handling
- Browser notification display

## How It Works

### 1. User Registration

When a user logs in:
1. The frontend requests notification permission
2. If granted, it gets an FCM token
3. The token is sent to the backend and stored in the user's profile

### 2. Message Notifications

When a user sends a message:
1. The message is saved to the database
2. The backend finds all group members (except the sender)
3. For each member with a valid FCM token, a notification is sent
4. The notification includes message content, sender name, and group name

### 3. Notification Display

- **Foreground**: Notifications are handled by the notification service
- **Background**: Notifications are handled by the service worker
- **Click Action**: Clicking a notification opens the specific group chat

## Testing

### 1. Test Backend Notifications

Run the test script:

```bash
cd Groupveil-BE
node test-notifications.js
```

### 2. Test Frontend Notifications

1. Start the frontend application
2. Log in with a user account
3. Grant notification permission when prompted
4. Send a message in a group chat
5. Check if other group members receive notifications

## Troubleshooting

### Common Issues

1. **No notifications received**:
   - Check if notification permission is granted
   - Verify FCM token is registered in the backend
   - Check browser console for errors

2. **Service worker not registered**:
   - Ensure the service worker file is accessible at `/firebase-messaging-sw.js`
   - Check browser developer tools for service worker errors

3. **Invalid FCM token**:
   - The system automatically removes invalid tokens
   - Users need to refresh the page to get a new token

### Debug Mode

Enable debug logging by checking the browser console and backend logs for:
- FCM token generation
- Notification sending attempts
- Service worker registration

## Features

### Notification Types

1. **Message Notifications**:
   - Title: "New message in [Group Name]"
   - Body: "[Sender Name]: [Message Content]"
   - Click action: Opens the specific group

2. **Group Creation Notifications**:
   - Title: "New Group Created"
   - Body: "[Creator Name] created a new group: [Group Name]"
   - Click action: Opens the group

3. **Member Joined Notifications**:
   - Title: "New member joined [Group Name]"
   - Body: "[New Member Name] has joined the group"
   - Click action: Opens the group

### Notification Actions

- **View Message**: Opens the group chat
- **Dismiss**: Closes the notification

## Security Considerations

1. **Token Management**: FCM tokens are automatically cleaned up when invalid
2. **Permission Handling**: Users must explicitly grant notification permission
3. **Data Privacy**: Only necessary data is included in notifications

## Future Enhancements

- Notification preferences per user
- Different notification types for different events
- Rich notifications with images
- Notification history
- Push notification analytics
