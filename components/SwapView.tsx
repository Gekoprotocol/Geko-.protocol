import React, { useState, useMemo, useEffect } from 'react';
import { AssetInfo, WalletData } from '../types';
import { ArrowLeftRight, RefreshCw, ChevronDown, Shield } from 'lucide-react';

interface SwapViewProps {
  assets: AssetInfo[];
  isConnected: boolean;
  wallet?: (WalletData & { pending_deposit_currency?: string, pending_deposit_amount?: number }) | null;
  onConnect: () => void;
  onSignUp: () => void;
  onSwap: (from: string, to: string, amount: string) => void;
  onDeposit: (amount: string, asset: string) => void;
  onRefreshBalances?: () => void;
  protocolBalances?: { asset: string, balance: number, valueUsd?: string }[];
}

export default function SwapView({ 
  assets, 
  isConnected, 
  wallet, 
  onRefreshBalances, 
  protocolBalances = []
}: SwapViewProps) {
  const [fromAsset, setFromAsset] = useState<AssetInfo | null>(null);
  const [toAsset, setToAsset] = useState<AssetInfo | null>(null);
  const [amount, setAmount] = useState('');
  const [isSwapping, setIsSwapping] = useState(false);
  const [showFromSelector, setShowFromSelector] = useState(false);
  const [showToSelector, setShowToSelector] = useState(false);
  const [swapResult, setSwapResult] = useState<{ success: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (assets.length >= 2) {
      if (!fromAsset) setFromAsset(assets.find(a => a.symbol === 'BTC') || assets[0]);
      if (!toAsset) setToAsset(assets.find(a => a.symbol === 'USDT') || assets[1]);
    }
  }, [assets]);

  const getSourceBalance = (symbol: string) => {
      const b = protocolBalances.find(pb => pb.asset === symbol);
      return b ? parseFloat(b.balance as any) : 0;
  };

  const targetAmount = useMemo(() => {
    if (!amount || !fromAsset || !toAsset || fromAsset.price === 0) return '0.00';
    const fromPrice = fromAsset.price || 1;
    const toPrice = toAsset.price || 1;
    return (parseFloat(amount) * (fromPrice / toPrice)).toFixed(6);
  }, [amount, fromAsset, toAsset]);

  const handleSwap = async () => {
      if (!amount || !fromAsset || !toAsset || !wallet?.address || isSwapping) return;
      setIsSwapping(true);
      setSwapResult(null);
      
      try {
          const isToUsdt = toAsset.symbol === 'USDT';
          const endpoint = isToUsdt ? '/api/swap-to-trading' : '/api/swap-internal';
          
          const res = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  address: wallet.address,
                  from: fromAsset.symbol,
                  to: toAsset.symbol,
                  amount: amount,
                  targetAmount: targetAmount
              })
          });

          if (res.ok) {
              setSwapResult({ success: true, msg: 'Settlement confirmed' });
              setAmount('');
              if (onRefreshBalances) onRefreshBalances();
          } else {
              setSwapResult({ success: false, msg: 'Insufficient pool liquidity' });
          }
      } catch (e) {
          setSwapResult({ success: false, msg: 'Network routing error' });
      } finally {
          setIsSwapping(false);
      }
  };

  return (
    <div className="h-full bg-black overflow-y-auto custom-scrollbar font-sans pb-32">
      <div className="w-full max-w-md mx-auto p-6 space-y-8 pt-12">
        
        <div className="text-center space-y-2">
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Gecko Swap</h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em]">Institutional Liquidity Node</p>
        </div>

        <div className="bg-[#111111] border border-white/5 rounded-[40px] p-6 space-y-4 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-white opacity-10 group-hover:opacity-30 transition-opacity"></div>
            
            {/* Pay Section */}
            <div className="bg-black border border-white/5 p-6 rounded-[32px] space-y-2 shadow-inner">
                <div className="flex justify-between text-[10px] font-black uppercase text-gray-500 tracking-widest px-1">
                    <span>From Spot Account</span>
                    <span className="text-gray-400">Bal: {getSourceBalance(fromAsset?.symbol || '').toFixed(4)}</span>
                </div>
                <div className="flex items-center justify-between">
                    <input 
                        type="text" 
                        value={amount}
                        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                        placeholder="0.00" 
                        className="bg-transparent text-3xl font-bold text-white outline-none w-1/2" 
                    />
                    <button 
                        onClick={() => setShowFromSelector(true)}
                        className="bg-[#1A1A1A] border border-white/5 px-4 py-2 rounded-2xl flex items-center gap-2 hover:bg-[#222222] transition-all"
                    >
                        <SwapSymbol symbol={fromAsset?.symbol || 'BTC'} />
                        <span className="text-sm font-bold text-white">{fromAsset?.symbol || 'BTC'}</span>
                        <ChevronDown size={14} className="text-gray-500" />
                    </button>
                </div>
            </div>

            {/* Switch Icon */}
            <div className="flex justify-center -my-6 relative z-10">
                <button 
                    onClick={() => { const t = fromAsset; setFromAsset(toAsset); setToAsset(t); }}
                    className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black shadow-xl border-4 border-black hover:scale-110 active:scale-95 transition-all cursor-pointer"
                >
                    <ArrowLeftRight size={20} className="rotate-90" />
                </button>
            </div>

            {/* Receive Section */}
            <div className="bg-black border border-white/5 p-6 rounded-[32px] space-y-2 shadow-inner">
                <div className="flex justify-between text-[10px] font-black uppercase text-gray-500 tracking-widest px-1">
                    <span>To {toAsset?.symbol === 'USDT' ? "Trading Vault" : "Spot Account"}</span>
                    <span className="text-indigo-400">AI Estimate</span>
                </div>
                <div className="flex items-center justify-between">
                    <div className="text-3xl font-bold text-gray-600 outline-none w-1/2 truncate">{targetAmount}</div>
                    <button 
                        onClick={() => setShowToSelector(true)}
                        className="bg-[#1A1A1A] border border-white/5 px-4 py-2 rounded-2xl flex items-center gap-2 hover:bg-[#222222] transition-all"
                    >
                        <SwapSymbol symbol={toAsset?.symbol || 'SOL'} />
                        <span className="text-sm font-bold text-white">{toAsset?.symbol || 'SOL'}</span>
                        <ChevronDown size={14} className="text-gray-500" />
                    </button>
                </div>
            </div>
        </div>

        {swapResult && (
            <div className={`p-4 rounded-2xl text-[10px] font-black uppercase text-center ${swapResult.success ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-rose-500/10 text-rose-500'}`}>
                {swapResult.msg}
            </div>
        )}

        <button 
            disabled={!isConnected || isSwapping || !amount}
            onClick={handleSwap}
            className="w-full py-6 bg-white text-black font-black uppercase italic tracking-[0.2em] rounded-[32px] shadow-2xl hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-20 flex items-center justify-center gap-3"
        >
            {isSwapping ? <RefreshCw size={20} className="animate-spin" /> : (isConnected ? 'Execute Exchange' : 'Connect Node')}
        </button>

        <div className="bg-[#111111] p-6 rounded-[32px] border border-white/5 space-y-4">
            <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Protocol Fee</span>
                <span className="text-[10px] font-black text-[#10B981] uppercase tracking-widest">0.00%</span>
            </div>
            <p className="text-[9px] text-gray-600 font-bold leading-relaxed uppercase text-center tracking-tighter">
                NOTICE: Assets swapped to USDT are instantly credited to your Trading Account. All other pairs reflect in your Spot Account.
            </p>
        </div>

      </div>

      <AssetSelectorModal 
        isOpen={showFromSelector} 
        onClose={() => setShowFromSelector(false)} 
        onSelect={(a: any) => { setFromAsset(a); setShowFromSelector(false); }}
        assets={assets}
        protocolBalances={protocolBalances}
      />
      <AssetSelectorModal 
        isOpen={showToSelector} 
        onClose={() => setShowToSelector(false)} 
        onSelect={(a: any) => { setToAsset(a); setShowToSelector(false); }}
        assets={assets}
        protocolBalances={protocolBalances}
      />
    </div>
  );
}

