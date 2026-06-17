
import React from 'react';
import { AssetInfo } from '../types';

interface AssetListProps {
  assets: AssetInfo[];
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
}

const AssetList: React.FC<AssetListProps> = ({ assets, selectedSymbol, onSelect }) => {
  // Helper to normalize volume strings (e.g. "45B" -> 45000000000) for visual bar
  const parseVolume = (volStr: string) => {
      if (!volStr) return 0;
      let multiplier = 1;
      if (volStr.endsWith('B')) multiplier = 1_000_000_000;
      else if (volStr.endsWith('M')) multiplier = 1_000_000;
      else if (volStr.endsWith('K')) multiplier = 1_000;
      
      return parseFloat(volStr) * multiplier;
  };

  const maxVolume = Math.max(...assets.map(a => parseVolume(a.volume24h)));

  return (
    <div className="flex flex-col h-full bg-[#181C25] text-[10px] font-mono border-r border-[#2B3139]">
      <div className="h-8 flex items-center px-3 border-b border-[#2B3139] text-gray-500 uppercase font-bold bg-[#181C25]">
        Market Tickers
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <table className="w-full text-left">
          <thead className="text-[8px] text-gray-500 uppercase border-b border-[#2B3139] sticky top-0 bg-[#181C25] z-10">
            <tr>
              <th className="px-3 py-2 font-bold">Pair</th>
              <th className="px-3 py-2 font-bold text-right">Price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2B3139]">
            {assets.map((asset) => (
              <tr 
                key={asset.symbol}
                onClick={() => onSelect(asset.symbol)}
                className={`cursor-pointer hover:bg-[#262B36] transition-colors group ${selectedSymbol === asset.symbol ? 'bg-[#2B3139]/50 border-l-2 border-indigo-500' : 'border-l-2 border-transparent'}`}
              >
                <td className="px-3 py-2">
                  <div className="flex flex-col">
                    <span className="text-gray-200 font-bold group-hover:text-indigo-400 transition-colors">{asset.symbol}</span>
                    <div className="flex items-center justify-between w-full mt-0.5">
                       <span className={`text-[8px] font-bold ${asset.change24h >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                         {asset.change24h > 0 ? '+' : ''}{asset.change24h}%
                       </span>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-right relative">
                  <div className="text-gray-200 font-bold mb-0.5">
                    {asset.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  {/* Volume Intensity Bar */}
                  <div className="w-full h-0.5 bg-[#2B3139] rounded-full overflow-hidden ml-auto max-w-[60px]">
                      <div 
                        className="h-full bg-gray-500 opacity-50"
                        style={{ width: `${(parseVolume(asset.volume24h) / maxVolume) * 100}%` }}
                      ></div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AssetList;
