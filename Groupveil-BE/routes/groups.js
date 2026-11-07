const express = require("express");
const Group = require("../models/Group");
const User = require("../models/User");
const Message = require("../models/Message");
const auth = require("../middleware/auth");
const NotificationService = require("../services/notificationService");
const router = express.Router();

// Create group
router.post("/", auth, async (req, res) => {
  try {
    const { name, description } = req.body;
    const group = new Group({
      name,
      description,
      creator: req.user._id,
      members: [{ user: req.user._id }],
      status: 'pending' // Set to pending for approval
    });
    await group.save();
    
    // Update user stats
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { totalGroupsCreated: 1 }
    });
    
    // Send notification about group creation (optional - you might want to limit this)
    try {
      const creator = await User.findById(req.user._id).select('username pseudonym');
      await NotificationService.sendGroupCreatedNotification(
        group._id,
        name,
        creator.pseudonym || creator.username
      );
    } catch (notificationError) {
      console.error('Failed to send group creation notification:', notificationError);
      // Don't fail group creation if notification fails
    }
    
    res.status(201).json({
      ...group.toObject(),
      message: 'Group created successfully and is pending approval. You will be notified once approved.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all users (for debugging - to see available pseudonyms)
router.get("/users/list", auth, async (req, res) => {
  try {
    const users = await User.find({}, "username pseudonym role");
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all groups where the current user is a member (only approved groups)
router.get("/my", auth, async (req, res) => {
  try {
    const groups = await Group.find({
      "members.user": req.user._id,
      status: 'approved' // Only show approved groups
    }).populate("members.user", "username pseudonym role");
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get groups created by the user (including pending ones)
router.get("/mine", auth, async (req, res) => {
  try {
    const groups = await Group.find({ creator: req.user._id })
      .populate("members.user", "username pseudonym role")
      .populate("creator", "username pseudonym role");
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get groups where the user is a member (but not creator) - only approved
router.get("/member", auth, async (req, res) => {
  try {
    const groups = await Group.find({
      "members.user": req.user._id,
      creator: { $ne: req.user._id },
      status: 'approved' // Only show approved groups
    })
      .populate("members.user", "username pseudonym role")
      .populate("creator", "username pseudonym role");
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single group by ID (only if approved or user is creator)
router.get("/:groupId", auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId)
      .populate("members.user", "username pseudonym role");
    
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }
    
    // Check if user can access this group
    const isCreator = group.creator.toString() === req.user._id.toString();
    const isMember = group.members.some(member => member.user._id.toString() === req.user._id.toString());
    
    if (!isCreator && (!isMember || group.status !== 'approved')) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    res.json(group);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add user to group
router.post("/:groupId/add-user", auth, async (req, res) => {
  try {
    const { pseudonym } = req.body;
    const user = await User.findOne({ uniqueId: pseudonym });
    
    if (!user) {
      return res.status(404).json({ error: "User not found with this Code" });
    }

    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    const isAlreadyMember = group.members.some(member => 
      member.user.toString() === user._id.toString()
    );
    
    if (isAlreadyMember) {
      return res.status(400).json({ error: "User is already a member" });
    }

    group.members.push({ user: user._id });
    await group.save();
    
    // Send notification about new member joining
    try {
      await NotificationService.sendMemberJoinedNotification(
        group._id,
        group.name,
        user.pseudonym || user.username
      );
    } catch (notificationError) {
      console.error('Failed to send member joined notification:', notificationError);
      // Don't fail the operation if notification fails
    }
    
    // Populate the members before sending response
    const populatedGroup = await Group.findById(group._id)
      .populate("members.user", "username pseudonym role");
    
    res.json(populatedGroup);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove user from group (creator only)
router.delete('/:groupId/remove-user/:userId', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (String(group.creator) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Only the group creator can remove users' });
    }
    // Prevent removing self
    if (String(req.user._id) === req.params.userId) {
      return res.status(400).json({ error: 'Creator cannot remove themselves' });
    }
    group.members = group.members.filter(m => String(m.user) !== req.params.userId);
    await group.save();
    const updated = await Group.findById(group._id).populate('members.user', 'username pseudonym role');
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Pin a message (creator only)
router.post('/:groupId/pin/:messageId', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (String(group.creator) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Only the group creator can pin messages' });
    }
    group.pinnedMessage = req.params.messageId;
    await group.save();
    const updated = await Group.findById(group._id)
      .populate('members.user', 'username pseudonym role')
      .populate('pinnedMessage');
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unpin message (creator only)
router.post('/:groupId/unpin', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (String(group.creator) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Only the group creator can unpin messages' });
    }
    group.pinnedMessage = null;
    await group.save();
    const updated = await Group.findById(group._id)
      .populate('members.user', 'username pseudonym role')
      .populate('pinnedMessage');
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Leave group (any member except creator)
router.post('/:groupId/leave', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (String(group.creator) === String(req.user._id)) {
      return res.status(400).json({ error: 'Creator cannot leave their own group' });
    }
    group.members = group.members.filter(m => String(m.user) !== String(req.user._id));
    await group.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get unread message counts for all user's groups
router.get('/unread-counts', auth, async (req, res) => {
  try {
    const { lastSeenMessageIds } = req.query;
    let lastSeenMap = {};
    
    if (lastSeenMessageIds) {
      try {
        lastSeenMap = JSON.parse(lastSeenMessageIds);
      } catch (e) {
        // If parsing fails, use empty object
        lastSeenMap = {};
      }
    }

    // Get all groups where user is a member
    const groups = await Group.find({
      "members.user": req.user._id,
      status: 'approved'
    }).select('_id name');

    const unreadCounts = {};

    for (const group of groups) {
      const lastSeenId = lastSeenMap[group._id];
      if (lastSeenId) {
        // Count messages after the last seen message using ObjectId comparison
        try {
          const count = await Message.countDocuments({
            group: group._id,
            _id: { $gt: lastSeenId }
          });
          unreadCounts[group._id] = count;
        } catch (error) {
          // If ObjectId comparison fails, fallback to counting all messages
          const count = await Message.countDocuments({
            group: group._id
          });
          unreadCounts[group._id] = count;
        }
      } else {
        // If no last seen message, count all messages
        const count = await Message.countDocuments({
          group: group._id
        });
        unreadCounts[group._id] = count;
      }
    }

    res.json(unreadCounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
