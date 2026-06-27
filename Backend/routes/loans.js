const express                    = require('express');
const { body, validationResult } = require('express-validator');
const mongoose                   = require('mongoose');
const auth                       = require('../middleware/auth');
const Loan                       = require('../models/Loan');
const User                       = require('../models/User');
const { calculateCreditScore }   = require('../utils/creditScore');
const router                     = express.Router();

// ─── POST /api/loans/request ──────────────────────────────────
// Borrower creates a new loan request
// Amount is in WEI (string), duration is in SECONDS — matches smart contract
router.post('/request', auth, [
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isNumeric().withMessage('Amount must be a number')
    .custom(v => Number(v) > 0).withMessage('Amount must be greater than 0'),
  body('duration')
    .isInt({ min: 86400, max: 31536000 })
    .withMessage('Duration must be between 86400 (1 day) and 31536000 (1 year) in seconds'),
  body('interestRate')
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage('Interest rate must be between 0 and 50'),
  body('purpose')
    .trim()
    .notEmpty()
    .withMessage('Purpose is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const { amount, duration, purpose, interestRate } = req.body;
    const rate = interestRate || 5;

    // ── Enforce same 3-loan limit as smart contract ──
    const activeLoans = await Loan.countDocuments({
      borrower: req.user.id,
      status: { $in: ['pending', 'active'] }
    });
    if (activeLoans >= 3)
      return res.status(400).json({ msg: 'Maximum of 3 active loans allowed per borrower' });

    // ── Snapshot credit score at time of request ──
    const user          = await User.findById(req.user.id);
    const scoreSnapshot = calculateCreditScore(user.lendingHistory);

    // ── Repayment amount matches smart contract formula exactly ──
    // Contract: amount + (amount / 100) * interestRate
    const repaymentAmount = (BigInt(amount) + (BigInt(amount) * BigInt(rate)) / BigInt(100)).toString();

    const loan = new Loan({
      borrower:          req.user.id,
      amount:            amount.toString(),   // store as string to preserve Wei precision
      duration,                               // in seconds
      purpose,
      interestRate:      rate,
      repaymentAmount,                        // total Wei borrower must repay in one tx
      creditScoreAtTime: scoreSnapshot
    });

    await loan.save();
    res.status(201).json({ msg: 'Loan request created', loan });
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// ─── GET /api/loans/marketplace ───────────────────────────────
// All pending loans — Role 6 Lender Marketplace calls this
router.get('/marketplace', auth, async (req, res) => {
  try {
    const loans = await Loan.find({ status: 'pending' })
      .populate('borrower', 'name walletAddress')
      .sort({ createdAt: -1 });
    res.json(loans);
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// ─── GET /api/loans/my-loans ──────────────────────────────────
// Borrower sees their own loans — Role 5 Borrower Dashboard
router.get('/my-loans', auth, async (req, res) => {
  try {
    const loans = await Loan.find({ borrower: req.user.id })
      .sort({ createdAt: -1 });
    res.json(loans);
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// ─── GET /api/loans/my-lendings ───────────────────────────────

router.get('/my-lendings', auth, async (req, res) => {
  try {
    const loans = await Loan.find({ lender: req.user.id })
      .populate('borrower', 'name walletAddress')
      .sort({ createdAt: -1 });
    res.json(loans);
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// ─── GET /api/loans/:id ───────────────────────────────────────
// Single loan full details
router.get('/:id', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ msg: 'Invalid loan ID' });

    const loan = await Loan.findById(req.params.id)
      .populate('borrower', 'name walletAddress')
      .populate('lender',   'name walletAddress');
    if (!loan) return res.status(404).json({ msg: 'Loan not found' });
    res.json(loan);
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// ─── PATCH /api/loans/:id/fund ────────────────────────────────
// Called by Role 4 event listener when LoanFunded event fires on-chain
// Links the MongoDB loan to the blockchain loan
router.patch('/:id/fund', auth, [
  body('contractAddress')
    .notEmpty().withMessage('Contract address is required')
    .matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid contract address format'),
  body('onChainLoanId')
    .isInt({ min: 0 }).withMessage('On-chain loan ID is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ msg: 'Invalid loan ID' });

    const loan = await Loan.findById(req.params.id);
    if (!loan)
      return res.status(404).json({ msg: 'Loan not found' });
    if (loan.status !== 'pending')
      return res.status(400).json({ msg: 'Loan is no longer available' });
    if (loan.borrower.toString() === req.user.id)
      return res.status(400).json({ msg: 'You cannot fund your own loan' });

    loan.lender          = req.user.id;
    loan.status          = 'active';
    loan.contractAddress = req.body.contractAddress;
    loan.onChainLoanId   = req.body.onChainLoanId;  // links to smart contract loans[] index
    await loan.save();

    res.json({ msg: 'Loan funded successfully', loan });
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// ─── PATCH /api/loans/:id/repay ───────────────────────────────
// Called by Role 4 event listener when LoanRepaid event fires on-chain
// Updates DB status and borrower's credit history
router.patch('/:id/repay', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ msg: 'Invalid loan ID' });

    const loan = await Loan.findById(req.params.id);
    if (!loan)
      return res.status(404).json({ msg: 'Loan not found' });
    if (loan.borrower.toString() !== req.user.id)
      return res.status(403).json({ msg: 'Unauthorized' });
    if (loan.status === 'repaid')
      return res.status(400).json({ msg: 'Loan already marked as repaid' });
    if (loan.status !== 'active')
      return res.status(400).json({ msg: 'Loan is not active' });

    // Mark loan repaid
    loan.status = 'repaid';
    await loan.save();

    // ── Update borrower credit history ──
    // This is what feeds back into the credit score algorithm
    await User.findByIdAndUpdate(req.user.id, {
      $inc: {
        'lendingHistory.loansRepaidOnTime': 1,
        'lendingHistory.totalLoansCompleted': 1
      }
    });

    res.json({ msg: 'Loan marked as repaid', loan });
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// ─── PATCH /api/loans/:id/default ─────────────────────────────
// Called by Role 4 event listener when LoanDefaulted event fires on-chain
// Updates DB status and penalises borrower credit score
router.patch('/:id/default', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ msg: 'Invalid loan ID' });

    const loan = await Loan.findById(req.params.id);
    if (!loan)
      return res.status(404).json({ msg: 'Loan not found' });
    if (loan.status === 'defaulted')
      return res.status(400).json({ msg: 'Loan already marked as defaulted' });
    if (loan.status !== 'active')
      return res.status(400).json({ msg: 'Loan is not active' });

    loan.status = 'defaulted';
    await loan.save();

    // ── Penalise borrower credit history ──
    await User.findByIdAndUpdate(loan.borrower, {
      $inc: {
        'lendingHistory.defaults': 1,
        'lendingHistory.latePayments': 1
      }
    });

    res.json({ msg: 'Loan marked as defaulted', loan });
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

module.exports = router;
