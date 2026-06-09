import type { Market, Candle, CandleUnit } from '../types/upbit';

const BASE_URL = 'https://api.upbit.com/v1';

async function fetchWithRetry(url: string, retries = 5, delay = 1000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url);
    if (res.status !== 429) return res;
    await new Promise((r) => setTimeout(r, delay * (i + 1)));
  }
  return fetch(url);
}

export async function getKRWMarkets(): Promise<Market[]> {
  const res = await fetchWithRetry(`${BASE_URL}/market/all?is_details=false`);
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

  const res = await fetchWithRetry(endpoint);
  return res.json();
}
