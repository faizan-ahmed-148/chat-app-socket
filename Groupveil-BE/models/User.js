const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  uniqueId:{
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  pseudonym: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  role: {
    type: String,
    enum: ["user", "admin", "manager", "developer", "designer", "analyst", "tester", "client"],
    default: "user"
  },
  // Payment and subscription fields
  paymentStatus: {
    type: String,
    enum: ["free", "paid", "expired"],
    default: "free"
  },
  subscriptionPlan: {
    type: String,
    enum: ["free", "basic", "premium", "enterprise"],
    default: "free"
  },
  paymentDueDate: {
    type: Date
  },
  lastPaymentDate: {
    type: Date
  },
  totalGroupsCreated: {
    type: Number,
    default: 0
  },
  totalGroupsApproved: {
    type: Number,
    default: 0
  },
  firebase_token: {
    type: String,
    default: ""
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre("save", async function(next) {
  if (!this.isModified("password")) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
