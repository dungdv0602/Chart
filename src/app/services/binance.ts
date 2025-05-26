import axios from 'axios';

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

export const GetCandles = async (
  currentTimeFrame: string,
  currentCoin: string
): Promise<ICandleStick[]> => {
  try {
    const response = await axios.get(
      `https://api.binance.com/api/v3/klines?symbol=${currentCoin}&interval=${currentTimeFrame}&limit=500`,
      { timeout: 5000 }
    );

    return response.data.map((item: any) => ({
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
