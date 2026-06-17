
import React, { useState } from 'react';
import { universalWallet } from '../services/universalWallet';
import { WalletData } from '../types';

export type ConnectMode = 'wallets';

interface ConnectWalletProps {
  onConnect: (address: WalletData, email?: string) => void;
  onClose: () => void;
  initialMode?: ConnectMode;
}

interface WalletOption {
  name: string;
  id: string;
  color: string;
  type: 'evm' | 'svm';
  svg: React.ReactNode;
}

export const ConnectWallet: React.FC<ConnectWalletProps> = ({ onConnect, onClose }) => {
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError]       = useState('');

  const wallets: WalletOption[] = [
    {
      name: 'MetaMask', id: 'metamask', type: 'evm', color: 'text-orange-400',
      svg: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M21.315 3L13.294 9.13l1.48-3.51L21.315 3zM2.685 3l7.962 6.186-1.41-3.576L2.685 3zM18.36 16.27l-2.14 3.277 4.582 1.262 1.316-4.471-3.758-.068zm-14.977.068l1.307 4.471 4.573-1.262-2.131-3.277-3.749.068zM8.9 10.937l-1.275 1.926 4.539.207-.153-4.883L8.9 10.937zm6.2 0l-3.143-2.8-.108 4.933 4.53-.207L15.1 10.937z"/></svg>
    },
    {
      name: 'Phantom', id: 'phantom', type: 'svm', color: 'text-purple-400',
      svg: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.5 7.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm-9 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm9.75 4.5c-.69 2.1-2.52 3.5-5.25 3.5s-4.56-1.4-5.25-3.5h10.5z"/></svg>
    },
    {
      name: 'Coinbase', id: 'coinbase', type: 'evm', color: 'text-blue-400',
      svg: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 4a6 6 0 110 12A6 6 0 0112 6zm-1.5 3v6h3V9h-3z"/></svg>
    },
    {
      name: 'Trust Wallet', id: 'trust', type: 'evm', color: 'text-sky-400',
      svg: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4 5.5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5.5L12 2z"/></svg>
    },
    {
      name: 'OKX Wallet', id: 'okx', type: 'evm', color: 'text-gray-300',
      svg: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/><rect x="16" y="9" width="6" height="6" rx="1"/></svg>
    },
    {
      name: 'Exodus', id: 'exodus', type: 'evm', color: 'text-violet-400',
      svg: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l10 6v8l-10 6L2 16V8l10-6zm0 3.236L4 9.764v4.472l8 4.528 8-4.528V9.764L12 5.236z"/></svg>
    },
    {
      name: 'Binance Web3', id: 'binance', type: 'evm', color: 'text-yellow-400',
      svg: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.5 2.5L12 7 9.5 4.5 12 2zm5 5l2.5 2.5-2.5 2.5-2.5-2.5L17 7zM7 7l2.5 2.5L7 12 4.5 9.5 7 7zm5 5l2.5 2.5L12 17l-2.5-2.5L12 12zm5 5l-2.5 2.5L12 22l-2.5-2.5L12 17l2.5 2.5L17 17z"/></svg>
    },
  ];

  const isDetected = (id: string) => {
    const w: any = window;
    if (id === 'metamask') return !!w.ethereum?.isMetaMask;
    if (id === 'phantom')  return !!(w.phantom?.solana || w.solana?.isPhantom);
    if (id === 'trust')    return !!w.trustwallet;
    if (id === 'binance')  return !!w.BinanceChain;
    if (id === 'okx')      return !!w.okxwallet;
    if (id === 'coinbase') return !!w.coinbaseWalletExtension;
    if (id === 'exodus')   return !!w.exodus?.ethereum;
    return false;
  };

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
      onConnect(data);
    } catch (e: any) {
      setError(e.message || 'Connection failed');
      setConnecting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#181C25] border border-[#2B3139] rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="p-8 border-b border-[#2B3139] bg-[#1E2329] flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">Identity Uplink</h2>
            <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mt-0.5">Connect to Geko Protocols</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-6 space-y-3">
              {error && (
                <div className="p-3 bg-rose-900/20 border border-rose-500/30 rounded-2xl text-[10px] text-rose-400 font-black uppercase text-center">
                  {error}
                </div>
              )}
              {wallets.map(w => (
                <button
                  key={w.id}
                  disabled={!!connecting}
                  onClick={() => handleWalletConnect(w)}
                  className="w-full flex items-center justify-between p-4 bg-[#1E2329] border border-[#2B3139] rounded-3xl hover:border-indigo-500/50 transition-all group disabled:opacity-50"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`p-2.5 rounded-2xl bg-[#0B0E11] ${w.color}`}>
                      {w.svg}
                    </div>
                    <div className="text-left">
                      <span className="font-black text-gray-200 uppercase text-sm block">{w.name}</span>
                      <span className="text-[8px] text-gray-600 font-black uppercase">{w.type === 'svm' ? 'Solana' : 'EVM'}</span>
                    </div>
                    {isDetected(w.id) && (
                      <span className="text-[8px] bg-emerald-900/30 text-emerald-500 px-1.5 py-0.5 rounded uppercase font-black tracking-widest">
                        Detected
                      </span>
                    )}
                  </div>
                  {connecting === w.id ? (
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4 text-gray-600 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#0B0E11] border-t border-[#2B3139] text-center shrink-0">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Encrypted · Mainnet · Non-Custodial</span>
          </div>
        </div>

      </div>
    </div>
  );
};
