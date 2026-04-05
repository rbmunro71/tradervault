import { create } from 'zustand';
import type { Account, Stock, TradeOption, ClosedTrade, PriceData, SheetConfig, CashTransaction } from '../types.ts';
import * as db from './db';

interface StoreState {
  accounts: Account[];
  stocks: Record<string, Stock[]>;
  options: Record<string, TradeOption[]>;
  closedTrades: Record<string, ClosedTrade[]>;
  prices: Record<string, PriceData>;
  sheetConfig: SheetConfig;
  tradingFee: number;
  optionFee: number;

  // Accounts
  fetchAccounts: () => void;
  addAccount: (name: string) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => void;

  // Stocks
  fetchStocks: (accountId: string) => void;
  addStock: (stock: Omit<Stock, 'id'>) => void;
  updateStock: (id: string, updates: Partial<Stock>) => void;
  deleteStock: (id: string, accountId: string) => void;
  closeStockPosition: (id: string, accountId: string, sellPrice: number, dateSold: string, fee?: number) => void;

  // Options
  fetchOptions: (accountId: string) => void;
  addOption: (option: Omit<TradeOption, 'id'>) => void;
  updateOption: (id: string, updates: Partial<TradeOption>) => void;
  deleteOption: (id: string, accountId: string) => void;
  closeOption: (id: string, accountId: string, premiumClosed: number, dateClosed: string, fee?: number) => void;

  // Closed trades
  fetchClosedTrades: (accountId: string) => void;
  editClosedTrade: (id: string, accountId: string, updates: Partial<ClosedTrade>) => void;
  removeClosedTrade: (id: string, accountId: string) => void;

  // Cash transactions
  cashTransactions: Record<string, CashTransaction[]>;
  fetchCashTransactions: (accountId: string) => void;
  addCashEntry: (accountId: string, type: CashTransaction['type'], amount: number, date: string, notes?: string) => void;
  editCashTx: (id: string, accountId: string, updates: Partial<CashTransaction>) => void;
  removeCashTx: (id: string, accountId: string, amount: number, type: CashTransaction['type']) => void;

  // Prices
  setPrice: (symbol: string, data: PriceData) => void;
  getPrice: (symbol: string) => number | null;

  // Sheet config
  fetchSheetConfig: () => void;
  saveSheetConfig: (config: SheetConfig) => void;

  // Settings
  setTradingFee: (fee: number) => void;
  setOptionFee: (fee: number) => void;

  // Batch import
  importOptionsBatch: (accountId: string, items: Array<{ option: Omit<TradeOption, 'id'>; closedTrade?: Omit<ClosedTrade, 'id'> }>) => void;

  // Computed
  getTotalPortfolioValue: () => number;
  getAccountStockValue: (accountId: string) => number;
  getAccountUnrealizedPL: (accountId: string) => number;
  getAccountRealizedPL: (accountId: string) => number;
  getAllActiveTickers: () => string[];
}

