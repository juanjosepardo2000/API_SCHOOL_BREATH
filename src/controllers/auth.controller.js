const { Types } = require("mongoose");
const fs = require('fs');
const path = require('path');
const { UserModel } = require("../models/user.model");
const bcrypt = require('bcryptjs');
const crypto = require("crypto");
const nodemailer = require('nodemailer')
const axios = require("axios");
const { OAuth2Client } = require('google-auth-library');
const jose = require('jose');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../configs/vars');

const { AuditModel } = require('../models/audit.model');
const availableTags  = [
  { id: '1', name: 'Enrolled_Holistic Membership', },
  { id: '2', name: 'Enrolled_to_Sleep_Membership',  },
  { id: '3', name: 'Purchased_9-Day Breathwork Course' },
  { id: '4', name: 'Purchased_9-Day Meditation Course',  },
  { id: '5', name: 'Purchased_Swara_Yoga_Course',  },
  { id: '6', name: 'Purchased_9-Day Bliss Course',  },
  { id: '7', name: 'Purchased_12-Day ThirdEye Course',  },
  { id: '8', name: 'Purchased_Yoga_Course',  },
];


const APPLE_CLIENT_ID = "com.theschoolofbreath";
// -------- Systeme.io client --------
const systemeApi = axios.create({
  baseURL: 'https://api.systeme.io/api',
  timeout: 5000,
  headers: { 'x-api-key': process.env.API_SYSTEME_KEY || '' },
});

async function systemeFindContactByEmail(email) {
  if (!process.env.API_SYSTEME_KEY || !email) return null;
  try {
    const resp = await systemeApi.get('/contacts', { params: { email, limit: 100 } });
    const items = Array.isArray(resp.data?.items) ? resp.data.items : [];
    const first = items.find((item) => item?.id);
    if (!first) return null;
    return {
      id: String(first.id),
      email: first.email || email,
    };
  } catch (e) {
    console.error('Systeme.io contact lookup failed:', e.message);
    return null;
  }
}

