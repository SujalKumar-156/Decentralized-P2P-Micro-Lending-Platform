// src/hooks/useWallet.js
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, ABI } from "../config.js";

const SEPOLIA_CHAIN_ID = "0xaa36a7";

export function useWallet() {
  const [provider, setProvider]   = useState(null);
  const [signer, setSigner]       = useState(null);
  const [contract, setContract]   = useState(null);
  const [address, setAddress]     = useState(null);
  const [chainId, setChainId]     = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  const isConnected    = !!address;
  const isWrongNetwork = chainId !== null && chainId !== SEPOLIA_CHAIN_ID;

  const connectWallet = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      // ── Check MetaMask is installed ──────────────────────────────────────
      if (!window.ethereum) {
        setError("MetaMask not found. Please install it from metamask.io");
        setLoading(false);
        return;
      }

      // ── Request accounts — opens MetaMask popup ──────────────────────────
      let accounts;
      try {
        accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      } catch (err) {
        setError(err.code === 4001
          ? "You rejected the MetaMask connection. Please try again."
          : "MetaMask error: " + err.message);
        setLoading(false);
        return;
      }

      if (!accounts || accounts.length === 0) {
        setError("No accounts found in MetaMask.");
        setLoading(false);
        return;
      }

      // ── Check current chain ──────────────────────────────────────────────
      const currentChain = await window.ethereum.request({ method: "eth_chainId" });

      // ── Switch to Sepolia if needed ──────────────────────────────────────
      if (currentChain !== SEPOLIA_CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: SEPOLIA_CHAIN_ID }],
          });
        } catch (switchErr) {
          if (switchErr.code === 4902) {
            // Sepolia not added yet — add it
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: SEPOLIA_CHAIN_ID,
                chainName: "Sepolia Testnet",
                nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
                rpcUrls: ["https://rpc.sepolia.org"],
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              }],
            });
          } else {
            setError("Could not switch to Sepolia: " + switchErr.message);
            setLoading(false);
            return;
          }
        }
      }

      // ── Build Ethers v6 provider + signer ────────────────────────────────
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      const web3Signer   = await web3Provider.getSigner();
      const userAddress  = await web3Signer.getAddress();

      // ── Build contract instance ──────────────────────────────────────────
      const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, ABI, web3Signer);

      setProvider(web3Provider);
      setSigner(web3Signer);
      setAddress(userAddress.toLowerCase());
      setChainId(SEPOLIA_CHAIN_ID);
      setContract(contractInstance);

    } catch (err) {
      console.error("connectWallet error:", err);
      setError("Connection failed: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setContract(null);
    setAddress(null);
    setChainId(null);
    setError(null);
  }, []);

  // ── Listen for MetaMask account / chain changes ──────────────────────────
  useEffect(() => {
    if (!window.ethereum) return;

    const onAccountsChanged = (accounts) => {
      if (accounts.length === 0) disconnectWallet();
      else disconnectWallet(); // force reconnect on account switch
    };

    const onChainChanged = () => window.location.reload();

    window.ethereum.on("accountsChanged", onAccountsChanged);
    window.ethereum.on("chainChanged",    onChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", onAccountsChanged);
      window.ethereum.removeListener("chainChanged",    onChainChanged);
    };
  }, [disconnectWallet]);

  return {
    provider, signer, contract, address, chainId,
    isConnected, isWrongNetwork, loading, error,
    connectWallet, disconnectWallet,
  };
}
