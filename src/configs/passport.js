const JwtStrategy = require('passport-jwt').Strategy;
const { ExtractJwt } = require('passport-jwt');
const { jwtSecret } = require('./vars');
const { UserModel } = require('../models/user.model');
const BearerStrategy = require('passport-http-bearer');

// Custom JWT extractor that supports both ssid and Authorization headers
const customJwtExtractor = (req) => {
  // First try Authorization header (Bearer token format)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    console.log('JWT extracted from Authorization header');
    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }
  
  // Then try ssid header (legacy format for live app)
  const ssidHeader = req.headers.ssid;
  if (ssidHeader) {
    console.log('JWT extracted from ssid header (legacy)');
    return ssidHeader;
  }
  
  // Return null if neither header is found
  console.log('No JWT token found in either Authorization or ssid headers');
  return null;
};

const jwtOptions = {
  secretOrKey: jwtSecret,
  jwtFromRequest: customJwtExtractor,
};

const jwt = async (payload, done) => {
  try {
    //comment
    const user = await UserModel.findById(payload.sub).select('+tokens');
    if (user) return done(null, user);
    return done(null, false);
  } catch (error) {
    return done(error, false);
  }
};

exports.jwt = new JwtStrategy(jwtOptions, jwt);
