
import React, { useState, useEffect } from 'react';
import { analyzeMarket } from '../services/geminiService';
import { AnalysisResult, MarketData } from '../types';

interface GeminiAdvisorProps {
  symbol: string;
  data: MarketData[];
  onExecuteSignal?: (direction: 'up' | 'down', amount: string) => void;
}

const GeminiAdvisor: React.FC<GeminiAdvisorProps> = ({ symbol, data, onExecuteSignal }) => {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);

  const performAnalysis = async () => {
    setLoading(true);
    setAnalysis(null);
    try {
      const dataStr = data.slice(-15).map(d => `${d.time}: ${d.close}`).join(', ');
      const result = await analyzeMarket(symbol, dataStr);
      setAnalysis(result);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    performAnalysis();
  }, [symbol]);

  const handleExecute = () => {
      if (!analysis || !onExecuteSignal) return;
      const dir = analysis.sentiment === 'Bullish' ? 'up' : 'down';
      onExecuteSignal(dir, '500');
  };

  return (
    <div className="bg-[#181C25] rounded-none p-6 h-full flex flex-col relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-indigo-500">
          <svg className="w-32 h-32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
      </div>

      <div className="flex items-center justify-between mb-6 z-10 relative">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></div>
          <h2 className="text-base font-black text-gray-100 uppercase italic tracking-tighter">Neural_Insight</h2>
        </div>
        <button 
          onClick={performAnalysis}
          disabled={loading}
          className="text-[9px] font-black bg-[#262B36] hover:bg-[#2F3642] text-gray-400 px-3 py-1.5 rounded-md border border-[#363C45] uppercase tracking-widest"
        >
          {loading ? 'SYNCING...' : 'REFRESH'}
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4 text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-[10px] text-gray-600 font-mono uppercase tracking-widest">Quantizing Market Flow...</div>
        </div>
      ) : analysis ? (
        <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar z-10 relative pr-2 pb-6">
          <div className="flex items-center space-x-4">
            <div className={`px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wide border ${
              analysis.sentiment === 'Bullish' ? 'bg-emerald-900/20 text-emerald-500 border-emerald-500/20' : 
              analysis.sentiment === 'Bearish' ? 'bg-rose-900/20 text-rose-500 border-rose-500/20' : 
              'bg-amber-900/20 text-amber-500 border-amber-500/20'
            }`}>
              {analysis.sentiment}
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase mb-1">
                <span>Confidence</span>
                <span>{analysis.score}%</span>
              </div>
              <div className="w-full bg-[#0B0E11] h-1.5 rounded-full overflow-hidden border border-[#2B3139]">
                <div 
                  className={`h-full transition-all duration-1000 ${
                    analysis.score > 70 ? 'bg-emerald-500' : analysis.score > 40 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${analysis.score}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="bg-[#0B0E11] p-4 rounded-xl border border-[#2B3139]">
            <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">Market Thesis</h3>
            <p className="text-[11px] text-gray-400 leading-relaxed italic">
              "{analysis.summary}"
            </p>
          </div>

          <button 
            onClick={handleExecute}
            className={`w-full py-4 rounded-xl font-black uppercase italic text-[11px] tracking-widest transition-all shadow-lg active:scale-95 ${
                analysis.sentiment === 'Bullish' 
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20' 
                : analysis.sentiment === 'Bearish'
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
            }`}
          >
            Deploy AI {analysis.sentiment === 'Bullish' ? 'Long' : 'Short'} Strategy
          </button>

          <div>
            <h3 className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-3">AI Directives</h3>
            <ul className="space-y-2">
              {analysis.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start space-x-3 text-[10px] text-gray-500 bg-[#0B0E11]/50 p-3 rounded-lg border border-[#2B3139]">
                  <span className="text-indigo-500 font-bold">0{i+1}</span>
                  <span className="italic">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-600 text-[10px] uppercase font-black">AI Uplink Offline</div>
      )}
    </div>
  );
};

export default GeminiAdvisor;
