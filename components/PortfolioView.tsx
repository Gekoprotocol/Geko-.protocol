
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { WalletData, Transaction, AssetInfo } from '../types';
import { Plus, Minus, ArrowRightLeft, ChevronRight, LayoutGrid, Clock, Menu, LogOut, Mail, Shield, X, Copy, CheckCircle, Upload, Globe, Camera, Zap, RefreshCw } from 'lucide-react';
import { authService } from '../services/authService';

interface PortfolioViewProps {
  wallet: WalletData | null;
  assets: AssetInfo[];
  protocolBalances?: any[];
  depositAddress?: string;
  onConnect: () => void;
  onUpdateWallet: (data: WalletData) => void;
  onDisconnect: () => void;
  onRefreshBalances: () => void;
  autoOpenDeposit?: boolean;
  onOpenDepositHandled?: () => void;
  autoOpenTransfer?: boolean;
  onOpenTransferHandled?: () => void;
  protocolConfig?: any;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({ 
    wallet, 
    assets, 
    protocolBalances = [],
    onRefreshBalances,
    autoOpenDeposit,
    onOpenDepositHandled,
    protocolConfig,
    onUpdateWallet
}) => {
  const [activeModal, setActiveModal] = useState<'withdraw' | 'deposit' | 'kyc' | 'transfer' | null>(null);
  const [showSpot, setShowSpot] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedCoin, setSelectedCoin] = useState<'BTC' | 'ETH' | 'SOL' | 'USDT'>('SOL');
  
  // KYC State
  const [kycStep, setKycStep] = useState<'country' | 'id_front' | 'id_back' | 'verifying'>('country');
  const [kycCountry, setKycCountry] = useState('');
  const [isKycVerified, setIsKycVerified] = useState(wallet?.kyc_status === 'approved');

  // Ledger State
  const [txs, setTxs] = useState<any[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(true);

  // Transfer State
  const [transferAmount, setTransferAmount] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferDirection, setTransferDirection] = useState<'vault_to_trade' | 'trade_to_vault'>('vault_to_trade');

  // Withdrawal State
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  useEffect(() => {
    if (autoOpenDeposit) {
        setActiveModal('deposit');
        if (onOpenDepositHandled) onOpenDepositHandled();
    }
  }, [autoOpenDeposit]);

  const fetchHistory = async () => {
    if (!wallet?.address) return;
    try {
        const res = await fetch(`/api/user/transactions?address=${wallet.address}`);
        if (res.ok) {
            const data = await res.json();
            setTxs(data.transactions || []);
        }
    } catch (e) {} finally { setLoadingLedger(false); }
  };

  useEffect(() => {
    fetchHistory();
    const int = setInterval(fetchHistory, 10000);
    return () => clearInterval(int);
  }, [wallet?.address]);

  if (!wallet) return null;

  const totalTradingBalance = wallet.trading_balance || 0;
  const totalSpotValue = protocolBalances.reduce((acc, curr) => acc + parseFloat(curr.valueUsd || 0), 0);
  const usdtSpotBalance = protocolBalances.find(b => b.asset === 'USDT')?.balance || 0;

