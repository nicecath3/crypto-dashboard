'use client';

import { useState } from 'react';
import type { Market, Ticker } from '../types/upbit';
import styles from './CoinList.module.scss';

interface Props {
  markets: Market[];
  tickers: Record<string, Ticker>;
  selected: string;
  onSelect: (market: string) => void;
}

function formatPrice(price: number) {
  return price >= 100
    ? price.toLocaleString('ko-KR')
    : price.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
}

export function CoinList({ markets, tickers, selected, onSelect }: Props) {
  const [query, setQuery] = useState('');

  const filtered = markets.filter(
    (m) =>
      m.korean_name.includes(query) ||
      m.market.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <aside className={styles.container}>
      <div className={styles.search}>
        <input
          placeholder="코인 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <ul className={styles.list}>
        {filtered.map((m) => {
          const ticker = tickers[m.market];
          const rate = ticker?.signed_change_rate ?? 0;
          const changeClass =
            rate > 0 ? styles['change--up'] : rate < 0 ? styles['change--down'] : styles['change--neutral'];

          return (
            <li
              key={m.market}
              className={[styles.item, selected === m.market ? styles['item--active'] : ''].join(' ')}
              onClick={() => onSelect(m.market)}
            >
              <div className={styles.itemLeft}>
                <span className={styles.korean}>{m.korean_name}</span>
                <span className={styles.code}>{m.market}</span>
              </div>
              <div className={styles.itemRight}>
                <span className={styles.price}>
                  {ticker ? formatPrice(ticker.trade_price) : '-'}
                </span>
                <span className={[styles.change, changeClass].join(' ')}>
                  {ticker ? `${rate >= 0 ? '+' : ''}${(rate * 100).toFixed(2)}%` : '-'}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
