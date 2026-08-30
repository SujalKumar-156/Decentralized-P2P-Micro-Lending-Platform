// src/config.js
// ─────────────────────────────────────────────────────────────────────────────
// Central config — all components import from here.
// Never hardcode these values anywhere else.
// ─────────────────────────────────────────────────────────────────────────────

// Your teammate's deployed contract on Sepolia
export const CONTRACT_ADDRESS = "0x60ee95B576935a18B4964832d192515CBB78b076";

// Backend API base — Vite proxy forwards this to http://localhost:5000
export const API_BASE = "/api";

// ── ABI — matches your teammate's actual MicroLending.sol exactly ─────────────
export const ABI = [
  // ── Write functions (cost gas, need MetaMask) ──
  "function createLoan(uint256 _amount, uint256 _interestRate, uint256 _duration) external",
  "function fundLoan(uint256 _loanId) external payable",
  "function repayLoan(uint256 _loanId) external payable",
  "function markDefault(uint256 _loanId) external",

  // ── Read functions (free, no MetaMask needed) ──
  "function getAllLoans() external view returns (tuple(uint256 loanId, address borrower, address lender, uint256 amount, uint256 interestRate, uint256 duration, uint256 timestamp, bool isFunded, bool isRepaid, bool isDefaulted)[])",
  "function getLoan(uint256 _loanId) external view returns (tuple(uint256 loanId, address borrower, address lender, uint256 amount, uint256 interestRate, uint256 duration, uint256 timestamp, bool isFunded, bool isRepaid, bool isDefaulted))",
  "function getRepaymentAmount(uint256 _loanId) external view returns (uint256)",
  "function isLoanExpired(uint256 _loanId) external view returns (bool)",
  "function activeLoanCount(address) external view returns (uint256)",
  "function owner() external view returns (address)",

  // ── Events (backend listener uses these) ──
  "event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 interestRate, uint256 duration)",
  "event LoanFunded(uint256 indexed loanId, address indexed lender, uint256 amount)",
  "event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 repaymentAmount)",
  "event LoanDefaulted(uint256 indexed loanId, address indexed borrower, address indexed lender)",
];
