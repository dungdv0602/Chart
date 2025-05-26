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

interface ChartProps {
  interval?: string;
  theme?: 'light' | 'dark';
  coin?: string;
  showRSI?: boolean;
  showMACD?: boolean;
  showMA?: boolean;
}

interface IExtendedChartApi extends IChartApi {
  addCandlestickSeries: () => ISeriesApi<'Candlestick'>;
  addHistogramSeries: (options?: any) => ISeriesApi<'Histogram'>;
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

  // Refs cho các series chỉ báo
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const emaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdLineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdSignalSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const handleGetCurrentPrice = () => {
    const last = candleDataRef.current.at(-1);
    if (last) {
      setCurrentPrice(last.close);
      console.log('Current Price:', last.close);
    }
  };

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

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: {
          color: theme === 'dark' ? '#1e1e1e' : '#ffffff',
        },
        textColor: theme === 'dark' ? '#c3ccdc' : '#000',
      },
      grid: {
        vertLines: { color: theme === 'dark' ? '#2b2b2b' : '#e1e1e1' },
        horzLines: { color: theme === 'dark' ? '#2b2b2b' : '#e1e1e1' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: '#ccc',
      },
      timeScale: {
        borderColor: '#ccc',
        timeVisible: true,
        secondsVisible: interval === '1m',
      },
    }) as IExtendedChartApi;

    const candleSeries = chart.addCandlestickSeries();
    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0, bottom: 0.7 },
    });

    // Tạo các line series cho chỉ báo kỹ thuật nếu được bật
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

    let unsubscribeWS: () => void;

    GetCandles(interval, coin).then((data) => {
      const candleData: CandlestickData<Time>[] = data.map((candle) => ({
        time: Math.floor(candle.openTime / 1000) as Time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }));

      const volumeData: HistogramData<Time>[] = data.map((candle) => ({
        time: Math.floor(candle.openTime / 1000) as Time,
        value: candle.volume,
        color: candle.open > candle.close ? '#ef5350' : '#26a69a',
      }));

      candleSeries.setData(candleData);
      volumeSeries.setData(volumeData);
      candleDataRef.current = candleData;

      const closePrices = candleData.map((c) => c.close);

      if (showRSI && rsiSeriesRef.current) {
        const rsiValues = RSI.calculate({ values: closePrices, period: 14 });
        const rsiData = rsiValues.map((value, idx) => ({
          time: candleData[idx + 14 - 1].time,
          value,
        }));
        rsiSeriesRef.current.setData(rsiData);
      }

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
        const macdLineData = macdValues.map((v, idx) => ({
          time: candleData[idx + 26 - 1].time,
          value: v.MACD,
        }));
        const macdSignalData = macdValues.map((v, idx) => ({
          time: candleData[idx + 26 - 1].time,
          value: v.signal,
        }));

        macdLineSeriesRef.current.setData(macdLineData);
        macdSignalSeriesRef.current.setData(macdSignalData);
      }
    });

    unsubscribeWS = subscribeToWS(interval, coin, (liveCandle) => {
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
        if (showRSI && rsiSeriesRef.current) {
          const rsiValues = RSI.calculate({ values: closePrices, period: 14 });
          rsiSeriesRef.current.update({
            time: newCandle.time,
            value: rsiValues[rsiValues.length - 1],
          });
        }

        if (showMA && emaSeriesRef.current && smaSeriesRef.current) {
          const emaValues = EMA.calculate({ values: closePrices, period: 14 });
          const smaValues = SMA.calculate({ values: closePrices, period: 14 });

          emaSeriesRef.current.update({
            time: newCandle.time,
            value: emaValues[emaValues.length - 1],
          });
          smaSeriesRef.current.update({
            time: newCandle.time,
            value: smaValues[smaValues.length - 1],
          });
        }

        if (
          showMACD &&
          macdLineSeriesRef.current &&
          macdSignalSeriesRef.current
        ) {
          const macdInput = {
            values: closePrices,
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            SimpleMAOscillator: false,
            SimpleMASignal: false,
          };
          const macdValues = MACD.calculate(macdInput);
          const lastMACD = macdValues[macdValues.length - 1];
          macdLineSeriesRef.current.update({ time: newCandle.time, value: lastMACD.MACD });
          macdSignalSeriesRef.current.update({ time: newCandle.time, value: lastMACD.signal });
        }
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      unsubscribeWS?.();
      chart.remove();
      resizeObserver.disconnect();
    };
  }, [interval, theme, coin, showRSI, showMACD, showMA]);

  return (
    <div>
      <div ref={chartContainerRef} className="w-full h-[500px]" />

      <div className="mt-4 flex flex-col md:flex-row gap-2">
        <button
          onClick={handleGetCurrentPrice}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Lấy giá hiện tại
        </button>
        <button
          onClick={handleGetPrice1MinuteAgo}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Giá cách đây 1 phút
        </button>
      </div>

      <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
        {currentPrice !== null && (
          <div>
            Giá hiện tại: <strong>{currentPrice}</strong>
          </div>
        )}
        {price1MinuteAgo !== null && (
          <div>
            Giá 1 phút trước: <strong>{price1MinuteAgo}</strong>
          </div>
        )}
      </div>
    </div>
  );
};
