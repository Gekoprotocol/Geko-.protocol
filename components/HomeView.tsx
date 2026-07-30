import React from 'react';
import { WalletData, AssetInfo } from '../types';
import { TrendingUp, ArrowUpRight, ArrowDownRight, Wallet } from 'lucide-react';

interface HomeViewProps {
  wallet: WalletData | null;
  assets: AssetInfo[];
  onNavigate: (tab: string, action?: string) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ wallet, assets, onNavigate }) => {
  const protocolBalance = wallet?.protocolBalances?.[0]?.amount || '0';

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-10 bg-[#0B0E11] custom-scrollbar text-gray-200">
      <div className="max-w-7xl mx-auto space-y-12 pb-20">
        
        {/* Welcome Header */}
        <div className="space-y-1">
            <h1 className="text-4xl font-black text-gray-100 italic uppercase tracking-tighter">Protocol Overview</h1>
            {(wallet?.name || wallet?.nickname) && (
                <h2 className="text-xl font-black text-indigo-400 italic uppercase tracking-tight">
                    Hello, {wallet.name || wallet.nickname}
                </h2>
            )}
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] pt-1">Institutional Terminal Access · Live Node</p>
        </div>

        {/* Balance Section */}
        <div className="bg-[#181C25] rounded-[40px] p-10 border border-[#2B3139] shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:scale-105 transition-transform duration-1000 text-indigo-500">
                <Wallet className="w-64 h-64" />
            </div>
            <div className="relative z-10 space-y-6">
                <div className="flex items-center justify-between">
                   <div className="text-xs text-gray-500 font-bold uppercase tracking-[0.3em]">Amount you have on the protocol</div>
                   <div className="px-3 py-1 rounded-full text-[9px] font-black tracking-widest border border-emerald-500/30 bg-emerald-950/20 text-emerald-500">
                      SECURED SETTLEMENT
                   </div>
                </div>
                <div className="space-y-2">
                    <div className="text-xs text-indigo-400 font-black uppercase tracking-widest">Settlement Balance</div>
                    <div className="text-5xl md:text-6xl lg:text-7xl font-mono font-bold text-gray-100 tracking-tighter truncate">
                       ${parseFloat(protocolBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                </div>
                <div className="pt-8 flex flex-wrap gap-4">
                    <button 
                        onClick={() => onNavigate('vault')}
                        className="px-8 py-3 bg-indigo-600 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20"
                    >
                        Manage Assets
                    </button>
                    <button 
                        onClick={() => onNavigate('trade')}
                        className="px-8 py-3 bg-[#0B0E11] text-gray-300 font-black uppercase tracking-widest text-xs rounded-xl border border-[#2B3139] hover:bg-[#181C25] transition-all"
                    >
                        Quick Trade
                    </button>
                    <button 
                        onClick={() => onNavigate('vault', 'deposit')}
                        className="px-8 py-3 bg-emerald-600 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20"
                    >
                        Deposit
                    </button>
                    <button 
                        onClick={() => onNavigate('vault', 'transfer')}
                        className="px-8 py-3 bg-indigo-600/10 text-indigo-400 font-black uppercase tracking-widest text-xs rounded-xl border border-indigo-500/20 hover:bg-indigo-600/20 transition-all"
                    >
                        Transfer
                    </button>
                </div>
            </div>
        </div>

        {/* Market Performance Section */}
        <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                    <TrendingUp className="text-indigo-500" size={20} />
                    <h2 className="text-xl font-black text-gray-100 uppercase italic tracking-widest">Market Performance</h2>
                </div>
                <button 
                    onClick={() => onNavigate('visualizer')}
                    className="text-[10px] text-gray-500 font-black uppercase hover:text-indigo-400 transition-colors tracking-widest"
                >
                    View All Markets →
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {assets.slice(0, 6).map((asset) => (
                    <div 
                        key={asset.symbol}
                        onClick={() => onNavigate('trade')}
                        className="bg-[#181C25] p-6 rounded-3xl border border-[#2B3139] hover:border-indigo-500/30 transition-all cursor-pointer group"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">{asset.name}</span>
                                <span className="text-lg font-black text-gray-100 italic tracking-tight">{asset.symbol}/USDT</span>
                            </div>
                            <div className={`p-2 rounded-xl ${asset.change24h >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                {asset.change24h >= 0 ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                            </div>
                        </div>
                        <div className="flex items-end justify-between">
                            <div className="text-2xl font-mono font-bold text-gray-100">
                                ${asset.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                            <div className={`text-xs font-black ${asset.change24h >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {asset.change24h >= 0 ? '+' : ''}{asset.change24h}%
                            </div>
                        </div>
                        
                        <div className="mt-4 h-1 w-full bg-[#0B0E11] rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-1000 ${asset.change24h >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                style={{ width: `${Math.min(Math.abs(asset.change24h) * 10, 100)}%` }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-indigo-600/5 border border-indigo-500/10 p-8 rounded-[32px] flex items-center justify-between group hover:bg-indigo-600/10 transition-all cursor-pointer" onClick={() => onNavigate('swap')}>
                <div className="space-y-2">
                    <div className="text-xs font-black text-indigo-400 uppercase tracking-widest">Swap</div>
                    <div className="text-lg font-black text-gray-100 italic uppercase">Execute Instant Exchange</div>
                </div>
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                    <ArrowUpRight size={24} />
                </div>
            </div>
            <div className="bg-emerald-600/5 border border-emerald-500/10 p-8 rounded-[32px] flex items-center justify-between group hover:bg-emerald-600/10 transition-all cursor-pointer" onClick={() => onNavigate('vault')}>
                <div className="space-y-2">
                    <div className="text-xs font-black text-emerald-400 uppercase tracking-widest">Protocol Deposit</div>
                    <div className="text-lg font-black text-gray-100 italic uppercase">Fund Settlement Account</div>
                </div>
                <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                    <Plus size={24} />
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

// Simple Plus icon fallback since I forgot to import it
const Plus = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);

export default HomeView;
