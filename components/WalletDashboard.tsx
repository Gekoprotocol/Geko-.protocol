 
import React, { useState, useEffect } from 'react';
import { WalletData } from '../types';

interface WalletDashboardProps {
  wallet: WalletData & { email?: string };
  onClose: () => void;
  onDisconnect: () => void;
}

const WalletDashboard: React.FC<WalletDashboardProps> = ({ wallet, onClose, onDisconnect }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'identity'>('overview');
  
  // Calculate Totals
  const externalValue = (wallet?.balances || []).reduce((acc, curr) => acc + parseFloat(curr.valueUsd.replace(/,/g, '')), 0);
  const protocolValue = (wallet?.protocolBalances || []).reduce((acc, curr) => acc + parseFloat(curr.valueUsd.replace(/,/g, '')), 0);
  const tradingValue = wallet?.trading_balance || 0;
  const totalValue = externalValue + protocolValue + tradingValue;

    const [vaultBalance, setVaultBalance] = useState("0.00");

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await fetch('/api/config');
                if (res.ok) {
                    const config = await res.json();
                    if (config.vault_balance) setVaultBalance(config.vault_balance);
                }
            } catch (e) {}
        };
        fetchConfig();
        const interval = setInterval(fetchConfig, 5000);
        return () => clearInterval(interval);
    }, []);

  const isSimulation = false;

  // Dynamic Identity Logic
  const getIdentitySpecs = (val: number) => {
      if (val >= 1000000) return { level: 'Level 6', rank: 'Market Maker', encryption: 'QUANTUM-1024', color: 'text-amber-500', border: 'border-amber-500/30', shadow: 'shadow-amber-500/10', bg: 'bg-amber-500/10' };
      if (val >= 250000) return { level: 'Level 5', rank: 'Whale Node', encryption: 'QUANTUM-512', color: 'text-indigo-400', border: 'border-indigo-500/30', shadow: 'shadow-indigo-500/10', bg: 'bg-indigo-500/10' };
      if (val >= 50000) return { level: 'Level 4', rank: 'Institutional', encryption: 'AES-256-GCM', color: 'text-emerald-400', border: 'border-emerald-500/30', shadow: 'shadow-emerald-500/10', bg: 'bg-emerald-500/10' };
      if (val >= 10000) return { level: 'Level 3', rank: 'Quant Trader', encryption: 'AES-256', color: 'text-purple-400', border: 'border-purple-500/30', shadow: 'shadow-purple-500/10', bg: 'bg-purple-500/10' };
      if (val >= 1000) return { level: 'Level 2', rank: 'Operator', encryption: 'AES-128', color: 'text-cyan-400', border: 'border-cyan-500/30', shadow: 'shadow-cyan-500/10', bg: 'bg-cyan-500/10' };
      return { level: 'Level 1', rank: 'Observer', encryption: 'STANDARD-TLS', color: 'text-gray-400', border: 'border-gray-700', shadow: 'shadow-gray-900', bg: 'bg-gray-800' };
  };

  const specs = getIdentitySpecs(totalValue);

  return (
    <div className="fixed inset-0 z-[200] flex justify-end overflow-hidden">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative w-full max-w-md bg-[#181C25] border-l border-[#2B3139] shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[#2B3139] flex items-center justify-between">
          <div className="flex items-center space-x-3">
             <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
               <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-7.618 3.016L3 20l9 3 9-3-1.382-14.016z" />
               </svg>
             </div>
             <div>
                <h2 className="text-lg font-bold text-gray-100 leading-tight">Protocol Identity</h2>
                <div className="text-[10px] text-indigo-400 font-mono tracking-wider">ID: {wallet.address.slice(0,6)}...</div>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#2B3139] rounded-full transition-colors text-gray-500 hover:text-gray-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#2B3139] bg-[#0B0E11]">
            <button 
                onClick={() => setActiveTab('overview')}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === 'overview' ? 'text-indigo-400 border-b-2 border-indigo-500 bg-[#181C25]' : 'text-gray-500 hover:text-gray-300'}`}
            >
                Overview
            </button>
            <button 
                onClick={() => setActiveTab('identity')}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === 'identity' ? 'text-indigo-400 border-b-2 border-indigo-500 bg-[#181C25]' : 'text-gray-500 hover:text-gray-300'}`}
            >
                Identity Specs
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          {activeTab === 'overview' ? (
            <>
                {/* Main Portfolio Summary */}
                <div className="bg-[#1E2329] rounded-[32px] p-8 border border-[#2B3139] text-center relative overflow-hidden group shadow-lg">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                    <svg className="w-24 h-24 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                    </div>
                    
                    {isSimulation && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-900/30 text-amber-500 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-500/30">
                            Simulation Mode
                        </div>
                    )}

                    <div className="text-xs text-indigo-400 font-bold uppercase tracking-widest mb-2 mt-4">Total Net Worth</div>
                    <div className="text-4xl font-mono font-bold text-gray-100 mb-2">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    <div className="flex justify-center gap-2 text-[10px] font-mono text-gray-500">
                        <span>Vault: ${(protocolValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        <span>•</span>
                        <span>Wallet: ${(externalValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                    
                    <div className="mt-6 flex flex-col items-center space-y-2">
                    {wallet.email && (
                        <div className="text-xs font-black text-gray-300 italic uppercase tracking-tighter">
                        {wallet.email}
                        </div>
                    )}
                    {wallet.source && (
                        <div className="px-3 py-1 bg-[#0B0E11] rounded-full border border-[#2B3139] text-[10px] font-black uppercase text-gray-500">
                            VIA: <span className="text-indigo-400">{wallet.source.toUpperCase()}</span>
                        </div>
                    )}
                    <div className="flex items-center space-x-2 font-mono text-[10px] text-gray-500">
                        <span className="bg-[#0B0E11] px-2 py-1 rounded border border-[#2B3139]">{wallet.address.slice(0, 10)}...{wallet.address.slice(-10)}</span>
                        <button onClick={() => navigator.clipboard.writeText(wallet.address)} className="hover:text-indigo-400 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        </button>
                    </div>
                    </div>
                </div>

                {/* Linked DApp Status */}
                <div className="bg-[#1E2329] rounded-2xl p-4 border border-[#2B3139] flex items-center justify-between relative overflow-hidden shadow-sm">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600"></div>
                    <div className="flex items-center space-x-3 z-10">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-black italic text-white shadow-lg shadow-indigo-500/20">G</div>
                        <div>
                        <div className="text-sm font-bold text-gray-200">Geko Terminal</div>
                        <div className="text-[10px] text-gray-500 font-mono">app.gekoprotocols.io</div>
                        </div>
                    </div>
                    <div className="text-right z-10">
                        <div className="flex items-center space-x-1.5 bg-emerald-900/20 px-2 py-1 rounded-lg border border-emerald-500/20 mb-1">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wide">Connected</span>
                        </div>
                        <div className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">Read/Write Access</div>
                    </div>
                </div>

                {/* SECTION 1: PROTOCOL VAULT (Internal) */}
                <section className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                        <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest">Protocol Vault</h3>
                        <div className="flex items-center space-x-1">
                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></div>
                            <span className="text-[9px] text-indigo-400 font-bold uppercase">Secured</span>
                        </div>
                    </div>
                    <div className="space-y-2">
                    {wallet.protocolBalances && wallet.protocolBalances.length > 0 ? (
                        wallet.protocolBalances.map((asset) => (
                            <div key={`proto-${asset.symbol}`} className="bg-indigo-900/10 border border-indigo-500/20 rounded-2xl p-4 flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 bg-[#262B36] rounded-xl flex items-center justify-center font-bold text-sm border border-[#363C45] text-gray-400">
                                {asset.symbol.substring(0, 1)}
                                </div>
                                <div>
                                <div className="font-bold text-gray-200">{asset.symbol}</div>
                                <div className="text-[10px] text-gray-500 uppercase font-bold">{asset.amount} tokens</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-mono font-bold text-gray-200">${asset.valueUsd}</div>
                                <div className="text-[10px] text-indigo-400 font-bold uppercase">Deposited</div>
                            </div>
                            </div>
                        ))
                    ) : (
                        <div className="p-4 rounded-2xl border border-dashed border-[#2B3139] text-center">
                            <p className="text-[10px] text-gray-500 uppercase font-bold">No assets in vault</p>
                        </div>
                    )}
                    </div>
                </section>

                {/* SECTION 2: EXTERNAL WALLET (MetaMask/Phantom) */}
                <section className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Connected Wallet (External)</h3>
                    </div>
                    <div className="space-y-2">
                    {wallet.balances.map((asset) => (
                        <div key={`ext-${asset.symbol}`} className="bg-[#1E2329] border border-[#2B3139] rounded-2xl p-4 flex items-center justify-between hover:bg-[#262B36] transition-all cursor-pointer">
                        <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-[#0B0E11] rounded-xl flex items-center justify-center font-bold text-sm border border-[#2B3139] text-gray-500">
                            {asset.symbol.substring(0, 1)}
                            </div>
                            <div>
                            <div className="font-bold text-gray-200">{asset.symbol}</div>
                            <div className="text-[10px] text-gray-500 uppercase font-bold">{asset.amount} tokens</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="font-mono font-bold text-gray-200">${asset.valueUsd}</div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase">Web3 Balance</div>
                        </div>
                        </div>
                    ))}
                    </div>
                </section>

                {/* Transaction History */}
                <section className="space-y-4 pt-4 border-t border-[#2B3139]">
                    <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Recent Activity</h3>
                    <button className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 uppercase">Archive</button>
                    </div>
                    <div className="space-y-3">
                    {wallet.history.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between group p-2 rounded-xl hover:bg-[#262B36] transition-colors">
                        <div className="flex items-center space-x-4">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center border relative ${
                            tx.status === 'Pending' ? 'bg-amber-900/20 border-amber-500/20 text-amber-500' :
                            tx.type === 'Receive' ? 'bg-emerald-900/20 border-emerald-500/20 text-emerald-500' :
                            tx.type === 'Send' ? 'bg-rose-900/20 border-rose-500/20 text-rose-500' :
                            'bg-indigo-900/20 border-indigo-500/20 text-indigo-500'
                            }`}>
                            {tx.status === 'Pending' && (
                                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border border-[#181C25] animate-pulse"></div>
                            )}
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {tx.type === 'Receive' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7-7-7m7 7V3" />}
                                {tx.type === 'Send' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />}
                                {tx.type === 'Swap' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />}
                            </svg>
                            </div>
                            <div>
                            <div className="text-sm font-bold text-gray-200 flex items-center space-x-2">
                                <span>{tx.type} {tx.asset}</span>
                                {tx.status === 'Pending' && <span className="text-[8px] bg-amber-900/30 text-amber-500 px-1.5 py-0.5 rounded uppercase tracking-wide">Pending</span>}
                                {tx.status === 'Failed' && <span className="text-[8px] bg-rose-900/30 text-rose-500 px-1.5 py-0.5 rounded uppercase tracking-wide">Rejected</span>}
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono">{tx.hash.slice(0, 16)}...</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className={`text-sm font-bold ${
                                tx.status === 'Pending' ? 'text-amber-500' :
                                tx.status === 'Failed' ? 'text-gray-500 line-through' :
                                tx.type === 'Receive' ? 'text-emerald-500' : 'text-gray-200'
                            }`}>
                            {tx.type === 'Receive' ? '+' : '-'}{tx.amount} {tx.asset}
                            </div>
                            <div className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">{tx.timestamp}</div>
                        </div>
                        </div>
                    ))}
                    </div>
                </section>
            </>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-right duration-300">
                <div className={`bg-[#1E2329] border ${specs.border} rounded-[32px] p-8 text-center space-y-4 shadow-xl transition-all duration-500`}>
                    <div className={`w-24 h-24 bg-[#0B0E11] rounded-full mx-auto flex items-center justify-center shadow-lg border ${specs.border} relative overflow-hidden group`}>
                         <div className={`absolute inset-0 rounded-full opacity-20 ${specs.bg}`}></div>
                         <div className={`absolute inset-0 rounded-full opacity-0 group-hover:opacity-10 transition-opacity duration-700 bg-gradient-to-tr from-transparent via-gray-700 to-transparent`}></div>
                         <span className={`text-4xl font-black italic ${specs.color} drop-shadow-sm`}>{specs.level.split(' ')[1]}</span>
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-gray-100 italic uppercase tracking-tighter">Geko Identity v5</h3>
                        <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${specs.color}`}>{specs.rank}</p>
                    </div>
                    <div className="h-px bg-[#2B3139] w-full"></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#0B0E11] p-3 rounded-2xl border border-[#2B3139]">
                            <div className="text-[9px] text-gray-500 font-bold uppercase">Clearance</div>
                            <div className={`font-black uppercase ${specs.color}`}>{specs.level}</div>
                        </div>
                        <div className="bg-[#0B0E11] p-3 rounded-2xl border border-[#2B3139]">
                            <div className="text-[9px] text-gray-500 font-bold uppercase">Encryption</div>
                            <div className="text-gray-300 font-black uppercase">{specs.encryption}</div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest pl-2">System Capabilities</h4>
                    {[
                        { title: 'Institutional Aggregation', desc: 'Merges your Web3 Wallet history with off-chain reputation scores.', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
                        { title: 'Zero-Knowledge Proofs', desc: 'Verify assets without revealing total net worth to public nodes.', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-7.618 3.016L3 20l9 3 9-3-1.382-14.016z' },
                        { title: 'AI Sentinel Access', desc: 'Grants read/write permissions to Gemini-3-Pro forecasting models.', icon: 'M13 10V3L4 14h7v7l9-11h-7z' }
                    ].map((item, i) => (
                        <div key={i} className="flex space-x-4 p-4 rounded-2xl hover:bg-[#1E2329] transition-colors border border-transparent hover:border-[#2B3139] group">
                            <div className={`shrink-0 w-10 h-10 bg-[#0B0E11] rounded-xl flex items-center justify-center ${specs.color} border border-[#2B3139] group-hover:border-current transition-colors shadow-sm`}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} /></svg>
                            </div>
                            <div>
                                <h5 className="font-bold text-gray-200 text-sm">{item.title}</h5>
                                <p className="text-[10px] text-gray-500 leading-relaxed mt-1">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-[#2B3139] bg-[#1E2329]">
          <button 
            onClick={onDisconnect}
            className="w-full py-4 bg-rose-900/10 hover:bg-rose-900/20 text-rose-500 font-bold rounded-2xl border border-rose-500/20 transition-all flex items-center justify-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Terminate Session</span>
          </button>
          
          <div className="flex items-center justify-center space-x-2 mt-4">
              <div className={`w-2 h-2 rounded-full animate-pulse bg-gray-500`}></div>
              <p className={`text-center text-[9px] uppercase tracking-[0.2em] font-black text-gray-500`}>
                LOCAL MODE ACTIVE
              </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletDashboard;
