const CONTRACT_ADDRESS = "0xac2E4CEbD77909d41c3851F39E07B5D1dA73D6f2";

const CONTRACT_ABI = [
    "event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 interestRate, uint256 duration)",
    "event LoanFunded(uint256 indexed loanId, address indexed lender, uint256 amount)",
    "event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 repaymentAmount)",
    "event LoanDefaulted(uint256 indexed loanId, address indexed borrower, address indexed lender)"
];

module.exports = {
    CONTRACT_ADDRESS,
    CONTRACT_ABI
};