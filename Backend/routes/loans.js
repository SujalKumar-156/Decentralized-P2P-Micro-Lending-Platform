const express                    = require('express');
const { body, validationResult } = require('express-validator');
const auth                       = require('../middleware/auth');
const Loan                       = require('../models/Loan');
const User                       = require('../models/User');
const { calculateCreditScore }   = require('../utils/creditScore');
const router                     = express.Router();

// ─── POST /api/loans/request ──────────────────────────────────
// Borrower creates a new loan request
router.post('/request', auth, [
  body('amount').isNumeric().withMessage('Amount must be a number').custom(v => v > 0),
  body('duration').isInt({ min: 1, max: 60 }).withMessage('Duration must be 1–60 months'),
  body('purpose').trim().notEmpty().withMessage('Purpose is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const { amount, duration, purpose, interestRate } = req.body;

    // Get borrower's current credit score and attach it as a snapshot
    const user = await User.findById(req.user.id);
     
    const scoreSnapshot = calculateCreditScore(user.lendingHistory);

    // Generate a simple repayment schedule
    const monthlyPayment = parseFloat(
      ((amount * (1 + (interestRate || 5) / 100)) / duration).toFixed(2)
    );
    const schedule = [];
    for (let i = 1; i <= duration; i++) {
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + i);
      schedule.push({ dueDate, amount: monthlyPayment });
    }

    const loan = new Loan({
      borrower: req.user.id,
      amount,
      duration,
      purpose,
      interestRate: interestRate || 5,
      repaymentSchedule: schedule,
      creditScoreAtTime: scoreSnapshot
    });

    await loan.save();
    res.status(201).json({ msg: 'Loan request created', loan });
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// ─── GET /api/loans/marketplace ───────────────────────────────
// Public list of pending loans — Role 6 (Lender Marketplace) calls this
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
// Logged-in borrower sees their own loans — Role 5 (Borrower Dashboard) calls this
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
// Logged-in lender sees loans they have funded
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
// Get a single loan's full details
router.get('/:id', auth, async (req, res) => {
  try {
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
// Lender funds a loan — called after MetaMask tx is confirmed (Role 6)
router.patch('/:id/fund', auth, [
  body('contractAddress').notEmpty().withMessage('Contract address is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan)          return res.status(404).json({ msg: 'Loan not found' });
    if (loan.status !== 'pending')
      return res.status(400).json({ msg: 'Loan is no longer available' });
    if (loan.borrower.toString() === req.user.id)
      return res.status(400).json({ msg: 'You cannot fund your own loan' });

    loan.lender          = req.user.id;
    loan.status          = 'active';
    loan.contractAddress = req.body.contractAddress;
    await loan.save();

    res.json({ msg: 'Loan funded successfully', loan });
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// ─── PATCH /api/loans/:id/repay ───────────────────────────────
// Mark an installment as paid — called after blockchain confirmation (Role 4 event listener also does this)
router.patch('/:id/repay', auth, [
  body('installmentIndex').isInt({ min: 0 }).withMessage('Valid installment index required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ msg: 'Loan not found' });
    if (loan.borrower.toString() !== req.user.id)
      return res.status(403).json({ msg: 'Unauthorized' });

    const { installmentIndex } = req.body;
    const installment = loan.repaymentSchedule[installmentIndex];
    if (!installment)
      return res.status(400).json({ msg: 'Installment not found' });
    if (installment.paid)
      return res.status(400).json({ msg: 'Already paid' });

    // Mark installment paid
    installment.paid   = true;
    installment.paidAt = new Date();

    // Check if loan is late
    if (new Date() > installment.dueDate) {
      installment.latePenalty = parseFloat((installment.amount * 0.05).toFixed(2));
    }

    // Check if all installments are paid — close the loan
    const allPaid = loan.repaymentSchedule.every(s => s.paid);
    if (allPaid) loan.status = 'repaid';

    await loan.save();
    res.json({ msg: 'Installment recorded', loan });
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

module.exports = router;