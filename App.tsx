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
  LayoutGrid,
  LogOut,
  ArrowLeftRight,
  Sun,
  Moon
} from 'lucide-react';

import { LandingPage } from './components/LandingPage';
import { ConnectWallet } from './components/ConnectWallet';
import { authService } from './services/authService';
import HomeView from './components/HomeView';
import TradeView from './components/TradeView';
import { PortfolioView } from './components/PortfolioView';
import SwapView from './components/SwapView';
import WalletDashboard from './components/WalletDashboard';
import GraphsView from './components/GraphsView';
import { SupportWidget } from './components/SupportWidget';
import AdminDesk from './components/AdminDesk';
import TransactionHistory from './components/TransactionHistory';
import { WalletData, AssetInfo, ActiveTrade } from './types';

const API_BASE = window.location.origin;

/**
 * ERROR BOUNDARY
 */
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("[CRITICAL_UI_FAILURE]", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0B0E11] text-gray-400 p-10 text-center">
          <h1 className="text-2xl font-black text-rose-500 mb-4 uppercase">Terminal Fault Detected</h1>
          <div className="max-w-xl bg-[#181C25] border border-rose-500/20 p-6 rounded-2xl mb-8 text-left">
            <p className="text-xs font-mono text-rose-400 mb-4">Exception: {this.state.error?.message || "Unknown error"}</p>
            <pre className="text-[10px] font-mono text-gray-600 overflow-auto max-h-40">{this.state.error?.stack}</pre>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-indigo-600 text-white font-black uppercase rounded-xl hover:bg-indigo-500 transition-all shadow-xl"
          >
            Re-Initialize Terminal
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    new TorusWalletAdapter(),
    new TrezorWalletAdapter(),
    new WalletConnectWalletAdapter({ network: WalletAdapterNetwork.Mainnet, options: { projectId: 'e9057f920251e06f52e5c6a1e9444458' } }),
    new XDEFIWalletAdapter()
  ], []);

  return (
    <ErrorBoundary>
        <ConnectionProvider endpoint={endpoint}>
          <WalletProvider wallets={wallets} autoConnect>
            <WalletModalProvider featuredWallets={10}>
              <TerminalLayout />
            </WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>
    </ErrorBoundary>
  );
}

/**
 * TERMINAL LAYOUT
 */