const AssetSelectorModal = ({ isOpen, onClose, onSelect, assets, protocolBalances }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[3000] flex items-end">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full bg-[#0A0A0A] border-t border-white/5 rounded-t-[40px] p-8 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom duration-500">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-black uppercase italic italic tracking-tighter text-white">Select Coin</h3>
                    <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-gray-500"><X size={20} className="text-white" /></button>
                </div>
                <div className="space-y-3">
                    {/* Add USDT explicitly since it might not be in the Binance price list */}
                    {[...assets, { symbol: 'USDT', name: 'TetherUS', price: 1 }].reduce((acc: any[], current: any) => {
                        const x = acc.find(item => item.symbol === current.symbol);
                        if (!x) return acc.concat([current]);
                        else return acc;
                    }, []).map((asset: any) => {
                        const bal = protocolBalances.find((pb: any) => pb.asset === asset.symbol)?.balance || 0;
                        return (
                            <button 
                                key={asset.symbol}
                                onClick={() => onSelect(asset)}
                                className="w-full flex items-center justify-between p-5 bg-white/5 border border-white/5 rounded-[24px] hover:bg-white/10 transition-all group"
                            >
                                <div className="flex items-center gap-4">
                                    <SwapSymbol symbol={asset.symbol} />
                                    <div className="text-left">
                                        <div className="font-bold text-white group-hover:text-[#10B981] transition-colors">{asset.symbol}</div>
                                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{asset.name || asset.symbol}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-mono text-sm text-white">{parseFloat(bal).toFixed(4)}</div>
                                    <div className="text-[8px] text-gray-600 font-black uppercase">Institutional Pool</div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const SwapSymbol = ({ symbol }: { symbol: string }) => {
    if (symbol === 'BTC') return <div className="w-5 h-5 bg-[#F7931A] rounded-full flex items-center justify-center text-[10px] font-bold text-white">B</div>;
    if (symbol === 'ETH') return <div className="w-5 h-5 bg-[#627EEA] rounded-full flex items-center justify-center text-[10px] font-bold text-white">Ξ</div>;
    if (symbol === 'SOL') return <div className="w-5 h-5 bg-gradient-to-br from-[#14F195] to-[#9945FF] rounded-full flex items-center justify-center text-[10px] font-bold text-black italic">S</div>;
    if (symbol === 'USDT') return <div className="w-5 h-5 bg-[#26A17B] rounded-full flex items-center justify-center text-[10px] font-bold text-white">₮</div>;
    return <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-[10px] font-bold text-white">{symbol[0]}</div>;
};
