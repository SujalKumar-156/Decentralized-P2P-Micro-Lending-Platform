const { ethers } = require("ethers");
const Loan = require("../models/Loan");
const User = require("../models/User");
const { CONTRACT_ADDRESS, CONTRACT_ABI } = require("./abi");

const startEventListener = async () => {
  let provider;
  let contract;

  // ── Reconcile a LoanCreated event with Mongo ──
   const applyLoanCreated = async (loanId, borrower, amount, interestRate, duration) => {
    const id = Number(loanId);
    const borrowerLower = borrower.toLowerCase();
    const amountStr = amount.toString();
    const durationNum = Number(duration);
    const rateNum = Number(interestRate);
    const amountEth = Number(ethers.formatEther(amount));

    const existing = await Loan.findOne({
      onChainLoanId: null,
      borrower: borrowerLower,
      amount: amountStr,
      duration: durationNum,
      status: 'pending'
    }).sort({ createdAt: -1 });

    if (existing) {
      existing.onChainLoanId = id;
      existing.interestRate  = rateNum;
      existing.amountEth     = amountEth;
      await existing.save();
      return { id, linked: true };
    }

    // No matching off-chain request found — loan was created directly
    // on-chain (or the request record is missing). Create a bare record.
    await Loan.findOneAndUpdate(
      { onChainLoanId: id },
      {
        onChainLoanId: id,
        borrower:      borrowerLower,
        amount:        amountStr,
        amountEth,
        interestRate:  rateNum,
        duration:      durationNum,
        status:        'pending'
      },
      { upsert: true, new: true }
    );
    return { id, linked: false };
  };

  // ── Catch-up: sync events missed while server was offline ──
  const syncPastEvents = async (contract) => {
    try {
      const [created, funded, repaid, defaulted, cancelled] = await Promise.all([
        contract.queryFilter("LoanCreated", -5000, "latest"),
        contract.queryFilter("LoanFunded", -5000, "latest"),
        contract.queryFilter("LoanRepaid", -5000, "latest"),
        contract.queryFilter("LoanDefaulted", -5000, "latest"),
        contract.queryFilter("LoanCancelled", -5000, "latest")
      ]);

      for (const event of created) {
        const { loanId, borrower, amount, interestRate, duration } = event.args;
        await applyLoanCreated(loanId, borrower, amount, interestRate, duration);
      }
      console.log(`[CATCH-UP] Synced ${created.length} past LoanCreated events.`);

      for (const event of funded) {
        const { loanId, lender } = event.args;
        const id = Number(loanId);
        const updated = await Loan.findOneAndUpdate(
          { onChainLoanId: id },
          { lender: lender.toLowerCase(), status: 'active' }
        );
        if (!updated) console.warn(`[CATCH-UP WARNING] LoanFunded #${id} matched no Mongo record`);
      }
      console.log(`[CATCH-UP] Synced ${funded.length} past LoanFunded events.`);

      for (const event of repaid) {
        const { loanId, borrower } = event.args;
        const id = Number(loanId);
        const updated = await Loan.findOneAndUpdate({ onChainLoanId: id }, { status: 'repaid' });
        if (!updated) {
          console.warn(`[CATCH-UP WARNING] LoanRepaid #${id} matched no Mongo record`);
          continue;
        }
        await User.findOneAndUpdate(
          { walletAddress: borrower.toLowerCase() },
          {
            $inc: {
              'lendingHistory.loansRepaidOnTime':   1,
              'lendingHistory.totalLoansCompleted': 1,
              'lendingHistory.totalLoans':          1,
              'lendingHistory.walletTransactions':  1
            }
          }
        );
      }
      console.log(`[CATCH-UP] Synced ${repaid.length} past LoanRepaid events.`);

      for (const event of defaulted) {
        const { loanId, borrower } = event.args;
        const id = Number(loanId);
        const updated = await Loan.findOneAndUpdate({ onChainLoanId: id }, { status: 'defaulted' });
        if (!updated) {
          console.warn(`[CATCH-UP WARNING] LoanDefaulted #${id} matched no Mongo record`);
          continue;
        }
        await User.findOneAndUpdate(
          { walletAddress: borrower.toLowerCase() },
          {
            $inc: {
              'lendingHistory.defaults':     1,
              'lendingHistory.latePayments': 1,
              'lendingHistory.totalLoans':   1
            }
          }
        );
      }
      console.log(`[CATCH-UP] Synced ${defaulted.length} past LoanDefaulted events.`);

      for (const event of cancelled) {
        const { loanId } = event.args;
        const id = Number(loanId);
        const updated = await Loan.findOneAndUpdate({ onChainLoanId: id }, { status: 'cancelled' });
        if (!updated) console.warn(`[CATCH-UP WARNING] LoanCancelled #${id} matched no Mongo record`);
      }
      console.log(`[CATCH-UP] Synced ${cancelled.length} past LoanCancelled events.`);
    } catch (err) {
      console.error("Error during historical event backfill:", err);
    }
  };

  const connect = async () => {
    try {
      provider = new ethers.WebSocketProvider(process.env.SEPOLIA_WS_URL);
      contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

      console.log("✅ Connected to Sepolia WebSocket. Syncing past events...");
      await syncPastEvents(contract);
      console.log("👂 Listening for real-time smart contract events...");

      // ── LoanCreated ────────────────────────────────────────
      contract.on("LoanCreated", async (loanId, borrower, amount, interestRate, duration) => {
        try {
          const { id, linked } = await applyLoanCreated(loanId, borrower, amount, interestRate, duration);
          console.log(`[EVENT] LoanCreated → Loan #${id} (${linked ? 'linked to request' : 'new record'})`);
        } catch (err) {
          console.error("Sync error on LoanCreated:", err);
        }
      });

      // ── LoanFunded ─────────────────────────────────────────
      contract.on("LoanFunded", async (loanId, lender) => {
        try {
          const id = Number(loanId);
          const updated = await Loan.findOneAndUpdate(
            { onChainLoanId: id },
            { lender: lender.toLowerCase(), status: 'active' }
          );
          if (!updated) {
            console.warn(`[SYNC WARNING] LoanFunded fired for on-chain loan #${id} but no matching Mongo record was found`);
            return;
          }
          console.log(`[EVENT] LoanFunded → Loan #${id}`);
        } catch (err) {
          console.error("Sync error on LoanFunded:", err);
        }
      });

      // ── LoanRepaid ─────────────────────────────────────────
      // Updates loan status AND improves borrower credit score
      contract.on("LoanRepaid", async (loanId, borrower) => {
        try {
          const id = Number(loanId);

          const updated = await Loan.findOneAndUpdate(
            { onChainLoanId: id },
            { status: 'repaid' }
          );
          if (!updated) {
            console.warn(`[SYNC WARNING] LoanRepaid fired for on-chain loan #${id} but no matching Mongo record was found`);
            return;
          }

          // Credit history reward — drives credit score improvement
          await User.findOneAndUpdate(
            { walletAddress: borrower.toLowerCase() },
            {
              $inc: {
                'lendingHistory.loansRepaidOnTime':   1,
                'lendingHistory.totalLoansCompleted': 1,
                'lendingHistory.totalLoans':          1,
                'lendingHistory.walletTransactions':  1
              }
            }
          );

          console.log(`[EVENT] LoanRepaid → Loan #${id} | Credit updated for ${borrower}`);
        } catch (err) {
          console.error("Sync error on LoanRepaid:", err);
        }
      });

      // ── LoanDefaulted ──────────────────────────────────────
      // Updates loan status AND penalises borrower credit score
      contract.on("LoanDefaulted", async (loanId, borrower) => {
        try {
          const id = Number(loanId);

          const updated = await Loan.findOneAndUpdate(
            { onChainLoanId: id },
            { status: 'defaulted' }
          );
          if (!updated) {
            console.warn(`[SYNC WARNING] LoanDefaulted fired for on-chain loan #${id} but no matching Mongo record was found`);
            return;
          }

          // Credit history penalty — drives credit score down
          await User.findOneAndUpdate(
            { walletAddress: borrower.toLowerCase() },
            {
              $inc: {
                'lendingHistory.defaults':     1,
                'lendingHistory.latePayments': 1,
                'lendingHistory.totalLoans':   1
              }
            }
          );

          console.log(`[EVENT] LoanDefaulted → Loan #${id} | Credit penalised for ${borrower}`);
        } catch (err) {
          console.error("Sync error on LoanDefaulted:", err);
        }
      });

      // ── LoanCancelled ──────────────────────────────────────
      // Borrower cancelled an unfunded loan request on-chain.
      contract.on("LoanCancelled", async (loanId, borrower) => {
        try {
          const id = Number(loanId);
          const updated = await Loan.findOneAndUpdate(
            { onChainLoanId: id },
            { status: 'cancelled' }
          );
          if (!updated) {
            console.warn(`[SYNC WARNING] LoanCancelled fired for on-chain loan #${id} but no matching Mongo record was found`);
            return;
          }
          console.log(`[EVENT] LoanCancelled → Loan #${id}`);
        } catch (err) {
          console.error("Sync error on LoanCancelled:", err);
        }
      });

      // ── Reconnection logic ─────────────────────────────────
      provider.websocket.on("close", (code) => {
        console.warn(`[WS DROPPED] Code ${code}. Reconnecting in 5s...`);
        setTimeout(connect, 5000);
      });

      provider.websocket.on("error", (err) => {
        console.error("[WS ERROR]:", err);
      });

    } catch (error) {
      console.error("Failed to connect to WebSocket provider:", error);
      setTimeout(connect, 5000);
    }
  };

  await connect();
};

module.exports = { startEventListener };