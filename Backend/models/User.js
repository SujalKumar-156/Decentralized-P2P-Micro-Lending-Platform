const mongoose = require('mongoose');

const lendingHistorySchema = new mongoose.Schema({
  totalLoans:          { type: Number, default: 0 },
  loansRepaidOnTime:   { type: Number, default: 0 },
  latePayments:        { type: Number, default: 0 },
  defaults:            { type: Number, default: 0 },
  totalLoansCompleted: { type: Number, default: 0 },
  accountAgeMonths:    { type: Number, default: 0 },
  walletTransactions:  { type: Number, default: 0 }
});

const userSchema = new mongoose.Schema({
  name:          { type: String, required: true,trim: true },
  email:         { type: String, required: true,unique: true, lowercase: true },
  password:      { type: String, required: true },
  walletAddress: { type: String, default: null },
  role:          { type: String, enum: ['borrower','lender','both'],default: 'borrower' },
  lendingHistory:{ type: lendingHistorySchema, default: () => ({}) },
  createdAt:     { type: Date,   default: Date.now }
});

// Indexes
userSchema.index({ walletAddress: 1 }, { sparse: true }); // event listener credit lookups

module.exports = mongoose.model('User', userSchema);