import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { formatCurrency } from '../utils/formatting';
import type { Stock } from '../types.ts';

interface Props { accountId: string; onHistory: () => void; }

export default function Holdings({ accountId, onHistory }: Props) {
  const navigate = useNavigate();
  const stocks = useStore(s => s.stocks[accountId] ?? []);
  const prices = useStore(s => s.prices);
  const tradingFee = useStore(s => s.tradingFee);
  const closeStockPosition = useStore(s => s.closeStockPosition);
  const deleteStock = useStore(s => s.deleteStock);

  const today = new Date().toISOString().split('T')[0];
  const [sellModal, setSellModal] = useState<Stock | null>(null);
  const [sellPrice, setSellPrice] = useState('');
  const [sellDate, setSellDate] = useState(today);
  const [sellFee, setSellFee] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<Stock | null>(null);

  const openSellModal = (stock: Stock) => {
    setSellModal(stock);
    setSellPrice('');
    setSellDate(today);
    setSellFee(tradingFee > 0 ? tradingFee.toFixed(2) : '');
  };

  const handleSell = () => {
    if (!sellModal) return;
    const price = parseFloat(sellPrice);
    if (isNaN(price) || price <= 0) return;
    const fee = parseFloat(sellFee) || 0;
    closeStockPosition(sellModal.id, accountId, price, sellDate, fee);
    setSellModal(null);
  };

  const sellNetProceeds = () => {
    const p = parseFloat(sellPrice) || 0;
    const f = parseFloat(sellFee) || 0;
    if (!sellModal || p === 0) return null;
    return (p - sellModal.avg_cost_per_share) * sellModal.shares_owned - f;
  };

  return (
    <div className="tab-content">
      <div className="positions-header">
        <button className="btn-primary btn-sm" onClick={() => navigate(`/${accountId}/add-stock`)}>+ Add</button>
        <span className="positions-label">Current Positions <span className="positions-count">({stocks.length})</span></span>
        <button className="history-link" onClick={onHistory}>History →</button>
      </div>

      {stocks.length === 0 && <div className="empty-state">No holdings. Tap + Add to track a stock.</div>}

      {stocks.map(stock => {
        const currentPrice = prices[stock.symbol]?.price ?? stock.avg_cost_per_share;
        const currentVal = currentPrice * stock.shares_owned;
        const dollarPL = (currentPrice - stock.avg_cost_per_share) * stock.shares_owned;
        const pctPL = ((currentPrice - stock.avg_cost_per_share) / stock.avg_cost_per_share) * 100;
        const isGain = dollarPL >= 0;
        const hasLivePrice = !!prices[stock.symbol];

        return (
          <div key={stock.id} className="holding-card">
            <div className="h-row1">
              <span className="h-ticker">{stock.symbol}</span>
              <span className="h-label">Shares</span>
              <span className="h-val">{stock.shares_owned}</span>
              <span className="h-label">Price</span>
              <span className="h-val">{hasLivePrice ? formatCurrency(currentPrice) : '—'}</span>
              <span className={`h-pl ${isGain ? 'pl-up' : 'pl-down'}`}>{isGain ? '+' : ''}{formatCurrency(dollarPL)}</span>
              <span className={`h-pct ${isGain ? 'pl-up' : 'pl-down'}`}>{isGain ? '+' : ''}{pctPL.toFixed(2)}%</span>
            </div>
            <div className="h-row2">
              <span className="h-label">Avg.</span>
              <span className="h-val">{formatCurrency(stock.avg_cost_per_share)}</span>
              <span className="h-div">·</span>
              <span className="h-label">Total</span>
              <span className="h-val">{formatCurrency(stock.total_invested)}</span>
              <span className="h-div">·</span>
              <span className="h-label">Value</span>
              <span className="h-val">{hasLivePrice ? formatCurrency(currentVal) : '—'}</span>
            </div>
            <div className="h-row3">
              <span>Bought: {stock.date_bought}</span>
              <span>Sell date: —</span>
              {stock.notes && <span className="holding-notes">{stock.notes}</span>}
              <div className="holding-actions">
                <button className="hbtn hbtn-sell" onClick={() => openSellModal(stock)}>Sell</button>
                <button className="hbtn hbtn-edit" onClick={() => navigate(`/${accountId}/edit-stock/${stock.id}`)}>Edit</button>
                <button className="hbtn hbtn-del" onClick={() => setDeleteConfirm(stock)}>Delete</button>
              </div>
            </div>
          </div>
        );
      })}

      {sellModal && (
        <div className="modal-overlay" onClick={() => setSellModal(null)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <h3>Sell {sellModal.symbol}</h3>
            <p>{sellModal.shares_owned} shares · avg cost {formatCurrency(sellModal.avg_cost_per_share)}</p>
            <div className="close-form">
              <div className="close-field">
                <label>Sell Price / Share</label>
                <input type="number" step="0.01" placeholder="e.g. 1.50" value={sellPrice}
                  onChange={e => setSellPrice(e.target.value)} autoFocus />
              </div>
              <div className="close-field">
                <label>Date Sold</label>
                <input type="date" value={sellDate} onChange={e => setSellDate(e.target.value)} />
              </div>
              <div className="close-field">
                <label>Trading Fee ($)</label>
                <input type="number" step="0.01" placeholder="0.00" value={sellFee}
                  onChange={e => setSellFee(e.target.value)} />
              </div>
            </div>
            {sellNetProceeds() !== null && (
              <div className={`close-preview ${(sellNetProceeds()! >= 0) ? 'preview-green' : 'preview-red'}`}>
                Net P&L: {sellNetProceeds()! >= 0 ? '+' : ''}{formatCurrency(sellNetProceeds()!)}
              </div>
            )}
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setSellModal(null)}>Cancel</button>
              <button className="btn-success" onClick={handleSell} disabled={!sellPrice}>Sell</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Delete {deleteConfirm.symbol}?</h3>
            <p>Removes the position without recording a closed trade.</p>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => { deleteStock(deleteConfirm.id, accountId); setDeleteConfirm(null); }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
