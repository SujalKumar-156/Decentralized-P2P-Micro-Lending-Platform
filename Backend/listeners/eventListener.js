const { ethers } = require("ethers");
const Loan = require("../models/Loan");
const { CONTRACT_ADDRESS, CONTRACT_ABI } = require("./abi");

const startEventListener = async () => {
    let provider;
    let contract;

    // Helper function to fetch historical logs when the server starts up
    const syncPastEvents = async (contract) => {
        try {
            // Queries past 'LoanCreated' events from the last 5,000 blocks to 'latest'
            const pastEvents = await contract.queryFilter("LoanCreated", -5000, "latest");

            for (const event of pastEvents) {
                const { loanId, borrower, amount, interestRate, duration } = event.args;
                const id = Number(loanId);

                await Loan.findOneAndUpdate(
                    { loanId: id },
                    {
                        loanId: id,
                        borrower: borrower.toLowerCase(),
                        amountEth: Number(ethers.formatEther(amount)),
                        interestRate: Number(interestRate),
                        durationSeconds: Number(duration),
                        status: "Created"
                    },
                    { upsert: true }
                );
            }
            console.log(`[CATCH-UP] Successfully synced ${pastEvents.length} past events.`);
        } catch (err) {
            console.error("Error during historical event backfill:", err);
        }
    };

    const connect = async () => {
        try {
            // Use WebSocketProvider for real-time event subscriptions
            provider = new ethers.WebSocketProvider(process.env.SEPOLIA_WS_URL);
            contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

            console.log("Connected to Sepolia WebSocket. Synchronizing past events...");

            // 1. CATCH-UP: Sync any events that happened while server was offline
            await syncPastEvents(contract);

            console.log("Listening for real-time smart contract events on Sepolia...");

            // 2. LIVE EVENT LISTENERS (Your exact logic)
            contract.on("LoanCreated", async (loanId, borrower, amount, interestRate, duration) => {
                try {
                    const id = Number(loanId);
                    const amountEth = Number(ethers.formatEther(amount));

                    await Loan.findOneAndUpdate(
                        { loanId: id },
                        {
                            loanId: id,
                            borrower: borrower.toLowerCase(),
                            amountEth,
                            interestRate: Number(interestRate),
                            durationSeconds: Number(duration),
                            status: "Created"
                        },
                        { upsert: true, new: true }
                    );
                    console.log(`[SYNC] LoanCreated -> Loan #${id}`);
                } catch (err) {
                    console.error("Sync error on LoanCreated:", err);
                }
            });

            contract.on("LoanFunded", async (loanId, lender) => {
                try {
                    const id = Number(loanId);
                    await Loan.findOneAndUpdate(
                        { loanId: id },
                        { lender: lender.toLowerCase(), status: "Funded" }
                    );
                    console.log(`[SYNC] LoanFunded -> Loan #${id}`);
                } catch (err) {
                    console.error("Sync error on LoanFunded:", err);
                }
            });

            contract.on("LoanRepaid", async (loanId) => {
                try {
                    const id = Number(loanId);
                    await Loan.findOneAndUpdate(
                        { loanId: id },
                        { status: "Repaid" }
                    );
                    console.log(`[SYNC] LoanRepaid -> Loan #${id}`);
                } catch (err) {
                    console.error("Sync error on LoanRepaid:", err);
                }
            });

            contract.on("LoanDefaulted", async (loanId) => {
                try {
                    const id = Number(loanId);
                    await Loan.findOneAndUpdate(
                        { loanId: id },
                        { status: "Defaulted" }
                    );
                    console.log(`[SYNC] LoanDefaulted -> Loan #${id}`);
                } catch (err) {
                    console.error("Sync error on LoanDefaulted:", err);
                }
            });

            // 3. RECONNECTION LOGIC: Auto-retry if WebSocket drops
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