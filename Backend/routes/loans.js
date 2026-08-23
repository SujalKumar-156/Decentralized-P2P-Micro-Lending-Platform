const express                    = require('express');
const { body, validationResult } = require('express-validator');
const mongoose                   = require('mongoose');
const { ethers }                 = require('ethers');
const auth                       = require('../middleware/auth');
const checkRole                  = require('../middleware/checkRole');
const Loan                       = require('../models/Loan');
const User                       = require('../models/User');
const { calculateCreditScore }   = require('../utils/creditScore');
const { CONTRACT_ADDRESS, CONTRACT_ABI } = require('../listeners/abi');
const router                     = express.Router();

const readProvider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
const readContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, readProvider);

// POST /api/loans/request 
// Only borrowers can create loan requests
router.post('/request', auth, checkRole('borrower', 'both'), [
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .matches(/^[1-9]\d*$/).withMessage('Amount must be a positive integer string (Wei)'),
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

    // Enforce same 3-loan limit as smart contract
    const activeLoans = await Loan.countDocuments({
      mongoUserId: req.user.id,
      status: { $in: ['pending', 'active'] }
    });
    if (activeLoans >= 3)
      return res.status(400).json({ msg: 'Maximum of 3 active loans allowed per borrower' });

    // Snapshot credit score at time of request
    const user          = await User.findById(req.user.id);
    const scoreSnapshot = calculateCreditScore(user.lendingHistory);

    // Repayment amount — matches smart contract formula exactly
    // Contract: amount + (amount / 100) * interestRate
    const repaymentAmount = (
      BigInt(amount) + (BigInt(amount) * BigInt(rate)) / BigInt(100)
    ).toString();

    const loan = new Loan({
      mongoUserId:       req.user.id,
      borrower:          user.walletAddress || null,
      amount:            amount.toString(),
      duration,
      purpose,
      interestRate:      rate,
      repaymentAmount,
      creditScoreAtTime: scoreSnapshot
    });

    await loan.save();
    res.status(201).json({ msg: 'Loan request created', loan });
  } catch (err) {
    res.status(500).json({
      msg: 'Server error',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

// ─── GET /api/loans/marketplace 
// Paginated list of pending loans
router.get('/marketplace', auth, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(20, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;

    const [loans, total] = await Promise.all([
      Loan.find({ status: 'pending' })
        .populate('mongoUserId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Loan.countDocuments({ status: 'pending' })
    ]);

    res.json({
      loans,
      pagination: { total, page, pages: Math.ceil(total / limit), limit }
    });
  } catch (err) {
    res.status(500).json({
      msg: 'Server error',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

// ─── GET /api/loans/my-loans ──────────────────────────────────
// Borrower's own loans
router.get('/my-loans', auth, async (req, res) => {
  try {
    const loans = await Loan.find({ mongoUserId: req.user.id })
      .sort({ createdAt: -1 });
    res.json({ loans });
  } catch (err) {
    res.status(500).json({
      msg: 'Server error',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

// ─── GET /api/loans/my-lendings ───────────────────────────────
// Loans the lender has funded
router.get('/my-lendings', auth, async (req, res) => {
  try {
    const user  = await User.findById(req.user.id);
    const loans = await Loan.find({ lender: user.walletAddress?.toLowerCase() })
      .sort({ createdAt: -1 });
    res.json({ loans });
  } catch (err) {
    res.status(500).json({
      msg: 'Server error',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

// ─── GET /api/loans/:id ───────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ msg: 'Invalid loan ID' });

    const loan = await Loan.findById(req.params.id)
      .populate('mongoUserId', 'name walletAddress');
    if (!loan) return res.status(404).json({ msg: 'Loan not found' });
    res.json({ loan });
  } catch (err) {
    res.status(500).json({
      msg: 'Server error',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});

// ─── PATCH /api/loans/:id/fund ────────────────────────────────

router.patch('/:id/fund', auth, checkRole('lender', 'both'), [
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
    if (loan.mongoUserId.toString() === req.user.id)
      return res.status(400).json({ msg: 'You cannot fund your own loan' });

    const funder = await User.findById(req.user.id);
    if (!funder.walletAddress)
      return res.status(400).json({ msg: 'Link a wallet before funding a loan' });

    // ── Verify the funding actually happened on-chain ──
    let onChainLoan;
    try {
      onChainLoan = await readContract.getLoan(req.body.onChainLoanId);
    } catch (chainErr) {
      console.error('On-chain verification error:', chainErr);
      return res.status(502).json({ msg: 'Could not verify funding on-chain, try again shortly' });
    }

    if (!onChainLoan.isFunded)
      return res.status(400).json({ msg: 'Loan is not marked as funded on-chain yet' });
    if (onChainLoan.lender.toLowerCase() !== funder.walletAddress.toLowerCase())
      return res.status(400).json({ msg: 'On-chain lender does not match your linked wallet' });

    loan.lender          = funder.walletAddress.toLowerCase();
    loan.status          = 'active';
    loan.contractAddress = req.body.contractAddress;
    loan.onChainLoanId   = req.body.onChainLoanId;
    await loan.save();

    res.json({ msg: 'Loan funded successfully', loan });
  } catch (err) {
    res.status(500).json({
      msg: 'Server error',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
});
module.exports = router;