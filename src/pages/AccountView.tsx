import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { formatCurrency } from '../utils/formatting';
import Holdings from './Holdings';
import OptionsTab from './OptionsTab';
import History from './History';
import CashTab from './CashTab';

type Tab = 'holdings' | 'options' | 'cash' | 'stock-history' | 'option-history';

export default function AccountView() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('holdings');

  const accounts = useStore(s => s.accounts);
  const fetchStocks = useStore(s => s.fetchStocks);
  const fetchOptions = useStore(s => s.fetchOptions);
  const fetchClosedTrades = useStore(s => s.fetchClosedTrades);
  const fetchCashTransactions = useStore(s => s.fetchCashTransactions);
  const getAccountStockValue = useStore(s => s.getAccountStockValue);
  const getAccountUnrealizedPL = useStore(s => s.getAccountUnrealizedPL);

  const account = accounts.find(a => a.id === accountId);

  useEffect(() => {
    if (accountId) {
      fetchStocks(accountId);
      fetchOptions(accountId);
      fetchClosedTrades(accountId);
      fetchCashTransactions(accountId);
    }
  }, [accountId]);

  if (!account) {
    return (
      <div className="page">
        <div className="page-header">
          <button className="btn-ghost" onClick={() => navigate('/')}>← Back</button>
        </div>
        <div className="empty-state">Account not found.</div>
      </div>
    );
  }

  const stockVal = getAccountStockValue(account.id);
  const unrealized = getAccountUnrealizedPL(account.id);
  const total = account.cashBalance + stockVal;
  const isHistoryTab = tab === 'stock-history' || tab === 'option-history';

  return (
    <div className="page">
      <div className="account-view-header">
        <button className="btn-ghost btn-sm" onClick={() => navigate('/')}>← Back</button>
        <div className="account-view-name">{account.name}</div>
        <div className="account-view-total">{formatCurrency(total)}</div>
      </div>

      <div className="account-summary-strip">
        <div className="summary-item">
          <span className="summary-label">Cash</span>
          <span className="summary-val">{formatCurrency(account.cashBalance)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Holdings</span>
          <span className="summary-val">{formatCurrency(stockVal)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Unrealized</span>
          <span className={`summary-val ${unrealized >= 0 ? 'green' : 'red'}`}>
            {unrealized >= 0 ? '+' : ''}{formatCurrency(unrealized)}
          </span>
        </div>
      </div>

      {isHistoryTab && (
        <button
          className="history-back-btn"
          onClick={() => setTab(tab === 'stock-history' ? 'holdings' : 'options')}
        >
          ← Back to {tab === 'stock-history' ? 'Holdings' : 'Options'}
        </button>
      )}

      {!isHistoryTab && (
        <div className="tab-bar">
          <button className={`tab-btn ${tab === 'holdings' ? 'active' : ''}`} onClick={() => setTab('holdings')}>Holdings</button>
          <button className={`tab-btn ${tab === 'options' ? 'active' : ''}`} onClick={() => setTab('options')}>Options</button>
          <button className={`tab-btn ${tab === 'cash' ? 'active' : ''}`} onClick={() => setTab('cash')}>Cash</button>
        </div>
      )}

      {tab === 'holdings' && <Holdings accountId={account.id} onHistory={() => setTab('stock-history')} />}
      {tab === 'options' && <OptionsTab accountId={account.id} onHistory={() => setTab('option-history')} />}
      {tab === 'cash' && <CashTab accountId={account.id} />}
      {tab === 'stock-history' && <History accountId={account.id} tradeType="STOCK" />}
      {tab === 'option-history' && <History accountId={account.id} tradeType="OPTION" />}
    </div>
  );
}
