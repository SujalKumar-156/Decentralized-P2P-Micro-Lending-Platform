/**
 * Calculates a Platform Credit Score (0–1000) for a borrower
 * based on their off-chain lending history stored in MongoDB.
 *
 * This is YOUR core contribution as Role 3.
 */
function calculateCreditScore(history = {}) {
  let score = 500; // everyone starts at 500

  const {
    totalLoans          = 0,
    loansRepaidOnTime   = 0,
    latePayments        = 0,
    defaults            = 0,
    totalLoansCompleted = 0,
    accountAgeMonths    = 0,
    walletTransactions  = 0
  } = history;

  // 1. Repayment rate — most important factor (up to +200 points)
  const repaymentRate = totalLoans > 0 ? loansRepaidOnTime / totalLoans : 0;
  score += Math.round(repaymentRate * 200);

  // 2. Default penalty — very harsh (-100 per default)
  score -= defaults * 100;

  // 3. Late payment penalty (-20 per late payment)
  score -= latePayments * 20;

  // 4. Completed loan bonus (shows experience, up to +80)
  score += Math.min(totalLoansCompleted * 10, 80);

  // 5. Account age bonus (up to +60)
  score += Math.min(accountAgeMonths * 2, 60);

  // 6. Wallet activity bonus — shows blockchain engagement (up to +60)
  score += Math.min(walletTransactions * 2, 60);

  // Clamp between 0 and 1000
  return Math.max(0, Math.min(1000, Math.round(score)));
}

/**
 * Returns a human-readable risk tier based on the score.
 * Useful for the frontend (Role 7's analytics dashboard).
 */
function getCreditTier(score) {
  if (score >= 750) return { tier: 'Excellent', risk: 'Very Low',  color: 'green'  };
  if (score >= 600) return { tier: 'Good',      risk: 'Low',       color: 'blue'   };
  if (score >= 450) return { tier: 'Fair',       risk: 'Medium',    color: 'amber'  };
  if (score >= 300) return { tier: 'Poor',       risk: 'High',      color: 'orange' };
  return                    { tier: 'Very Poor', risk: 'Very High', color: 'red'    };
}

module.exports = { calculateCreditScore, getCreditTier };