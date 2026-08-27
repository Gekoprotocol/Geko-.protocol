import React, { useState, useEffect, useRef } from 'react';
import { WalletData } from '../types';

interface SupportWidgetProps {
  wallet?: (WalletData & { email?: string }) | null;
}

export const SupportWidget: React.FC<SupportWidgetProps> = ({ wallet }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const [visitorId] = useState(() => {
    try {
        let vid = localStorage.getItem('geko_support_visitor_id');
        if (!vid) {
            vid = 'VISITOR_' + Math.random().toString(36).substring(2, 10).toUpperCase();
            localStorage.setItem('geko_support_visitor_id', vid);
        }
        return vid;
    } catch (e) {
        return 'VISITOR_SESSION_' + Math.random().toString(36).substring(2, 10).toUpperCase();
    }
  });

  const activeAddress = wallet?.address || visitorId;

  const fetchMessages = async () => {
    if (!activeAddress) return;
    try {
      const res = await fetch(`/api/support/messages?address=${activeAddress}`);
      if (res.ok) {
        const data = await res.json();
        const serverMsgs = Array.isArray(data) ? data : [];
        
        setMessages(prev => {
            // Only update if server has NEW messages or if we are empty
            // This prevents background polling from 'erasing' optimistic messages
            if (serverMsgs.length >= prev.length) {
                return serverMsgs;
            }
            return prev;
        });
      }
    } catch (e) { console.error('Failed to fetch messages', e); }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [activeAddress]);

  useEffect(() => {
    if (isOpen) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeAddress) return;
    await sendMessage(input);
  };

  const sendMessage = async (text: string, sender: 'user' | 'ai' | 'admin' = 'user') => {
    // Optimistic Update
    const newMsg = { text, sender, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, newMsg]);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

    try {
      await fetch('/api/support/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          address: activeAddress, 
          message: text, 
          sender 
        })
      });
      // fetchMessages(); // No need to re-fetch immediately since we update optimistically
    } catch (e) { console.error('Failed to send message', e); }
  };

  const FAQS = [
    { q: "How do I deposit funds?", a: "Navigate to the 'Vault' tab, select 'Receive', and copy the institutional deposit address for USDT or SOL." },
    { q: "How do I start trading?", a: "Go to the 'Trade' tab, select an asset, choose your leverage and amount, then click 'Execute Trade'." },
    { q: "Is KYC mandatory?", a: "Yes. For institutional security, identity verification (KYC) is required for all withdrawals and higher-tier operations." },
    { q: "How long do trades take?", a: "Each trade has a fixed duration. Once the countdown expires, the trade settles automatically against live market data." },
    { q: "What is Protocol Settlement?", a: "This is your main Vault balance. You can transfer funds between this and your Trading Balance as needed." },
    { q: "How do I withdraw?", a: "Ensure your KYC is approved, then go to 'Vault' > 'Withdraw', enter your destination address and amount." }
  ];

  const handleFaqClick = (faq: { q: string, a: string }) => {
    if (!activeAddress) return;
    setInput('');
    // 1. Send the user's question
    sendMessage(faq.q, 'user');
    // 2. Immediate AI response
    setTimeout(() => sendMessage(faq.a, 'ai'), 600);
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
        <div className="w-80 h-[500px] bg-[#181C25] border border-[#2B3139] rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4">
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
            {/* FAQ SECTION */}
            <div className="pb-4 border-b border-[#2B3139]/50">
                <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <div className="w-1 h-1 bg-indigo-500 rounded-full"></div>
                    Institutional Knowledge Base
                </div>
                <div className="grid grid-cols-1 gap-2">
                    {FAQS.map((faq, i) => (
                        <button 
                            key={i} 
                            onClick={() => handleFaqClick(faq)}
                            className="text-left p-2.5 bg-[#1E2329] hover:bg-[#2B3139] border border-[#2B3139] rounded-xl text-[9px] font-bold text-gray-300 transition-all hover:translate-x-1"
                        >
                            {faq.q}
                        </button>
                    ))}
                </div>
            </div>

            {messages.length === 0 && (
                <div className="p-3 bg-[#1E2329] text-gray-400 text-[10px] rounded-2xl border border-[#2B3139] text-center italic">
                    Institutional Support Node Active. How can I assist with your terminal session today?
                </div>
            )}
            {messages.map((msg, i) => {
                if (!msg) return null;
                return (
                    <div key={i} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-2xl text-[10px] font-bold leading-relaxed ${
                            msg.sender === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-[#1E2329] text-gray-300 rounded-tl-none border border-[#2B3139]'
                        }`}>
                            {msg.text}
                        </div>
                        <span className="text-[7px] text-gray-600 mt-1 uppercase font-bold">
                            {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'PROTOCOL_STAMP'}
                        </span>
                    </div>
                );
            })}
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
