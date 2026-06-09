'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getKRWMarkets } from '../../lib/upbit';
import { useUpbitTicker } from '../../hooks/useUpbitTicker';
import { CoinPanel } from '../CoinPanel';
import { TickerHeader } from '../TickerHeader';
import { CandleChart } from '../CandleChart';
import { TradePanel } from '../TradePanel';
import { DisclaimerModal } from '../DisclaimerModal';
import type { Market } from '../../types/upbit';
import styles from './Dashboard.module.scss';

export interface Portfolio {
  krw: number;
  holdings: Record<string, { amount: number; avgPrice: number }>;
}

export interface PendingOrder {
  id: string;
  type: 'buy' | 'sell';
  market: string;
  koreanName: string;
  targetPrice: number;
  amount: number;
  reservedKrw: number;
  timestamp: number;
}

export interface ExecutedOrder {
  id: string;
  type: 'buy' | 'sell';
  market: string;
  koreanName: string;
  price: number;
  amount: number;
  total: number;
  fee: number;
  executedAt: number;
}

const PORTFOLIO_KEY = 'virtual-portfolio';
const ORDERS_KEY = 'virtual-pending-orders';
const EXECUTED_KEY = 'virtual-executed-orders';
const INITIAL_KRW = 100_000_000;
const FEE_RATE = 0.0005;

function loadPortfolio(): Portfolio {
  if (typeof window === 'undefined') return { krw: INITIAL_KRW, holdings: {} };
  const saved = localStorage.getItem(PORTFOLIO_KEY);
  return saved ? JSON.parse(saved) : { krw: INITIAL_KRW, holdings: {} };
}

function loadOrders(): PendingOrder[] {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem(ORDERS_KEY);
  return saved ? JSON.parse(saved) : [];
}

function loadExecuted(): ExecutedOrder[] {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem(EXECUTED_KEY);
  return saved ? JSON.parse(saved) : [];
}

