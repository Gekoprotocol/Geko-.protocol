
import React, { useMemo } from 'react';
import { LiveTx } from '../types';

interface LiveFeedProps {
  transactions: LiveTx[];
}

const LiveFeed: React.FC<LiveFeedProps> = ({ transactions }) => {
  const stats = useMemo(() => {
    const buys = transactions.filter(t => t.type === 'buy');
    const sells = transactions.filter(t => t.type === 'sell');
    const total = transactions.length || 1;
    return {
      buyPercent: (buys.length / total) * 100,
      sellPercent: (sells.length / total) * 100,
      buyVol: buys.reduce((acc, curr) => acc + curr.amountUsd, 0),
      sellVol: sells.reduce((acc, curr) => acc + curr.amountUsd, 0),
    };
  }, [transactions]);

  return (
    <div className="flex flex-col h-full bg-[#181C25] overflow-hidden font-mono border-l border-[#2B3139]">
      <div className="p-4 border-b border-[#2B3139] bg-[#1E2329] shrink-0">
        <div className="flex items-center justify-between mb-2">
           <div className="flex items-center space-x-2">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Global Order Flow</span>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
           </div>
        </div>
        <div className="h-1 w-full bg-[#0B0E11] rounded-full overflow-hidden flex">
           <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${stats.buyPercent}%` }}></div>
           <div className="h-full bg-rose-500 transition-all duration-700" style={{ width: `${stats.sellPercent}%` }}></div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#181C25] sticky top-0 z-10 border-b border-[#2B3139]">
            <tr className="text-[8px] font-black text-gray-500 uppercase tracking-widest">
              <th className="pl-6 py-3">Time</th>
              <th className="px-4 py-3">Side</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Size</th>
              <th className="pr-6 py-3 text-right">Node</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2B3139]">
            {transactions.map((tx) => (
              <tr key={tx.id} className="group hover:bg-[#262B36] transition-colors text-[10px]">
                <td className="pl-6 py-2.5 text-gray-500 whitespace-nowrap">
                   {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </td>
                <td className="px-4 py-2.5">
                   <span className={`font-black uppercase italic ${tx.type === 'buy' ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {tx.type}
                   </span>
                </td>
                <td className="px-4 py-2.5 text-right font-bold text-gray-300">
                   ${tx.price.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right font-black text-indigo-400">
                   ${tx.amountUsd.toLocaleString()}
                </td>
                <td className="pr-6 py-2.5 text-right text-indigo-500/80 italic font-bold">
                   @{tx.userName}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LiveFeed;
