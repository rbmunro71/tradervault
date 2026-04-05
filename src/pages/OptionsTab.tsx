import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { formatCurrency } from '../utils/formatting';
import type { TradeOption } from '../types.ts';

interface Props { accountId: string; onHistory: () => void; }

// ── CSV import helpers ────────────────────────────────────────────────────
interface ImportRow {
  symbol: string;
  contracts: number;
  direction: 'BUY' | 'SELL';
  option_type: 'CALL' | 'PUT';
  premium_paid: number;
  date_opened: string;
  expiration_date: string;
  date_closed?: string;
}

function parseImportDate(d: string): string {
  const parts = d.trim().split('/');
  if (parts.length !== 3) return d.trim();
  const [m, day, yr] = parts;
  const year = yr.length === 2 ? `20${yr}` : yr;
  return `${year}-${m.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseCsvImport(text: string): ImportRow[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const headerIdx = lines.findIndex(l => /^ticker/i.test(l));
  if (headerIdx === -1) return [];

  const rows: ImportRow[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    // Simple CSV split (these rows don't contain quoted commas)
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (!cols[0]) continue;

    const symbol = cols[0].toUpperCase().trim();
    const contracts = parseInt(cols[1]);
    const direction: 'BUY' | 'SELL' = cols[2]?.toLowerCase() === 'buy' ? 'BUY' : 'SELL';
    const option_type: 'CALL' | 'PUT' = cols[3]?.toLowerCase() === 'call' ? 'CALL' : 'PUT';
    const premium_paid = parseFloat((cols[4] ?? '').replace(/[$\s]/g, ''));
    const date_opened = parseImportDate(cols[5] ?? '');
    const expiration_date = parseImportDate(cols[6] ?? '');
    const date_closed = cols[7]?.trim() ? parseImportDate(cols[7]) : undefined;

    if (!symbol || isNaN(contracts) || contracts <= 0 || isNaN(premium_paid)) continue;

    rows.push({ symbol, contracts, direction, option_type, premium_paid, date_opened, expiration_date, date_closed });
  }
  return rows;
}

// ── Component ─────────────────────────────────────────────────────────────
export default function OptionsTab({ accountId, onHistory }: Props) {
  const navigate = useNavigate();
  const options = useStore(s => s.options[accountId] ?? []);
  const prices = useStore(s => s.prices);
  const optionFee = useStore(s => s.optionFee);
  const closeOption = useStore(s => s.closeOption);
  const deleteOption = useStore(s => s.deleteOption);
  const importOptionsBatch = useStore(s => s.importOptionsBatch);

  const today = new Date().toISOString().split('T')[0];
  const [closeModal, setCloseModal] = useState<TradeOption | null>(null);
  const [closePremium, setClosePremium] = useState('');
  const [closeDate, setCloseDate] = useState(today);
  const [closeFee, setCloseFee] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<TradeOption | null>(null);

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importParseError, setImportParseError] = useState('');
  const [importDone, setImportDone] = useState(false);

  const openRows  = importRows.filter(r => !r.date_closed);
  const closedRows = importRows.filter(r => !!r.date_closed);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportParseError('');
    setImportRows([]);
    setImportDone(false);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const rows = parseCsvImport(text);
      if (rows.length === 0) {
        setImportParseError('No data rows found. Make sure the file matches the Macros template format.');
      } else {
        setImportRows(rows);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    const items = importRows.map(r => {
      const totalCost = r.premium_paid * r.contracts * 100;
      const option = {
        accountId,
        symbol: r.symbol,
        option_type: r.option_type,
        direction: r.direction,
        strike_price: 0,
        contracts: r.contracts,
        premium_paid: r.premium_paid,
        expiration_date: r.expiration_date,
        date_opened: r.date_opened,
        total_cost: totalCost,
        notes: 'Imported via CSV — strike price unknown, please edit to update.',
        ...(r.date_closed ? { date_closed: r.date_closed, premium_closed: 0 } : {}),
      };

      const closedTrade = r.date_closed ? {
        accountId,
        symbol: r.symbol,
        trade_type: 'OPTION' as const,
        direction: r.direction,
        quantity: r.contracts,
        entry_price: r.premium_paid,
        exit_price: 0,
        realized_pl: r.direction === 'SELL' ? totalCost : -totalCost,
        date_opened: r.date_opened,
        date_closed: r.date_closed!,
        notes: 'Imported via CSV — assumed expired worthless (close date = expiration date).',
      } : undefined;

      return { option, closedTrade };
    });

    importOptionsBatch(accountId, items);
    setImportDone(true);
  };

  const closeImportModal = () => {
    setShowImport(false);
    setImportRows([]);
    setImportParseError('');
    setImportDone(false);
  };

  const openCloseModal = (opt: TradeOption) => {
    setCloseModal(opt);
    setClosePremium('');
    setCloseDate(today);
    setCloseFee(optionFee > 0 ? optionFee.toFixed(2) : '');
  };

  const getDaysToExp = (expDate: string) => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const exp = new Date(expDate + 'T00:00:00');
    return Math.ceil((exp.getTime() - now.getTime()) / 86400000);
  };

  const handleClose = () => {
    if (!closeModal) return;
    const premium = parseFloat(closePremium);
    if (isNaN(premium) || premium < 0) return;
    const fee = parseFloat(closeFee) || 0;
    closeOption(closeModal.id, accountId, premium, closeDate, fee);
    setCloseModal(null);
  };

  const closeNetPL = () => {
    if (!closeModal) return null;
    const p = parseFloat(closePremium);
    if (isNaN(p)) return null;
    const f = parseFloat(closeFee) || 0;
    const totalPaid = closeModal.premium_paid * closeModal.contracts * 100;
    const totalClosed = p * closeModal.contracts * 100;
    const feeTotal = f * closeModal.contracts;
    return closeModal.direction === 'BUY'
      ? totalClosed - totalPaid - feeTotal
      : totalPaid - totalClosed - feeTotal;
  };

  return (
    <div className="tab-content">
      <div className="positions-header">
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn-primary btn-sm" onClick={() => navigate(`/${accountId}/add-option`)}>+ Add</button>
          <button className="btn-ghost btn-sm" onClick={() => setShowImport(true)}>Import CSV</button>
        </div>
        <span className="positions-label">Current Positions <span className="positions-count">({options.length})</span></span>
        <button className="history-link" onClick={onHistory}>History →</button>
      </div>

      {options.length === 0 && <div className="empty-state">No open options. Tap + Add to track one.</div>}

      {options.map(opt => {
        const days = getDaysToExp(opt.expiration_date);
        const isExpired = days < 0;
        const isExpiringSoon = days >= 0 && days <= 7;
        const currentPrice = prices[opt.symbol]?.price;
        const contractTotal = opt.contracts * 100;
        const totalPremium = opt.contracts * 100 * opt.premium_paid;

        return (
          <div key={opt.id} className={`option-card ${isExpired ? 'card-expired' : isExpiringSoon ? 'card-warning' : ''}`}>
            <div className="option-row1">
              <span className="opt-symbol">{opt.symbol}</span>
              <span className={`option-badge ${opt.direction === 'BUY' ? 'badge-buy' : 'badge-sell'}`}>{opt.direction}</span>
              <span className={`option-badge ${opt.option_type === 'CALL' ? 'badge-call' : 'badge-put'}`}>{opt.option_type}</span>
              <span className="opt-field-label">Current Price</span>
              <span className="opt-field-val">{currentPrice ? formatCurrency(currentPrice) : '—'}</span>
              <span className="opt-field-label">Strike</span>
              <span className="opt-field-val opt-strike">{opt.strike_price > 0 ? formatCurrency(opt.strike_price) : '—'}</span>
            </div>
            <div className="option-row2">
              <div className="ostat"><span className="ostat-label">Contracts</span><span className="ostat-val">{opt.contracts}</span></div>
              <div className="ostat"><span className="ostat-label">Premium/Share</span><span className="ostat-val">{formatCurrency(opt.premium_paid)}</span></div>
              <div className="ostat"><span className="ostat-label">Contract Total</span><span className="ostat-val">{contractTotal} shares</span></div>
              <div className="ostat"><span className="ostat-label">Total Premium</span><span className="ostat-val">{formatCurrency(totalPremium)}</span></div>
            </div>
            <div className="option-row3">
              <span>Opened: {opt.date_opened}</span>
              <span className={isExpired ? 'red' : isExpiringSoon ? 'orange' : ''}>
                Exp: {opt.expiration_date}{!isExpired && ` (${days}d)`}{isExpired && ' (EXPIRED)'}
              </span>
              {opt.notes && <span className="holding-notes">{opt.notes}</span>}
              <div className="holding-actions">
                <button className="hbtn hbtn-close" onClick={() => openCloseModal(opt)}>Close</button>
                <button className="hbtn hbtn-edit" onClick={() => navigate(`/${accountId}/edit-option/${opt.id}`)}>Edit</button>
                <button className="hbtn hbtn-del" onClick={() => setDeleteConfirm(opt)}>Delete</button>
              </div>
            </div>
          </div>
        );
      })}

      {/* ── Import CSV Modal ── */}
      {showImport && (
        <div className="modal-overlay" onClick={closeImportModal}>
          <div className="modal modal-wide" style={{ maxHeight: '80dvh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            {!importDone ? (
              <>
                <h3>Import Options from CSV</h3>
                <p style={{ marginBottom: 14 }}>Upload your Macros template CSV file. Rows with a close date go to history; rows without go to open positions.</p>

                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  style={{ marginBottom: 12, display: 'block', fontSize: 14 }}
                />

                {importParseError && <div className="form-error" style={{ marginBottom: 12 }}>{importParseError}</div>}

                {importRows.length > 0 && (
                  <>
                    <div style={{ fontSize: 12, color: '#f57c00', marginBottom: 12, lineHeight: 1.5 }}>
                      Note: Strike price is not in the CSV and will be set to 0. Edit each position after importing to add the correct strike.
                      Closed options with close date = expiration date are assumed to have expired worthless (P&L = full premium kept).
                    </div>

                    {openRows.length > 0 && (
                      <>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Open Positions ({openRows.length})</div>
                        <table className="import-table">
                          <thead><tr><th>Ticker</th><th>Dir</th><th>Type</th><th>Contracts</th><th>Premium</th><th>Opened</th><th>Exp.</th></tr></thead>
                          <tbody>
                            {openRows.map((r, i) => (
                              <tr key={i}>
                                <td>{r.symbol}</td>
                                <td>{r.direction}</td>
                                <td>{r.option_type}</td>
                                <td>{r.contracts}</td>
                                <td>{formatCurrency(r.premium_paid)}</td>
                                <td>{r.date_opened}</td>
                                <td>{r.expiration_date}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}

                    {closedRows.length > 0 && (
                      <>
                        <div style={{ fontWeight: 700, fontSize: 13, margin: '12px 0 6px' }}>History / Closed ({closedRows.length})</div>
                        <table className="import-table">
                          <thead><tr><th>Ticker</th><th>Dir</th><th>Type</th><th>Contracts</th><th>Premium</th><th>Opened</th><th>Closed</th><th>P&L</th></tr></thead>
                          <tbody>
                            {closedRows.map((r, i) => {
                              const pl = r.direction === 'SELL'
                                ? r.premium_paid * r.contracts * 100
                                : -(r.premium_paid * r.contracts * 100);
                              return (
                                <tr key={i}>
                                  <td>{r.symbol}</td>
                                  <td>{r.direction}</td>
                                  <td>{r.option_type}</td>
                                  <td>{r.contracts}</td>
                                  <td>{formatCurrency(r.premium_paid)}</td>
                                  <td>{r.date_opened}</td>
                                  <td>{r.date_closed}</td>
                                  <td style={{ color: pl >= 0 ? '#4caf50' : '#f44336' }}>{pl >= 0 ? '+' : ''}{formatCurrency(pl)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </>
                    )}
                  </>
                )}

                <div className="modal-actions" style={{ marginTop: 16 }}>
                  <button className="btn-ghost" onClick={closeImportModal}>Cancel</button>
                  <button
                    className="btn-primary"
                    onClick={handleConfirmImport}
                    disabled={importRows.length === 0}
                  >
                    Import {importRows.length > 0 ? `${importRows.length} Records` : ''}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>Import Complete</h3>
                <p style={{ margin: '12px 0' }}>
                  {openRows.length} open position{openRows.length !== 1 ? 's' : ''} and {closedRows.length} history record{closedRows.length !== 1 ? 's' : ''} imported successfully.
                </p>
                <p style={{ fontSize: 13, color: '#757575', marginBottom: 16 }}>
                  Tap Edit on any imported position to add the correct strike price.
                </p>
                <button className="btn-primary btn-full" onClick={closeImportModal}>Done</button>
              </>
            )}
          </div>
        </div>
      )}

      {closeModal && (
        <div className="modal-overlay" onClick={() => setCloseModal(null)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <h3>Close {closeModal.symbol} {closeModal.option_type}</h3>
            <p>{closeModal.direction} · {closeModal.contracts} contracts · opened {formatCurrency(closeModal.premium_paid)}/share</p>
            <div className="close-form">
              <div className="close-field">
                <label>Closing Premium / Share</label>
                <input type="number" step="0.01" placeholder="e.g. 1.50" value={closePremium}
                  onChange={e => setClosePremium(e.target.value)} autoFocus />
              </div>
              <div className="close-field">
                <label>Date Closed</label>
                <input type="date" value={closeDate} onChange={e => setCloseDate(e.target.value)} />
              </div>
              <div className="close-field">
                <label>Option Fee / Contract ($)</label>
                <input type="number" step="0.01" placeholder="0.00" value={closeFee}
                  onChange={e => setCloseFee(e.target.value)} />
              </div>
            </div>
            {closeNetPL() !== null && (
              <div className={`close-preview ${closeNetPL()! >= 0 ? 'preview-green' : 'preview-red'}`}>
                Net P&L: {closeNetPL()! >= 0 ? '+' : ''}{formatCurrency(closeNetPL()!)}
              </div>
            )}
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setCloseModal(null)}>Cancel</button>
              <button className="btn-warning" onClick={handleClose} disabled={closePremium === ''}>Close Position</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Delete {deleteConfirm.symbol} {deleteConfirm.option_type}?</h3>
            <p>Removes the position without recording a closed trade.</p>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => { deleteOption(deleteConfirm.id, accountId); setDeleteConfirm(null); }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
