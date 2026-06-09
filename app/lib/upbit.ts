import type { Market, Candle, CandleUnit } from '../types/upbit';

const BASE_URL = 'https://api.upbit.com/v1';

export async function getKRWMarkets(): Promise<Market[]> {
  const res = await fetch(`${BASE_URL}/market/all?is_details=false`);
  const data: Market[] = await res.json();
  return data.filter((m) => m.market.startsWith('KRW-'));
}

export async function getCandles(market: string, unit: CandleUnit, count = 60): Promise<Candle[]> {
  let endpoint = '';

  if (unit.type === 'minutes') {
    endpoint = `${BASE_URL}/candles/minutes/${unit.minutes}?market=${market}&count=${count}`;
  } else {
    endpoint = `${BASE_URL}/candles/${unit.type}?market=${market}&count=${count}`;
  }

  const res = await fetch(endpoint);
  return res.json();
}
