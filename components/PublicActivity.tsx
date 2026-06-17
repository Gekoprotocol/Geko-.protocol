
import React from 'react';

interface ActivityMsg {
  id: string;
  user: string;
  text: string;
  timestamp: number;
}

interface PublicActivityProps {
  activities: ActivityMsg[];
}

const PublicActivity: React.FC<PublicActivityProps> = ({ activities }) => {
  return (
    <div className="flex flex-col h-full bg-[#181C25] overflow-hidden font-mono border-l border-[#2B3139]">
      <div className="h-10 flex items-center px-4 border-b border-[#2B3139] bg-[#1E2329] shrink-0 justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Institutional Chat (Global)</span>
        </div>
        <span className="text-[7px] text-gray-600 font-bold uppercase tracking-tighter">Verified Sessions: 1,294</span>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
        {activities.map((act) => (
          <div key={act.id} className="animate-in fade-in slide-in-from-bottom-1 group">
            <div className="flex items-center space-x-2 mb-1">
              <div className="w-4 h-4 bg-indigo-600/20 rounded flex items-center justify-center text-[7px] font-black text-indigo-400 border border-indigo-500/10">
                {act.user.charAt(0).toUpperCase()}
              </div>
              <span className="text-[9px] font-black text-indigo-400 uppercase tracking-tight group-hover:text-indigo-300">
                @{act.user}
              </span>
              <span className="text-[7px] text-gray-700 font-bold ml-auto">
                {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="bg-[#0B0E11] border border-[#2B3139] p-3 rounded-2xl rounded-tl-none group-hover:border-indigo-500/30 transition-all">
                <p className="text-[10px] text-gray-400 leading-relaxed font-medium italic">
                    {act.text}
                </p>
            </div>
          </div>
        ))}
        {activities.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-30 py-10">
             <div className="w-8 h-8 border-2 border-gray-700 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
             <div className="text-[9px] uppercase font-black tracking-widest text-gray-600">Syncing with Mainnet...</div>
          </div>
        )}
      </div>

      <div className="p-3 bg-[#1E2329] border-t border-[#2B3139]">
         <div className="bg-[#0B0E11] border border-[#2B3139] rounded-xl px-4 py-2 text-[9px] text-gray-600 font-black uppercase italic">
            Connecting to Geko-Node-4...
         </div>
      </div>
    </div>
  );
};

export default PublicActivity;
