import React, { useState } from 'react';
import { WalletData, AssetInfo } from '../types';
import { Plus, Minus, ArrowUpRight, ArrowDownLeft, Wallet, Image as ImageIcon, Globe } from 'lucide-react';

interface HomeViewProps {
  wallet: WalletData | null;
  assets: AssetInfo[];
  onNavigate: (tab: string, action?: string) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ wallet, assets, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'tokens' | 'collectibles'>('tokens');
  
  // Use protocol_settlement_balance or vault balance as the main figure
  const mainBalance = wallet?.protocolBalances?.[0]?.amount || '0';
  const totalChange = 4.79;

  return (
    <div className="h-full overflow-y-auto bg-black text-white custom-scrollbar flex flex-col font-sans">
      <div className="flex-1 w-full max-w-md mx-auto p-6 space-y-12 pb-32 pt-12">
        
        {/* Network Badge */}
        <div className="flex justify-center">
            <div className="flex items-center gap-2 bg-[#1A1A1A] px-3 py-1.5 rounded-full border border-white/5">
                <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Solana Mainnet</span>
            </div>
        </div>

        {/* Balance Section */}
        <div className="text-center space-y-2">
            <div className="text-6xl font-bold tracking-tight text-white">
                ${parseFloat(mainBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="flex items-center justify-center gap-1.5">
                <span className="text-sm font-bold text-[#10B981]">+{totalChange}%</span>
                <span className="text-sm font-bold text-gray-500">$7.08</span>
            </div>
        </div>

        {/* Circular Action Buttons */}
        <div className="flex justify-around items-center px-4">
            <ActionCircle label="Buy" icon={<Plus size={24} />} onClick={() => onNavigate('trade')} />
            <ActionCircle label="Sell" icon={<Minus size={24} />} onClick={() => onNavigate('trade')} />
            <ActionCircle label="Send" icon={<ArrowUpRight size={24} />} onClick={() => onNavigate('vault', 'transfer')} />
            <ActionCircle label="Receive" icon={<ArrowDownLeft size={24} />} onClick={() => onNavigate('vault', 'deposit')} />
        </div>

        {/* Minimal Sparkline Chart (matching the visual in IMG_2526) */}
        <div className="px-2 pt-4">
            <div className="h-20 w-full relative group">
                <svg className="w-full h-full text-[#10B981] drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]" viewBox="0 0 100 30" preserveAspectRatio="none">
                    <path 
                        d="M0 25 C 20 25, 40 5, 60 15 S 80 10, 100 5" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2.5" 
                        strokeLinecap="round"
                    />
                </svg>
            </div>
        </div>

        {/* Tabs: Tokens / Collectibles */}
        <div className="space-y-6 pt-4">
            <div className="flex gap-8 px-2 border-b border-white/5">
                <button 
                    onClick={() => setActiveTab('tokens')}
                    className={`pb-4 text-base font-bold transition-all relative ${activeTab === 'tokens' ? 'text-white' : 'text-gray-500'}`}
                >
                    Tokens
                    {activeTab === 'tokens' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full"></div>}
                </button>
                <button 
                    onClick={() => setActiveTab('collectibles')}
                    className={`pb-4 text-base font-bold transition-all relative ${activeTab === 'collectibles' ? 'text-white' : 'text-gray-500'}`}
                >
                    Collectibles
                    {activeTab === 'collectibles' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full"></div>}
                </button>
            </div>

            {/* Token List */}
            <div className="space-y-4">
                {activeTab === 'tokens' ? (
                    assets.map((asset) => (
                        <div 
                            key={asset.symbol}
                            onClick={() => onNavigate('trade')}
                            className="flex items-center justify-between p-2 hover:bg-[#1A1A1A] rounded-2xl transition-all cursor-pointer group active:scale-95"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-[#1A1A1A] rounded-full flex items-center justify-center border border-white/5">
                                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-xs font-black italic shadow-lg">
                                        {asset.symbol[0]}
                                    </div>
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-white text-base">{asset.name}</span>
                                    <span className="text-[11px] text-gray-500 font-bold uppercase tracking-tighter">1 {asset.symbol}</span>
                                </div>
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <span className="font-bold text-white text-base">${asset.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                <span className={`text-[11px] font-bold ${asset.change24h >= 0 ? 'text-[#10B981]' : 'text-rose-500'}`}>
                                    {asset.change24h >= 0 ? '+' : ''}{asset.change24h}%
                                </span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="py-20 flex flex-col items-center space-y-4 opacity-30">
                        <ImageIcon size={48} />
                        <span className="text-xs font-bold uppercase tracking-widest">No Collectibles</span>
                    </div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

const ActionCircle = ({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) => (
    <button onClick={onClick} className="flex flex-col items-center gap-3 group">
        <div className="w-16 h-16 bg-[#1A1A1A] rounded-full flex items-center justify-center text-white border border-white/5 group-hover:bg-[#222222] group-hover:border-white/10 group-active:scale-90 transition-all shadow-xl">
            {icon}
        </div>
        <span className="text-xs font-bold text-gray-400 group-hover:text-white transition-colors uppercase tracking-widest">{label}</span>
    </button>
);

export default HomeView;
