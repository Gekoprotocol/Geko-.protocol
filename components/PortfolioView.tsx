
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { WalletData, Transaction, AssetInfo } from '../types';
import { universalWallet } from '../services/universalWallet';
import { audioSynth } from '../services/audioSynth';

interface PortfolioViewProps {
  wallet: WalletData | null;
  assets: AssetInfo[];
  depositAddress: string;
  onConnect: () => void;
  onUpdateWallet: (data: WalletData) => void;
  onDisconnect: () => void;
  onRefreshBalances: () => void;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({ wallet, assets, depositAddress, onConnect, onUpdateWallet, onDisconnect, onRefreshBalances }) => {
  const [activeModal, setActiveModal] = useState<'deposit' | 'withdraw' | 'kyc' | null>(null);
  const [step, setStep] = useState<'form' | 'broadcasting' | 'confirming' | 'success'>('form');
  
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAsset, setWithdrawAsset] = useState('SOL');
  const [withdrawDestination, setWithdrawDestination] = useState('');
  
  const [depositAsset, setDepositAsset] = useState('btc');

  // NowPayments dynamic address state
  const [nowPayAddress, setNowPayAddress]   = useState<string | null>(null);
  const [nowPayAmount,  setNowPayAmount]    = useState<string | null>(null);
  const [nowPayLoading, setNowPayLoading]   = useState(false);
  const [nowPayError,   setNowPayError]     = useState('');

