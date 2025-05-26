// 'use client';

// import React, { useState } from 'react';
// import { Chart } from '../Components/Chart'; // đường dẫn đúng đến Chart component

// const coins = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT'];
// const intervals = ['1m', '5m', '15m', '1h', '4h', '1d'];
// const themes = ['light', 'dark'];

// export default function HomePage() {
//   const [coin, setCoin] = useState('BTCUSDT');
//   const [interval, setInterval] = useState('1m');
//   const [theme, setTheme] = useState<'light' | 'dark'>('light');

//   return (
//     <div className={`min-h-screen p-4 ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-black'}`}>
//       <h1 className="text-2xl font-bold mb-4">Crypto Chart</h1>

//       <div className="flex gap-4 mb-6">
//         <div>
//           <label htmlFor="coin" className="block mb-1 font-semibold">Coin</label>
//           <select
//             id="coin"
//             value={coin}
//             onChange={(e) => setCoin(e.target.value)}
//             className="p-2 border rounded"
//           >
//             {coins.map((c) => (
//               <option key={c} value={c}>
//                 {c}
//               </option>
//             ))}
//           </select>
//         </div>

//         <div>
//           <label htmlFor="interval" className="block mb-1 font-semibold">Interval</label>
//           <select
//             id="interval"
//             value={interval}
//             onChange={(e) => setInterval(e.target.value)}
//             className="p-2 border rounded"
//           >
//             {intervals.map((i) => (
//               <option key={i} value={i}>
//                 {i}
//               </option>
//             ))}
//           </select>
//         </div>

//         <div>
//           <label htmlFor="theme" className="block mb-1 font-semibold">Theme</label>
//           <select
//             id="theme"
//             value={theme}
//             onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
//             className="p-2 border rounded"
//           >
//             {themes.map((t) => (
//               <option key={t} value={t}>
//                 {t}
//               </option>
//             ))}
//           </select>
//         </div>
//       </div>

//       <Chart coin={coin} interval={interval} theme={theme} />
//     </div>
//   );
// }
