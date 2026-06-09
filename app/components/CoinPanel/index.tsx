'use client';

import { useEffect, useState } from 'react';
import type { Market, Ticker } from '../../types/upbit';
import { useTheme } from '../../contexts/ThemeContext';
import styles from './CoinPanel.module.scss';

interface Props {
  markets: Market[];
  tickers: Record<string, Ticker>;
  selected: string;
  onSelect: (market: string) => void;
  portfolio: Portfolio;
  onReset: () => void;
}

function formatPrice(price: number) {
  if (price >= 100) return price.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  if (price >= 1) return price.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  return price.toLocaleString('ko-KR', { maximumFractionDigits: 6 });
}

function formatVolume(v: number) {
  return `${Math.floor(v / 1_000_000).toLocaleString('ko-KR')}백만`;
}

const FAVORITES_KEY = 'upbit-favorites';

interface Portfolio {
  krw: number;
  holdings: Record<string, { amount: number; avgPrice: number }>;
}

type Tab = 'search' | 'favorites' | 'holdings';

export function CoinPanel({ markets, tickers, selected, onSelect, portfolio, onReset }: Props) {
  const { theme, toggle } = useTheme();
  const [tab, setTab] = useState<Tab>('search');
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<'volume' | 'change' | 'name'>('volume');
  useEffect(() => {
    const saved = localStorage.getItem(FAVORITES_KEY);
    if (saved) setFavorites(new Set(JSON.parse(saved)));
  }, []);

  const toggleFavorite = (market: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      next.has(market) ? next.delete(market) : next.add(market);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const filtered = markets
    .filter(
      (m) =>
        m.korean_name.includes(query) ||
        m.market.toLowerCase().includes(query.toLowerCase())
    )
    .sort((a, b) => {
      const ta = tickers[a.market];
      const tb = tickers[b.market];
      if (sort === 'volume') return (tb?.acc_trade_price_24h ?? 0) - (ta?.acc_trade_price_24h ?? 0);
      if (sort === 'change') return (tb?.signed_change_rate ?? 0) - (ta?.signed_change_rate ?? 0);
      if (sort === 'name') return a.korean_name.localeCompare(b.korean_name, 'ko');
      return 0;
    });

  const favoriteMarkets = markets.filter((m) => favorites.has(m.market));

  const renderItem = (m: Market) => {
    const ticker = tickers[m.market];
    const rate = ticker?.signed_change_rate ?? 0;
    const rateFixed = parseFloat((rate * 100).toFixed(2));
    const changeClass =
      rateFixed > 0 ? styles['change--up'] : rateFixed < 0 ? styles['change--down'] : styles['change--neutral'];
    const isFav = favorites.has(m.market);

    return (
      <li
        key={m.market}
        className={[styles.item, selected === m.market ? styles['item--active'] : ''].join(' ')}
        onClick={() => onSelect(m.market)}
      >
        <button
          className={[styles.star, isFav ? styles['star--active'] : ''].join(' ')}
          onClick={(e) => toggleFavorite(m.market, e)}
          aria-label={isFav ? '즐겨찾기 해제' : '즐겨찾기 추가'}
        >
          ★
        </button>
        <div className={styles.itemLeft}>
          <span className={styles.korean}>{m.korean_name}</span>
          <span className={styles.code}>{m.market}</span>
        </div>
        <div className={styles.itemRight}>
          <span className={styles.price}>{ticker ? formatPrice(ticker.trade_price) : '-'}</span>
          <span className={[styles.change, changeClass].join(' ')}>
            {ticker ? `${rateFixed > 0 ? '+' : ''}${rateFixed.toFixed(2)}%` : '-'}
          </span>
          <span className={styles.volume}>
            {ticker?.acc_trade_price_24h ? formatVolume(ticker.acc_trade_price_24h) : '-'}
          </span>
        </div>
      </li>
    );
  };

  return (
    <aside className={styles.panel}>
      <div className={styles.tabs}>
        <button
          className={[styles.tab, tab === 'search' ? styles['tab--active'] : ''].join(' ')}
          onClick={() => setTab('search')}
        >
          검색
        </button>
        <button
          className={[styles.tab, tab === 'favorites' ? styles['tab--active'] : ''].join(' ')}
          onClick={() => setTab('favorites')}
        >
          즐겨찾기
        </button>
        <button
          className={[styles.tab, tab === 'holdings' ? styles['tab--active'] : ''].join(' ')}
          onClick={() => setTab('holdings')}
        >
          보유코인
        </button>
      </div>

      {tab === 'search' && (
        <>
          <div className={styles.searchBox}>
            <input
              placeholder="코인명 / 심볼 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className={styles.sortRow}>
            {(['name', 'volume', 'change'] as const).map((s) => (
              <button
                key={s}
                className={[styles.sortBtn, sort === s ? styles['sortBtn--active'] : ''].join(' ')}
                onClick={() => setSort(s)}
              >
                {s === 'name' ? '이름' : s === 'volume' ? '거래대금' : '전일대비'}
              </button>
            ))}
          </div>
          <ul className={styles.list}>{filtered.map(renderItem)}</ul>
        </>
      )}

      {tab === 'favorites' && (
        favoriteMarkets.length === 0 ? (
          <div className={styles.empty}>
            ★ 버튼을 눌러<br />즐겨찾기를 추가하세요
          </div>
        ) : (
          <ul className={styles.list}>{favoriteMarkets.map(renderItem)}</ul>
        )
      )}

      {tab === 'holdings' && (() => {
        const holdingMarkets = markets.filter((m) => (portfolio.holdings[m.market]?.amount ?? 0) > 1e-10);

        const totalCoinValue = holdingMarkets.reduce((sum, m) => {
          const price = tickers[m.market]?.trade_price ?? 0;
          return sum + price * (portfolio.holdings[m.market]?.amount ?? 0);
        }, 0);
        const totalInvested = Object.values(portfolio.holdings).reduce(
          (sum, h) => sum + h.avgPrice * h.amount, 0
        );
        const totalPnlRaw = totalInvested > 0 ? ((totalCoinValue - totalInvested) / totalInvested) * 100 : 0;
        const totalPnl = parseFloat(totalPnlRaw.toFixed(2));
        const pnlClass = totalPnl > 0 ? styles['change--up'] : totalPnl < 0 ? styles['change--down'] : styles['change--neutral'];

        return (
          <div className={styles.holdingsWrap}>
            <div className={styles.summary}>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>보유 KRW</span>
                <span className={styles.summaryValue}>₩{formatPrice(portfolio.krw)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>코인 평가액</span>
                <span className={styles.summaryValue}>₩{formatPrice(totalCoinValue)}</span>
              </div>
              <div className={styles.summaryDivider} />
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>총 평가</span>
                <span className={styles.summaryValue}>₩{formatPrice(portfolio.krw + totalCoinValue)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>수익률</span>
                <span className={[styles.summaryPnl, pnlClass].join(' ')}>
                  {totalPnl > 0 ? '+' : ''}{totalPnl.toFixed(2)}%
                </span>
              </div>
            </div>

        {holdingMarkets.length === 0 ? (
          <div className={styles.empty}>보유 중인 코인이 없습니다</div>
        ) : (
          <ul className={styles.list}>
            {holdingMarkets.map((m) => {
              const ticker = tickers[m.market];
              const h = portfolio.holdings[m.market];
              const price = ticker?.trade_price ?? 0;
              const pnlRaw = price && h ? ((price - h.avgPrice) / h.avgPrice) * 100 : 0;
              const pnl = parseFloat(pnlRaw.toFixed(2));
              const pnlClass = pnl > 0 ? styles['change--up'] : pnl < 0 ? styles['change--down'] : styles['change--neutral'];
              return (
                <li
                  key={m.market}
                  className={[styles.item, selected === m.market ? styles['item--active'] : ''].join(' ')}
                  onClick={() => onSelect(m.market)}
                >
                  <div className={styles.itemLeft}>
                    <span className={styles.korean}>{m.korean_name}</span>
                    <span className={styles.code}>
                      {h.amount.toLocaleString('ko-KR', { maximumFractionDigits: 4 })} {m.market.replace('KRW-', '')}
                    </span>
                  </div>
                  <div className={styles.itemRight}>
                    <span className={styles.price}>{price ? formatPrice(price) : '-'}</span>
                    <span className={[styles.change, pnlClass].join(' ')}>
                      {pnl > 0 ? '+' : ''}{pnl.toFixed(2)}%
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
          <div className={styles.resetRow}>
            <button className={styles.themeBtn} onClick={toggle} title={theme === 'dark' ? '라이트 모드' : '다크 모드'}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button
              className={styles.resetBtn}
              onClick={() => {
                if (confirm('즐겨찾기, 보유코인, 주문내역을 모두 초기화할까요?')) onReset();
              }}
            >
              초기화
            </button>
          </div>
          </div>
        );
      })()}
    </aside>
  );
}
