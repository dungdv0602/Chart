'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  HistogramData,
} from 'lightweight-charts';
import { GetCandles, subscribeToWS } from '@/app/services/binance';
import { RSI, EMA, SMA, MACD } from 'technicalindicators';

/**
 * Props cho component Chart
 * @interface ChartProps
 * @property {string} [interval='1m'] - Khoảng thời gian giữa các nến (1m, 5m, 15m, etc.)
 * @property {'light' | 'dark'} [theme='light'] - Chủ đề sáng hoặc tối
 * @property {string} [coin='BTCUSDT'] - Cặp tiền cần hiển thị
 * @property {boolean} [showRSI=false] - Hiển thị chỉ báo RSI
 * @property {boolean} [showMACD=false] - Hiển thị chỉ báo MACD
 * @property {boolean} [showMA=false] - Hiển thị đường MA (Moving Average)
 * @property {boolean} [showSettings=false] - Hiển thị modal cài đặt
 * @property {React.Dispatch<React.SetStateAction<boolean>>} [setShowSettings] - Hàm cập nhật trạng thái hiển thị modal cài đặt
 */
interface ChartProps {
  interval?: string;
  theme?: 'light' | 'dark';
  coin?: string;
  showRSI?: boolean;
  showMACD?: boolean;
  showMA?: boolean;
  showSettings?: boolean;
  setShowSettings?: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Mở rộng interface CandlestickData để thêm trường volume
 * @interface ExtendedCandlestickData
 * @extends {CandlestickData<Time>}
 */
interface ExtendedCandlestickData extends CandlestickData<Time> {
  volume?: number; // Thêm trường volume cho dữ liệu nến
}

/**
 * Mở rộng interface IChartApi để thêm các phương thức tạo series
 * @interface IExtendedChartApi
 * @extends {IChartApi}
 */
interface IExtendedChartApi extends IChartApi {
  addCandlestickSeries: (options?: Record<string, unknown>) => ISeriesApi<'Candlestick'>;
  addHistogramSeries: (options?: Record<string, unknown>) => ISeriesApi<'Histogram'>;
}

/**
 * Interface định nghĩa cài đặt cho các đường MA
 * @interface MASettings
 */
interface MASettings {
  emaPeriod: number;      // Chu kỳ cho EMA (Exponential Moving Average)
  smaPeriod: number;      // Chu kỳ cho SMA (Simple Moving Average)
  emaColor: string;       // Màu sắc cho đường EMA
  smaColor: string;       // Màu sắc cho đường SMA
}

/**
 * Component Chart chính - Hiển thị biểu đồ nến với các chỉ báo kỹ thuật
 * @component
 * @param {ChartProps} props - Props của component
 */
export const Chart: React.FC<ChartProps> = ({
  interval = '1m',        // Mặc định interval là 1 phút
  theme = 'light',        // Mặc định theme là sáng
  coin = 'BTCUSDT',       // Mặc định coin là BTCUSDT
  showRSI = false,        // Mặc định không hiển thị RSI
  showMACD = false,       // Mặc định không hiển thị MACD
  showMA = false,         // Mặc định không hiển thị MA
  showSettings = false,   // Mặc định không hiển thị modal cài đặt
  setShowSettings,        // Hàm cập nhật trạng thái hiển thị modal cài đặt
}) => {
  // Refs để lưu trữ các tham chiếu đến DOM và dữ liệu
  const chartContainerRef = useRef<HTMLDivElement>(null);  // Ref cho container chứa biểu đồ
  const candleDataRef = useRef<ExtendedCandlestickData[]>([]); // Ref lưu dữ liệu nến
  
  // States để quản lý UI và cài đặt
  const [maSettings, setMASettings] = useState<MASettings>({ // State lưu cài đặt MA
    emaPeriod: 200,       // Chu kỳ mặc định cho EMA
    smaPeriod: 50,        // Chu kỳ mặc định cho SMA
    emaColor: '#2962FF',  // Màu mặc định cho EMA
    smaColor: '#B71C1C',  // Màu mặc định cho SMA
  });

  // States để theo dõi giá
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [price1MinuteAgo, setPrice1MinuteAgo] = useState<number | null>(null);
  
  // Reset giá khi coin thay đổi
  useEffect(() => {
    setCurrentPrice(null);
    setPrice1MinuteAgo(null);
    priceHistoryRef.current = []; // Reset lịch sử giá
  }, [coin]);

  /**
   * Ref lưu lịch sử giá theo thời gian thực
   * Mỗi phần tử chứa thời gian và giá tại thời điểm đó
   */
  const priceHistoryRef = useRef<Array<{
    time: number;
    price: number;
    coin: string; // Thêm coin vào để kiểm tra
  }>>([]);

  // Refs cho các series chỉ báo kỹ thuật
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);        // Series RSI
  const emaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);        // Series EMA
  const smaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);        // Series SMA
  const macdLineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);   // Series MACD Line
  const macdSignalSeriesRef = useRef<ISeriesApi<'Line'> | null>(null); // Series MACD Signal

  /**
   * Hàm xử lý cập nhật giá hiện tại từ websocket
   * @param {number} price - Giá mới nhận được từ websocket
   */
  const handleGetCurrentPrice = (price: number) => {
    const currentTime = Math.floor(Date.now() / 1000);
    
    // Lưu giá vào lịch sử với timestamp và coin
    priceHistoryRef.current.push({
      time: currentTime,
      price: price,
      coin: coin // Lưu thêm coin để kiểm tra
    });

    // Chỉ giữ lại lịch sử trong 2 phút gần nhất và của coin hiện tại
    const twoMinutesAgo = currentTime - 120;
    priceHistoryRef.current = priceHistoryRef.current.filter(
      item => item.time > twoMinutesAgo && item.coin === coin
    );

    setCurrentPrice(price);
  };

  /**
   * Hàm lấy giá cách đây 1 phút từ lịch sử giá
   * Sử dụng để tính toán biến động giá trong 1 phút gần nhất
   */
  const handleGetPrice1MinuteAgo = () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const oneMinuteAgo = currentTime - 60;

    // Lọc giá của coin hiện tại
    const currentCoinPrices = priceHistoryRef.current.filter(item => item.coin === coin);

    // Tìm giá gần nhất với thời điểm 1 phút trước
    const pricesBeforeOneMinute = currentCoinPrices
      .filter(item => item.time <= oneMinuteAgo)
      .sort((a, b) => b.time - a.time);

    if (pricesBeforeOneMinute.length > 0) {
      // Nếu có giá trong lịch sử, lấy giá gần nhất với thời điểm 1 phút trước
      setPrice1MinuteAgo(pricesBeforeOneMinute[0].price);
    } else if (currentCoinPrices.length > 0) {
      // Nếu không có giá 1 phút trước, lấy giá cũ nhất có trong lịch sử của coin hiện tại
      const oldestPrice = currentCoinPrices
        .sort((a, b) => a.time - b.time)[0];
      setPrice1MinuteAgo(oldestPrice.price);
    } else {
      // Nếu không có giá nào trong lịch sử, set về null
      setPrice1MinuteAgo(null);
    }
  };

  /**
   * Effect chính để khởi tạo và quản lý biểu đồ
   * Chạy lại khi các props thay đổi
   */
  useEffect(() => {
    if (!chartContainerRef.current) return;

    /**
     * Tạo biểu đồ với các cài đặt cơ bản
     * Sử dụng lightweight-charts để tạo biểu đồ nến
     */
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      // Cài đặt giao diện
      layout: {
        background: { color: theme === 'dark' ? '#1e1e1e' : '#ffffff' },
        textColor: theme === 'dark' ? '#c3ccdc' : '#000',
      },
      // Cài đặt lưới
      grid: {
        vertLines: { color: theme === 'dark' ? '#2b2b2b' : '#e1e1e1' },
        horzLines: { color: theme === 'dark' ? '#2b2b2b' : '#e1e1e1' },
      },
      // Cài đặt crosshair (đường kẻ ngang dọc khi hover)
      crosshair: { 
        mode: CrosshairMode.Normal,
        vertLine: {
          labelBackgroundColor: theme === 'dark' ? '#2b2b2b' : '#e1e1e1',
        },
        horzLine: {
          labelBackgroundColor: theme === 'dark' ? '#2b2b2b' : '#e1e1e1',
        }
      },
      // Cài đặt thang giá bên phải
      rightPriceScale: { 
        borderColor: '#ccc',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      // Cài đặt thang thời gian
      timeScale: {
        borderColor: '#ccc',
        timeVisible: true,
        secondsVisible: interval === '1m',
        fixLeftEdge: false,
        fixRightEdge: false,
        rightOffset: 5,
        barSpacing: 8,
        minBarSpacing: 4,
        rightBarStaysOnScroll: true,
        lockVisibleTimeRangeOnResize: false,
        visible: true,
        borderVisible: true,
        allowShiftVisibleRangeOnWhitespaceReplacement: true,
        allowBoldLabels: true,
        tickMarkFormatter: (time: number) => {
          const date = new Date(time * 1000);
          const minutes = date.getMinutes();
          // Hàm helper để format thời gian với giây
          const formatTimeWithSeconds = (date: Date) => {
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            const seconds = date.getSeconds().toString().padStart(2, '0');
            return `${hours}:${minutes}:${seconds}`;
          };

          // Hàm helper để format thời gian
          const formatTime = (date: Date) => {
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
          };

          // Hàm helper để format ngày theo định dạng DD/MM
          const formatShortDate = (date: Date) => {
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            return `${day}/${month}`;
          };

          // Hàm helper để format ngày theo định dạng DD/MM/YY
          const formatDate = (date: Date) => {
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear().toString().slice(-2);
            return `${day}/${month}/${year}`;
          };

          // Hàm helper để format ngày theo định dạng DD/MM/YYYY
          const formatFullDate = (date: Date) => {
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
          };

          // Lấy timestamp của nến hiện tại
          const candleTime = Math.floor(time);

          switch (interval) {
            case '1m':
              // Hiển thị mỗi phút với giây
              if (date.getSeconds() === 0) {
                return formatTimeWithSeconds(date);
              }
              return '';
            
            case '5m':
              // Hiển thị mỗi 5 phút
              if (minutes % 5 === 0) {
                return formatTime(date);
              }
              return '';
            
            case '15m':
              // Hiển thị mỗi 15 phút
              if (minutes % 15 === 0) {
                return formatTime(date);
              }
              return '';
            
            case '1h':
              // Hiển thị mỗi giờ, chỉ hiện ngày
              if (minutes === 0) {
                return formatShortDate(date);
              }
              return '';
            
            case '4h':
              // Hiển thị mỗi 4 giờ, chỉ hiện ngày
              // Kiểm tra xem timestamp có phải là mốc 4 giờ không
              const fourHourTimestamp = Math.floor(date.getTime() / 1000 / (4 * 3600)) * (4 * 3600);
              if (candleTime === fourHourTimestamp) {
                return formatShortDate(date);
              }
              return '';
            
            case '1d':
              // Hiển thị mỗi ngày
              // Kiểm tra xem timestamp có phải là mốc ngày không
              const dayTimestamp = Math.floor(date.getTime() / 1000 / (24 * 3600)) * (24 * 3600);
              if (candleTime === dayTimestamp) {
                return formatDate(date);
              }
              return '';
            
            case '1w':
              // Hiển thị mỗi tuần
              // Tính toán timestamp cho đầu tuần (thứ 2)
              const startOfWeek = new Date(date);
              startOfWeek.setHours(0, 0, 0, 0);
              // Điều chỉnh về thứ 2 (1 là thứ 2 trong JavaScript)
              const dayOfWeek = startOfWeek.getDay();
              const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Nếu là chủ nhật (0) thì lùi 6 ngày, ngược lại điều chỉnh về thứ 2
              startOfWeek.setDate(startOfWeek.getDate() + diff);
              const weekTimestamp = Math.floor(startOfWeek.getTime() / 1000);

              // Debug log
              console.log('Week candle debug:', {
                currentTime: date.toISOString(),
                candleTime,
                weekTimestamp,
                isMatch: candleTime === weekTimestamp,
                dayOfWeek: date.getDay()
              });

              if (candleTime === weekTimestamp) {
                return formatFullDate(date);
              }
              return '';
            
            default:
              return formatTime(date);
          }
        },
      },
    }) as IExtendedChartApi;

    // Series nến
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      priceScaleId: 'right',
    });

    // Series volume với background
    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      priceLineVisible: false,
      lastValueVisible: false,
      baseLineVisible: false,
    });

    // Thêm background cho volume
    const volumeBackground = chart.addHistogramSeries({
      color: theme === 'dark' ? 'rgba(45, 45, 45, 0.6)' : 'rgba(240, 240, 240, 0.6)',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      priceLineVisible: false,
      lastValueVisible: false,
      baseLineVisible: false,
    });

    // Điều chỉnh scale cho volume
    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
      borderVisible: true,
      borderColor: theme === 'dark' ? '#2b2b2b' : '#e1e1e1',
      visible: true,
      autoScale: true,
    });

    // Thêm các chỉ báo kỹ thuật nếu được bật
    if (showRSI) {
      rsiSeriesRef.current = chart.addLineSeries({ 
        color: 'orange', 
        lineWidth: 1, 
        priceScaleId: '',
        title: 'RSI (14)'
      });
    }
    if (showMA) {
      emaSeriesRef.current = chart.addLineSeries({ 
        color: maSettings.emaColor, 
        lineWidth: 1, 
        priceScaleId: 'right',
        title: `EMA (${maSettings.emaPeriod})`,
        lastValueVisible: true,
        priceLineVisible: false,
      });
      smaSeriesRef.current = chart.addLineSeries({ 
        color: maSettings.smaColor, 
        lineWidth: 1, 
        priceScaleId: 'right',
        title: `SMA (${maSettings.smaPeriod})`,
        lastValueVisible: true,
        priceLineVisible: false,
      });
    }
    if (showMACD) {
      macdLineSeriesRef.current = chart.addLineSeries({ 
        color: 'green', 
        lineWidth: 1, 
        priceScaleId: '',
        title: 'MACD'
      });
      macdSignalSeriesRef.current = chart.addLineSeries({ 
        color: 'red', 
        lineWidth: 1, 
        priceScaleId: '',
        title: 'Signal'
      });
    }

    // Thêm tooltip
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.display = 'none';
    container.style.padding = '8px';
    container.style.boxSizing = 'border-box';
    container.style.fontSize = '12px';
    container.style.color = theme === 'dark' ? '#fff' : '#000';
    container.style.backgroundColor = theme === 'dark' ? 'rgba(45, 45, 45, 0.9)' : 'rgba(255, 255, 255, 0.9)';
    container.style.borderRadius = '4px';
    container.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '1000';
    chartContainerRef.current.appendChild(container);

    // Xử lý hiển thị tooltip
    chart.subscribeCrosshairMove((param) => {
      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > chartContainerRef.current!.clientWidth ||
        param.point.y < 0 ||
        param.point.y > chartContainerRef.current!.clientHeight
      ) {
        container.style.display = 'none';
      } else {
        const candleData = param.seriesData.get(candleSeries) as ExtendedCandlestickData;
        const volumeData = param.seriesData.get(volumeSeries) as HistogramData<Time>;
        
        if (candleData) {
          const date = new Date(Number(candleData.time) * 1000);
          const day = date.getDate().toString().padStart(2, '0');
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const year = date.getFullYear().toString().slice(-2);
          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          const seconds = date.getSeconds().toString().padStart(2, '0');
          const dateStr = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;

          // Format volume từ volumeData
          const volume = volumeData ? Number(volumeData.value).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }) : '0';
          
          container.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 4px;">${dateStr}</div>
            <div style="display: grid; grid-template-columns: auto auto; gap: 8px;">
              <div style="color: ${theme === 'dark' ? '#8c8c8c' : '#666'}">Mở:</div>
              <div>${candleData.open}</div>
              <div style="color: ${theme === 'dark' ? '#8c8c8c' : '#666'}">Đóng:</div>
              <div>${candleData.close}</div>
              <div style="color: ${theme === 'dark' ? '#8c8c8c' : '#666'}">Cao:</div>
              <div style="color: #26a69a">${candleData.high}</div>
              <div style="color: ${theme === 'dark' ? '#8c8c8c' : '#666'}">Thấp:</div>
              <div style="color: #ef5350">${candleData.low}</div>
              <div style="color: ${theme === 'dark' ? '#8c8c8c' : '#666'}">Khối lượng:</div>
              <div style="color: ${theme === 'dark' ? '#ffffff' : '#000000'}">${volume}</div>
            </div>
          `;
          container.style.display = 'block';
          const y = param.point.y;
          const x = param.point.x;
          
          // Điều chỉnh vị trí tooltip để không bị che bởi chuột và nằm trong khung nhìn
          let left = x + 20;
          let top = y + 20;
          
          if (left + container.offsetWidth > chartContainerRef.current!.clientWidth) {
            left = x - container.offsetWidth - 20;
          }
          
          if (top + container.offsetHeight > chartContainerRef.current!.clientHeight) {
            top = y - container.offsetHeight - 20;
          }
          
          container.style.left = left + 'px';
          container.style.top = top + 'px';
        } else {
          container.style.display = 'none';
        }
      }
    });

    // Cleanup tooltip khi component unmount
    const cleanupTooltip = () => {
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    };

    /**
     * Lắng nghe dữ liệu nến trực tiếp từ websocket
     * Cập nhật biểu đồ realtime khi có dữ liệu mới
     */
    const unsubscribeWS = subscribeToWS(interval, coin, (liveCandle) => {
      // Tạo nến mới từ dữ liệu websocket
      const newCandle: ExtendedCandlestickData = {
        time: liveCandle.time as Time,
        open: liveCandle.open,
        high: liveCandle.high,
        low: liveCandle.low,
        close: liveCandle.close,
        volume: liveCandle.volume,
      };

      // Cập nhật series nến
      candleSeries.update(newCandle);
      // Cập nhật series volume với màu sắc tương ứng
      volumeSeries.update({
        time: liveCandle.time as Time,
        value: liveCandle.volume,
        color: liveCandle.open > liveCandle.close ? '#ef5350' : '#26a69a',
      });

      // Cập nhật background volume
      const maxVolume = Math.max(
        ...candleDataRef.current.map(d => d.volume || 0),
        liveCandle.volume
      );
      volumeBackground.update({
        time: liveCandle.time as Time,
        value: maxVolume,
      });

      // Lưu nến mới vào ref
      candleDataRef.current.push(newCandle);

      /**
       * Đảm bảo nến cuối luôn cách cạnh phải một khoảng cố định
       * Kiểm tra và điều chỉnh vị trí hiển thị khi có nến mới
       */
      const visibleRange = chart.timeScale().getVisibleRange();
      if (visibleRange) {
        const lastCandleTime = candleDataRef.current[candleDataRef.current.length - 1].time;
        const secondLastCandleTime = candleDataRef.current[candleDataRef.current.length - 2]?.time;
        
        // Nếu đang xem nến cuối hoặc nến thứ hai từ cuối
        if (visibleRange.to === lastCandleTime || visibleRange.to === secondLastCandleTime) {
          // Tính toán vị trí mới để nến cuối cách cạnh phải đúng khoảng
          const newPosition = chart.timeScale().coordinateToTime(chartContainerRef.current!.clientWidth - 100);
          if (newPosition) {
            chart.timeScale().scrollToPosition(0, false);
            // Đặt lại khoảng cách giữa các nến
            chart.timeScale().applyOptions({
              barSpacing: 8,
              rightOffset: 5
            });
          }
        }
      }

      // Cập nhật giá hiện tại và giá 1 phút trước
      handleGetCurrentPrice(liveCandle.close);
      handleGetPrice1MinuteAgo();

      const closePrices = candleDataRef.current.map((c) => c.close);

      if (closePrices.length >= Math.max(maSettings.emaPeriod, maSettings.smaPeriod)) {
        // Cập nhật RSI
        if (showRSI && rsiSeriesRef.current) {
          const rsiValues = RSI.calculate({ values: closePrices, period: 14 });
          rsiSeriesRef.current.update({ 
            time: newCandle.time, 
            value: rsiValues[rsiValues.length - 1] 
          });
        }

        // Cập nhật MA
        if (showMA) {
          if (emaSeriesRef.current) {
            const emaValues = EMA.calculate({ values: closePrices, period: maSettings.emaPeriod });
            emaSeriesRef.current.update({ 
              time: newCandle.time, 
              value: emaValues[emaValues.length - 1] 
            });
          }
          if (smaSeriesRef.current) {
            const smaValues = SMA.calculate({ values: closePrices, period: maSettings.smaPeriod });
            smaSeriesRef.current.update({ 
              time: newCandle.time, 
              value: smaValues[smaValues.length - 1] 
            });
          }
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
          const lastMACD = macdValues[macdValues.length - 1];
          
          macdLineSeriesRef.current.update({ 
            time: newCandle.time, 
            value: lastMACD.MACD 
          });
          macdSignalSeriesRef.current.update({ 
            time: newCandle.time, 
            value: lastMACD.signal 
          });
        }
      }
    });

    // Cập nhật giá mỗi giây
    const priceInterval = setInterval(() => {
      if (currentPrice !== null) {
        handleGetPrice1MinuteAgo();
      }
    }, 1000);

    // Lấy dữ liệu nến lịch sử và thiết lập biểu đồ ban đầu
    GetCandles(interval, coin).then((data) => {
      // Debug log cho dữ liệu nến
      console.log('Candle data for interval', interval, ':', {
        firstCandle: data[0] ? {
          time: new Date(data[0].openTime).toISOString(),
          volume: data[0].volume
        } : null,
        lastCandle: data[data.length - 1] ? {
          time: new Date(data[data.length - 1].openTime).toISOString(),
          volume: data[data.length - 1].volume
        } : null,
        totalCandles: data.length
      });

      const candleData = data.map((candle) => ({
        time: Math.floor(candle.openTime / 1000) as Time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: Number(candle.volume), // Đảm bảo volume là số
      }));

      const volumeData = data.map((candle) => ({
        time: Math.floor(candle.openTime / 1000) as Time,
        value: candle.volume,
        color: candle.open > candle.close ? '#ef5350' : '#26a69a',
      }));

      // Tạo background data cho volume
      const maxVolume = Math.max(...data.map(d => d.volume));
      const volumeBackgroundData = data.map((candle) => ({
        time: Math.floor(candle.openTime / 1000) as Time,
        value: maxVolume,
      }));

      candleSeries.setData(candleData);
      volumeSeries.setData(volumeData);
      volumeBackground.setData(volumeBackgroundData);
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
        const emaValues = EMA.calculate({ values: closePrices, period: maSettings.emaPeriod });
        const smaValues = SMA.calculate({ values: closePrices, period: maSettings.smaPeriod });

        const emaData = emaValues.map((value, idx) => ({
          time: candleData[idx + maSettings.emaPeriod - 1].time,
          value,
        }));
        const smaData = smaValues.map((value, idx) => ({
          time: candleData[idx + maSettings.smaPeriod - 1].time,
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

    /**
     * Xử lý khi resize cửa sổ
     * Đảm bảo biểu đồ responsive và giữ nguyên vị trí nến cuối
     */
    const handleResize = () => {
      if (chartContainerRef.current) {
        // Cập nhật kích thước biểu đồ
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
        
        // Đảm bảo nến cuối vẫn cách cạnh phải đúng khoảng sau khi resize
        const visibleRange = chart.timeScale().getVisibleRange();
        if (visibleRange) {
          const lastCandleTime = candleDataRef.current[candleDataRef.current.length - 1]?.time;
          if (visibleRange.to === lastCandleTime) {
            chart.timeScale().scrollToPosition(0, false);
            chart.timeScale().applyOptions({
              barSpacing: 8,
              rightOffset: 5
            });
          }
        }
      }
    };

    // Đăng ký event listener cho resize
    window.addEventListener('resize', handleResize);

    // Cleanup function khi component unmount
    return () => {
      unsubscribeWS();
      clearInterval(priceInterval);
      cleanupTooltip();
      chart.remove();
      window.removeEventListener('resize', handleResize);
    };
  }, [coin, interval, theme, showRSI, showMA, showMACD, maSettings.emaPeriod, maSettings.smaPeriod, maSettings.emaColor, maSettings.smaColor]);

  // Render UI
  return (
    <div>
      {/* Container chính cho biểu đồ */}
      <div style={{ position: 'relative' }}>
        <div
          ref={chartContainerRef}
          style={{ position: 'relative', width: '100%', height: 500 }}
        ></div>

        {/* Modal cài đặt MA */}
        {showSettings && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}>
            <div style={{
              backgroundColor: theme === 'dark' ? '#1e1e1e' : '#ffffff',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              width: '400px',
              maxWidth: '90%',
            }}>
              <h3 style={{ 
                margin: '0 0 20px 0',
                color: theme === 'dark' ? '#ffffff' : '#000000',
              }}>
                Cài đặt
              </h3>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ 
                  display: 'block',
                  marginBottom: '5px',
                  color: theme === 'dark' ? '#cccccc' : '#666666',
                }}>
                  EMA Period:
                </label>
                <input
                  type="number"
                  value={maSettings.emaPeriod}
                  onChange={(e) => setMASettings(prev => ({
                    ...prev,
                    emaPeriod: parseInt(e.target.value) || 200
                  }))}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: `1px solid ${theme === 'dark' ? '#404040' : '#cccccc'}`,
                    backgroundColor: theme === 'dark' ? '#2d2d2d' : '#ffffff',
                    color: theme === 'dark' ? '#ffffff' : '#000000',
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ 
                  display: 'block',
                  marginBottom: '5px',
                  color: theme === 'dark' ? '#cccccc' : '#666666',
                }}>
                  SMA Period:
                </label>
                <input
                  type="number"
                  value={maSettings.smaPeriod}
                  onChange={(e) => setMASettings(prev => ({
                    ...prev,
                    smaPeriod: parseInt(e.target.value) || 50
                  }))}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: `1px solid ${theme === 'dark' ? '#404040' : '#cccccc'}`,
                    backgroundColor: theme === 'dark' ? '#2d2d2d' : '#ffffff',
                    color: theme === 'dark' ? '#ffffff' : '#000000',
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ 
                  display: 'block',
                  marginBottom: '5px',
                  color: theme === 'dark' ? '#cccccc' : '#666666',
                }}>
                  EMA Color:
                </label>
                <input
                  type="color"
                  value={maSettings.emaColor}
                  onChange={(e) => setMASettings(prev => ({
                    ...prev,
                    emaColor: e.target.value
                  }))}
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '2px',
                    borderRadius: '4px',
                    border: `1px solid ${theme === 'dark' ? '#404040' : '#cccccc'}`,
                    backgroundColor: theme === 'dark' ? '#2d2d2d' : '#ffffff',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  display: 'block',
                  marginBottom: '5px',
                  color: theme === 'dark' ? '#cccccc' : '#666666',
                }}>
                  SMA Color:
                </label>
                <input
                  type="color"
                  value={maSettings.smaColor}
                  onChange={(e) => setMASettings(prev => ({
                    ...prev,
                    smaColor: e.target.value
                  }))}
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '2px',
                    borderRadius: '4px',
                    border: `1px solid ${theme === 'dark' ? '#404040' : '#cccccc'}`,
                    backgroundColor: theme === 'dark' ? '#2d2d2d' : '#ffffff',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowSettings?.(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: theme === 'dark' ? '#404040' : '#e0e0e0',
                    color: theme === 'dark' ? '#ffffff' : '#000000',
                    cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>
                <button
                  onClick={() => {
                    // Cập nhật các series với settings mới
                    if (emaSeriesRef.current) {
                      emaSeriesRef.current.applyOptions({
                        color: maSettings.emaColor,
                        title: `EMA (${maSettings.emaPeriod})`
                      });
                    }
                    if (smaSeriesRef.current) {
                      smaSeriesRef.current.applyOptions({
                        color: maSettings.smaColor,
                        title: `SMA (${maSettings.smaPeriod})`
                      });
                    }
                    setShowSettings?.(false);
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: '#2962FF',
                    color: '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  Áp dụng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Panel hiển thị giá */}
      <div style={{ 
        padding: '10px',
        backgroundColor: theme === 'dark' ? '#1e1e1e' : '#f5f5f5',
        borderRadius: '8px',
        marginTop: '10px',
        display: 'flex',
        gap: '10px',
        alignItems: 'center'
      }}>
        {/* Tên cặp tiền */}
        <div style={{ 
          padding: '10px',
          backgroundColor: theme === 'dark' ? '#2d2d2d' : '#ffffff',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          minWidth: '100px',
          textAlign: 'center'
        }}>
          <span style={{ 
            color: theme === 'dark' ? '#ffffff' : '#000000',
            fontWeight: 'bold',
            fontSize: '16px'
          }}>
            {coin.replace('USDT', '/USDT')}
          </span>
        </div>

        {/* Hiển thị giá hiện tại và giá 1 phút trước */}
        <div style={{ 
          display: 'flex',
          gap: '10px',
          flex: 1
        }}>
          {/* Giá hiện tại */}
          <div style={{ 
            padding: '10px',
            backgroundColor: theme === 'dark' ? '#2d2d2d' : '#ffffff',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <span style={{ color: theme === 'dark' ? '#8c8c8c' : '#666666' }}>Giá hiện tại:</span>
            <span style={{ color: theme === 'dark' ? '#00ff00' : '#00b300', fontWeight: 'bold' }}>
              {currentPrice ? currentPrice.toFixed(2) : 'Loading...'}
            </span>
          </div>

          {/* Giá 1 phút trước */}
          <div style={{ 
            padding: '10px',
            backgroundColor: theme === 'dark' ? '#2d2d2d' : '#ffffff',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onClick={handleGetPrice1MinuteAgo}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = theme === 'dark' ? '#404040' : '#f0f0f0';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = theme === 'dark' ? '#2d2d2d' : '#ffffff';
          }}>
            <span style={{ color: theme === 'dark' ? '#8c8c8c' : '#666666' }}>Giá 1 phút trước:</span>
            <span style={{ 
              color: theme === 'dark' ? '#ff9900' : '#ff6600',
              fontWeight: 'bold'
            }}>
              {price1MinuteAgo ? price1MinuteAgo.toFixed(2) : currentPrice ? currentPrice.toFixed(2) : 'Loading...'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
