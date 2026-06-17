
import React from 'react';
import { AssetInfo, MarketData } from '../types';
import MarketChart from './MarketChart';

interface GraphsViewProps {
  assets: AssetInfo[];
  selectedAsset: AssetInfo;
  marketData: MarketData[];
  setSelectedSymbol: (symbol: string) => void;
}

const GraphsView: React.FC<GraphsViewProps> = ({ assets, selectedAsset, marketData, setSelectedSymbol }) => {
  return (
    <div className="h-full flex flex-col p-6 lg:p-10 overflow-y-auto custom-scrollbar bg-[#0B0E11] text-gray-200">
      <div className="max-w-7xl mx-auto w-full space-y-8 pb-20">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 shrink-0">
          <div className="space-y-3">
            <h1 className="text-4xl font-black text-gray-100 italic uppercase tracking-tighter">Market Visualizer</h1>
            <div className="flex items-center space-x-4">
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] bg-[#181C25] px-3 py-1 rounded-lg border border-[#2B3139]">Institutional Grade Analytics</p>
                <div className="flex items-center space-x-2 bg-emerald-900/20 border border-emerald-500/20 px-3 py-1 rounded-lg">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Live Oracle Feed</span>
                </div>
            </div>
          </div>
          
          <div className="flex bg-[#181C25] p-1 rounded-2xl border border-[#2B3139] overflow-x-auto max-w-full no-scrollbar">
            {assets.slice(0, 6).map(asset => (
              <button 
                key={asset.symbol}
                onClick={() => setSelectedSymbol(asset.symbol)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  selectedAsset.symbol === asset.symbol 
                  ? 'bg-indigo-600 text-white shadow-lg' 
                  : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {asset.symbol}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-[#181C25] rounded-[40px] border border-[#2B3139] p-8 lg:p-10 shadow-2xl relative overflow-hidden group">
          <div className="relative z-10 flex flex-col space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex items-center space-x-8">
                 <div className="space-y-1">
                   <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest">{selectedAsset.symbol} Index Price</div>
                   <div className="text-5xl font-mono font-bold text-gray-100 tracking-tighter">${selectedAsset.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                 </div>
                 <div className="h-12 w-px bg-[#2B3139]"></div>
                 <div className="space-y-1">
                   <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest">24h Performance</div>
                   <div className={`text-3xl font-mono font-bold ${selectedAsset.change24h >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                     {selectedAsset.change24h >= 0 ? '+' : ''}{selectedAsset.change24h}%
                   </div>
                 </div>
              </div>
              
              <div className="flex bg-[#0B0E11] p-1.5 rounded-2xl border border-[#2B3139]">
                {['CANDLES', 'AREA', 'LINE'].map(type => (
                  <button key={type} className={`px-4 py-2 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all ${type === 'CANDLES' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:text-gray-400'}`}>
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full bg-[#0B0E11] rounded-[32px] border border-[#2B3139] overflow-hidden" style={{ height: '500px' }}>
              <MarketChart data={marketData} symbol={selectedAsset.symbol} showIndicators showVolume={true} />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
               {[
                 { label: 'RSI (14)', value: '58.42', status: 'NEUTRAL', color: 'text-indigo-400' },
                 { label: 'MACD', value: '142.12', status: 'BULLISH', color: 'text-emerald-400' },
                 { label: 'Bollinger', value: 'MID', status: 'STABLE', color: 'text-gray-400' },
                 { label: 'VWAP', value: `$${(selectedAsset.price * 0.998).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, status: 'SUPPORT', color: 'text-amber-400' }
               ].map(stat => (
                 <div key={stat.label} className="bg-[#0B0E11] border border-[#2B3139] p-5 rounded-3xl group-hover:border-[#363C45] transition-colors">
                   <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-2">{stat.label}</div>
                   <div className="flex justify-between items-end">
                     <div className="text-xl font-mono font-bold text-gray-200">{stat.value}</div>
                     <div className={`text-[8px] font-black uppercase tracking-widest ${stat.color} bg-[#181C25] px-2 py-1 rounded-lg border border-white/5`}>{stat.status}</div>
                   </div>
                 </div>
               ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GraphsView;