  // Protocol Balance — live from DB (sum of transactions)
  const [protocolBalances, setProtocolBalances] = useState<{ asset: string; balance: number; tx_count: number }[]>([]);
  const [tradingBalance, setTradingBalance] = useState(0);
  const [demoBalance, setDemoBalance] = useState(100000);
  const [balLoading, setBalLoading] = useState(false);
  const [dbTransactions, setDbTransactions]     = useState<any[]>([]);
  const [txLoading, setTxLoading]               = useState(false);

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDirection, setTransferDirection] = useState<'vault_to_trade' | 'trade_to_vault'>('vault_to_trade');
  const [transferLoading, setTransferLoading] = useState(false);
  const [tradeStatus, setTradeStatus] = useState<{ msg: string; ok: boolean } | null>(null);

  const [broadcastProgress, setBroadcastProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [gasPrice, setGasPrice] = useState(24);

  const DEPOSIT_ASSETS = [
    { label: 'Bitcoin',        code: 'btc',          network: 'BTC'     },
    { label: 'Ethereum',       code: 'eth',          network: 'ERC-20'  },
    { label: 'Solana',         code: 'sol',          network: 'SOL'     },
    { label: 'USDT (TRC-20)', code: 'usdttrc20',    network: 'TRC-20'  },
    { label: 'USDT (ERC-20)', code: 'usdterc20',    network: 'ERC-20'  },
    { label: 'BNB',            code: 'bnbbsc',       network: 'BEP-20'  },
    { label: 'Litecoin',       code: 'ltc',          network: 'LTC'     },
    { label: 'MATIC',          code: 'maticmainnet', network: 'Polygon' },
  ];

  const fetchDepositAddress = async (assetCode: string) => {
    setNowPayLoading(true);
    setNowPayError('');
    setNowPayAddress(null);
    setNowPayAmount(null);
    try {
      const res = await fetch('/api/create-deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pay_currency: assetCode,
          price_amount: 1,
          price_currency: 'usd',
          order_id: `geko-${wallet?.address || 'anon'}-${Date.now()}`,
          order_description: 'Geko Protocols deposit',
        }),
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText.includes("<!DOCTYPE html>") ? "API Route Not Found (404). Check Vercel deployment." : `Server Error (${res.status})`);
      }

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to generate address');
      setNowPayAddress(data.payment?.pay_address || null);
      setNowPayAmount(data.payment?.pay_amount ? String(data.payment.pay_amount) : null);
    } catch (e: any) {
      setNowPayError(e.message || 'Could not fetch deposit address');
    } finally {
      setNowPayLoading(false);
    }
  };

  // Fetch address whenever deposit modal opens or asset changes
  useEffect(() => {
    if (activeModal === 'deposit') {
      fetchDepositAddress(depositAsset);
    }
  }, [activeModal, depositAsset]);

  // ── Protocol Balance fetch (sum of all DB transactions) ──────────────────
  const fetchProtocolBalance = async () => {
    if (!wallet) return;
    setBalLoading(true);
    try {
      const res = await fetch(`/api/user/balance?address=${encodeURIComponent(wallet.address)}`);
      if (!res.ok) throw new Error("Failed to fetch protocol balance");
      const data = await res.json();
      if (res.ok && data.balances) {
        setProtocolBalances(data.balances);
        setTradingBalance(data.trading_balance || 0);
        setDemoBalance(data.demo_balance || 100000);
      }
    } catch (e) {
      console.error('Protocol balance fetch failed', e);
    } finally {
      setBalLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!wallet?.address || !transferAmount) return;
    setTransferLoading(true);
    try {
      const res = await fetch('/api/balance/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: wallet.address,
          amount: transferAmount,
          direction: transferDirection
        })
      });
      if (!res.ok) throw new Error("Transfer failed");
      const data = await res.json();
      if (res.ok) {
        fetchProtocolBalance();
        setShowTransferModal(false);
        setTransferAmount('');
        setTradeStatus({ msg: 'Transfer Successful', ok: true });
        setTimeout(() => setTradeStatus(null), 3000);
      } else {
        setTradeStatus({ msg: data.error || 'Transfer failed', ok: false });
        setTimeout(() => setTradeStatus(null), 3000);
      }
    } catch (e) {
      setTradeStatus({ msg: 'Network error during transfer', ok: false });
      setTimeout(() => setTradeStatus(null), 3000);
    } finally {
      setTransferLoading(false);
    }
  };

  const fetchDbTransactions = async () => {
    if (!wallet) return;
    setTxLoading(true);
    try {
      const res = await fetch(`/api/user/transactions?address=${encodeURIComponent(wallet.address)}&limit=30`);
      if (!res.ok) throw new Error("Failed to fetch transactions");
      const data = await res.json();
      if (res.ok && data.transactions) setDbTransactions(data.transactions);
    } catch (e) {
      console.error('Transaction history fetch failed', e);
    } finally {
      setTxLoading(false);
    }
  };

  // Load once when wallet is available and refresh every 30s
  useEffect(() => {
    if (!wallet?.address) return;
    fetchProtocolBalance();
    fetchDbTransactions();
    const interval = setInterval(() => {
      fetchProtocolBalance();
      fetchDbTransactions();
    }, 30000);
    return () => clearInterval(interval);
  }, [wallet?.address]);

    const [simulatedYield, setSimulatedYield] = useState(0);
    const lastUpdateTime = useRef(Date.now());
    
    useEffect(() => {
      const int = setInterval(() => setGasPrice(prev => Math.max(12, prev + (Math.random() * 4 - 2))), 5000);
      return () => clearInterval(int);
    }, []);

    const vaultUsdtBalance = useMemo(() => {
    const usdt = protocolBalances.find(b => b.asset === 'USDT');
    return usdt ? usdt.balance : 0;
  }, [protocolBalances]);

  const vipTier = useMemo(() => {
    if (vaultUsdtBalance >= 1000000) return { name: 'DIAMOND', color: 'text-cyan-400', bg: 'bg-cyan-950/20', limit: 'UNLIMITED' };
    if (vaultUsdtBalance >= 100000) return { name: 'PLATINUM', color: 'text-indigo-400', bg: 'bg-indigo-950/20', limit: '500,000 USDT' };
    if (vaultUsdtBalance >= 10000) return { name: 'GOLD', color: 'text-amber-400', bg: 'bg-amber-950/20', limit: '50,000 USDT' };
    return { name: 'STANDARD', color: 'text-gray-400', bg: 'bg-gray-800/20', limit: '5,000 USDT' };
  }, [vaultUsdtBalance]);

  useEffect(() => {
    if (!wallet || vaultUsdtBalance === 0) return;
    const dailyYieldRate = 0.0005;
    const dailyYieldAmount = vaultUsdtBalance * dailyYieldRate;
    const yieldPerSecond = dailyYieldAmount / 86400;
    const interval = setInterval(() => {
        const now = Date.now();
        const deltaSeconds = (now - lastUpdateTime.current) / 1000;
        if (deltaSeconds > 0) {
            setSimulatedYield(prev => prev + (yieldPerSecond * deltaSeconds));
            lastUpdateTime.current = now;
        }
    }, 1000);
    return () => clearInterval(interval);
  }, [vaultUsdtBalance, wallet]);

  const runBroadcastSequence = async (type: 'withdraw' | 'kyc') => {
    setStep('broadcasting');
    setBroadcastProgress(0);
    setErrorMsg('');
    audioSynth.playPing();

    try {
        let txHash = "";

        if (type === 'kyc') {
            await new Promise(r => setTimeout(r, 4000));
            txHash = 'Verification_Signed_Local_Node';
        } else {
            const res = await fetch('/api/request-withdrawal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress:      wallet!.address,
                    destinationAddress: withdrawDestination.trim(),
                    amount:             parseFloat(withdrawAmount),
                    asset:              withdrawAsset
                })
            });
            
            if (!res.ok) {
                throw new Error(`Withdrawal Request Failed (${res.status})`);
            }

            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Withdrawal request failed');
            txHash = `pending-approval-#${data.requestId}`;
        }

        const nodeInterval = setInterval(() => {
            setBroadcastProgress(prev => Math.min(prev + Math.random() * 20, 95));
        }, 150);

        setStep('confirming');
        await new Promise(r => setTimeout(r, 2500));
        clearInterval(nodeInterval);
        setBroadcastProgress(100);

        if (type !== 'kyc') {
            const newTx: Transaction = {
                id: `tx-${Date.now()}`,
                type: 'Send',
                asset: withdrawAsset,
                amount: `-${withdrawAmount}`,
                status: 'Pending',
                timestamp: new Date().toLocaleTimeString(),
                hash: txHash,
                destinationAddress: withdrawDestination
            };
            onUpdateWallet({ ...wallet!, history: [newTx, ...(wallet!.history || [])] });
        }

        setStep('success');
        audioSynth.playSuccess();
        // Refresh live balance immediately after any successful operation
        fetchProtocolBalance();
        fetchDbTransactions();
        setTimeout(() => {
            setActiveModal(null);
            setStep('form');
            setWithdrawAmount('');
            setWithdrawDestination('');
        }, 2500);

    } catch (e: any) {
        setErrorMsg(e.message || 'Transaction failed');
        setStep('form');
        audioSynth.playError();
    }
  };

  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) return;
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0 || !withdrawDestination.trim()) return;
    runBroadcastSequence('withdraw');
  };

  const copyAddress = () => {
    if (!nowPayAddress) return;
    navigator.clipboard.writeText(nowPayAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [isCopiedPopupOpen, setIsCopiedPopupOpen] = useState(false);

  const triggerWalletPopup = () => {
    setIsCopiedPopupOpen(true);
    setTimeout(() => setIsCopiedPopupOpen(false), 5000);
  };

  const handleDepositClick = () => {
    setActiveModal('deposit');
    triggerWalletPopup();
  };

  const handleWithdrawClick = () => {
    setActiveModal('withdraw');
    triggerWalletPopup();
  };

  if (!wallet) return null;

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-10 bg-[#0B0E11] relative custom-scrollbar text-gray-200">
      
      {/* Active Wallet Popup Notification */}
      {isCopiedPopupOpen && (
          <div className="fixed top-24 right-10 z-[1000] animate-in slide-in-from-right-10 duration-500">
              <div className="bg-[#181C25] border-2 border-indigo-500/50 p-6 rounded-[32px] shadow-2xl flex items-center space-x-4 backdrop-blur-xl">
                  <div className="w-12 h-12 bg-indigo-600/20 rounded-2xl flex items-center justify-center border border-indigo-500/30">
                      <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 3c1.22 0 2.383.218 3.46.616m.835 1.918A10.001 10.003 0 0121.25 10.5M12 11V3m0 8c0 2.5 1.5 4.5 3 4.5s3-2 3-4.5-1.5-4.5-3-4.5-3 2-3 4.5z" /></svg>
                  </div>
                  <div>
                      <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Active Identity Link</div>
                      <div className="flex items-center space-x-3">
                          <span className="text-sm font-mono font-bold text-gray-100">{wallet.address.slice(0, 12)}...{wallet.address.slice(-8)}</span>
                          <button onClick={() => { navigator.clipboard.writeText(wallet.address); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="text-indigo-400 hover:text-indigo-300">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                          </button>
                      </div>
                  </div>
                  <button onClick={() => setIsCopiedPopupOpen(false)} className="text-gray-600 hover:text-white">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
              </div>
          </div>
      )}

      <div className="max-w-7xl mx-auto space-y-8 pb-20">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-3">
            <h1 className="text-4xl font-black text-gray-100 italic uppercase tracking-tighter">Equity Center</h1>
            <div className="flex items-center space-x-4">
                <p className="text-[10px] text-gray-500 font-mono tracking-tight bg-[#181C25] px-3 py-1 rounded-lg border border-[#2B3139] w-fit uppercase">Node: {wallet.address.slice(0,12)}...</p>
                <div className="flex items-center space-x-2 bg-indigo-900/20 border border-indigo-500/20 px-3 py-1 rounded-lg">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{gasPrice.toFixed(0)} GWEI</span>
                </div>
            </div>
          </div>
          <div className="flex space-x-3">
             <button onClick={handleDepositClick} className="px-8 py-3 bg-indigo-600 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20">Deposit</button>
             <button onClick={() => setShowTransferModal(true)} className="px-8 py-3 bg-emerald-600/20 text-emerald-500 font-black uppercase tracking-widest text-xs rounded-xl border border-emerald-500/20 hover:bg-emerald-600/20 transition-all">Transfer</button>
             <button onClick={handleWithdrawClick} className="px-8 py-3 bg-[#181C25] text-gray-200 font-black uppercase tracking-widest text-xs rounded-xl border border-[#2B3139] hover:bg-[#262B36] transition-all">Withdraw</button>
             <button onClick={() => setActiveModal('kyc')} className="px-8 py-3 bg-amber-600/10 text-amber-500 font-black uppercase tracking-widest text-xs rounded-xl border border-amber-500/20 hover:bg-amber-600/20 transition-all">Verify KYC</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#181C25] rounded-[40px] p-10 border border-[#2B3139] shadow-xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:scale-105 transition-transform duration-1000 text-indigo-500">
                <svg className="w-64 h-64" fill="currentColor" viewBox="0 0 24 24"><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
             </div>
             <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                   <div className="text-xs text-gray-500 font-bold uppercase tracking-[0.3em]">Protocol Settlement Balance</div>
                   <div className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest border border-current ${vipTier.color} ${vipTier.bg}`}>
                      {`VERIFIED ${vipTier.name}`}
                   </div>
                </div>
                <div className="text-4xl md:text-5xl lg:text-6xl font-mono font-bold text-gray-100 tracking-tighter truncate">
                   ${vaultUsdtBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div className="flex gap-8 mt-10 pt-10 border-t border-[#2B3139]">
                   <div className="group cursor-pointer" onClick={onRefreshBalances}>
                      <div className="text-[10px] text-gray-500 font-bold uppercase mb-1 flex items-center">
                        Session Yield
                        <svg className="w-2 h-2 ml-1 animate-spin-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      </div>
                      <div className="font-mono font-bold text-emerald-500 text-xl">+${simulatedYield.toFixed(4)}</div>
                   </div>
                   <div>
                      <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Live External Liquidity ({wallet.source})</div>
                      <div className="font-mono font-bold text-indigo-400 text-xl flex items-center">
                        ${wallet.balances.reduce((acc, b) => acc + parseFloat(b.valueUsd.replace(/,/g, '')), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <div className="ml-2 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                      </div>
                   </div>
                </div>
             </div>
          </div>
          
          <div className="bg-[#181C25] rounded-[40px] p-6 border border-[#2B3139] flex flex-col items-center justify-center space-y-5 text-center">
            <div className="p-5 rounded-full bg-indigo-900/20 border border-indigo-500/20">
              <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-black text-gray-200 uppercase tracking-tight">Deposit Crypto</div>
              <div className="text-[10px] text-gray-500 leading-relaxed px-2">Select an asset and get a secure, one-time deposit address generated by our payment gateway.</div>
            </div>
            <button
              onClick={handleDepositClick}
              className="w-full py-4 bg-indigo-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20"
            >
              Generate Address
            </button>
            <div className="flex items-center space-x-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Gateway · Secured</span>
            </div>
          </div>
        </div>

        {/* ── Protocol Balance Card ─────────────────────────────────────── */}
        <div className="bg-[#181C25] rounded-[40px] border border-[#2B3139] overflow-hidden shadow-xl">
          <div className="p-8 border-b border-[#2B3139] bg-[#1E2329] flex justify-between items-center">
            <div>
              <h3 className="text-lg font-black text-gray-100 uppercase italic tracking-widest">Protocol Balance</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">On-chain deposits · Live from ledger</p>
            </div>
            <button
              onClick={() => { fetchProtocolBalance(); fetchDbTransactions(); }}
              className="flex items-center space-x-2 px-4 py-2 bg-[#0B0E11] border border-[#2B3139] rounded-2xl text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-white hover:border-indigo-500/40 transition-all"
            >
              {balLoading
                ? <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              }
              <span>Refresh</span>
            </button>
          </div>

          {protocolBalances.length === 0 && !balLoading && (
            <div className="flex flex-col items-center justify-center py-16 space-y-3 text-center px-8">
              <div className="w-14 h-14 rounded-full bg-indigo-900/20 border border-indigo-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <p className="text-sm font-black text-gray-400 uppercase italic">No deposits recorded yet</p>
              <p className="text-[10px] text-gray-600 leading-relaxed max-w-xs">
                Deposits made via the gateway or direct SOL transfers will appear here once confirmed on-chain.
              </p>
              <button
                onClick={() => setActiveModal('deposit')}
                className="mt-2 px-6 py-3 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-indigo-500 transition-colors"
              >
                Make a Deposit
              </button>
            </div>
          )}

          {balLoading && protocolBalances.length === 0 && (
            <div className="flex items-center justify-center py-16 space-x-3">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Loading ledger…</span>
            </div>
          )}

          {protocolBalances.length > 0 && (
            <div className="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {protocolBalances.map(b => {
                const ASSET_COLORS: Record<string, string> = {
                  SOL: 'text-purple-400 border-purple-500/20 bg-purple-900/10',
                  BTC: 'text-amber-400 border-amber-500/20 bg-amber-900/10',
                  ETH: 'text-blue-400 border-blue-500/20 bg-blue-900/10',
                  USDT: 'text-emerald-400 border-emerald-500/20 bg-emerald-900/10',
                  BNB: 'text-yellow-400 border-yellow-500/20 bg-yellow-900/10',
                  LTC: 'text-gray-400 border-gray-500/20 bg-gray-900/10',
                  MATIC: 'text-violet-400 border-violet-500/20 bg-violet-900/10',
                };
                const colorClass = ASSET_COLORS[b.asset] || 'text-indigo-400 border-indigo-500/20 bg-indigo-900/10';
                return (
                  <div key={b.asset} className={`rounded-3xl p-5 border ${colorClass} flex flex-col space-y-2`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-widest opacity-70">{b.asset}</span>
                      <span className="text-[8px] font-bold text-gray-600">{b.tx_count} tx</span>
                    </div>
                    <div className="font-mono font-black text-2xl">
                      {b.balance >= 0.001
                        ? b.balance.toLocaleString(undefined, { minimumFractionDigits: b.asset === 'USDT' ? 2 : 4, maximumFractionDigits: b.asset === 'USDT' ? 2 : 6 })
                        : b.balance.toFixed(8)}
                    </div>
                    <div className={`text-[8px] font-black uppercase tracking-widest flex items-center space-x-1 ${b.balance > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${b.balance > 0 ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />
                      <span>{b.balance > 0 ? 'Funded' : 'Zero balance'}</span>
                    </div>
                  </div>
                );
              })}

              {/* Total USDT value row */}
              {protocolBalances.some(b => b.asset === 'USDT') && (
                <div className="col-span-full mt-2 p-5 rounded-3xl border border-indigo-500/20 bg-indigo-900/10 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-500">Total Protocol Deposits (USDT)</div>
                    <div className="font-mono font-black text-3xl text-indigo-300">
                      ${(protocolBalances.find(b => b.asset === 'USDT')?.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 bg-indigo-950/40 px-4 py-2 rounded-2xl border border-indigo-500/10">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Live</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {activeModal && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
             <div className="bg-[#181C25] border border-[#2B3139] rounded-[48px] max-w-lg w-full p-10 shadow-2xl relative overflow-y-auto max-h-[90vh] no-scrollbar">
                <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600 shrink-0"></div>
                
                {step === 'form' && (
                   <div className="space-y-8">
                      <div className="flex justify-between items-center">
                         <h2 className="text-2xl font-black text-gray-100 uppercase italic tracking-tight">{activeModal} Assets</h2>
                         <button onClick={() => setActiveModal(null)} className="text-gray-500 hover:text-white transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                         </button>
                      </div>

                      {activeModal === 'deposit' && (
                        <div className="flex flex-col space-y-6">

                          {/* Asset selector — scrollable vertical list */}
                          <div className="space-y-3">
                            <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Select Deposit Asset</label>
                            <div className="max-h-48 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                              {DEPOSIT_ASSETS.map(a => (
                                <button
                                  key={a.code}
                                  type="button"
                                  onClick={() => setDepositAsset(a.code)}
                                  disabled={nowPayLoading}
                                  className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                                    depositAsset === a.code 
                                      ? 'bg-indigo-600 border-indigo-500 text-white' 
                                      : 'bg-[#0B0E11] border-[#2B3139] text-gray-400 hover:border-gray-600'
                                  }`}
                                >
                                  <div className="flex items-center space-x-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${depositAsset === a.code ? 'bg-white/20' : 'bg-[#181C25] border border-[#2B3139]'}`}>
                                      {a.code.substring(0,2).toUpperCase()}
                                    </div>
                                    <div className="text-left">
                                      <div className="text-[11px] font-black uppercase tracking-tight">{a.label}</div>
                                      <div className={`text-[8px] font-bold uppercase ${depositAsset === a.code ? 'text-white/60' : 'text-gray-600'}`}>{a.network} Network</div>
                                    </div>
                                  </div>
                                  {depositAsset === a.code && <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* QR + address area */}
                          {nowPayLoading && (
                            <div className="flex flex-col items-center space-y-3 py-6">
                              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                              <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Generating address…</span>
                            </div>
                          )}

                          {nowPayError && !nowPayLoading && (
                            <div className="w-full p-4 bg-rose-900/20 border border-rose-500/30 rounded-2xl text-xs text-rose-400 font-bold text-center space-y-3">
                              <p>{nowPayError}</p>
                              <button
                                onClick={() => fetchDepositAddress(depositAsset)}
                                className="px-4 py-2 bg-rose-600 text-white font-black uppercase text-[10px] rounded-xl hover:bg-rose-500 transition-colors"
                              >
                                Retry
                              </button>
                            </div>
                          )}

                          {nowPayAddress && !nowPayLoading && (
                            <>
                              <div className="bg-white p-4 rounded-3xl shadow-xl flex flex-col items-center">
                                <QRCodeSVG value={nowPayAddress} size={192} level="H" includeMargin={true} className="rounded-2xl" />
                                <div className="mt-2 flex items-center space-x-1">
                                  <svg className="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                                  <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Gateway Address Verified</span>
                                </div>
                              </div>

                              <div className="w-full p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-2xl flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="text-[9px] text-indigo-400 font-black uppercase tracking-widest mb-1">Your Connected Wallet</div>
                                  <div className="font-mono text-[10px] text-gray-300 break-all select-all">
                                    {wallet.address}
                                  </div>
                                </div>
                                <button type="button" onClick={() => { navigator.clipboard.writeText(wallet.address); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="ml-4 text-indigo-500 hover:text-indigo-400 transition-colors">
                                  {copied ? <span className="text-[8px] font-black uppercase text-emerald-400">Copied</span> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                                </button>
                              </div>

                              <div className="w-full space-y-2">
                                <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Deposit Address (Send any amount)</label>
                                <div className="flex items-center space-x-3 bg-[#0B0E11] p-4 rounded-2xl border border-[#2B3139]">
                                  <span className="flex-1 font-mono text-[10px] text-gray-400 break-all select-all leading-relaxed">{nowPayAddress}</span>
                                  <button type="button" onClick={copyAddress} className="text-indigo-500 hover:text-indigo-400 shrink-0">
                                    {copied
                                      ? <span className="text-[8px] font-black uppercase text-emerald-400">Copied</span>
                                      : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                    }
                                  </button>
                                </div>
                              </div>

                              <button
                                onClick={() => { setActiveModal(null); audioSynth.playPing(); }}
                                className="w-full py-5 bg-indigo-600 text-white font-black uppercase italic tracking-widest rounded-3xl shadow-xl hover:bg-indigo-500 transition-all"
                              >
                                I've Sent the Payment
                              </button>
                              <p className="text-[9px] text-gray-600 text-center leading-relaxed">
                                Your balance will be credited automatically once the transaction is confirmed on-chain.
                              </p>
                            </>
                          )}

                        </div>
                      )}

                      {activeModal === 'withdraw' && (
                         <form onSubmit={handleWithdrawSubmit} className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2">
                                  <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Asset</label>
                                  <select value={withdrawAsset} onChange={e => setWithdrawAsset(e.target.value)} className="w-full bg-[#0B0E11] border border-[#2B3139] rounded-2xl p-4 text-sm h-14">
                                     {['SOL', 'USDT'].map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                               </div>
                               <div className="space-y-2">
                                  <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Volume</label>
                                  <input type="number" required step="any" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="0.00" className="w-full bg-[#0B0E11] border border-[#2B3139] rounded-2xl p-4 text-sm font-mono h-14" />
                               </div>
                            </div>
                            <div className="space-y-2">
                               <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Payout Destination</label>
                               <input 
                                  type="text" 
                                  required 
                                  value={withdrawDestination}
                                  onChange={e => setWithdrawDestination(e.target.value)}
                                  placeholder="0x... or Solana Address" 
                                  className="w-full bg-[#0B0E11] border border-[#2B3139] rounded-2xl p-4 text-sm font-mono h-14" 
                                />
                            </div>
                            <button type="submit" className="w-full py-6 bg-indigo-600 text-white font-black uppercase italic tracking-widest rounded-3xl shadow-xl hover:bg-indigo-500 transition-all">Submit Payout Request</button>
                         </form>
                      )}
                      
                      {activeModal === 'kyc' && (
                         <div className="space-y-6">
                            <div className="p-6 bg-[#0B0E11] rounded-3xl border border-[#2B3139] space-y-4">
                               <h3 className="text-sm font-black text-gray-100 uppercase italic">Identification Attestation</h3>
                               <p className="text-[10px] text-gray-500 leading-relaxed">Geko Protocols requires high-fidelity identification to comply with cross-chain regulatory frameworks.</p>
                               <div className="grid grid-cols-2 gap-3">
                                  <div className="p-4 bg-[#181C25] border border-[#2B3139] rounded-2xl text-center">
                                     <div className="text-[8px] text-gray-600 uppercase font-black">Level 1</div>
                                     <div className="text-xs font-bold text-emerald-500 mt-1">COMPLETE</div>
                                  </div>
                                  <div className="p-4 bg-[#181C25] border border-amber-500/30 rounded-2xl text-center">
                                     <div className="text-[8px] text-gray-600 uppercase font-black">Level 2</div>
                                     <div className="text-xs font-bold text-amber-500 mt-1">REQUIRED</div>
                                  </div>
                               </div>
                            </div>
                            <button onClick={() => runBroadcastSequence('kyc')} className="w-full py-6 bg-amber-600 text-white font-black uppercase italic tracking-widest rounded-3xl shadow-xl hover:bg-amber-500 transition-all">Sign Level 2 Attestation</button>
                         </div>
                      )}
                   </div>
                )}

                {(step === 'broadcasting' || step === 'confirming') && (
                   <div className="py-20 flex flex-col items-center justify-center space-y-10">
                      <div className="relative w-32 h-32">
                         <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
                         <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
                      </div>
                      <div className="text-center space-y-4">
                         <h3 className="text-3xl font-black text-gray-100 uppercase italic tracking-tighter">
                            {step === 'broadcasting' ? 'Scanning Network' : 'Confirming Blocks'}
                         </h3>
                         <div className="w-64 h-1.5 bg-[#0B0E11] rounded-full overflow-hidden mx-auto">
                            <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${broadcastProgress}%` }}></div>
                         </div>
                      </div>
                   </div>
                )}

                {step === 'success' && (
                   <div className="py-20 flex flex-col items-center justify-center space-y-8 animate-in zoom-in-95">
                      <div className="w-24 h-24 bg-emerald-500/10 border-4 border-emerald-500 rounded-full flex items-center justify-center text-emerald-500">
                         <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <h3 className="text-3xl font-black text-gray-100 uppercase italic tracking-tighter">Request Submitted</h3>
                      <p className="text-center text-gray-500 text-xs uppercase font-bold tracking-widest">Pending admin approval · Funds will be sent once confirmed.</p>
                   </div>
                )}
             </div>
          </div>
        )}

        <div className="bg-[#181C25] rounded-[40px] border border-[#2B3139] overflow-hidden shadow-sm">
           <div className="p-8 border-b border-[#2B3139] bg-[#1E2329] flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-gray-100 uppercase italic tracking-widest">Protocol Ledger</h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">All recorded transactions from the DB</p>
              </div>
              {txLoading && <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />}
           </div>

           {dbTransactions.length === 0 && !txLoading && (
             <div className="flex flex-col items-center justify-center py-14 space-y-2 text-center px-8">
               <p className="text-sm font-black text-gray-500 uppercase italic">No transaction records yet</p>
               <p className="text-[10px] text-gray-600">Deposits, withdrawals, and trades will appear here.</p>
             </div>
           )}

           {dbTransactions.length > 0 && (
           <div className="overflow-x-auto">
              <table className="w-full text-left">
                 <thead className="bg-[#0B0E11] text-[10px] text-gray-500 uppercase font-black tracking-widest">
                    <tr>
                       <th className="px-8 py-6">Tx / Reference</th>
                       <th className="px-8 py-6">Type</th>
                       <th className="px-8 py-6">Asset</th>
                       <th className="px-8 py-6">Amount</th>
                       <th className="px-8 py-6 text-right">Date</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-[#2B3139]">
                    {dbTransactions.map((tx: any) => {
                      const isCredit = parseFloat(tx.amount) >= 0;
                      const ref = tx.tx_signature || tx.payment_id || tx.reference || `#${tx.id}`;
                      const date = new Date(tx.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                      const TYPE_COLORS: Record<string, string> = {
                        deposit:    'text-emerald-400 bg-emerald-900/20 border-emerald-500/20',
                        credit:     'text-blue-400 bg-blue-900/20 border-blue-500/20',
                        withdrawal: 'text-rose-400 bg-rose-900/20 border-rose-500/20',
                        trade:      'text-amber-400 bg-amber-900/20 border-amber-500/20',
                        debit:      'text-orange-400 bg-orange-900/20 border-orange-500/20',
                      };
                      const typeColor = TYPE_COLORS[tx.type] || 'text-gray-400 bg-gray-800/20 border-gray-600/20';
                      return (
                        <tr key={tx.id} className="hover:bg-[#262B36] transition-colors">
                           <td className="px-8 py-5">
                              <div className="text-[10px] text-indigo-400 font-mono truncate max-w-[180px]">{ref.slice(0, 24)}{ref.length > 24 ? '…' : ''}</div>
                              {tx.payment_id && <div className="text-[8px] text-gray-600 mt-0.5 font-mono">pay:{tx.payment_id.slice(0, 12)}…</div>}
                           </td>
                           <td className="px-8 py-5">
                              <span className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-xl border ${typeColor}`}>{tx.type}</span>
                           </td>
                           <td className="px-8 py-5">
                              <span className="text-xs font-black uppercase text-gray-300">{tx.asset_symbol}</span>
                           </td>
                           <td className="px-8 py-5">
                              <span className={`text-sm font-mono font-bold ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isCredit ? '+' : ''}{parseFloat(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                              </span>
                           </td>
                           <td className="px-8 py-5 text-right">
                              <span className="text-[9px] text-gray-500 font-bold uppercase">{date}</span>
                           </td>
                        </tr>
                      );
                    })}
                 </tbody>
              </table>
           </div>
           )}
        </div>

        {/* Transfer Modal */}
        {showTransferModal && (
            <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="absolute inset-0" onClick={() => setShowTransferModal(false)} />
            <div className="relative w-full max-w-md bg-[#181C25] border border-[#2B3139] rounded-[40px] shadow-2xl overflow-hidden flex flex-col">
                <div className="p-8 border-b border-[#2B3139] bg-[#1E2329] flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">Internal Transfer</h2>
                    <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mt-1">Move funds between Protocol and Available</p>
                </div>
                <button onClick={() => setShowTransferModal(false)} className="text-gray-500 hover:text-white transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                </div>
                
                <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-3 p-1 bg-[#0B0E11] rounded-2xl border border-[#2B3139]">
                    <button 
                    onClick={() => setTransferDirection('vault_to_trade')}
                    className={`py-3 text-[10px] font-black uppercase rounded-xl transition-all ${transferDirection === 'vault_to_trade' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                    To Trading
                    </button>
                    <button 
                    onClick={() => setTransferDirection('trade_to_vault')}
                    className={`py-3 text-[10px] font-black uppercase rounded-xl transition-all ${transferDirection === 'trade_to_vault' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                    To Protocol
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                    <span className="text-gray-500">Available {transferDirection === 'vault_to_trade' ? 'Protocol' : 'Trading'}</span>
                    <span className="text-indigo-400">
                        ${(transferDirection === 'vault_to_trade' ? vaultUsdtBalance : tradingBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    </div>
                    
                    <div className="relative">
                    <input 
                        type="number"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-[#0B0E11] border border-[#2B3139] focus:border-indigo-500 rounded-2xl p-5 text-lg font-mono font-bold text-gray-100 outline-none transition-all"
                    />
                    <button 
                        onClick={() => setTransferAmount((transferDirection === 'vault_to_trade' ? vaultUsdtBalance : tradingBalance).toString())}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase text-indigo-500 hover:text-indigo-400"
                    >
                        Max
                    </button>
                    </div>
                </div>

                <button 
                    onClick={handleTransfer}
                    disabled={transferLoading || !transferAmount || parseFloat(transferAmount) <= 0}
                    className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black uppercase italic tracking-[0.2em] rounded-2xl shadow-xl transition-all flex items-center justify-center space-x-3"
                >
                    {transferLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                    <>
                        <span>Confirm Transfer</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </>
                    )}
                </button>

                {tradeStatus && (
                    <div className={`text-[9px] font-black uppercase tracking-widest text-center px-3 py-2 rounded-xl border ${tradeStatus.ok ? 'bg-emerald-900/30 border-emerald-500/30 text-emerald-400' : 'bg-rose-900/30 border-rose-500/30 text-rose-400'}`}>
                        {tradeStatus.msg}
                    </div>
                )}
                </div>

                <div className="p-4 bg-[#0B0E11] border-t border-[#2B3139] text-center">
                <span className="text-[8px] text-gray-600 font-black uppercase tracking-widest">Secure Protocol Settlement Layer</span>
                </div>
            </div>
            </div>
        )}
      </div>
    </div>
  );
};
