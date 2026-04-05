import { useState } from 'react';
import { useStore } from '../store/useStore';
import { formatCurrency } from '../utils/formatting';
import type { CashTransaction } from '../types.ts';

interface Props { accountId: string; }

const TYPE_LABELS: Record<CashTransaction['type'], string> = {
  DEPOSIT: 'Deposit', WITHDRAW: 'Withdrawal', INTEREST: 'Interest',
};

export default function CashTab({ accountId }: Props) {
  const accounts = useStore(s => s.accounts);
  const cashTransactions = useStore(s => s.cashTransactions[accountId] ?? []);
  const addCashEntry = useStore(s => s.addCashEntry);
  const editCashTx = useStore(s => s.editCashTx);
  const removeCashTx = useStore(s => s.removeCashTx);

  const account = accounts.find(a => a.id === accountId);
  const cashBalance = account?.cashBalance ?? 0;

  const [type, setType] = useState<CashTransaction['type']>('DEPOSIT');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [editTx, setEditTx] = useState<CashTransaction | null>(null);
  const [editFields, setEditFields] = useState<Partial<CashTransaction>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<CashTransaction | null>(null);

  const handleSave = () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) { setError('Enter a valid amount.'); return; }
    setError('');
    addCashEntry(accountId, type, num, date, notes || undefined);
    setAmount(''); setNotes('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const openEdit = (tx: CashTransaction) => {
    setEditTx(tx);
    setEditFields({ type: tx.type, amount: tx.amount, date: tx.date, notes: tx.notes });
  };

  const saveEdit = () => {
    if (!editTx) return;
    // Reverse old balance effect, apply new
    const oldDelta = editTx.type === 'WITHDRAW' ? -Math.abs(editTx.amount) : Math.abs(editTx.amount);
    const newAmount = Number(editFields.amount) || editTx.amount;
    const newType = (editFields.type as CashTransaction['type']) ?? editTx.type;
    const newDelta = newType === 'WITHDRAW' ? -Math.abs(newAmount) : Math.abs(newAmount);
    editCashTx(editTx.id, accountId, { type: newType, amount: newAmount, date: editFields.date ?? editTx.date, notes: editFields.notes });
    // Adjust balance for difference
    const diff = newDelta - oldDelta;
    if (diff !== 0) {
      const acct = accounts.find(a => a.id === accountId);
      if (acct) {
        const { updateAccount } = useStore.getState();
        updateAccount(accountId, { cashBalance: acct.cashBalance + diff });
      }
    }
    setEditTx(null);
  };

  const totalDeposited = cashTransactions.filter(t => t.type === 'DEPOSIT').reduce((s, t) => s + t.amount, 0);
  const totalWithdrawn = cashTransactions.filter(t => t.type === 'WITHDRAW').reduce((s, t) => s + t.amount, 0);
  const totalInterest = cashTransactions.filter(t => t.type === 'INTEREST').reduce((s, t) => s + t.amount, 0);

  return (
    <div className="tab-content">
      <div className="cash-balance-card">
        <div className="cash-balance-label">Cash Balance</div>
        <div className="cash-balance-val">{formatCurrency(cashBalance)}</div>
        <div className="cash-balance-stats">
          <div className="cash-stat"><span className="cash-stat-label">Deposited</span><span className="cash-stat-val green">{formatCurrency(totalDeposited)}</span></div>
          <div className="cash-stat"><span className="cash-stat-label">Withdrawn</span><span className="cash-stat-val red">{formatCurrency(totalWithdrawn)}</span></div>
          <div className="cash-stat"><span className="cash-stat-label">Interest</span><span className="cash-stat-val green">{formatCurrency(totalInterest)}</span></div>
        </div>
      </div>

      <div className="cash-form-card">
        <div className="cash-type-row">
          {(['DEPOSIT', 'WITHDRAW', 'INTEREST'] as CashTransaction['type'][]).map(t => (
            <button key={t} className={`cash-type-btn ${type === t ? 'active' : ''}`} onClick={() => setType(t)}>
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        {error && <div className="form-error" style={{ margin: '8px 0 0' }}>{error}</div>}
        <div className="cash-input-row">
          <div className="cash-field">
            <label>Amount ($)</label>
            <input type="number" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div className="cash-field">
            <label>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
        <div className="cash-field" style={{ marginTop: 8 }}>
          <label>Notes (optional)</label>
          <input placeholder="e.g. wire transfer, dividend" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
          <button className="btn-primary" style={{ flex: 1 }} onClick={handleSave}>Save</button>
          {saved && <span style={{ fontSize: 12, color: '#4caf50' }}>Saved!</span>}
        </div>
      </div>

      <div className="tab-content-header" style={{ marginTop: 16 }}>
        <span>Cash History ({cashTransactions.length})</span>
      </div>

      {cashTransactions.length === 0 && <div className="empty-state" style={{ paddingTop: 24 }}>No cash entries yet.</div>}

      {cashTransactions.map(tx => (
        <div key={tx.id} className="cash-tx-row">
          <div className="cash-tx-left">
            <span className={`cash-tx-badge ${tx.type === 'WITHDRAW' ? 'badge-withdraw' : 'badge-deposit'}`}>
              {TYPE_LABELS[tx.type]}
            </span>
            <span className="cash-tx-date">{tx.date}</span>
            {tx.notes && <span className="cash-tx-notes">{tx.notes}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`cash-tx-amount ${tx.type === 'WITHDRAW' ? 'red' : 'green'}`}>
              {tx.type === 'WITHDRAW' ? '-' : '+'}{formatCurrency(tx.amount)}
            </span>
            <button className="hbtn hbtn-edit" onClick={() => openEdit(tx)}>Edit</button>
            <button className="hbtn hbtn-del" onClick={() => setDeleteConfirm(tx)}>Del</button>
          </div>
        </div>
      ))}

      {editTx && (
        <div className="modal-overlay" onClick={() => setEditTx(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Edit Transaction</h3>
            <div className="close-form">
              <div className="close-field">
                <label>Type</label>
                <select value={editFields.type} onChange={e => setEditFields(p => ({ ...p, type: e.target.value as CashTransaction['type'] }))}>
                  <option value="DEPOSIT">Deposit</option>
                  <option value="WITHDRAW">Withdrawal</option>
                  <option value="INTEREST">Interest</option>
                </select>
              </div>
              <div className="close-field">
                <label>Amount ($)</label>
                <input type="number" step="0.01" value={editFields.amount ?? ''} onChange={e => setEditFields(p => ({ ...p, amount: Number(e.target.value) }))} />
              </div>
              <div className="close-field">
                <label>Date</label>
                <input type="date" value={editFields.date ?? ''} onChange={e => setEditFields(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div className="close-field" style={{ gridColumn: '1 / -1' }}>
                <label>Notes</label>
                <input value={editFields.notes ?? ''} onChange={e => setEditFields(p => ({ ...p, notes: e.target.value }))} placeholder="optional" />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setEditTx(null)}>Cancel</button>
              <button className="btn-primary" onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Delete Transaction?</h3>
            <p>{TYPE_LABELS[deleteConfirm.type]} · {formatCurrency(deleteConfirm.amount)} · {deleteConfirm.date}</p>
            <p>This will also reverse the balance adjustment.</p>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => { removeCashTx(deleteConfirm.id, accountId, deleteConfirm.amount, deleteConfirm.type); setDeleteConfirm(null); }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
