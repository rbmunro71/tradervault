import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store/useStore';

export default function AddStock() {
  const navigate = useNavigate();
  const { accountId, stockId } = useParams<{ accountId: string; stockId?: string }>();

  const addStock = useStore(s => s.addStock);
  const updateStock = useStore(s => s.updateStock);
  const setTradingFee = useStore(s => s.setTradingFee);
  const savedFee = useStore(s => s.tradingFee);
  const stocks = useStore(s => accountId ? s.stocks[accountId] ?? [] : []);

  const existing = stockId ? stocks.find(s => s.id === stockId) : undefined;
  const isEdit = !!existing;

  const [symbol, setSymbol] = useState('');
  const [shares, setShares] = useState('');
  const [cost, setCost] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [tradingFee, setTradingFeeLocal] = useState('');
  const [alwaysUseFee, setAlwaysUseFee] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (existing) {
      setSymbol(existing.symbol);
      setShares(existing.shares_owned.toString());
      setCost(existing.avg_cost_per_share.toString());
      setDate(existing.date_bought);
      setNotes(existing.notes ?? '');
    }
    if (savedFee > 0) {
      setTradingFeeLocal(savedFee.toFixed(2));
      setAlwaysUseFee(true);
    }
  }, [existing?.id]);

  const fee = parseFloat(tradingFee) || 0;
  const sharesNum = parseFloat(shares) || 0;
  const costNum = parseFloat(cost) || 0;
  const totalInvested = sharesNum * costNum + fee;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || !shares || !cost) { setError('Symbol, shares, and cost are required.'); return; }
    if (sharesNum <= 0 || costNum <= 0) { setError('Shares and cost must be positive numbers.'); return; }
    if (!accountId) { setError('No account selected.'); return; }

    if (alwaysUseFee) setTradingFee(fee);

    if (isEdit && stockId) {
      updateStock(stockId, {
        symbol: symbol.toUpperCase(),
        shares_owned: sharesNum,
        avg_cost_per_share: costNum,
        total_invested: totalInvested,
        date_bought: date,
        notes: notes || undefined,
      });
    } else {
      addStock({
        accountId,
        symbol: symbol.toUpperCase(),
        shares_owned: sharesNum,
        avg_cost_per_share: costNum,
        total_invested: totalInvested,
        date_bought: date,
        notes: notes || undefined,
      });
    }
    navigate(`/${accountId}`);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">{isEdit ? 'Edit Stock' : 'Add Stock'}</h2>
        <button className="btn-ghost" onClick={() => navigate(`/${accountId}`)}>← Back</button>
      </div>
      <form className="card form-card" onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}
        <div className="form-group">
          <label>Symbol</label>
          <input placeholder="e.g. AAPL" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Shares</label>
            <input type="number" step="0.0001" placeholder="e.g. 10" value={shares} onChange={e => setShares(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Avg Cost/Share ($)</label>
            <input type="number" step="0.01" placeholder="e.g. 150.00" value={cost} onChange={e => setCost(e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label>Date Bought</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Notes (optional)</label>
          <textarea placeholder="Any notes about this trade" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        {/* Fee + Total row */}
        <div className="fee-total-row">
          <div className="fee-block">
            <label className="fee-label">Trading Fee ($)</label>
            <input
              className="fee-input"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={tradingFee}
              onChange={e => setTradingFeeLocal(e.target.value)}
            />
            <label className="fee-always">
              <input
                type="checkbox"
                checked={alwaysUseFee}
                onChange={e => setAlwaysUseFee(e.target.checked)}
              />
              Always use this fee
            </label>
          </div>
          <div className="form-summary" style={{ flex: 1, margin: 0 }}>
            <span>Total Invested</span>
            <span>${totalInvested.toFixed(2)}</span>
          </div>
        </div>

        <button type="submit" className="btn-primary btn-full">{isEdit ? 'Save Changes' : 'Add Stock'}</button>
      </form>
    </div>
  );
}