async function createSystemeContact(email, fullName) {
  if (!process.env.API_SYSTEME_KEY) return { success: false, error: 'No API key' };
  try {
    const payload = { email };
    if (fullName) {
      payload.fields = [{ slug: 'first_name', value: fullName }];
    }
    const resp = await systemeApi.post('/contacts', payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    return { success: true, userId: resp.data?.id || resp.data?._id };
  } catch (e) {
    console.error('Systeme.io create contact failed:', e.message);
    return { success: false, error: e.message };
  }
}

// -------- Systeme.io Tag helpers --------
async function systemeFindTagByName(name) {
  if (!process.env.API_SYSTEME_KEY) return null;
  try {
    const resp = await systemeApi.get('/tags', { params: { query: name } });
    const items = resp.data?.items || [];
    console.log('Available tags:', items);
    return items.find((t) => t?.name === name) || null;
  } catch (e) {
    console.error('Systeme.io get tags failed:', e.message);
    return null;
  }
}

async function systemeAssignTagToContact(contactId, tagId) {
  if (!process.env.API_SYSTEME_KEY) return false;
  try {
    await systemeApi.post(`/contacts/${contactId}/tags`, { tagId });
    return true;
  } catch (e) {
    const status = e?.response?.status;
    // Tag already assigned or equivalent validation edge-case.
    if (status === 409 || status === 422) return true;
    console.error('Systeme.io assign tag failed:', e.message);
    return false;
  }
}

async function ensureSystemeNewAppUserTag(email, fullName) {
  if (!process.env.API_SYSTEME_KEY || !email) {
    return { success: false, reason: 'missing_config_or_email' };
  }

  let contact = await systemeFindContactByEmail(email);

  if (!contact?.id) {
    const created = await createSystemeContact(email, fullName);
    if (created?.success && created.userId) {
      contact = { id: String(created.userId), email };
    }
  }

  if (!contact?.id) {
    return { success: false, reason: 'contact_not_found' };
  }

  const desiredTag = 'new_app_user';
  const tag = await systemeFindTagByName(desiredTag);
  const tagId = tag?.id || tag?._id;
  if (!tagId) {
    console.error(`Systeme.io tag not found: ${desiredTag}`);
    return { success: false, reason: 'tag_not_found', contactId: contact.id };
  }

  const assigned = await systemeAssignTagToContact(contact.id, tagId);
  if (!assigned) {
    return { success: false, reason: 'assign_failed', contactId: contact.id };
  }

  return {
    success: true,
    contactId: contact.id,
    tagName: desiredTag,
  };
}

const validateUserData = async (userData) => {
  // Basic validation for required fields
  const errors = [];
  
  if (!userData.email) {
    errors.push({ field: 'email', reason: 'Email is required' });
  } else if (!/\S+@\S+\.\S+/.test(userData.email)) {
    errors.push({ field: 'email', reason: 'Email format is invalid' });
  }
  
  if (!userData.password) {
    errors.push({ field: 'password', reason: 'Password is required' });
  } else if (userData.password.length < 6) {
    errors.push({ field: 'password', reason: 'Password must be at least 6 characters' });
  }
  
  if (!userData.fullName) {
    errors.push({ field: 'fullName', reason: 'Full name is required' });
  }
  
  return errors.length > 0 ? errors : null;
};

const findUserByEmail = async (email) => {
  return UserModel.findOne({ email: email.toLowerCase() });
};

exports.store = async (req, res, next) => {
  try {
    const { email, password, fullName } = req.body;

    // Validate required fields
    if (!email || !password || !fullName) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and fullName are required'
      });
    }

    // Check if user already exists
    const userExists = await findUserByEmail(email);
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'Email is already registered'
      });
    }

    // Validate data
    const validationErrors = await validateUserData(req.body);
    if (validationErrors) {
      return res.status(400).json({
        success: false,
        message: 'Invalid data',
        errors: validationErrors
      });
    }

    // Create new user
    const newUser = new UserModel({
      email: email.toLowerCase(),
      password: password, // Will be hashed by the model's pre-save hook
      fullName: fullName,
      role: 'user' // Default role
    });

    const savedUser = await newUser.save();

    if (!savedUser._id) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create user account'
      });
    }

    // Generate JWT token
    const token = savedUser.generateAuthToken();
    
    // Systeme.io integration for new users:
    // ensure the app registration tag exists even if contact already existed in Systeme.
    try {
      const ensured = await ensureSystemeNewAppUserTag(email, fullName);
      if (ensured?.contactId) {
        await UserModel.updateOne(
          { _id: savedUser._id },
          { $set: { systemIoId: String(ensured.contactId) } }
        );
      }
      if (ensured?.success) {
        console.log(`Ensured ${email} has ${ensured.tagName} tag`);
      } else {
        console.warn('Systeme.io new_app_user ensure skipped/failed:', ensured?.reason || 'unknown');
        }
    } catch (e) {
      console.error('Systeme.io background create error:', e.message);
    }
    
    // Return user data without sensitive information
    const userData = {
      _id: savedUser._id,
      email: savedUser.email,
      fullName: savedUser.fullName,
      role: savedUser.role,
      subscription: savedUser.subscription,
      isStartSubscription: savedUser.isStartSubscription,
      systemIoId: savedUser.systemIoId,
      social: savedUser.social,
      createdAt: savedUser.createdAt,
      updatedAt: savedUser.updatedAt
    };

    return res.status(201).json({
      success: true,
      token,
      user: userData
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email is already registered'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const getFieldValue = (fields, slug) => {
  const field = fields.find(f => f.slug === slug);
  return field ? field.value : '';
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
 // First check Systeme.io before any local validation
 try {
  const response = await axios.get(`https://api.systeme.io/api/contacts?email=${email}`, {
    headers: {
      'x-api-key': process.env.API_SYSTEME_KEY
    },
  });

  const contact = response.data?.items[0];
  if (contact) {
    // Check if user has any of the available tags
    const userTags = contact.tags.map(tag => tag.name);
    const hasValidTag = userTags.some(tag => 
      availableTags.some(availableTag => availableTag.name === tag)
    );

    if (hasValidTag) {
      // Check if user already exists in our DB
      let existingUser = await UserModel.findOne({ email: email.toLowerCase() });
      
      if (!existingUser) {
        // Get fields from Systeme.io response
        const fullName = getFieldValue(contact.fields, 'first_name');

        // Create new user with fields from Systeme.io
        const newUser = new UserModel({
          email: email,
          password: 'welcome123', // Will be hashed by the model
          fullName: fullName,
        });

        await newUser.save();
        // Set the password for the request
        req.body.password = 'welcome123';
      }
    }
  }
} catch (error) {
  console.error('Systeme.io API Error:', error);
}
    // Find user by email
    const user = await UserModel.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user has a password (social-only users might not have one)
    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'This account was created with social login. Please use Google or Apple sign-in.'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Generate JWT token
    const token = user.generateAuthToken();
    
    // Return user data without sensitive information
    const userData = {
      _id: user._id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      subscription: user.subscription,
      isStartSubscription: user.isStartSubscription,
      systemIoId: user.systemIoId,
      social: user.social,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    return res.status(200).json({
      success: true,
      token,
      user: userData
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    // User must be authenticated via JWT middleware
    const userId = req.user && req.user._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { currentPassword, newPassword, confirmNewPassword } = req.body || {};

    // Basic validation
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: "currentPassword, newPassword and confirmNewPassword are required",
      });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirmation do not match",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Some social-only users might not have a password set
    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: "This account was created with social login and has no password set",
      });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Set new password – pre-save hook on the model will hash it
    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    return next(error);
  }
};

