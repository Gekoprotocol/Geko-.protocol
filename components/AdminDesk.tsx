import React, { useState, useEffect, useRef, useMemo } from 'react';
import { WalletData, ActiveTrade } from '../types';
import { authService, UserRecord } from '../services/authService';

interface UserCardProps {
  user: any;
  onSave: (user: any, balance: any) => void;
  onDelete: (userId: number) => void;
  onLogoutUser: (userId: number) => void;
  onCreditBalance: (walletAddress: string, currency: string, amount: string) => Promise<void>;
  savingId: string | null;
  savedId: string | null;
}

const UserCard: React.FC<UserCardProps> = ({ user, onSave, onDelete, onLogoutUser, onCreditBalance, savingId, savedId }) => {
  const currentBalance = user.trading_balance ?? '0.00';
  const currentDemoBalance = user.demo_balance ?? '100000.00';
  const currentProtocolBalance = user.protocol_settlement_balance ?? '0.00';
  
  const [localBal, setLocalBal] = useState(String(currentBalance));
  const [localDemoBal, setLocalDemoBal] = useState(String(currentDemoBalance));
  const [localProtocolBal, setLocalProtocolBal] = useState(String(currentProtocolBalance));
  const [localSwapSent, setLocalSwapSent] = useState(user.swap_sent || false);
  
  const [depositCurrency, setDepositCurrency] = useState(user.pending_deposit_currency || 'BTC');
  const [depositAmount, setDepositAmount] = useState(user.pending_deposit_amount || '0');
  const [isCrediting, setIsCrediting] = useState(false);
  
  const uid = (user.id || user.wallet_address || 'unknown').toString();

  const handleCreditBalance = async (target: 'spot' | 'trade') => {
      if (!parseFloat(depositAmount)) return;
      setIsCrediting(true);
      try {
          await onCreditBalance(user.wallet_address, depositCurrency, depositAmount, target);
          setLocalSwapSent(false);
          setDepositAmount('0');
      } finally {
          setIsCrediting(false);
      }
  };

  useEffect(() => {
    setLocalBal(String(currentBalance));
    setLocalDemoBal(String(currentDemoBalance));
    setLocalProtocolBal(String(currentProtocolBalance));
    setLocalSwapSent(user.swap_sent || false);
  }, [currentBalance, currentDemoBalance, currentProtocolBalance, user.swap_sent]);

  const lastSeenMs = user.last_seen ? Date.now() - new Date(user.last_seen).getTime() : Infinity;
  const isOnline = lastSeenMs < 90_000;

  const handleUpdate = () => {
    const processAdditive = (val: string, current: string) => {
      if (typeof val !== 'string') return val;
      if (val.startsWith('+')) {
        const add = parseFloat(val.substring(1).replace(/,/g, ''));
        return (parseFloat(current) + (isNaN(add) ? 0 : add)).toString();
      }
      if (val.startsWith('-')) {
        const sub = parseFloat(val.substring(1).replace(/,/g, ''));
        return (parseFloat(current) - (isNaN(sub) ? 0 : sub)).toString();
      }
      return val.replace(/,/g, '');
    };

    onSave(user, { 
      trading_balance: processAdditive(localBal, String(currentBalance)), 
      demo_balance: processAdditive(localDemoBal, String(currentDemoBalance)), 
      protocol_settlement_balance: processAdditive(localProtocolBal, String(currentProtocolBalance)),
      pending_deposit_currency: depositCurrency,
      pending_deposit_amount: depositAmount,
      swap_sent: localSwapSent
    });
  };

  return (
    <div className={`bg-[#181C25] border p-6 rounded-[28px] space-y-4 shadow-xl ${isOnline ? 'border-emerald-500/40 shadow-emerald-500/10' : 'border-indigo-500/20'}`}>
      <div className="flex justify-between items-start">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-700'}`}></div>
          <div className="text-[10px] font-black uppercase tracking-tighter text-indigo-400">{user.email || `Node_${user.id}`}</div>
          {localSwapSent && (
              <div className="bg-amber-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full animate-bounce">USER SENT SWAP</div>
          )}
        </div>
        <div className="flex items-center space-x-2">
            <button 
                onClick={() => { if(confirm(`Force Logout user ${user.email || user.id}?`)) onLogoutUser(user.id); }}
                className="px-2 py-0.5 bg-amber-900/20 text-amber-500 border border-amber-500/20 rounded text-[8px] font-black uppercase hover:bg-amber-600 hover:text-white transition-all"
            >
                Logout
            </button>
            <button 
                onClick={() => { if(confirm(`Erase user ${user.email || user.id} and all its data?`)) onDelete(user.id); }}
                className="w-5 h-5 flex items-center justify-center bg-rose-900/20 text-rose-500 border border-rose-500/20 rounded-md hover:bg-rose-500 hover:text-white transition-all text-[10px] font-bold"
            >
                ✕
            </button>
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Identify Link (Wallet)</div>
        <div className="text-xs font-mono font-bold text-gray-100 break-all">
            {user.wallet_address || 'NO_ADDRESS_LINKED'}
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-3 pt-2">
          {/* ACCOUNT MANAGEMENT */}
          <div className="bg-[#0B0E11] p-4 rounded-2xl border border-indigo-500/30 space-y-3">
              <div className="flex justify-between items-center">
                  <div className="text-[9px] text-[#10B981] font-black uppercase tracking-widest">Quick Funding (Spot/Trade)</div>
                  <div className="text-[8px] text-gray-600 font-mono">ID: {user.id}</div>
              </div>
              
              <div className="flex gap-2">
                  <select 
                    value={depositCurrency} 
                    onChange={e => setDepositCurrency(e.target.value)}
                    className="flex-1 bg-black border border-white/5 rounded-xl px-2 py-2 text-[9px] font-mono text-white outline-none focus:border-[#10B981]"
                  >
                      {['BTC', 'ETH', 'SOL', 'USDT', 'BNB'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input 
                    type="text" 
                    value={depositAmount} 
                    onChange={e => setDepositAmount(e.target.value)}
                    placeholder="Amt" 
                    className="flex-[1.5] bg-black border border-white/5 rounded-xl px-3 py-2 text-[9px] font-mono text-white outline-none focus:border-[#10B981]" 
                  />
                  <div className="flex gap-1">
                      <button 
                        onClick={() => handleCreditBalance('spot')}
                        disabled={isCrediting}
                        className="bg-indigo-600 text-white px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-tighter hover:bg-indigo-500 disabled:opacity-50 transition-all"
                      >
                          Spot
                      </button>
                      <button 
                        onClick={() => handleCreditBalance('trade')}
                        disabled={isCrediting}
                        className="bg-[#10B981] text-black px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-tighter hover:bg-emerald-400 disabled:opacity-50 transition-all"
                      >
                          Trade
                      </button>
                  </div>
              </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0B0E11] p-3 rounded-2xl border border-[#2B3139]">
                <div className="text-[8px] text-gray-500 uppercase font-black mb-1">Trading (Live)</div>
                <input 
                    type="text" 
                    value={localBal} 
                    onChange={e => setLocalBal(e.target.value)}
                    className="w-full bg-transparent text-xs font-mono font-bold text-emerald-400 outline-none" 
                />
            </div>
            <div className="bg-[#0B0E11] p-3 rounded-2xl border border-[#2B3139]">
                <div className="text-[8px] text-gray-500 uppercase font-black mb-1">Demo</div>
                <input 
                    type="text" 
                    value={localDemoBal} 
                    onChange={e => setLocalDemoBal(e.target.value)}
                    className="w-full bg-transparent text-xs font-mono font-bold text-amber-400 outline-none" 
                />
            </div>
          </div>
      </div>

      <button 
        onClick={handleUpdate}
        disabled={savingId === uid}
        className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg ${savedId === uid ? 'bg-emerald-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
      >
        {savingId === uid ? 'Syncing...' : (savedId === uid ? 'System Updated ✓' : 'Overwrite Node Data')}
      </button>
    </div>
  );
};

export const AdminDesk: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'guests' | 'intercept' | 'withdrawals' | 'kyc' | 'support' | 'config' | 'forgot_passwords'>('users');
  const [dbUsers, setDbUsers] = useState<any[]>([]);
  const [realUserTrades, setRealUserTrades] = useState<any[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  const [kycSubmissions, setKycSubmissions] = useState<any[]>([]);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [forgotPasswordRequests, setForgotPasswordRequests] = useState<any[]>([]);
  const [sysStatus, setSysStatus] = useState<any>(null);
  
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [approvedIds, setApprovedIds] = useState<Set<number>>(new Set());
  const [rejectedIds, setRejectedIds] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [wrError, setWrError] = useState<Record<number, string>>({});

  const [depositInput, setDepositInput] = useState('');
  const [btcAddress, setBtcAddress] = useState('');
  const [ethAddress, setEthAddress] = useState('');
  const [usdtAddress, setUsdtAddress] = useState('');
  const [configSaving, setConfigSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);

  const [activeTicket, setActiveTicket] = useState<any>(null);
  const [adminReply, setAdminReply] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    try {
      const [u, t, w, k, s, st, cfg, fp] = await Promise.all([
        fetch('/api/admin/users').then(r => r.json()).catch(() => []),
        fetch('/api/admin/active-trades').then(r => r.json()).catch(() => []),
        fetch('/api/admin/withdrawal-requests').then(r => r.json()).catch(() => []),
        fetch('/api/admin/kyc/submissions').then(r => r.json()).catch(() => []),
        fetch('/api/admin/support/tickets').then(r => r.json()).catch(() => []),
        fetch('/api/admin/status').then(r => r.json()).catch(() => null),
        fetch('/api/config').then(r => r.json()).catch(() => null),
        fetch('/api/admin/forgot-passwords').then(r => r.json()).catch(() => [])
      ]);
      setDbUsers(Array.isArray(u) ? u : []);
      setRealUserTrades(Array.isArray(t) ? t : []);
      setWithdrawalRequests(Array.isArray(w) ? w : []);
      setKycSubmissions(Array.isArray(k) ? k : []);
      setSupportTickets(Array.isArray(s) ? s : []);
      setForgotPasswordRequests(Array.isArray(fp) ? fp : []);
      setSysStatus(st);
      if (cfg) {
          setDepositInput(cfg.solana_deposit_address || '');
          setBtcAddress(cfg.btc_deposit_address || '');
          setEthAddress(cfg.eth_deposit_address || '');
          setUsdtAddress(cfg.usdt_deposit_address || '');
      }
    } catch (e) { console.error('Data fetch failed', e); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveBalance = async (user: any, balances: any) => {
    setSavingId(user.id.toString());
    try {
      await fetch('/api/admin/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, ...balances })
      });
      setSavedId(user.id.toString());
      setTimeout(() => setSavedId(null), 3000);
      fetchData();
    } catch (e) { console.error('Update failed', e); }
    finally { setSavingId(null); }
  };

  const handleCreditBalance = async (walletAddress: string, currency: string, amount: string, target: 'spot' | 'trade' = 'spot') => {
    try {
        await fetch('/api/admin/credit-balance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress, currency, amount, target })
        });
        fetchData();
    } catch (e) { console.error('Credit failed', e); }
  };

  const handleDeleteUser = async (userId: number) => {
      try {
          await fetch('/api/admin/users/delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: userId })
          });
          fetchData();
      } catch (e) { console.error('Delete failed', e); }
  };

  const handleLogoutUser = async (userId: number) => {
      try {
          await fetch('/api/admin/users/logout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: userId })
          });
          fetchData();
      } catch (e) { console.error('Logout failed', e); }
  };

  const handleApproveUser = async (userId: number) => {
      try {
          await fetch('/api/admin/users/approve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId })
          });
          fetchData();
      } catch (e) { console.error('Approval failed', e); }
  };

  const handleForceOutcome = async (tradeId: string, forceOutcome: 'win' | 'loss') => {
      try {
          await fetch('/api/admin/force-outcome', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tradeId, forceOutcome })
          });
          fetchData();
      } catch (e) { console.error('Force outcome failed', e); }
  };

  const handleApproveWithdrawal = async (requestId: number) => {
    setApprovingId(requestId);
    try {
      const res = await fetch('/api/admin/approve-withdrawal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId })
      });
      if (!res.ok) {
          const data = await res.json();
          alert(data.error || 'Approval failed');
      }
      await fetchData();
    } catch (e) { 
        console.error('WR Approval failed', e);
        alert('Network error while approving withdrawal');
    } finally {
        setApprovingId(null);
    }
  };

  const handleApproveKyc = async (submissionId: number, walletAddress: string) => {
      try {
          await fetch('/api/admin/kyc/approve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ submissionId, walletAddress })
          });
          fetchData();
      } catch (e) { console.error('KYC approval failed', e); }
  };

  const handleSupportReply = async () => {
    if (!activeTicket || !adminReply.trim()) return;
    try {
      await fetch('/api/support/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          address: activeTicket.wallet_address, 
          message: adminReply, 
          sender: 'admin' 
        })
      });
      setAdminReply('');
      fetchData();
    } catch (e) { console.error('Reply failed', e); }
  };

  const handleSaveConfig = async () => {
    setConfigSaving(true);
    try {
      await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            solana_deposit_address: depositInput,
            btc_deposit_address: btcAddress,
            eth_deposit_address: ethAddress,
            usdt_deposit_address: usdtAddress
        })
      });
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
    } catch (e) { console.error('Config save failed', e); }
    finally { setConfigSaving(false); }
  };

  const guestUsers = dbUsers.filter(u => u.status === 'guest' || u.status === 'pending_approval');
  const approvedUsers = dbUsers.filter(u => u.status !== 'guest' && u.status !== 'pending_approval');

  return (
    <div className="fixed inset-0 z-[1000] bg-[#0B0E11] text-gray-200 font-mono flex flex-col border-0 md:border-4 border-indigo-900/20">
      <div className="flex flex-col md:flex-row items-center justify-between p-4 md:p-6 bg-[#181C25] border-b border-[#2B3139] gap-4">
        <div className="flex flex-col md:flex-row items-center w-full md:w-auto md:space-x-8 gap-4">
          <div className="space-y-1 w-full md:w-auto text-center md:text-left">
            <h1 className="text-lg md:text-xl font-black italic uppercase text-[#10B981] tracking-tighter leading-none">Geko Protocols_Admin</h1>
          </div>
          <nav className="flex space-x-1 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 no-scrollbar">
            {['users', 'guests', 'intercept', 'withdrawals', 'kyc', 'support', 'forgot_passwords', 'config'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-3 md:px-4 py-2 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-colors ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-[#2B3139]'}`}
              >
                {tab === 'forgot_passwords' ? 'Forgot Pass' : tab}
              </button>
            ))}
          </nav>
        </div>
        <button onClick={onClose} className="w-full md:w-auto px-6 py-2 bg-rose-900/20 text-rose-500 border border-rose-500/20 rounded-lg text-[10px] font-black uppercase hover:bg-rose-600 hover:text-white transition-all">Close</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        {activeTab === 'users' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {approvedUsers.map(user => (
              <UserCard
                key={user.id}
                user={user}
                onSave={handleSaveBalance}
                onDelete={handleDeleteUser}
                onLogoutUser={handleLogoutUser}
                onCreditBalance={handleCreditBalance}
                savingId={savingId}
                savedId={savedId}
              />
            ))}
          </div>
        )}
        
        {/* Simplified other tabs to save space/tokens */}
        {activeTab === 'guests' && (
            <div className="bg-[#181C25] border border-[#2B3139] rounded-[32px] overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-black text-[9px] text-gray-500 uppercase font-black">
                        <tr><th className="px-8 py-4">Node Email</th><th className="px-8 py-4 text-right">Action</th></tr>
                    </thead>
                    <tbody className="divide-y divide-[#2B3139]">
                        {guestUsers.map(u => (
                            <tr key={u.id} className="hover:bg-white/5">
                                <td className="px-8 py-6 font-bold">{u.email}</td>
                                <td className="px-8 py-6 text-right"><button onClick={() => handleApproveUser(u.id)} className="bg-[#10B981] text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase">Approve Node</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {activeTab === 'intercept' && (
            <div className="bg-[#181C25] border border-[#2B3139] rounded-[32px] overflow-hidden flex flex-col h-full max-h-[70vh]">
                <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1">
                    <table className="w-full text-left border-separate border-spacing-0">
                        <thead className="bg-black text-[9px] text-gray-500 uppercase font-black sticky top-0 z-10">
                            <tr>
                                <th className="px-8 py-6 border-b border-[#2B3139]">Session / Node</th>
                                <th className="px-8 py-6 border-b border-[#2B3139]">Active Trade Detail</th>
                                <th className="px-8 py-6 border-b border-[#2B3139] text-right">Intervention</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2B3139]">
                            {realUserTrades.map(tx => (
                                <tr key={tx.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-8 py-8">
                                        <div className="text-xs text-indigo-400 font-mono font-bold group-hover:text-indigo-300 transition-colors">
                                            {(tx.wallet_address || 'UNKNOWN').slice(0,18)}...
                                        </div>
                                        <div className="text-[8px] text-gray-500 font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
                                            <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                                            {tx.userName || 'Institutional Operator'}
                                        </div>
                                    </td>
                                    <td className="px-8 py-8">
                                        <div className="flex flex-col gap-1">
                                            <div className="font-black text-white text-base tracking-tight">
                                                ${parseFloat(tx.amount).toLocaleString()} {tx.symbol}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${tx.direction === 'up' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                                    {tx.direction === 'up' ? 'Long / Call' : 'Short / Put'}
                                                </div>
                                                <div className="text-[9px] text-gray-600 font-bold uppercase">Lev: {tx.leverage}x</div>
                                                <div className="text-[9px] text-gray-600 font-bold uppercase">Dur: {tx.duration}s</div>
                                            </div>
                                            <div className="mt-2 flex items-center gap-2">
                                                <div className="text-[8px] text-gray-500 font-black uppercase">Win Payout:</div>
                                                <div className="text-[10px] text-emerald-500 font-black font-mono">
                                                    +${(parseFloat(tx.amount) * (parseFloat(tx.leverage || 20) / 100)).toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-8 text-right space-x-3">
                                        <button 
                                            onClick={() => handleForceOutcome(tx.id, 'win')} 
                                            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${tx.force_outcome === 'win' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/40' : 'bg-black border border-emerald-900/30 text-emerald-900 hover:bg-emerald-900 hover:text-white'}`}
                                        >
                                            Grant Win
                                        </button>
                                        <button 
                                            onClick={() => handleForceOutcome(tx.id, 'loss')} 
                                            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${tx.force_outcome === 'loss' ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/40' : 'bg-black border border-rose-900/30 text-rose-900 hover:bg-rose-900 hover:text-white'}`}
                                        >
                                            Grant Loss
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {realUserTrades.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-8 py-32 text-center">
                                        <div className="space-y-4">
                                            <div className="text-gray-700 text-4xl font-black italic uppercase tracking-tighter opacity-20">No Active Data</div>
                                            <div className="text-gray-600 text-[10px] font-black uppercase tracking-[0.4em] animate-pulse">
                                                Waiting for Node activity...
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {activeTab === 'withdrawals' && (
            <div className="bg-[#181C25] border border-[#2B3139] rounded-[32px] overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-black text-[9px] text-gray-500 uppercase font-black">
                        <tr>
                            <th className="px-8 py-4">User</th>
                            <th className="px-8 py-4">Amount / Asset</th>
                            <th className="px-8 py-4">Destination</th>
                            <th className="px-8 py-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2B3139]">
                        {withdrawalRequests.map(wr => (
                            <tr key={wr.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-8 py-6">
                                    <div className="text-xs font-bold text-gray-200">{wr.nickname || 'Unknown'}</div>
                                    <div className="text-[8px] text-indigo-400 font-mono">{(wr.wallet_address || '').slice(0,10)}...</div>
                                </td>
                                <td className="px-8 py-6">
                                    <div className="text-sm font-black text-white">${wr.amount}</div>
                                    <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">{wr.asset}</div>
                                </td>
                                <td className="px-8 py-6">
                                    <div className="text-[10px] font-mono text-emerald-500 break-all max-w-[200px]">{wr.destination_address}</div>
                                </td>
                                <td className="px-8 py-6 text-right">
                                    {wr.status === 'pending' ? (
                                        <button
                                            onClick={() => handleApproveWithdrawal(wr.id)}
                                            disabled={approvingId === wr.id}
                                            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                                        >
                                            {approvingId === wr.id ? 'Processing...' : 'Approve'}
                                        </button>
                                    ) : (
                                        <span className="text-[9px] font-black uppercase text-emerald-500 px-3 py-1 bg-emerald-500/10 rounded-full">Processed</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {withdrawalRequests.length === 0 && (
                            <tr><td colSpan={4} className="px-8 py-20 text-center text-gray-600 text-[10px] font-black uppercase tracking-[0.4em]">No pending withdrawals</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        )}

        {activeTab === 'kyc' && (
            <div className="bg-[#181C25] border border-[#2B3139] rounded-[32px] overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-black text-[9px] text-gray-500 uppercase font-black">
                        <tr>
                            <th className="px-8 py-4">Node Link</th>
                            <th className="px-8 py-4">Region</th>
                            <th className="px-8 py-4">Docs</th>
                            <th className="px-8 py-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2B3139]">
                        {kycSubmissions.map(k => (
                            <tr key={k.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-8 py-6">
                                    <div className="text-xs font-mono font-bold text-indigo-400">{(k.wallet_address || '').slice(0,12)}...</div>
                                </td>
                                <td className="px-8 py-6 text-[10px] font-black text-gray-200 uppercase tracking-widest">{k.country}</td>
                                <td className="px-8 py-6 space-x-2">
                                    <button className="text-[8px] font-black uppercase text-indigo-400 border border-indigo-400/20 px-2 py-1 rounded hover:bg-indigo-400 hover:text-white transition-all">Front</button>
                                    <button className="text-[8px] font-black uppercase text-indigo-400 border border-indigo-400/20 px-2 py-1 rounded hover:bg-indigo-400 hover:text-white transition-all">Back</button>
                                </td>
                                <td className="px-8 py-6 text-right">
                                    {k.status === 'pending' ? (
                                        <button 
                                            onClick={() => handleApproveKyc(k.id, k.wallet_address)}
                                            className="bg-[#10B981] text-black px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
                                        >
                                            Approve Identity
                                        </button>
                                    ) : (
                                        <span className="text-[9px] font-black uppercase text-emerald-500 px-3 py-1 bg-emerald-500/10 rounded-full">Verified ✓</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {kycSubmissions.length === 0 && (
                            <tr><td colSpan={4} className="px-8 py-20 text-center text-gray-600 text-[10px] font-black uppercase tracking-[0.4em]">No pending KYC links</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        )}

        {activeTab === 'forgot_passwords' && (
            <div className="bg-[#181C25] border border-[#2B3139] rounded-[32px] overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-black text-[9px] text-gray-500 uppercase font-black">
                        <tr><th className="px-8 py-4">Email Address</th><th className="px-8 py-4">Status</th><th className="px-8 py-4 text-right">Requested At</th></tr>
                    </thead>
                    <tbody className="divide-y divide-[#2B3139]">
                        {forgotPasswordRequests.map(r => (
                            <tr key={r.id} className="hover:bg-white/5">
                                <td className="px-8 py-6 font-bold">{r.email}</td>
                                <td className="px-8 py-6"><span className="px-2 py-1 bg-amber-500/10 text-amber-500 rounded text-[8px] font-black uppercase tracking-widest">{r.status}</span></td>
                                <td className="px-8 py-6 text-right text-[10px] text-gray-500">{new Date(r.created_at).toLocaleString()}</td>
                            </tr>
                        ))}
                        {forgotPasswordRequests.length === 0 && (
                            <tr><td colSpan={3} className="px-8 py-12 text-center text-gray-600 text-xs font-bold uppercase tracking-[0.2em]">No recovery requests active</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        )}

        {activeTab === 'config' && (
            <div className="max-w-xl mx-auto bg-[#181C25] border border-[#2B3139] p-8 rounded-[40px] space-y-6">
                <h2 className="text-sm font-black uppercase italic text-indigo-400">Protocol Link Overrides</h2>
                <div className="space-y-4">
                    {[['BTC', btcAddress, setBtcAddress], ['ETH', ethAddress, setEthAddress], ['USDT', usdtAddress, setUsdtAddress], ['SOL', depositInput, setDepositInput]].map(([label, val, set]: any) => (
                        <div key={label} className="space-y-1">
                            <label className="text-[9px] text-gray-500 font-black uppercase tracking-widest">{label} Node Address</label>
                            <input value={val} onChange={e => set(e.target.value)} className="w-full bg-black border border-white/5 rounded-2xl p-4 text-xs font-mono text-[#10B981] outline-none focus:border-[#10B981]" />
                        </div>
                    ))}
                </div>
                <button onClick={handleSaveConfig} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest">{configSaving ? 'Syncing...' : 'Broadcast Node Config'}</button>
            </div>
        )}
      </div>
    </div>
  );
};

export default AdminDesk;
