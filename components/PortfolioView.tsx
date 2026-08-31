
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { WalletData, Transaction, AssetInfo } from '../types';
import { Plus, Minus, ArrowRightLeft, ChevronRight, LayoutGrid, Clock, Menu, LogOut, Mail, Shield, X, Copy, CheckCircle } from 'lucide-react';
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
    protocolConfig
}) => {
  const [activeModal, setActiveModal] = useState<'withdraw' | 'deposit' | null>(null);
  const [showSpot, setShowSpot] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedCoin, setSelectedCoin] = useState<'BTC' | 'ETH' | 'SOL' | 'USDT'>('SOL');

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

      {/* DEPOSIT MODAL (The White Page) */}
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
                          <div className="bg-gray-100 p-4 rounded-2xl flex items-center gap-4 max-w-sm">
                              <span className="text-xs font-mono font-bold break-all text-center">{getAddr()}</span>
                              <button onClick={() => copyToClipboard(getAddr())} className="p-2 bg-white rounded-lg shadow-sm text-gray-500 hover:text-black">{copied ? <CheckCircle size={16} className="text-emerald-500"/> : <Copy size={16}/>}</button>
                          </div>
                      </div>
                  </div>

                  <div className="bg-emerald-50 p-6 rounded-[32px] space-y-2 border border-emerald-100">
                      <div className="flex items-center gap-2 text-emerald-600">
                          <Shield size={16}/>
                          <span className="text-[10px] font-black uppercase">Institutional Security</span>
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
              <div className="flex-1 p-8 space-y-8">
                  <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Asset to Withdraw</label>
                      <div className="grid grid-cols-2 gap-3">
                        {['USDT', 'SOL'].map(c => (
                            <button key={c} onClick={() => setSelectedCoin(c as any)} className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${selectedCoin === c ? 'bg-black border-black text-white shadow-xl' : 'bg-white border-gray-100 text-gray-400'}`}>
                                <span className="font-bold">{c}</span>
                                {selectedCoin === c && <CheckCircle size={16}/>}
                            </button>
                        ))}
                      </div>
                  </div>

                  <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Destination Address</label>
                      <input type="text" placeholder="Paste your wallet address" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-5 text-sm font-mono font-bold outline-none focus:border-black transition-all" />
                  </div>

                  <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Amount</label>
                      <div className="relative">
                          <input type="text" placeholder="0.00" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-5 text-2xl font-bold outline-none focus:border-black transition-all" />
                          <button className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg">Max</button>
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