export function Dashboard() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selected, setSelected] = useState('KRW-BTC');
  const [portfolio, setPortfolio] = useState<Portfolio>({ krw: INITIAL_KRW, holdings: {} });
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [executedOrders, setExecutedOrders] = useState<ExecutedOrder[]>([]);
  const [execToast, setExecToast] = useState('');
  const portfolioRef = useRef(portfolio);
  const pendingRef = useRef(pendingOrders);
  const executedRef = useRef(executedOrders);

  useEffect(() => { portfolioRef.current = portfolio; }, [portfolio]);
  useEffect(() => { pendingRef.current = pendingOrders; }, [pendingOrders]);
  useEffect(() => { executedRef.current = executedOrders; }, [executedOrders]);

  useEffect(() => {
    getKRWMarkets().then((data) => setMarkets(data));
    setPortfolio(loadPortfolio());
    setPendingOrders(loadOrders());
    setExecutedOrders(loadExecuted());
  }, []);

  const showExecToast = (msg: string) => {
    setExecToast(msg);
    setTimeout(() => setExecToast(''), 3000);
  };

  const resetAll = () => {
    const fresh: Portfolio = { krw: INITIAL_KRW, holdings: {} };
    localStorage.removeItem(PORTFOLIO_KEY);
    localStorage.removeItem(ORDERS_KEY);
    localStorage.removeItem(EXECUTED_KEY);
    localStorage.removeItem('upbit-favorites');
    localStorage.removeItem('virtual-trade-history');
    setPortfolio(fresh);
    setPendingOrders([]);
    setExecutedOrders([]);
  };

  const updatePortfolio = (next: Portfolio) => {
    localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(next));
    setPortfolio(next);
  };

  const placeOrder = (order: PendingOrder) => {
    const next = [...pendingRef.current, order];
    localStorage.setItem(ORDERS_KEY, JSON.stringify(next));
    setPendingOrders(next);
  };

  const addExecuted = (order: ExecutedOrder) => {
    const allExecuted = [order, ...executedRef.current].slice(0, 200);
    localStorage.setItem(EXECUTED_KEY, JSON.stringify(allExecuted));
    setExecutedOrders(allExecuted);
  };

  const cancelOrder = (id: string) => {
    const order = pendingRef.current.find((o) => o.id === id);
    if (!order) return;

    if (order.type === 'buy') {
      const p = { ...portfolioRef.current, holdings: { ...portfolioRef.current.holdings } };
      p.krw = p.krw + order.reservedKrw;
      updatePortfolio(p);
    }

    const next = pendingRef.current.filter((o) => o.id !== id);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(next));
    setPendingOrders(next);
  };

  const marketCodes = useMemo(() => markets.map((m) => m.market), [markets]);
  const tickers = useUpbitTicker(marketCodes);

  useEffect(() => {
    const orders = pendingRef.current;
    if (orders.length === 0) return;

    let executedIds: string[] = [];
    let newExecuted: ExecutedOrder[] = [];
    let p = { ...portfolioRef.current, holdings: { ...portfolioRef.current.holdings } };

    for (const order of orders) {
      const currentPrice = tickers[order.market]?.trade_price;
      if (!currentPrice) continue;

      const age = Date.now() - order.timestamp;
      if (age < 2000) continue;

      const shouldExecute =
        (order.type === 'buy' && currentPrice <= order.targetPrice) ||
        (order.type === 'sell' && currentPrice >= order.targetPrice);

      if (!shouldExecute) continue;

      const total = order.targetPrice * order.amount;
      const fee = total * FEE_RATE;

      if (order.type === 'buy') {
        const prev = p.holdings[order.market];
        if (prev) {
          const newAmount = prev.amount + order.amount;
          p.holdings[order.market] = {
            amount: newAmount,
            avgPrice: (prev.avgPrice * prev.amount + order.targetPrice * order.amount) / newAmount,
          };
        } else {
          p.holdings[order.market] = { amount: order.amount, avgPrice: order.targetPrice };
        }
      } else {
        const prev = p.holdings[order.market];
        if (prev) {
          const remaining = prev.amount - order.amount;
          if (remaining <= 1e-10) {
            delete p.holdings[order.market];
          } else {
            p.holdings = { ...p.holdings, [order.market]: { ...prev, amount: remaining } };
          }
        }
        p.krw = p.krw + total * (1 - FEE_RATE);
      }

      newExecuted.push({
        id: order.id,
        type: order.type,
        market: order.market,
        koreanName: order.koreanName,
        price: order.targetPrice,
        amount: order.amount,
        total,
        fee,
        executedAt: Date.now(),
      });

      executedIds.push(order.id);
      showExecToast(`${order.koreanName} 지정가 ${order.type === 'buy' ? '매수' : '매도'} 체결 완료`);
    }

    if (executedIds.length > 0) {
      updatePortfolio(p);
      const remaining = orders.filter((o) => !executedIds.includes(o.id));
      localStorage.setItem(ORDERS_KEY, JSON.stringify(remaining));
      setPendingOrders(remaining);

      const allExecuted = [...newExecuted, ...executedRef.current].slice(0, 200);
      localStorage.setItem(EXECUTED_KEY, JSON.stringify(allExecuted));
      setExecutedOrders(allExecuted);
    }
  }, [tickers]);

  const selectedMarket = markets.find((m) => m.market === selected);

  return (
    <>
      <DisclaimerModal />
      <div className={styles.wrap}>
        <div className={styles.layout}>
          <main className={styles.main}>
            <TickerHeader market={selectedMarket} ticker={tickers[selected]} />
            <CandleChart market={selected} ticker={tickers[selected]} />
          </main>
          <TradePanel
            market={selectedMarket}
            ticker={tickers[selected]}
            portfolio={portfolio}
            pendingOrders={pendingOrders}
            executedOrders={executedOrders}
            onPortfolioChange={updatePortfolio}
            onOrderPlace={placeOrder}
            onOrderCancel={cancelOrder}
            onExecuted={addExecuted}
          />
          <CoinPanel
            markets={markets}
            tickers={tickers}
            selected={selected}
            onSelect={setSelected}
            portfolio={portfolio}
            onReset={resetAll}
          />
        </div>
        <footer className={styles.footer}>
          본 서비스는 가상 투자 시뮬레이터입니다. 실제 자산과 무관하며 투자 권유가 아닙니다. 실제 투자 결정은 본인 책임 하에 신중하게 하시기 바랍니다.
        </footer>
      </div>
      {execToast && <div className={styles.execToast}>{execToast}</div>}
    </>
  );
}
