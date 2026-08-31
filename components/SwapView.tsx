import React, { useState, useEffect } from 'react';
import { AssetInfo, WalletData } from '../types';
import { ArrowLeftRight, ChevronDown, Shield, RefreshCw } from 'lucide-react';

interface SwapViewProps {
  assets: AssetInfo[];
  isConnected: boolean;
  wallet?: (WalletData & { pending_deposit_currency?: string, pending_deposit_amount?: number }) | null;
  onConnect: () => void;
  onSignUp: () => void;
  onSwap: (from: string, to: string, amount: string) => void;
  onDeposit: (amount: string, asset: string) => void;
  onRefreshBalances?: () => void;
  depositAddress?: string;
  protocolConfig?: any;
  protocolBalances?: { asset: string, balance: number, valueUsd?: string }[];
}

const SwapView: React.FC<SwapViewProps> = ({ 
  assets, 
  isConnected, 
  wallet, 
  onConnect, 
  onSignUp, 
  onSwap, 
  onDeposit, 
  onRefreshBalances, 
  depositAddress, 
  protocolConfig,
  protocolBalances = []
}) => {
  const [fromAsset, setFromAsset] = useState<AssetInfo | null>(null);
  const [toAsset, setToAsset] = useState<AssetInfo | null>(null);
  const [amount, setAmount] = useState('');
  const [isSwapping, setIsSwapping] = useState(false);

  useEffect(() => {
    if (assets.length >= 2) {
      if (!fromAsset) setFromAsset(assets.find(a => a.symbol === 'BTC') || assets[0]);
      if (!toAsset) setToAsset(assets.find(a => a.symbol === 'SOL') || assets[1]);
    }
  }, [assets]);

  const targetAmount = useMemo(() => {
    if (!amount || !fromAsset || !toAsset || fromAsset.price === 0) return '0.00';
    return (parseFloat(amount) * (fromAsset.price / toAsset.price)).toFixed(4);
  }, [amount, fromAsset, toAsset]);

  const handleSwap = () => {
      setIsSwapping(true);
      setTimeout(() => {
          setIsSwapping(false);
          setAmount('');
          if (onRefreshBalances) onRefreshBalances();
      }, 2000);
  };

  return (
    <div className="h-full bg-black overflow-y-auto no-scrollbar font-sans pb-32">
      <div className="w-full max-w-md mx-auto p-6 space-y-8 pt-12">
        
        <div className="text-center space-y-2">
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Quick Swap</h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em]">Zero-Fee Internal Exchange</p>
        </div>

        <div className="bg-[#111111] border border-white/5 rounded-[40px] p-6 space-y-4 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-white opacity-10 group-hover:opacity-30 transition-opacity"></div>
            
            {/* Pay Section */}
            <div className="bg-black border border-white/5 p-6 rounded-[32px] space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase text-gray-500 tracking-widest px-1">
                    <span>You Pay</span>
                    <span className="text-[#10B981]">Spot Account</span>
                </div>
                <div className="flex items-center justify-between">
                    <input 
                        type="text" 
                        value={amount}
                        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                        placeholder="0.00" 
                        className="bg-transparent text-3xl font-bold text-white outline-none w-1/2" 
                    />
                    <div className="bg-[#1A1A1A] border border-white/5 px-4 py-2 rounded-2xl flex items-center gap-2">
                        <SwapSymbol symbol={fromAsset?.symbol || 'BTC'} />
                        <span className="text-sm font-bold text-white">{fromAsset?.symbol || 'BTC'}</span>
                    </div>
                </div>
            </div>

            {/* Switch Icon */}
            <div className="flex justify-center -my-6 relative z-10">
                <button 
                    onClick={() => { const t = fromAsset; setFromAsset(toAsset); setToAsset(t); }}
                    className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black shadow-xl border-4 border-black hover:scale-110 transition-transform cursor-pointer"
                >
                    <ArrowLeftRight size={20} className="rotate-90" />
                </button>
            </div>

            {/* Receive Section */}
            <div className="bg-black border border-white/5 p-6 rounded-[32px] space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase text-gray-500 tracking-widest px-1">
                    <span>You Receive</span>
                    <span className={toAsset?.symbol === 'USDT' ? "text-[#10B981]" : "text-gray-500"}>
                        {toAsset?.symbol === 'USDT' ? "Trading Credit" : "Spot Account"}
                    </span>
                </div>
                <div className="flex items-center justify-between">
                    <input type="text" readOnly value={targetAmount} placeholder="0.00" className="bg-transparent text-3xl font-bold text-white outline-none w-1/2" />
                    <div className="bg-[#1A1A1A] border border-white/5 px-4 py-2 rounded-2xl flex items-center gap-2">
                        <SwapSymbol symbol={toAsset?.symbol || 'SOL'} />
                        <span className="text-sm font-bold text-white">{toAsset?.symbol || 'SOL'}</span>
                    </div>
                </div>
            </div>
        </div>

        <button 
            disabled={!isConnected || isSwapping || !amount}
            onClick={handleSwap}
            className="w-full py-6 bg-white text-black font-black uppercase italic tracking-[0.2em] rounded-[32px] shadow-2xl hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-20 flex items-center justify-center gap-3"
        >
            {isSwapping ? <RefreshCw size={20} className="animate-spin" /> : (isConnected ? 'Execute Exchange' : 'Connect to Swap')}
        </button>

        <div className="bg-[#111111] p-6 rounded-[32px] border border-white/5 space-y-4">
            <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Protocol Fee</span>
                <span className="text-[10px] font-black text-[#10B981] uppercase tracking-widest">0.00%</span>
            </div>
            <p className="text-[9px] text-gray-600 font-bold leading-relaxed uppercase text-center tracking-tighter">
                Assets swapped to USDT will instantly reflect in your Trading Account.
            </p>
        </div>

      </div>
    </div>
  );
};

const SwapSymbol = ({ symbol }: { symbol: string }) => {
    if (symbol === 'BTC') return <div className="w-5 h-5 bg-[#F7931A] rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg">B</div>;
    if (symbol === 'ETH') return <div className="w-5 h-5 bg-[#627EEA] rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg">Ξ</div>;
    if (symbol === 'SOL') return <div className="w-5 h-5 bg-gradient-to-br from-[#14F195] to-[#9945FF] rounded-full flex items-center justify-center text-[10px] font-bold text-black italic shadow-lg">S</div>;
    if (symbol === 'USDT') return <div className="w-5 h-5 bg-[#26A17B] rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg">₮</div>;
    return <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg">{symbol[0]}</div>;
};

export default SwapView;
