const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const moment = require('moment');

// Define the User schema
const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  fullName: {
    type: String,
    default: "usuario",
    trim: true
  },
  password: {
    type: String,
    required: false // Optional for social-only users
  },
  // Password reset flow fields
  resetPasswordToken: {
    type: String,
    index: true,
    sparse: true,
  },
  resetPasswordExpires: {
    type: Date,
    index: true,
  },
  role: {
    type: String,
    default: 'user',
    enum: ['user', 'admin', 'branch', 'partner']
  },
  // Removed legacy firebaseUid; use social.googleId/social.appleId
  securityToken: {
    type: String,
    default: null
  },
  suscription: {
    type: Boolean,
    default: false
  },
  systemIoId: {
    type: String,
    default: null,
    index: true,
    sparse: true,
    trim: true,
  },
  isStartSubscription: {
    type: Boolean,
    default: false
  },
  // Store subscription snapshot (RevenueCat-backed).
  // RevenueCat remains source of truth; this is a server-maintained cache.
  storeSubscriptionActive: {
    type: Boolean,
    default: false,
    index: true,
  },
  // Sticky marker to avoid false cancellation tagging for web-only users.
  storeHasEverBeenActive: {
    type: Boolean,
    default: false,
    index: true,
  },
  storeMembershipKind: {
    type: String,
    enum: ['none', 'monthly', 'yearly', 'unknown'],
    default: 'none',
  },
  storeEntitlementExpiresAt: {
    type: Date,
    default: null,
  },
  storeWillRenew: {
    type: Boolean,
    default: null,
  },
  subscriptionSnapshotSource: {
    type: String,
    enum: ['none', 'revenuecat_webhook', 'revenuecat_rest', 'login_reconcile'],
    default: 'none',
  },
  subscriptionSnapshotAt: {
    type: Date,
    default: null,
  },
  picture: {
    type: String,
    default: null
  },
  social: {
    googleId: { type: String, index: true, sparse: true },
    appleId: { type: String, index: true, sparse: true },
  },
  tokens: {
    google: {
      accessToken: { type: String, },
      refreshToken: { type: String },
    },
    apple: {
      refreshToken: { type: String },
    },
  },
  providerUnlinkedAt: {
    google: { type: Date },
    apple: { type: Date },
  }
}, {
  timestamps: true,
  toObject: { virtuals: true },
  toJSON: { virtuals: true }
});

// Define virtual for promotion days
UserSchema.virtual('promotionDays').get(function() {
  if (this.createdAt) {
    const createdAt = moment(this.createdAt);
    const now = moment();
    const diff = now.diff(createdAt, 'days');
    return diff;
  }
  return 0;
});

// Post middleware to calculate promotion days
UserSchema.post('findOne', async function(result) {
  try {
    if (result && result.createdAt) {
      const createdAt = moment(result.createdAt);
      const now = moment();
      const diff = now.diff(createdAt, 'days');
      
      // Set the virtual field
      result.set('promotionDays', diff);
      
      // Additional logic for promotion days > 7
      if (diff > 7) {
        console.log(`User ${result.email} has been active for ${diff} days`);
      }
    }
  } catch (error) {
    console.error('Error calculating promotion days:', error);
  }
});

// Define instance methods
UserSchema.methods = {
  // Get display name
  getDisplayName() {
    return this.fullName || this.email.split('@')[0];
  },
  
  // Check if user is active
  isActive() {
    return this.suscription === true;
  },
  
  // Check if user has started subscription
  hasStartedSubscription() {
    return this.isStartSubscription === true;
  },
  
  // Get user's promotion days
  getPromotionDays() {
    if (this.createdAt) {
      const createdAt = moment(this.createdAt);
      const now = moment();
      return now.diff(createdAt, 'days');
    }
    return 0;
  },
  
  // Check if user is admin
  isAdmin() {
    return this.role === 'admin';
  },
  
  // Check if user is partner
  isPartner() {
    return this.role === 'partner';
  }
};

// Define static methods
UserSchema.statics = {
  // Find user by email
  async findByEmail(email) {
    return this.findOne({ email: email.toLowerCase() });
  },
  
  // (deprecated) findByFirebaseUid removed
  
  // Find active users
  async findActiveUsers() {
    return this.find({ suscription: true });
  },
  
  // Find users by role
  async findByRole(role) {
    return this.find({ role });
  },

};

// Add pre-save hook to hash password
UserSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    const bcrypt = require('bcryptjs');
    const saltRounds = 12;
    // Avoid double-hashing if password already looks like a bcrypt hash
    const isAlreadyHashed = typeof this.password === 'string' &&
      (this.password.startsWith('$2a$') || this.password.startsWith('$2b$') || this.password.startsWith('$2y$')) &&
      this.password.length >= 60;
    if (!isAlreadyHashed) {
      this.password = await bcrypt.hash(this.password, saltRounds);
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Add methods to UserSchema
UserSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    const bcrypt = require('bcryptjs');
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

UserSchema.methods.generateAuthToken = function() {
  try {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { 
        sub: this._id.toString(), 
        email: this.email,
        role: this.role 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    return token;
  } catch (error) {
    throw error;
  }
};

// Add pagination plugin
UserSchema.plugin(mongoosePaginate);

// Create and export the model
const UserModel = mongoose.model('User', UserSchema);

module.exports = { UserModel };
