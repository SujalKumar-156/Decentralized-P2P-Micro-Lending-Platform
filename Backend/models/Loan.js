const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema(
  {
    // ── Blockchain identity 
    onChainLoanId:   { type: Number, default: null }, // contract loans[] index
    contractAddress: { type: String, default: null }, // deployed contract address

    //Loan data 
    borrower:       { type: String, default: null, lowercase: true },// wallet address
    lender:         { type: String, default: null, lowercase: true }, // wallet address
    amount:         { type: String, required: true },// Wei string (precision safe)
    amountEth:      { type: Number, default: null },     // ETH float (display)
    interestRate:   { type: Number, required: true, min: 0, max: 50 },
    duration:       { type: Number, required: true },      // in SECONDS
    repaymentAmount:{ type: String, default: null }, // Wei: amount + interest

    // ── Off-chain enrichment 
    purpose:         { type: String, default: null, trim: true },
    mongoUserId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // ── Status
    status: {
      type: String,
      enum: ['pending', 'active', 'repaid', 'defaulted', 'cancelled'],
      default: 'pending'
    },

    // ── Credit snapshot 
    creditScoreAtTime: { type: Number, default: null }
  },
  { timestamps: true } // adds createdAt + updatedAt automatically
);

// ─── Indexes 
loanSchema.index({ status: 1 });     // marketplace filter
loanSchema.index({ mongoUserId: 1 }) // my-loans filter
loanSchema.index({ lender: 1 });    // my-lendings filter
loanSchema.index({ onChainLoanId: 1 }, { unique: true, sparse: true }); // event listener lookups

module.exports = mongoose.model('Loan', loanSchema);