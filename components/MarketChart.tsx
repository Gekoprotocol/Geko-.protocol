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
  const activeTradesRef = useRef<ActiveTrade[]>(activeTrades || []);
  const mountedRef = useRef<boolean>(true);

  // Sync active trades to ref
  useEffect(() => {
    activeTradesRef.current = activeTrades || [];
  }, [activeTrades]);

  useEffect(() => {
    mountedRef.current = true;
    const handleFsChange = () => {
        if (mountedRef.current) setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
        mountedRef.current = false;
        document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, []);

  // Combined Chart Effect
  useEffect(() => {
    if (!chartContainerRef.current) return;
    
    let isCancelled = false;
    let tickInterval: any = null;
    let priceFetchInterval: any = null;
    let lastPrice = 0;

    // CLEANUP: Ensure container is empty safely
    try {
        if (chartContainerRef.current) {
            chartContainerRef.current.innerHTML = '';
        }
    } catch (e) {}
    
    let chart: IChartApi;
    let series: ISeriesApi<"Candlestick">;

    try {
        chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#0B0E11' },
                textColor: '#707a8a',
            },
            grid: {
                vertLines: { color: 'rgba(43, 49, 57, 0.5)' },
                horzLines: { color: 'rgba(43, 49, 57, 0.5)' },
            },
            width: chartContainerRef.current.clientWidth || 800,
            height: chartContainerRef.current.clientHeight || 500,
            timeScale: {
                borderColor: '#2b3139',
                timeVisible: true,
                secondsVisible: false,
            },
            rightPriceScale: {
                borderColor: '#2b3139',
            }
        });
        chartRef.current = chart;

        series = chart.addCandlestickSeries({
            upColor: '#26a69a', downColor: '#ef5350', borderVisible: false,
            wickUpColor: '#26a69a', wickDownColor: '#ef5350',
        });
        seriesRef.current = series;
    } catch (e) {
        console.error("[Chart] Fatal initialization error", e);
        return;
    }

    const fetchInitialData = async () => {
        let success = false;
        try {
            const res = await fetch(`/api/binance/klines?symbol=${encodeURIComponent(symbol)}USDT&interval=1m&limit=100`);
            if (res.ok && !isCancelled) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    const formatted = data.map((d: any) => {
                        try {
                            return {
                                time: Math.floor(parseFloat(d[0]) / 1000),
                                open: parseFloat(d[1]) || 0,
                                high: parseFloat(d[2]) || 0,
                                low: parseFloat(d[3]) || 0,
                                close: parseFloat(d[4]) || 0,
                            };
                        } catch (e) { return null; }
                    })
                    .filter((d): d is any => d !== null && !isNaN(d.time))
                    .filter((v, i, a) => i === 0 || v.time > a[i - 1].time); // Strictly increasing
                    
                    if (formatted.length > 0 && seriesRef.current && !isCancelled) {
                        series.setData(formatted);
                        success = true;
                    }
                }
            }
        } catch (e) {
            console.warn("[Chart] Klines fetch failed", e);
        }

        if (!success && !isCancelled && seriesRef.current) {
            const now = Math.floor(Date.now() / 1000);
            const mock = [];
            let p = 50000;
            for (let i = 100; i >= 0; i--) {
                const o = p;
                const c = p + (Math.random() - 0.5) * 100;
                mock.push({
                    time: (now - i * 60) as any,
                    open: o, high: Math.max(o, c) + 20, low: Math.min(o, c) - 20, close: c
                });
                p = c;
            }
            try {
                series.setData(mock);
            } catch (e) {}
        }
    };

    const fetchPrice = async () => {
        try {
            const res = await fetch(`/api/binance/prices`);
            if (res.ok && !isCancelled) {
                const data = await res.json();
                const p = (Array.isArray(data) ? data : []).find((d: any) => d && d.symbol === `${symbol}USDT`);
                if (p) lastPrice = parseFloat(p.lastPrice);
            }
        } catch (e) {}
    };

    fetchInitialData();
    fetchPrice();

    tickInterval = setInterval(() => {
        if (!seriesRef.current || isCancelled) return;

        const activeTrade = (activeTradesRef.current || []).find(t => t && t.symbol === symbol && t.status === 'pending');
        let targetPrice = lastPrice || 50000;

        if (activeTrade) {
            const entryPrice = parseFloat(activeTrade.entryPrice as any) || 50000;
            const timeElapsed = Date.now() - activeTrade.startTime;
            const progress = Math.min(1, timeElapsed / (activeTrade.duration * 1000));
            
            if (activeTrade.forceOutcome === 'win') {
                targetPrice = activeTrade.direction === 'up' 
                    ? entryPrice + (progress * 10) 
                    : entryPrice - (progress * 10);
            } else {
                targetPrice = activeTrade.direction === 'up' 
                    ? entryPrice - (progress * 10) 
                    : entryPrice + (progress * 10);
            }
        }

        const finalPrice = targetPrice + (Math.random() - 0.5);
        try {
            if (seriesRef.current && !isCancelled) {
                series.update({
                    time: Math.floor(Date.now() / 1000) as any,
                    open: finalPrice,
                    high: finalPrice + Math.random(),
                    low: finalPrice - Math.random(),
                    close: finalPrice
                });
            }
        } catch (e) {}
    }, 1000);

    priceFetchInterval = setInterval(fetchPrice, 5000);

    const handleResize = () => {
      try {
        if (chartContainerRef.current && chartRef.current && !isCancelled) {
            const w = chartContainerRef.current.clientWidth || 800;
            const h = chartContainerRef.current.clientHeight || 500;
            chartRef.current.applyOptions({ width: w, height: h });
        }
      } catch (e) {}
    };

    let resizeObserver: any = null;
    if (typeof ResizeObserver !== 'undefined' && chartContainerRef.current) {
        resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(chartContainerRef.current);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      isCancelled = true;
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) resizeObserver.disconnect();
      if (tickInterval) clearInterval(tickInterval);
      if (priceFetchInterval) clearInterval(priceFetchInterval);
      try {
          if (chartRef.current) {
              chartRef.current.remove();
          }
      } catch (e) {}
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [symbol]);

  return (
    <div className="w-full h-full relative" onDoubleClick={handleDoubleClick}>
        <div ref={chartContainerRef} className="w-full h-full" />
        
        {isFullscreen && (
            <div className="absolute top-4 right-4 z-50 bg-[#181C25]/80 backdrop-blur-md border border-[#2B3139] px-3 py-1.5 rounded-lg">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Live: {symbol}/USDT</span>
            </div>
        )}
    </div>
  );
};

export default MarketChart;
