const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");
const router = express.Router();

// Generate pseudonym
const generatePseudonym = (role) => {
  const randomNum = Math.floor(Math.random() * 1000);
  return `${role.charAt(0).toUpperCase() + role.slice(1)}-${randomNum}`;
};
const generateUniqueCode = () => {
  const randomNum = Math.floor(Math.random() * 1000);
  return `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}` + 
         `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}` + 
         `${randomNum.toString().padStart(3, '0')}`;
};
// Register
router.post("/register", async (req, res) => {
  try {
    const { username, password, role = "developer",email } = req.body;
    
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const pseudonym = generatePseudonym(role);
    const uniqueId = generateUniqueCode();
    const user = new User({ username, password, role, pseudonym,email ,uniqueId});
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || "your-secret-key");
    
    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        pseudonym: user.pseudonym,
        uniqueId: user.uniqueId,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || "your-secret-key");
    
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        pseudonym: user.pseudonym,
        role: user.role,
        uniqueId: user?.uniqueId
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


router.get("/me", auth,async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(400).json({ success: false, error: "Invalid credentials" });
    }
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || "your-secret-key");

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        pseudonym: user.pseudonym,
        role: user.role,
        uniqueId: user?.uniqueId
      }
    });
  } catch (error) {
    res.status(500).json({  success: false, error: error.message });
  }
});

module.exports = router;
