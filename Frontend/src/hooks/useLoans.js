// src/hooks/useLoans.js
// Reads loan data DIRECTLY from the smart contract on Sepolia.
// No backend required — pure blockchain data via a public RPC endpoint.

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, ABI } from "../config.js";

// ── Read-only provider ────────────────────────────────────────────────────────
// Connects to Sepolia using a free public RPC — no API key needed.
// Loans load even before the user connects MetaMask.
const READ_PROVIDER = new ethers.JsonRpcProvider(
  "https://ethereum-sepolia-rpc.publicnode.com"
);

const READ_CONTRACT = new ethers.Contract(CONTRACT_ADDRESS, ABI, READ_PROVIDER);

export function useLoans() {
  const [loans, setLoans]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // getAllLoans() is a free view function — no gas, no MetaMask
      const rawLoans = await READ_CONTRACT.getAllLoans();

      // Convert raw contract structs to plain JS objects
      const parsed = rawLoans.map((loan, index) => ({
        loanId:       index.toString(),
        borrower:     loan.borrower.toLowerCase(),
        lender:       loan.lender === ethers.ZeroAddress
                        ? null
                        : loan.lender.toLowerCase(),
        amount:       loan.amount.toString(),       // wei as string
        interestRate: Number(loan.interestRate),
        duration:     Number(loan.duration),        // seconds
        timestamp:    Number(loan.timestamp),
        isFunded:     loan.isFunded,
        isRepaid:     loan.isRepaid,
        isDefaulted:  loan.isDefaulted,
        // Derive readable status from the three booleans in your contract
        status: loan.isRepaid     ? "REPAID"
               : loan.isDefaulted ? "DEFAULTED"
               : loan.isFunded    ? "FUNDED"
               : "OPEN",
      }));

      // Marketplace shows only OPEN loans
      const openLoans = parsed.filter((l) => l.status === "OPEN");
      setLoans(openLoans);

    } catch (err) {
      console.error("fetchLoans error:", err);
      setError("Could not load loans from blockchain: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  return { loans, loading, error, refetch: fetchLoans };
}
