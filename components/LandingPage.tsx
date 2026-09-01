import React, { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { WalletData, AssetInfo } from '../types';
import { Shield, ChevronRight, Search, Activity, Globe, Zap, CreditCard, LogOut, Mail, User, CheckCircle } from 'lucide-react';

interface LandingPageProps {
  onLoginSuccess: (data: WalletData) => void;
  onConnectWalletClick: () => void;
  canInstall?: boolean;
  onInstall?: () => void;
  initialView?: 'login' | 'signup' | 'wait';
  assets?: AssetInfo[];
  onAdminAccess?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ 
  onLoginSuccess, 
  onConnectWalletClick, 
  initialView = 'login',
  assets = [],
}) => {
  const [view, setView] = useState<'login' | 'signup' | 'wait' | 'forgot'>(initialView);
  const [signupStep, setSignupStep] = useState<'initial' | 'verify'>('initial');

  useEffect(() => {
    if (initialView) setView(initialView as any);
  }, [initialView]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMsg('');
    setIsLoading(true);

    try {
      if (view === 'forgot') {
        await authService.forgotPassword(email);
        setMsg('Password recovery request sent to admin.');
        setTimeout(() => setView('login'), 3000);
      } else if (view === 'signup') {
        if (signupStep === 'initial') {
            if (password !== confirmPassword) throw new Error('Passwords do not match');
            const res = await authService.signupRequest(email, password, name);
            setSignupStep('verify');
            if (res.alternativeCode) {
                setMsg(`Verification code sent. Code: ${res.alternativeCode}`);
            } else {
                setMsg('Verification code sent to your email.');
            }
        } else {
            await authService.signupConfirm(email, verificationCode);
            setMsg('Signup successful! Please login.');
            setView('login');
        }
      } else {
        const walletData = await authService.login(email, password);
        if (walletData.status === 'guest' || walletData.status === 'pending_approval') {
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
        <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
            <div className="bg-[#111111] border border-white/5 p-12 rounded-[48px] shadow-2xl max-w-md w-full space-y-8 animate-in fade-in zoom-in duration-500">
                <div className="w-20 h-20 bg-amber-600/10 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
                    <Shield size={40} className="text-amber-500 animate-pulse" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Account Pending</h2>
                    <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest leading-relaxed">Your account is under institutional review. Access will be granted shortly.</p>
                </div>
                <button onClick={() => setView('login')} className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-400">Return to Login</button>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 overflow-y-auto no-scrollbar font-sans">
      <div className="w-full max-w-md space-y-12">
        
        {/* Top Logo Section */}
        <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-[#10B981] rounded-[24px] flex items-center justify-center mx-auto shadow-2xl shadow-[#10B981]/20">
                <div className="flex flex-col items-center">
                    <Zap size={32} className="text-black fill-black" />
                    <span className="text-black font-black text-xs uppercase tracking-tighter">Geko</span>
                </div>
            </div>
            <div className="space-y-1">
                <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter">Establish Link</h1>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em]">Institutional Node Access</p>
            </div>
        </div>

        {/* Main Form Card */}
        <div className="bg-[#111111] border border-white/5 p-8 rounded-[40px] shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#10B981]"></div>
            
            <form onSubmit={handleAuth} className="space-y-6">
                <div className="space-y-4">
                    {view === 'forgot' ? (
                        <div className="space-y-2">
                            <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Account Email</label>
                            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className="w-full bg-black border border-white/5 focus:border-[#10B981] rounded-2xl p-4 text-xs font-mono font-bold text-gray-100 outline-none transition-all shadow-inner" />
                            <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-2 px-1">We'll notify the admin to recover your access.</p>
                        </div>
                    ) : (view === 'login' || signupStep === 'initial') ? (
                        <>
                            {view === 'signup' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Full Name</label>
                                    <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" className="w-full bg-black border border-white/5 focus:border-[#10B981] rounded-2xl p-4 text-xs font-mono font-bold text-gray-100 outline-none transition-all shadow-inner" />
                                </div>
                            )}
                            <div className="space-y-2">
                                <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Email Address</label>
                                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email Address" className="w-full bg-black border border-white/5 focus:border-[#10B981] rounded-2xl p-4 text-xs font-mono font-bold text-gray-100 outline-none transition-all shadow-inner" />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Secret Password</label>
                                    {view === 'login' && (
                                        <button type="button" onClick={() => setView('forgot')} className="text-[9px] text-indigo-400 font-black uppercase tracking-widest hover:text-white transition-colors">Forgot?</button>
                                    )}
                                </div>
                                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-black border border-white/5 focus:border-[#10B981] rounded-2xl p-4 text-xs font-mono font-bold text-gray-100 outline-none transition-all shadow-inner" />
                            </div>
                            {view === 'signup' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1">Confirm Secret</label>
                                    <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="w-full bg-black border border-white/5 focus:border-[#10B981] rounded-2xl p-4 text-xs font-mono font-bold text-gray-100 outline-none transition-all shadow-inner" />
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="space-y-2">
                            <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest ml-1 text-center block w-full">Verification Code</label>
                            <input type="text" required value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} placeholder="XXXXXX" className="w-full bg-black border border-white/5 focus:border-[#10B981] rounded-2xl p-5 text-xl font-mono font-bold text-gray-100 outline-none transition-all text-center tracking-[0.5em]" />
                        </div>
                    )}
                </div>

                {error && <div className="p-4 bg-rose-950/20 border border-rose-500/20 rounded-2xl text-[9px] font-black uppercase text-rose-500 text-center tracking-widest">{error}</div>}
                {msg && <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl text-[9px] font-black uppercase text-emerald-500 text-center tracking-widest">{msg}</div>}

                <button type="submit" disabled={isLoading} className="w-full bg-[#10B981] hover:bg-[#0da673] disabled:opacity-50 text-black font-black uppercase italic tracking-[0.2em] py-5 rounded-2xl shadow-xl transition-all text-xs flex items-center justify-center space-x-3">
                    {isLoading ? <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div> : <span>{view === 'login' ? 'Establish Link' : (view === 'forgot' ? 'Recover Secret' : (signupStep === 'initial' ? 'Request Access' : 'Verify Identity'))}</span>}
                </button>

                <div className="text-center">
                    <button type="button" onClick={() => { setView(view === 'login' ? 'signup' : 'login'); setSignupStep('initial'); setError(''); setMsg(''); }} className="text-[10px] text-gray-500 font-black uppercase tracking-widest hover:text-[#10B981] transition-colors">
                        {view === 'login' ? "New Operator? Create Account" : (view === 'forgot' ? "Back to Login" : "Registered Node? Login")}
                    </button>
                </div>
            </form>
        </div>

        {/* OR CONNECT WALLET SECTION */}
        <div className="space-y-6 pt-4">
            <div className="flex items-center gap-4 px-2">
                <div className="h-px bg-white/5 flex-1"></div>
                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">or</span>
                <div className="h-px bg-white/5 flex-1"></div>
            </div>

            <button 
                onClick={onConnectWalletClick}
                className="w-full bg-[#111111] border border-white/5 hover:border-[#10B981]/30 p-5 rounded-[28px] flex items-center justify-between group transition-all"
            >
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-[#10B981]/10 rounded-xl flex items-center justify-center text-[#10B981] border border-[#10B981]/10 group-hover:bg-[#10B981] group-hover:text-black transition-all">
                        <Shield size={20} />
                    </div>
                    <div className="text-left">
                        <div className="text-xs font-black text-gray-200 uppercase tracking-tight">Connect Web3 Wallet</div>
                        <div className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">Phantom, Solflare, etc.</div>
                    </div>
                </div>
                <ChevronRight size={18} className="text-gray-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </button>
        </div>

        {/* Footer / Status */}
        <div className="flex items-center justify-center space-x-2 opacity-50 pt-10">
            <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
            <span className="text-[8px] text-gray-600 font-black uppercase tracking-widest">Protocol Gateway Online</span>
        </div>
      </div>
    </div>
  );
};