export const useStore = create<StoreState>((set, get) => ({
  accounts: db.getAccounts(),
  stocks: {},
  options: {},
  closedTrades: {},
  cashTransactions: {},
  prices: db.getPriceCache(),
  sheetConfig: db.getSheetConfig(),
  tradingFee: db.getSettings().tradingFee,
  optionFee: db.getSettings().optionFee,

  fetchAccounts: () => set({ accounts: db.getAccounts() }),

  addAccount: (name) => {
    db.addAccount(name);
    set({ accounts: db.getAccounts() });
  },

  updateAccount: (id, updates) => {
    db.updateAccount(id, updates);
    set({ accounts: db.getAccounts() });
  },

  deleteAccount: (id) => {
    db.deleteAccount(id);
    const s = { ...get().stocks }; delete s[id];
    const o = { ...get().options }; delete o[id];
    const c = { ...get().closedTrades }; delete c[id];
    set({ accounts: db.getAccounts(), stocks: s, options: o, closedTrades: c });
  },

  fetchStocks: (accountId) => {
    set(state => ({ stocks: { ...state.stocks, [accountId]: db.getStocks(accountId) } }));
  },

  addStock: (stock) => {
    db.addStock(stock);
    set(state => ({ stocks: { ...state.stocks, [stock.accountId]: db.getStocks(stock.accountId) } }));
  },

  updateStock: (id, updates) => {
    db.updateStock(id, updates);
    const accountId = db.getAllOpenStocks().find(s => s.id === id)?.accountId
      ?? Object.keys(get().stocks).find(aid => get().stocks[aid]?.some(s => s.id === id));
    if (accountId) set(state => ({ stocks: { ...state.stocks, [accountId]: db.getStocks(accountId) } }));
  },

  deleteStock: (id, accountId) => {
    db.deleteStock(id);
    set(state => ({ stocks: { ...state.stocks, [accountId]: db.getStocks(accountId) } }));
  },

  closeStockPosition: (id, accountId, sellPrice, dateSold, fee = 0) => {
    const stock = db.closeStock(id, sellPrice, dateSold);
    if (!stock) return;
    const realizedPL = (sellPrice - stock.avg_cost_per_share) * stock.shares_owned - fee;
    db.addClosedTrade({
      accountId, symbol: stock.symbol, trade_type: 'STOCK', direction: 'SELL',
      quantity: stock.shares_owned, entry_price: stock.avg_cost_per_share,
      exit_price: sellPrice, realized_pl: realizedPL,
      date_opened: stock.date_bought, date_closed: dateSold, notes: stock.notes,
    });
    set(state => ({
      stocks: { ...state.stocks, [accountId]: db.getStocks(accountId) },
      closedTrades: { ...state.closedTrades, [accountId]: db.getClosedTrades(accountId) },
    }));
  },

  fetchOptions: (accountId) => {
    set(state => ({ options: { ...state.options, [accountId]: db.getOptions(accountId) } }));
  },

  addOption: (option) => {
    db.addOption(option);
    set(state => ({ options: { ...state.options, [option.accountId]: db.getOptions(option.accountId) } }));
  },

  updateOption: (id, updates) => {
    db.updateOption(id, updates);
    const accountId = Object.keys(get().options).find(aid => get().options[aid]?.some(o => o.id === id));
    if (accountId) set(state => ({ options: { ...state.options, [accountId]: db.getOptions(accountId) } }));
  },

  deleteOption: (id, accountId) => {
    db.deleteOption(id);
    set(state => ({ options: { ...state.options, [accountId]: db.getOptions(accountId) } }));
  },

  closeOption: (id, accountId, premiumClosed, dateClosed, fee = 0) => {
    const option = db.closeOptionDb(id, premiumClosed, dateClosed);
    if (!option) return;
    const totalPaid = option.premium_paid * option.contracts * 100;
    const totalClosed = premiumClosed * option.contracts * 100;
    const feeTotal = fee * option.contracts;
    // SELL option: received premium at open, paying to close + fee → P&L = totalPaid - totalClosed - feeTotal
    // BUY option: paid premium at open, receiving at close - fee → P&L = totalClosed - totalPaid - feeTotal
    const realizedPL = option.direction === 'BUY'
      ? totalClosed - totalPaid - feeTotal
      : totalPaid - totalClosed - feeTotal;
    db.addClosedTrade({
      accountId, symbol: option.symbol, trade_type: 'OPTION', direction: option.direction,
      quantity: option.contracts, entry_price: option.premium_paid,
      exit_price: premiumClosed, realized_pl: realizedPL,
      date_opened: option.date_opened, date_closed: dateClosed, notes: option.notes,
    });
    set(state => ({
      options: { ...state.options, [accountId]: db.getOptions(accountId) },
      closedTrades: { ...state.closedTrades, [accountId]: db.getClosedTrades(accountId) },
    }));
  },

  fetchClosedTrades: (accountId) => {
    set(state => ({ closedTrades: { ...state.closedTrades, [accountId]: db.getClosedTrades(accountId) } }));
  },

  editClosedTrade: (id, accountId, updates) => {
    db.updateClosedTrade(id, updates);
    set(state => ({ closedTrades: { ...state.closedTrades, [accountId]: db.getClosedTrades(accountId) } }));
  },

  removeClosedTrade: (id, accountId) => {
    db.deleteClosedTrade(id);
    set(state => ({ closedTrades: { ...state.closedTrades, [accountId]: db.getClosedTrades(accountId) } }));
  },

  fetchCashTransactions: (accountId) => {
    set(state => ({ cashTransactions: { ...state.cashTransactions, [accountId]: db.getCashTransactions(accountId) } }));
  },

  addCashEntry: (accountId, type, amount, date, notes) => {
    db.addCashTransaction({ accountId, type, amount, date, notes });
    const delta = type === 'WITHDRAW' ? -Math.abs(amount) : Math.abs(amount);
    const account = db.getAccounts().find(a => a.id === accountId);
    if (account) db.updateAccount(accountId, { cashBalance: account.cashBalance + delta });
    set(state => ({
      accounts: db.getAccounts(),
      cashTransactions: { ...state.cashTransactions, [accountId]: db.getCashTransactions(accountId) },
    }));
  },

  editCashTx: (id, accountId, updates) => {
    db.updateCashTransaction(id, updates);
    set(state => ({ cashTransactions: { ...state.cashTransactions, [accountId]: db.getCashTransactions(accountId) } }));
  },

  removeCashTx: (id, accountId, amount, type) => {
    db.deleteCashTransaction(id);
    // Reverse the balance effect
    const delta = type === 'WITHDRAW' ? Math.abs(amount) : -Math.abs(amount);
    const account = db.getAccounts().find(a => a.id === accountId);
    if (account) db.updateAccount(accountId, { cashBalance: account.cashBalance + delta });
    set(state => ({
      accounts: db.getAccounts(),
      cashTransactions: { ...state.cashTransactions, [accountId]: db.getCashTransactions(accountId) },
    }));
  },

  importOptionsBatch: (accountId, items) => {
    for (const { option, closedTrade } of items) {
      db.addOption(option);
      if (closedTrade) db.addClosedTrade(closedTrade);
    }
    set(state => ({
      options: { ...state.options, [accountId]: db.getOptions(accountId) },
      closedTrades: { ...state.closedTrades, [accountId]: db.getClosedTrades(accountId) },
    }));
  },

  setPrice: (symbol, data) => {
    const prices = { ...get().prices, [symbol]: data };
    db.savePriceCache(prices);
    set({ prices });
  },

  getPrice: (symbol) => get().prices[symbol]?.price ?? null,

  fetchSheetConfig: () => set({ sheetConfig: db.getSheetConfig() }),

  saveSheetConfig: (config) => {
    db.saveSheetConfig(config);
    set({ sheetConfig: config });
  },

  setTradingFee: (fee) => {
    db.saveSettings({ tradingFee: fee });
    set({ tradingFee: fee });
  },

  setOptionFee: (fee) => {
    db.saveSettings({ optionFee: fee });
    set({ optionFee: fee });
  },

  getTotalPortfolioValue: () => {
    const { accounts, stocks, prices } = get();
    return accounts.reduce((total, account) => {
      const accountStocks = stocks[account.id] ?? db.getStocks(account.id);
      const stockValue = accountStocks.reduce((sum, s) => {
        const price = prices[s.symbol]?.price ?? s.avg_cost_per_share;
        return sum + s.shares_owned * price;
      }, 0);
      return total + account.cashBalance + stockValue;
    }, 0);
  },

  getAccountStockValue: (accountId) => {
    const accountStocks = get().stocks[accountId] ?? db.getStocks(accountId);
    const prices = get().prices;
    return accountStocks.reduce((sum, s) => {
      const price = prices[s.symbol]?.price ?? s.avg_cost_per_share;
      return sum + s.shares_owned * price;
    }, 0);
  },

  getAccountUnrealizedPL: (accountId) => {
    const accountStocks = get().stocks[accountId] ?? db.getStocks(accountId);
    const prices = get().prices;
    return accountStocks.reduce((sum, s) => {
      const price = prices[s.symbol]?.price ?? s.avg_cost_per_share;
      return sum + (price - s.avg_cost_per_share) * s.shares_owned;
    }, 0);
  },

  getAccountRealizedPL: (accountId) => {
    const trades = get().closedTrades[accountId] ?? db.getClosedTrades(accountId);
    return trades.reduce((sum, t) => sum + t.realized_pl, 0);
  },

  getAllActiveTickers: () => {
    const stocks = db.getAllOpenStocks().map(s => s.symbol);
    const options = db.getAllOpenOptions().map(o => o.symbol);
    return [...new Set([...stocks, ...options])].sort();
  },
}));