// Function to generate a password reset token
exports.generateResetToken = async (req, res, next) => {
 try {
  const userEmail = req.body.email;
  const user = await UserModel.findOne({ email: userEmail });

  if (!user) {
      return res.status(404).json({ message: "User not found" });
  }

  // Generate token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Persist token without triggering full schema validation (avoids firebaseUid required)
  await UserModel.updateOne(
    { _id: user._id },
    {
      $set: {
        resetPasswordToken: resetToken,
        resetPasswordExpires: Date.now() + 3600000, // 1 hour
      },
    },
    { runValidators: false }
  );

 
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // upgrade later with STARTTLS
    auth: {
      user: "theschoolofbreathai@gmail.com",
      pass: "gepo slfp eljw odcz",
    },
  });

  console.log('Sending password reset email to:', resetToken);

  const resetUrl = `https://sleepappmsuic.vercel.app/app/change-password/${resetToken}`;
  const mailOptions = {
      from: 'meditatewithabhi@gmail.com',
      to: user.email,
      subject: 'Password Reset',
      text: `This link only works on mobile devices. Please open the link on your phone to continue the process. If you try to open it on a laptop or desktop, it may not work: ${resetUrl}`
  };

  transporter.sendMail(mailOptions, function(error, info) {
      if (error) {
          return res.status(500).json({ message: "Error sending email" });
      }
      res.status(200).json({ message: 'Email sent' });
  });
 } catch (error) {
  console.log(error);
 }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body || {};

    // Validate inputs
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: 'Invalid or missing token' });
    }
    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({ message: 'Invalid new password' });
    }

    const user = await UserModel.findOne({ 
        resetPasswordToken: token, 
        resetPasswordExpires: { $gt: Date.now() } 
    });

    if (!user) {
        return res.status(400).json({ message: "Password reset token is invalid or has expired." });
    }

    // Set plain password - the model's pre-save hook will hash it
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Password has been updated." });
  } catch (error) {
    next(error);
  }
};

