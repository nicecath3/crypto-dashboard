export interface Market {
  market: string;
  korean_name: string;
  english_name: string;
}

export interface Ticker {
  market: string;
  trade_price: number;
  signed_change_rate: number;
  signed_change_price: number;
  acc_trade_price_24h: number;
  high_price: number;
  low_price: number;
  prev_closing_price: number;
  timestamp: number;
}

export interface Candle {
  market: string;
  candle_date_time_kst: string;
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
  candle_acc_trade_volume: number;
}

export type MinuteUnit = 1 | 3 | 5 | 10 | 15 | 30 | 60 | 240;
export type CandleType = 'minutes' | 'days' | 'weeks' | 'months';

export interface CandleUnit {
  type: CandleType;
  minutes?: MinuteUnit;
  label: string;
}
