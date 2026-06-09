'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getCandles } from '../lib/upbit';
import type { Candle, CandleUnit, Ticker } from '../types/upbit';
import styles from './CandleChart.module.scss';

interface Props {
  market: string;
  ticker?: Ticker;
}

interface ChartData {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  isUp: boolean;
}

const UNITS: CandleUnit[] = [
  { type: 'minutes', minutes: 1,  label: '1분'   },
  { type: 'minutes', minutes: 5,  label: '5분'   },
  { type: 'minutes', minutes: 30, label: '30분'  },
  { type: 'minutes', minutes: 60, label: '1시간' },
  { type: 'days',                 label: '일봉'  },
  { type: 'weeks',                label: '주봉'  },
  { type: 'months',               label: '월봉'  },
];

const UP_COLOR = '#e22b2b';
const DOWN_COLOR = '#1763b6';

function formatDate(kst: string, unitType: CandleUnit['type']): string {
  if (unitType === 'months') return kst.slice(0, 7);
  if (unitType === 'weeks' || unitType === 'days') return kst.slice(5, 10);
  return kst.slice(5, 16).replace('T', ' ');
}

function toChartData(candles: Candle[], unitType: CandleUnit['type']): ChartData[] {
  return [...candles].reverse().map((c) => ({
    date: formatDate(c.candle_date_time_kst, unitType),
    open: c.opening_price,
    close: c.trade_price,
    high: c.high_price,
    low: c.low_price,
    volume: c.candle_acc_trade_volume,
    isUp: c.trade_price >= c.opening_price,
  }));
}

function formatPrice(v: number) {
  if (v >= 1000) return v.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  if (v >= 1) return v.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  return v.toLocaleString('ko-KR', { maximumFractionDigits: 6 });
}

const PAD = { top: 16, right: 90, bottom: 36, left: 12 };
const CANDLE_RATIO = 0.72;
const VOL_GAP = 8;
const Y_TICKS = 5;
const X_TICKS = 6;
const MIN_VISIBLE = 10;
const MAX_VISIBLE = 200;
const DEFAULT_VISIBLE = 60;

