import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  onRefreshBalances: () => void;
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
  wallet,
  onRefreshBalances
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
  const [vaultBalance, setVaultBalance] = useState<number>(() => {
    const amt = wallet?.protocolBalances?.[0]?.amount;
    return amt ? (parseFloat(amt) || 0) : 0;
  });
  const [tradingBalance, setTradingBalance] = useState<number>(() => wallet?.trading_balance || 0);
  const [balLoading, setBalLoading]     = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDirection, setTransferDirection] = useState<'vault_to_trade' | 'trade_to_vault'>('vault_to_trade');
  const [transferLoading, setTransferLoading] = useState(false);

  const [localActiveTrades, setLocalActiveTrades] = useState<ActiveTrade[]>(activeTrades || []);
  const [localSettledTrades, setLocalSettledTrades] = useState<ActiveTrade[]>([]);

  useEffect(() => {
    if (activeTrades) {
        setLocalActiveTrades(prev => {
            const serverIds = new Set(activeTrades.map(t => t.id));
            const stillLocal = prev.filter(t => !serverIds.has(t.id) && (Date.now() - t.startTime < 10000));
            return [...activeTrades, ...stillLocal];
        });
    }
  }, [activeTrades]);

  useEffect(() => {
    if (wallet) {
        setTradingBalance(wallet.trading_balance || 0);
        const vAmt = wallet.protocolBalances?.[0]?.amount;
        if (vAmt) setVaultBalance(parseFloat(vAmt) || 0);
    }
  }, [wallet?.trading_balance, wallet?.protocolBalances]);

  const parsedAmount = parseFloat(amount) || 0;
  const isBelowMin   = parsedAmount < MIN_TRADE;
  const hasSufficient = (tradingBalance || 0) >= parsedAmount;
  const canTrade      = !isBelowMin && hasSufficient && parsedAmount > 0;
  
  const leverageFactor = leverage / 10;
  const potentialProfit = parsedAmount * (1 + (PAYOUT_RATE * leverageFactor));

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
      const data = await res.json();
      if (res.ok) {
        setVaultBalance(parseFloat(data.vault_balance) || 0);
        setTradingBalance(parseFloat(data.trading_balance) || 0);
        setShowTransferModal(false);
        setTransferAmount('');
        setTradeStatus({ msg: 'Transfer Successful', ok: true });
        if (onRefreshBalances) onRefreshBalances();
      } else {
        setTradeStatus({ msg: data.error || 'Transfer failed', ok: false });
      }
    } catch (e) {
      setTradeStatus({ msg: 'Network error during transfer', ok: false });
    } finally {
      setTransferLoading(false);
      setTimeout(() => setTradeStatus(null), 3000);
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
      leverage: leverage,
      status: 'pending'
    };

    setLocalActiveTrades(prev => [...prev, newTrade]);

    if (wallet?.address) {
      try {
        const res  = await fetch('/api/execute-trade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: wallet.address,
            asset:         selectedSymbol,
            tradeSize:     amount,
            leverage,
            type:          direction === 'up' ? 'LONG' : 'SHORT',
            isDemo:        wallet.isDemo,
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

  useEffect(() => {
    const interval = setInterval(async () => {
      const now = Date.now();
      const toSettle = localActiveTrades.filter(t => (now - (t.startTime || now)) >= (t.duration * 1000));
      
      if (toSettle.length === 0) return;

      const settledIds = new Set(toSettle.map(t => t.id));
      const newlySettled: ActiveTrade[] = [];

      for (const trade of toSettle) {
        let isWin = false;
        if (trade.forceOutcome === 'win') isWin = true;
        else if (trade.forceOutcome === 'loss') isWin = false;
        else isWin = false; 

        const leverageFactor = (trade.leverage || 10) / 10;
        const pnl = isWin ? parseFloat(trade.amount) * (1 + (PAYOUT_RATE * leverageFactor)) : 0;

        if (wallet?.address) {
          try {
            const res = await fetch('/api/settle-trade', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                walletAddress: wallet.address,
                asset: trade.symbol,
                payout: isNaN(pnl) ? "0.00" : pnl.toFixed(2),
                tradeRef: trade.id,
                isDemo: wallet?.isDemo,
                status: isWin ? 'won' : 'lost'
              })
            });
            if (res.ok && isWin && !isNaN(pnl)) {
                setTradingBalance(prev => prev + pnl);
            }
          } catch (e) {
            console.error('Settlement sync failed', e);
          }
        }

        const settledTrade: ActiveTrade = {
          ...trade,
          status: isWin ? 'won' : 'lost',
          pnl: isWin ? (pnl - (parseFloat(trade.amount) || 0)) : -(parseFloat(trade.amount) || 0),
          settledAt: now
        };
        newlySettled.push(settledTrade);
      }

      setLocalSettledTrades(prev => [...newlySettled, ...prev].slice(0, 10));
      setLocalActiveTrades(prev => prev.filter(t => !settledIds.has(t.id)));
    }, 1000);

    return () => clearInterval(interval);
  }, [localActiveTrades, wallet?.address, wallet?.isDemo]);

  const userActiveTrades = localActiveTrades;
  const userSettled = localSettledTrades;

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
                    ${(selectedAsset.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
          </div>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden flex bg-[#0B0E11]">
        <div className="flex-1 relative h-full min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 relative min-h-[450px] bg-[#0B0E11]">
                <MarketChart 
                    symbol={selectedSymbol} 
                    showIndicators={showIndicators} 
                    activeTrades={localActiveTrades}
                />

                {userActiveTrades.length > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 max-h-48 bg-[#181C25]/80 backdrop-blur-md border-t border-[#2B3139] flex flex-col p-4 overflow-y-auto no-scrollbar z-20 animate-in slide-in-from-bottom-10">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Live Orders:</span>
                            <span className="text-[8px] text-gray-600 font-bold uppercase">{userActiveTrades.length} Active Settlement{userActiveTrades.length > 1 ? 's' : ''}</span>
                        </div>
                        <div className="space-y-2">
                            {userActiveTrades.map(t => (
                                <div key={t.id} className="flex items-center justify-between bg-[#0B0E11] px-5 py-3 rounded-2xl border border-[#2B3139] shadow-lg">
                                    <div className="flex items-center space-x-3">
                                        <div className={`w-2 h-2 rounded-full ${t.direction === 'up' ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`}></div>
                                        <span className={`text-[10px] font-black uppercase ${t.direction === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {t.direction === 'up' ? 'Long' : 'Short'} ${t.amount} {t.leverage ? `· ${t.leverage}x` : ''}
                                        </span>
                                    </div>
                                    <span className="text-[10px] font-mono font-bold text-indigo-400">
                                        {Math.max(0, t.duration - Math.floor((Date.now() - (t.startTime || Date.now()))/1000))}s
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>

        <div className="w-72 bg-[#181C25] border-l border-[#2B3139] shrink-0 flex flex-col z-30 shadow-2xl relative overflow-y-auto no-scrollbar">
            <div className="p-5 space-y-5 flex-1 flex flex-col">
                <div className={`rounded-2xl p-4 border ${!hasSufficient ? 'bg-rose-900/10 border-rose-500/30' : 'bg-[#0B0E11] border-[#2B3139]'}`}>
                    <div className="flex justify-between items-center mb-1">
                        <div className="text-[8px] text-gray-500 font-black uppercase tracking-widest">{wallet?.isDemo ? 'Available Balance (DEMO)' : 'Available Balance'}</div>
                        <button onClick={() => setShowTransferModal(true)} className="text-[8px] text-indigo-500 font-black uppercase hover:text-indigo-400 transition-colors">Transfer</button>
                    </div>
                    {balLoading ? (
                        <div className="h-5 w-24 bg-[#2B3139] rounded animate-pulse"></div>
                    ) : (
                        <div className={`text-xl font-black tabular-nums ${!hasSufficient ? 'text-rose-500' : 'text-gray-100'}`}>
                            ${(tradingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                    )}
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between text-[9px] text-gray-500 font-black uppercase tracking-widest px-1">
                        <span>Trade Size</span>
                        <span className="text-indigo-400">${parsedAmount.toLocaleString()}</span>
                    </div>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 font-black text-xs">$</span>
                        <input 
                            type="text" 
                            value={amount} 
                            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                            className="w-full bg-[#0B0E11] border border-[#2B3139] focus:border-indigo-500 rounded-2xl py-4 pl-8 pr-4 text-sm font-black text-gray-100 outline-none transition-all"
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {PRESETS.map(p => (
                            <button key={p} onClick={() => setAmount(p.toString())} className="py-2 text-[9px] font-black text-gray-500 bg-[#0B0E11] border border-[#2B3139] rounded-xl hover:text-gray-200 hover:border-gray-600 transition-all">
                                ${p >= 1000 ? `${p/1000}K` : p}
                            </button>
                        ))}
                    </div>
                </div>

                {parsedAmount >= MIN_TRADE && hasSufficient && (
                    <div className="flex justify-between items-center px-3 py-2 bg-emerald-900/10 border border-emerald-500/15 rounded-xl">
                        <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest">If Profit (85%)</span>
                        <span className="text-[10px] text-emerald-400 font-black">+${potentialProfit.toFixed(2)}</span>
                    </div>
                )}

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

                {userSettled.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                        <div className="text-[8px] text-gray-600 font-black uppercase tracking-widest px-1">Recent Results</div>
                        {userSettled.map(t => {
                            const isWin = t.status === 'won';
                            return (
                                <div key={t.id} className={`flex items-center justify-between px-3 py-2 rounded-xl border text-[9px] font-black ${isWin ? 'bg-emerald-900/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-900/10 border-rose-500/20 text-rose-400'}`}>
                                    <span>{t.symbol} · {t.duration}s {t.leverage ? `· ${t.leverage}x` : ''}</span>
                                    <span>{isWin ? '+' : ''}{t.pnl !== undefined ? `$${Math.abs(t.pnl).toFixed(2)}` : t.status.toUpperCase()}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>

        {showAI && (
            <div className="w-96 border-l border-[#2B3139] bg-[#181C25]/95 backdrop-blur-md z-40 animate-in slide-in-from-right absolute right-0 top-0 bottom-0 shadow-[-20px_0_50px_rgba(0,0,0,0.5)]">
                <GeminiAdvisor symbol={selectedSymbol} onAction={() => setShowAI(false)} />
            </div>
        )}
      </div>

      {isAssetSelectorOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsAssetSelectorOpen(false)}>
          <div className="bg-[#181C25] border border-[#2B3139] rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[#2B3139] flex justify-between items-center bg-[#0B0E11]/50">
                <h3 className="text-sm font-black text-gray-100 uppercase tracking-widest">Select Institutional Pair</h3>
                <button onClick={() => setIsAssetSelectorOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {assets.map(asset => (
                    <button 
                        key={asset.symbol}
                        onClick={() => { setSelectedSymbol(asset.symbol); setIsAssetSelectorOpen(false); }}
                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${selectedSymbol === asset.symbol ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' : 'bg-[#0B0E11] border-[#2B3139] hover:border-gray-600 text-gray-400'}`}
                    >
                        <div className="flex flex-col text-left">
                            <span className="text-xs font-black text-white">{asset.symbol}/USDT</span>
                            <span className="text-[10px] text-gray-500">{asset.name}</span>
                        </div>
                        <span className={`text-xs font-mono font-bold ${asset.change24h >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {asset.change24h >= 0 ? '+' : ''}{asset.change24h}%
                        </span>
                    </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {showTransferModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#181C25] border border-[#2B3139] rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl p-8">
            <div className="text-center space-y-6">
                <div className="space-y-2">
                    <h3 className="text-xl font-black text-white uppercase italic tracking-tight">Internal Asset Transfer</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Move funds between Vault and Trading Pool</p>
                </div>

                <div className="flex bg-[#0B0E11] p-1 rounded-2xl border border-[#2B3139]">
                    <button 
                        onClick={() => setTransferDirection('vault_to_trade')}
                        className={`flex-1 py-3 text-[9px] font-black uppercase rounded-xl transition-all ${transferDirection === 'vault_to_trade' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Vault → Trade
                    </button>
                    <button 
                        onClick={() => setTransferDirection('trade_to_vault')}
                        className={`flex-1 py-3 text-[9px] font-black uppercase rounded-xl transition-all ${transferDirection === 'trade_to_vault' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Trade → Vault
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between text-[8px] text-gray-500 font-black uppercase px-1">
                        <span>Source Balance</span>
                        <span className="text-gray-300">${(transferDirection === 'vault_to_trade' ? vaultBalance : tradingBalance).toLocaleString()}</span>
                    </div>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 font-black text-xs">$</span>
                        <input 
                            type="text" 
                            placeholder="0.00"
                            value={transferAmount}
                            onChange={(e) => setTransferAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                            className="w-full bg-[#0B0E11] border border-[#2B3139] focus:border-indigo-500 rounded-2xl py-5 pl-8 pr-4 text-base font-black text-gray-100 outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="flex gap-3">
                    <button onClick={() => setShowTransferModal(false)} className="flex-1 py-4 text-[10px] font-black uppercase text-gray-500 hover:text-white transition-colors">Cancel</button>
                    <button 
                        onClick={handleTransfer}
                        disabled={transferLoading || !transferAmount || parseFloat(transferAmount) <= 0}
                        className={`flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl transition-all`}
                    >
                        {transferLoading ? 'Processing...' : 'Confirm Transfer'}
                    </button>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeView;
