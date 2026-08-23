const rateLimit                  = require('express-rate-limit');
const express                    = require('express');
const bcrypt                     = require('bcryptjs');
const jwt                        = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User                       = require('../models/User');
const auth                       = require('../middleware/auth');
const router                     = express.Router();

// Strict limiter for auth routes — 10 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { msg: 'Too many login attempts, try again later.' }
});

// ─── POST /api/auth/register ──────────────────────────────────
router.post('/register', authLimiter, [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['borrower', 'lender', 'both'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const { name, email, password, role } = req.body;

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ msg: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 12);
    const user   = new User({ name, email, password: hashed, role: role || 'borrower' });
    await user.save();

    // Include role in token so checkRole middleware works
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    

    res.status(201).json({
      msg: 'Registration successful',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({
      msg: 'Server error',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

// POST /api/auth/login   
router.post('/login', authLimiter, [
  body('email').isEmail().withMessage('Enter a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ msg: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ msg: 'Invalid email or password' });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      msg: 'Login successful',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({
      msg: 'Server error',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

//  GET /api/auth/me 
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({
      msg: 'Server error',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

// ─── PATCH /api/auth/wallet 
router.patch('/wallet', auth, [
  body('walletAddress')
    .notEmpty()
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Invalid Ethereum wallet address')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { walletAddress: req.body.walletAddress },
      { new: true }
    ).select('-password');
    res.json({ msg: 'Wallet linked', user });
  } catch (err) {
    res.status(500).json({
      msg: 'Server error',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

module.exports = router;