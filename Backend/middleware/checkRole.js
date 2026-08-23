// Role-based access control middleware
module.exports = function (...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ msg: 'Access denied for your role' });
    }
    next();
  };
};