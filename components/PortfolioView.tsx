
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { WalletData, Transaction, AssetInfo } from '../types';
import { Plus, Minus, ArrowRightLeft, ChevronRight, LayoutGrid, Clock, MoreVertical, LogOut, Mail, Shield } from 'lucide-react';
import { universalWallet } from '../services/universalWallet';
import { audioSynth } from '../services/audioSynth';
import { authService } from '../services/authService';

interface PortfolioViewProps {
  wallet: WalletData | null;
  assets: AssetInfo[];
  depositAddress: string;
  onConnect: () => void;
  onUpdateWallet: (data: WalletData) => void;
  onDisconnect: () => void;
  onRefreshBalances: () => void;
  autoOpenDeposit?: boolean;
  autoOpenTransfer?: boolean;
  onOpenDepositHandled?: () => void;
  onOpenTransferHandled?: () => void;
  protocolConfig?: any;
  protocolBalances?: any[];
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({ 
    wallet, 
    assets, 
    depositAddress, 
    onConnect, 
    onUpdateWallet, 
    onDisconnect, 
    onRefreshBalances,
    autoOpenDeposit,
    autoOpenTransfer,
    onOpenDepositHandled,
    onOpenTransferHandled,
    protocolConfig,
    protocolBalances = []
}) => {
  const [showProfile, setShowProfile] = useState(false);
  const [showSpot, setShowSpot] = useState(false);
  const [activeModal, setActiveModal] = useState<'withdraw' | 'deposit' | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);

  if (!wallet) return null;

  const totalTradingBalance = wallet.trading_balance || 0;
  const spotBalances = protocolBalances || [];
  const totalSpotValue = spotBalances.reduce((acc, curr) => acc + parseFloat(curr.valueUsd || 0), 0);

  return (
    <div className="h-full overflow-y-auto bg-black text-white custom-scrollbar flex flex-col font-sans">
      
      {/* Header with Profile Dropdown */}
      <div className="p-6 flex justify-between items-center sticky top-0 bg-black/80 backdrop-blur-xl z-50">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-xs font-black italic shadow-lg">GK</div>
             <span className="text-sm font-bold uppercase tracking-widest text-gray-400">Assets</span>
          </div>
          <div className="relative">
              <button onClick={() => setShowProfile(!showProfile)} className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-500">
                  <MoreVertical size={24} />
              </button>
              
              {showProfile && (
                  <div className="absolute top-full right-0 mt-2 w-64 bg-[#1A1A1A] border border-white/5 rounded-[24px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                      <div className="p-6 space-y-4">
                          <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center text-indigo-400"><Shield size={20}/></div>
                              <div className="min-w-0">
                                  <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Active Node</div>
                                  <div className="text-xs font-bold text-gray-100 truncate">{wallet.address}</div>
                              </div>
                          </div>
                          {wallet.email && (
                              <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-emerald-600/20 rounded-xl flex items-center justify-center text-emerald-400"><Mail size={20}/></div>
                                  <div className="min-w-0">
                                      <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Verified Email</div>
                                      <div className="text-xs font-bold text-gray-100 truncate">{wallet.email}</div>
                                  </div>
                              </div>
                          )}
                          <button 
                            onClick={() => { authService.logout(); window.location.href = '/'; }}
                            className="w-full flex items-center justify-between p-4 bg-black/40 hover:bg-rose-950/20 rounded-2xl transition-all group"
                          >
                              <span className="text-xs font-bold text-gray-400 group-hover:text-rose-500">Back to Login</span>
                              <LogOut size={16} className="text-gray-600 group-hover:text-rose-500"/>
                          </button>
                      </div>
                  </div>
              )}
          </div>
      </div>

      <div className="flex-1 w-full max-w-md mx-auto p-6 space-y-10 pb-32">
          
          {/* Main Balance Card */}
          <div className="text-center space-y-2 py-4">
              <div className="text-sm font-medium text-gray-500 uppercase tracking-[0.2em]">Total Balance</div>
              <div className="text-6xl font-bold tracking-tight text-white">
                  ${(totalTradingBalance + totalSpotValue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="flex items-center justify-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-[#10B981] text-[10px] font-black uppercase tracking-widest">Live Node</span>
              </div>
          </div>

          {/* Asset Action Buttons */}
          <div className="flex justify-around items-center px-2">
              <AssetAction label="Deposit" icon={<Plus size={24} />} onClick={() => setActiveModal('deposit')} />
              <AssetAction label="Withdraw" icon={<Minus size={24} />} onClick={() => setActiveModal('withdraw')} />
              <AssetAction label="To Spot" icon={<ArrowRightLeft size={24} />} onClick={() => setShowTransferModal(true)} />
          </div>

          {/* Spot Account Toggle */}
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
                  {spotBalances.map((b: any) => (
                      <div key={b.symbol} className="flex items-center justify-between p-4 bg-[#0A0A0A] border border-white/5 rounded-2xl">
                          <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-indigo-600/20 rounded-lg flex items-center justify-center text-[10px] font-black italic">{b.symbol[0]}</div>
                              <span className="font-bold text-gray-200">{b.symbol}</span>
                          </div>
                          <span className="font-mono font-bold text-white">${parseFloat(b.valueUsd).toLocaleString()}</span>
                      </div>
                  ))}
              </div>
          )}

          {/* Transaction Ledger Section (Swipeable) */}
          <div className="space-y-6 pt-4">
              <div className="flex items-center justify-between px-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Node Ledger</span>
                  <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-500 uppercase tracking-widest animate-pulse">
                      <Clock size={10} /> Live Updates
                  </div>
              </div>

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {/* Ledger content would go here, matching the visual style */}
                  <div className="text-center py-10 opacity-30">
                      <Clock size={40} className="mx-auto mb-2" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">Swipe down for full ledger</span>
                  </div>
              </div>
          </div>

      </div>
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
