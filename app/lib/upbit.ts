import type { Market, Candle, CandleUnit } from '../types/upbit';

// 서버 프록시 경유 — CORS / 레이트리밋 회피
export async function getKRWMarkets(): Promise<Market[]> {
  const res = await fetch('/api/markets');
  return res.json();
}

export async function getCandles(market: string, unit: CandleUnit, count = 60): Promise<Candle[]> {
  let endpoint = `/api/candles?type=${unit.type}&market=${market}&count=${count}`;
  if (unit.type === 'minutes') endpoint += `&minutes=${unit.minutes}`;
  const res = await fetch(endpoint);
  return res.json();
}
