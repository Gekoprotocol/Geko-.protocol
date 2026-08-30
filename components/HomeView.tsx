import React, { useState } from 'react';
import { WalletData, AssetInfo } from '../types';
import { Plus, DollarSign, ArrowUpRight, ArrowDownLeft, Wallet, Image as ImageIcon } from 'lucide-react';

interface HomeViewProps {
  wallet: WalletData | null;
  assets: AssetInfo[];
  onNavigate: (tab: string, action?: string) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ wallet, assets, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'tokens' | 'collectibles'>('tokens');
  const protocolBalance = wallet?.protocolBalances?.[0]?.amount || '0';
  
  // Simulated total change
  const totalChange = 4.79;

  return (
    <div className="h-full overflow-y-auto bg-[#0B0E11] text-gray-200 custom-scrollbar flex flex-col">
      <div className="flex-1 w-full max-w-lg mx-auto p-6 space-y-10 pb-32">
        
        {/* Header / Balance Section */}
        <div className="text-center pt-8 space-y-2">
            <div className="text-sm font-medium text-gray-400">Total Balance</div>
            <div className="text-5xl font-bold text-white tracking-tight">
                ${parseFloat(protocolBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className={`text-sm font-bold flex items-center justify-center gap-1 ${totalChange >= 0 ? 'text-[#10B981]' : 'text-rose-500'}`}>
                {totalChange >= 0 ? '+' : ''}{totalChange}% ($7.08)
            </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between px-2">
            <ActionButton label="Buy" icon={<Plus size={20} />} onClick={() => onNavigate('trade')} />
            <ActionButton label="Sell" icon={<DollarSign size={20} />} onClick={() => onNavigate('trade')} />
            <ActionButton label="Send" icon={<ArrowUpRight size={20} />} onClick={() => onNavigate('vault', 'transfer')} />
            <ActionButton label="Receive" icon={<ArrowDownLeft size={20} />} onClick={() => onNavigate('vault', 'deposit')} />
        </div>

        {/* Minimal Chart Placeholder (as seen in screenshots) */}
        <div className="h-24 w-full px-2">
            <div className="h-full w-full bg-gradient-to-t from-emerald-500/10 to-transparent rounded-2xl relative overflow-hidden flex items-end">
                <svg className="w-full h-12 text-[#10B981] opacity-50" viewBox="0 0 100 20" preserveAspectRatio="none">
                    <path d="M0 15 Q 25 5, 50 15 T 100 10" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
            </div>
        </div>

        {/* Tabs */}
        <div className="space-y-4">
            <div className="flex border-b border-white/5 px-2">
                <button 
                    onClick={() => setActiveTab('tokens')}
                    className={`pb-3 text-sm font-bold tracking-tight transition-all relative ${activeTab === 'tokens' ? 'text-white' : 'text-gray-500'}`}
                >
                    Tokens
                    {activeTab === 'tokens' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full"></div>}
                </button>
                <button 
                    onClick={() => setActiveTab('collectibles')}
                    className={`ml-6 pb-3 text-sm font-bold tracking-tight transition-all relative ${activeTab === 'collectibles' ? 'text-white' : 'text-gray-500'}`}
                >
                    Collectibles
                    {activeTab === 'collectibles' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full"></div>}
                </button>
            </div>

            {/* Asset List */}
            <div className="space-y-1">
                {activeTab === 'tokens' ? (
                    assets.slice(0, 8).map((asset) => (
                        <div 
                            key={asset.symbol}
                            onClick={() => onNavigate('trade')}
                            className="flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-colors cursor-pointer group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-[#181C25] rounded-full flex items-center justify-center border border-white/5 group-hover:border-white/10">
                                    <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-[10px] font-black italic">
                                        {asset.symbol[0]}
                                    </div>
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-white">{asset.name}</span>
                                    <span className="text-xs text-gray-500 font-medium">1 {asset.symbol}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-bold text-white">${asset.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                <div className={`text-xs font-bold ${asset.change24h >= 0 ? 'text-[#10B981]' : 'text-rose-500'}`}>
                                    {asset.change24h >= 0 ? '+' : ''}{asset.change24h}%
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-20 space-y-4">
                        <div className="w-16 h-16 bg-[#181C25] rounded-2xl flex items-center justify-center mx-auto text-gray-600">
                            <ImageIcon size={32} />
                        </div>
                        <p className="text-sm font-medium text-gray-500 italic">No collectibles found</p>
                    </div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

const ActionButton = ({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) => (
    <button onClick={onClick} className="flex flex-col items-center gap-2 group">
        <div className="w-14 h-14 bg-[#181C25] rounded-full flex items-center justify-center text-white border border-white/5 group-hover:bg-[#2B3139] group-active:scale-95 transition-all">
            {icon}
        </div>
        <span className="text-xs font-bold text-gray-400 group-hover:text-white transition-colors">{label}</span>
    </button>
);

export default HomeView;
