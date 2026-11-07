const express = require("express");
const Message = require("../models/Message");
const auth = require("../middleware/auth");
const User = require("../models/User");
const Group = require("../models/Group");
const NotificationService = require("../services/notificationService");
const router = express.Router();

// Send message
router.post("/", auth, async (req, res) => {
  try {
    const { content, groupId } = req.body;
    const message = new Message({
      content,
      group: groupId,
      sender: req.user._id
    });
    await message.save();
    
    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "username pseudonym role");

    // Get group details for notification
    const group = await Group.findById(groupId).select('name members');
    
    // Emit to group room
    const io = req.app.get('io');
    io.to(groupId).emit('message', populatedMessage);
    
    // Send push notification to group members (except sender)
    if (group) {
      try {
        await NotificationService.sendMessageNotification(
          groupId,
          req.user._id,
          content,
          populatedMessage.sender.pseudonym || populatedMessage.sender.username,
          group.name
        );
      } catch (notificationError) {
        console.error('Failed to send notification:', notificationError);
        // Don't fail the message sending if notification fails
      }
    }
    
    res.status(201).json(populatedMessage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get messages in group
router.get("/group/:groupId", auth, async (req, res) => {
  try {
    const messages = await Message.find({ group: req.params.groupId })
      .populate("sender", "username pseudonym role")
      .sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


router.post("/registerFirebaseToken", auth, async (req, res) => {
  try {
    const { firebase_token } = req.body;
    const user = await User.findById(req.user._id);
    user.firebase_token = firebase_token;
    await user.save();
    res.status(200).json({ message: "Firebase token registered successfully" });
  }
 catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
