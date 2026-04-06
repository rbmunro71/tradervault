export interface Account {
  id: string;
  name: string;
  cashBalance: number;
}

export interface Stock {
  id: string;
  accountId: string;
  symbol: string;
  shares_owned: number;
  avg_cost_per_share: number;
  total_invested: number;
  date_bought: string;
  date_sold?: string;
  sell_price?: number;
  notes?: string;
}

export interface TradeOption {
  id: string;
  accountId: string;
  symbol: string;
  option_type: 'CALL' | 'PUT';
  direction: 'BUY' | 'SELL';
  strike_price: number;
  contracts: number;
  premium_paid: number;
  expiration_date: string;
  date_opened: string;
  date_closed?: string;
  premium_closed?: number;
  total_cost: number;
  notes?: string;
}

export interface ClosedTrade {
  id: string;
  accountId: string;
  symbol: string;
  trade_type: 'STOCK' | 'OPTION';
  direction: 'BUY' | 'SELL';
  quantity: number;
  entry_price: number;
  exit_price: number;
  realized_pl: number;
  date_opened: string;
  date_closed: string;
  notes?: string;
}

export interface SecurityQuestion {
  questionId: number;
  answer: string;
}

export interface UserProfile {
  firstName: string;
  lastInitial: string;
  username: string;
  email: string;
  dob: { month: number; day: number };
  securityQuestions: SecurityQuestion[];
}

export interface TickerMapping {
  symbol: string;
  priceCell: string;
  openCell: string;
  closeCell: string;
  manualPrice?: number;
}

export type ApiServiceId = 'alphavantage' | 'polygon' | 'finnhub' | 'iex';

export interface SheetConfig {
  url: string;
  mappings: TickerMapping[];
  apiKeys?: Partial<Record<ApiServiceId, string>>;
  // legacy — kept for migration only
  apiService?: ApiServiceId;
  apiKey?: string;
}

export interface PriceData {
  symbol: string;
  price: number;
  open?: number;
  close?: number;
  fetchedAt: number;
}

export interface CashTransaction {
  id: string;
  accountId: string;
  type: 'DEPOSIT' | 'WITHDRAW' | 'INTEREST';
  amount: number;
  date: string;
  notes?: string;
}

export interface ROICalculationResult {
  capital_at_risk: number;
  total_premium_collected: number;
  roi_on_capital: number;
  roi_on_premium: number;
  days_to_expiration: number;
}
