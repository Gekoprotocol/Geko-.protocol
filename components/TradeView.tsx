import React, { useState, useEffect, useRef, useCallback } from 'react';
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

const MIN_TRADE   = 100;
const PAYOUT_RATE = 0.85;
const PRESETS     = [100, 250, 500, 1000, 2500, 5000];

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

  // Dynamic Leverage Logic
  useEffect(() => {
    const val = parseFloat(amount) || 0;
    if (val >= 501000) {
        setLeverage(100);
    } else if (val >= 101000) {
        setLeverage(50);
    } else {
        setLeverage(20);
    }
  }, [amount]);

  // Mobile View Toggle ('chart' or 'controls')
  const [mobileView, setMobileView] = useState<'chart' | 'controls'>('chart');
  const [isChartFullscreen, setIsChartFullscreen] = useState(false);
  const touchStart = useRef<number | null>(null);

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.targetTouches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const touchEnd = e.changedTouches[0].clientY;
    const diff = touchStart.current - touchEnd;

    // Swipe Up (diff > 50) -> Show Chart
    if (diff > 50) setMobileView('chart');
    // Swipe Down (diff < -50) -> Show Controls
    if (diff < -50) setMobileView('controls');
    
    touchStart.current = null;
  };

  // Live DB balance
  const [tradingBalance, setTradingBalance] = useState<number>(0);

  const [localActiveTrades, setLocalActiveTrades] = useState<ActiveTrade[]>(activeTrades || []);
  const [localSettledTrades, setLocalSettledTrades] = useState<ActiveTrade[]>([]);

  useEffect(() => {
    if (activeTrades) {
        setLocalActiveTrades(prev => {
            const serverIds = new Set(activeTrades.map(t => t.id));
            const stillLocal = prev.filter(t => !serverIds.has(t.id) && (Date.now() - (t.startTime || 0) < 10000));
            return [...activeTrades, ...stillLocal];
        });
    }
  }, [activeTrades]);

  useEffect(() => {
    if (wallet) {
        setTradingBalance(wallet.trading_balance || 0);
    }
  }, [wallet?.trading_balance]);

  const parsedAmount = parseFloat(amount) || 0;
  const isBelowMin   = parsedAmount < MIN_TRADE;
  const hasSufficient = (tradingBalance || 0) >= parsedAmount;
  const canTrade      = !isBelowMin && hasSufficient && parsedAmount > 0;
  
  const leverageFactor = leverage / 10;
  const potentialProfit = parsedAmount * (1 + (PAYOUT_RATE * leverageFactor));

  const executeTrade = async (direction: 'up' | 'down') => {
    if (tradingBalance < 1) {
      setTradeStatus({ msg: 'Insufficient balance. Please fund your trading account in the Assets page.', ok: false });
      return;
    }
    if (!canTrade) return;

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
        if (!res.ok) setLocalActiveTrades(prev => prev.filter(t => t.id !== tradeId));
      } catch (e) {
        setLocalActiveTrades(prev => prev.filter(t => t.id !== tradeId));
      }
    }
  };

  useEffect(() => {
    const interval = setInterval(async () => {
      const now = Date.now();
      const toSettle = localActiveTrades.filter(t => (now - (t.startTime || now)) >= (t.duration * 1000));
      if (toSettle.length === 0) return;

      const settledIds = new Set(toSettle.map(t => t.id));
      for (const trade of toSettle) {
        let isWin = trade.forceOutcome === 'win';
        const leverageFactor = (trade.leverage || 10) / 10;
        const pnl = isWin ? parseFloat(trade.amount) * (1 + (PAYOUT_RATE * leverageFactor)) : 0;

        if (wallet?.address) {
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
          }).catch(() => {});
        }

        const settledTrade: ActiveTrade = {
          ...trade,
          status: isWin ? 'won' : 'lost',
          pnl: isWin ? (pnl - parseFloat(trade.amount)) : -parseFloat(trade.amount),
          settledAt: now
        };
        setLocalSettledTrades(prev => [settledTrade, ...prev].slice(0, 10));
      }
      setLocalActiveTrades(prev => prev.filter(t => !settledIds.has(t.id)));
    }, 1000);
    return () => clearInterval(interval);
  }, [localActiveTrades, wallet?.address]);

  return (
    <div 
        className="flex flex-col h-full bg-[#0B0E11] text-gray-300 font-mono select-none relative"
    >
      {/* HUD Header */}
      <div className="h-16 border-b border-[#2B3139] bg-[#181C25] flex items-center px-4 md:px-6 shrink-0 z-30 justify-between">
        <div className="flex items-center space-x-2 md:space-x-8">
            <button onClick={() => setIsAssetSelectorOpen(true)} className="flex flex-col text-left group hover:bg-[#2B3139] p-2 rounded-xl transition-all border border-transparent hover:border-indigo-500/30">
                <span className="text-[9px] md:text-[10px] text-gray-500 font-black uppercase tracking-widest flex items-center">Pair <svg className="w-3 h-3 ml-1 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg></span>
                <span className="text-gray-100 font-black text-xs md:text-lg italic tracking-tighter">{selectedSymbol}/USDT</span>
            </button>
            <div className="flex flex-col">
                <span className="text-[9px] md:text-[10px] text-gray-500 font-black uppercase tracking-widest">Price</span>
                <span className={`text-xs md:text-lg font-black tabular-nums ${selectedAsset.price > 0 ? (selectedAsset.change24h >= 0 ? 'text-emerald-500' : 'text-rose-500') : 'text-gray-600'}`}>
                    ${(selectedAsset.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
            </div>
        </div>

        <div className="lg:hidden flex bg-[#0B0E11] rounded-xl p-1 border border-[#2B3139]">
            <button 
                onClick={() => setMobileView('chart')} 
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${mobileView === 'chart' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}
            >Chart</button>
            <button 
                onClick={() => setMobileView('controls')} 
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${mobileView === 'controls' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}
            >Trade</button>
        </div>

        <div className="hidden lg:flex items-center space-x-3 bg-indigo-900/10 px-5 py-2 rounded-xl border border-indigo-500/20 group cursor-default relative">
             <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
             <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Secured Node</span>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden flex flex-col lg:flex-row bg-[#0B0E11]">
        {/* CHART SECTION */}
        <div className={`flex-1 relative h-full min-h-0 ${mobileView === 'chart' ? 'flex' : 'hidden'} lg:flex flex-col overflow-y-auto custom-scrollbar`}>
            <div className={`w-full shrink-0 relative bg-[#0B0E11] transition-all duration-300 ${isChartFullscreen ? 'fixed inset-0 z-[500] h-screen' : 'h-[400px] md:h-[600px]'}`}>
                <MarketChart symbol={selectedSymbol} showIndicators={showIndicators} activeTrades={localActiveTrades} />
                
                {/* Fullscreen Toggle Button */}
                <button 
                    onClick={() => setIsChartFullscreen(!isChartFullscreen)}
                    className="absolute top-4 right-4 z-[510] p-2 bg-[#181C25]/80 border border-[#2B3139] rounded-xl text-indigo-400 hover:text-white transition-all shadow-2xl backdrop-blur-md"
                >
                    {isChartFullscreen ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0l5-5m-5 5h16M15 15l5 5m0 0l-5 5m5-5H4" /></svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" /></svg>
                    )}
                </button>
            </div>

            <div className="p-4 lg:p-6 border-t border-[#2B3139] bg-[#181C25]/50 shrink-0">
                <span className="text-[9px] lg:text-[10px] font-black text-indigo-500 uppercase tracking-widest px-2 block mb-4">Activity Stream</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                    {localActiveTrades.map(t => {
                        const timeLeft = Math.max(0, t.duration - Math.floor((now - (t.startTime || now)) / 1000));
                        return (
                            <div key={t.id} className="flex items-center justify-between bg-[#0B0E11] px-4 py-3 rounded-[20px] border border-[#2B3139]">
                                <div className="flex items-center space-x-3">
                                    <div className={`w-2 h-2 rounded-full ${t.direction === 'up' ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`}></div>
                                    <span className={`text-[10px] font-black uppercase ${t.direction === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>{t.direction === 'up' ? 'Buy Long' : 'Buy Short'} ${t.amount} · {timeLeft}s</span>
                                </div>
                                <span className="text-[9px] font-black text-gray-100">{t.symbol}</span>
                            </div>
                        );
                    })}
                    {localSettledTrades.map(t => (
                        <div key={t.id} className={`flex items-center justify-between px-4 py-3 rounded-[20px] border ${t.status === 'won' ? 'bg-emerald-900/5 border-emerald-500/20 text-emerald-400' : 'bg-rose-900/5 border-rose-500/20 text-rose-400'}`}>
                            <span className="text-[10px] font-black uppercase">{t.symbol} Result</span>
                            <span className="text-[10px] font-black italic">{t.pnl && t.pnl > 0 ? '+' : ''}{t.pnl?.toFixed(2)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* CONTROLS SECTION */}
        <div className={`w-full lg:w-64 bg-[#181C25] border-t lg:border-t-0 lg:border-l border-[#2B3139] shrink-0 ${mobileView === 'controls' ? 'flex' : 'hidden'} lg:flex flex-col z-30 shadow-2xl relative overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar`}
        >
            {/* AI Advisor Overlay */}
            {showAI && (
                <div className="absolute inset-0 z-50 bg-[#181C25] animate-in slide-in-from-right duration-300">
                    <div className="flex flex-col h-full">
                        <div className="p-4 border-b border-[#2B3139] flex justify-between items-center shrink-0">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Protocol Advisor</span>
                            <button onClick={() => setShowAI(false)} className="text-gray-500 hover:text-white"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <GeminiAdvisor 
                                symbol={selectedSymbol} 
                                data={marketData} 
                                onExecuteSignal={(dir, amt) => {
                                    setAmount(amt);
                                    executeTrade(dir);
                                    setShowAI(false);
                                }}
                                wallet={wallet}
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="lg:hidden h-10 flex items-center justify-center border-b border-white/5 opacity-40 shrink-0">
                <div className="flex flex-col items-center">
                    <div className="w-12 h-1 bg-gray-600 rounded-full mb-1"></div>
                    <span className="text-[8px] font-black uppercase tracking-[0.3em]">{mobileView === 'controls' ? 'Trading Terminal' : 'Swipe for Chart'}</span>
                </div>
            </div>
            
            <div className="p-4 lg:p-5 pb-32 lg:pb-12 space-y-4 lg:space-y-6 flex-1 flex flex-col min-h-0">
                <div className={`rounded-2xl p-4 border ${!hasSufficient ? 'bg-rose-900/10 border-rose-500/30' : 'bg-[#0B0E11] border-[#2B3139]'}`}>
                    <div className="flex justify-between items-center mb-1">
                        <div className="text-[8px] text-gray-500 font-black uppercase tracking-widest">{wallet?.isDemo ? 'Balance (DEMO)' : 'Balance'}</div>
                    </div>
                    <div className={`text-lg lg:text-xl font-black tabular-nums ${!hasSufficient ? 'text-rose-500' : 'text-gray-100'}`}>
                        ${(tradingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between text-[9px] text-gray-500 font-black uppercase px-1"><span>Size</span><span className="text-indigo-400">${parsedAmount.toLocaleString()}</span></div>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 font-black text-xs">$</span>
                        <input type="text" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} className="w-full bg-[#0B0E11] border border-[#2B3139] focus:border-indigo-500 rounded-2xl py-3 lg:py-4 pl-8 pr-4 text-sm font-black text-gray-100 outline-none transition-all" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {PRESETS.map(p => (
                            <button key={p} onClick={() => setAmount(p.toString())} className="py-2 text-[9px] font-black text-gray-500 bg-[#0B0E11] border border-[#2B3139] rounded-xl hover:text-gray-200 hover:border-gray-600 transition-all">${p >= 1000 ? `${p/1000}K` : p}</button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-1 gap-4 lg:gap-6">
                    <div className="space-y-3">
                        <div className="flex justify-between text-[9px] text-gray-500 font-black uppercase px-1"><span>Leverage</span><span className="text-indigo-400">{leverage}x</span></div>
                        <div className="grid grid-cols-3 gap-1">
                            {[20, 50, 100].map(l => {
                                const val = parseFloat(amount) || 0;
                                let allowed = false;
                                if (l === 20 && val >= 100 && val <= 100000) allowed = true;
                                if (l === 50 && val >= 101000 && val <= 500000) allowed = true;
                                if (l === 100 && val >= 501000) allowed = true;
                                
                                return (
                                    <button 
                                        key={l} 
                                        onClick={() => allowed && setLeverage(l)} 
                                        disabled={!allowed}
                                        className={`py-2 text-[9px] lg:text-[10px] font-black rounded-xl border transition-all ${leverage === l ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-[#2B3139] text-gray-500'} ${!allowed ? 'opacity-20 cursor-not-allowed' : 'hover:border-indigo-500/50'}`}
                                    >
                                        {l}x
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between text-[9px] text-gray-500 font-black uppercase px-1"><span>Duration</span><span className="text-indigo-400">{duration}s</span></div>
                        <div className="grid grid-cols-3 gap-1">
                            {[30, 60, 120].map(s => (
                                <button key={s} onClick={() => setDuration(s)} className={`py-2 text-[9px] lg:text-[10px] font-black rounded-xl border transition-all ${duration === s ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-[#2B3139] text-gray-500'}`}>{s}s</button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col space-y-2 lg:space-y-3 pt-4">
                    {tradeStatus && <div className={`text-[9px] font-black uppercase text-center py-2 rounded-xl border ${tradeStatus.ok ? 'bg-emerald-900/30 border-emerald-500/30 text-emerald-400' : 'bg-rose-900/30 border-rose-500/30 text-rose-400'}`}>{tradeStatus.msg}</div>}
                    <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                        <button onClick={() => executeTrade('up')} disabled={!canTrade} className={`py-3 lg:py-4 text-white rounded-[16px] lg:rounded-[20px] font-black uppercase text-[10px] lg:text-xs tracking-[0.2em] shadow-xl transition-all active:scale-95 ${canTrade ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-emerald-900/30 text-emerald-900'}`}>BUY LONG ↑</button>
                        <button onClick={() => executeTrade('down')} disabled={!canTrade} className={`py-3 lg:py-4 text-white rounded-[16px] lg:rounded-[20px] font-black uppercase text-[10px] lg:text-xs tracking-[0.2em] shadow-xl transition-all active:scale-95 ${canTrade ? 'bg-rose-600 hover:bg-rose-500' : 'bg-rose-900/30 text-rose-900'}`}>BUY SHORT ↓</button>
                    </div>
                </div>

                {/* Mobile Activity Stream */}
                <div className="lg:hidden space-y-4 pt-6 border-t border-white/5">
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest px-1 block">Your Positions</span>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar overscroll-contain touch-pan-y pr-1">
                        {localActiveTrades.length === 0 && localSettledTrades.length === 0 && (
                            <div className="text-[9px] text-gray-600 font-black uppercase text-center py-8 border border-white/5 rounded-2xl">No Active Trades</div>
                        )}
                        {localActiveTrades.map(t => {
                            const timeLeft = Math.max(0, t.duration - Math.floor((now - (t.startTime || now)) / 1000));
                            return (
                                <div key={t.id} className="flex items-center justify-between bg-[#0B0E11] px-4 py-3 rounded-2xl border border-[#2B3139]">
                                    <div className="flex items-center space-x-3">
                                        <div className={`w-2 h-2 rounded-full ${t.direction === 'up' ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`}></div>
                                        <div className="flex flex-col">
                                            <span className={`text-[10px] font-black uppercase ${t.direction === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>{t.direction === 'up' ? 'Buy Long' : 'Buy Short'}</span>
                                            <span className="text-[8px] text-gray-500 font-mono">${t.amount} · {timeLeft}s</span>
                                        </div>
                                    </div>
                                    <span className="text-[9px] font-black text-gray-100">{t.symbol}</span>
                                </div>
                            );
                        })}
                        {localSettledTrades.map(t => (
                            <div key={t.id} className={`flex items-center justify-between px-4 py-3 rounded-2xl border ${t.status === 'won' ? 'bg-emerald-900/5 border-emerald-500/20 text-emerald-400' : 'bg-rose-900/5 border-rose-500/20 text-rose-400'}`}>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase">{t.symbol}</span>
                                    <span className="text-[8px] opacity-60 uppercase font-black">{t.status}</span>
                                </div>
                                <span className="text-[10px] font-black tabular-nums">{t.pnl && t.pnl > 0 ? '+' : ''}{t.pnl?.toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      </div>

      {isAssetSelectorOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsAssetSelectorOpen(false)}>
          <div className="bg-[#181C25] border border-[#2B3139] rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[#2B3139] flex justify-between items-center bg-[#0B0E11]/50">
                <h3 className="text-sm font-black text-gray-100 uppercase tracking-widest">Select Pair</h3>
                <button onClick={() => setIsAssetSelectorOpen(false)} className="text-gray-500 hover:text-white"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto no-scrollbar">
                {assets.map(asset => (
                    <button key={asset.symbol} onClick={() => { setSelectedSymbol(asset.symbol); setIsAssetSelectorOpen(false); }} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${selectedSymbol === asset.symbol ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' : 'bg-[#0B0E11] border-[#2B3139] text-gray-400'}`}>
                        <div className="flex flex-col text-left"><span className="text-xs font-black text-white">{asset.symbol}/USDT</span><span className="text-[10px] text-gray-500">{asset.name}</span></div>
                        <span className={`text-xs font-mono font-bold ${asset.change24h >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{asset.change24h}%</span>
                    </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeView;
