
import React, { useState, useEffect, useRef } from 'react';
import { AssetInfo, MarketData, ActiveTrade, WalletData } from '../types';
import MarketChart from './MarketChart';
import GeminiAdvisor from './GeminiAdvisor';

interface TradeViewProps {
  assets: AssetInfo[];
  selectedAsset: AssetInfo;
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
  marketData: MarketData[];
  isConnected: boolean;
  onPlaceTrade: (trade: { direction: 'up' | 'down', amount: string, duration: number }) => void;
  activeTrades: ActiveTrade[];
  wallet?: (WalletData & { email?: string }) | null;
}

const MIN_TRADE   = 1;
const PAYOUT_RATE = 0.85;
const PRESETS     = [10, 25, 50, 100, 250, 500];

const TradeView: React.FC<TradeViewProps> = ({
  assets,
  selectedAsset,
  selectedSymbol,
  setSelectedSymbol,
  marketData,
  isConnected,
  onPlaceTrade,
  activeTrades,
  wallet
}) => {
  const [showIndicators, setShowIndicators] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [isAssetSelectorOpen, setIsAssetSelectorOpen] = useState(false);
  const [tradeStatus, setTradeStatus] = useState<{ msg: string; ok: boolean } | null>(null);

  // Execution Form State
  const [amount, setAmount]     = useState('100');
  const [duration, setDuration] = useState(60);
  const [leverage, setLeverage] = useState(20);

  // Live DB balance (Vault)
  const [vaultBalance, setVaultBalance] = useState<number>(wallet?.protocolBalances?.[0]?.amount ? parseFloat(wallet.protocolBalances[0].amount) : 0);
  const [tradingBalance, setTradingBalance] = useState<number>(wallet?.trading_balance || 0);
  const [balLoading, setBalLoading]     = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDirection, setTransferDirection] = useState<'vault_to_trade' | 'trade_to_vault'>('vault_to_trade');
  const [transferLoading, setTransferLoading] = useState(false);
  const [localActiveTrades, setLocalActiveTrades] = useState<ActiveTrade[]>(activeTrades || []);
  const [localSettledTrades, setLocalSettledTrades] = useState<ActiveTrade[]>([]);

  useEffect(() => {
    setLocalActiveTrades(activeTrades);
  }, [activeTrades]);

  useEffect(() => {
    if (wallet) {
        setTradingBalance(wallet.trading_balance || 0);
        if (wallet.protocolBalances?.[0]) setVaultBalance(parseFloat(wallet.protocolBalances[0].amount));
    }
  }, [wallet?.trading_balance, wallet?.protocolBalances]);

  // Validation
  const parsedAmount  = parseFloat(amount) || 0;
  const hasSufficient = tradingBalance >= parsedAmount;
  const isBelowMin    = parsedAmount < MIN_TRADE;
  const canTrade      = !isBelowMin && hasSufficient && parsedAmount > 0;
  const potentialProfit = parseFloat((parsedAmount * PAYOUT_RATE).toFixed(2));

  const handleTransfer = async () => {
    if (!wallet?.address || !transferAmount) return;
    
    if (wallet.isDemo) {
      setTradeStatus({ msg: 'Transfers only available in Live mode', ok: false });
      setTimeout(() => setTradeStatus(null), 3000);
      return;
    }

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
        setVaultBalance(parseFloat(data.vault_balance));
        setTradingBalance(parseFloat(data.trading_balance));
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

  const executeTrade = async (direction: 'up' | 'down') => {
    if (tradingBalance < 1) {
      setTradeStatus({ msg: 'No trading funds. Please transfer from vault.', ok: false });
      setShowTransferModal(true);
      setTransferDirection('vault_to_trade');
      setTimeout(() => setTradeStatus(null), 3000);
      return;
    }

    if (!canTrade) {
      setTradeStatus({ msg: isBelowMin ? `Minimum trade is $${MIN_TRADE}` : 'Insufficient trading balance', ok: false });
      setTimeout(() => setTradeStatus(null), 3000);
      return;
    }

    const tradeId = Math.random().toString(36).substring(7);
    const newTrade: ActiveTrade = {
      id: tradeId,
      symbol: selectedSymbol,
      userName: 'Local_Node',
      direction,
      amount: amount,
      entryPrice: selectedAsset.price,
      startTime: Date.now(),
      duration: duration,
      status: 'pending'
    };

    setLocalActiveTrades(prev => [...prev, newTrade]);

    if (wallet?.address) {
      try {
        const res  = await fetch('/api/execute-trade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: wallet?.address,
            asset:         selectedSymbol,
            tradeSize:     amount,
            leverage,
            type:          direction === 'up' ? 'LONG' : 'SHORT',
            isDemo:        wallet?.isDemo,
            entryPrice:    selectedAsset.price,
            duration:      duration,
            tradeId:       tradeId
          })
        });
        
        const data = await res.json();

        if (!res.ok) {
          setTradeStatus({ msg: data.error || 'Order rejected', ok: false });
          setLocalActiveTrades(prev => prev.filter(t => t.id !== tradeId));
        } else {
          setTradeStatus({ msg: `Order placed · -$${parsedAmount} margin`, ok: true });
          setTradingBalance(prev => prev - parsedAmount);
        }
      } catch (e) {
        setTradeStatus({ msg: 'Ledger sync failed', ok: false });
        setLocalActiveTrades(prev => prev.filter(t => t.id !== tradeId));
      }
      setTimeout(() => setTradeStatus(null), 3000);
    }
  };

  // Settlement Loop
  useEffect(() => {
    const interval = setInterval(async () => {
      const now = Date.now();
      const toSettle = localActiveTrades.filter(t => now - t.startTime >= t.duration * 1000);
      
      if (toSettle.length === 0) return;

      for (const trade of toSettle) {
        // Settlement Logic: Check for forceOutcome from admin, otherwise simulate
        let isWin = false;
        if (trade.forceOutcome === 'win') isWin = true;
        else if (trade.forceOutcome === 'loss') isWin = false;
        else isWin = Math.random() > 0.45;

        const pnl = isWin ? parseFloat(trade.amount) * (1 + PAYOUT_RATE) : 0;
        
        if (wallet?.address) {
          try {
            await fetch('/api/settle-trade', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                walletAddress: wallet.address,
                asset: trade.symbol,
                payout: pnl.toFixed(2),
                tradeRef: trade.id,
                isDemo: wallet?.isDemo,
                status: isWin ? 'won' : 'lost'
              })
            });
            if (isWin) setTradingBalance(prev => prev + pnl);
          } catch (e) {
            console.error('Settlement sync failed');
          }
        }

        const settledTrade: ActiveTrade = {
          ...trade,
          status: isWin ? 'won' : 'lost',
          pnl: isWin ? pnl - parseFloat(trade.amount) : -parseFloat(trade.amount),
          settledAt: now
        };

        setLocalSettledTrades(prev => [settledTrade, ...prev].slice(0, 10));
        setLocalActiveTrades(prev => prev.filter(t => t.id !== trade.id));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [localActiveTrades, wallet?.address, wallet?.isDemo]);

  const userPending  = localActiveTrades;
  const userSettled  = localSettledTrades;
  const userActiveTrades = userPending;

  return (
    <div className="flex flex-col h-full bg-[#0B0E11] text-gray-300 font-mono select-none overflow-hidden relative">
      {/* HUD Header */}
      <div className="h-16 border-b border-[#2B3139] bg-[#181C25] flex items-center px-6 shrink-0 z-30 justify-between">
        <div className="flex items-center space-x-8">
            <button 
                onClick={() => setIsAssetSelectorOpen(true)}
                className="flex flex-col text-left group hover:bg-[#2B3139] p-2 rounded-xl transition-all border border-transparent hover:border-indigo-500/30"
            >
                <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest flex items-center">
                    Institutional Pair
                    <svg className="w-3 h-3 ml-1 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                </span>
                <span className="text-gray-100 font-black text-lg italic tracking-tighter group-hover:text-indigo-400">{selectedSymbol}/USDT</span>
            </button>
            <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Oracle Index</span>
                <span className={`text-lg font-black tabular-nums ${selectedAsset.price > 0 ? (selectedAsset.change24h >= 0 ? 'text-emerald-500' : 'text-rose-500') : 'text-gray-600'}`}>
                    ${selectedAsset.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
            </div>
            <div className="hidden lg:flex items-center space-x-3 bg-[#0B0E11] px-4 py-2 rounded-xl border border-[#2B3139]">
                <button onClick={() => setShowIndicators(!showIndicators)} className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg transition-all ${showIndicators ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>
                    TA Indicators
                </button>
                <button onClick={() => setShowAI(!showAI)} className={`text-[10px] uppercase font-black px-3 py-1 rounded-lg flex items-center space-x-2 transition-all ${showAI ? 'bg-indigo-900/30 text-indigo-400 border border-indigo-500/30' : 'text-gray-500 hover:text-gray-300'}`}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    <span>Neural Analysis</span>
                </button>
            </div>
        </div>
        
        <div className="flex items-center space-x-4 shrink-0">
          <div className="flex items-center space-x-3 bg-indigo-900/10 px-5 py-2 rounded-xl border border-indigo-500/20 group cursor-default relative">
             <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
             <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Protocol Handshake: Secured</span>
             
             {/* Tooltip detail for the "Sync" */}
             <div className="absolute top-full right-0 mt-2 w-48 bg-[#1E2329] border border-[#2B3139] p-3 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-2xl">
                <div className="text-[8px] text-gray-500 font-black uppercase mb-1">Telemetry Origin</div>
                <div className="text-[9px] text-indigo-400 font-mono">github.com/ceejay-web/Geko---protocol</div>
             </div>
          </div>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden flex bg-[#0B0E11]">
        {/* Graph Area */}
        <div className="flex-1 relative h-full flex flex-col">
            <div className="flex-1 relative">
                <MarketChart 
                    data={marketData} 
                    symbol={selectedSymbol} 
                    showIndicators={showIndicators} 
                />
            </div>
            
            {/* Minimalist Positions View (Strip at bottom of chart) */}
            {userActiveTrades.length > 0 && (
                <div className="h-48 bg-[#181C25]/80 backdrop-blur-md border-t border-[#2B3139] flex flex-col p-4 overflow-y-auto no-scrollbar shrink-0 z-20">
                    <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-3">Live Orders:</span>
                    <div className="space-y-2">
                        {userActiveTrades.map(t => (
                            <div key={t.id} className="flex items-center justify-between bg-[#0B0E11] px-5 py-3 rounded-2xl border border-[#2B3139] animate-in slide-in-from-bottom-2">
                                <span className={`text-[10px] font-black uppercase ${t.direction === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {t.direction === 'up' ? 'Long' : 'Short'} ${t.amount}
                                </span>
                                <span className="text-[10px] font-mono font-bold text-gray-500">
                                    {Math.max(0, t.duration - Math.floor((Date.now() - t.startTime)/1000))}s remaining
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* Execution Control Sidebar */}
        <div className="w-72 bg-[#181C25] border-l border-[#2B3139] shrink-0 flex flex-col z-30 shadow-2xl relative overflow-y-auto no-scrollbar">
            <div className="p-5 space-y-5 flex-1 flex flex-col">

                {/* Trading Balance Card */}
                <div className={`rounded-2xl p-4 border ${!hasSufficient ? 'bg-rose-900/10 border-rose-500/30' : 'bg-[#0B0E11] border-[#2B3139]'}`}>
                    <div className="flex justify-between items-center mb-1">
                        <div className="text-[8px] text-gray-500 font-black uppercase tracking-widest">{wallet?.isDemo ? 'Available Balance (DEMO)' : 'Available Balance'}</div>
                        <button onClick={() => setShowTransferModal(true)} className="text-[8px] text-indigo-500 font-black uppercase hover:text-indigo-400 transition-colors">Transfer</button>
                    </div>
                    {balLoading && tradingBalance === 0 ? (
                        <div className="h-5 w-24 bg-[#2B3139] rounded animate-pulse"></div>
                    ) : (
                        <div className="flex items-baseline space-x-1">
                            <span className={`text-lg font-black font-mono tabular-nums ${!hasSufficient ? 'text-rose-400' : 'text-emerald-400'}`}>
                                ${tradingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-[9px] text-gray-600 font-black">USDT</span>
                            <button onClick={fetchBalances} className="ml-auto text-gray-600 hover:text-gray-400 transition-colors">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            </button>
                        </div>
                    )}
                    {!hasSufficient && tradingBalance > 0 && (
                        <div className="text-[8px] text-rose-400 font-black mt-1">Exceeds available balance</div>
                    )}
                    <div className="mt-2 pt-2 border-t border-[#2B3139] flex justify-between items-center">
                        <span className="text-[7px] text-gray-600 font-black uppercase">Protocol Balance</span>
                        <span className="text-[8px] text-indigo-400 font-mono font-bold">${vaultBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>

                {/* Trade Size */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                        <label className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Trade Size (USDT)</label>
                        <span className="text-[8px] text-gray-600 font-black">Min $1</span>
                    </div>
                    <input
                        type="number"
                        value={amount}
                        min={MIN_TRADE}
                        onChange={(e) => setAmount(e.target.value)}
                        className={`w-full bg-[#0B0E11] border rounded-2xl p-4 text-sm text-gray-100 outline-none font-mono transition-all shadow-inner ${isBelowMin ? 'border-rose-500/50 focus:border-rose-500' : !hasSufficient ? 'border-rose-500/50' : 'border-[#2B3139] focus:border-indigo-500'}`}
                    />
                    {/* Quick-select preset amounts */}
                    <div className="grid grid-cols-3 gap-1.5">
                        {PRESETS.map(p => {
                            const disabled = tradingBalance !== null && p > tradingBalance;
                            return (
                                <button
                                    key={p}
                                    disabled={disabled}
                                    onClick={() => setAmount(String(p))}
                                    className={`py-1.5 text-[9px] font-black rounded-xl border transition-all ${
                                        parsedAmount === p
                                            ? 'bg-indigo-600 border-indigo-500 text-white'
                                            : disabled
                                                ? 'border-[#2B3139] text-gray-700 cursor-not-allowed'
                                                : 'border-[#2B3139] text-gray-500 hover:border-indigo-500/40 hover:text-gray-300'
                                    }`}
                                >
                                    ${p >= 1000 ? `${p/1000}K` : p}
                                </button>
                            );
                        })}
                    </div>
                    {/* Max button */}
                    {tradingBalance !== null && tradingBalance > 0 && (
                        <button
                            onClick={() => setAmount(tradingBalance.toFixed(2))}
                            className="w-full py-1 text-[8px] font-black uppercase tracking-widest text-indigo-500 border border-indigo-500/20 rounded-xl hover:bg-indigo-500/10 transition-all"
                        >
                            Use Max — ${tradingBalance.toFixed(2)}
                        </button>
                    )}
                </div>

                {/* Potential Profit Preview */}
                {parsedAmount >= MIN_TRADE && hasSufficient && (
                    <div className="flex justify-between items-center px-3 py-2 bg-emerald-900/10 border border-emerald-500/15 rounded-xl">
                        <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest">If Profit (85%)</span>
                        <span className="text-[10px] text-emerald-400 font-black">+${potentialProfit.toFixed(2)}</span>
                    </div>
                )}

                {/* Leverage */}
                <div className="space-y-3">
                    <div className="flex justify-between text-[9px] text-gray-500 font-black uppercase tracking-widest px-1">
                        <span>Leverage</span>
                        <span className="text-indigo-400">{leverage}x</span>
                    </div>
                    <input type="range" min="1" max="100" value={leverage} onChange={(e) => setLeverage(parseInt(e.target.value))} className="w-full h-1.5 bg-[#2B3139] rounded-full appearance-none cursor-pointer accent-indigo-500" />
                    <div className="flex justify-between text-[7px] text-gray-600 font-black uppercase">
                        <span>1x</span><span>50x</span><span>100x</span>
                    </div>
                </div>

                {/* Duration */}
                <div className="space-y-2">
                    <label className="text-[9px] text-gray-500 font-black uppercase tracking-widest ml-1">Settlement</label>
                    <div className="grid grid-cols-3 gap-2">
                        {[30, 60, 120].map(s => (
                            <button key={s} onClick={() => setDuration(s)} className={`py-2.5 text-[10px] font-black rounded-xl border transition-all ${duration === s ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' : 'border-[#2B3139] text-gray-500 hover:border-gray-600'}`}>
                                {s}s
                            </button>
                        ))}
                    </div>
                </div>

                {/* Status / Trade Buttons */}
                <div className="flex flex-col space-y-3 pt-1">
                    {tradeStatus && (
                      <div className={`text-[9px] font-black uppercase tracking-widest text-center px-3 py-2 rounded-xl border ${tradeStatus.ok ? 'bg-emerald-900/30 border-emerald-500/30 text-emerald-400' : 'bg-rose-900/30 border-rose-500/30 text-rose-400'}`}>
                        {tradeStatus.msg}
                      </div>
                    )}
                    <button
                        onClick={() => executeTrade('up')}
                        disabled={!canTrade}
                        className={`group relative w-full py-4 text-white rounded-[20px] font-black uppercase text-xs tracking-[0.2em] shadow-xl transition-all active:scale-95 overflow-hidden ${canTrade ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-emerald-900/30 cursor-not-allowed text-emerald-900'}`}
                    >
                        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                        <span className="relative z-10">BUY / LONG ↑</span>
                    </button>
                    <button
                        onClick={() => executeTrade('down')}
                        disabled={!canTrade}
                        className={`group relative w-full py-4 text-white rounded-[20px] font-black uppercase text-xs tracking-[0.2em] shadow-xl transition-all active:scale-95 overflow-hidden ${canTrade ? 'bg-rose-600 hover:bg-rose-500' : 'bg-rose-900/30 cursor-not-allowed text-rose-900'}`}
                    >
                        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                        <span className="relative z-10">SELL / SHORT ↓</span>
                    </button>
                </div>

                {/* Recent settled trades */}
                {userSettled.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                        <div className="text-[8px] text-gray-600 font-black uppercase tracking-widest px-1">Recent Results</div>
                        {userSettled.map(t => {
                            const isWin = t.status === 'won';
                            return (
                                <div key={t.id} className={`flex items-center justify-between px-3 py-2 rounded-xl border text-[9px] font-black ${isWin ? 'bg-emerald-900/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-900/10 border-rose-500/20 text-rose-400'}`}>
                                    <span>{t.symbol} · {t.duration}s</span>
                                    <span>{isWin ? '+' : ''}{t.pnl !== undefined ? `$${Math.abs(t.pnl).toFixed(2)}` : t.status.toUpperCase()}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="p-4 bg-[#0B0E11] border-t border-[#2B3139] shrink-0">
                <div className="flex items-center justify-between text-[7px] text-gray-600 font-black uppercase tracking-widest">
                    <span>Fee: 0%</span>
                    <span>Geko Mainnet</span>
                </div>
            </div>
        </div>

        {/* Dynamic AI Sidebar Overlay */}
        {showAI && (
            <div className="w-96 border-l border-[#2B3139] bg-[#181C25]/95 backdrop-blur-md z-40 animate-in slide-in-from-right absolute right-0 top-0 bottom-0 shadow-[-20px_0_50px_rgba(0,0,0,0.5)]">
                <GeminiAdvisor 
                    symbol={selectedSymbol} 
                    data={marketData} 
                />
                <button 
                    onClick={() => setShowAI(false)}
                    className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        )}
      </div>

      {/* Asset Selector Modal */}
      {isAssetSelectorOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="absolute inset-0" onClick={() => setIsAssetSelectorOpen(false)} />
          <div className="relative w-full max-w-2xl bg-[#181C25] border border-[#2B3139] rounded-[48px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-8 border-b border-[#2B3139] bg-[#1E2329] flex justify-between items-center">
                <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Market Index</h2>
                <button onClick={() => setIsAssetSelectorOpen(false)} className="p-2 hover:bg-[#2B3139] rounded-full transition-colors">
                    <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4 custom-scrollbar">
                {assets.map((asset) => (
                    <button 
                        key={asset.symbol}
                        onClick={() => {
                            setSelectedSymbol(asset.symbol);
                            setIsAssetSelectorOpen(false);
                        }}
                        className={`flex items-center justify-between p-6 rounded-3xl border transition-all hover:scale-[1.02] ${
                            selectedSymbol === asset.symbol 
                            ? 'bg-indigo-600/20 border-indigo-500 shadow-lg shadow-indigo-500/10' 
                            : 'bg-[#0B0E11] border-[#2B3139] hover:border-gray-600'
                        }`}
                    >
                        <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-[#1E2329] rounded-2xl flex items-center justify-center font-black text-xs text-gray-400 border border-[#363C45]">
                                {asset.symbol[0]}
                            </div>
                            <div className="text-left">
                                <div className="text-lg font-black text-gray-100">{asset.symbol}/USDT</div>
                                <div className="text-[10px] text-gray-500 uppercase font-black">{asset.name}</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-lg font-bold text-gray-100 font-mono">${asset.price.toLocaleString()}</div>
                            <div className={`text-[10px] font-black ${asset.change24h >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {asset.change24h > 0 ? '+' : ''}{asset.change24h}%
                            </div>
                        </div>
                    </button>
                ))}
            </div>
            <div className="p-6 bg-[#0B0E11] border-t border-[#2B3139] text-center">
                <span className="text-[10px] text-gray-600 font-black uppercase tracking-[0.4em]">Establishing low-latency protocol link...</span>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
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
                    ${(transferDirection === 'vault_to_trade' ? vaultBalance : tradingBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                    onClick={() => setTransferAmount((transferDirection === 'vault_to_trade' ? vaultBalance : tradingBalance).toString())}
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
            </div>

            <div className="p-4 bg-[#0B0E11] border-t border-[#2B3139] text-center">
              <span className="text-[8px] text-gray-600 font-black uppercase tracking-widest">Secure Protocol Settlement Layer</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeView;
