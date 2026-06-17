import React, { useState, useEffect, useRef } from 'react';
import { WalletData } from '../types';

interface ChatMsg {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  time: string;
}

interface SupportWidgetProps {
  wallet?: (WalletData & { email?: string }) | null;
}

export const SupportWidget: React.FC<SupportWidgetProps> = ({ wallet }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: '1', sender: 'ai', text: 'Institutional Support Node Active. How can I assist with your terminal session today?', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, isTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg: ChatMsg = {
        id: Date.now().toString(),
        sender: 'user',
        text: input,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Simulated AI Response Logic
    setTimeout(() => {
        let reply = "Your request has been logged to the central clearing house. An operator will confirm the settlement shortly.";
        if (input.toLowerCase().includes('withdraw')) reply = "Withdrawal limits depend on your Node Verification Level. Please check your Equity Center for tier details.";
        if (input.toLowerCase().includes('copy')) reply = "Node Mirroring uses atomic settlement. Profits are distributed every 24 hours at 00:00 UTC.";
        
        const aiMsg: ChatMsg = {
            id: (Date.now() + 1).toString(),
            sender: 'ai',
            text: reply,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setIsTyping(false);
        setMessages(prev => [...prev, aiMsg]);
    }, 1500);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[400] font-mono">
      {!isOpen ? (
        <button 
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-2xl hover:scale-110 active:scale-95 transition-all group border-4 border-[#0B0E11]"
        >
          <svg className="w-6 h-6 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-[#0B0E11] animate-pulse"></div>
        </button>
      ) : (
        <div className="w-80 h-[450px] bg-[#181C25] border border-[#2B3139] rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4">
          <div className="p-4 bg-[#1E2329] border-b border-[#2B3139] flex items-center justify-between">
             <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black italic text-xs shadow-lg">G</div>
                <div>
                   <div className="text-[10px] font-black text-gray-100 uppercase italic">Geko Support Node</div>
                   <div className="flex items-center space-x-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="text-[8px] text-emerald-500 font-bold uppercase">Online</span>
                   </div>
                </div>
             </div>
             <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#0B0E11]/30">
            {messages.map(msg => (
                <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] p-3 rounded-2xl text-[10px] font-bold leading-relaxed ${
                        msg.sender === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-[#1E2329] text-gray-300 rounded-tl-none border border-[#2B3139]'
                    }`}>
                        {msg.text}
                    </div>
                    <span className="text-[7px] text-gray-600 mt-1 uppercase font-bold">{msg.time}</span>
                </div>
            ))}
            {isTyping && (
                <div className="flex space-x-1 p-2">
                    {[1,2,3].map(i => <div key={i} className="w-1 h-1 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }}></div>)}
                </div>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={handleSend} className="p-4 bg-[#1E2329] border-t border-[#2B3139] flex gap-2">
             <input 
                type="text" 
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Type your query..."
                className="flex-1 bg-[#0B0E11] border border-[#2B3139] rounded-xl px-4 py-2 text-[10px] font-bold text-gray-200 focus:outline-none focus:border-indigo-500 transition-all"
             />
             <button type="submit" className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9-2-9-18-9 18 9 2zm0 0v-8" /></svg>
             </button>
          </form>
        </div>
      )}
    </div>
  );
};
