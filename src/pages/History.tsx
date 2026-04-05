import { useState } from 'react';
import { useStore } from '../store/useStore';
import { formatCurrency, formatDate } from '../utils/formatting';
import type { ClosedTrade } from '../types.ts';

interface Props { accountId: string; tradeType: 'STOCK' | 'OPTION'; }

export default function History({ accountId, tradeType }: Props) {
  const allTrades = useStore(s => s.closedTrades[accountId] ?? []);
  const editClosedTrade = useStore(s => s.editClosedTrade);
  const removeClosedTrade = useStore(s => s.removeClosedTrade);

  const trades = allTrades.filter(t => t.trade_type === tradeType);
  const totalRealized = trades.reduce((sum, t) => sum + t.realized_pl, 0);

  const [editTrade, setEditTrade] = useState<ClosedTrade | null>(null);
  const [editFields, setEditFields] = useState<Partial<ClosedTrade>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<ClosedTrade | null>(null);

  const openEdit = (trade: ClosedTrade) => {
    setEditTrade(trade);
    setEditFields({
      symbol: trade.symbol,
      direction: trade.direction,
      quantity: trade.quantity,
      entry_price: trade.entry_price,
      exit_price: trade.exit_price,
      realized_pl: trade.realized_pl,
      date_opened: trade.date_opened,
      date_closed: trade.date_closed,
      notes: trade.notes,
    });
  };

  const saveEdit = () => {
    if (!editTrade) return;
    editClosedTrade(editTrade.id, accountId, {
      ...editFields,
      quantity: Number(editFields.quantity),
      entry_price: Number(editFields.entry_price),
      exit_price: Number(editFields.exit_price),
      realized_pl: Number(editFields.realized_pl),
    });
    setEditTrade(null);
  };

  const f = (k: keyof ClosedTrade, v: string) => setEditFields(prev => ({ ...prev, [k]: v }));

  return (
    <div className="tab-content">
      <div className="tab-content-header">
        <span>{tradeType === 'STOCK' ? 'Stock' : 'Option'} History — {trades.length} trade{trades.length !== 1 ? 's' : ''}</span>
        {trades.length > 0 && (
          <span className={`summary-badge ${totalRealized >= 0 ? 'green' : 'red'}`}>
            {totalRealized >= 0 ? '+' : ''}{formatCurrency(totalRealized)}
          </span>
        )}
      </div>

      {trades.length === 0 && <div className="empty-state">No closed {tradeType.toLowerCase()} trades yet.</div>}

      {trades.map(trade => (
        <div key={trade.id} className="holding-card">
          <div className="h-row1">
            <span className="h-ticker">{trade.symbol}</span>
            <span className={`option-badge ${trade.direction === 'BUY' ? 'badge-buy' : 'badge-sell'}`}>{trade.direction}</span>
            <span className={`h-pl ${trade.realized_pl >= 0 ? 'pl-up' : 'pl-down'}`}>
              {trade.realized_pl >= 0 ? '+' : ''}{formatCurrency(trade.realized_pl)}
            </span>
            <span className="h-label">realized</span>
            <div className="holding-actions" style={{ marginLeft: 'auto' }}>
              <button className="hbtn hbtn-edit" onClick={() => openEdit(trade)}>Edit</button>
              <button className="hbtn hbtn-del" onClick={() => setDeleteConfirm(trade)}>Delete</button>
            </div>
          </div>
          <div className="h-row2">
            <span className="h-label">Qty</span><span className="h-val">{trade.quantity}</span>
            <span className="h-div">·</span>
            <span className="h-label">Entry</span><span className="h-val">{formatCurrency(trade.entry_price)}</span>
            <span className="h-div">·</span>
            <span className="h-label">Exit</span><span className="h-val">{formatCurrency(trade.exit_price)}</span>
          </div>
          <div className="h-row3">
            <span>Opened: {trade.date_opened}</span>
            <span>Closed: {formatDate(trade.date_closed)}</span>
            {trade.notes && <span className="holding-notes">{trade.notes}</span>}
          </div>
        </div>
      ))}

      {/* Edit modal */}
      {editTrade && (
        <div className="modal-overlay" onClick={() => setEditTrade(null)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <h3>Edit Trade</h3>
            <div className="close-form">
              <div className="close-field">
                <label>Symbol</label>
                <input value={editFields.symbol ?? ''} onChange={e => f('symbol', e.target.value)} />
              </div>
              <div className="close-field">
                <label>Direction</label>
                <select value={editFields.direction} onChange={e => f('direction', e.target.value)}>
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </div>
              <div className="close-field">
                <label>Quantity</label>
                <input type="number" value={editFields.quantity ?? ''} onChange={e => f('quantity', e.target.value)} />
              </div>
              <div className="close-field">
                <label>Entry Price</label>
                <input type="number" step="0.01" value={editFields.entry_price ?? ''} onChange={e => f('entry_price', e.target.value)} />
              </div>
              <div className="close-field">
                <label>Exit Price</label>
                <input type="number" step="0.01" value={editFields.exit_price ?? ''} onChange={e => f('exit_price', e.target.value)} />
              </div>
              <div className="close-field">
                <label>Realized P&L</label>
                <input type="number" step="0.01" value={editFields.realized_pl ?? ''} onChange={e => f('realized_pl', e.target.value)} />
              </div>
              <div className="close-field">
                <label>Date Opened</label>
                <input type="date" value={editFields.date_opened ?? ''} onChange={e => f('date_opened', e.target.value)} />
              </div>
              <div className="close-field">
                <label>Date Closed</label>
                <input type="date" value={editFields.date_closed ?? ''} onChange={e => f('date_closed', e.target.value)} />
              </div>
              <div className="close-field" style={{ gridColumn: '1 / -1' }}>
                <label>Notes</label>
                <input value={editFields.notes ?? ''} onChange={e => f('notes', e.target.value)} placeholder="optional" />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setEditTrade(null)}>Cancel</button>
              <button className="btn-primary" onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Delete this trade?</h3>
            <p>{deleteConfirm.symbol} · {deleteConfirm.direction} · {formatCurrency(deleteConfirm.realized_pl)} P&L</p>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => { removeClosedTrade(deleteConfirm.id, accountId); setDeleteConfirm(null); }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
