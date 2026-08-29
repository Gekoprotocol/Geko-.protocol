import React, { useState, useMemo, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { AssetInfo, WalletData } from '../types';

interface SwapViewProps {
  assets: AssetInfo[];
  isConnected: boolean;
  wallet?: (WalletData & { pending_deposit_currency?: string, pending_deposit_amount?: number }) | null;
  onConnect: () => void;
  onSignUp: () => void;
  onSwap: (from: string, to: string, amount: string) => void;
  onDeposit: (amount: string, asset: string) => void;
  onRefreshBalances?: () => void;
  depositAddress?: string;
  protocolConfig?: any;
  }

  const SwapView: React.FC<SwapViewProps> = ({ assets, isConnected, wallet, onConnect, onSignUp, onConfirm, onSwap, onDeposit, onRefreshBalances, depositAddress, protocolConfig }) => {
  const [fromAsset, setFromAsset] = useState<AssetInfo | null>(assets.find(a => a.symbol !== 'USDT') || assets[0] || null);
  const [toAsset, setToAsset] = useState<AssetInfo | null>(assets.find(a => a.symbol === 'USDT') || assets[1] || null);
  const [amount, setAmount] = useState('');
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [selectorSide, setSelectorSide] = useState<'from' | 'to'>('from');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSwapping, setIsSwapping] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedChain, setSelectedChain] = useState<'SOL' | 'BTC' | 'ETH' | 'USDT'>('SOL');

  const solanaAddr = protocolConfig?.solana_deposit_address || depositAddress || '6HmBxJuv9f5P92am6AK18KZGkHGqbNUazYXXKhvrDviw';
  const btcAddr    = protocolConfig?.btc_deposit_address || '';
  const ethAddr    = protocolConfig?.eth_deposit_address || '';
  const usdtAddr   = protocolConfig?.usdt_deposit_address || '';

  const activeDepositAddress = useMemo(() => {
    if (selectedChain === 'BTC') return btcAddr;
    if (selectedChain === 'ETH') return ethAddr;
    if (selectedChain === 'USDT') return usdtAddr;
    return solanaAddr;
  }, [selectedChain, solanaAddr, btcAddr, ethAddr, usdtAddr]);

  useEffect(() => {
    if (assets.length >= 2) {
      const currentFrom = fromAsset ? assets.find(a => a.symbol === fromAsset.symbol) : (assets.find(a => a.symbol !== 'USDT') || assets[0]);
      const currentTo = toAsset ? assets.find(a => a.symbol === toAsset.symbol) : (assets.find(a => a.symbol === 'USDT') || assets[1]);
      
      if (currentFrom) setFromAsset(currentFrom);
      if (currentTo) setToAsset(currentTo);
    }
  }, [assets]);

  const equivalentTarget = useMemo(() => {
    if (!amount || !fromAsset || !toAsset) return '0.00';
    
    const fromPrice = fromAsset.price;
    const toPrice = toAsset.price;

    if (toPrice === 0) return '0.00';
    return (parseFloat(amount) * (fromPrice / toPrice)).toFixed(toAsset.symbol === 'BTC' || toAsset.symbol === 'ETH' ? 6 : 2);
  }, [amount, fromAsset, toAsset]);

  const handleAction = () => {
    if (!isConnected) { onConnect(); return; }
    if (!amount || parseFloat(amount) <= 0) return;
    
    // Check if sufficient in protocol balance first
    const fromSymbol = fromAsset?.symbol || '';
    const protocolFrom = protocolBalances.find(b => b.asset === fromSymbol)?.balance || 0;
    
    if (protocolFrom < parseFloat(amount)) {
        setSwapError(`Insufficient ${fromSymbol} in protocol balance. You have ${protocolFrom.toFixed(6)} but need ${amount}.`);
        return;
    }

    setSwapError(null);
    setShowDeposit(true); // Now used as "Confirm Step"
  };

  const handleManualSwap = async () => {
      if (!wallet?.address || !fromAsset || !toAsset) return;
      setIsSwapping(true);
      setSwapError(null);
      
      try {
          // 1. First, tell admin what we are doing (record pending swap)
          const depositRes = await fetch('/api/admin/deposit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  walletAddress: wallet.address,
                  currency: fromAsset.symbol,
                  amount: equivalentTarget,
                  targetCurrency: toAsset.symbol,
                  sourceAmount: amount
              })
          });

          if (!depositRes.ok) throw new Error("Failed to initialize swap request");

          // 2. Immediately execute the swap
          const res = await fetch('/api/user/swap', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ walletAddress: wallet.address })
          });
          
          if (res.ok) {
              if (onRefreshBalances) onRefreshBalances();
              setShowDeposit(false);
              setAmount('');
          } else {
              const data = await res.json();
              setSwapError(data.error || 'Swap execution failed');
          }
      } catch (e: any) {
          setSwapError(e.message || 'Network error during swap');
      } finally {
          setIsSwapping(false);
      }
  };

  const openSelector = (side: 'from' | 'to') => {
    setSelectorSide(side);
    setSearchQuery('');
    setIsSelectorOpen(true);
  };

  const handleSelectAsset = (asset: AssetInfo) => {
    if (selectorSide === 'from') {
        if (asset.symbol === toAsset.symbol) {
            // Swap if selecting same
            const temp = toAsset;
            setToAsset(fromAsset);
            setFromAsset(temp);
        } else {
            setFromAsset(asset);
        }
    } else {
        if (asset.symbol === fromAsset.symbol) {
            const temp = fromAsset;
            setFromAsset(toAsset);
            setToAsset(temp);
        } else {
            setToAsset(asset);
        }
    }
    setIsSelectorOpen(false);
  };

  const filteredAssets = assets.filter(a => 
    a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!fromAsset || !toAsset) {
    return (
      <div className="w-full max-w-4xl p-12 text-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500 font-black uppercase tracking-widest text-xs">Syncing Protocol Liquidity...</p>
      </div>
    );
  }

  return (
    <div className="h-full p-8 flex flex-col items-center bg-[#0B0E11] animate-in fade-in duration-500 relative overflow-y-auto custom-scrollbar">
      <div className="w-full max-w-4xl space-y-8 pb-20">
        
        <div className="text-center space-y-4">
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-gray-100 italic uppercase tracking-tighter">Swap</h1>
            <p className="text-xs text-indigo-500 font-bold uppercase tracking-[0.4em]">Atomic Cross-Chain Bridge</p>
          </div>
        </div>

        {!isConnected && (
          <div className="bg-[#181C25] rounded-[32px] p-8 border border-indigo-500/30 shadow-xl flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 text-indigo-500">
               <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
            </div>
            <div className="space-y-1 text-center md:text-left relative z-10">
              <h3 className="text-2xl font-black text-gray-100 italic uppercase tracking-tight">Identity Required</h3>
              <p className="text-sm text-gray-500 max-w-md">Connect to access high-frequency liquidity pools and institutional execution rates.</p>
            </div>
            <div className="flex flex-col items-center gap-4 relative z-10 shrink-0">
              <button onClick={onConnect} className="w-full px-10 py-5 bg-indigo-600 text-white rounded-[20px] font-black text-sm uppercase italic hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20">AUTHENTICATE</button>
            </div>
          </div>
        )}

        {showDeposit && (
            <div className="bg-indigo-600/10 border border-indigo-500/30 rounded-[40px] p-6 sm:p-10 space-y-6 sm:space-y-8 animate-in slide-in-from-top-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
                    <div className="flex items-center space-x-4 sm:space-x-6">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black italic shadow-lg text-xl sm:text-2xl">
                            {toAsset?.symbol[0]}
                        </div>
                        <div>
                            <div className="text-[8px] sm:text-[10px] text-indigo-400 font-black uppercase tracking-widest mb-1">Internal Protocol Swap</div>
                            <div className="text-xl sm:text-2xl font-black text-white italic">Confirm {fromAsset?.symbol} → {toAsset?.symbol}</div>
                        </div>
                    </div>
                    <div className="flex flex-col items-center sm:items-end space-y-1 sm:space-y-2">
                        <div className="text-[8px] sm:text-[10px] text-gray-500 font-black uppercase tracking-widest">Receive Equivalent</div>
                        <div className="text-2xl sm:text-3xl font-black text-emerald-500 font-mono">{equivalentTarget} {toAsset?.symbol}</div>
                    </div>
                </div>

                <div className="p-4 sm:p-6 bg-[#0B0E11] rounded-3xl border border-[#2B3139] space-y-4">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                        <span className="text-gray-500">From Protocol</span>
                        <span className="text-gray-300">{amount} {fromAsset?.symbol}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                        <span className="text-gray-500">To Protocol</span>
                        <span className="text-emerald-500">{equivalentTarget} {toAsset?.symbol}</span>
                    </div>
                    <div className="pt-2 border-t border-white/5 flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                        <span className="text-gray-500">Execution Mode</span>
                        <span className="text-indigo-400 italic">INSTANT SETTLEMENT</span>
                    </div>
                </div>

                {swapError && (
                    <div className="p-4 bg-rose-900/20 border border-rose-500/30 rounded-2xl text-[9px] sm:text-[10px] text-rose-400 font-black uppercase text-center animate-pulse">
                        {swapError}
                    </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <button 
                        onClick={() => setShowDeposit(false)}
                        className="flex-1 py-4 sm:py-6 bg-[#181C25] text-gray-400 font-black uppercase italic tracking-widest rounded-3xl hover:text-white transition-all order-2 sm:order-1"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleManualSwap}
                        disabled={isSwapping}
                        className="flex-[2] py-4 sm:py-6 bg-indigo-600 text-white font-black uppercase italic tracking-widest rounded-3xl shadow-xl hover:bg-indigo-500 transition-all flex items-center justify-center space-x-3 order-1 sm:order-2"
                    >
                        {isSwapping ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                <span>Confirm Instant Swap</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </>
                        )}
                    </button>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 gap-8 items-start">
          <div className="space-y-4">
            {/* Swap Input Card */}
            <div className={`glass rounded-[40px] p-2 shadow-xl transition-all duration-500 hover:border-indigo-500/30 bg-[#181C25]/50`}>
              <div className="bg-[#1E2329] p-6 lg:p-8 rounded-[36px] border border-[#2B3139] space-y-6 shadow-sm">
                <div className="flex justify-between items-center px-1">
                   <span className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">Pay with</span>
                   <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => {
                            // Find relevant balance from wallet
                            const bal = wallet?.balances?.find(b => b.symbol === fromAsset?.symbol)?.amount || '0';
                            setAmount(bal);
                        }}
                        className="text-[9px] font-black text-indigo-500 hover:text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded"
                      >
                        MAX
                      </button>
                      <span className="text-[10px] text-gray-500 font-mono">~${(parseFloat(amount || '0') * (fromAsset?.price || 0)).toFixed(2)} USD</span>
                   </div>
                </div>
                <div className="flex items-center space-x-3 lg:space-x-4">
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="flex-1 bg-transparent text-3xl lg:text-4xl font-bold outline-none placeholder-gray-600 text-gray-100 min-w-0" />
                  <button 
                    onClick={() => openSelector('from')}
                    className="flex items-center space-x-2 bg-[#2B3139] hover:bg-[#363C45] px-3 lg:px-5 py-2 lg:py-3 rounded-2xl border border-[#2B3139] transition-all shrink-0"
                  >
                    <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-[10px] text-white shrink-0">{fromAsset?.symbol[0] || '?'}</div>
                    <span className="font-black text-sm text-gray-200">{fromAsset?.symbol || '...'}</span>
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </div>
              </div>

              <div className="flex justify-center -my-4 relative z-20">
                   <div className="w-10 h-10 lg:w-12 lg:h-12 bg-[#181C25] border-4 border-[#0B0E11] rounded-2xl flex items-center justify-center shadow-xl text-indigo-500 border-[#2B3139]">
                     <svg className="w-5 h-5 lg:w-6 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                   </div>
              </div>

              <div className="bg-[#1E2329] p-6 lg:p-8 rounded-[36px] border border-[#2B3139] space-y-6 shadow-sm">
                <div className="flex justify-between items-center px-1">
                   <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">Receive Equivalent</span>
                   <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">Protocol Settlement Rate</span>
                </div>
                <div className="flex items-center space-x-3 lg:space-x-4">
                  <div className="flex-1 text-3xl lg:text-4xl font-bold text-gray-100 font-mono truncate">
                    {equivalentTarget}
                  </div>
                  <button 
                    onClick={() => openSelector('to')}
                    className="flex items-center space-x-2 bg-[#0B0E11] hover:bg-[#181C25] px-3 lg:px-5 py-2 lg:py-3 rounded-2xl border border-[#2B3139] transition-all shrink-0"
                  >
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px] text-white shrink-0 ${toAsset?.symbol === 'USDT' ? 'bg-emerald-600' : 'bg-indigo-600'}`}>{toAsset?.symbol[0] || 'U'}</div>
                    <span className="font-black text-sm text-gray-200">{toAsset?.symbol || 'USDT'}</span>
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <button 
                    onClick={handleAction} 
                    disabled={isSwapping || !amount || parseFloat(amount) <= 0}
                    className={`w-full py-6 rounded-[28px] font-black text-lg transition-all shadow-xl uppercase italic tracking-widest ${isConnected ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-[#2B3139] hover:bg-[#363C45] text-gray-400'}`}
                >
                  {isSwapping ? (
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                  ) : (
                      isConnected ? (!amount || parseFloat(amount) <= 0 ? 'ENTER AMOUNT' : 'EXECUTE SWAP') : 'CONNECT TO SWAP'
                  )}
                </button>
                <div className="flex items-center justify-between px-2 text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">
                  <div className="flex items-center space-x-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span>Direct Link Active</span>
                  </div>
                  <span>Secured Node</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Asset Selector Modal */}
        {isSelectorOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
             <div className="absolute inset-0" onClick={() => setIsSelectorOpen(false)}></div>
             <div className="bg-[#181C25] rounded-[32px] w-full max-w-md border border-[#2B3139] shadow-2xl flex flex-col max-h-[70vh] relative z-10 animate-in zoom-in-95">
                <div className="p-6 border-b border-[#2B3139] space-y-4">
                   <div className="flex items-center justify-between">
                      <h3 className="text-xl font-black text-gray-100 uppercase italic tracking-tighter">Select Token</h3>
                      <button onClick={() => setIsSelectorOpen(false)} className="p-2 hover:bg-[#2B3139] rounded-full text-gray-500 hover:text-gray-100 transition-colors">
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                   </div>
                   <input 
                     type="text" 
                     placeholder="Search name or symbol..." 
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     className="w-full bg-[#0B0E11] border border-[#2B3139] rounded-2xl px-5 py-4 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 transition-all font-mono placeholder-gray-600"
                     autoFocus
                   />
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                   {filteredAssets.length > 0 ? (
                      filteredAssets.map(asset => (
                         <button 
                           key={asset.symbol} 
                           onClick={() => handleSelectAsset(asset)}
                           className={`w-full flex items-center justify-between p-4 hover:bg-[#2B3139] rounded-2xl transition-all group ${
                              (selectorSide === 'from' ? fromAsset?.symbol : toAsset?.symbol) === asset.symbol ? 'bg-indigo-900/20 border border-indigo-500/30' : 'border border-transparent'
                           }`}
                         >
                            <div className="flex items-center space-x-4">
                               <div className="w-10 h-10 bg-[#1E2329] rounded-xl flex items-center justify-center font-black text-[10px] text-gray-400 border border-[#363C45] shadow-sm">
                                  {asset.symbol[0]}
                               </div>
                               <div className="text-left">
                                  <div className="font-bold text-gray-200 text-sm">{asset.symbol}</div>
                                  <div className="text-[10px] text-gray-500 uppercase font-bold">{asset.name}</div>
                               </div>
                            </div>
                            <div className="text-right">
                               <div className="font-mono font-bold text-gray-200 text-sm">${asset.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                               <div className={`text-[9px] font-bold ${asset.change24h >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                  {asset.change24h > 0 ? '+' : ''}{asset.change24h}%
                               </div>
                            </div>
                         </button>
                      ))
                   ) : (
                      <div className="p-8 text-center text-gray-600 text-xs font-bold uppercase tracking-widest">
                         No assets found
                      </div>
                   )}
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SwapView;
