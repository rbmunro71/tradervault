import type { Account, Stock, TradeOption, ClosedTrade, UserProfile, SheetConfig, PriceData, CashTransaction } from '../types.ts';

const generateId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

const load = <T>(key: string): T[] => {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
};
const loadObj = <T>(key: string, def: T): T => {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? def; } catch { return def; }
};
const save = <T>(key: string, data: T) => localStorage.setItem(key, JSON.stringify(data));

// Accounts
export const getAccounts = (): Account[] => load<Account>('accounts');
export const addAccount = (name: string): Account => {
  const all = load<Account>('accounts');
  const a: Account = { id: generateId(), name, cashBalance: 0 };
  save('accounts', [...all, a]);
  return a;
};
export const updateAccount = (id: string, updates: Partial<Account>) => {
  save('accounts', load<Account>('accounts').map(a => a.id === id ? { ...a, ...updates } : a));
};
export const deleteAccount = (id: string) => {
  save('accounts', load<Account>('accounts').filter(a => a.id !== id));
  save('stocks', load<Stock>('stocks').filter(s => s.accountId !== id));
  save('options', load<TradeOption>('options').filter(o => o.accountId !== id));
  save('closed_trades', load<ClosedTrade>('closed_trades').filter(t => t.accountId !== id));
  save('cash_transactions', load<CashTransaction>('cash_transactions').filter(t => t.accountId !== id));
};

// Stocks
export const getStocks = (accountId: string): Stock[] =>
  load<Stock>('stocks').filter(s => s.accountId === accountId && !s.date_sold);
export const getAllOpenStocks = (): Stock[] => load<Stock>('stocks').filter(s => !s.date_sold);
export const addStock = (stock: Omit<Stock, 'id'>): Stock => {
  const all = load<Stock>('stocks');
  const n = { ...stock, id: generateId() };
  save('stocks', [...all, n]);
  return n;
};
export const updateStock = (id: string, updates: Partial<Stock>) => {
  save('stocks', load<Stock>('stocks').map(s => s.id === id ? { ...s, ...updates } : s));
};
export const deleteStock = (id: string) => save('stocks', load<Stock>('stocks').filter(s => s.id !== id));
export const closeStock = (id: string, sellPrice: number, dateSold: string): Stock | null => {
  const all = load<Stock>('stocks');
  const s = all.find(x => x.id === id);
  if (!s) return null;
  save('stocks', all.map(x => x.id === id ? { ...x, date_sold: dateSold, sell_price: sellPrice } : x));
  return s;
};

// Options
export const getOptions = (accountId: string): TradeOption[] =>
  load<TradeOption>('options').filter(o => o.accountId === accountId && !o.date_closed);
export const getAllOpenOptions = (): TradeOption[] => load<TradeOption>('options').filter(o => !o.date_closed);
export const addOption = (option: Omit<TradeOption, 'id'>): TradeOption => {
  const all = load<TradeOption>('options');
  const n = { ...option, id: generateId() };
  save('options', [...all, n]);
  return n;
};
export const updateOption = (id: string, updates: Partial<TradeOption>) => {
  save('options', load<TradeOption>('options').map(o => o.id === id ? { ...o, ...updates } : o));
};
export const deleteOption = (id: string) => save('options', load<TradeOption>('options').filter(o => o.id !== id));
export const closeOptionDb = (id: string, premiumClosed: number, dateClosed: string): TradeOption | null => {
  const all = load<TradeOption>('options');
  const o = all.find(x => x.id === id);
  if (!o) return null;
  save('options', all.map(x => x.id === id ? { ...x, date_closed: dateClosed, premium_closed: premiumClosed } : x));
  return o;
};

// Closed Trades
export const getClosedTrades = (accountId: string): ClosedTrade[] =>
  load<ClosedTrade>('closed_trades')
    .filter(t => t.accountId === accountId)
    .sort((a, b) => b.date_closed.localeCompare(a.date_closed));
export const addClosedTrade = (trade: Omit<ClosedTrade, 'id'>) => {
  const all = load<ClosedTrade>('closed_trades');
  save('closed_trades', [...all, { ...trade, id: generateId() }]);
};
export const updateClosedTrade = (id: string, updates: Partial<ClosedTrade>) => {
  save('closed_trades', load<ClosedTrade>('closed_trades').map(t => t.id === id ? { ...t, ...updates } : t));
};
export const deleteClosedTrade = (id: string) => {
  save('closed_trades', load<ClosedTrade>('closed_trades').filter(t => t.id !== id));
};

// User Profile (stored by username for recovery flows)
export const saveProfile = (profile: UserProfile) => {
  const all = loadObj<Record<string, UserProfile>>('user_profiles', {});
  all[profile.username.toLowerCase()] = profile;
  save('user_profiles', all);
};
export const getProfileByUsername = (username: string): UserProfile | null => {
  const all = loadObj<Record<string, UserProfile>>('user_profiles', {});
  return all[username.toLowerCase()] ?? null;
};
export const getProfileBySupabaseId = (id: string): UserProfile | null => {
  const all = loadObj<Record<string, UserProfile>>('user_profiles', {});
  return Object.values(all).find(p => (p as any).supabaseId === id) ?? null;
};

// Cash Transactions
export const getCashTransactions = (accountId: string): CashTransaction[] =>
  load<CashTransaction>('cash_transactions')
    .filter(t => t.accountId === accountId)
    .sort((a, b) => b.date.localeCompare(a.date));
export const addCashTransaction = (tx: Omit<CashTransaction, 'id'>): CashTransaction => {
  const all = load<CashTransaction>('cash_transactions');
  const n = { ...tx, id: generateId() };
  save('cash_transactions', [...all, n]);
  return n;
};
export const deleteCashTransactionsByAccount = (accountId: string) => {
  save('cash_transactions', load<CashTransaction>('cash_transactions').filter(t => t.accountId !== accountId));
};
export const updateCashTransaction = (id: string, updates: Partial<CashTransaction>) => {
  save('cash_transactions', load<CashTransaction>('cash_transactions').map(t => t.id === id ? { ...t, ...updates } : t));
};
export const deleteCashTransaction = (id: string) => {
  save('cash_transactions', load<CashTransaction>('cash_transactions').filter(t => t.id !== id));
};

// App Settings (trading fees etc.)
interface AppSettings { tradingFee: number; optionFee: number; }
export const getSettings = (): AppSettings => loadObj<AppSettings>('app_settings', { tradingFee: 0, optionFee: 0 });
export const saveSettings = (updates: Partial<AppSettings>) => save('app_settings', { ...getSettings(), ...updates });

// Sheet Config
export const getSheetConfig = (): SheetConfig => loadObj<SheetConfig>('sheet_config', { url: '', mappings: [] });
export const saveSheetConfig = (config: SheetConfig) => save('sheet_config', config);

// Price Cache
export const getPriceCache = (): Record<string, PriceData> => loadObj('price_cache', {});
export const savePriceCache = (cache: Record<string, PriceData>) => save('price_cache', cache);
