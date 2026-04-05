import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { formatCurrency } from '../utils/formatting';

export default function Dashboard() {
  const navigate = useNavigate();
  const { accounts, addAccount, deleteAccount, updateAccount,
    getTotalPortfolioValue, getAccountStockValue, getAccountUnrealizedPL, getAccountRealizedPL } = useStore();

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCash, setEditCash] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const totalValue = getTotalPortfolioValue();

  const handleAdd = () => {
    if (!newName.trim()) return;
    addAccount(newName.trim());
    setNewName('');
    setShowAdd(false);
  };

  const startEdit = (e: React.MouseEvent, id: string, name: string, cash: number) => {
    e.stopPropagation();
    setEditId(id);
    setEditName(name);
    setEditCash(cash.toString());
  };

  const saveEdit = () => {
    if (!editId) return;
    updateAccount(editId, { name: editName.trim(), cashBalance: parseFloat(editCash) || 0 });
    setEditId(null);
  };

  const fmtPL = (n: number) => {
    const s = formatCurrency(Math.abs(n));
    return n >= 0 ? `+${s}` : `-${s}`;
  };

  return (
    <div className="page">
      <div className="dashboard-total">
        <div className="dashboard-total-label">Total Portfolio</div>
        <div className="dashboard-total-value">{formatCurrency(totalValue)}</div>
      </div>

      <div className="section-header">
        <span>Accounts ({accounts.length})</span>
        <button className="btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add</button>
      </div>

      {showAdd && (
        <div className="inline-form">
          <input
            autoFocus
            placeholder="Account name (e.g. Robinhood)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') { setShowAdd(false); setNewName(''); }
            }}
          />
          <div className="inline-form-actions">
            <button className="btn-primary btn-sm" onClick={handleAdd}>Create</button>
            <button className="btn-ghost btn-sm" onClick={() => { setShowAdd(false); setNewName(''); }}>Cancel</button>
          </div>
        </div>
      )}

      {accounts.length === 0 && !showAdd && (
        <div className="empty-state">No accounts yet. Tap + Add to create one.</div>
      )}

      <div className="account-list">
        {accounts.map(account => {
          const stockVal = getAccountStockValue(account.id);
          const unrealized = getAccountUnrealizedPL(account.id);
          const realized = getAccountRealizedPL(account.id);
          const total = account.cashBalance + stockVal;

          if (editId === account.id) {
            return (
              <div key={account.id} className="account-card editing">
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Account name"
                  style={{ marginBottom: 8 }}
                />
                <div className="edit-cash-row">
                  <label>Cash Balance ($)</label>
                  <input
                    type="number"
                    value={editCash}
                    onChange={e => setEditCash(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="inline-form-actions" style={{ marginTop: 8 }}>
                  <button className="btn-primary btn-sm" onClick={saveEdit}>Save</button>
                  <button className="btn-ghost btn-sm" onClick={() => setEditId(null)}>Cancel</button>
                </div>
              </div>
            );
          }

          return (
            <div key={account.id} className="account-card" onClick={() => navigate(`/${account.id}`)}>
              <div className="account-card-header">
                <span className="account-name">{account.name}</span>
                <span className="account-total">{formatCurrency(total)}</span>
              </div>
              <div className="account-card-stats">
                <div className="stat">
                  <div className="stat-label">Cash</div>
                  <div className="stat-value">{formatCurrency(account.cashBalance)}</div>
                </div>
                <div className="stat">
                  <div className="stat-label">Holdings</div>
                  <div className="stat-value">{formatCurrency(stockVal)}</div>
                </div>
                <div className="stat">
                  <div className="stat-label">Unrealized</div>
                  <div className={`stat-value ${unrealized >= 0 ? 'green' : 'red'}`}>{fmtPL(unrealized)}</div>
                </div>
                <div className="stat">
                  <div className="stat-label">Realized</div>
                  <div className={`stat-value ${realized >= 0 ? 'green' : 'red'}`}>{fmtPL(realized)}</div>
                </div>
              </div>
              <div className="account-card-actions" onClick={e => e.stopPropagation()}>
                <button className="btn-edit" onClick={e => startEdit(e, account.id, account.name, account.cashBalance)}>Edit</button>
                <button className="btn-delete-sm" onClick={() => setConfirmDelete(account.id)}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Delete Account?</h3>
            <p>This will permanently delete the account and all its holdings, options, and trade history.</p>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => { deleteAccount(confirmDelete!); setConfirmDelete(null); }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
