import React, { useEffect, useRef, useState } from 'react';

interface MarketChartProps {
  data: any[];
  symbol: string;
  showVolume?: boolean;
  showIndicators?: boolean;
}

const MarketChart: React.FC<MarketChartProps> = ({ symbol, showIndicators }) => {
  const [loaded, setLoaded] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    setLoaded(false);
    setKey(k => k + 1);
  }, [symbol]);

  const studies = showIndicators
    ? encodeURIComponent(JSON.stringify(['MACD@tv-basicstudies', 'RSI@tv-basicstudies', 'BB@tv-basicstudies']))
    : encodeURIComponent(JSON.stringify([]));

  const src =
    `https://s.tradingview.com/widgetembed/` +
    `?frameElementId=tv_${symbol}` +
    `&symbol=BINANCE%3A${symbol}USDT` +
    `&interval=60` +
    `&hidesidetoolbar=0` +
    `&symboledit=1` +
    `&saveimage=0` +
    `&toolbarbg=181C25` +
    `&studies=${studies}` +
    `&theme=dark` +
    `&style=1` +
    `&timezone=Etc%2FUTC` +
    `&withdateranges=1` +
    `&hideideas=1` +
    `&locale=en`;

  return (
    <div className="w-full h-full relative bg-[#181C25] rounded-2xl overflow-hidden border border-[#2B3139]">
      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 z-10 bg-[#181C25]">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Loading {symbol}/USDT</span>
        </div>
      )}
      <iframe
        key={key}
        src={src}
        title={`${symbol} Chart`}
        frameBorder="0"
        allowTransparency
        scrolling="no"
        allowFullScreen
        onLoad={() => setLoaded(true)}
        className="w-full h-full"
        style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
      />
    </div>
  );
};

export default MarketChart;
