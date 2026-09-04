import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  ChevronLeft,
  HelpCircle,
  User,
  CheckCircle,
  ChevronDown
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
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new CoinbaseWalletAdapter(),
    new TrustWalletAdapter(),
    new LedgerWalletAdapter()
  ], []);

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
  const [customWallet, setCustomWallet] = useState<WalletData | null>(null);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('BTC');
  const [prices, setPrices] = useState<any[]>([]);
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([]);
  const [protocolBalances, setProtocolBalances] = useState<any[]>([]);
  const [protocolConfig, setProtocolConfig] = useState<any>({});
  
  const [autoOpenDeposit, setAutoOpenDeposit] = useState(false);
  const [autoOpenTransfer, setAutoOpenTransfer] = useState(false);

  // Sync Session
  useEffect(() => {
    const unsub = authService.observeSession(w => {
        setCustomWallet(w);
        if (w?.role === 'admin' && w?.email === 'admin@gmail.com') setActiveTab('admin');
    });
    return () => { unsub(); };
  }, []);

  // Fetch Prices
  useEffect(() => {
    const fetchPrices = async () => {
        try {
            const res = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbols=["BTCUSDT","ETHUSDT","SOLUSDT","XRPUSDT","DOGEUSDT","ADAUSDT"]');
            if (res.ok) setPrices(await res.json());
        } catch (_) {}
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 5000);
    return () => clearInterval(interval);
  }, []);

  // Sync Data
  const refreshData = useCallback(async () => {
    if (!customWallet?.address) return;
    try {
        const res = await fetch(`/api/user/balance?address=${encodeURIComponent(customWallet.address)}`);
        if (res.ok) {
            const data = await res.json();
            setCustomWallet(prev => prev ? { ...prev, trading_balance: data.trading_balance, status: data.status } : null);
            if (data.balances) {
                const enriched = data.balances.map((b: any) => {
                    const assetInfo = assets.find(a => a.symbol === b.asset);
                    const price = assetInfo ? assetInfo.price : (b.asset === 'USDT' ? 1 : 0);
                    return { ...b, valueUsd: (parseFloat(b.balance) * price).toFixed(2) };
                });
                setProtocolBalances(enriched);
            }
        }
        const cfgRes = await fetch('/api/config');
        if (cfgRes.ok) setProtocolConfig(await cfgRes.json());
        
        const tradesRes = await fetch(`/api/user/active-trades?address=${encodeURIComponent(customWallet.address)}`);
        if (tradesRes.ok) setActiveTrades(await tradesRes.json());
    } catch (_) {}
  }, [customWallet?.address, assets]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 5000);
    return () => clearInterval(interval);
  }, [refreshData]);

  const isConnected = connected || !!customWallet;
  const isApproved = connected || !!customWallet;

  const assets: AssetInfo[] = useMemo(() => {
    if (!prices || !prices.length) return [
        { symbol: 'BTC', name: 'Bitcoin', price: 0, change24h: 0, marketCap: '0', volume24h: '0' },
        { symbol: 'ETH', name: 'Ethereum', price: 0, change24h: 0, marketCap: '0', volume24h: '0' },
        { symbol: 'SOL', name: 'Solana', price: 0, change24h: 0, marketCap: '0', volume24h: '0' }
    ];
    return prices.map(p => ({
        symbol: p.symbol.replace('USDT', ''),
        name: p.symbol.replace('USDT', ''),
        price: parseFloat(p.lastPrice),
        change24h: parseFloat(p.priceChangePercent),
        marketCap: 'N/A',
        volume24h: '0'
    }));
  }, [prices]);

  const selectedAsset = assets.find(a => a.symbol === selectedSymbol) || assets[0];

  const handleNavigate = (t: string, action?: string) => {
    setActiveTab(t as any);
    if (action === 'deposit') setAutoOpenDeposit(true);
    if (action === 'transfer') setAutoOpenTransfer(true);
  };

  if (!isApproved && activeTab !== 'admin') {
    return (
        <>
            <LandingPage 
                onLoginSuccess={(d) => setCustomWallet(d)} 
                onConnectWalletClick={() => setIsWalletModalOpen(true)}
                initialView={customWallet?.status === 'guest' ? 'wait' : 'login'}
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
                  <span className="font-black italic uppercase tracking-tighter text-lg text-[#10B981]">Geko</span>
              </div>
          </div>
          <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-[#111111] px-3 py-1.5 rounded-full border border-white/5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Node Active</span>
              </div>
          </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-hidden relative">
          {activeTab === 'home' && <HomeView wallet={customWallet} assets={assets} onNavigate={handleNavigate} />}
          {activeTab === 'swap' && <SwapView assets={assets} isConnected={isConnected} wallet={customWallet} onConnect={() => {}} onSignUp={() => {}} onSwap={() => {}} onDeposit={() => handleNavigate('assets', 'deposit')} onRefreshBalances={refreshData} protocolBalances={protocolBalances} />}
          {activeTab === 'pulse' && <NetworkPulse assets={assets} onSelect={(s) => { setSelectedSymbol(s); setActiveTab('trade'); }} />}
          {activeTab === 'trade' && <TradeView assets={assets} selectedAsset={selectedAsset} selectedSymbol={selectedSymbol} setSelectedSymbol={setSelectedSymbol} marketData={[]} isConnected={isConnected} onPlaceTrade={() => {}} activeTrades={activeTrades} wallet={customWallet} onRefreshBalances={refreshData} />}
          {(activeTab === 'assets' || activeTab === 'vault') && (
            <PortfolioView 
                wallet={customWallet} 
                assets={assets} 
                protocolBalances={protocolBalances} 
                depositAddress={protocolConfig?.solana_deposit_address} 
                onConnect={() => {}} 
                onUpdateWallet={setCustomWallet} 
                onDisconnect={() => { authService.logout(); window.location.href='/'; }} 
                onRefreshBalances={refreshData} 
                autoOpenDeposit={autoOpenDeposit}
                onOpenDepositHandled={() => setAutoOpenDeposit(false)}
                autoOpenTransfer={autoOpenTransfer}
                onOpenTransferHandled={() => setAutoOpenTransfer(false)}
                protocolConfig={protocolConfig}
            />
          )}
          {activeTab === 'admin' && <AdminDesk onClose={() => setActiveTab('home')} />}
          {activeTab === 'settings' && <div className="h-full bg-black p-10">Settings View</div>}
          {activeTab === 'history' && customWallet && <TransactionHistory wallet={customWallet} />}
      </main>

      {/* BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-black border-t border-white/5 flex items-center justify-around px-2 z-[100] pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
          <MobileNavItem active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Wallet size={24}/>} label="Home" />
          <MobileNavItem active={activeTab === 'swap'} onClick={() => setActiveTab('swap')} icon={<RefreshCw size={24}/>} label="Swap" />
          <MobileNavItem active={activeTab === 'pulse'} onClick={() => setActiveTab('pulse')} icon={<Globe size={24}/>} label="Markets" />
          <MobileNavItem active={activeTab === 'trade'} onClick={() => setActiveTab('trade')} icon={<TrendingUp size={24}/>} label="Trade" />
          <MobileNavItem active={activeTab === 'assets' || activeTab === 'vault'} onClick={() => setActiveTab('assets')} icon={<LayoutGrid size={24}/>} label="Assets" />
      </nav>

      {/* PROFILE SIDEBAR */}
      {isProfileOpen && (
          <div className="fixed inset-0 z-[1000] flex">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsProfileOpen(false)} />
              <aside className="relative w-80 bg-[#0A0A0A] h-full border-r border-white/5 shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
                  <div className="p-8 border-b border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-[#10B981] rounded-2xl flex items-center justify-center">
                              <Zap size={24} className="text-black" />
                          </div>
                          <div>
                              <div className="text-sm font-black text-white uppercase tracking-tight">Geko Operator</div>

                              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Institution Verified</div>
                          </div>
                      </div>
                      <button onClick={() => setIsProfileOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-gray-500"><X size={20}/></button>
                  </div>

                  <div className="flex-1 p-6 space-y-4 overflow-y-auto custom-scrollbar">
                      <div className="bg-black border border-white/5 p-4 rounded-[24px] space-y-4 shadow-inner">
                          <div className="flex items-center gap-3">
                              <Mail size={16} className="text-[#10B981]" />
                              <div className="min-w-0">
                                  <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Email Link</div>
                                  <div className="text-xs font-mono font-bold text-gray-200 truncate">{customWallet?.email || 'N/A'}</div>
                              </div>
                          </div>
                          <div className="flex items-center gap-3">
                              <Shield size={16} className="text-indigo-400" />
                              <div className="min-w-0">
                                  <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Node ID</div>
                                  <div className="text-xs font-mono font-bold text-gray-200 truncate">{customWallet?.address || 'N/A'}</div>
                              </div>
                          </div>
                      </div>

                      <button onClick={() => { handleNavigate('assets'); setIsProfileOpen(false); }} className="w-full flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-all group">
                          <div className="flex items-center gap-3 text-gray-400 group-hover:text-white transition-colors">
                              <CheckCircle size={18} className="text-[#10B981]"/>
                              <span className="text-xs font-bold uppercase tracking-widest">Verified Identity</span>
                          </div>
                          <ChevronRight size={16} className="text-gray-600" />
                      </button>

                      {/* SUPPORT SECTION */}
                      <div className="pt-4 space-y-4">
                          <div className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] px-2">Support Center</div>
                          <SupportFAQ />
                      </div>
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

function SupportFAQ() {
    const faqs = [
        { q: "How to deposit?", a: "Go to Assets -> Deposit, select your coin, and send to the provided address." },
        { q: "Where is my balance?", a: "Your Spot balance is in Assets. Swap it to USDT to see it in your Trading Account." },
        { q: "Withdrawal time?", a: "Withdrawals are processed within 5-30 minutes after institutional clearance." },
        { q: "Institutional Node?", a: "You are currently running on a high-performance Geko Protocol node." },
        { q: "Swap not reflecting?", a: "Ensure you are swapping to USDT to credit the Institutional Terminal. Other assets remain in Spot." },
        { q: "How to trade?", a: "Select an asset in Pulse, then go to the Trade tab. Ensure your Trading Account is funded." }
    ];
    const [open, setOpen] = useState<number | null>(null);

    return (
        <div className="space-y-2">
            {faqs.map((f, i) => (
                <div key={i} className="bg-black/40 rounded-2xl border border-white/5 overflow-hidden">
                    <button onClick={() => setOpen(open === i ? null : i)} className="w-full p-4 flex items-center justify-between text-left">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight leading-relaxed">{f.q}</span>
                        <ChevronDown size={14} className={`text-gray-600 transition-transform ${open === i ? 'rotate-180' : ''}`} />
                    </button>
                    {open === i && <div className="px-4 pb-4 text-[10px] text-[#10B981] font-medium leading-relaxed italic animate-in fade-in duration-300">{f.a}</div>}
                </div>
            ))}
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

function SafeView({ children }: any) {
    return <div className="h-full w-full">{children}</div>;
}

function ErrorBoundary({ children }: any) {
    return <React.Fragment>{children}</React.Fragment>;
}
