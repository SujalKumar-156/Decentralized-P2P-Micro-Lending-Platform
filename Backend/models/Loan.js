const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema(
  {
    loanId: { type: Number, required: true, unique: true },
    borrower: { type: String, required: true, lowercase: true },
    lender: { type: String, default: null, lowercase: true },
    amountEth: { type: Number, required: true },
    interestRate: { type: Number, required: true },
    durationSeconds: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Created", "Funded", "Repaid", "Defaulted"],
      default: "Created"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Loan', loanSchema);
