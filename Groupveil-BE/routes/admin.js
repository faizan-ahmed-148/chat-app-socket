const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Group = require('../models/Group');
const Message = require('../models/Message');
const bcrypt = require('bcryptjs');

// Simple admin credentials (in production, use environment variables)
const ADMIN_USERNAME = process.env.ADMIN_USER;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; // Change this to a secure password

// Admin authentication middleware
const adminAuth = (req, res, next) => {
  const { username, password } = req.headers;
  
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    next();
  } else {
    res.status(401).json({ error: 'Admin authentication required' });
  }
};

// Admin login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      res.json({ 
        success: true, 
        message: 'Admin login successful',
        username: ADMIN_USERNAME
      });
    } else {
      res.status(401).json({ error: 'Invalid admin credentials' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/stats - Dashboard statistics
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalGroups = await Group.countDocuments();
    const totalMessages = await Message.countDocuments();
    const pendingGroups = await Group.countDocuments({ status: 'pending' });
    const approvedGroups = await Group.countDocuments({ status: 'approved' });
    const paidUsers = await User.countDocuments({ paymentStatus: 'paid' });
    
    res.json({
      totalUsers,
      totalGroups,
      totalMessages,
      pendingGroups,
      approvedGroups,
      paidUsers
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/recent-users - Recent user registrations
router.get('/recent-users', adminAuth, async (req, res) => {
  try {
    const users = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('username pseudonym email paymentStatus subscriptionPlan createdAt');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/pending-groups - Groups waiting for approval
router.get('/pending-groups', adminAuth, async (req, res) => {
  try {
    const groups = await Group.find({ status: 'pending' })
      .populate('creator', 'username pseudonym email paymentStatus')
      .sort({ createdAt: -1 });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/all-groups - All groups with status
router.get('/all-groups', adminAuth, async (req, res) => {
  try {
    const groups = await Group.find()
      .populate('creator', 'username pseudonym email paymentStatus')
      .sort({ createdAt: -1 });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/users - All users with payment info
router.get('/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find()
      .select('username pseudonym email paymentStatus subscriptionPlan totalGroupsCreated totalGroupsApproved createdAt')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/admin/groups/:id/approve - Approve a group
router.patch('/groups/:id/approve', adminAuth, async (req, res) => {
  try {
    const { paymentAmount, adminNotes } = req.body;
    const group = await Group.findById(req.params.id);
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    group.status = 'approved';
    group.paymentReceived = true;
    group.paymentAmount = paymentAmount;
    group.paymentDate = new Date();
    group.approvalDate = new Date();
    group.approvedBy = req.user?._id; // TODO: Get from auth middleware
    group.adminNotes = adminNotes;
    
    await group.save();
    
    // Update user stats
    await User.findByIdAndUpdate(group.creator, {
      $inc: { totalGroupsApproved: 1 },
      paymentStatus: 'paid'
    });
    
    res.json({ message: 'Group approved successfully', group });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/admin/groups/:id/reject - Reject a group
router.patch('/groups/:id/reject', adminAuth, async (req, res) => {
  try {
    const { adminNotes } = req.body;
    const group = await Group.findById(req.params.id);
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    group.status = 'rejected';
    group.adminNotes = adminNotes;
    
    await group.save();
    
    res.json({ message: 'Group rejected', group });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});
router.patch('/groups/:id/pending', adminAuth, async (req, res) => {
  try {
    const { adminNotes } = req.body;
    const group = await Group.findById(req.params.id);
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    group.status = 'pending';
    group.adminNotes = adminNotes;
    
    await group.save();
    
    res.json({ message: 'Group pending', group });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});
// PATCH /api/admin/users/:id/payment - Update user payment status
router.patch('/users/:id/payment', adminAuth, async (req, res) => {
  try {
    const { paymentStatus, subscriptionPlan, paymentAmount } = req.body;
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.paymentStatus = paymentStatus;
    user.subscriptionPlan = subscriptionPlan;
    user.lastPaymentDate = new Date();
    if (paymentAmount) {
      user.paymentDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    }
    
    await user.save();
    
    res.json({ message: 'User payment status updated', user });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/group/:id - Get specific group details
router.get('/groups/:id', adminAuth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('creator', 'username pseudonym email paymentStatus')
      .populate('members.user', 'username pseudonym');
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 