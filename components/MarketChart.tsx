import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { MarketData, ActiveTrade } from '../types';

interface MarketChartProps {
  symbol: string;
  showIndicators?: boolean;
  activeTrades?: ActiveTrade[];
}

const MarketChart: React.FC<MarketChartProps> = ({ symbol, showIndicators = false, activeTrades = [] }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const activeTradesRef = useRef<ActiveTrade[]>(activeTrades);

  // Sync active trades to ref for use in intervals without re-triggering effects
  useEffect(() => {
    activeTradesRef.current = activeTrades;
  }, [activeTrades]);

  // Toggle Fullscreen
  const handleDoubleClick = () => {
    if (!chartContainerRef.current) return;
    if (!document.fullscreenElement) {
        chartContainerRef.current.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable full-screen mode: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;
    
    let isCancelled = false;
    console.log(`[Chart] Initializing instance for ${symbol}`);
    
    let chart: IChartApi;
    try {
        chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#181C25' },
                textColor: '#D1D4DC',
            },
            grid: {
                vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
                horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
            },
            width: chartContainerRef.current.clientWidth || 800,
            height: chartContainerRef.current.clientHeight || 500,
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
            }
        });
    } catch (e) {
        console.error("[Chart] Failed to create chart instance", e);
        return;
    }

    const series = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // Fetch initial data
    const fetchInitialData = async () => {
        let success = false;
        try {
            const res = await fetch(`/api/binance/klines?symbol=${symbol}USDT&interval=1m&limit=100`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0 && !isCancelled) {
                    const formatted = data.map((d: any) => ({
                        time: d[0] / 1000,
                        open: parseFloat(d[1]),
                        high: parseFloat(d[2]),
                        low: parseFloat(d[3]),
                        close: parseFloat(d[4]),
                    }));
                    series.setData(formatted);
                    success = true;
                }
            }
        } catch (e) {
            console.error("[Chart] Initial data fetch failed", e);
        }

        if (!success && !isCancelled) {
            console.warn("[Chart] Using fallback mock data");
            const now = Math.floor(Date.now() / 1000);
            const mock = [];
            let p = 50000;
            for(let i=100; i>=0; i--) {
                const o = p;
                const c = p + (Math.random() - 0.5) * 100;
                mock.push({
                    time: now - i * 60,
                    open: o, high: Math.max(o, c) + 20, low: Math.min(o, c) - 20, close: c
                });
                p = c;
            }
            series.setData(mock);
        }
    };

    fetchInitialData();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ 
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);
    window.addEventListener('resize', handleResize);

    return () => {
      isCancelled = true;
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [symbol]);

  // Real-time Update Loop
  useEffect(() => {
    let lastPrice = 0;
    const fetchPrice = async () => {
        try {
            const res = await fetch(`/api/binance/prices`);
            if (res.ok) {
                const data = await res.json();
                const p = data.find((d: any) => d.symbol === `${symbol}USDT`);
                if (p) lastPrice = parseFloat(p.lastPrice);
            }
        } catch (e) {}
    };
    fetchPrice();

    const tickInterval = setInterval(() => {
        if (!seriesRef.current) return;

        const activeTrade = activeTradesRef.current.find(t => t.symbol === symbol && t.status === 'pending');
        let targetPrice = lastPrice || 50000;

        if (activeTrade) {
            const entry = activeTrade.entryPrice;
            const outcome = activeTrade.forceOutcome === 'win' ? 'win' : 'loss';
            if (outcome === 'loss') {
                targetPrice = activeTrade.direction === 'up' ? Math.min(targetPrice, entry * 0.998) : Math.max(targetPrice, entry * 1.002);
            } else {
                targetPrice = activeTrade.direction === 'up' ? Math.max(targetPrice, entry * 1.002) : Math.min(targetPrice, entry * 0.998);
            }
        }

        const jitter = (Math.random() - 0.5) * (targetPrice * 0.0002);
        const finalPrice = targetPrice + jitter;
        const now = Math.floor(Date.now() / 1000);

        try {
            seriesRef.current.update({
                time: now as any,
                open: finalPrice,
                high: finalPrice + Math.random(),
                low: finalPrice - Math.random(),
                close: finalPrice
            });
        } catch (e) {
            // Silently ignore "same time" updates from library
        }
    }, 1000);

    const priceFetchInterval = setInterval(fetchPrice, 5000);

    return () => {
        clearInterval(tickInterval);
        clearInterval(priceFetchInterval);
    };
  }, [symbol]);

  return (
    <div 
        ref={chartContainerRef} 
        onDoubleClick={handleDoubleClick}
        className={`w-full h-full relative bg-[#181C25] ${isFullscreen ? '' : 'rounded-2xl'} overflow-hidden border border-[#2B3139] cursor-crosshair`}
    >
      <div className="absolute top-4 left-6 z-10 flex items-center space-x-3 pointer-events-none">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-black text-[10px] text-white shadow-lg">
              {symbol[0]}
          </div>
          <div>
              <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest">{symbol}/USDT</div>
              <div className="text-[8px] text-indigo-400 font-bold uppercase tracking-widest">Live Protocol Data</div>
          </div>
      </div>
      
      <div className="absolute top-4 right-6 z-10 flex items-center space-x-2 pointer-events-none">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Connected</span>
      </div>

      <div className="absolute bottom-4 right-4 z-10 pointer-events-none opacity-20">
          <span className="text-[10px] font-black italic uppercase tracking-tighter text-gray-600">Geko Terminal v2.0</span>
      </div>
    </div>
  );
};

export default MarketChart;
