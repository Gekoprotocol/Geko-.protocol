
import React, { useState } from 'react';

interface ProNode {
  id: string;
  name: string;
  winRate: number;
  totalPnL: string;
  followers: number;
  assets: string[];
  risk: 'Low' | 'Medium' | 'High';
}

const NODES: ProNode[] = [
  { id: 'N-441', name: 'AlphaQuant_Slovenia', winRate: 84.2, totalPnL: '+412,042', followers: 1240, assets: ['BTC', 'ETH'], risk: 'Low' },
  { id: 'N-102', name: 'Deep_Liquidity_Bot', winRate: 72.5, totalPnL: '+1,290,115', followers: 3402, assets: ['SOL', 'XRP'], risk: 'High' },
  { id: 'N-882', name: 'MacroWave_Institutional', winRate: 68.9, totalPnL: '+84,200', followers: 512, assets: ['BTC', 'ETH', 'DOT'], risk: 'Medium' },
  { id: 'N-001', name: 'Genesis_Node', winRate: 91.0, totalPnL: '+2,400,000', followers: 12, assets: ['USDT'], risk: 'Low' },
];

export const CopyTradeView: React.FC<{ onMirror: (name: string) => void }> = ({ onMirror }) => {
  const [activeMirror, setActiveMirror] = useState<string | null>(null);

  const handleMirror = (node: ProNode) => {
    setActiveMirror(node.id);
    onMirror(node.name);
  };

  return (
    <div className="h-full p-8 lg:p-12 overflow-y-auto custom-scrollbar bg-[#0B0E11] text-gray-200">
      <div className="max-w-6xl mx-auto space-y-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-3">
            <h1 className="text-4xl font-black text-gray-100 italic uppercase tracking-tighter">Node Mirroring</h1>
            <p className="text-xs text-indigo-400 font-bold uppercase tracking-[0.3em]">Institutional Copy-Trading Engine</p>
          </div>
          <div className="flex items-center space-x-2 bg-[#181C25] border border-[#2B3139] px-4 py-2 rounded-xl">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
             <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Signals: 4,102</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {NODES.map(node => (
            <div key={node.id} className="bg-[#181C25] border border-[#2B3139] rounded-[32px] p-6 flex flex-col space-y-6 hover:border-indigo-500/50 transition-all group">
              <div className="flex justify-between items-start">
                <div className="w-12 h-12 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 font-black text-xs uppercase">
                  {node.name.substring(0, 2)}
                </div>
                <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase border ${
                  node.risk === 'Low' ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10' :
                  node.risk === 'Medium' ? 'text-amber-500 border-amber-500/20 bg-amber-500/10' :
                  'text-rose-500 border-rose-500/20 bg-rose-500/10'
                }`}>
                  {node.risk} Risk
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black text-gray-100 truncate">{node.name}</h3>
                <p className="text-[9px] text-gray-500 font-mono mt-1">Node ID: {node.id}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 py-4 border-y border-[#2B3139]">
                <div>
                   <div className="text-[8px] text-gray-500 uppercase font-black">Win Rate</div>
                   <div className="text-lg font-mono font-bold text-emerald-500">{node.winRate}%</div>
                </div>
                <div>
                   <div className="text-[8px] text-gray-500 uppercase font-black">All-Time PnL</div>
                   <div className="text-lg font-mono font-bold text-gray-200">{node.totalPnL}</div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex -space-x-2">
                   {[1,2,3].map(i => (
                     <div key={i} className="w-5 h-5 rounded-full bg-[#2B3139] border border-[#181C25] flex items-center justify-center text-[7px] font-bold text-gray-500">U</div>
                   ))}
                   <div className="text-[9px] text-gray-500 font-bold ml-4 self-center">+{node.followers}</div>
                </div>
                <div className="flex space-x-1">
                   {node.assets.map(a => (
                     <span key={a} className="text-[8px] font-black text-indigo-400 bg-indigo-900/20 px-1.5 py-0.5 rounded">{a}</span>
                   ))}
                </div>
              </div>

              <button 
                onClick={() => handleMirror(node)}
                disabled={activeMirror === node.id}
                className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                  activeMirror === node.id ? 'bg-emerald-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                }`}
              >
                {activeMirror === node.id ? 'SYNCED' : 'MIRROR NODE'}
              </button>
            </div>
          ))}
        </div>

        <div className="bg-[#181C25] border border-[#2B3139] p-8 rounded-[40px] flex flex-col md:flex-row items-center justify-between gap-8">
           <div className="space-y-2 text-center md:text-left">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter">Become a Strategy Provider</h2>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider max-w-lg">Apply for institutional verification and earn up to 15% performance fees from your mirrors.</p>
           </div>
           <button className="px-10 py-4 bg-[#2B3139] hover:bg-[#363C45] text-white font-black uppercase text-[10px] tracking-widest rounded-2xl border border-[#363C45] transition-all">Submit Application</button>
        </div>
      </div>
    </div>
  );
};
