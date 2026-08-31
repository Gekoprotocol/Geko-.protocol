import React, { useState, useEffect, useRef } from 'react';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider, useWalletModal } from '@solana/wallet-adapter-react-ui';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { clusterApiUrl } from '@solana/web3.js';
import { 
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
  TrustWalletAdapter,
  LedgerWalletAdapter
} from '@solana/wallet-adapter-wallets';

import '@solana/wallet-adapter-react-ui/styles.css';

import { 
  Wallet, 
  Settings,
  RefreshCw,
  LayoutGrid,
  TrendingUp,
  Globe,
  MoreVertical,
  LogOut,
  Mail,
  Shield,
  Menu,
  X,
  Zap,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';

import { LandingPage } from './components/LandingPage';
import { ConnectWallet } from './components/ConnectWallet';
import { authService } from './services/authService';
import HomeView from './components/HomeView';
import TradeView from './components/TradeView';
import { PortfolioView } from './components/PortfolioView';
import SwapView from './components/SwapView';
import { NetworkPulse } from './components/NetworkPulse';
import AdminDesk from './components/AdminDesk';
import TransactionHistory from './components/TransactionHistory';
import { WalletData, AssetInfo, ActiveTrade } from './types';

/**
 * MAIN APP COMPONENT
 */
export default function App() {
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = clusterApiUrl(network);
  const wallets = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new CoinbaseWalletAdapter(),
    new TrustWalletAdapter(),
    new LedgerWalletAdapter()
  ];

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <TerminalLayout />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

function TerminalLayout() {
  const { connected, disconnect } = useWallet();
  const [activeTab, setActiveTab] = useState<'home' | 'swap' | 'pulse' | 'trade' | 'assets' | 'admin' | 'history' | 'settings'>('home');
  const [isLoading, setIsLoading] = useState(true);
  const [customWallet, setCustomWallet] = useState<WalletData | null>(null);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('BTC');
  const [prices, setPrices] = useState<any[]>([]);
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([]);
  const [protocolBalances, setProtocolBalances] = useState<any[]>([]);
  const [protocolConfig, setProtocolConfig] = useState<any>({});

  // Sync Session
  useEffect(() => {
    const unsub = authService.observeSession(w => setCustomWallet(w));
    const timer = setTimeout(() => setIsLoading(false), 2000);
    return () => { unsub(); clearTimeout(timer); };
  }, []);

  const isConnected = connected || !!customWallet;
  const isApproved = connected || (!!customWallet && customWallet.status === 'approved');

  const assets: AssetInfo[] = prices.map(p => ({
    symbol: p.symbol.replace('USDT', ''),
    name: p.symbol.replace('USDT', ''),
    price: parseFloat(p.lastPrice),
    change24h: parseFloat(p.priceChangePercent),
    marketCap: 'N/A',
    volume24h: '0'
  })).filter(a => ['BTC', 'ETH', 'SOL', 'XRP'].includes(a.symbol));

  const handleNavigate = (t: string, action?: string) => {
    setActiveTab(t as any);
  };

  if (isConnected && !customWallet) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-black text-center">
        <div className="text-7xl font-black animate-web3-splash uppercase tracking-tighter italic">Web3</div>
      </div>
    );
  }

  if (!isApproved) {
    return (
        <>
            <LandingPage 
                onLoginSuccess={(d) => setCustomWallet(d)} 
                onConnectWalletClick={() => setIsWalletModalOpen(true)}
            />
            {isWalletModalOpen && <ConnectWallet onConnect={(d) => { setCustomWallet(d); setIsWalletModalOpen(false); }} onClose={() => setIsWalletModalOpen(false)} />}
        </>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-black text-white font-sans overflow-hidden">
      
      {/* TOP NAVIGATION */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 shrink-0 z-50 bg-black/80 backdrop-blur-xl">
          <div className="flex items-center gap-4">
              <button onClick={() => setIsProfileOpen(true)} className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400">
                  <Menu size={24} />
              </button>
              <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-[#10B981] rounded-xl flex items-center justify-center shadow-lg shadow-[#10B981]/20">
                      <Zap size={20} className="text-black fill-black" />
                  </div>
                  <span className="font-black italic uppercase tracking-tighter text-lg">Gecko</span>
              </div>
          </div>
          <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 bg-[#111111] px-3 py-1.5 rounded-full border border-white/5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Node Active</span>
              </div>
          </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-hidden relative">
          {activeTab === 'home' && <HomeView wallet={customWallet} assets={assets} onNavigate={handleNavigate} />}
          {activeTab === 'swap' && <SwapView assets={assets} isConnected={isConnected} wallet={customWallet} onConnect={() => {}} onSignUp={() => {}} onSwap={() => {}} onDeposit={() => {}} protocolBalances={protocolBalances} />}
          {activeTab === 'pulse' && <NetworkPulse assets={assets} onSelect={(s) => { setSelectedSymbol(s); setActiveTab('trade'); }} />}
          {activeTab === 'trade' && <TradeView wallet={customWallet} symbol={selectedSymbol} onSymbolChange={setSelectedSymbol} activeTrades={activeTrades} assets={assets} />}
          {activeTab === 'assets' && <PortfolioView wallet={customWallet} assets={assets} protocolBalances={protocolBalances} depositAddress="" onConnect={() => {}} onUpdateWallet={setCustomWallet} onDisconnect={() => {}} onRefreshBalances={() => {}} />}
      </main>

      {/* BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-black border-t border-white/5 flex items-center justify-around px-2 z-[100] pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
          <MobileNavItem active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Wallet size={24}/>} label="Home" />
          <MobileNavItem active={activeTab === 'swap'} onClick={() => setActiveTab('swap')} icon={<RefreshCw size={24}/>} label="Swap" />
          <MobileNavItem active={activeTab === 'pulse'} onClick={() => setActiveTab('pulse')} icon={<Globe size={24}/>} label="Markets" />
          <MobileNavItem active={activeTab === 'trade'} onClick={() => setActiveTab('trade')} icon={<TrendingUp size={24}/>} label="Trade" />
          <MobileNavItem active={activeTab === 'assets'} onClick={() => setActiveTab('assets')} icon={<LayoutGrid size={24}/>} label="Assets" />
      </nav>

      {/* PROFILE SIDEBAR */}
      {isProfileOpen && (
          <div className="fixed inset-0 z-[1000] flex">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsProfileOpen(false)} />
              <aside className="relative w-80 bg-[#0A0A0A] h-full border-r border-white/5 shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
                  <div className="p-8 border-b border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-[#10B981] rounded-2xl flex items-center justify-center">
                              <User size={24} className="text-black" />
                          </div>
                          <div>
                              <div className="text-sm font-black text-white uppercase tracking-tight">Operator Profile</div>
                              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Institution Verified</div>
                          </div>
                      </div>
                      <button onClick={() => setIsProfileOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-gray-500"><X size={20}/></button>
                  </div>

                  <div className="flex-1 p-6 space-y-4">
                      <div className="bg-black border border-white/5 p-4 rounded-[24px] space-y-4">
                          <div className="flex items-center gap-3">
                              <Mail size={16} className="text-[#10B981]" />
                              <div className="min-w-0">
                                  <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Email Link</div>
                                  <div className="text-xs font-mono font-bold text-gray-200 truncate">{customWallet?.email}</div>
                              </div>
                          </div>
                          <div className="flex items-center gap-3">
                              <Shield size={16} className="text-indigo-400" />
                              <div className="min-w-0">
                                  <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Node ID</div>
                                  <div className="text-xs font-mono font-bold text-gray-200 truncate">{customWallet?.address}</div>
                              </div>
                          </div>
                      </div>

                      <button onClick={() => handleNavigate('assets')} className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-all group">
                          <div className="flex items-center gap-3 text-gray-400 group-hover:text-white transition-colors">
                              <Shield size={18} />
                              <span className="text-xs font-bold uppercase tracking-widest">Verify KYC</span>
                          </div>
                          <ChevronRight size={16} className="text-gray-600" />
                      </button>
                  </div>

                  <div className="p-6 border-t border-white/5">
                      <button 
                        onClick={() => { authService.logout(); window.location.href = '/'; }}
                        className="w-full flex items-center gap-4 p-4 bg-rose-950/20 text-rose-500 rounded-[24px] hover:bg-rose-900/30 transition-all font-black uppercase italic tracking-widest text-xs"
                      >
                          <LogOut size={18} />
                          <span>Back to Login</span>
                      </button>
                  </div>
              </aside>
          </div>
      )}

    </div>
  );
}

function MobileNavItem({ active, icon, label, onClick }: any) {
    return (
      <button 
        onClick={onClick}
        className={`flex flex-col items-center justify-center gap-1 transition-all duration-300 ${active ? 'text-white' : 'text-gray-500 hover:text-gray-400'}`}
      >
        <div className={`transition-colors ${active ? 'text-[#10B981]' : ''}`}>{icon}</div>
        <span className="text-[8px] uppercase font-bold tracking-widest">{label}</span>
      </button>
    );
}