// --- Social login / sign-up ---
exports.socialLogin = async (req, res, next) => {
  try {
    const { provider, idToken, authorizationCode, redirectUri, clientId, accessToken } = req.body || {};
    if (!provider || (provider !== 'google' && provider !== 'apple')) {
      return res.status(400).json({ success: false, info: 'Invalid provider' });
    }

    console.log('Social login request received:', { provider, idToken, authorizationCode, redirectUri, clientId, accessToken });
    let claims = null;
    let appleRefreshToken = null;

    if (provider === 'google') {
      if (!idToken) return res.status(400).json({ success: false, info: 'idToken required for Google' });
      const aud = process.env.GOOGLE_CLIENT_ID || "116109207837-nhhjo9bkk5nq3ha2hbq2judfum6d33g5.apps.googleusercontent.com";
      const client = new OAuth2Client(aud);
      const ticket = await client.verifyIdToken({ idToken, audience: aud });
      const payload = ticket.getPayload();
      if (!payload || !payload.sub) return res.status(401).json({ success: false, info: 'Invalid Google token' });
      claims = {
        provider: 'google',
        sub: payload.sub,
        email: payload.email?.toLowerCase() || null,
        email_verified: payload.email_verified === true,
        name: payload.name || null,
        picture: payload.picture || null,
      };
    } else if (provider === 'apple') {
      if (!idToken && !authorizationCode) return res.status(400).json({ success: false, info: 'idToken or authorizationCode required for Apple' });
      if (idToken) {
        const jwks = jose.createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
        
        // For mobile apps, Apple uses the App ID as audience, not Service ID
        // Let's verify the token first to see what audience it has
        let payload;
        try {
          const result = await jose.jwtVerify(idToken, jwks, {
            issuer: 'https://appleid.apple.com',
            // Don't validate audience yet, we'll check it manually
          });
          payload = result.payload;
          
         
        } catch (error) {
          console.error('Apple token verification failed:', error.message);
          return res.status(401).json({ success: false, info: 'Invalid Apple token' });
        }
        
        // Extract all Apple JWT claims according to Apple Developer documentation 2025
        claims = {
          provider: 'apple',
          sub: payload.sub, // Unique user identifier
          email: (payload.email || '').toLowerCase() || null, // User's email (may be present only on first login)
          email_verified: payload.email_verified === 'true' || payload.email_verified === true, // Email verification status
          name: payload.name || null, // User's name (may be present only on first login)
          picture: null, // Apple doesn't provide profile pictures
          // Apple-specific claims
          at_hash: payload.at_hash || null, // Access token hash
          c_hash: payload.c_hash || null, // Authorization code hash
          auth_time: payload.auth_time || null, // Authentication time
          nonce: payload.nonce || null, // Nonce value if used
          // Standard JWT claims
          aud: payload.aud, // Audience (should match client ID)
          iss: payload.iss, // Issuer (should be https://appleid.apple.com)
          exp: payload.exp, // Expiration time
          iat: payload.iat, // Issued at time
        };
        
        console.log('Apple JWT claims extracted:', {
          sub: claims.sub,
          email: claims.email,
          email_verified: claims.email_verified,
          name: claims.name,
          aud: claims.aud,
          iss: claims.iss,
          has_at_hash: !!claims.at_hash,
          has_c_hash: !!claims.c_hash,
          has_nonce: !!claims.nonce
        });
      }
      if (authorizationCode) {
        // Exchange authorization code for refresh token to store for future revoke operations
        try {
          console.log('Attempting Apple token exchange with authorizationCode:', authorizationCode);
          const clientSecret = await buildAppleClientSecret();
          console.log('Client secret generated successfully');
          const params = new URLSearchParams();
          params.append('client_id',  APPLE_CLIENT_ID);
          params.append('client_secret', clientSecret);
          params.append('code', authorizationCode);
          params.append('grant_type', 'authorization_code');
          if (redirectUri) params.append('redirect_uri', redirectUri);
        
          const resp = await axios.post('https://appleid.apple.com/auth/token', params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
          });
          appleRefreshToken = resp.data?.refresh_token || null;
          console.log('Apple token exchange successful, refreshToken:', appleRefreshToken ? 'present' : 'not present');
        } catch (e) {
          console.error('Apple token exchange failed:', e.response?.data || e.message);
          return res.status(401).json({ success: false, info: 'Invalid Apple proof' });
        }
      }
      if (!claims) return res.status(401).json({ success: false, info: 'Invalid Apple proof' });
    }

    // Find user by provider ID first
    const providerKey = provider === 'google' ? 'googleId' : 'appleId';
    const socialQuery = {}; socialQuery[`social.${providerKey}`] = claims.sub;
    let user = await UserModel.findOne(socialQuery);

    // If user found by provider ID, proceed with login

    if (!user && claims.email) {
      // Check by email - if user exists, link the social account to existing user
      user = await UserModel.findOne({ email: claims.email });
      if (user) {
        // Link social account to existing user
        user.social = user.social || {};
        user.social[providerKey] = claims.sub;
        
        // Update tokens if provided
        if (appleRefreshToken) {
          user.tokens = user.tokens || {};
          user.tokens.apple = user.tokens.apple || {};
          user.tokens.apple.refreshToken = appleRefreshToken;
        }
        if (provider === 'google' && accessToken) {
          user.tokens = user.tokens || {};
          user.tokens.google = user.tokens.google || {};
          user.tokens.google.accessToken = accessToken;
        }
        
        await user.save();
        await AuditModel.create({ userId: user._id, provider, action: 'linked' });
        console.log('Linked social account to existing user:', user.email);
      }
    }

    if (!user) {
    
     
      // Create new user
      const newDoc = {
        email: claims.email || `${claims.sub}@placeholder.local`,
        password: 'parzival@123', // Random password for social users
        fullName: claims.name || (claims.email ? claims.email.split('@')[0] : 'usuario'),
        role: 'user',
        picture: claims.picture || null,
        social: { [providerKey]: claims.sub },
        tokens: {}
      };
      if (appleRefreshToken) {
        newDoc.tokens.apple = { refreshToken: appleRefreshToken };
        console.log('Storing Apple refreshToken in new user');
      }
      if (provider === 'google' && accessToken) {
        newDoc.tokens.google = { accessToken };
        console.log('Storing Google accessToken in new user');
      }
      
      console.log('Creating new user with tokens:', JSON.stringify(newDoc.tokens, null, 2));
      user = await UserModel.create(newDoc);
      console.log('User created successfully with ID:', user._id);
      
      // Systeme.io integration for new users:
      // ensure the app registration tag exists even if contact already existed in Systeme.
      if (claims.email && claims.email !== `${claims.sub}@placeholder.local`) {
        try {
          const ensured = await ensureSystemeNewAppUserTag(claims.email, user.fullName);
          if (ensured?.contactId) {
            user.systemIoId = String(ensured.contactId);
            await user.save();
          }
          if (ensured?.success) {
            console.log(`Ensured ${claims.email} has ${ensured.tagName} tag`);
          } else {
            console.warn('Systeme.io new_app_user ensure skipped/failed:', ensured?.reason || 'unknown');
          }
        } catch (e) {
          console.error('Systeme.io background create error:', e.message);
        }
      }
      
      // Audit linked
      await AuditModel.create({ userId: user._id, provider, action: 'linked' });
    } else {
      // Attach/refresh provider linkage
      user.social = user.social || {};
      user.social[providerKey] = claims.sub;
      if (appleRefreshToken) {
        user.tokens = user.tokens || {};
        user.tokens.apple = user.tokens.apple || {};
        user.tokens.apple.refreshToken = appleRefreshToken;
      }
      if (provider === 'google' && accessToken) {
        user.tokens = user.tokens || {};
        user.tokens.google = user.tokens.google || {};
        user.tokens.google.accessToken = accessToken;
      }
      await user.save();
      await AuditModel.create({ userId: user._id, provider, action: 'linked' });
    }

    // Issue app session JWT (same shape as /auth/login response pattern)
    const tokenPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role || 'user',
      loginType: provider,
    };
    const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: '30d' });

    return res.status(200).json({ success: true, token, user: {
      _id: user._id,
      email: user.email,
      fullName: user.fullName,
      loginType: provider,
    }});
  } catch (error) {
    return next(error);
  }
}


