import React, { useState, useMemo } from 'react';
import { universalWallet } from '../services/universalWallet';
import { authService } from '../services/authService';
import { WalletData } from '../types';
import { X, Search, Shield, ChevronRight } from 'lucide-react';

interface ConnectWalletProps {
  onConnect: (address: WalletData, email?: string) => void;
  onClose: () => void;
}

interface WalletOption {
  name: string;
  id: string;
  color: string;
  type: 'evm' | 'svm';
  icon: string;
}

export const ConnectWallet: React.FC<ConnectWalletProps> = ({ onConnect, onClose }) => {
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [showManual, setShowManual] = useState(false);

  const wallets: WalletOption[] = [
    { name: 'Phantom', id: 'phantom', type: 'svm', color: 'text-purple-400', icon: 'P' },
    { name: 'Solflare', id: 'solflare', type: 'svm', color: 'text-orange-400', icon: 'S' },
    { name: 'MetaMask', id: 'metamask', type: 'evm', color: 'text-orange-500', icon: 'M' },
    { name: 'Coinbase', id: 'coinbase', type: 'evm', color: 'text-blue-500', icon: 'C' },
    { name: 'Trust Wallet', id: 'trust', type: 'evm', color: 'text-sky-500', icon: 'T' },
    { name: 'OKX Wallet', id: 'okx', type: 'evm', color: 'text-white', icon: 'O' },
    { name: 'Exodus', id: 'exodus', type: 'evm', color: 'text-indigo-400', icon: 'E' },
    { name: 'Backpack', id: 'backpack', type: 'svm', color: 'text-red-400', icon: 'B' },
    { name: 'Magic Eden', id: 'magiceden', type: 'svm', color: 'text-pink-400', icon: 'ME' },
  ];

  const filteredWallets = useMemo(() => 
    wallets.filter(w => w.name.toLowerCase().includes(search.toLowerCase())),
  [search]);

  const handleWalletConnect = async (wallet: WalletOption) => {
    setConnecting(wallet.id);
    setError('');
    try {
      let data: WalletData;
      if (wallet.type === 'evm') {
        data = await universalWallet.connectEVM(wallet.name);
      } else {
        data = await universalWallet.connectSolana();
      }
      
      // Integrate with backend auth
      const backendUser = await authService.walletLogin(data.address);
      onConnect(backendUser);
    } catch (e: any) {
      setError(e.message || 'Connection failed');
      setConnecting(null);
    }
  };

  const handleManualConnect = async () => {
    if (!manualAddress || manualAddress.length < 32) {
        setError('Please enter a valid node address');
        return;
    }
    setConnecting('manual');
    setError('');
    try {
        const data = await universalWallet.handshakeWallet(manualAddress);
        const backendUser = await authService.walletLogin(data.address);
        onConnect(backendUser);
    } catch (e: any) {
        setError(e.message || 'Node link failed');
        setConnecting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="absolute inset-0" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-[#181C25] border border-white/5 rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
            <div className="space-y-1">
                <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">{showManual ? 'Direct Node Link' : 'Connect Wallet'}</h2>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{showManual ? 'Paste your wallet address below' : 'Select your Web3 Provider'}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-500 hover:text-white">
                <X size={24} />
            </button>
        </div>

        {/* Manual Input or Search */}
        {showManual ? (
            <div className="p-8 space-y-6">
                <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Wallet Node Address</label>
                    <input 
                        type="text" 
                        value={manualAddress}
                        onChange={(e) => setManualAddress(e.target.value)}
                        placeholder="Paste Solana or EVM address" 
                        className="w-full bg-[#0B0E11] border border-white/5 focus:border-[#10B981] rounded-2xl p-5 text-xs font-mono font-bold text-gray-100 outline-none transition-all shadow-inner"
                    />
                </div>
                {error && <div className="p-4 bg-rose-950/20 border border-rose-500/20 rounded-2xl text-[9px] font-black uppercase text-rose-500 text-center tracking-widest">{error}</div>}
                <button 
                    onClick={handleManualConnect}
                    disabled={!!connecting}
                    className="w-full bg-[#10B981] hover:bg-[#0da673] disabled:opacity-50 text-black font-black uppercase italic tracking-[0.2em] py-5 rounded-2xl shadow-xl transition-all text-xs flex items-center justify-center space-x-3"
                >
                    {connecting === 'manual' ? <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div> : <span>Establish Node Link</span>}
                </button>
                <button onClick={() => setShowManual(false)} className="w-full text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-white transition-colors">Back to Providers</button>
            </div>
        ) : (
            <>
                <div className="p-6 pb-2">
                    <div className="relative group">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-500 transition-colors" />
                        <input 
                            type="text" 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search for a wallet..." 
                            className="w-full bg-[#0B0E11] border border-white/5 focus:border-indigo-500 rounded-2xl p-4 pl-12 text-sm font-bold text-white outline-none transition-all shadow-inner"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-2 space-y-2">
                    {error && <div className="p-4 bg-rose-950/20 border border-rose-500/20 rounded-2xl text-[10px] font-black uppercase text-rose-500 text-center tracking-widest mb-4">{error}</div>}
                    
                    {filteredWallets.length > 0 ? (
                        filteredWallets.map(w => (
                            <button
                                key={w.id}
                                disabled={!!connecting}
                                onClick={() => handleWalletConnect(w)}
                                className="w-full flex items-center justify-between p-4 bg-[#0B0E11]/50 border border-white/5 rounded-[24px] hover:bg-[#2B3139] hover:border-indigo-500/30 transition-all group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl bg-[#181C25] border border-white/5 flex items-center justify-center font-black italic text-lg ${w.color} group-hover:scale-105 transition-transform`}>
                                        {w.icon}
                                    </div>
                                    <div className="text-left">
                                        <div className="text-sm font-bold text-white uppercase tracking-tight">{w.name}</div>
                                        <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">{w.type === 'svm' ? 'Solana' : 'EVM'}</div>
                                    </div>
                                </div>
                                {connecting === w.id ? (
                                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <ChevronRight size={18} className="text-gray-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
                                )}
                            </button>
                        ))
                    ) : (
                        <div className="text-center py-10 space-y-2">
                            <p className="text-sm font-bold text-gray-500 italic">No wallets found</p>
                            <p className="text-[8px] text-gray-600 uppercase font-black tracking-widest">Try searching for another name</p>
                        </div>
                    )}

                    <button
                        onClick={() => setShowManual(true)}
                        className="w-full flex items-center justify-between p-4 bg-indigo-600/10 border border-indigo-500/20 rounded-[24px] hover:bg-indigo-600/20 transition-all group mt-4"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white">
                                <Shield size={20} />
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-black text-white uppercase tracking-tight">Direct Node Entry</div>
                                <div className="text-[8px] text-indigo-400 font-bold uppercase tracking-[0.2em]">High Speed Access</div>
                            </div>
                        </div>
                        <ChevronRight size={18} className="text-indigo-400 group-hover:translate-x-1 transition-all" />
                    </button>
                </div>
            </>
        )}

        {/* Footer */}
        <div className="p-6 bg-[#0B0E11]/50 border-t border-white/5 text-center">
            <div className="flex items-center justify-center space-x-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] text-gray-600 font-black uppercase tracking-widest">Secured by Geko Protocol</span>
            </div>
        </div>
      </div>
    </div>
  );
};
