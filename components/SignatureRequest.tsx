
import React, { useState, useEffect } from 'react';

interface SignatureRequestProps {
  title: string;
  details: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const SignatureRequest: React.FC<SignatureRequestProps> = ({ title, details, onConfirm, onCancel }) => {
  const [step, setStep] = useState<'prompt' | 'awaiting' | 'success'>('prompt');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (step === 'awaiting') {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setStep('success');
            setTimeout(onConfirm, 1200);
            return 100;
          }
          return prev + 2;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [step, onConfirm]);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={step === 'prompt' ? onCancel : undefined}></div>
      
      <div className="relative w-full max-w-sm animate-in slide-in-from-bottom-8 duration-300">
        <div className="glass rounded-[32px] border border-white/10 p-6 shadow-2xl space-y-6">
          
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-7.618 3.016L3 20l9 3 9-3-1.382-14.016z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">{title}</h3>
              <p className="text-xs text-indigo-400 uppercase font-bold tracking-widest">Identity Authentication</p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-sm text-gray-400 font-mono">
            {details}
          </div>

          {step === 'prompt' && (
            <div className="space-y-3">
              <p className="text-center text-xs text-gray-500">
                Please sign the request in your wallet extension.
              </p>
              <div className="flex space-x-3">
                <button 
                  onClick={onCancel}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-gray-400 font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => setStep('awaiting')}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                >
                  I've Signed It
                </button>
              </div>
            </div>
          )}

          {step === 'awaiting' && (
            <div className="space-y-6 py-4">
              <div className="flex justify-center">
                <div className="relative w-24 h-24">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      className="text-gray-800"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 40}
                      strokeDashoffset={2 * Math.PI * 40 * (1 - progress / 100)}
                      className="text-indigo-500 transition-all duration-100"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-10 h-10 text-indigo-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="font-bold text-white">Verifying Signature</p>
                <p className="text-xs text-gray-500 uppercase tracking-widest animate-pulse">Establishing encrypted link...</p>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="py-6 text-center space-y-4 animate-in zoom-in duration-300">
              <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="space-y-1">
                <h4 className="text-xl font-bold text-white">Signed Successfully</h4>
                <p className="text-sm text-gray-500">Transaction broadcasted to network.</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center space-x-2 pt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Secured by Geko Identity Node</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignatureRequest;
