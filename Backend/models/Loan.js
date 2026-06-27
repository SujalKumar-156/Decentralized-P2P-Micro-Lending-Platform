const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
  borrower:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  lender:            { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  amount:            { type: String,  required: true },           // in Wei 
  
  duration:          { type: Number,  required: true },           // in SECONDS  

  purpose:           { type: String,  required: true, trim: true },

  interestRate:      { type: Number,  default: 5, min: 0, max: 50 }, // 0–50% (matches contract cap)

  repaymentAmount:   { type: String,  default: null },            // total Wei to repay = amount + interest

  onChainLoanId:     { type: Number,  default: null },            // index in contract's loans[] array

  contractAddress:   { type: String,  default: null },            // smart contract address (Role 1)

  status: {
    type: String,
    enum: ['pending', 'active', 'repaid', 'defaulted'],
    default: 'pending'
  },

  creditScoreAtTime: { type: Number,  default: null },            // borrower score snapshot at request time
  
  createdAt:         { type: Date,    default: Date.now }
});

module.exports = mongoose.model('Loan', loanSchema);