  const getAddr = () => {
      if (selectedCoin === 'BTC') return protocolConfig?.btc_deposit_address || 'Pending...';
      if (selectedCoin === 'ETH') return protocolConfig?.eth_deposit_address || 'Pending...';
      if (selectedCoin === 'USDT') return protocolConfig?.usdt_deposit_address || 'Pending...';
      return protocolConfig?.solana_deposit_address || '6HmBxJuv9f5P92am6AK18KZGkHGqbNUazYXXKhvrDviw';
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  const handleStartKyc = () => {
      if (isKycVerified) return;
      setActiveModal('kyc');
      setKycStep('country');
  };

  const handleKycSubmit = async () => {
      setKycStep('verifying');
      try {
          await fetch('/api/kyc/submit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  walletAddress: wallet.address,
                  country: kycCountry,
                  idFront: 'simulated_front_id_url',
                  idBack: 'simulated_back_id_url'
              })
          });
          setTimeout(() => {
              setIsKycVerified(true);
              setActiveModal(null);
              onRefreshBalances();
          }, 3000);
      } catch (e) {
          setKycStep('country');
      }
  };

  const handleTransfer = async () => {
      if (!transferAmount || isTransferring) return;
      setIsTransferring(true);
      try {
          const res = await fetch('/api/balance/transfer', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  walletAddress: wallet.address,
                  amount: transferAmount,
                  direction: transferDirection
              })
          });
          if (res.ok) {
              setActiveModal(null);
              setTransferAmount('');
              onRefreshBalances();
          }
      } catch (e) {
      } finally {
          setIsTransferring(false);
      }
  };

  const handleWithdraw = async () => {
      if (!withdrawAmount || !withdrawAddress || isWithdrawing) return;
      setIsWithdrawing(true);
      try {
          const res = await fetch('/api/request-withdrawal', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  walletAddress: wallet.address,
                  destinationAddress: withdrawAddress,
                  amount: withdrawAmount,
                  asset: selectedCoin
              })
          });
          if (res.ok) {
              setActiveModal(null);
              setWithdrawAmount('');
              setWithdrawAddress('');
              onRefreshBalances();
          }
      } catch (e) {
      } finally {
          setIsWithdrawing(false);
      }
  };

  return (
    <div className="h-full overflow-y-auto bg-black text-white custom-scrollbar flex flex-col font-sans">
      
      <div className="flex-1 w-full max-w-md mx-auto p-6 space-y-10 pb-32 pt-8">
          
          {/* Main Balance Card */}
          <div className="text-center space-y-4 py-4">
              <div className="text-sm font-medium text-gray-500 uppercase tracking-[0.2em]">Total Balance</div>
              <div className="text-6xl font-bold tracking-tight text-white">
                  ${(totalTradingBalance + totalSpotValue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="flex flex-col items-center gap-4">
                  <span className="px-2 py-0.5 rounded bg-[#10B981]/10 text-[#10B981] text-[10px] font-black uppercase tracking-widest">Secured Account</span>
                  <div className="flex gap-3">
                      <button 
                        onClick={() => { setTransferDirection('vault_to_trade'); setActiveModal('transfer'); }}
                        className="bg-[#10B981] text-black px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
                      >
                          Deposit to Trading
                      </button>
                      <button 
                        onClick={() => { setTransferDirection('trade_to_vault'); setActiveModal('transfer'); }}
                        className="bg-white/10 text-white px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all border border-white/5"
                      >
                          Withdraw to Vault
                      </button>
                  </div>
              </div>
          </div>

          {/* Asset Action Buttons */}
          <div className="flex justify-around items-center px-2">
              <AssetAction label="Deposit" icon={<Plus size={24} />} onClick={() => setActiveModal('deposit')} />
              <AssetAction label="Withdraw" icon={<Minus size={24} />} onClick={() => setActiveModal('withdraw')} />
              <AssetAction label="To Spot" icon={<ArrowRightLeft size={24} />} onClick={() => setShowSpot(!showSpot)} />
          </div>

          {/* KYC BUTTON */}
          <button 
            onClick={handleStartKyc}
            className={`w-full p-5 rounded-[28px] border flex items-center justify-between transition-all ${isKycVerified ? 'bg-[#10B981]/10 border-[#10B981]/20' : 'bg-[#111111] border-white/5 hover:bg-[#1A1A1A]'}`}
          >
              <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${isKycVerified ? 'bg-[#10B981] text-black border-[#10B981]' : 'bg-indigo-600/10 text-indigo-400 border-indigo-500/10'}`}>
                      {isKycVerified ? <CheckCircle size={24} /> : <Shield size={24} />}
                  </div>
                  <div className="text-left">
                      <div className="text-sm font-bold text-white uppercase tracking-tight">{isKycVerified ? 'Verified' : 'Verify KYC'}</div>
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{isKycVerified ? 'Identity Confirmed ✓' : 'Institutional Attestation Required'}</div>
                  </div>
              </div>
              {!isKycVerified && <ChevronRight size={20} className="text-gray-600" />}
          </button>

          {/* Spot Account Section */}
          <div className="space-y-4">
            <button 
                onClick={() => setShowSpot(!showSpot)}
                className="w-full bg-[#111111] border border-white/5 p-5 rounded-[28px] flex items-center justify-between group hover:bg-[#1A1A1A] transition-all"
            >
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-600/10 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-500/10">
                        <LayoutGrid size={24} />
                    </div>
                    <div className="text-left">
                        <div className="text-sm font-bold text-white uppercase tracking-tight">Spot Account</div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">${totalSpotValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </div>
                </div>
                <ChevronRight size={20} className={`text-gray-600 transition-transform duration-300 ${showSpot ? 'rotate-90 text-white' : ''}`} />
            </button>

            {showSpot && (
                <div className="space-y-3 animate-in slide-in-from-top-4 duration-300">
                    {protocolBalances.length > 0 ? protocolBalances.map((b: any) => (
                        <div key={b.asset} className="flex items-center justify-between p-4 bg-[#0A0A0A] border border-white/5 rounded-2xl">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-indigo-600/20 rounded-lg flex items-center justify-center text-[10px] font-black italic">{b.asset[0]}</div>
                                <span className="font-bold text-gray-200">{b.asset}</span>
                            </div>
                            <div className="text-right">
                                <div className="font-mono font-bold text-white">${parseFloat(b.valueUsd || 0).toLocaleString()}</div>
                                <div className="text-[8px] text-gray-500 uppercase font-black">{b.balance} {b.asset}</div>
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-8 text-[10px] font-black text-gray-600 uppercase tracking-widest bg-[#0A0A0A] rounded-2xl border border-dashed border-white/5">No Spot Assets Found</div>
                    )}
                </div>
            )}
          </div>

          {/* Ledger / History Integrated */}
          <div className="space-y-6 pt-4">
              <div className="flex items-center justify-between px-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Node Ledger</span>
                  <div className="flex items-center gap-1 text-[9px] font-bold text-[#10B981] uppercase tracking-widest animate-pulse">
                      <Clock size={10} /> Live Stream
                  </div>
              </div>
              
              <div className="space-y-3">
                  {txs.slice(0, 10).map((tx) => (
                      <div key={tx.id} className="bg-[#111111] border border-white/5 p-5 rounded-[24px] flex items-center justify-between">
                          <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-black border border-white/5 rounded-xl flex items-center justify-center">
                                  {tx.type === 'deposit' ? <Zap size={14} className="text-emerald-500" /> : <RefreshCw size={14} className="text-indigo-400" />}
                              </div>
                              <div className="text-left">
                                  <div className="text-sm font-bold text-white uppercase tracking-tight">
                                      {tx.type === 'deposit' ? 'Funded' : (tx.type === 'swap' ? 'Swap' : (tx.type === 'trade' ? 'Trade' : tx.type))}
                                  </div>
                                  <div className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">{new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                              </div>
                          </div>
                          <div className="text-right">
                              <div className={`text-sm font-bold tabular-nums ${parseFloat(tx.amount) >= 0 ? 'text-[#10B981]' : 'text-rose-500'}`}>
                                  {parseFloat(tx.amount) >= 0 ? '+' : ''}{parseFloat(tx.amount).toLocaleString()}
                              </div>
                              <div className="text-[9px] text-gray-600 font-black uppercase">{tx.asset_symbol}</div>
                          </div>
                      </div>
                  ))}
                  {txs.length === 0 && !loadingLedger && (
                      <div className="text-center py-20 opacity-20 border border-white/5 rounded-[40px] border-dashed">
                          <Clock size={40} className="mx-auto mb-2" />
                          <span className="text-[9px] font-black uppercase tracking-[0.3em]">Institutional Records Clear</span>
                      </div>
                  )}
              </div>
          </div>
      </div>

      {/* MODALS */}
      {activeModal === 'deposit' && (
          <div className="fixed inset-0 z-[2000] bg-white text-black animate-in slide-in-from-bottom duration-500 flex flex-col font-sans">
              <div className="p-6 flex justify-between items-center border-b border-gray-100">
                  <h2 className="text-xl font-black uppercase tracking-tighter">Deposit Funds</h2>
                  <button onClick={() => setActiveModal(null)} className="p-2 bg-gray-100 rounded-full"><X size={24}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-10">
                  <div className="flex justify-center gap-4">
                      {['SOL', 'BTC', 'ETH', 'USDT'].map(c => (
                          <button key={c} onClick={() => setSelectedCoin(c as any)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedCoin === c ? 'bg-black text-white shadow-xl scale-110' : 'bg-gray-100 text-gray-400'}`}>{c}</button>
                      ))}
                  </div>
                  <div className="flex flex-col items-center space-y-6">
                      <div className="bg-white p-6 rounded-[40px] shadow-2xl border border-gray-100">
                          <QRCodeSVG value={getAddr()} size={200} level="H" includeMargin />
                      </div>
                      <div className="text-center space-y-2">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Network: {selectedCoin}</span>
                          <div className="bg-gray-100 p-4 rounded-2xl flex items-center gap-4 max-w-sm mx-auto">
                              <span className="text-xs font-mono font-bold break-all text-center">{getAddr()}</span>
                              <button onClick={() => copyToClipboard(getAddr())} className="p-2 bg-white rounded-lg shadow-sm text-gray-500 hover:text-black shrink-0">{copied ? <CheckCircle size={16} className="text-emerald-500"/> : <Copy size={16}/>}</button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {activeModal === 'transfer' && (
          <div className="fixed inset-0 z-[2000] bg-white text-black animate-in slide-in-from-bottom duration-500 flex flex-col font-sans">
              <div className="p-6 flex justify-between items-center border-b border-gray-100">
                  <h2 className="text-xl font-black uppercase tracking-tighter text-black">Internal Transfer</h2>
                  <button onClick={() => setActiveModal(null)} className="p-2 bg-gray-100 rounded-full"><X size={24}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                  <div className="bg-gray-50 p-6 rounded-[32px] space-y-4">
                      <div className="flex justify-between text-[10px] font-black uppercase text-gray-400">
                          <span>From {transferDirection === 'vault_to_trade' ? 'Spot' : 'Trading'} (USDT)</span>
                          <span>Available: {transferDirection === 'vault_to_trade' ? usdtSpotBalance : totalTradingBalance}</span>
                      </div>
                      <input 
                        type="text" 
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                        placeholder="0.00" 
                        className="w-full bg-transparent text-4xl font-bold outline-none text-black" 
                      />
                  </div>
                  <div className="flex justify-center -my-6 relative z-10">
                      <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center text-white border-4 border-white shadow-xl">
                          <ArrowRightLeft size={20} className={transferDirection === 'vault_to_trade' ? 'rotate-90' : '-rotate-90'} />
                      </div>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-[32px] space-y-2">
                      <div className="text-[10px] font-black uppercase text-gray-400">To {transferDirection === 'vault_to_trade' ? 'Trading' : 'Spot'} (USDT)</div>
                      <div className="text-2xl font-bold text-gray-300">INSTANT SETTLEMENT</div>
                  </div>
                  <button 
                    onClick={handleTransfer}
                    disabled={isTransferring || !transferAmount}
                    className="w-full py-6 bg-black text-white font-black uppercase italic tracking-[0.2em] rounded-[32px] shadow-2xl disabled:opacity-20"
                  >
                      {isTransferring ? 'Processing...' : 'Execute Transfer'}
                  </button>
              </div>
          </div>
      )}

      {activeModal === 'withdraw' && (
          <div className="fixed inset-0 z-[2000] bg-white text-black animate-in slide-in-from-bottom duration-500 flex flex-col font-sans">
              <div className="p-6 flex justify-between items-center border-b border-gray-100">
                  <h2 className="text-xl font-black uppercase tracking-tighter">Withdraw Funds</h2>
                  <button onClick={() => setActiveModal(null)} className="p-2 bg-gray-100 rounded-full"><X size={24}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                  <div className="flex justify-center gap-4">
                      {['SOL', 'BTC', 'ETH', 'USDT'].map(c => (
                          <button key={c} onClick={() => setSelectedCoin(c as any)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedCoin === c ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'}`}>{c}</button>
                      ))}
                  </div>
                  <div className="space-y-4">
                      <div className="bg-gray-50 p-6 rounded-[32px] space-y-2">
                          <label className="text-[10px] font-black uppercase text-gray-400">Withdraw Amount</label>
                          <input 
                            type="text" 
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value)}
                            placeholder="0.00" 
                            className="w-full bg-transparent text-3xl font-bold outline-none text-black" 
                          />
                      </div>
                      <div className="bg-gray-50 p-6 rounded-[32px] space-y-2">
                          <label className="text-[10px] font-black uppercase text-gray-400">Destination Address</label>
                          <textarea 
                            value={withdrawAddress}
                            onChange={(e) => setWithdrawAddress(e.target.value)}
                            placeholder="Enter Wallet Address" 
                            className="w-full bg-transparent text-xs font-mono font-bold outline-none text-black min-h-[80px] resize-none"
                          />
                      </div>
                  </div>
                  <button 
                    onClick={handleWithdraw}
                    disabled={isWithdrawing || !withdrawAmount || !withdrawAddress}
                    className="w-full py-6 bg-black text-white font-black uppercase italic tracking-[0.2em] rounded-[32px] shadow-2xl disabled:opacity-20"
                  >
                      {isWithdrawing ? 'Syncing...' : 'Initiate Withdrawal'}
                  </button>
                  {/* Padding to ensure swipe up works on mobile keyboards */}
                  <div className="h-32"></div>
              </div>
          </div>
      )}

      {activeModal === 'kyc' && (
          <div className="fixed inset-0 z-[2000] bg-white text-black animate-in slide-in-from-bottom duration-500 flex flex-col font-sans">
              <div className="p-6 flex justify-between items-center border-b border-gray-100">
                  <h2 className="text-xl font-black uppercase tracking-tighter">Institutional KYC</h2>
                  <button onClick={() => setActiveModal(null)} className="p-2 bg-gray-100 rounded-full"><X size={24}/></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                  {kycStep === 'country' && (
                      <div className="space-y-6 animate-in fade-in duration-300">
                          <div className="text-center space-y-2">
                              <h3 className="text-lg font-black uppercase italic">Step 1: Jurisdiction</h3>
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Select your primary node location</p>
                          </div>
                          <select 
                            value={kycCountry}
                            onChange={(e) => setKycCountry(e.target.value)}
                            className="w-full bg-gray-100 p-6 rounded-[32px] text-sm font-bold uppercase tracking-widest outline-none border-4 border-transparent focus:border-black transition-all appearance-none text-center"
                          >
                              <option value="">Select Country</option>
                              <option value="US">United States</option>
                              <option value="UK">United Kingdom</option>
                              <option value="EU">European Union</option>
                              <option value="AS">Asia Pacific</option>
                          </select>
                          <button onClick={() => setKycStep('id_front')} disabled={!kycCountry} className="w-full py-6 bg-black text-white font-black uppercase tracking-widest rounded-[32px] disabled:opacity-20">Continue to ID</button>
                      </div>
                  )}

                  {(kycStep === 'id_front' || kycStep === 'id_back') && (
                      <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
                          <div className="text-center space-y-2">
                              <h3 className="text-lg font-black uppercase italic">Step 2: Documentation</h3>
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                  Upload {kycStep === 'id_front' ? 'FRONT' : 'BACK'} of Identity Card
                              </p>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                              <div 
                                onClick={() => kycStep === 'id_front' ? setKycStep('id_back') : handleKycSubmit()}
                                className="aspect-square bg-gray-50 rounded-[32px] border-4 border-dashed border-gray-200 flex flex-col items-center justify-center space-y-3 hover:border-black transition-all cursor-pointer group"
                              >
                                  <Camera size={32} className="text-gray-300 group-hover:text-black" />
                                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Take Photo</span>
                              </div>
                              <div 
                                onClick={() => kycStep === 'id_front' ? setKycStep('id_back') : handleKycSubmit()}
                                className="aspect-square bg-gray-50 rounded-[32px] border-4 border-dashed border-gray-200 flex flex-col items-center justify-center space-y-3 hover:border-black transition-all cursor-pointer group"
                              >
                                  <Upload size={32} className="text-gray-300 group-hover:text-black" />
                                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">From Gallery</span>
                              </div>
                          </div>

                          <div className="flex gap-3 pt-4">
                              <button onClick={() => setKycStep(kycStep === 'id_front' ? 'country' : 'id_front')} className="flex-1 py-4 bg-gray-100 text-black font-black uppercase tracking-widest rounded-2xl text-[10px]">Back</button>
                          </div>
                      </div>
                  )}

                  {kycStep === 'verifying' && (
                      <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-in zoom-in duration-500">
                          <div className="w-24 h-24 border-8 border-gray-100 border-t-black rounded-full animate-spin"></div>
                          <div className="text-center space-y-2">
                              <h3 className="text-xl font-black uppercase italic tracking-tighter">AI Verification In Progress</h3>
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest animate-pulse">Running Neural Attestation...</p>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};

const AssetAction = ({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) => (
    <button onClick={onClick} className="flex flex-col items-center gap-3 group">
        <div className="w-16 h-16 bg-[#1A1A1A] rounded-full flex items-center justify-center text-white border border-white/5 group-hover:bg-[#222222] transition-all shadow-xl">
            {icon}
        </div>
        <span className="text-xs font-bold text-gray-400 group-hover:text-white transition-colors uppercase tracking-widest">{label}</span>
    </button>
);
