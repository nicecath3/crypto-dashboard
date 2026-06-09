'use client';

import { useEffect, useRef, useState } from 'react';
import type { Ticker } from '../types/upbit';

async function fetchAllTickers(markets: string[]): Promise<Ticker[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < markets.length; i += 100) {
    chunks.push(markets.slice(i, i + 100));
  }

  const results: Ticker[][] = [];
  for (const chunk of chunks) {
    try {
      const res = await fetch(`/api/tickers?markets=${chunk.join(',')}`);
      results.push(await res.json());
    } catch {
      results.push([]);
    }
    if (chunks.length > 1) await new Promise((r) => setTimeout(r, 150));
  }
  return results.flat();
}

export function useUpbitTicker(markets: string[]) {
  const [tickers, setTickers] = useState<Record<string, Ticker>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const marketsKey = markets.join(',');

  // 초기 시세 (REST)
  useEffect(() => {
    if (markets.length === 0) return;
    fetchAllTickers(markets).then((list) => {
      const map: Record<string, Ticker> = {};
      list.forEach((t) => (map[t.market] = t));
      setTickers(map);
    });
  }, [marketsKey]);

  // 브라우저 WebSocket으로 직접 연결
  useEffect(() => {
    if (markets.length === 0) return;

    let destroyed = false;

    const connect = () => {
      if (destroyed) return;

      const ws = new WebSocket('wss://api.upbit.com/websocket/v1');
      wsRef.current = ws;

      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        ws.send(
          JSON.stringify([
            { ticket: `web-${Date.now()}` },
            { type: 'ticker', codes: markets },
          ])
        );
      };

      ws.onmessage = (e) => {
        try {
          const text = typeof e.data === 'string'
            ? e.data
            : new TextDecoder().decode(e.data);
          const raw = JSON.parse(text);
          const ticker: Ticker = { ...raw, market: raw.market ?? raw.code };
          if (ticker.market) {
            setTickers((prev) => ({ ...prev, [ticker.market]: ticker }));
          }
        } catch {}
      };

      ws.onclose = () => {
        if (!destroyed) {
          reconnectTimer.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      destroyed = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [marketsKey]);

  return tickers;
}