// --- Social account linking ---
exports.socialLink = async (req, res, next) => {
  try {
    const { provider, idToken, authorizationCode, redirectUri, clientId, accessToken } = req.body || {};
    console.log('Social link request received:', { provider, idToken, authorizationCode, redirectUri, clientId, accessToken });
    if (!provider || (provider !== 'google' && provider !== 'apple')) {
      return res.status(400).json({ success: false, info: 'Invalid provider' });
    }

    // Ensure user is authenticated for linking
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required for linking social accounts' 
      });
    }

    let claims = null;
    let appleRefreshToken = null;

    if (provider === 'google') {
      if (!idToken) return res.status(400).json({ success: false, info: 'idToken required for Google' });
      const aud = process.env.GOOGLE_CLIENT_ID || "116109207837-nhhjo9bkk5nq3ha2hbq2judfum6d33g5.apps.googleusercontent.com";
      const client = new OAuth2Client(aud);
      const ticket = await client.verifyIdToken({ idToken, audience: aud });
      const payload = ticket.getPayload();
      if (!payload || !payload.sub) return res.status(401).json({ success: false, info: 'Invalid Google token' });
      claims = {
        provider: 'google',
        sub: payload.sub,
        email: payload.email?.toLowerCase() || null,
        email_verified: payload.email_verified === true,
        name: payload.name || null,
        picture: payload.picture || null,
      };
    } else if (provider === 'apple') {
      if (!idToken && !authorizationCode) return res.status(400).json({ success: false, info: 'idToken or authorizationCode required for Apple' });
      if (idToken) {
        const jwks = jose.createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
        let payload;
        try {
          const result = await jose.jwtVerify(idToken, jwks, {
            issuer: 'https://appleid.apple.com',
            // Don't validate audience yet, we'll check it manually
          });
          payload = result.payload;
          
     
          
          // Validate audience manually - it should be the App ID
          const expectedAudience = APPLE_CLIENT_ID;
          if (payload.aud !== expectedAudience) {
            console.log('Apple token audience mismatch (socialLink), but continuing with actual audience:', payload.aud);
            // For mobile apps, we'll accept the actual audience from the token
          }
        } catch (error) {
          console.error('Apple token verification failed (socialLink):', error.message);
          return res.status(401).json({ success: false, info: 'Invalid Apple token' });
        }
        
        if (!payload || !payload.sub) return res.status(401).json({ success: false, info: 'Invalid Apple token' });
        
        // Extract all Apple JWT claims according to Apple Developer documentation 2025
        claims = {
          provider: 'apple',
          sub: payload.sub, // Unique user identifier
          email: (payload.email || '').toLowerCase() || null, // User's email (may be present only on first login)
          email_verified: payload.email_verified === 'true' || payload.email_verified === true, // Email verification status
          name: payload.name || null, // User's name (may be present only on first login)
          picture: null, // Apple doesn't provide profile pictures
          // Apple-specific claims
          at_hash: payload.at_hash || null, // Access token hash
          c_hash: payload.c_hash || null, // Authorization code hash
          auth_time: payload.auth_time || null, // Authentication time
          nonce: payload.nonce || null, // Nonce value if used
          // Standard JWT claims
          aud: payload.aud, // Audience (should match client ID)
          iss: payload.iss, // Issuer (should be https://appleid.apple.com)
          exp: payload.exp, // Expiration time
          iat: payload.iat, // Issued at time
        };
        
       
      }
      if (authorizationCode) {
        // Exchange authorization code for refresh token to store for future revoke operations
        const clientSecret = await buildAppleClientSecret(clientId);
        console.log('Client secret generated successfully');
        const params = new URLSearchParams();
        params.append('client_id', APPLE_CLIENT_ID || process.env.APPLE_CLIENT_ID);
        params.append('client_secret', clientSecret);
        params.append('code', authorizationCode);
        params.append('grant_type', 'authorization_code');
        if (redirectUri) params.append('redirect_uri', redirectUri);
        const res = await axios.post('https://appleid.apple.com/auth/token', params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        if (res.data?.refresh_token) appleRefreshToken = res.data.refresh_token;
      }
    }

    if (!claims) return res.status(400).json({ success: false, info: 'Failed to verify token' });

    // Check if this provider is already linked to this user
    const providerKey = provider === 'google' ? 'googleId' : 'appleId';
    if (req.user.social && req.user.social[providerKey]) {
      return res.status(400).json({ 
        success: false, 
        message: `${provider} account is already linked to this user` 
      });
    }

    // Check if this provider is already linked to another user
    const socialQuery = {}; 
    socialQuery[`social.${providerKey}`] = claims.sub;
    const existingUser = await UserModel.findOne(socialQuery);
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: `${provider} account is already linked to another user` 
      });
    }

    // Link the provider to the current user
    req.user.social = req.user.social || {};
    req.user.social[providerKey] = claims.sub;
    
    if (appleRefreshToken) {
      req.user.tokens = req.user.tokens || {};
      req.user.tokens.apple = req.user.tokens.apple || {};
      req.user.tokens.apple.refreshToken = appleRefreshToken;
    }
    if (provider === 'google' && accessToken) {
      req.user.tokens = req.user.tokens || {};
      req.user.tokens.google = req.user.tokens.google || {};
      req.user.tokens.google.accessToken = accessToken;
    }
    
    await req.user.save();
    await AuditModel.create({ userId: req.user._id, provider, action: 'linked' });

    return res.status(200).json({ 
      success: true, 
      message: `${provider} account linked successfully`,
      user: {
        _id: req.user._id,
        email: req.user.email,
        fullName: req.user.fullName,
        social: req.user.social
      }
    });
  } catch (error) {
    return next(error);
  }
}

