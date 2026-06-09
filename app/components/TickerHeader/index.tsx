'use client';

import type { Market, Ticker } from '../../types/upbit';
import styles from './TickerHeader.module.scss';

interface Props {
  market: Market | undefined;
  ticker: Ticker | undefined;
}

function formatPrice(price: number) {
  return price >= 100
    ? price.toLocaleString('ko-KR')
    : price.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
}

function formatVolume(vol: number) {
  if (vol >= 1_000_000_000_000) return `${(vol / 1_000_000_000_000).toFixed(1)}조`;
  if (vol >= 100_000_000) return `${(vol / 100_000_000).toFixed(0)}억`;
  return vol.toLocaleString('ko-KR');
}

export function TickerHeader({ market, ticker }: Props) {
  if (!market) return null;

  const rate = ticker?.signed_change_rate ?? 0;
  const rateFixed = parseFloat((rate * 100).toFixed(2));
  const dir = rateFixed > 0 ? 'up' : rateFixed < 0 ? 'down' : 'neutral';

  return (
    <div className={styles.header}>
      <div className={styles.name}>
        <span className={styles.korean}>{market.korean_name}</span>
        <span className={styles.market}>{market.market}</span>
      </div>

      <div className={[styles.price, styles[`price--${dir}`]].join(' ')}>
        ₩{ticker ? formatPrice(ticker.trade_price) : '-'}
      </div>

      <div className={[styles.change, styles[`change--${dir}`]].join(' ')}>
        {ticker
          ? `${rateFixed > 0 ? '+' : ''}${rateFixed.toFixed(2)}%`
          : '-'}
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>고가</span>
          <span className={styles.statValue}>₩{ticker ? formatPrice(ticker.high_price) : '-'}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>저가</span>
          <span className={styles.statValue}>₩{ticker ? formatPrice(ticker.low_price) : '-'}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>24H 거래대금</span>
          <span className={styles.statValue}>{ticker ? formatVolume(ticker.acc_trade_price_24h) : '-'}원</span>
        </div>
      </div>
    </div>
  );
}
