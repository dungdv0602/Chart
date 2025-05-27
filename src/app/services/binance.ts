import axios from 'axios';

// Interface đã xử lý từ dữ liệu Binance
export interface ICandleStick {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  baseAssetVolume: number;
  numberOfTrades: number;
  takerBuyVolume: number;
  takerBuyBaseAssetVolume: number;
  ignore: number;
}

// Định nghĩa kiểu tuple đúng với dữ liệu gốc trả về từ API Binance
type BinanceRawCandle = [
  number,   // openTime
  string,   // open
  string,   // high
  string,   // low
  string,   // close
  string,   // volume
  number,   // closeTime
  string,   // baseAssetVolume
  number,   // numberOfTrades
  string,   // takerBuyVolume
  string,   // takerBuyBaseAssetVolume
  string    // ignore
];

/**
 * Gọi API Binance để lấy dữ liệu nến (candlestick) của một cặp coin theo interval
 * @param currentTimeFrame 
 * @param currentCoin 
 * @returns Danh sách các đối tượng ICandleStick đã được xử lý
 */
export const GetCandles = async (
  currentTimeFrame: string,
  currentCoin: string
): Promise<ICandleStick[]> => {
  try {
    const response = await axios.get<BinanceRawCandle[]>(
      `https://api.binance.com/api/v3/klines?symbol=${currentCoin}&interval=${currentTimeFrame}&limit=500`,
      { timeout: 5000 }
    );

    // Chuyển đổi dữ liệu từ raw array sang dạng object ICandleStick
    return response.data.map((item) => ({
      openTime: item[0],
      open: parseFloat(item[1]),
      high: parseFloat(item[2]),
      low: parseFloat(item[3]),
      close: parseFloat(item[4]),
      volume: parseFloat(item[5]),
      closeTime: item[6],
      baseAssetVolume: parseFloat(item[7]),
      numberOfTrades: item[8],
      takerBuyVolume: parseFloat(item[9]),
      takerBuyBaseAssetVolume: parseFloat(item[10]),
      ignore: parseFloat(item[11]),
    }));
  } catch (error) {
    console.error('Error fetching candles:', error);
    return [];
  }
};

/**
 * Lắng nghe dữ liệu WebSocket real-time từ Binance
 * @param interval khung thời gian
 * @param coin cặp coin, ví dụ: 'BTCUSDT'
 * @param callback hàm callback xử lý (real-time)
 * @returns Hàm để đóng WebSocket khi không cần nữa
 */
export function subscribeToWS(
  interval: string,
  coin: string,
  callback: (candle: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }) => void
): () => void {
  const ws = new WebSocket(
    `wss://stream.binance.com:9443/ws/${coin.toLowerCase()}@kline_${interval}`
  );

  // Mỗi khi Binance gửi dữ liệu nến mới (real-time)
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const k = data.k;

    const candle = {
      time: Math.floor(k.t / 1000),
      open: parseFloat(k.o),
      high: parseFloat(k.h),
      low: parseFloat(k.l),
      close: parseFloat(k.c),
      volume: parseFloat(k.v),
    };

    callback(candle);
  };

  ws.onerror = (e) => {
    console.error('WebSocket error:', e);
  };

  ws.onclose = () => {
    console.warn('WebSocket closed.');
  };

  return () => {
    ws.close();
  };
}
