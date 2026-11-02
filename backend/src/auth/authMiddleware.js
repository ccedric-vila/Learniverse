const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function protect(req, res, next) {
  const authorization = req.get('Authorization');
  const match = authorization && authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ message: 'Authentication token is required.' });
  }
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: 'Authentication is not configured.' });
  }

  try {
    const decoded = jwt.verify(match[1], process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'The account for this token no longer exists.' });
    }
    if (!user.isActive) {
      return res.status(401).json({ message: 'This account has been deactivated.' });
    }
    req.user = user;
    return next();
  } catch (_error) {
    return res.status(401).json({ message: 'Invalid or expired authentication token.' });
  }
}

function authorize(...roles) {
  const allowedRoles = roles.map((role) => role.toUpperCase());
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You are not authorized to access this resource.' });
    }
    return next();
  };
}

module.exports = { protect, authorize };