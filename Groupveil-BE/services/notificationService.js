const admin = require('firebase-admin');
const Group = require('../models/Group');
const User = require('../models/User');

// Initialize Firebase Admin SDK
let firebaseInitialized = false;
if (!admin.apps.length) {
  try {
    // Try to load service account key
    const serviceAccount = require('../serviceAccountKey.json');
    
    // Check if it's a valid service account key
    if (serviceAccount.private_key && serviceAccount.client_email) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || 'groupveil'
      });
      firebaseInitialized = true;
      console.log('Firebase Admin SDK initialized with service account key');
    } else {
      console.warn('Invalid service account key format. Notifications will be logged only.');
    }
  } catch (error) {
    console.warn('Could not load service account key. Notifications will be logged only:', error.message);
  }
}

class NotificationService {
  /**
   * Send notification to all group members except the sender
   * @param {string} groupId - The group ID
   * @param {string} senderId - The sender's user ID
   * @param {string} messageContent - The message content
   * @param {string} senderName - The sender's name/pseudonym
   * @param {string} groupName - The group name
   */
  static async sendMessageNotification(groupId, senderId, messageContent, senderName, groupName) {
    try {
      // Get group details
      const group = await Group.findById(groupId).populate('members.user', 'firebase_token username pseudonym');
      if (!group) {
        console.error('Group not found:', groupId);
        return;
      }
      
      // Get all group members except the sender
      const recipients = group.members
        .map(memberObj => memberObj.user) // Extract the user from each member object
        .filter(member => 
          member._id.toString() !== senderId.toString() && 
          member.firebase_token && 
          member.firebase_token.trim() !== ''
        );

      if (recipients.length === 0) {
        console.log('No recipients with valid FCM tokens found');
        return;
      }


      // Send to each recipient
      const promises = recipients.map(async (recipient) => {
        try {
          if (!firebaseInitialized) {
            // Log notification instead of sending
            console.log(`🔔 NOTIFICATION (Message):`);
            console.log(`   To: ${recipient.username || recipient.pseudonym} (${recipient._id})`);
            console.log(`   Group: ${groupName} (${groupId})`);
            console.log(`   From: ${senderName} (${senderId})`);
            console.log(`   Message: ${messageContent}`);
            console.log(`   Time: ${new Date().toISOString()}`);
            console.log(`   ---`);
            return { success: true, logged: true };
          }

          const message = {
            token: recipient.firebase_token,
            data: {
              title: `New message in ${groupName}`,
              body: `${senderName}: ${messageContent.length > 100 ? messageContent.substring(0, 100) + '...' : messageContent}`,
              icon: '/groupveil.png',
              click_action: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/`,
              groupId: String(groupId),
              senderId: String(senderId),
              type: 'message',
              groupName: String(groupName),
              senderName: String(senderName),
              recipientId: String(recipient._id)
            }
          };

          const response = await admin.messaging().send(message);
          console.log(`Notification sent to ${recipient.username || recipient.pseudonym}:`, response);
          return response;
        } catch (error) {
          console.error(`Failed to send notification to ${recipient.username || recipient.pseudonym}:`, error);
          // If token is invalid, remove it from user
          if (error.code === 'messaging/invalid-registration-token' || 
              error.code === 'messaging/registration-token-not-registered') {
            await User.findByIdAndUpdate(recipient._id, { firebase_token: '' });
            console.log(`Removed invalid token for user: ${recipient.username || recipient.pseudonym}`);
          }
          return null;
        }
      });

      const results = await Promise.allSettled(promises);
      const successCount = results.filter(result => result.status === 'fulfilled' && result.value).length;
      
      console.log(`Message notification sent to ${successCount}/${recipients.length} recipients`);
      return { successCount, totalRecipients: recipients.length };

    } catch (error) {
      console.error('Error sending message notification:', error);
      throw error;
    }
  }

  /**
   * Send notification when a new group is created
   * @param {string} groupId - The group ID
   * @param {string} groupName - The group name
   * @param {string} creatorName - The creator's name
   */
  static async sendGroupCreatedNotification(groupId, groupName, creatorName) {
    try {
      // Get all users who might be interested (you can customize this logic)
      const users = await User.find({ 
        firebase_token: { $exists: true, $ne: '' } 
      }).select('firebase_token username pseudonym');

      if (users.length === 0) {
        console.log('No users with valid FCM tokens found for group creation notification');
        return;
      }


      // Send to all users (you might want to limit this to specific roles or users)
      const promises = users.map(async (user) => {
        try {
          if (!firebaseInitialized) {
            // Log notification instead of sending
            console.log(`🔔 NOTIFICATION (Group Created):`);
            console.log(`   To: ${user.username || user.pseudonym} (${user._id})`);
            console.log(`   Group: ${groupName} (${groupId})`);
            console.log(`   Creator: ${creatorName}`);
            console.log(`   Time: ${new Date().toISOString()}`);
            console.log(`   ---`);
            return { success: true, logged: true };
          }

          const message = {
            token: user.firebase_token,
            data: {
              title: 'New Group Created',
              body: `${creatorName} created a new group: ${groupName}`,
              icon: '/groupveil.png',
              click_action: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/`,
              groupId: String(groupId),
              type: 'group_created',
              groupName: String(groupName),
              creatorName: String(creatorName),
              recipientId: String(user._id)
            }
          };

          const response = await admin.messaging().send(message);
          console.log(`Group creation notification sent to ${user.username || user.pseudonym}:`, response);
          return response;
        } catch (error) {
          console.error(`Failed to send group creation notification to ${user.username || user.pseudonym}:`, error);
          return null;
        }
      });

      const results = await Promise.allSettled(promises);
      const successCount = results.filter(result => result.status === 'fulfilled' && result.value).length;
      
      console.log(`Group creation notification sent to ${successCount}/${users.length} users`);
      return { successCount, totalUsers: users.length };

    } catch (error) {
      console.error('Error sending group creation notification:', error);
      throw error;
    }
  }

