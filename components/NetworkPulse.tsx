import React, { useState, useEffect, useRef } from 'react';
import { Activity, Zap, Shield, Globe, Cpu } from 'lucide-react';

interface PulseEvent {
  id: string;
  timestamp: string;
  type: 'TRADE' | 'LIQUIDITY' | 'SECURITY' | 'ORACLE' | 'SYSTEM';
  message: string;
  value?: string;
  status: 'SUCCESS' | 'PROCESS' | 'WARNING';
}

const EVENT_TYPES = {
  TRADE:     { icon: <Zap size={14} />, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  LIQUIDITY: { icon: <Globe size={14} />, color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
  SECURITY:  { icon: <Shield size={14} />, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  ORACLE:    { icon: <Activity size={14} />, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  SYSTEM:    { icon: <Cpu size={14} />, color: 'text-purple-400', bg: 'bg-purple-400/10' },
};

export const NetworkPulse: React.FC = () => {
  const [events, setEvents] = useState<PulseEvent[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Generate initial mock events
  useEffect(() => {
    const initial: PulseEvent[] = [
      { id: '1', timestamp: new Date().toLocaleTimeString(), type: 'SECURITY', message: 'Protocol Guard: Identity Handshake Verified', status: 'SUCCESS' },
      { id: '2', timestamp: new Date().toLocaleTimeString(), type: 'LIQUIDITY', message: 'Bridge Relay: Institutional Inbound detected', value: '+450,000 USDT', status: 'SUCCESS' },
      { id: '3', timestamp: new Date().toLocaleTimeString(), type: 'ORACLE', message: 'Oracle Sync: BTC/USDT price heartbeat', status: 'SUCCESS' },
      { id: '4', timestamp: new Date().toLocaleTimeString(), type: 'TRADE', message: 'Settlement Engine: Block #829,122 confirmed', status: 'SUCCESS' },
    ];
    setEvents(initial);
  }, []);

  // Live simulation loop
  useEffect(() => {
    const messages = [
      { type: 'SECURITY' as const, msg: 'Firewall Relay: 0x8a... handshake established' },
      { type: 'LIQUIDITY' as const, msg: 'Liquidity Injection: Provider 0x22... added', val: '+25,000 USDT' },
      { type: 'ORACLE' as const, msg: 'Price Feed Updated: SOL/USDT' },
      { type: 'TRADE' as const, msg: 'Atomic Swap executed via Global Relay', val: '12.4 ETH' },
      { type: 'SYSTEM' as const, msg: 'Network Latency Optimization: 12ms avg' },
      { type: 'SECURITY' as const, msg: 'Cross-Chain verification: Validated' },
      { type: 'LIQUIDITY' as const, msg: 'Protocol Clearing: Cycle #442 initiated' },
    ];

    const interval = setInterval(() => {
      const pick = messages[Math.floor(Math.random() * messages.length)];
      const newEvent: PulseEvent = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString(),
        type: pick.type,
        message: pick.msg,
        value: pick.val,
        status: Math.random() > 0.1 ? 'SUCCESS' : 'PROCESS'
      };

      setEvents(prev => [newEvent, ...prev].slice(0, 50));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full flex flex-col bg-[#0B0E11] text-gray-200 p-6 lg:p-10 font-mono overflow-hidden">
      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col space-y-8 min-h-0">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 shrink-0">
          <div className="space-y-3">
            <h1 className="text-4xl font-black text-gray-100 italic uppercase tracking-tighter flex items-center">
                Network Pulse
                <div className="ml-4 flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Live Activity</span>
                </div>
            </h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em]">Real-time Global Protocol Transactions & Flow</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full md:w-auto">
             {[
               { label: 'TPS', value: '2,482', color: 'text-emerald-400' },
               { label: 'Relays', value: '142 Active', color: 'text-indigo-400' },
               { label: 'Clearing', value: '$12.4M', color: 'text-cyan-400' },
               { label: 'Latency', value: '14ms', color: 'text-purple-400' }
             ].map(stat => (
                <div key={stat.label} className="bg-[#181C25] border border-white/5 p-3 rounded-2xl">
                    <div className="text-[8px] text-gray-500 uppercase font-black">{stat.label}</div>
                    <div className={`text-xs font-bold ${stat.color}`}>{stat.value}</div>
                </div>
             ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 min-h-0">
            {/* Feed Section */}
            <div className="lg:col-span-2 bg-[#181C25] border border-[#2B3139] rounded-[40px] shadow-2xl overflow-hidden flex flex-col relative group">
                <div className="absolute inset-0 pointer-events-none border-[20px] border-white/[0.02] rounded-[40px] z-20"></div>
                
                <div className="p-6 border-b border-white/5 bg-[#1E2329] flex justify-between items-center z-10">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-indigo-600/10 rounded-xl text-indigo-400 border border-indigo-500/20">
                            <Activity size={18} />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest italic">Global Activity Feed</span>
                    </div>
                    <div className="flex items-center space-x-2 text-[9px] font-black text-gray-500">
                        <span>STATUS: NOMINAL</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-3 custom-scrollbar relative z-10" ref={scrollRef}>
                    {events.map((event, idx) => (
                        <div 
                            key={event.id} 
                            className={`flex items-center justify-between p-4 rounded-2xl border border-white/5 bg-[#0B0E11]/40 hover:bg-[#0B0E11]/80 transition-all animate-in slide-in-from-top-2 duration-500`}
                            style={{ opacity: 1 - (idx * 0.02) }}
                        >
                            <div className="flex items-center space-x-4 flex-1 min-w-0">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${EVENT_TYPES[event.type].bg} ${EVENT_TYPES[event.type].color} border border-current/10`}>
                                    {EVENT_TYPES[event.type].icon}
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className={`text-[8px] font-black uppercase tracking-widest ${EVENT_TYPES[event.type].color} mb-0.5`}>{event.type}</span>
                                    <span className="text-[11px] font-bold text-gray-200 truncate">{event.message}</span>
                                </div>
                            </div>
                            
                            <div className="flex items-center space-x-6 shrink-0">
                                {event.value && (
                                    <div className="text-right">
                                        <div className="text-[10px] font-mono font-bold text-emerald-400">{event.value}</div>
                                    </div>
                                )}
                                <div className="text-right">
                                    <div className="text-[9px] text-gray-600 font-mono">{event.timestamp}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Intel Section */}
            <div className="space-y-8 flex flex-col">
                <div className="bg-[#181C25] border border-[#2B3139] rounded-[40px] p-8 space-y-6 flex-1 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 blur-3xl rounded-full -mr-16 -mt-16"></div>
                    
                    <div className="space-y-2">
                        <h3 className="text-xs font-black uppercase text-gray-100 italic tracking-widest flex items-center">
                            <Globe size={14} className="mr-2 text-indigo-400" />
                            Protocol Intel Map
                        </h3>
                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed">Global Liquidity Distribution Heatmap</p>
                    </div>

                    <div className="flex-1 bg-[#0B0E11] rounded-[32px] border border-white/5 relative overflow-hidden flex items-center justify-center">
                        <div className="absolute inset-0 opacity-20 bg-grid"></div>
                        <div className="relative text-center space-y-4">
                            <div className="w-24 h-24 border-2 border-indigo-500/20 rounded-full flex items-center justify-center mx-auto animate-pulse">
                                <div className="w-16 h-16 border-2 border-indigo-500/40 rounded-full flex items-center justify-center">
                                    <div className="w-8 h-8 bg-indigo-500/60 rounded-full blur-md animate-ping"></div>
                                </div>
                            </div>
                            <div className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.4em]">Establishing Uplink...</div>
                        </div>
                        {/* Mock Map markers */}
                        <div className="absolute top-1/4 left-1/3 w-1 h-1 bg-emerald-500 rounded-full shadow-[0_0_8px_#10b981]"></div>
                        <div className="absolute top-1/2 left-2/3 w-1 h-1 bg-indigo-500 rounded-full shadow-[0_0_8px_#6366f1]"></div>
                        <div className="absolute top-2/3 left-1/4 w-1 h-1 bg-amber-500 rounded-full shadow-[0_0_8px_#f59e0b]"></div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-[9px] font-black uppercase">
                            <span className="text-gray-500">Security Index</span>
                            <span className="text-emerald-500">99.8% Nominal</span>
                        </div>
                        <div className="w-full h-1 bg-[#0B0E11] rounded-full overflow-hidden">
                            <div className="w-[99.8%] h-full bg-emerald-500"></div>
                        </div>
                    </div>
                </div>

                <div className="bg-indigo-600 p-8 rounded-[40px] text-white shadow-xl shadow-indigo-600/20 space-y-4 relative overflow-hidden group">
                    <div className="absolute bottom-0 right-0 opacity-10 translate-x-1/4 translate-y-1/4 rotate-12 transition-transform group-hover:rotate-0">
                        <Shield size={120} />
                    </div>
                    <h3 className="text-lg font-black italic uppercase leading-none">Institutional<br/>Terminal Mode</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">All interactions are encrypted via AES-256 Protocol Bridge.</p>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};
