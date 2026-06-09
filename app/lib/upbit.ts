import type { Market, Candle, CandleUnit } from '../types/upbit';

const UPBIT = 'https://api.upbit.com/v1';

async function fetchWithRetry(url: string, retries = 4, delay = 800): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url);
    if (res.status !== 429) return res;
    await new Promise((r) => setTimeout(r, delay * (i + 1)));
  }
  return fetch(url);
}

// 서버 프록시 경유 — CORS / 레이트리밋 회피
export async function getKRWMarkets(): Promise<Market[]> {
  const res = await fetch('/api/markets');
  return res.json();
}

export async function getCandles(market: string, unit: CandleUnit, count = 60): Promise<Candle[]> {
  let endpoint = '';
  if (unit.type === 'minutes') {
    endpoint = `${UPBIT}/candles/minutes/${unit.minutes}?market=${market}&count=${count}`;
  } else {
    endpoint = `${UPBIT}/candles/${unit.type}?market=${market}&count=${count}`;
  }
  const res = await fetchWithRetry(endpoint);
  return res.json();
}
