const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  // Expect header: Authorization: Bearer <token>
  const authHeader = req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ msg: 'No token provided, access denied' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id: userId } now available in all protected routes
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is invalid or expired' });
  }
};