export interface Stock {
  id: string;
  symbol: string;
  shares_owned: number;
  avg_cost_per_share: number;
  total_invested: number;
  date_bought: string;
  date_sold?: string;
  sell_price?: number;
  notes?: string;
}

export interface Option {
  id: string;
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

export interface ROICalculationResult {
  capital_at_risk: number;
  total_premium_collected: number;
  roi_on_capital: number;
  roi_on_premium: number;
  days_to_expiration: number;
}
