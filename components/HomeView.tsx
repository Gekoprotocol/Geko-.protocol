import React, { useState } from 'react';
import { WalletData, AssetInfo } from '../types';
import { Plus, Minus, ArrowUpRight, ArrowDownLeft, Wallet, Image as ImageIcon, Globe, ChevronRight } from 'lucide-react';

interface HomeViewProps {
  wallet: WalletData | null;
  assets: AssetInfo[];
  onNavigate: (tab: string, action?: string) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ wallet, assets, onNavigate }) => {
  return (
    <div className="h-full overflow-y-auto bg-black text-white custom-scrollbar flex flex-col font-sans">
      <div className="flex-1 w-full max-w-md mx-auto p-6 space-y-12 pb-32 pt-16">
        
        {/* Network Badge */}
        <div className="flex justify-center">
            <div className="flex items-center gap-2 bg-[#1A1A1A] px-3 py-1.5 rounded-full border border-white/5 shadow-xl">
                <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse shadow-[0_0_8px_#10B981]"></div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Solana Mainnet</span>
            </div>
        </div>

        {/* Home Title */}
        <div className="text-center space-y-2 pt-4">
            <h1 className="text-5xl font-black italic uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-600">
                Trade Like A Pro
            </h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.4em]">High Performance Node</p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex justify-center gap-6 px-4">
            <button 
                onClick={() => onNavigate('assets', 'deposit')}
                className="flex-1 bg-[#1A1A1A] border border-white/5 hover:border-emerald-500/50 p-6 rounded-[32px] flex flex-col items-center gap-3 transition-all group active:scale-95 shadow-2xl"
            >
                <div className="w-14 h-14 bg-emerald-600/10 rounded-2xl flex items-center justify-center text-emerald-500 border border-emerald-500/20 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                    <Plus size={28} />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-gray-300">Deposit</span>
            </button>

            <button 
                onClick={() => onNavigate('assets', 'withdraw')}
                className="flex-1 bg-[#1A1A1A] border border-white/5 hover:border-rose-500/50 p-6 rounded-[32px] flex flex-col items-center gap-3 transition-all group active:scale-95 shadow-2xl"
            >
                <div className="w-14 h-14 bg-rose-600/10 rounded-2xl flex items-center justify-center text-rose-500 border border-rose-500/20 group-hover:bg-rose-600 group-hover:text-white transition-all">
                    <Minus size={28} />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-gray-300">Withdraw</span>
            </button>
        </div>

        {/* Featured Markets (With Right Symbols) */}
        <div className="space-y-6 pt-4">
            <div className="flex items-center justify-between px-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Live Markets</span>
                <button onClick={() => onNavigate('pulse')} className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                    All <ChevronRight size={12} />
                </button>
            </div>

            <div className="space-y-3">
                {assets.slice(0, 10).map((asset) => (
                    <div 
                        key={asset.symbol}
                        onClick={() => onNavigate('trade')}
                        className="flex items-center justify-between p-4 bg-[#111111]/50 border border-white/5 hover:bg-[#1A1A1A] rounded-[24px] transition-all cursor-pointer group active:scale-95"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 flex items-center justify-center relative">
                                {asset.symbol === 'BTC' ? (
                                    <div className="w-10 h-10 bg-[#F7931A] rounded-full flex items-center justify-center text-white font-black text-xl shadow-[0_0_15px_rgba(247,147,26,0.3)]">₿</div>
                                ) : asset.symbol === 'ETH' ? (
                                    <div className="w-10 h-10 bg-[#627EEA] rounded-full flex items-center justify-center text-white font-black text-xl shadow-[0_0_15px_rgba(98,126,234,0.3)]">Ξ</div>
                                ) : asset.symbol === 'SOL' ? (
                                    <div className="w-10 h-10 bg-gradient-to-br from-[#14F195] to-[#9945FF] rounded-full flex items-center justify-center text-black font-black text-xl shadow-[0_0_15px_rgba(20,241,149,0.3)]">S</div>
                                ) : (
                                    <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-black text-xl shadow-[0_0_15px_rgba(79,70,229,0.3)]">{asset.symbol[0]}</div>
                                )}
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-white text-base">{asset.name}</span>
                                <span className="text-[11px] text-gray-500 font-bold uppercase tracking-tighter">{asset.symbol}/USDT</span>
                            </div>
                        </div>
                        <div className="text-right flex flex-col items-end">
                            <span className="font-bold text-white text-base">${asset.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            <span className={`text-[11px] font-bold ${asset.change24h >= 0 ? 'text-[#10B981]' : 'text-rose-500'}`}>
                                {asset.change24h >= 0 ? '+' : ''}{asset.change24h}%
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
};

export default HomeView;