function TerminalLayout() {
  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  
  // Initialize tab based on existing session role
  const initialSession = authService.getSession();
  const [activeTab, setActiveTab] = useState(initialSession?.role === 'admin' ? 'admin' : 'home');
  
  const [userData, setUserData] = useState<any>(null);
  const [vaultBalance, setVaultBalance] = useState(0);
  const [prices, setPrices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isIdentityOpen, setIsIdentityOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('BTC');

  const [isDemo, setIsDemo] = useState(false);
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([]);
  const [tradingBalance, setTradingBalance] = useState(0);
  const [customWallet, setCustomWallet] = useState<WalletData | null>(null);
  const [shouldOpenDeposit, setShouldOpenDeposit] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Load Session
  useEffect(() => {
    const unsub = authService.observeSession(wallet => {
        setCustomWallet(wallet);
        // If login returns admin role, switch to admin tab
        if (wallet?.role === 'admin') {
            setActiveTab('admin');
        }
    });
    return () => unsub();
  }, []);

  const activeAddress = publicKey?.toBase58() || customWallet?.address;
  const isConnected = connected || (!!customWallet && customWallet.status !== 'guest');
  const isPending = !!customWallet && customWallet.status === 'guest';


  // Sync Active Trades
  useEffect(() => {
    if (!isConnected || !activeAddress) return;
    const fetchTrades = async () => {
        try {
            const res = await fetch(`/api/user/active-trades?address=${encodeURIComponent(activeAddress)}`);
            if (res.ok) {
                const data = await res.json();
                const synced: ActiveTrade[] = (Array.isArray(data) ? data : []).map((t: any) => {
                    if (!t) return null;
                    const createdDate = new Date(t.created_at || Date.now());
                    return {
                        id: String(t.id || Math.random().toString(36).substring(7)),
                        symbol: String(t.symbol || 'BTC'),
                        userName: 'Local_Node',
                        direction: String(t.direction || 'up').toLowerCase() as 'up' | 'down',
                        amount: (t.amount || '0').toString(),
                        entryPrice: parseFloat(t.entry_price || '0'),
                        startTime: isNaN(createdDate.getTime()) ? Date.now() : createdDate.getTime(),
                        duration: parseInt(t.duration || '60'),
                        leverage: parseInt(t.leverage || '1'),
                        status: (t.status || 'pending') as any,
                        forceOutcome: t.force_outcome
                    };
                }).filter((t): t is ActiveTrade => t !== null);
                setActiveTrades(synced);
            }
        } catch (e) { console.warn("Trade sync failed", e); }
    };
    fetchTrades();
    const interval = setInterval(fetchTrades, 3000);
    return () => clearInterval(interval);
  }, [isConnected, activeAddress]);

  // Sync Trading Balance and check for force_logout
  useEffect(() => {
    if (!isConnected || !activeAddress) return;
    const fetchBal = async () => {
        try {
            const res = await fetch(`/api/user/balance?address=${encodeURIComponent(activeAddress)}&asset=USDT`);
            if (res.ok) {
                const data = await res.json();
                
                // FORCE LOGOUT CHECK
                if (data?.status === 'force_logout') {
                    authService.logout();
                    window.location.href = '/';
                    return;
                }

                setTradingBalance(isDemo ? (data?.demo_balance || 0) : (data?.trading_balance || 0));
                setVaultBalance(data?.balance || 0);
            }
        } catch (e) { console.warn("Balance sync failed", e); }
    };
    fetchBal();
    const interval = setInterval(fetchBal, 3000);
    return () => clearInterval(interval);
  }, [isConnected, activeAddress, isDemo]);

  const handleWalletConnect = (data: WalletData, email?: string) => {
    setCustomWallet(data);
    authService.saveSession(data);
    setIsWalletModalOpen(false);
  };

  // Sync custom wallet to DB
  useEffect(() => {
    if (customWallet) {
        fetch('/api/users/upsert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                wallet_address: customWallet.address,
                wallet_data: customWallet
            })
        }).catch(e => console.error("Sync failed", e));
    }
  }, [customWallet]);

  const handleForceOutcome = (tradeId: string, updates: Partial<ActiveTrade>) => {
    setActiveTrades(prev => prev.map(t => t.id === tradeId ? { ...t, ...updates } : t));
  };

  const activeTradingBalance = tradingBalance;

  // Map prices to AssetInfo format
  const assets: AssetInfo[] = useMemo(() => {
    if (!Array.isArray(prices)) return [];
    const allowedSymbols = ['BTC', 'ETH', 'XRP', 'DOGE', 'SOL', 'USDT'];
    return prices.map(p => {
      if (!p || typeof p !== 'object') return null;
      const price = parseFloat(p.lastPrice || '0');
      const change = parseFloat(p.priceChangePercent || '0');
      const sym = (p.symbol || 'BTCUSDT').replace('USDT', '');
      return {
        symbol: sym,
        name: sym,
        price: isNaN(price) ? 0 : price,
        change24h: isNaN(change) ? 0 : change,
        marketCap: 'N/A',
        volume24h: String(p.volume || '0')
      };
    }).filter((a): a is AssetInfo => a !== null && allowedSymbols.includes(a.symbol));
  }, [prices]);

  const selectedAsset = useMemo(() => {
    return assets.find(a => a.symbol === selectedSymbol) || assets[0] || { symbol: 'BTC', name: 'Bitcoin', price: 0, change24h: 0, marketCap: '0', volume24h: '0' };
  }, [assets, selectedSymbol]);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isNicknameModalOpen, setIsNicknameModalOpen] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    }
  };

  // Fetch User Data & Balances
  const [protocolConfig, setProtocolConfig] = useState<any>({
    solana_deposit_address: '6HmBxJuv9f5P92am6AK18KZGkHGqbNUazYXXKhvrDviw',
    btc_deposit_address: '',
    eth_deposit_address: '',
    usdt_deposit_address: ''
  });

  // Fetch Global Config
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          setProtocolConfig(data);
        }
      } catch (_) {}
    };
    fetchConfig();
    const interval = setInterval(fetchConfig, 10000);
    return () => clearInterval(interval);
  }, []);

  const refreshData = useCallback(async (nickname?: string) => {
    if (!activeAddress) return;
    const address = activeAddress;
    
    try {
      // Upsert User
      const upsertRes = await fetch('/api/users/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: address, nickname })
      });
      
      if (upsertRes.ok) {
        const userJson = await upsertRes.json();
        setUserData(userJson.user);
        if (!userJson.user.nickname && !nickname) {
          setIsNicknameModalOpen(true);
        } else if (nickname) {
          setIsNicknameModalOpen(false);
        }
      }

      // Get Balances
      const balRes = await fetch(`/api/user/balance?address=${address}&asset=USDT`);
      if (balRes.ok) {
        const balJson = await balRes.json();
        setVaultBalance(balJson.balance || 0);
        setUserData((prev: any) => ({
          ...prev,
          trading_balance: balJson.trading_balance,
          demo_balance: balJson.demo_balance,
          protocol_settlement_balance: balJson.balance
        }));
      }
    } catch (err) {
      console.warn("[Sync] Background sync check failed (normal if offline)");
    } finally {
      setIsLoading(false);
    }
  }, [activeAddress]);

  // Aggressive Immediate Sync on Connection
  useEffect(() => {
    if (isConnected && activeAddress) {
      const address = activeAddress;
      console.log(`[Identity] AGGRESSIVE_SYNC_TRIGGERED: ${address}`);
      
      const fastSync = async () => {
        try {
          await fetch('/api/users/upsert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wallet_address: address })
          });
          console.log("[Identity] Aggressive sync success");
          refreshData();
        } catch (e) {
          console.error("[Identity] Aggressive sync failed", e);
        }
      };
      
      fastSync();
    }
  }, [isConnected, activeAddress, refreshData]);

  const handleNicknameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nicknameInput.trim()) {
      refreshData(nicknameInput.trim());
    }
  };

  // Price Feed
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch('/api/binance/prices');
        if (!res.ok) return;
        const data = await res.json();
        setPrices(Array.isArray(data) ? data : []);
      } catch (e) {
        console.warn("Price feed error", e);
      }
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isConnected && activeAddress) {
      const address = activeAddress;
      // Heartbeat every 15 seconds (more frequent)
      const interval = setInterval(async () => {
        try {
          await fetch('/api/users/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wallet_address: address })
          });
        } catch (_) {}
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [isConnected, activeAddress]);

  useEffect(() => {
    if (isConnected && activeAddress) {
      refreshData();
      const interval = setInterval(refreshData, 10000); // 10s is plenty
      return () => clearInterval(interval);
    }
  }, [isConnected, activeAddress, refreshData]);

  const walletData: WalletData | null = useMemo(() => {
    if (!activeAddress) return null;
    try {
        return {
          address: String(activeAddress),
          source: String(customWallet?.source || (connected ? 'Solana' : 'Unknown')),
          trading_balance: Number(activeTradingBalance || 0),
          isDemo: Boolean(isDemo),
          balances: Array.isArray(customWallet?.balances) ? customWallet.balances : [],
          protocolBalances: [
            { 
                symbol: 'USDT', 
                amount: String(vaultBalance || 0), 
                valueUsd: String(vaultBalance || 0) 
            }
          ],
          history: Array.isArray(customWallet?.history) ? customWallet.history : []
        };
    } catch (e) {
        console.error("[Identity] Failed to construct walletData", e);
        return null;
    }
  }, [activeAddress, customWallet, connected, userData, vaultBalance, activeTradingBalance, isDemo]);

  if (activeTab === 'admin') {
    return (
      <ErrorBoundary>
          <AdminDesk 
            onClose={() => setActiveTab('home')} 
            managedWallet={walletData} 
            activeTrades={activeTrades} 
            onForceOutcome={handleForceOutcome} 
          />
      </ErrorBoundary>
    );
  }

  if (!isConnected) {
    return (
      <SafeView>
        <LandingPage 
          onLoginSuccess={handleWalletConnect} 
          onConnectWalletClick={() => setIsWalletModalOpen(true)}
          initialView={isPending ? 'wait' : 'login'}
          assets={assets}
          onAdminAccess={() => setActiveTab('admin')}
        />
        {isWalletModalOpen && (
          <ConnectWallet onConnect={handleWalletConnect} onClose={() => setIsWalletModalOpen(false)} />
        )}
      </SafeView>
    );
  }

  if (isConnected && !walletData) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0B0E11] space-y-4 text-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Synchronizing Identity...</div>
        <div className="pt-8">
            <button 
              onClick={() => { authService.logout(); window.location.href = '/'; }}
              className="text-[8px] text-gray-600 uppercase font-black tracking-widest hover:text-rose-500 transition-colors"
            >
              Reset Session
            </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen h-[100dvh] w-screen flex flex-col overflow-hidden ${isDarkMode ? 'bg-[#0B0E11] text-[#EAECEF]' : 'bg-gray-50 text-gray-900'} font-sans`}>
      
      {/* TOP BAR */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-4 lg:px-8 glass shrink-0 z-40">
        <div className="flex items-center gap-2 lg:gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <span className="text-white font-black text-[10px] italic">GK</span>
          </div>
          <div className="flex flex-col">
            <span className="font-black tracking-tighter text-base uppercase italic leading-none">GEKO</span>
          </div>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="ml-4 p-2 hover:bg-white/5 rounded-lg transition-all"
          >
            {isDarkMode ? <Sun size={14} className="text-amber-500" /> : <Moon size={14} className="text-indigo-400" />}
          </button>
        </div>

        <div className="flex items-center gap-6">
            <div className="hidden lg:flex items-center space-x-6">
              {(Array.isArray(prices) ? prices : []).filter(p => p && typeof p === 'object' && p.symbol).slice(0, 2).map(p => {
                  const price = parseFloat(p.lastPrice || '0');
                  const change = parseFloat(p.priceChangePercent || '0');
                  return (
                      <div key={p.symbol} className="flex flex-col items-end">
                          <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{p.symbol}</span>
                          <span className={`text-xs font-mono font-bold ${change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              ${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                      </div>
                  );
              })}
            </div>
            <div className="w-px h-6 bg-white/10" />
            <WalletMultiButton className="!bg-indigo-600 !text-white !h-10 !text-[10px] !font-black !uppercase !tracking-widest !rounded-xl hover:!bg-indigo-500 transition-all border-none" />
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-hidden relative">
        <SafeView>
            {activeTab === 'home' && <HomeView wallet={walletData} assets={assets} onNavigate={(t) => setActiveTab(t)} />}
            {activeTab === 'trade' && <TradeView assets={assets} selectedAsset={selectedAsset} selectedSymbol={selectedAsset.symbol} setSelectedSymbol={setSelectedSymbol} marketData={[]} isConnected={isConnected} onPlaceTrade={() => {}} activeTrades={activeTrades} wallet={walletData} onRefreshBalances={() => refreshData()} />}
            {activeTab === 'swap' && <SwapView assets={assets} isConnected={isConnected} wallet={walletData} onConnect={() => setIsWalletModalOpen(true)} onSignUp={() => {}} onSwap={() => {}} onDeposit={() => { setActiveTab('vault'); setShouldOpenDeposit(true); }} onRefreshBalances={refreshData} depositAddress={protocolConfig.solana_deposit_address} protocolConfig={protocolConfig} />}
            {activeTab === 'visualizer' && <GraphsView assets={assets} selectedAsset={selectedAsset} marketData={[]} setSelectedSymbol={setSelectedSymbol} />}
            {activeTab === 'vault' && <PortfolioView wallet={walletData} assets={assets} depositAddress={protocolConfig.solana_deposit_address} protocolConfig={protocolConfig} onConnect={() => setIsWalletModalOpen(true)} onUpdateWallet={(d) => setCustomWallet(d)} onDisconnect={disconnect} onRefreshBalances={refreshData} autoOpenDeposit={shouldOpenDeposit} onOpenDepositHandled={() => setShouldOpenDeposit(false)} />}
            {activeTab === 'history' && walletData && <TransactionHistory wallet={walletData} />}
            
            {activeTab === 'settings' && (
                <div className="h-full overflow-y-auto p-6 lg:p-12 space-y-8 bg-[#0B0E11] custom-scrollbar">
                    <div className="max-w-4xl mx-auto space-y-12">
                        <div className="space-y-2">
                            <h1 className="text-4xl font-black text-gray-100 italic uppercase tracking-tighter">Settings</h1>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em]">Configure Protocol & Account Preferences</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Account Type */}
                            <div className="bg-[#181C25] p-8 rounded-[32px] border border-white/5 space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-indigo-600/10 rounded-2xl text-indigo-400">
                                        <Trophy size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-white uppercase italic">Account Type</h3>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase">Toggle between Live and Demo environments</p>
                                    </div>
                                </div>
                                <div className="flex bg-[#0B0E11] p-1.5 rounded-2xl border border-white/5">
                                    <button 
                                        onClick={() => setIsDemo(false)}
                                        className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${!isDemo ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        Live Trading
                                    </button>
                                    <button 
                                        onClick={() => setIsDemo(true)}
                                        className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${isDemo ? 'bg-amber-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        Demo Trading
                                    </button>
                                </div>
                            </div>

                            {/* KYC Attestation */}
                            <button 
                                onClick={() => setActiveTab('kyc')}
                                className="bg-[#181C25] p-8 rounded-[32px] border border-white/5 flex items-center justify-between group hover:border-indigo-500/30 transition-all text-left"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-emerald-600/10 rounded-2xl text-emerald-500">
                                        <ShieldCheck size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-white uppercase italic">KYC Attestation</h3>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase">Verify Institutional Identity</p>
                                    </div>
                                </div>
                                <div className="text-gray-600 group-hover:text-indigo-400 transition-colors">
                                    <ArrowLeftRight size={20} />
                                </div>
                            </button>

                            {/* Support Node */}
                            <div className="bg-[#181C25] p-8 rounded-[32px] border border-white/5 space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-600/10 rounded-2xl text-blue-500">
                                        <Headset size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-white uppercase italic">Support Node</h3>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase">Institutional Assistance 24/7</p>
                                    </div>
                                </div>
                                <p className="text-[11px] text-gray-400 leading-relaxed">For immediate support, please use the secure widget in the bottom right corner of your terminal.</p>
                            </div>

                            {/* Logout */}
                            <div className="bg-rose-950/10 p-8 rounded-[32px] border border-rose-500/10 space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-rose-600/10 rounded-2xl text-rose-500">
                                        <LogOut size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-white uppercase italic">Terminate Session</h3>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase">Logout from Geko Terminal</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => {
                                        authService.logout(walletData?.email);
                                        window.location.href = '/';
                                    }}
                                    className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all shadow-lg"
                                >
                                    LOG OUT TERMINAL
                                </button>
                            </div>
                        </div>

                        <div className="pt-8 border-t border-white/5 flex items-center justify-between opacity-50">
                            <div className="flex items-center space-x-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                <div className="text-[10px] font-mono font-bold text-gray-400">Node: {activeAddress?.slice(0,24)}...</div>
                            </div>
                            <div className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Protocol V2.0.4 - Secure</div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'kyc' && <PortfolioView wallet={walletData} assets={assets} depositAddress={solanaDepositAddress} onConnect={() => setIsWalletModalOpen(true)} onUpdateWallet={(d) => setCustomWallet(d)} onDisconnect={disconnect} onRefreshBalances={refreshData} autoOpenDeposit={shouldOpenDeposit} onOpenDepositHandled={() => setShouldOpenDeposit(false)} />}
            {activeTab === 'leaderboard' && <div className="p-20 text-center">
                <h2 className="text-3xl font-black uppercase italic tracking-tighter">Global Rankings</h2>
                <p className="text-gray-500">Leaderboard data streaming shortly...</p>
              </div>}
        </SafeView>
      </main>

      {/* BOTTOM NAVIGATION */}
      <nav className="h-20 border-t border-white/5 bg-[#181C25]/80 backdrop-blur-xl flex items-center justify-center px-4 gap-2 lg:gap-8 z-50">
          <BottomNavItem active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<LayoutDashboard size={18}/>} label="Home" />
          <BottomNavItem active={activeTab === 'trade'} onClick={() => setActiveTab('trade')} icon={<TrendingUp size={18}/>} label="Trade" />
          <BottomNavItem active={activeTab === 'swap'} onClick={() => setActiveTab('swap')} icon={<ArrowLeftRight size={18}/>} label="Swap" />
          <BottomNavItem active={activeTab === 'visualizer'} onClick={() => setActiveTab('visualizer')} icon={<LayoutGrid size={18}/>} label="Markets" />
          <BottomNavItem active={activeTab === 'vault'} onClick={() => setActiveTab('vault')} icon={<Wallet size={18}/>} label="Assets" />
          <BottomNavItem active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<RefreshCw size={18}/>} label="History" />
          <BottomNavItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={18}/>} label="Settings" />
      </nav>

      <SupportWidget wallet={walletData} />

      {isIdentityOpen && walletData && (
          <WalletDashboard wallet={walletData} onClose={() => setIsIdentityOpen(false)} onDisconnect={disconnect} />
      )}

      {isNicknameModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-[#181C25] border border-[#2B3139] rounded-[40px] max-w-md w-full p-10 shadow-2xl relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600"></div>
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-indigo-600/20 rounded-3xl flex items-center justify-center mx-auto border border-indigo-500/30">
                <ShieldCheck size={40} className="text-indigo-400" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white italic uppercase tracking-tight">Identity Uplink</h2>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-[0.2em]">Protocol Entry Authorization Required</p>
              </div>
              <form onSubmit={handleNicknameSubmit} className="space-y-4 text-left">
                <div className="space-y-2">
                  <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Establish Protocol Nickname</label>
                  <input 
                    type="text" 
                    required 
                    value={nicknameInput}
                    onChange={(e) => setNicknameInput(e.target.value)}
                    placeholder="e.g. ALPHA_TRADER"
                    className="w-full bg-[#0B0E11] border border-[#2B3139] focus:border-indigo-500 rounded-2xl p-5 text-base font-mono font-bold text-gray-100 outline-none transition-all shadow-inner"
                  />
                </div>
                <button 
                  type="submit" 
                  className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase italic tracking-[0.2em] rounded-2xl shadow-xl transition-all"
                >
                  Finalize Authorization
                </button>
              </form>
              <div className="pt-4 border-t border-white/5">
                 <p className="text-[8px] text-gray-600 font-black uppercase tracking-widest">Connected Wallet: {activeAddress?.slice(0,16)}...</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SafeView({ children }: { children: React.ReactNode }) {
    return (
        <ErrorBoundary>
            {children}
        </ErrorBoundary>
    );
}

function BottomNavItem({ active, icon, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 px-3 lg:px-6 py-2 rounded-2xl transition-all duration-300 group ${active ? 'text-indigo-500' : 'text-gray-500 hover:text-gray-300'}`}
    >
      <div className={`${active ? 'text-indigo-500' : 'text-gray-600 group-hover:text-indigo-400'} transition-colors`}>{icon}</div>
      <span className="text-[8px] lg:text-[10px] uppercase font-black tracking-widest">{label}</span>
      {active && <div className="w-1 h-1 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>}
    </button>
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
