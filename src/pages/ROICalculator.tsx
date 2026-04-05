import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { calculateOptionsROI } from '../utils/calculations';
import { formatCurrency, formatPercent } from '../utils/formatting';
import type { ROICalculationResult } from '../types.ts';

export default function ROICalculator() {
  const navigate = useNavigate();
  const [strike, setStrike] = useState('');
  const [contracts, setContracts] = useState('');
  const [premium, setPremium] = useState('');
  const [dateOpened, setDateOpened] = useState(new Date().toISOString().split('T')[0]);
  const [expirationDate, setExpirationDate] = useState('');
  const [result, setResult] = useState<ROICalculationResult | null>(null);
  const [error, setError] = useState('');

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!strike || !contracts || !premium || !expirationDate) { setError('All fields are required.'); return; }
    if (new Date(expirationDate) <= new Date(dateOpened)) { setError('Expiration must be after open date.'); return; }
    setError('');
    setResult(calculateOptionsROI(parseFloat(strike), parseInt(contracts), parseFloat(premium), dateOpened, expirationDate));
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">ROI Calculator</h2>
        <button className="btn-ghost" onClick={() => navigate(-1)}>← Back</button>
      </div>
      <form className="card form-card" onSubmit={handleCalculate}>
        {error && <div className="form-error">{error}</div>}
        <div className="form-group">
          <label>Strike Price ($)</label>
          <input type="number" step="0.01" placeholder="e.g. 100" value={strike} onChange={e => setStrike(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Number of Contracts</label>
          <input type="number" placeholder="e.g. 5" value={contracts} onChange={e => setContracts(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Premium Received (per share)</label>
          <input type="number" step="0.01" placeholder="e.g. 1.50" value={premium} onChange={e => setPremium(e.target.value)} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Trade Open Date</label>
            <input type="date" value={dateOpened} onChange={e => setDateOpened(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Expiration Date</label>
            <input type="date" value={expirationDate} onChange={e => setExpirationDate(e.target.value)} />
          </div>
        </div>
        <button type="submit" className="btn-primary btn-full">Calculate ROI</button>
      </form>

      {result && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 16, color: '#212121' }}>ROI Analysis</h3>
          <div className="data-row"><span>Days to Expiration</span><span>{result.days_to_expiration}</span></div>
          <div className="data-row"><span>Capital at Risk</span><span>{formatCurrency(result.capital_at_risk)}</span></div>
          <div className="data-row"><span>Total Premium Collected</span><span>{formatCurrency(result.total_premium_collected)}</span></div>
          <hr style={{ border: 'none', borderTop: '1px solid #e0e0e0', margin: '8px 0' }} />
          <div className="data-row">
            <span>Annualized ROI on Capital</span>
            <span style={{ color: '#1976d2', fontWeight: 700, fontSize: 16 }}>{formatPercent(result.roi_on_capital)}</span>
          </div>
          <div className="data-row"><span>ROI on Capital (not annualized)</span><span>{formatPercent(result.roi_on_premium)}</span></div>
          <p style={{ fontSize: 12, color: '#999', marginTop: 12, fontStyle: 'italic' }}>
            Annualized ROI assumes position expires worthless (max profit scenario).
          </p>
        </div>
      )}
    </div>
  );
}
