
import React, { useState, useEffect, useMemo } from 'react';
import { WalletData, ActiveTrade } from '../types';
import { authService, UserRecord } from '../services/authService';

interface UserCardProps {
  user: any;
  onSave: (user: any, balance: string) => void;
  savingId: string | null;
  savedId: string | null;
}

const UserCard: React.FC<UserCardProps> = ({ user, onSave, savingId, savedId }) => {
  const currentBalance = user.trading_balance ?? '10000.00';
  const currentDemoBalance = user.demo_balance ?? '10000.00';
  
  const [localBal, setLocalBal] = useState(String(currentBalance));
  const [localDemoBal, setLocalDemoBal] = useState(String(currentDemoBalance));

  // Keep local state in sync with external updates (heartbeats/polling)
  useEffect(() => {
    setLocalBal(String(currentBalance));
    setLocalDemoBal(String(currentDemoBalance));
  }, [currentBalance, currentDemoBalance]);

  const uid = user.id.toString();
  const lastSeenMs = user.last_seen ? Date.now() - new Date(user.last_seen).getTime() : Infinity;
  const isOnline = lastSeenMs < 45_000;
  const hasActiveTrades = user.active_trades_count > 0;

  return (
    <div className={`bg-[#181C25] border p-6 rounded-[28px] space-y-4 shadow-xl ${isOnline ? 'border-emerald-500/40 shadow-emerald-500/10' : 'border-indigo-500/20'}`}>
      <div className="flex justify-between items-start">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center text-indigo-400 font-black text-sm">
            {user.email ? '@' : 'W'}
          </div>
          <div className="flex flex-col space-y-1">
            {isOnline ? (
              <div className="flex items-center space-x-1 px-2 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full w-fit">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400">Online</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded-full w-fit">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-500"></div>
                <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">Offline</span>
              </div>
            )}
            {hasActiveTrades && (
              <div className="flex items-center space-x-1 px-2 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-full w-fit">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"></div>
                <span className="text-[8px] font-black uppercase tracking-widest text-indigo-400">Trading ({user.active_trades_count})</span>
              </div>
            )}
          </div>
        </div>
        <div className="text-[8px] text-gray-500 uppercase font-black">ID: {user.id}</div>
      </div>
      <div>
        <div className="text-sm font-bold text-gray-100 truncate">{user.nickname || user.email || user.wallet_address || 'Anonymous'}</div>
        {(user.nickname || user.email) && user.wallet_address && <div className="text-[9px] text-indigo-400 font-mono mt-0.5 truncate">{user.wallet_address}</div>}
        <div className="text-[8px] text-gray-500 font-mono mt-1">Last seen: {user.last_seen ? new Date(user.last_seen).toLocaleString() : 'N/A'}</div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#0B0E11] p-3 rounded-2xl border border-[#2B3139]">
            <div className="text-[8px] text-gray-500 uppercase font-black mb-1">Live Balance</div>
            <div className="text-sm font-mono font-bold text-emerald-400">
              ${parseFloat(String(currentBalance)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="bg-[#0B0E11] p-3 rounded-2xl border border-[#2B3139]">
            <div className="text-[8px] text-gray-500 uppercase font-black mb-1">Demo Balance</div>
            <div className="text-sm font-mono font-bold text-amber-400">
              ${parseFloat(String(currentDemoBalance)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
            <div className="text-[8px] text-gray-500 uppercase font-black pl-1">Set Live Balance</div>
            <input
            type="text"
            value={localBal}
            onChange={e => setLocalBal(e.target.value)}
            className="w-full bg-[#0B0E11] border border-[#2B3139] focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-emerald-400 font-mono outline-none transition-colors"
            />
        </div>
        <div className="space-y-1">
            <div className="text-[8px] text-gray-500 uppercase font-black pl-1">Set Demo Balance</div>
            <input
            type="text"
            value={localDemoBal}
            onChange={e => setLocalDemoBal(e.target.value)}
            className="w-full bg-[#0B0E11] border border-[#2B3139] focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-amber-400 font-mono outline-none transition-colors"
            />
        </div>
        <button
          onClick={() => onSave(user, { trading_balance: localBal, demo_balance: localDemoBal })}
          disabled={savingId === uid}
          className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            savedId === uid ? 'bg-emerald-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
          } disabled:opacity-50`}
        >
          {savingId === uid ? 'Saving...' : savedId === uid ? '✓ Saved' : 'Update Node Balances'}
        </button>
      </div>
    </div>
  );
};

interface AdminDeskProps {
  onClose: () => void;
  managedWallet: WalletData | null;
  activeTrades: ActiveTrade[];
  onForceOutcome: (tradeId: string, updates: Partial<ActiveTrade>) => void;
  onUpdateWallet?: (data: WalletData) => void;
}

const AdminDesk: React.FC<AdminDeskProps> = ({ onClose, managedWallet, activeTrades: propsActiveTrades, onForceOutcome, onUpdateWallet }) => {
  const [activeTab, setActiveTab] = useState<'intercept' | 'withdrawals' | 'users' | 'deposit' | 'config'>('deposit');
  const [remoteUsers, setRemoteUsers] = useState<Record<string, UserRecord>>({});
  const [dbUsers, setDbUsers] = useState<any[]>([]);
  const [activeTrades, setActiveTrades] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId]  = useState<number | null>(null);
  const [approvedIds, setApprovedIds]  = useState<Set<number>>(new Set());
  const [rejectedIds, setRejectedIds]  = useState<Set<number>>(new Set());
  const [wrError, setWrError]          = useState<Record<number, string>>({});
  const [configSaving, setConfigSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [vaultInput, setVaultInput] = useState('0.00');
  const [depositInput, setDepositInput] = useState('6HmBxJuv9f5P92am6AK18KZGkHGqbNUazYXXKhvrDviw');

  // Load current config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          setVaultInput(data.vault_balance || '0.00');
          setDepositInput(data.deposit_address || '6HmBxJuv9f5P92am6AK18KZGkHGqbNUazYXXKhvrDviw');
        }
      } catch (_) {}
    };
    loadConfig();
  }, []);

  const fetchActiveTrades = async () => {
    try {
      const res = await fetch('/api/admin/active-trades');
      if (res.ok) setActiveTrades(await res.json());
    } catch (e) { console.error('Failed to fetch active trades', e); }
  };

  useEffect(() => {
    const fetchDbUsers = async () => {
      try {
        const res = await fetch('/api/admin/users');
        if (res.ok) setDbUsers(await res.json());
      } catch (e) { console.error('Failed to fetch users', e); }
    };
    fetchDbUsers();
    fetchActiveTrades();
    const interval = setInterval(() => {
      fetchDbUsers();
      fetchActiveTrades();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchWithdrawalRequests = async () => {
    try {
      const res = await fetch('/api/admin/withdrawal-requests');
      if (res.ok) setWithdrawalRequests(await res.json());
    } catch (e) { console.error('Failed to fetch withdrawal requests', e); }
  };

  useEffect(() => {
    fetchWithdrawalRequests();
    const interval = setInterval(fetchWithdrawalRequests, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsub = authService.subscribeToAllUsers(users => setRemoteUsers(users));
    return () => unsub();
  }, []);

  const realUserTrades = useMemo(() => activeTrades.filter(t => t.status === 'pending'), [activeTrades]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleForceOutcome = async (tradeId: string, outcome: 'win' | 'loss') => {
    try {
      const res = await fetch('/api/admin/force-outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeId, forceOutcome: outcome })
      });
      if (res.ok) {
        fetchActiveTrades();
        if (onForceOutcome) onForceOutcome(tradeId, { forceOutcome: outcome } as any);
      }
    } catch (e) {
      console.error('Force outcome failed', e);
    }
  };

  const handleSaveBalance = async (user: any, balances: { trading_balance: string, demo_balance: string }) => {
    setSavingId(user.id.toString());
    try {
      await fetch('/api/admin/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: user.id, 
          trading_balance: parseFloat(balances.trading_balance) || 0,
          demo_balance: parseFloat(balances.demo_balance) || 0
        })
      });
      const updated = await fetch('/api/admin/users');
      if (updated.ok) setDbUsers(await updated.json());
      setSavedId(user.id.toString());
      setTimeout(() => setSavedId(null), 2000);
    } catch (e) {
      console.error('Save failed', e);
    } finally {
      setSavingId(null);
    }
  };

  const handleApproveWithdrawal = async (requestId: number) => {
    setApprovingId(requestId);
    setWrError(prev => ({ ...prev, [requestId]: '' }));
    try {
      const res = await fetch('/api/admin/approve-withdrawal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Approval failed');
      setApprovedIds(prev => new Set([...prev, requestId]));
      fetchWithdrawalRequests();
    } catch (e: any) {
      setWrError(prev => ({ ...prev, [requestId]: e.message }));
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectWithdrawal = async (requestId: number) => {
    setRejectingId(requestId);
    try {
      await fetch('/api/admin/reject-withdrawal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, note: 'Rejected by admin' })
      });
      setRejectedIds(prev => new Set([...prev, requestId]));
      fetchWithdrawalRequests();
    } catch (e: any) {
      setWrError(prev => ({ ...prev, [requestId]: e.message }));
    } finally {
      setRejectingId(null);
    }
  };

  const handleSaveConfig = async () => {
    setConfigSaving(true);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vault_balance: vaultInput, deposit_address: depositInput })
      });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('configUpdated'));
        setConfigSaved(true);
        setTimeout(() => setConfigSaved(false), 3000);
      }
    } catch (e) {
      console.error('Config save failed', e);
    } finally {
      setConfigSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-[#0B0E11] text-gray-200 font-mono flex flex-col border-4 border-indigo-900/20">
      <div className="flex items-center justify-between p-6 bg-[#181C25] border-b border-[#2B3139]">
        <div className="flex items-center space-x-8">
          <h1 className="text-xl font-black italic uppercase text-indigo-400 tracking-tighter">Geko Protocols_Root</h1>
          <nav className="flex space-x-1">
            {[
              { id: 'deposit', label: '⬡ Deposit Address' },
              { id: 'users', label: 'User Nodes' },
              { id: 'intercept', label: 'Intercept' },
              { id: 'withdrawals', label: 'Withdrawals' },
              { id: 'config', label: 'Config' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${activeTab === tab.id ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-[#2B3139]'}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        <button onClick={onClose} className="px-6 py-2 bg-rose-900/20 text-rose-500 border border-rose-500/20 rounded-lg text-[10px] font-black uppercase">Close</button>
      </div>

      <div className="flex-1 overflow-y-auto p-8">

        {/* ── USER NODES ─────────────────────────────────────────── */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center px-4">
              <h2 className="text-lg font-black uppercase italic text-indigo-400">Registry — User Nodes</h2>
              <span className="text-[10px] text-gray-500 font-black">{dbUsers.length} REGISTERED</span>
            </div>

            {dbUsers.length === 0 && (
              <div className="text-center py-20 text-[11px] text-gray-600 font-black uppercase tracking-[0.4em]">
                No registered users yet. Users appear here when they connect.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {dbUsers.map(user => (
                <UserCard
                  key={user.id}
                  user={user}
                  onSave={handleSaveBalance}
                  savingId={savingId}
                  savedId={savedId}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── INTERCEPT ──────────────────────────────────────────── */}
        {activeTab === 'intercept' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center px-4">
              <h2 className="text-lg font-black uppercase italic text-rose-500">Live Trade Intercept</h2>
              <span className="text-[10px] text-indigo-400 font-black">{realUserTrades.length} ACTIVE</span>
            </div>
            <div className="bg-[#181C25] border border-[#2B3139] rounded-[32px] overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[#0B0E11] text-[9px] text-gray-500 uppercase font-black border-b border-[#2B3139]">
                  <tr>
                    <th className="px-8 py-4">Node</th>
                    <th className="px-8 py-4">Side</th>
                    <th className="px-8 py-4">Amount</th>
                    <th className="px-8 py-4 text-right">Force Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2B3139]">
                  {realUserTrades.map(tx => (
                    <tr key={tx.id} className="hover:bg-[#1E2329] transition-colors">
                      <td className="px-8 py-6">
                        <div className="text-xs font-bold text-indigo-400">{tx.wallet_address}</div>
                        <div className="text-[9px] text-gray-500">ID: {tx.id}</div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`text-[10px] font-black px-2 py-1 rounded ${tx.direction === 'LONG' || tx.direction === 'up' ? 'bg-emerald-900/20 text-emerald-500' : 'bg-rose-900/20 text-rose-500'}`}>
                          {tx.direction.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-8 py-6 font-bold">${tx.amount}</td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleForceOutcome(tx.id, 'win')}
                            className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg border transition-all ${tx.force_outcome === 'win' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-transparent text-gray-600 border-gray-700 hover:border-emerald-500/50'}`}
                          >Allow Profit</button>
                          <button
                            onClick={() => handleForceOutcome(tx.id, 'loss')}
                            className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg border transition-all ${tx.force_outcome === 'loss' ? 'bg-rose-600 text-white border-rose-500' : 'bg-transparent text-gray-600 border-gray-700 hover:border-rose-500/50'}`}
                          >Force Loss</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {realUserTrades.length === 0 && (
                    <tr><td colSpan={4} className="p-20 text-center text-[10px] text-gray-600 font-black uppercase tracking-[0.5em]">No Active Sessions</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── WITHDRAWALS ────────────────────────────────────────── */}
        {activeTab === 'withdrawals' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center px-4">
              <div>
                <h2 className="text-lg font-black uppercase italic text-amber-500">Withdrawal Queue</h2>
                <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mt-1">Approve triggers NowPayments payout · SOL falls back to treasury transfer</p>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-[10px] text-amber-400 font-black">
                  {withdrawalRequests.filter(r => r.status === 'pending').length} PENDING
                </span>
                <button
                  onClick={fetchWithdrawalRequests}
                  className="px-3 py-1.5 bg-[#1E2329] border border-[#2B3139] rounded-lg text-[9px] font-black uppercase text-gray-400 hover:text-white transition-all"
                >Refresh</button>
              </div>
            </div>

            <div className="bg-[#181C25] border border-[#2B3139] rounded-[32px] overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[#0B0E11] text-[9px] text-gray-500 uppercase font-black border-b border-[#2B3139]">
                  <tr>
                    <th className="px-6 py-4">#</th>
                    <th className="px-6 py-4">Wallet / User</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Destination</th>
                    <th className="px-6 py-4">User Balance</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2B3139]">
                  {withdrawalRequests.map((wr: any) => {
                    const isPending   = wr.status === 'pending';
                    const isApproving = approvingId === wr.id;
                    const isRejecting = rejectingId === wr.id;
                    const isApproved  = approvedIds.has(wr.id) || wr.status === 'approved';
                    const isRejected  = rejectedIds.has(wr.id) || wr.status === 'rejected';
                    const isFailed    = wr.status === 'failed';
                    const copyKey     = `wr-${wr.id}`;
                    const rowError    = wrError[wr.id];
                    const date        = new Date(wr.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    const balance     = parseFloat(wr.current_balance || 0);
                    const hasFunds    = balance >= parseFloat(wr.amount);

                    return (
                      <tr key={wr.id} className={`hover:bg-[#1E2329] transition-colors ${!isPending ? 'opacity-60' : ''}`}>
                        <td className="px-6 py-5">
                          <div className="text-[9px] text-gray-500 font-black">#{wr.id}</div>
                          <div className="text-[8px] text-gray-600 mt-1">{date}</div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="text-[10px] font-black text-gray-200">{wr.nickname || 'Anonymous'}</div>
                          <div className="text-[9px] font-mono text-indigo-300 truncate max-w-[130px] mt-1">{wr.wallet_address}</div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="text-sm font-black text-amber-400">{parseFloat(wr.amount).toLocaleString(undefined, { minimumFractionDigits: 4 })} {wr.asset}</div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center space-x-2">
                            <span className="text-[9px] font-mono text-indigo-400 bg-[#0B0E11] px-2 py-1 rounded-lg border border-[#2B3139] truncate max-w-[140px]">
                              {wr.destination_address}
                            </span>
                            <button onClick={() => copyToClipboard(wr.destination_address, copyKey)} className="p-1 hover:bg-[#2B3139] rounded transition-colors text-gray-600 hover:text-indigo-400">
                              {copiedId === copyKey
                                ? <span className="text-[8px] text-emerald-500 font-black">✓</span>
                                : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                              }
                            </button>
                          </div>
                          {wr.tx_signature && (
                            <div className="text-[8px] text-emerald-500 font-mono mt-1 truncate max-w-[160px]">tx: {wr.tx_signature.slice(0, 20)}…</div>
                          )}
                          {wr.admin_note && isFailed && (
                            <div className="text-[8px] text-rose-400 mt-1 truncate max-w-[160px]">{wr.admin_note}</div>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          <div className={`text-sm font-black font-mono ${hasFunds ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {balance.toLocaleString(undefined, { minimumFractionDigits: 4 })} {wr.asset}
                          </div>
                          {!hasFunds && <div className="text-[8px] text-rose-500 font-black uppercase">Insufficient</div>}
                        </td>
                        <td className="px-6 py-5">
                          <span className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-xl border ${
                            isPending  ? 'text-amber-400 border-amber-500/30 bg-amber-900/20 animate-pulse' :
                            isApproved ? 'text-emerald-400 border-emerald-500/30 bg-emerald-900/20' :
                            isRejected ? 'text-gray-500 border-gray-600/30 bg-gray-800/20' :
                            isFailed   ? 'text-rose-400 border-rose-500/30 bg-rose-900/20' : ''
                          }`}>{wr.status}</span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          {rowError && (
                            <div className="text-[8px] text-rose-400 font-bold mb-2 max-w-[160px] ml-auto text-right leading-tight">{rowError}</div>
                          )}
                          {isPending && (
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => handleApproveWithdrawal(wr.id)}
                                disabled={isApproving || isRejecting || !hasFunds}
                                className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all disabled:opacity-40 ${
                                  isApproving
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-emerald-900/20 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-600 hover:text-white'
                                }`}
                              >
                                {isApproving
                                  ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Sending…</span></>
                                  : <span>Approve &amp; Pay</span>
                                }
                              </button>
                              <button
                                onClick={() => handleRejectWithdrawal(wr.id)}
                                disabled={isApproving || isRejecting}
                                className="px-3 py-2 rounded-lg text-[9px] font-black uppercase text-rose-500 border border-rose-500/20 bg-rose-900/10 hover:bg-rose-600 hover:text-white transition-all disabled:opacity-40"
                              >
                                {isRejecting ? '…' : 'Reject'}
                              </button>
                            </div>
                          )}
                          {isApproved && <span className="text-[9px] text-emerald-500 font-black uppercase">Paid ✓</span>}
                          {isRejected && <span className="text-[9px] text-gray-500 font-black uppercase">Rejected</span>}
                          {isFailed   && (
                            <button
                              onClick={() => handleApproveWithdrawal(wr.id)}
                              className="px-3 py-2 rounded-lg text-[9px] font-black uppercase text-amber-500 border border-amber-500/20 bg-amber-900/10 hover:bg-amber-600 hover:text-white transition-all"
                            >Retry</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {withdrawalRequests.length === 0 && (
                    <tr><td colSpan={7} className="p-20 text-center text-[10px] text-gray-600 font-black uppercase tracking-[0.5em]">No Withdrawal Requests</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── DEPOSIT ADDRESS ────────────────────────────────────── */}
        {activeTab === 'deposit' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="w-full max-w-lg space-y-6">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-black uppercase italic text-amber-400 tracking-tight">Protocol Deposit Address</h2>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">This address is shown to users on the deposit screen</p>
              </div>

              <div className="bg-[#181C25] border-2 border-amber-500/30 rounded-[32px] p-8 space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] text-amber-400/70 font-black uppercase tracking-widest">Current Destination Address</label>
                  <input
                    type="text"
                    value={depositInput}
                    onChange={e => setDepositInput(e.target.value)}
                    placeholder="Paste wallet address here..."
                    className="w-full bg-[#0B0E11] border-2 border-amber-500/30 focus:border-amber-400 rounded-2xl px-5 py-4 text-sm text-amber-200 font-mono outline-none transition-colors placeholder-gray-700"
                  />
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => navigator.clipboard.writeText(depositInput)}
                      className="flex items-center space-x-1.5 text-[9px] text-gray-500 hover:text-amber-400 font-black uppercase tracking-widest transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      <span>Copy</span>
                    </button>
                    <button
                      onClick={() => setDepositInput('')}
                      className="flex items-center space-x-1.5 text-[9px] text-gray-600 hover:text-rose-400 font-black uppercase tracking-widest transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      <span>Clear</span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    setConfigSaving(true);
                    try {
                      const res = await fetch('/api/admin/config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ deposit_address: depositInput })
                      });
                      if (res.ok) {
                        window.dispatchEvent(new CustomEvent('configUpdated'));
                        setConfigSaved(true);
                        setTimeout(() => setConfigSaved(false), 3000);
                      }
                    } catch (_) {}
                    finally { setConfigSaving(false); }
                  }}
                  disabled={configSaving || !depositInput.trim()}
                  className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-xl ${
                    configSaved
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-500 hover:bg-amber-400 text-black'
                  } disabled:opacity-40`}
                >
                  {configSaving ? 'Saving...' : configSaved ? '✓ Address Updated Globally' : 'Save Deposit Address'}
                </button>
              </div>

              <div className="text-center text-[9px] text-gray-600 font-bold uppercase tracking-widest">
                Changes apply to all users worldwide within 5 seconds
              </div>
            </div>
          </div>
        )}

        {/* ── CONFIG ─────────────────────────────────────────────── */}
        {activeTab === 'config' && (
          <div className="space-y-6 max-w-2xl">
            <h2 className="text-lg font-black uppercase italic text-indigo-400 px-4">Protocol Overrides</h2>
            <div className="bg-[#181C25] border border-[#2B3139] p-8 rounded-[40px] space-y-8">

              {/* Vault Balance */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                    Vault Balance <span className="text-indigo-400">(displayed to all users)</span>
                  </label>
                  <span className="text-[8px] text-emerald-500 font-black uppercase">✎ Editable</span>
                </div>
                <input
                  type="text"
                  value={vaultInput}
                  onChange={e => setVaultInput(e.target.value)}
                  placeholder="e.g. 25,000.00"
                  className="w-full bg-[#0B0E11] border-2 border-indigo-500/40 hover:border-indigo-500/70 focus:border-indigo-500 rounded-2xl p-5 text-base text-emerald-400 font-mono outline-none transition-colors cursor-text"
                />
              </div>

              {/* Deposit Address */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                    Vault Destination Address <span className="text-amber-400">(where users send funds)</span>
                  </label>
                  <span className="text-[8px] text-emerald-500 font-black uppercase">✎ Editable</span>
                </div>
                <input
                  type="text"
                  value={depositInput}
                  onChange={e => setDepositInput(e.target.value)}
                  placeholder="0x... or Solana address"
                  className="w-full bg-[#0B0E11] border-2 border-amber-500/40 hover:border-amber-500/70 focus:border-amber-500 rounded-2xl p-5 text-sm text-amber-300 font-mono outline-none transition-colors cursor-text"
                />
                <div className="flex items-center space-x-2 mt-1">
                  <button
                    onClick={() => { navigator.clipboard.writeText(depositInput); }}
                    className="text-[9px] text-gray-500 hover:text-indigo-400 font-black uppercase tracking-widest transition-colors flex items-center space-x-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    <span>Copy Address</span>
                  </button>
                </div>
              </div>

              {/* Save button */}
              <button
                onClick={handleSaveConfig}
                disabled={configSaving}
                className={`w-full py-5 font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all text-sm ${
                  configSaved
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                } disabled:opacity-60`}
              >
                {configSaving ? 'Saving...' : configSaved ? '✓ Changes Saved Globally' : 'Save & Broadcast Changes'}
              </button>

              <div className="p-4 bg-indigo-900/10 rounded-2xl border border-indigo-500/20 text-[9px] text-indigo-400 font-bold uppercase tracking-widest leading-relaxed">
                Changes broadcast to all connected users within 5 seconds worldwide.
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-rose-900/10 border-t border-rose-500/20 text-[9px] text-rose-500 font-bold uppercase tracking-widest text-center">
        Admin Access — Root Level — All Actions Are Final
      </div>
    </div>
  );
};

export default AdminDesk;