export function CandleChart({ market, ticker }: Props) {
  const [unit, setUnit] = useState<CandleUnit>(UNITS[4]);
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; d: ChartData } | null>(null);
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 400 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 실시간 ticker로 마지막 캔들 업데이트
  useEffect(() => {
    if (!ticker || data.length === 0) return;
    setData((prev) => {
      const last = prev[prev.length - 1];
      const updated: ChartData = {
        ...last,
        close: ticker.trade_price,
        high: Math.max(last.high, ticker.trade_price),
        low: Math.min(last.low, ticker.trade_price),
        isUp: ticker.trade_price >= last.open,
      };
      return [...prev.slice(0, -1), updated];
    });
  }, [ticker?.trade_price]);

  useEffect(() => {
    setLoading(true);
    setTooltip(null);
    setVisibleCount(DEFAULT_VISIBLE);
    getCandles(market, unit, MAX_VISIBLE)
      .then((candles) => setData(toChartData(candles, unit.type)))
      .finally(() => setLoading(false));
  }, [market, unit.type, unit.minutes]);

  // 휠로 확대/축소
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setVisibleCount((prev) => {
      const delta = e.deltaY > 0 ? Math.ceil(prev * 0.1) : -Math.ceil(prev * 0.1);
      return Math.min(MAX_VISIBLE, Math.max(MIN_VISIBLE, prev + delta));
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // 보여줄 데이터: 최신 visibleCount개
  const visible = data.slice(Math.max(0, data.length - visibleCount));

  const { w, h } = size;
  const chartW = w - PAD.left - PAD.right;
  const totalH = h - PAD.top - PAD.bottom;
  const candleH = totalH * CANDLE_RATIO - VOL_GAP;
  const volH = totalH * (1 - CANDLE_RATIO);
  const volTop = PAD.top + candleH + VOL_GAP;

  const allPrices = visible.flatMap((d) => [d.high, d.low]);
  const minP = allPrices.length ? Math.min(...allPrices) : 0;
  const maxP = allPrices.length ? Math.max(...allPrices) : 1;
  const pRange = maxP - minP || 1;
  const vPad = pRange * 0.06;

  const toY = (p: number) => PAD.top + ((maxP + vPad - p) / (pRange + vPad * 2)) * candleH;
  const barW = Math.max(chartW / visible.length - 1, 1);

  const maxVol = visible.length ? Math.max(...visible.map((d) => d.volume)) : 1;
  const toVolH = (v: number) => (v / maxVol) * (volH * 0.9);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current || visible.length === 0) return;
      const rect = svgRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left - PAD.left;
      const idx = Math.floor((mx / chartW) * visible.length);
      const d = visible[Math.max(0, Math.min(idx, visible.length - 1))];
      if (d) setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, d });
    },
    [visible, chartW]
  );

  const yTicks = Array.from({ length: Y_TICKS }, (_, i) => {
    const price = (maxP + vPad) - ((i / (Y_TICKS - 1)) * (pRange + vPad * 2));
    return { price, y: PAD.top + (i / (Y_TICKS - 1)) * candleH };
  });

  const xTickIndices = Array.from({ length: X_TICKS }, (_, i) =>
    Math.floor((i / (X_TICKS - 1)) * (visible.length - 1))
  );

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        {UNITS.map((u) => {
          const key = u.type + (u.minutes ?? '');
          const isActive = unit.type === u.type && unit.minutes === u.minutes;
          return (
            <button
              key={key}
              className={[styles.btn, isActive ? styles['btn--active'] : ''].join(' ')}
              onClick={() => setUnit(u)}
            >
              {u.label}
            </button>
          );
        })}
      </div>

      <div className={styles.chart} ref={containerRef}>
        {loading ? (
          <div className={styles.loading}>불러오는 중...</div>
        ) : (
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setTooltip(null)}
          >
            {/* Grid lines */}
            {yTicks.map((t, i) => (
              <line key={i} x1={PAD.left} y1={t.y} x2={w - PAD.right} y2={t.y} stroke="var(--chart-grid)" strokeDasharray="3 3" />
            ))}
            <line x1={PAD.left} y1={volTop - 4} x2={w - PAD.right} y2={volTop - 4} stroke="var(--chart-grid)" strokeDasharray="3 3" />

            {/* Candles */}
            {visible.map((d, i) => {
              const color = d.isUp ? UP_COLOR : DOWN_COLOR;
              const cx = PAD.left + (i + 0.5) * (chartW / visible.length);
              const bodyTop = toY(Math.max(d.open, d.close));
              const bodyBot = toY(Math.min(d.open, d.close));
              const bodyH = Math.max(bodyBot - bodyTop, 1);
              const highY = toY(d.high);
              const lowY = toY(d.low);
              const bw = Math.max(barW * 0.7, 1);
              return (
                <g key={i}>
                  <line x1={cx} y1={highY} x2={cx} y2={bodyTop} stroke={color} strokeWidth={1} />
                  <rect x={cx - bw / 2} y={bodyTop} width={bw} height={bodyH} fill={color} />
                  <line x1={cx} y1={bodyBot} x2={cx} y2={lowY} stroke={color} strokeWidth={1} />
                </g>
              );
            })}

            {/* 거래량 바 */}
            {visible.map((d, i) => {
              const color = d.isUp ? UP_COLOR : DOWN_COLOR;
              const cx = PAD.left + (i + 0.5) * (chartW / visible.length);
              const bw = Math.max(barW * 0.7, 1);
              const vh = toVolH(d.volume);
              return (
                <rect key={i} x={cx - bw / 2} y={volTop + volH - vh} width={bw} height={vh} fill={color} opacity={0.5} />
              );
            })}

            {/* Y axis labels */}
            {yTicks.map((t, i) => (
              <text key={i} x={w - PAD.right + 6} y={t.y + 4} fill="var(--chart-axis)" fontSize={10}>
                {formatPrice(t.price)}
              </text>
            ))}

            {/* X axis labels */}
            {xTickIndices.map((idx) => {
              const d = visible[idx];
              if (!d) return null;
              const cx = PAD.left + (idx + 0.5) * (chartW / visible.length);
              return (
                <text key={idx} x={cx} y={h - 8} fill="var(--chart-axis)" fontSize={10} textAnchor="middle">
                  {d.date}
                </text>
              );
            })}

            {/* Tooltip crosshair */}
            {tooltip && (
              <>
                <line x1={tooltip.x} y1={PAD.top} x2={tooltip.x} y2={h - PAD.bottom} stroke="var(--chart-grid)" strokeDasharray="4 3" strokeWidth={1} />
                <g transform={`translate(${Math.min(tooltip.x + 10, w - 160)}, ${Math.max(tooltip.y - 90, PAD.top)})`}>
                  <rect width={156} height={112} fill="var(--chart-tooltip-bg)" stroke="var(--chart-tooltip-border)" rx={6} />
                  <text x={8} y={18} fill="var(--chart-tooltip-date)" fontSize={10}>{tooltip.d.date}</text>
                  <text x={8} y={36} fill="var(--chart-tooltip-text)" fontSize={11}>시가 {formatPrice(tooltip.d.open)}</text>
                  <text x={8} y={52} fill="var(--chart-tooltip-text)" fontSize={11}>종가 {formatPrice(tooltip.d.close)}</text>
                  <text x={8} y={68} fill={UP_COLOR} fontSize={11}>고가 {formatPrice(tooltip.d.high)}</text>
                  <text x={8} y={84} fill={DOWN_COLOR} fontSize={11}>저가 {formatPrice(tooltip.d.low)}</text>
                  <text x={8} y={100} fill="var(--chart-tooltip-date)" fontSize={11}>거래량 {tooltip.d.volume.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}</text>
                </g>
              </>
            )}
          </svg>
        )}
      </div>
    </div>
  );
}