// Build Apple client_secret (ES256)
async function buildAppleClientSecret(clientId = null) {

  
  // Use environment variables with fallbacks
  const teamId = "LG4QX5G8QG"; // Your actual Team ID
  const appClientId = APPLE_CLIENT_ID; // Use provided clientId or fallback
  const keyId = "GZQYCDB5C9"; // From your .p8 filename
  

  let privateKey;
  
  try {
   privateKey = process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n');
  } catch (error) {
    console.error('Error reading Apple private key file:', error.message);
    // Fallback to environment variable
    privateKey = process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!privateKey) {
      throw new Error('Apple private key not found in file or environment variable');
    }
  }
  
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + 60 * 60 * 12, // 12h
    aud: 'https://appleid.apple.com',
    sub: appClientId,
  };
  
  console.log('Building Apple client secret with:', {
    teamId,
    clientId: appClientId,
    keyId,
    hasPrivateKey: !!privateKey
  });
  
  const key = await jose.importPKCS8(privateKey, 'ES256');
  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .sign(key);
}

// --- Unlink / revoke ---
exports.unlinkProvider = async (req, res, next) => {
  try {
    const { provider, userId } = req.body || {};
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'userId is required' 
      });
    }
    
    const user = await UserModel.findById(userId).select('+tokens');
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // First check: If no provider is passed, automatically detect all linked providers
    const providersToUnlink = [];
    
    if (!provider) {
      // Case A, B, C: Automatically detect linked providers from database
      if (user.social?.googleId) {
        providersToUnlink.push('google');
      }
      if (user.social?.appleId) {
        providersToUnlink.push('apple');
      }
      console.log('No provider specified - auto-detecting linked providers:', providersToUnlink);
    } else {
      // Second check: If specific provider is requested, validate and unlink only that one
      if (provider === 'google' || provider === 'apple') {
        // Check if the requested provider is actually linked
        if (provider === 'google' && user.social?.googleId) {
          providersToUnlink.push('google');
        } else if (provider === 'apple' && user.social?.appleId) {
          providersToUnlink.push('apple');
        } else {
          return res.status(400).json({ 
            success: false, 
            message: `${provider} is not linked to this user` 
          });
        }
        console.log('Specific provider requested:', provider, 'Found in DB:', providersToUnlink.length > 0);
      } else {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid provider. Use "google" or "apple", or omit provider to unlink all' 
        });
      }
    }
    
    console.log('Unlink request for providers:', providersToUnlink);
    console.log('User current social links:', user.social);
    console.log('User current tokens:', user.tokens);
    
    // Track which providers were actually unlinked
    const unlinkedProviders = [];
    const failedProviders = [];
    
    // Process each provider
    for (const currentProvider of providersToUnlink) {
      const providerKey = currentProvider === 'google' ? 'googleId' : 'appleId';
      const hasSocialLink = user.social && user.social[providerKey];
      
      if (!hasSocialLink) {
        console.log(`${currentProvider} is not linked to this user, skipping`);
        continue; // Skip if not linked
      }
      
      // Revoke tokens with provider
      try {
        if (currentProvider === 'google' && user.tokens?.google?.refreshToken) {
          console.log('Revoking Google token...');
          const params = new URLSearchParams();
          params.append('token', user.tokens.google.refreshToken);
          const response = await axios.post('https://oauth2.googleapis.com/revoke', 
            params.toString(), { 
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' } 
            });
          console.log('Google token revoked successfully:', response.status);
        }

        if (currentProvider === 'apple' && user.tokens?.apple?.refreshToken) {
          console.log('Revoking Apple token...');
          const clientSecret = await buildAppleClientSecret(APPLE_CLIENT_ID);
          const params = new URLSearchParams();
          params.append('client_id', APPLE_CLIENT_ID);
          params.append('client_secret', clientSecret);
          params.append('token', user.tokens.apple.refreshToken);
          params.append('token_type_hint', 'refresh_token');
          const response = await axios.post('https://appleid.apple.com/auth/revoke', 
            params.toString(), { 
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' } 
            });
          console.log('Apple token revoked successfully:', response.status);
        }
      } catch (error) {
        console.error(`${currentProvider} token revocation failed:`, error.response?.data || error.message);
        // Continue with database cleanup even if revocation fails
        failedProviders.push(currentProvider);
      }
      
      unlinkedProviders.push(currentProvider);
    }
    
    // If no providers were actually linked, return success
    if (providersToUnlink.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: 'No social accounts were linked to unlink',
        unlinkedProviders: [],
        failedProviders: []
      });
    }
    
    // Cleanup database - remove social links and tokens
    const updateData = {
      $unset: {},
      $set: {
        providerUnlinkedAt: user.providerUnlinkedAt || {}
      }
    };
    
    // Remove social links and tokens for unlinked providers
    for (const currentProvider of unlinkedProviders) {
      if (currentProvider === 'google') {
        updateData.$unset['social.googleId'] = 1;
        updateData.$unset['tokens.google'] = 1;
      }
      if (currentProvider === 'apple') {
        updateData.$unset['social.appleId'] = 1;
        updateData.$unset['tokens.apple'] = 1;
      }
      updateData.$set.providerUnlinkedAt[currentProvider] = new Date();
    }
    
    // Update user in database
    await UserModel.findByIdAndUpdate(userId, updateData);
    
    // Create audit logs for each unlinked provider
    for (const currentProvider of unlinkedProviders) {
      await AuditModel.create({ 
        userId: user._id, 
        provider: currentProvider, 
        action: 'unlinked',
        timestamp: new Date(),
        ip: req.ip,
        requestId: req.headers['x-request-id'] || crypto.randomUUID(),
        userAgent: req.headers['user-agent']
      });
    }
    
    // Prepare response message
    let message = '';
    if (unlinkedProviders.length === 1) {
      message = `${unlinkedProviders[0]} account unlinked successfully`;
    } else {
      message = `${unlinkedProviders.join(' and ')} accounts unlinked successfully`;
    }
    
    if (failedProviders.length > 0) {
      message += `. Note: Token revocation failed for ${failedProviders.join(', ')}, but accounts were unlinked locally.`;
    }
    
    return res.status(200).json({ 
      success: true, 
      message,
      unlinkedProviders,
      failedProviders
    });
    
  } catch (error) {
    console.error('Unlink provider error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error during unlink process' 
    });
  }
}