  /**
   * Send notification when a user joins a group
   * @param {string} groupId - The group ID
   * @param {string} groupName - The group name
   * @param {string} newMemberName - The new member's name
   */
  static async sendMemberJoinedNotification(groupId, groupName, newMemberName) {
    try {
      const group = await Group.findById(groupId).populate('members.user', 'firebase_token username pseudonym');
      if (!group) {
        console.error('Group not found:', groupId);
        return;
      }

      // Get all group members except the new member
      const recipients = group.members
        .map(memberObj => memberObj.user) // Extract the user from each member object
        .filter(member => 
          member.firebase_token && 
          member.firebase_token.trim() !== ''
        );

      if (recipients.length === 0) {
        console.log('No recipients with valid FCM tokens found for member joined notification');
        return;
      }


      const promises = recipients.map(async (recipient) => {
        try {
          if (!firebaseInitialized) {
            // Log notification instead of sending
            console.log(`🔔 NOTIFICATION (Member Joined):`);
            console.log(`   To: ${recipient.username || recipient.pseudonym} (${recipient._id})`);
            console.log(`   Group: ${groupName} (${groupId})`);
            console.log(`   New Member: ${newMemberName}`);
            console.log(`   Time: ${new Date().toISOString()}`);
            console.log(`   ---`);
            return { success: true, logged: true };
          }

          const message = {
            token: recipient.firebase_token,
            data: {
              title: `New member joined ${groupName}`,
              body: `${newMemberName} has joined the group`,
              icon: '/groupveil.png',
              click_action: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/`,
              groupId: String(groupId),
              type: 'member_joined',
              groupName: String(groupName),
              newMemberName: String(newMemberName),
              recipientId: String(recipient._id)
            }
          };

          const response = await admin.messaging().send(message);
          console.log(`Member joined notification sent to ${recipient.username || recipient.pseudonym}:`, response);
          return response;
        } catch (error) {
          console.error(`Failed to send member joined notification to ${recipient.username || recipient.pseudonym}:`, error);
          return null;
        }
      });

      const results = await Promise.allSettled(promises);
      const successCount = results.filter(result => result.status === 'fulfilled' && result.value).length;
      
      console.log(`Member joined notification sent to ${successCount}/${recipients.length} recipients`);
      return { successCount, totalRecipients: recipients.length };

    } catch (error) {
      console.error('Error sending member joined notification:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;
