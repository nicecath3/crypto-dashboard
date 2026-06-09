'use client';

import { useEffect, useState } from 'react';
import type { Market, Ticker } from '../../types/upbit';
import type { Portfolio, PendingOrder, ExecutedOrder } from '../Dashboard';
import styles from './TradePanel.module.scss';

interface Props {
  market: Market | undefined;
  ticker: Ticker | undefined;
  portfolio: Portfolio;
  pendingOrders: PendingOrder[];
  executedOrders: ExecutedOrder[];
  onPortfolioChange: (p: Portfolio) => void;
  onOrderPlace: (order: PendingOrder) => void;
  onOrderCancel: (id: string) => void;
  onExecuted: (order: ExecutedOrder) => void;
}

function formatKRW(v: number) {
  if (v < 100) return v.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
}

function formatDate(ts: number) {
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

type Tab = 'buy' | 'sell' | 'executed' | 'history';
type OrderType = 'market' | 'limit';

export function TradePanel({ market, ticker, portfolio, pendingOrders, executedOrders, onPortfolioChange, onOrderPlace, onOrderCancel, onExecuted }: Props) {
  const [tab, setTab] = useState<Tab>('buy');
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [amount, setAmount] = useState('');
  const [limitPriceRaw, setLimitPriceRaw] = useState('');
  const [buyPct, setBuyPct] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const [execFilter, setExecFilter] = useState<string>('all');

  useEffect(() => {
    setAmount('');
    setLimitPriceRaw('');
    setBuyPct(null);
    setOrderType('market');
    if (tab === 'executed') setExecFilter('all');
  }, [market?.market, tab]);

  const FEE_RATE = 0.0005;

  const marketPrice = ticker?.trade_price ?? 0;

  useEffect(() => {
    if (tab !== 'buy' || orderType !== 'market' || buyPct === null || !marketPrice) return;
    const raw = (portfolio.krw * buyPct) / (marketPrice * (1 + FEE_RATE));
    setAmount(String(Math.floor(raw * 1e8) / 1e8));
  }, [marketPrice, buyPct, portfolio.krw, tab, orderType]);

  const limitPriceNum = Number(limitPriceRaw || 0);
  const execPrice = orderType === 'limit' ? limitPriceNum : marketPrice;
  const code = market?.market ?? '';
  const holding = portfolio.holdings[code];
  const qty = Number(amount || 0);
  const total = execPrice * qty;
  const fee = total * FEE_RATE;
  const totalWithFee = tab === 'buy' ? total + fee : total - fee;

  const handleLimitPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    setLimitPriceRaw(raw);
  };

  const limitPriceDisplay = (() => {
    if (!limitPriceRaw) return '';
    const [intPart, decPart] = limitPriceRaw.split('.');
    const formatted = Number(intPart || 0).toLocaleString('ko-KR');
    return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
  })();

  const pendingSellQty = pendingOrders
    .filter((o) => o.market === code && o.type === 'sell')
    .reduce((sum, o) => sum + o.amount, 0);

  const setPercent = (pct: number) => {
    if (tab === 'buy') {
      if (!execPrice) return;
      setBuyPct(pct);
      const raw = (portfolio.krw * pct) / (execPrice * (1 + FEE_RATE));
      setAmount(String(Math.floor(raw * 1e8) / 1e8));
    } else {
      setBuyPct(null);
      const available = Math.max(0, (holding?.amount ?? 0) - pendingSellQty);
      setAmount(String(Math.floor(available * pct * 1e8) / 1e8));
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const handleSubmit = () => {
    if (!qty || qty <= 0) return;
    if (!execPrice) return;

    if (orderType === 'market') {
      if (tab === 'buy') {
        if (totalWithFee > portfolio.krw + 1) { showToast('잔액이 부족합니다'); return; }
        const next: Portfolio = { krw: Math.max(0, portfolio.krw - totalWithFee), holdings: { ...portfolio.holdings } };
        const prev = next.holdings[code];
        if (prev) {
          const newAmount = prev.amount + qty;
          next.holdings[code] = { amount: newAmount, avgPrice: (prev.avgPrice * prev.amount + execPrice * qty) / newAmount };
        } else {
          next.holdings[code] = { amount: qty, avgPrice: execPrice };
        }
        onPortfolioChange(next);
        onExecuted({ id: `${Date.now()}-${Math.random()}`, type: 'buy', market: code, koreanName: market?.korean_name ?? code, price: execPrice, amount: qty, total, fee, executedAt: Date.now() });
        showToast(`${market?.korean_name} ${qty} 시장가 매수 완료`);
      } else {
        // 시장가 매도: 미체결 매도 주문 고려한 가용수량 체크
        const availableQty = (holding?.amount ?? 0) - pendingSellQty;
        if (!holding || qty > availableQty) { showToast('보유 수량이 부족합니다'); return; }
        const next: Portfolio = { krw: portfolio.krw + totalWithFee, holdings: { ...portfolio.holdings } };
        const remaining = holding.amount - qty;
        if (remaining <= 1e-10) delete next.holdings[code];
        else next.holdings[code] = { ...holding, amount: remaining };
        onPortfolioChange(next);
        onExecuted({ id: `${Date.now()}-${Math.random()}`, type: 'sell', market: code, koreanName: market?.korean_name ?? code, price: execPrice, amount: qty, total, fee, executedAt: Date.now() });
        showToast(`${market?.korean_name} ${qty} 시장가 매도 완료`);
      }
    } else {
      if (tab === 'buy') {
        if (totalWithFee > portfolio.krw + 1) { showToast('잔액이 부족합니다'); return; }
        onPortfolioChange({ ...portfolio, krw: Math.max(0, portfolio.krw - totalWithFee) });
      } else {
        const availableQty = (holding?.amount ?? 0) - pendingSellQty;
        if (availableQty < qty) { showToast('보유 수량이 부족합니다'); return; }
      }

      const order: PendingOrder = {
        id: `${Date.now()}-${Math.random()}`,
        type: tab as 'buy' | 'sell',
        market: code,
        koreanName: market?.korean_name ?? code,
        targetPrice: execPrice,
        amount: qty,
        reservedKrw: tab === 'buy' ? totalWithFee : 0,
        timestamp: Date.now(),
      };
      onOrderPlace(order);
      showToast(`${market?.korean_name} 지정가 ${tab === 'buy' ? '매수' : '매도'} 주문 등록`);
    }

    setAmount('');
    setLimitPriceRaw('');
    setBuyPct(null);
  };

  const execCoins = Array.from(new Map(executedOrders.map((o) => [o.market, o.koreanName])).entries());

  const filteredExecuted = execFilter === 'all'
    ? executedOrders
    : executedOrders.filter((o) => o.market === execFilter);

  return (
    <>
      <div className={styles.panel}>
        <div className={styles.tabs}>
          <button className={[styles.tab, styles['tab--buy'], tab === 'buy' ? styles['tab--active'] : ''].join(' ')} onClick={() => setTab('buy')}>
            매수
          </button>
          <button className={[styles.tab, styles['tab--sell'], tab === 'sell' ? styles['tab--active'] : ''].join(' ')} onClick={() => setTab('sell')}>
            매도
          </button>
          <button className={[styles.tab, styles['tab--history'], tab === 'history' ? styles['tab--active'] : ''].join(' ')} onClick={() => setTab('history')}>
            주문내역 {pendingOrders.length > 0 && <span className={styles.badge}>{pendingOrders.length}</span>}
          </button>
          <button className={[styles.tab, styles['tab--history'], tab === 'executed' ? styles['tab--active'] : ''].join(' ')} onClick={() => setTab('executed')}>
            체결내역
          </button>
        </div>

        {(tab === 'buy' || tab === 'sell') && (
          <div className={styles.body}>
            <div className={styles.orderTypeRow}>
              {(['market', 'limit'] as const).map((t) => (
                <button
                  key={t}
                  className={[styles.orderTypeBtn, orderType === t ? styles['orderTypeBtn--active'] : ''].join(' ')}
                  onClick={() => setOrderType(t)}
                >
                  {t === 'market' ? '시장가' : '지정가'}
                </button>
              ))}
            </div>

            <div className={styles.balance}>
              <span className={styles.balanceLabel}>보유 KRW</span>
              <span className={styles.balanceValue}>₩{formatKRW(portfolio.krw)}</span>
            </div>

            <div className={styles.field}>
              <span className={styles.label}>주문가격</span>
              <div className={styles.inputRow}>
                {orderType === 'market' ? (
                  <input className={styles.input} value={marketPrice ? formatKRW(marketPrice) : '-'} readOnly />
                ) : (
                  <input
                    className={styles.input}
                    type="text"
                    inputMode="numeric"
                    placeholder="지정가 입력"
                    value={limitPriceDisplay}
                    onChange={handleLimitPriceChange}
                  />
                )}
                <span className={styles.unit}>KRW</span>
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.label}>수량</span>
              <div className={styles.inputRow}>
                <input
                  className={styles.input}
                  type="number"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => { setBuyPct(null); setAmount(e.target.value); }}
                  min="0"
                />
                <span className={styles.unit}>{code.replace('KRW-', '')}</span>
              </div>
            </div>

            <div className={styles.percentRow}>
              {[0.1, 0.25, 0.5, 1].map((p) => (
                <button key={p} className={styles.percentBtn} onClick={() => setPercent(p)}>
                  {p * 100}%
                </button>
              ))}
            </div>

            <div className={styles.total}>
              <span className={styles.totalLabel}>주문총액</span>
              <span className={styles.totalValue}>₩{formatKRW(total)}</span>
            </div>
            <div className={styles.feeRow}>
              <span className={styles.feeLabel}>예상수수료 (0.05%)</span>
              <span className={styles.feeValue}>₩{formatKRW(fee)}</span>
            </div>

            <button
              className={[styles.submitBtn, styles[`submitBtn--${tab}`]].join(' ')}
              onClick={handleSubmit}
              disabled={!marketPrice || !Number(amount) || (orderType === 'limit' && !limitPriceNum)}
            >
              {orderType === 'market' ? '시장가 ' : '지정가 '}{tab === 'buy' ? '매수' : '매도'}
            </button>
          </div>
        )}

        {tab === 'executed' && (
          <div className={styles.historyList}>
            <div className={styles.filterRow}>
              <select
                className={styles.filterSelect}
                value={execFilter}
                onChange={(e) => setExecFilter(e.target.value)}
              >
                <option value="all">전체</option>
                {execCoins.map(([market, name]) => (
                  <option key={market} value={market}>{name}</option>
                ))}
              </select>
            </div>
            {filteredExecuted.length === 0 ? (
              <div className={styles.empty}>체결 내역이 없습니다</div>
            ) : (
              filteredExecuted.map((o) => (
                <div key={o.id} className={styles.historyItem}>
                  <div className={styles.historyTop}>
                    <span className={[styles.historyType, styles[`historyType--${o.type}`]].join(' ')}>
                      {o.type === 'buy' ? '매수' : '매도'}
                    </span>
                    <span className={styles.historyName}>{o.koreanName}</span>
                    <span className={styles.historyDate}>{formatDate(o.executedAt)}</span>
                  </div>
                  <div className={styles.historyBottom}>
                    <div className={styles.historyDetail}>
                      <span>{o.amount.toLocaleString('ko-KR', { maximumFractionDigits: 8 })} · ₩{formatKRW(o.price)}</span>
                      <span className={styles.historyTotal}>₩{formatKRW(o.total)} <span className={styles.historyFee}>수수료 ₩{formatKRW(o.fee)}</span></span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'history' && (
          <div className={styles.historyList}>
            {pendingOrders.length === 0 ? (
              <div className={styles.empty}>미체결 주문이 없습니다</div>
            ) : (
              pendingOrders.map((o) => (
                <div key={o.id} className={styles.historyItem}>
                  <div className={styles.historyTop}>
                    <span className={[styles.historyType, styles[`historyType--${o.type}`]].join(' ')}>
                      {o.type === 'buy' ? '매수' : '매도'}
                    </span>
                    <span className={styles.historyName}>{o.koreanName}</span>
                    <span className={styles.historyDate}>{formatDate(o.timestamp)}</span>
                  </div>
                  <div className={styles.historyBottom}>
                    <div className={styles.historyDetail}>
                      <span>{o.amount.toLocaleString('ko-KR', { maximumFractionDigits: 8 })}</span>
                      <span>지정가 ₩{formatKRW(o.targetPrice)}</span>
                    </div>
                    <button className={styles.cancelBtn} onClick={() => onOrderCancel(o.id)}>
                      취소
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}
    </>
  );
}
