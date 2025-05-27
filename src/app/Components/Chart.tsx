'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  Time,
} from 'lightweight-charts';
import { GetCandles, subscribeToWS } from '@/app/services/binance';
import { RSI, EMA, SMA, MACD } from 'technicalindicators';

// Props cho component Chart
interface ChartProps {
  interval?: string;
  theme?: 'light' | 'dark';
  coin?: string;
  showRSI?: boolean;
  showMACD?: boolean;
  showMA?: boolean;
}

// Kế thừa để mở rộng khả năng thêm series vào biểu đồ
interface IExtendedChartApi extends IChartApi {
  addCandlestickSeries: (options?: Record<string, unknown>) => ISeriesApi<'Candlestick'>;
  addHistogramSeries: (options?: Record<string, unknown>) => ISeriesApi<'Histogram'>;
}

export const Chart: React.FC<ChartProps> = ({
  interval = '1m',
  theme = 'light',
  coin = 'BTCUSDT',
  showRSI = false,
  showMACD = false,
  showMA = false,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const candleDataRef = useRef<CandlestickData<Time>[]>([]);

  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [price1MinuteAgo, setPrice1MinuteAgo] = useState<number | null>(null);

  // Các series chỉ số kỹ thuật
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const emaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdLineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdSignalSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // Lấy giá hiện tại từ nến cuối cùng
  const handleGetCurrentPrice = () => {
    const last = candleDataRef.current.at(-1);
    if (last) {
      setCurrentPrice(last.close);
      console.log('Current Price:', last.close);
    }
  };

  // Lấy giá cách đây 1 phút
  const handleGetPrice1MinuteAgo = () => {
    const targetTime = Math.floor(Date.now() / 1000) - 60;

    const price = candleDataRef.current
      .filter((c) => typeof c.time === 'number' && c.time <= targetTime)
      .sort((a, b) => (b.time as number) - (a.time as number))[0];

    if (price) {
      setPrice1MinuteAgo(price.close);
      console.log('Price 1 minute ago:', price.close);
    } else {
      console.log('Không tìm thấy giá cách đây 1 phút.');
    }
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Tạo biểu đồ chính
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { color: theme === 'dark' ? '#1e1e1e' : '#ffffff' },
        textColor: theme === 'dark' ? '#c3ccdc' : '#000',
      },
      grid: {
        vertLines: { color: theme === 'dark' ? '#2b2b2b' : '#e1e1e1' },
        horzLines: { color: theme === 'dark' ? '#2b2b2b' : '#e1e1e1' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#ccc' },
      timeScale: {
        borderColor: '#ccc',
        timeVisible: true,
        secondsVisible: interval === '1m',
      },
    }) as IExtendedChartApi;

    // Series nến và khối lượng
    const candleSeries = chart.addCandlestickSeries();
    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0, bottom: 0.7 },
    });

    // Thêm các chỉ báo kỹ thuật nếu được bật
    if (showRSI) {
      rsiSeriesRef.current = chart.addLineSeries({ color: 'orange', lineWidth: 2, priceScaleId: '' });
    }
    if (showMA) {
      emaSeriesRef.current = chart.addLineSeries({ color: 'blue', lineWidth: 2, priceScaleId: '' });
      smaSeriesRef.current = chart.addLineSeries({ color: 'purple', lineWidth: 2, priceScaleId: '' });
    }
    if (showMACD) {
      macdLineSeriesRef.current = chart.addLineSeries({ color: 'green', lineWidth: 2, priceScaleId: '' });
      macdSignalSeriesRef.current = chart.addLineSeries({ color: 'red', lineWidth: 2, priceScaleId: '' });
    }

    // Lắng nghe dữ liệu nến trực tiếp từ websocket
    const unsubscribeWS = subscribeToWS(interval, coin, (liveCandle) => {
      const newCandle: CandlestickData<Time> = {
        time: liveCandle.time as Time,
        open: liveCandle.open,
        high: liveCandle.high,
        low: liveCandle.low,
        close: liveCandle.close,
      };

      candleSeries.update(newCandle);
      volumeSeries.update({
        time: liveCandle.time as Time,
        value: liveCandle.volume,
        color: liveCandle.open > liveCandle.close ? '#ef5350' : '#26a69a',
      });

      candleDataRef.current.push(newCandle);
      const closePrices = candleDataRef.current.map((c) => c.close);

      if (closePrices.length >= 26) {
        // Cập nhật RSI
        if (showRSI && rsiSeriesRef.current) {
          const rsiValues = RSI.calculate({ values: closePrices, period: 14 });
          rsiSeriesRef.current.update({ time: newCandle.time, value: rsiValues.at(-1)! });
        }

        // Cập nhật MA
        if (showMA && emaSeriesRef.current && smaSeriesRef.current) {
          const emaValues = EMA.calculate({ values: closePrices, period: 14 });
          const smaValues = SMA.calculate({ values: closePrices, period: 14 });

          emaSeriesRef.current.update({ time: newCandle.time, value: emaValues.at(-1)! });
          smaSeriesRef.current.update({ time: newCandle.time, value: smaValues.at(-1)! });
        }

        // Cập nhật MACD
        if (showMACD && macdLineSeriesRef.current && macdSignalSeriesRef.current) {
          const macdInput = {
            values: closePrices,
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            SimpleMAOscillator: false,
            SimpleMASignal: false,
          };
          const macdValues = MACD.calculate(macdInput);
          const lastMACD = macdValues.at(-1)!;
          macdLineSeriesRef.current.update({ time: newCandle.time, value: lastMACD.MACD });
          macdSignalSeriesRef.current.update({ time: newCandle.time, value: lastMACD.signal });
        }
      }
    });

    // Lấy dữ liệu nến lịch sử và thiết lập biểu đồ ban đầu
    GetCandles(interval, coin).then((data) => {
      const candleData = data.map((candle) => ({
        time: Math.floor(candle.openTime / 1000) as Time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }));

      const volumeData = data.map((candle) => ({
        time: Math.floor(candle.openTime / 1000) as Time,
        value: candle.volume,
        color: candle.open > candle.close ? '#ef5350' : '#26a69a',
      }));

      candleSeries.setData(candleData);
      volumeSeries.setData(volumeData);
      candleDataRef.current = candleData;

      const closePrices = candleData.map((c) => c.close);

      // Thiết lập chỉ báo RSI
      if (showRSI && rsiSeriesRef.current) {
        const rsiValues = RSI.calculate({ values: closePrices, period: 14 });
        const rsiData = rsiValues.map((value, idx) => ({
          time: candleData[idx + 14 - 1].time,
          value,
        }));
        rsiSeriesRef.current.setData(rsiData);
      }

      // Thiết lập chỉ báo EMA & SMA
      if (showMA && emaSeriesRef.current && smaSeriesRef.current) {
        const emaValues = EMA.calculate({ values: closePrices, period: 14 });
        const smaValues = SMA.calculate({ values: closePrices, period: 14 });

        const emaData = emaValues.map((value, idx) => ({
          time: candleData[idx + 14 - 1].time,
          value,
        }));
        const smaData = smaValues.map((value, idx) => ({
          time: candleData[idx + 14 - 1].time,
          value,
        }));

        emaSeriesRef.current.setData(emaData);
        smaSeriesRef.current.setData(smaData);
      }

      // Thiết lập chỉ báo MACD
      if (showMACD && macdLineSeriesRef.current && macdSignalSeriesRef.current) {
        const macdInput = {
          values: closePrices,
          fastPeriod: 12,
          slowPeriod: 26,
          signalPeriod: 9,
          SimpleMAOscillator: false,
          SimpleMASignal: false,
        };
        const macdValues = MACD.calculate(macdInput);
        const macdData = macdValues.map((v, idx) => ({
          time: candleData[idx + 26 - 1].time,
          value: v.MACD,
        }));
        const signalData = macdValues.map((v, idx) => ({
          time: candleData[idx + 26 - 1].time,
          value: v.signal,
        }));

        macdLineSeriesRef.current.setData(macdData);
        macdSignalSeriesRef.current.setData(signalData);
      }
    });

    // Responsive khi thay đổi kích thước cửa sổ
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      unsubscribeWS();
      window.removeEventListener('resize', handleResize);
      chart.remove(); // Cleanup biểu đồ
    };
  }, [coin, interval, theme, showRSI, showMA, showMACD]);

  return (
    <div>
      <div
        ref={chartContainerRef}
        style={{ position: 'relative', width: '100%', height: 500 }}
      ></div>


      <button
        onClick={handleGetCurrentPrice}
        style={{
          backgroundColor: theme === 'dark' ? '#007bff' : '#1a73e8',
          color: '#fff',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: 'pointer',
          marginRight: '10px',
        }}
      >
        Lấy Giá Hiện Tại
      </button>

      <button
        onClick={handleGetPrice1MinuteAgo}
        style={{
          backgroundColor: theme === 'dark' ? '#28a745' : '#34a853',
          color: '#fff',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Lấy Giá Cách Đây 1 Phút
      </button>


      {currentPrice !== null && <div>Giá hiện tại: {currentPrice}</div>}
      {price1MinuteAgo !== null && <div>Giá cách đây 1 phút: {price1MinuteAgo}</div>}
    </div>
  );
};
