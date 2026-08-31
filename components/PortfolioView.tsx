
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { WalletData, Transaction, AssetInfo } from '../types';
import { Plus, Minus, ArrowRightLeft, ChevronRight, LayoutGrid, Clock, Menu, LogOut, Mail, Shield, X, Copy, CheckCircle, Upload, Globe, Camera } from 'lucide-react';
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
  const [activeModal, setActiveModal] = useState<'withdraw' | 'deposit' | 'kyc' | null>(null);
  const [showSpot, setShowSpot] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedCoin, setSelectedCoin] = useState<'BTC' | 'ETH' | 'SOL' | 'USDT'>('SOL');
  
  // KYC State
  const [kycStep, setKycStep] = useState<'country' | 'id_front' | 'id_back' | 'verifying'>('country');
  const [kycCountry, setKycCountry] = useState('');
  const [isKycVerified, setIsKycVerified] = useState(false);

  useEffect(() => {
    if (autoOpenDeposit) {
        setActiveModal('deposit');
        if (onOpenDepositHandled) onOpenDepositHandled();
    }
  }, [autoOpenDeposit]);

  if (!wallet) return null;

  const totalTradingBalance = wallet.trading_balance || 0;
  const totalSpotValue = protocolBalances.reduce((acc, curr) => acc + parseFloat(curr.valueUsd || 0), 0);

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

  const handleKycAutoVerify = () => {
      setKycStep('verifying');
      setTimeout(() => {
          setIsKycVerified(true);
          setActiveModal(null);
      }, 3000);
  };

  return (
    <div className="h-full overflow-y-auto bg-black text-white custom-scrollbar flex flex-col font-sans">
      
      <div className="flex-1 w-full max-w-md mx-auto p-6 space-y-10 pb-32 pt-8">
          
          {/* Main Balance Card */}
          <div className="text-center space-y-2 py-4">
              <div className="text-sm font-medium text-gray-500 uppercase tracking-[0.2em]">Total Balance</div>
              <div className="text-6xl font-bold tracking-tight text-white">
                  ${(totalTradingBalance + totalSpotValue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="flex items-center justify-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#10B981]/10 text-[#10B981] text-[10px] font-black uppercase tracking-widest">Secured Account</span>
              </div>
          </div>

          {/* Asset Action Buttons */}
          <div className="flex justify-around items-center px-2">
              <AssetAction label="Deposit" icon={<Plus size={24} />} onClick={() => setActiveModal('deposit')} />
              <AssetAction label="Withdraw" icon={<Minus size={24} />} onClick={() => setActiveModal('withdraw')} />
              <AssetAction label="To Spot" icon={<ArrowRightLeft size={24} />} onClick={() => setShowSpot(!showSpot)} />
          </div>

          {/* KYC BUTTON (Updated to user request) */}
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

          {/* Ledger / History */}
          <div className="space-y-6 pt-4">
              <div className="flex items-center justify-between px-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Transaction Ledger</span>
                  <div className="flex items-center gap-1 text-[9px] font-bold text-[#10B981] uppercase tracking-widest animate-pulse">
                      <Clock size={10} /> Live
                  </div>
              </div>
              <div className="text-center py-20 opacity-20 border border-white/5 rounded-[40px] border-dashed">
                  <Clock size={40} className="mx-auto mb-2" />
                  <span className="text-[9px] font-black uppercase tracking-[0.3em]">Swipe for full ledger</span>
              </div>
          </div>
      </div>

      {/* KYC MODAL (Auto-verifying) */}
      {activeModal === 'kyc' && (
          <div className="fixed inset-0 z-[2500] bg-white text-black animate-in slide-in-from-bottom duration-500 flex flex-col font-sans">
              <div className="p-6 flex justify-between items-center border-b border-gray-100">
                  <h2 className="text-xl font-black uppercase tracking-tighter">Identity Verification</h2>
                  <button onClick={() => setActiveModal(null)} className="p-2 bg-gray-100 rounded-full"><X size={24}/></button>
              </div>
              
              <div className="flex-1 p-8 flex flex-col justify-center max-w-md mx-auto w-full space-y-10">
                  {kycStep === 'country' && (
                      <div className="space-y-8 animate-in fade-in zoom-in duration-300">
                          <div className="text-center space-y-2">
                              <div className="w-20 h-20 bg-indigo-50 rounded-[32px] flex items-center justify-center mx-auto text-indigo-600"><Globe size={40}/></div>
                              <h3 className="text-2xl font-black uppercase tracking-tight">Select Country</h3>
                              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Where was your ID issued?</p>
                          </div>
                          <select 
                            value={kycCountry} 
                            onChange={e => { setKycCountry(e.target.value); setKycStep('id_front'); }}
                            className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-5 text-sm font-bold outline-none focus:border-indigo-500 transition-all shadow-inner"
                          >
                              <option value="">Choose Country...</option>
                              <option value="US">United States</option>
                              <option value="UK">United Kingdom</option>
                              <option value="CA">Canada</option>
                              <option value="DE">Germany</option>
                              <option value="FR">France</option>
                          </select>
                      </div>
                  )}

                  {(kycStep === 'id_front' || kycStep === 'id_back') && (
                      <div className="space-y-8 animate-in fade-in slide-in-from-right duration-300">
                          <div className="text-center space-y-2">
                              <div className="w-20 h-20 bg-indigo-50 rounded-[32px] flex items-center justify-center mx-auto text-indigo-600"><Camera size={40}/></div>
                              <h3 className="text-2xl font-black uppercase tracking-tight">{kycStep === 'id_front' ? 'ID Front' : 'ID Back'}</h3>
                              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Drivers License or Passport</p>
                          </div>
                          <div 
                            onClick={() => kycStep === 'id_front' ? setKycStep('id_back') : handleKycAutoVerify()}
                            className="aspect-[4/3] w-full bg-gray-50 border-2 border-dashed border-gray-200 rounded-[40px] flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/30 transition-all group"
                          >
                              <Upload size={48} className="text-gray-300 group-hover:text-indigo-500" />
                              <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Tap to upload / capture</span>
                          </div>
                      </div>
                  )}

                  {kycStep === 'verifying' && (
                      <div className="text-center space-y-6 animate-in fade-in duration-300">
                          <div className="relative w-32 h-32 mx-auto">
                              <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                              <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                              <div className="absolute inset-0 flex items-center justify-center text-indigo-600"><Shield size={48}/></div>
                          </div>
                          <div className="space-y-2">
                              <h3 className="text-2xl font-black uppercase tracking-tight italic">Analyzing ID</h3>
                              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] animate-pulse">Neural verification in progress...</p>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* DEPOSIT MODAL */}
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
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Network: {selectedCoin === 'BTC' ? 'Bitcoin' : (selectedCoin === 'ETH' ? 'ERC-20' : (selectedCoin === 'USDT' ? 'TRC-20/SOL' : 'Solana'))}</span>
                          <div className="bg-gray-100 p-4 rounded-2xl flex items-center gap-4 max-w-sm mx-auto">
                              <span className="text-xs font-mono font-bold break-all text-center">{getAddr()}</span>
                              <button onClick={() => copyToClipboard(getAddr())} className="p-2 bg-white rounded-lg shadow-sm text-gray-500 hover:text-black shrink-0">{copied ? <CheckCircle size={16} className="text-emerald-500"/> : <Copy size={16}/>}</button>
                          </div>
                      </div>
                  </div>

                  <div className="bg-emerald-50 p-6 rounded-[32px] space-y-2 border border-emerald-100 max-w-md mx-auto">
                      <div className="flex items-center gap-2 text-emerald-600">
                          <Shield size={16}/>
                          <span className="text-[10px] font-black uppercase tracking-widest">Institutional Security</span>
                      </div>
                      <p className="text-[11px] text-emerald-800 font-medium leading-relaxed">
                          Your deposit will reflect in your **Spot Account** after 3 network confirmations. Swap to USDT to reflect in **Trading Account**.
                      </p>
                  </div>
              </div>
          </div>
      )}

      {/* WITHDRAW MODAL */}
      {activeModal === 'withdraw' && (
          <div className="fixed inset-0 z-[2000] bg-white text-black animate-in slide-in-from-bottom duration-500 flex flex-col font-sans">
              <div className="p-6 flex justify-between items-center border-b border-gray-100">
                  <h2 className="text-xl font-black uppercase tracking-tighter">Withdraw Funds</h2>
                  <button onClick={() => setActiveModal(null)} className="p-2 bg-gray-100 rounded-full"><X size={24}/></button>
              </div>
              <div className="flex-1 p-8 space-y-8 max-w-md mx-auto w-full">
                  <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Asset to Withdraw</label>
                      <div className="grid grid-cols-2 gap-3">
                        {['BTC', 'ETH', 'SOL', 'USDT'].map(c => (
                            <button key={c} onClick={() => setSelectedCoin(c as any)} className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${selectedCoin === c ? 'bg-black border-black text-white shadow-xl' : 'bg-white border-gray-100 text-gray-400'}`}>
                                <span className="font-bold">{c}</span>
                                {selectedCoin === c && <CheckCircle size={16}/>}
                            </button>
                        ))}
                      </div>
                  </div>

                  <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Destination Address</label>
                      <input type="text" placeholder="Paste your wallet address" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-5 text-sm font-mono font-bold outline-none focus:border-black transition-all shadow-inner" />
                  </div>

                  <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Amount</label>
                      <div className="relative">
                          <input type="text" placeholder="0.00" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-5 text-2xl font-bold outline-none focus:border-black transition-all shadow-inner" />
                          <button className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100">Max</button>
                      </div>
                  </div>

                  <button className="w-full py-6 bg-black text-white font-black uppercase italic tracking-[0.2em] rounded-[32px] shadow-2xl active:scale-95 transition-all mt-4">
                      Initialize Withdrawal
                  </button>

                  <p className="text-center text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                      Processing typically takes 5-15 minutes
                  </p>
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
