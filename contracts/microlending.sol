// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract MicroLending is ReentrancyGuard {

    struct Loan {
        uint256 loanId;
        address borrower;
        address lender;
        uint256 amount;
        uint256 interestRate;  
        uint256 duration;      // in seconds
        uint256 timestamp;   
        bool isFunded;
        bool isRepaid;
        bool isDefaulted;
        bool isCancelled;
    }

uint256 public constant MAX_LOANS_PER_BORROWER = 3;

constructor() {
    owner = msg.sender;
}

uint256 public constant MIN_DURATION = 1 days;    // minimum 1 day
uint256 public constant MAX_DURATION = 365 days;  // maximum 1 year

// Track active loans per borrower
mapping(address => uint256) public activeLoanCount;

    Loan[] public loans;

    // ─────────────────────────────────────────
    // EVENTS (For the backend team)
    // ─────────────────────────────────────────

    event LoanCreated(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 amount,
        uint256 interestRate,
        uint256 duration,
        uint256 timestamp
    );

    event LoanFunded(
        uint256 indexed loanId,
        address indexed lender,
        uint256 amount
    );

    event LoanRepaid(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 repaymentAmount
    );

    event LoanDefaulted(
        uint256 indexed loanId,
        address indexed borrower,
        address indexed lender
    );

    event LoanCancelled(
        uint256 indexed loanId,
        address indexed borrower
    );



    function createLoan(
        uint256 _amount,
        uint256 _interestRate,
        uint256 _duration
    ) external {
        require(_amount > 0,"Amount must be greater than 0");
        require(
        _duration >= MIN_DURATION,
        "Duration must be at least 1 day"
        );
         require(
        _duration <= MAX_DURATION,
        "Duration cannot exceed 365 days"
         );
        require(_interestRate <= 50, "Interest rate cannot exceed 50%");
        require(
        activeLoanCount[msg.sender] < MAX_LOANS_PER_BORROWER,
        "Maximum active loan limit reached"
    );
        uint256 loanId = loans.length;
        loans.push(Loan({
            loanId:       loanId,
            borrower:     msg.sender,
            lender:       address(0),
            amount:       _amount,
            interestRate: _interestRate,
            duration:     _duration,
            timestamp:    block.timestamp,
            isFunded:     false,
            isRepaid:     false,
            isDefaulted:  false
        }));

        activeLoanCount[msg.sender]++;
        emit LoanCreated(
            loanId,
            msg.sender,
            _amount,
            _interestRate,
            _duration,
            block.timestamp
        );
    }


    function fundLoan(uint256 _loanId)
        external
        payable
        nonReentrant
    {
        require(_loanId < loans.length,              "Loan does not exist");
        require(!loans[_loanId].isFunded,            "Loan already funded");
        require(!loans[_loanId].isRepaid,            "Loan already repaid");
        require(!loans[_loanId].isDefaulted,         "Loan is defaulted");
        require(msg.value == loans[_loanId].amount,  "Incorrect funding amount");
        require(
            msg.sender != loans[_loanId].borrower,
            "Borrower cannot fund own loan"
        );
        require(!loans[_loanId].isCancelled, "Loan is cancelled");

        // Update state BEFORE transfer (CEI pattern)
        loans[_loanId].lender   = msg.sender;
        loans[_loanId].isFunded = true;

        // Send ETH to borrower
        (bool success, ) = payable(loans[_loanId].borrower)
                           .call{value: msg.value}("");
        require(success, "Transfer to borrower failed");

        emit LoanFunded(_loanId, msg.sender, msg.value);
    }

    function repayLoan(uint256 _loanId)
        external
        payable
        nonReentrant
    {
        require(_loanId < loans.length, "Loan does not exist");

        Loan storage loan = loans[_loanId];

        require(loan.isFunded,               "Loan not funded yet");
        require(!loan.isRepaid,              "Loan already repaid");
        require(!loan.isDefaulted,           "Loan is defaulted");
        require(loan.borrower == msg.sender, "Only borrower can repay");
        require(
            block.timestamp <= loan.timestamp + loan.duration,
            "Loan duration expired"
        );

        uint256 repaymentAmount = loan.amount +
            (loan.amount * loan.interestRate)/100;

        require(msg.value == repaymentAmount, "Insufficient repayment amount");

        // Update state BEFORE transfer (CEI + nonReentrant = double safety)
        loan.isRepaid = true;
        activeLoanCount[loan.borrower]--;

        // Send repayment + interest to lender
        (bool success, ) = payable(loan.lender)
                           .call{value: repaymentAmount}("");
        require(success, "Transfer to lender failed");

       
        emit LoanRepaid(_loanId, msg.sender, repaymentAmount);
    }

    
    function markDefault(uint256 _loanId)
        external
        nonReentrant
    {
        require(_loanId < loans.length, "Loan does not exist");

        Loan storage loan = loans[_loanId];

        require(loan.isFunded,             "Loan not funded");
        require(!loan.isRepaid,            "Loan already repaid");
        require(!loan.isDefaulted,         "Already defaulted");
        require(msg.sender == loan.lender, "Only lender can mark default");
        require(
            block.timestamp > loan.timestamp + loan.duration + 1 days,
            "Loan duration not expired yet"
        );


        loan.isDefaulted = true;
        activeLoanCount[loan.borrower]--;

        emit LoanDefaulted(_loanId, loan.borrower, loan.lender);
    }

    function cancelLoan(uint256 _loanId) 
    external 
    nonReentrant 
{
    require(_loanId < loans.length,       "Loan does not exist");
    Loan storage loan = loans[_loanId];
    require(loan.borrower == msg.sender,  "Only borrower can cancel");
    require(!loan.isFunded,               "Cannot cancel funded loan");
    require(!loan.isRepaid,               "Loan already repaid");
    require(!loan.isDefaulted,            "Loan already defaulted");
    require(!loan.isCancelled,            "Already cancelled");

    loan.isCancelled = true;
    activeLoanCount[msg.sender]--;

    emit LoanCancelled(_loanId, msg.sender);
}


    // VIEW FUNCTIONS (free — no gas)
    function getLoan(uint256 _loanId)
        external
        view
        returns (Loan memory)
    {
        require(_loanId < loans.length, "Loan does not exist");
        return loans[_loanId];
    }

   
    function getAllLoans()
        external
        view
        returns (Loan[] memory)
    {
        return loans;
    }

   
    function getRepaymentAmount(uint256 _loanId)
        external
        view
        returns (uint256)
    {
        require(_loanId < loans.length, "Loan does not exist");
        Loan memory loan = loans[_loanId];
        return loan.amount + (loan.amount * loan.interestRate) / 100;
    }

 
    function isLoanExpired(uint256 _loanId)
        external
        view
        returns (bool)
    {
        require(_loanId < loans.length, "Loan does not exist");
        Loan memory loan = loans[_loanId];
        return block.timestamp > loan.timestamp + loan.duration;
    }
}