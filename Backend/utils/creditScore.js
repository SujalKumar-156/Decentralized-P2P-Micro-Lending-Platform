

function calculateCreditScore(history = {}) {
  let score = 500; // everyone starts at 500

  const {
    totalLoans = 0,
    loansRepaidOnTime = 0,
    latePayments = 0,
    defaults = 0,
    totalLoansCompleted = 0,
    accountAgeMonths = 0,
    walletTransactions = 0
  } = history;

  // 1. Repayment rate 
  const repaymentRate = totalLoans > 0 ? loansRepaidOnTime / totalLoans : 0;
  score += Math.round(repaymentRate * 200);

  // 2. Default penalty(-100 per default)
  score -= defaults * 100;

  // 3. Late payment penalty (-20 per late payment)
  score -= latePayments * 20;

  // 4. Completed loan bonus ( up to +80)
  score += Math.min(totalLoansCompleted * 10, 80);

  // 5. Account age bonus (up to +60)
  score += Math.min(accountAgeMonths * 2, 60);

  // 6. Wallet activity bonus  (up to +60)
  score += Math.min(walletTransactions * 2, 60);

  // Clamp between 0 and 1000
  return Math.max(0, Math.min(1000, Math.round(score)));
}


function getCreditTier(score) {
  if (score >= 750) return { tier: 'Excellent', risk: 'Very Low', color: 'green' };
  if (score >= 600) return { tier: 'Good', risk: 'Low', color: 'blue' };
  if (score >= 450) return { tier: 'Fair', risk: 'Medium', color: 'amber' };
  if (score >= 300) return { tier: 'Poor', risk: 'High', color: 'orange' };
  return { tier: 'Very Poor', risk: 'Very High', color: 'red' };
}

module.exports = { calculateCreditScore, getCreditTier };