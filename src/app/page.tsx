'use client';

import React, { useState } from 'react';
import { Chart } from '@/app/Components/Chart';

// Định nghĩa kiểu dữ liệu cho interval và coin
type IntervalType = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';
type CoinType = 'BTCUSDT' | 'ETHUSDT' | 'BNBUSDT';

// Định nghĩa các khoảng thời gian có sẵn
const INTERVALS: { value: IntervalType; label: string }[] = [
  { value: '1m', label: '1 phút' },
  { value: '5m', label: '5 phút' },
  { value: '15m', label: '15 phút' },
  { value: '1h', label: '1 giờ' },
  { value: '4h', label: '4 giờ' },
  { value: '1d', label: '1 ngày' },
];

// Định nghĩa  tiền có sẵn
const COINS: { value: CoinType; label: string }[] = [
  { value: 'BTCUSDT', label: 'BTC/USDT' },
  { value: 'ETHUSDT', label: 'ETH/USDT' },
  { value: 'BNBUSDT', label: 'BNB/USDT' },
];

export default function Home() {
  // State quản lý cặp tiền và khoảng thời gian với kiểu dữ liệu cụ thể
  const [coin, setCoin] = useState<CoinType>(COINS[0].value);
  const [interval, setInterval] = useState<IntervalType>('1h');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [showSettings, setShowSettings] = useState(false);

  // State bật/tắt chỉ báo
  const [showRSI, setShowRSI] = useState(false);
  const [showMACD, setShowMACD] = useState(false);
  const [showMA, setShowMA] = useState(true); // EMA/SMA chung

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">Biểu Đồ Giá Crypto</h1>

      {/* Panel điều khiển chính */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Chọn cặp tiền */}
          <div className="space-y-2">
            <select 
              value={coin} 
              onChange={(e) => setCoin(e.target.value as CoinType)} 
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {COINS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Chọn khoảng thời gian */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {INTERVALS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setInterval(value as IntervalType)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors
                    ${interval === value 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Chọn theme */}
          <div className="space-y-2">
            <select 
              value={theme} 
              onChange={(e) => setTheme(e.target.value as 'light' | 'dark')} 
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="light">Sáng</option>
              <option value="dark">Tối</option>
            </select>
          </div>
        </div>

        {/* Panel chỉ báo kỹ thuật */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-700 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
          <input
            type="checkbox"
            checked={showRSI}
            onChange={() => setShowRSI((v) => !v)}
                className="rounded text-blue-500 focus:ring-blue-500"
          />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">RSI</span>
        </label>

            <label className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-700 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
          <input
            type="checkbox"
            checked={showMACD}
            onChange={() => setShowMACD((v) => !v)}
                className="rounded text-blue-500 focus:ring-blue-500"
          />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">MACD</span>
        </label>

            <label className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-700 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              <input
                type="checkbox"
                checked={showMA}
                onChange={() => setShowMA((v) => !v)}
                className="rounded text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">EMA/SMA</span>
            </label>
            {showMA && (
              <button
                onClick={() => setShowSettings(true)}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-700 dark:text-gray-300">
                  <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Cài đặt EMA/SMA</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Biểu đồ */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
      <Chart
        coin={coin}
        interval={interval}
        theme={theme}
        showRSI={showRSI}
        showMACD={showMACD}
        showMA={showMA}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
      />
      </div>
    </main>
  );
}
