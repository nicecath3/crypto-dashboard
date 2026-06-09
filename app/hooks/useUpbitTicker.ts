'use client';

import { useEffect, useRef, useState } from 'react';
import type { Ticker } from '../types/upbit';

async function fetchAllTickers(markets: string[]): Promise<Ticker[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < markets.length; i += 100) {
    chunks.push(markets.slice(i, i + 100));
  }
  const results = await Promise.all(
    chunks.map((chunk) =>
      fetch(`https://api.upbit.com/v1/ticker?markets=${chunk.join(',')}`)
        .then((r) => r.json())
        .catch(() => [])
    )
  );
  return results.flat();
}

export function useUpbitTicker(markets: string[]) {
  const [tickers, setTickers] = useState<Record<string, Ticker>>({});
  const abortRef = useRef<AbortController | null>(null);

  // 초기 시세
  useEffect(() => {
    if (markets.length === 0) return;
    fetchAllTickers(markets).then((list) => {
      const map: Record<string, Ticker> = {};
      list.forEach((t) => (map[t.market] = t));
      setTickers(map);
    });
  }, [markets.join(',')]);

  // SSE 스트림 (서버 → 업비트 WS 중계)
  useEffect(() => {
    if (markets.length === 0) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const connect = async () => {
      try {
        const res = await fetch('/api/ticker', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ markets }),
          signal: controller.signal,
        });

        if (!res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const data = line.replace(/^data: /, '').trim();
            if (!data) continue;
            try {
              const ticker: Ticker = JSON.parse(data);
              if (ticker?.market) {
                setTickers((prev) => ({ ...prev, [ticker.market]: ticker }));
              }
            } catch {}
          }
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        // 연결 끊기면 3초 후 재시도
        setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      abortRef.current?.abort();
    };
  }, [markets.join(',')]);

  return tickers;
}
