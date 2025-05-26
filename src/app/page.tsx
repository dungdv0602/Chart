'use client';

import React, { useState } from 'react';
import { Chart } from '@/app/Components/Chart';

export default function Home() {
  const [coin, setCoin] = useState('BTCUSDT');
  const [interval, setInterval] = useState('1m');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // State bật/tắt chỉ báo
  const [showRSI, setShowRSI] = useState(true);
  const [showMACD, setShowMACD] = useState(true);
  const [showMA, setShowMA] = useState(true); // EMA/SMA chung

  return (
    <main className="p-4">
      <h1 className="text-2xl mb-4"> Chart Demo</h1>

      <div className="mb-4 space-x-2 flex flex-wrap items-center gap-2">
        <select value={coin} onChange={(e) => setCoin(e.target.value)} className="border p-2">
          <option value="BTCUSDT">BTC/USDT</option>
          <option value="ETHUSDT">ETH/USDT</option>
          <option value="BNBUSDT">BNB/USDT</option>
        </select>

        <select value={interval} onChange={(e) => setInterval(e.target.value)} className="border p-2">
          <option value="1m">1m</option>
          <option value="5m">5m</option>
          <option value="15m">15m</option>
          <option value="1h">1h</option>
        </select>

        <select value={theme} onChange={(e) => setTheme(e.target.value as 'light' | 'dark')} className="border p-2">
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>

      <div className="mb-4 space-x-4 flex flex-wrap gap-2">
        <label className="inline-flex items-center gap-1">
          <input
            type="checkbox"
            checked={showRSI}
            onChange={() => setShowRSI((v) => !v)}
          />
          <span>RSI</span>
        </label>

        <label className="inline-flex items-center gap-1">
          <input
            type="checkbox"
            checked={showMACD}
            onChange={() => setShowMACD((v) => !v)}
          />
          <span>MACD</span>
        </label>

        <label className="inline-flex items-center gap-1">
          <input
            type="checkbox"
            checked={showMA}
            onChange={() => setShowMA((v) => !v)}
          />
          <span>EMA/SMA</span>
        </label>
      </div>

      <Chart
        coin={coin}
        interval={interval}
        theme={theme}
        showRSI={showRSI}
        showMACD={showMACD}
        showMA={showMA}
      />
    </main>
  );
}
