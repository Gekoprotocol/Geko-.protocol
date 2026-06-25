import React, { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { WalletData } from '../types';

interface LandingPageProps {
  onLoginSuccess: (data: WalletData) => void;
  onConnectWalletClick: () => void;
  canInstall?: boolean;
  onInstall?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginSuccess, onConnectWalletClick, canInstall, onInstall }) => {
  const [view, setView] = useState<'login' | 'signup' | 'wait'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMsg('');
    setIsLoading(true);

    try {
      if (view === 'signup') {
        if (password !== confirmPassword) throw new Error('Passwords do not match');
        await authService.signup(email, password, invitationCode);
        setMsg('Signup successful! Please wait for admin approval.');
        setView('wait');
      } else {
        const walletData = await authService.login(email, password);
        if (walletData.status === 'guest') {
            setView('wait');
        } else {
            onLoginSuccess(walletData);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (view === 'wait') {
    return (
        <div className="min-h-screen bg-[#0B0E11] flex items-center justify-center p-6 text-center">
            <div className="bg-[#181C25] border border-[#2B3139] p-12 rounded-[48px] shadow-2xl max-w-md w-full space-y-8 animate-in fade-in zoom-in duration-500">
                <div className="w-24 h-24 bg-amber-600/20 rounded-full flex items-center justify-center mx-auto border border-amber-500/30">
                    <svg className="w-12 h-12 text-amber-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="space-y-4">
                    <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">Identity Pending</h2>
                    <p className="text-gray-500 text-sm leading-relaxed uppercase font-bold tracking-widest">Your account is currently under institutional review. Protocol access will be granted upon administrator clearance.</p>
                </div>
                <div className="pt-6 border-t border-white/5">
                    <button 
                        onClick={() => setView('login')}
                        className="text-xs font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-400"
                    >
                        Return to Login
                    </button>
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0E11] flex items-center justify-center relative overflow-hidden font-sans text-gray-200">
      <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none"></div>

      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 p-6 relative z-10">

        <div className="flex flex-col justify-center space-y-10 order-2 lg:order-1">
           <div className="space-y-6">
                <div className="w-24 h-24 lg:w-32 lg:h-32">
                    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-2xl">
                        <defs>
                            <linearGradient id="logoG" x1="0" y1="0" x2="100" y2="100">
                                <stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#a855f7" />
                            </linearGradient>
                        </defs>
                        <path d="M50 0L93.3 25V75L50 100L6.7 75V25L50 0Z" fill="url(#logoG)" />
                        <circle cx="50" cy="50" r="10" fill="#0B0E11" />
                    </svg>
                </div>
                <div className="space-y-2">
                    <h1 className="text-5xl lg:text-7xl font-black italic uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-500">
                        GEKO<br />V2
                    </h1>
                    <p className="text-sm text-gray-500 font-bold uppercase tracking-[0.3em]">Institutional Digital Asset Terminal</p>
                </div>
           </div>

           {canInstall && (
              <button 
                  onClick={onInstall}
                  className="w-fit bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 border border-emerald-500/20 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center space-x-2"
              >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  <span>Download Desktop App</span>
              </button>
           )}
        </div>

        <div className="flex flex-col justify-center order-1 lg:order-2">
            <div className="bg-[#181C25] border border-[#2B3139] p-8 lg:p-12 rounded-[48px] shadow-2xl relative overflow-hidden backdrop-blur-xl">
                <div className="relative z-10 space-y-8">
                    <div className="text-center space-y-1">
                        <h2 className="text-2xl font-black text-gray-100 uppercase italic tracking-tight">
                            {view === 'login' ? 'Access Terminal' : 'Protocol Onboarding'}
                        </h2>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">
                            {view === 'login' ? 'Secure Cryptographic Entry' : 'Institutional Clearance Required'}
                        </p>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-4">
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[9px] text-gray-500 font-black uppercase tracking-widest ml-1">Terminal ID (Email)</label>
                                <input 
                                    type="email" 
                                    required 
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="operator@geko.institutional"
                                    className="w-full bg-[#0B0E11] border border-[#2B3139] focus:border-indigo-500 rounded-2xl p-4 text-xs font-mono font-bold text-gray-100 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] text-gray-500 font-black uppercase tracking-widest ml-1">Access Key (Password)</label>
                                <input 
                                    type="password" 
                                    required 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-[#0B0E11] border border-[#2B3139] focus:border-indigo-500 rounded-2xl p-4 text-xs font-mono font-bold text-gray-100 outline-none transition-all"
                                />
                            </div>
                            {view === 'signup' && (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-[9px] text-gray-500 font-black uppercase tracking-widest ml-1">Confirm Access Key</label>
                                        <input 
                                            type="password" 
                                            required 
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="w-full bg-[#0B0E11] border border-[#2B3139] focus:border-indigo-500 rounded-2xl p-4 text-xs font-mono font-bold text-gray-100 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] text-gray-500 font-black uppercase tracking-widest ml-1">Invitation Code</label>
                                        <input 
                                            type="text" 
                                            required 
                                            value={invitationCode}
                                            onChange={(e) => setInvitationCode(e.target.value)}
                                            placeholder="XXXXXX"
                                            className="w-full bg-[#0B0E11] border border-[#2B3139] focus:border-indigo-500 rounded-2xl p-4 text-xs font-mono font-bold text-gray-100 outline-none transition-all"
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        {error && (
                            <div className="p-4 bg-rose-900/20 border border-rose-500/20 rounded-2xl text-[10px] font-black uppercase text-rose-500 text-center tracking-widest">
                                {error}
                            </div>
                        )}

                        {msg && (
                            <div className="p-4 bg-emerald-900/20 border border-emerald-500/20 rounded-2xl text-[10px] font-black uppercase text-emerald-500 text-center tracking-widest">
                                {msg}
                            </div>
                        )}

                        <button 
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black uppercase tracking-[0.2em] py-5 rounded-2xl shadow-xl transition-all text-xs flex items-center justify-center space-x-3"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <span>{view === 'login' ? 'Initialize Identity' : 'Request Clearance'}</span>
                            )}
                        </button>

                        <div className="text-center pt-2">
                            <button 
                                type="button"
                                onClick={() => {
                                    setView(view === 'login' ? 'signup' : 'login');
                                    setError('');
                                    setMsg('');
                                }}
                                className="text-[10px] text-gray-500 font-black uppercase tracking-widest hover:text-indigo-400 transition-colors"
                            >
                                {view === 'login' ? "Need institutional access? Request account" : "Already have clearance? Access terminal"}
                            </button>
                        </div>
                    </form>

                    <div className="flex items-center justify-center space-x-2 pt-2 border-t border-white/5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[8px] text-gray-600 font-black uppercase tracking-widest">Protocol Gateway Online</span>
                    </div>
                </div>
            </div>

            {/* Manual Download Hub */}
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3 animate-in fade-in slide-in-from-bottom-4 delay-500">
                <DownloadCard name="MetaMask" url="https://metamask.io/download/" />
                <DownloadCard name="Binance" url="https://www.bnbchain.org/en/wallet/direct" />
                <DownloadCard name="Phantom" url="https://phantom.app/download" />
                <DownloadCard name="Solflare" url="https://solflare.com/download" />
            </div>
        </div>
      </div>
    </div>
  );
};
`,old_string:
                    <div className="flex items-center justify-center space-x-2 pt-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[8px] text-gray-600 font-black uppercase tracking-widest">Protocol Gateway Online</span>
                    </div>
                </div>
            </div>

            {/* Manual Download Hub */}
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3 animate-in fade-in slide-in-from-bottom-4 delay-500">
                <DownloadCard name="MetaMask" url="https://metamask.io/download/" />
                <DownloadCard name="Binance" url="https://www.bnbchain.org/en/wallet/direct" />
                <DownloadCard name="Phantom" url="https://phantom.app/download" />
                <DownloadCard name="Solflare" url="https://solflare.com/download" />
            </div>
        </div>
      </div>
    </div>
  );
};

function DownloadCard({ name, url }: { name: string, url: string }) {
    return (
        <a href={url} target="_blank" rel="noopener noreferrer" className="bg-[#181C25]/50 border border-[#2B3139] p-3 rounded-2xl flex flex-col items-center justify-center hover:bg-[#2B3139] hover:border-indigo-500/50 transition-all group">
            <span className="text-[7px] text-gray-500 font-black uppercase tracking-widest mb-1">Get Extension</span>
            <span className="text-[10px] text-gray-200 font-black uppercase group-hover:text-indigo-400">{name}</span>
        </a>
    );
}