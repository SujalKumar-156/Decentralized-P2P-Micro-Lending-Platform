const express  = require('express');
const mongoose = require('mongoose');
const auth     = require('../middleware/auth');
const User     = require('../models/User');
const { calculateCreditScore, getCreditTier } = require('../utils/creditScore');
const router   = express.Router();

// ─── GET /api/credit/score
router.get('/score', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const score = calculateCreditScore(user.lendingHistory);
    const tier  = getCreditTier(score);

    res.json({ score, ...tier });
  } catch (err) {
    res.status(500).json({
      msg: 'Server error',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

// ─── GET /api/credit/score/:userId ────────────────────────────
// Lender checks a borrower's score before funding — only name + score exposed
router.get('/score/:userId', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId))
      return res.status(400).json({ msg: 'Invalid user ID' });

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const score = calculateCreditScore(user.lendingHistory);
    const tier  = getCreditTier(score);

    // Never expose email, password, or wallet — only name and score
    res.json({ name: user.name, score, ...tier });
  } catch (err) {
    res.status(500).json({
      msg: 'Server error',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

module.exports = router;