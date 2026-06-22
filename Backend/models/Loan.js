const mongoose = require('mongoose');

const repaymentSchema = new mongoose.Schema({
  dueDate:     { type: Date,   required: true },
  amount:      { type: Number, required: true },
  paid:        { type: Boolean, default: false },
  paidAt:      { type: Date,   default: null },
  latePenalty: { type: Number, default: 0 }
});

const loanSchema = new mongoose.Schema({
  borrower:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lender:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  amount:          { type: Number, required: true, min: 1 },
  duration:        { type: Number, required: true },         // in months
  purpose:         { type: String, required: true, trim: true },
  interestRate:    { type: Number, default: 5 },             // percentage
  status: {
    type: String,
    enum: ['pending', 'funded', 'active', 'repaid', 'defaulted'],
    default: 'pending'
  },
  contractAddress: { type: String, default: null },          // filled by Role 1 after deployment
  repaymentSchedule: [repaymentSchema],
  creditScoreAtTime: { type: Number, default: null },        // snapshot of score when loan was created
  createdAt:       { type: Date, default: Date.now }
});

module.exports = mongoose.model('Loan', loanSchema);