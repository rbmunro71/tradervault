import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store/useStore';

export default function AddOption() {
  const navigate = useNavigate();
  const { accountId, optionId } = useParams<{ accountId: string; optionId?: string }>();

  const addOption = useStore(s => s.addOption);
  const updateOption = useStore(s => s.updateOption);
  const setOptionFeeStore = useStore(s => s.setOptionFee);
  const savedFee = useStore(s => s.optionFee);
  const options = useStore(s => accountId ? s.options[accountId] ?? [] : []);

  const existing = optionId ? options.find(o => o.id === optionId) : undefined;
  const isEdit = !!existing;

  const [symbol, setSymbol] = useState('');
  const [optionType, setOptionType] = useState<'CALL' | 'PUT'>('CALL');
  const [direction, setDirection] = useState<'BUY' | 'SELL'>('SELL');
  const [strike, setStrike] = useState('');
  const [contracts, setContracts] = useState('');
  const [premium, setPremium] = useState('');
  const [dateOpened, setDateOpened] = useState(new Date().toISOString().split('T')[0]);
  const [expirationDate, setExpirationDate] = useState('');
  const [notes, setNotes] = useState('');
  const [optionFee, setOptionFeeLocal] = useState('');
  const [alwaysUseFee, setAlwaysUseFee] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (existing) {
      setSymbol(existing.symbol);
      setOptionType(existing.option_type);
      setDirection(existing.direction);
      setStrike(existing.strike_price.toString());
      setContracts(existing.contracts.toString());
      setPremium(existing.premium_paid.toString());
      setDateOpened(existing.date_opened);
      setExpirationDate(existing.expiration_date);
      setNotes(existing.notes ?? '');
    }
    if (savedFee > 0) {
      setOptionFeeLocal(savedFee.toFixed(2));
      setAlwaysUseFee(true);
    }
  }, [existing?.id]);

  const contractsNum = parseInt(contracts) || 0;
  const premiumNum = parseFloat(premium) || 0;
  const fee = parseFloat(optionFee) || 0;
  // Total premium gross
  const grossPremium = contractsNum * 100 * premiumNum;
  // Fee total = fee per contract × number of contracts
  const feeTotal = fee * contractsNum;
  // SELL: you receive premium minus fee; BUY: you pay premium plus fee
  const totalCost = direction === 'SELL'
    ? grossPremium - feeTotal
    : grossPremium + feeTotal;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || !strike || !contracts || !premium || !expirationDate) {
      setError('All fields are required.'); return;
    }
    const strikeNum = parseFloat(strike);
    if (isNaN(strikeNum) || contractsNum <= 0 || isNaN(premiumNum)) {
      setError('Strike, contracts, and premium must be valid numbers.'); return;
    }
    if (new Date(expirationDate) <= new Date(dateOpened)) {
      setError('Expiration must be after open date.'); return;
    }
    if (!accountId) { setError('No account selected.'); return; }

    if (alwaysUseFee) setOptionFeeStore(fee);

    const data = {
      symbol: symbol.toUpperCase(),
      option_type: optionType,
      direction,
      strike_price: strikeNum,
      contracts: contractsNum,
      premium_paid: premiumNum,
      expiration_date: expirationDate,
      date_opened: dateOpened,
      total_cost: totalCost,
      notes: notes || undefined,
    };

    if (isEdit && optionId) {
      updateOption(optionId, data);
    } else {
      addOption({ accountId, ...data });
    }
    navigate(`/${accountId}`);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">{isEdit ? 'Edit Option' : 'Add Option'}</h2>
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
            <label>Type</label>
            <select value={optionType} onChange={e => setOptionType(e.target.value as 'CALL' | 'PUT')}>
              <option value="CALL">CALL</option>
              <option value="PUT">PUT</option>
            </select>
          </div>
          <div className="form-group">
            <label>Direction</label>
            <select value={direction} onChange={e => setDirection(e.target.value as 'BUY' | 'SELL')}>
              <option value="SELL">SELL</option>
              <option value="BUY">BUY</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Strike Price ($)</label>
          <input type="number" step="0.01" placeholder="e.g. 150.00" value={strike} onChange={e => setStrike(e.target.value)} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Contracts</label>
            <input type="number" min="1" placeholder="e.g. 5" value={contracts} onChange={e => setContracts(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Premium/Share ($)</label>
            <input type="number" step="0.01" placeholder="e.g. 1.50" value={premium} onChange={e => setPremium(e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Date Opened</label>
            <input type="date" value={dateOpened} onChange={e => setDateOpened(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Expiration Date</label>
            <input type="date" value={expirationDate} onChange={e => setExpirationDate(e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label>Notes (optional)</label>
          <textarea placeholder="Any notes" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        {/* Fee + Total row */}
        <div className="fee-total-row">
          <div className="fee-block">
            <label className="fee-label">Option Fee / Contract ($)</label>
            <input
              className="fee-input"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={optionFee}
              onChange={e => setOptionFeeLocal(e.target.value)}
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
          <div className="fee-summary">
            <div className="form-summary" style={{ margin: 0 }}>
              <span>{direction === 'SELL' ? 'Net Premium' : 'Total Cost'}</span>
              <span style={{ color: direction === 'SELL' ? '#4caf50' : '#f44336' }}>${totalCost.toFixed(2)}</span>
            </div>
            {feeTotal > 0 && (
              <div style={{ fontSize: 11, color: '#9e9e9e', marginTop: 4, textAlign: 'right' }}>
                Fee: {direction === 'SELL' ? '-' : '+'}${feeTotal.toFixed(2)} ({contractsNum} contract{contractsNum !== 1 ? 's' : ''})
              </div>
            )}
          </div>
        </div>

        <button type="submit" className="btn-primary btn-full">{isEdit ? 'Save Changes' : 'Add Option'}</button>
      </form>
    </div>
  );
}
