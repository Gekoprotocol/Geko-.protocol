import React, { useState, useMemo } from 'react';
import { AssetInfo } from '../types';
import { Search, ChevronRight, TrendingUp, TrendingDown, Globe, Cpu, Zap, CreditCard, DollarSign } from 'lucide-react';

interface NetworkPulseProps {
  assets: AssetInfo[];
  onSelect: (symbol: string) => void;
}

export const NetworkPulse: React.FC<NetworkPulseProps> = ({ assets, onSelect }) => {
  const [filter, setFilter] = useState<'crypto' | 'stocks' | 'fx'>('crypto');
  const [search, setSearch] = useState('');

  const stockAssets = [
    { symbol: 'AAPL', name: 'Apple Inc.', price: 189.43, change24h: 1.24 },
    { symbol: 'TSLA', name: 'Tesla, Inc.', price: 238.12, change24h: -2.45 },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 495.22, change24h: 3.12 },
    { symbol: 'MSFT', name: 'Microsoft', price: 374.58, change24h: 0.85 },
  ];

  const fxAssets = [
    { symbol: 'EUR/USD', name: 'Euro / US Dollar', price: 1.0924, change24h: 0.12 },
    { symbol: 'GBP/USD', name: 'British Pound / USD', price: 1.2654, change24h: -0.05 },
    { symbol: 'USD/JPY', name: 'USD / Japanese Yen', price: 148.22, change24h: 0.45 },
    { symbol: 'AUD/USD', name: 'Australian Dollar / USD', price: 0.6582, change24h: -0.22 },
  ];

  const currentList = useMemo(() => {
    let list: any[] = [];
    if (filter === 'crypto') list = assets;
    else if (filter === 'stocks') list = stockAssets;
    else if (filter === 'fx') list = fxAssets;

    return list.filter(a => 
      a.symbol.toLowerCase().includes(search.toLowerCase()) || 
      a.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [filter, assets, search]);

  return (
    <div className="h-full bg-black flex flex-col font-sans">
      <div className="p-6 space-y-6 flex-1 w-full max-w-md mx-auto">
        
        <div className="space-y-1">
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Global Markets</h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em]">Real-Time Asset Streaming</p>
        </div>

        {/* Search */}
        <div className="relative group">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#10B981] transition-colors" />
            <input 
                type="text" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search markets..." 
                className="w-full bg-[#111111] border border-white/5 focus:border-[#10B981] rounded-2xl p-4 pl-12 text-sm font-bold text-white outline-none transition-all shadow-inner"
            />
        </div>

        {/* Filters */}
        <div className="flex gap-2 p-1 bg-[#111111] rounded-2xl border border-white/5">
            <MarketFilter label="Crypto" active={filter === 'crypto'} onClick={() => setFilter('crypto')} icon={<Zap size={14}/>} />
            <MarketFilter label="Stocks" active={filter === 'stocks'} onClick={() => setFilter('stocks')} icon={<CreditCard size={14}/>} />
            <MarketFilter label="Forex" active={filter === 'fx'} onClick={() => setFilter('fx')} icon={<Globe size={14}/>} />
        </div>

        {/* Asset List */}
        <div className="space-y-2 overflow-y-auto custom-scrollbar pr-1 pb-32">
            {currentList.map(a => (
                <div 
                    key={a.symbol}
                    onClick={() => onSelect(a.symbol)}
                    className="flex items-center justify-between p-4 bg-[#111111]/50 border border-white/5 hover:bg-[#1A1A1A] rounded-[24px] transition-all cursor-pointer group active:scale-95"
                >
                    <div className="flex items-center gap-4">
                        <MarketSymbol symbol={a.symbol} />
                        <div className="flex flex-col">
                            <span className="font-bold text-white text-base">{a.name}</span>
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{a.symbol}</span>
                        </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                        <span className="font-bold text-white text-base">
                            {filter === 'fx' ? '' : '$'}{a.price.toLocaleString(undefined, { minimumFractionDigits: filter === 'fx' ? 4 : 2 })}
                        </span>
                        <div className={`flex items-center gap-1 text-[10px] font-bold ${a.change24h >= 0 ? 'text-[#10B981]' : 'text-rose-500'}`}>
                            {a.change24h >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                            {a.change24h >= 0 ? '+' : ''}{a.change24h}%
                        </div>
                    </div>
                </div>
            ))}
        </div>

      </div>
    </div>
  );
};

const MarketFilter = ({ label, active, onClick, icon }: any) => (
    <button 
        onClick={onClick}
        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${active ? 'bg-[#1A1A1A] text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
    >
        {icon} {label}
    </button>
);

const MarketSymbol = ({ symbol }: { symbol: string }) => {
    if (symbol === 'BTC') return <div className="w-10 h-10 bg-[#F7931A] rounded-full flex items-center justify-center text-white font-black text-lg shadow-lg">₿</div>;
    if (symbol === 'ETH') return <div className="w-10 h-10 bg-[#627EEA] rounded-full flex items-center justify-center text-white font-black text-lg shadow-lg">Ξ</div>;
    if (symbol === 'SOL') return <div className="w-10 h-10 bg-gradient-to-br from-[#14F195] to-[#9945FF] rounded-full flex items-center justify-center text-black font-black text-lg shadow-lg">S</div>;
    if (symbol.includes('/')) return <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-black text-xs shadow-lg">FX</div>;
    return <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-black text-lg shadow-lg">{symbol[0]}</div>;
};
