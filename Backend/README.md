# Money-Lending-Blockchain-Project
Money Lending Blockchain Project

## ⚡ Web3 Integration & Event Listener

The backend includes an automated Web3 event listener built with **Ethers.js (v6)** that connects to the Ethereum Sepolia testnet via WebSockets.

### Architecture & Data Flow
- **Automated Sync**: The MongoDB `Loan` database is **read-only** for frontend client API requests. 
- **On-Chain Event Sourcing**: All database updates are driven exclusively by smart contract events (`LoanCreated`, `LoanFunded`, `LoanRepaid`, `LoanDefaulted`).
- **Historical Backfill**: On startup, `syncPastEvents()` queries historical contract logs to ensure off-line events are synchronized.
- **Resilience**: Built-in auto-reconnection handles WebSocket provider drops automatically.

### API Guidelines for `routes/loans.js`
- **GET Endpoints Only**: Routes must only read from the database (e.g., `GET /api/loans`, `GET /api/loans/:id`).
- **No Direct Writes**: Do **NOT** expose `POST`, `PUT`, `PATCH`, or `DELETE` endpoints for loans, as manual database updates will corrupt the on-chain synchronization state.

### Database Schema Rules
- **Loan Schema**: Reserved exclusively for smart contract event data (`loanId`, `borrower`, `lender`, `amountEth`, `interestRate`, `durationSeconds`, `status`).
- **User / Credit Schema**: Credit score calculation and user data must be stored in the `User` schema or managed by `/api/credit`, separate from on-chain loan state.

### Environment Setup
Ensure your local `.env` contains:
```env
SEPOLIA_WS_URL=wss://sepolia.infura.io/ws/v3/YOUR_INFURA_API_KEY
