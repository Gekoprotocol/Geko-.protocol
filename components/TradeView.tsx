import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AssetInfo, MarketData, ActiveTrade, WalletData } from '../types';
import MarketChart from './MarketChart';
import GeminiAdvisor from './GeminiAdvisor';
import { TrendingUp, X, RefreshCw, ChevronDown, Shield, Camera, Upload } from 'lucide-react';

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
  onUpdateWallet?: (wallet: any) => void;
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
  onRefreshBalances,
  onUpdateWallet
}) => {
  const [showIndicators, setShowIndicators] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [isAssetSelectorOpen, setIsAssetSelectorOpen] = useState(false);
  const [tradeStatus, setTradeStatus] = useState<{ msg: string; ok: boolean } | null>(null);

  const [amount, setAmount]     = useState('100');
  const [duration, setDuration] = useState(60);
  const [leverage, setLeverage] = useState(20);
  const [selectedDirection, setSelectedDirection] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    const val = parseFloat(amount) || 0;
    if (val >= 501000) setLeverage(100);
    else if (val >= 101000) setLeverage(50);
    else setLeverage(20);
  }, [amount]);

  const [mobileView, setMobileView] = useState<'chart' | 'controls'>('chart');
  const [isChartFullscreen, setIsChartFullscreen] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [tradingBalance, setTradingBalance] = useState<number>(0);
  const [localActiveTrades, setLocalActiveTrades] = useState<ActiveTrade[]>(activeTrades || []);
  const [localSettledTrades, setLocalSettledTrades] = useState<ActiveTrade[]>([]);
  const [settlementNotification, setSettlementNotification] = useState<any>(null);
  const [showResultModal, setShowResultModal] = useState(false);

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
    if (wallet) setTradingBalance(wallet.trading_balance || 0);
  }, [wallet?.trading_balance]);

  const parsedAmount = parseFloat(amount) || 0;
  const isBelowMin   = parsedAmount < MIN_TRADE;
  const hasSufficient = (tradingBalance || 0) >= parsedAmount;
  const canTrade      = !isBelowMin && hasSufficient && parsedAmount > 0;
  
  const executeTrade = async (dirOverride?: 'up' | 'down') => {
    const direction = dirOverride || selectedDirection;
    if (!direction) return;
    if (tradingBalance < 1) {
      setTradeStatus({ msg: 'Insufficient funds. Please check Assets.', ok: false });
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
    setSelectedDirection(null); 

    if (wallet?.address) {
      try {
        await fetch('/api/execute-trade', {
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
      } catch (e) {}
    }
  };

  useEffect(() => {
    const interval = setInterval(async () => {
      const now = Date.now();
      const toSettle = localActiveTrades.filter(t => (now - (t.startTime || now)) >= (t.duration * 1000));
      if (toSettle.length === 0) return;

      const settledIds = new Set(toSettle.map(t => t.id));
      for (const trade of toSettle) {
        let isWin = trade.forceOutcome === 'win' || (Math.random() > 0.5);
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

        const netPnl = isWin ? (pnl - parseFloat(trade.amount)) : parseFloat(trade.amount);
        setSettlementNotification({ status: isWin ? 'won' : 'lost', amount: netPnl.toFixed(2) });
        setShowResultModal(true);

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
    <div className="flex flex-col h-full bg-[#0B0E11] text-gray-300 font-mono select-none relative overflow-y-auto">
      {showResultModal && settlementNotification && (
          <div className="fixed inset-0 z-[5000] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-6 animate-in zoom-in duration-300">
              <div className={`w-full max-w-sm p-12 rounded-[64px] border-4 text-center space-y-8 shadow-2xl ${settlementNotification.status === 'won' ? 'bg-emerald-500/10 border-emerald-500 shadow-emerald-500/20' : 'bg-rose-500/10 border-rose-500 shadow-rose-500/20'}`}>
                  <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center border-4 ${settlementNotification.status === 'won' ? 'bg-emerald-500 text-black border-emerald-400' : 'bg-rose-500 text-white border-rose-400'}`}>
                      {settlementNotification.status === 'won' ? <TrendingUp size={64} /> : <TrendingUp size={64} className="rotate-180" />}
                  </div>
                  <div className="space-y-2">
                      <h2 className={`text-4xl font-black uppercase italic tracking-tighter ${settlementNotification.status === 'won' ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {settlementNotification.status === 'won' ? 'Geko Win' : 'Geko Loss'}
                      </h2>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.4em]">Protocol Confirmed</p>
                  </div>
                  <div className="text-6xl font-black text-white tracking-tighter">
                      {settlementNotification.status === 'won' ? '+' : '-'}${settlementNotification.amount}
                  </div>
                  <button onClick={() => { setShowResultModal(false); setSettlementNotification(null); }} className={`w-full py-6 rounded-[32px] font-black uppercase tracking-widest text-lg shadow-xl ${settlementNotification.status === 'won' ? 'bg-emerald-500 text-black' : 'bg-rose-500 text-white'}`}>Close Result</button>
              </div>
          </div>
      )}

      <div className="h-16 border-b border-[#2B3139] bg-[#181C25] flex items-center px-4 md:px-6 shrink-0 z-30 justify-between">
        <div className="flex items-center space-x-2 md:space-x-8">
            <button onClick={() => setIsAssetSelectorOpen(true)} className="flex flex-col text-left group hover:bg-[#2B3139] p-2 rounded-xl transition-all">
                <span className="text-[9px] md:text-[10px] text-gray-500 font-black uppercase tracking-widest flex items-center">Pair <ChevronDown size={12} className="ml-1 text-indigo-500" /></span>
                <span className="text-gray-100 font-black text-xs md:text-lg italic tracking-tighter">{selectedSymbol}/USDT</span>
            </button>
            <div className="flex flex-col">
                <span className="text-[9px] md:text-[10px] text-gray-500 font-black uppercase tracking-widest">Price</span>
                <span className={`text-xs md:text-lg font-black tabular-nums ${selectedAsset.change24h >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    ${(selectedAsset.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
            </div>
        </div>

        <div className="hidden lg:flex items-center space-x-6">
            <div className="flex items-center gap-3 bg-amber-500/5 px-4 py-2 rounded-xl border border-amber-500/20 shadow-lg">
                <div className="relative w-10 h-10 animate-bitcoin-spin" style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}>
                    <div className="absolute inset-0 bg-[#F7931A] rounded-full flex items-center justify-center border-2 border-[#E87E04] shadow-inner shadow-black/50" style={{ transform: 'translateZ(5px)', backfaceVisibility: 'hidden' }}>
                        <span className="text-white font-black text-xl select-none drop-shadow-md">₿</span>
                    </div>
                    <div className="absolute inset-0 bg-[#F7931A] rounded-full flex items-center justify-center border-2 border-[#E87E04] shadow-inner shadow-black/50" style={{ transform: 'translateZ(-5px) rotateY(180deg)', backfaceVisibility: 'hidden' }}>
                        <span className="text-white font-black text-xl select-none drop-shadow-md">₿</span>
                    </div>
                    <div className="absolute inset-0 bg-[#E87E04] rounded-full border-4 border-[#F7931A]" style={{ transform: 'rotateX(90deg)' }}></div>
                </div>
                <div className="flex flex-col"><span className="text-[8px] text-amber-500/60 font-black uppercase tracking-widest">Protocol</span><span className="text-[10px] text-amber-500 font-black uppercase italic">Geko Mainnet</span></div>
            </div>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden flex flex-col lg:flex-row bg-[#0B0E11]">
        <div className={`flex-1 relative h-full min-h-0 ${mobileView === 'chart' ? 'flex' : 'hidden'} lg:flex flex-col overflow-y-auto`}>
            <div className={`w-full shrink-0 relative bg-[#0B0E11] transition-all duration-300 ${isChartFullscreen ? 'fixed inset-0 z-[500] h-screen' : 'h-[300px] md:h-[500px]'}`}>
                <MarketChart symbol={selectedSymbol} showIndicators={showIndicators} activeTrades={localActiveTrades} />
                <button onClick={() => setIsChartFullscreen(!isChartFullscreen)} className="absolute top-4 right-4 z-[510] p-2 bg-[#181C25]/80 border border-[#2B3139] rounded-xl text-indigo-400 hover:text-white transition-all shadow-2xl backdrop-blur-md">
                    {isChartFullscreen ? <X size={20} /> : <TrendingUp size={20} />}
                </button>
            </div>
        </div>

        <div className={`w-full lg:w-64 bg-[#181C25] border-t lg:border-t-0 lg:border-l border-[#2B3139] shrink-0 ${mobileView === 'controls' ? 'flex' : 'hidden'} lg:flex flex-col z-30 shadow-2xl overflow-y-auto pb-32 custom-scrollbar`}>
            <div className="p-4 lg:p-5 space-y-4 lg:space-y-6 flex-1 flex flex-col min-h-0">
                <div className={`rounded-2xl p-4 border ${!hasSufficient ? 'bg-rose-900/10 border-rose-500/30' : 'bg-[#0B0E11] border-[#2B3139]'}`}>
                    <div className="text-[8px] text-[#10B981] font-black uppercase mb-1">{wallet?.isDemo ? 'Demo Account' : 'Institutional Terminal'}</div>
                    <div className={`text-lg lg:text-xl font-black tabular-nums ${!hasSufficient ? 'text-rose-500' : 'text-gray-100'}`}>
                        ${(tradingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between text-[9px] text-gray-500 font-black uppercase px-1"><span>Size</span><span className="text-indigo-400">${parsedAmount.toLocaleString()}</span></div>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 font-black text-xs">$</span>
                        <input type="text" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} className="w-full bg-[#0B0E11] border border-[#2B3139] focus:border-indigo-500 rounded-2xl py-3 pl-8 text-sm font-black text-gray-100 outline-none" />
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between text-[9px] text-gray-500 font-black uppercase px-1"><span>Duration</span><span className="text-indigo-400">{duration}s</span></div>
                    <div className="grid grid-cols-3 gap-2">
                        {[15, 30, 60, 120, 300].map(d => (
                            <button key={d} onClick={() => setDuration(d)} className={`py-2 rounded-xl text-[9px] font-black border transition-all ${duration === d ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-black border-white/5 text-gray-500'}`}>{d}s</button>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between text-[9px] text-gray-500 font-black uppercase px-1"><span>Leverage</span><span className="text-[#10B981]">{leverage}x</span></div>
                    <div className="grid grid-cols-3 gap-2">
                        {[10, 20, 50, 100].map(l => (
                            <button key={l} onClick={() => setLeverage(l)} className={`py-2 rounded-xl text-[9px] font-black border transition-all ${leverage === l ? 'bg-[#10B981] border-[#10B981] text-black' : 'bg-black border-white/5 text-gray-500'}`}>{l}x</button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                    <button onClick={() => setSelectedDirection('up')} className={`py-3 rounded-[20px] font-black uppercase text-[10px] transition-all active:scale-95 ${selectedDirection === 'up' ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'bg-emerald-900/30 text-emerald-500 border border-emerald-500/20'}`}>Long ↑</button>
                    <button onClick={() => setSelectedDirection('down')} className={`py-3 rounded-[20px] font-black uppercase text-[10px] transition-all active:scale-95 ${selectedDirection === 'down' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-rose-900/30 text-rose-500 border border-rose-500/20'}`}>Short ↓</button>
                </div>
                
                <button 
                    onClick={() => executeTrade()} 
                    disabled={!canTrade || !selectedDirection} 
                    className={`w-full py-4 rounded-[20px] font-black uppercase text-[10px] tracking-[0.2em] transition-all active:scale-95 ${canTrade && selectedDirection ? 'bg-indigo-600 text-white shadow-2xl animate-pulse' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}
                >
                    Execute Trade
                </button>

                <div className="bg-[#111111] p-4 rounded-2xl border border-white/5 space-y-2">
                    <div className="flex justify-between text-[8px] font-black uppercase text-gray-500"><span>Profit</span><span className="text-[#10B981]">+85%</span></div>
                    <div className="flex justify-between text-[8px] font-black uppercase text-gray-500"><span>Risk</span><span className="text-rose-500">Variable</span></div>
                </div>

                <div className="space-y-3 pt-6">
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest px-1 block">Live Stream</span>
                    <div className="space-y-3">
                        {localActiveTrades.map(t => {
                            const timeLeft = Math.max(0, t.duration - Math.floor((now - (t.startTime || now)) / 1000));
                            return (
                                <div key={t.id} className="flex items-center justify-between bg-[#0B0E11] px-4 py-3 rounded-2xl border border-[#2B3139]">
                                    <div className="flex items-center space-x-3">
                                        <div className={`w-2 h-2 rounded-full ${t.direction === 'up' ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`}></div>
                                        <span className={`text-[9px] font-black uppercase ${t.direction === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>{t.direction === 'up' ? 'LONG' : 'SHORT'} ${t.amount} · {timeLeft}s</span>
                                    </div>
                                    <span className="text-[9px] font-black text-gray-100">{t.symbol}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
      </div>

      {isAssetSelectorOpen && (
        <div className="fixed inset-0 z-[1000] flex items-end animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsAssetSelectorOpen(false)}></div>
          <div className="relative w-full bg-[#181C25] border-t border-[#2B3139] rounded-t-[40px] p-6 max-h-[80vh] overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom duration-500">
            <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black uppercase italic tracking-tighter text-white">Select Asset</h3><button onClick={() => setIsAssetSelectorOpen(false)} className="p-2 bg-white/5 rounded-full text-gray-500"><X size={20} /></button></div>
            <div className="space-y-3">
                {assets.map(asset => (
                    <button key={asset.symbol} onClick={() => { setSelectedSymbol(asset.symbol); setIsAssetSelectorOpen(false); }} className={`w-full flex items-center justify-between p-5 rounded-[24px] border transition-all ${selectedSymbol === asset.symbol ? 'bg-indigo-600/10 border-indigo-500' : 'bg-[#0B0E11] border-[#2B3139]'}`}>
                        <div className="text-left"><div className="font-bold text-white">{asset.symbol}/USDT</div><div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{asset.name}</div></div>
                        <span className={`font-mono text-sm font-bold ${asset.change24h >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{asset.change24h}%</span>
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
