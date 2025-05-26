import React, { useEffect, useRef } from 'react';
import { createChart, IChartApi } from 'lightweight-charts';
import { EMA, RSI, MACD } from 'technicalindicators';

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

const ExampleChart: React.FC<{ data: Candle[] }> = ({ data }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<any>(null);
  const emaSeriesRef = useRef<any>(null);
  const rsiSeriesRef = useRef<any>(null);
  const macdHistogramRef = useRef<any>(null);
  const macdLineRef = useRef<any>(null);
  const signalLineRef = useRef<any>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    chartRef.current = createChart(chartContainerRef.current, {
      width: 800,
      height: 500,
      layout: {
        background: { color: '#fff' },
        textColor: '#000',
      },
      rightPriceScale: {
        visible: true,
      },
      timeScale: {
        timeVisible: true,
      },
    });

    // Nến
    candleSeriesRef.current = chartRef.current.addCandlestickSeries();

    // EMA 14
    emaSeriesRef.current = chartRef.current.addLineSeries({
      color: 'blue',
      lineWidth: 2,
      priceLineVisible: false,
    });

    // RSI
    const rsiSeries = chartRef.current.addHistogramSeries({
      priceScaleId: 'rsi',
      color: 'green',
    });
    chartRef.current.priceScale('rsi').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
      visible: true,
      borderVisible: false,
    });
    rsiSeriesRef.current = rsiSeries;

    // MACD
    // Tạo priceScale cho MACD
    chartRef.current.priceScale('macd').applyOptions({
      scaleMargins: { top: 0, bottom: 0.2 },
      visible: true,
      borderVisible: false,
    });

    macdHistogramRef.current = chartRef.current.addHistogramSeries({
      priceScaleId: 'macd',
      color: 'rgba(0,0,255,0.5)',
    });

    macdLineRef.current = chartRef.current.addLineSeries({
      color: 'red',
      lineWidth: 1,
      priceScaleId: 'macd',
    });

    signalLineRef.current = chartRef.current.addLineSeries({
      color: 'orange',
      lineWidth: 1,
      priceScaleId: 'macd',
    });

    return () => {
      chartRef.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (!data.length || !candleSeriesRef.current) return;

    candleSeriesRef.current.setData(data);

    const closePrices = data.map(c => c.close);

    // EMA 14
    const ema14 = EMA.calculate({ period: 14, values: closePrices });
    const emaData = ema14.map((value, i) => ({
      time: data[i + 13].time,
      value,
    }));
    emaSeriesRef.current?.setData(emaData);

    // RSI 14
    const rsi14 = RSI.calculate({ period: 14, values: closePrices });
    const rsiData = rsi14.map((value, i) => ({
      time: data[i + 13].time,
      value,
    }));
    rsiSeriesRef.current?.setData(rsiData);

    // MACD
    const macdInput = {
      values: closePrices,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    };
    const macdResult = MACD.calculate(macdInput);
    const macdHistogramData = macdResult.map((d, i) => ({
      time: data[i + 25].time,
      value: d.histogram,
    }));
    const macdLineData = macdResult.map((d, i) => ({
      time: data[i + 25].time,
      value: d.MACD,
    }));
    const signalLineData = macdResult.map((d, i) => ({
      time: data[i + 25].time,
      value: d.signal,
    }));

    macdHistogramRef.current?.setData(macdHistogramData);
    macdLineRef.current?.setData(macdLineData);
    signalLineRef.current?.setData(signalLineData);
  }, [data]);

  return <div ref={chartContainerRef} />;
  
};

export default ExampleChart;
