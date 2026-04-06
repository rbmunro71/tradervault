import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { formatCurrency } from '../utils/formatting';
import type { Stock } from '../types.ts';

interface Props { accountId: string; onHistory: () => void; }

// ── CSV import helpers ────────────────────────────────────────────────────
interface ImportRow {
  symbol: string;
  shares: number;
  total_cost: number;
  avg_cost: number;
  date_bought: string;
  date_sold?: string;
  sell_price?: number;
  notes?: string;
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
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (!cols[0]) continue;

    const symbol = cols[0].toUpperCase().trim();
    const shares = parseFloat(cols[1]);
    const total_cost = parseFloat((cols[2] ?? '').replace(/[$\s]/g, ''));
    const avg_cost = total_cost / shares;
    const date_bought = parseImportDate(cols[3] ?? '');
    const date_sold = cols[4]?.trim() ? parseImportDate(cols[4]) : undefined;
    const sell_price = cols[5]?.trim() ? parseFloat((cols[5]).replace(/[$\s]/g, '')) : undefined;
    const notes = cols[6]?.trim() || undefined;

    if (!symbol || isNaN(shares) || shares <= 0 || isNaN(total_cost)) continue;

    rows.push({ symbol, shares, total_cost, avg_cost, date_bought, date_sold, sell_price, notes });
  }
  return rows;
}

// ── Component ─────────────────────────────────────────────────────────────
export default function Holdings({ accountId, onHistory }: Props) {
  const navigate = useNavigate();
  const stocks = useStore(s => s.stocks[accountId] ?? []);
  const prices = useStore(s => s.prices);
  const tradingFee = useStore(s => s.tradingFee);
  const closeStockPosition = useStore(s => s.closeStockPosition);
  const deleteStock = useStore(s => s.deleteStock);
  const importStocksBatch = useStore(s => s.importStocksBatch);

  const today = new Date().toISOString().split('T')[0];
  const [sellModal, setSellModal] = useState<Stock | null>(null);
  const [sellPrice, setSellPrice] = useState('');
  const [sellDate, setSellDate] = useState(today);
  const [sellFee, setSellFee] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<Stock | null>(null);

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importParseError, setImportParseError] = useState('');
  const [importDone, setImportDone] = useState(false);

  const openRows = importRows.filter(r => !r.date_sold);
  const closedRows = importRows.filter(r => !!r.date_sold);

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
        setImportParseError('No data rows found. Make sure the file matches the stocks template format.');
      } else {
        setImportRows(rows);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    const items = importRows.map(r => {
      if (r.date_sold) {
        const exitPrice = r.sell_price ?? r.avg_cost;
        return {
          closedTrade: {
            accountId,
            symbol: r.symbol,
            trade_type: 'STOCK' as const,
            direction: 'BUY' as const,
            quantity: r.shares,
            entry_price: r.avg_cost,
            exit_price: exitPrice,
            realized_pl: (exitPrice - r.avg_cost) * r.shares,
            date_opened: r.date_bought,
            date_closed: r.date_sold,
            notes: r.notes,
          },
        };
      }

      return {
        stock: {
          accountId,
          symbol: r.symbol,
          shares_owned: r.shares,
          avg_cost_per_share: r.avg_cost,
          total_invested: r.total_cost,
          date_bought: r.date_bought,
          notes: r.notes,
        },
      };
    });

    importStocksBatch(accountId, items);
    setImportDone(true);
  };

  const closeImportModal = () => {
    setShowImport(false);
    setImportRows([]);
    setImportParseError('');
    setImportDone(false);
  };

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
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn-primary btn-sm" onClick={() => navigate(`/${accountId}/add-stock`)}>+ Add</button>
          <button className="btn-ghost btn-sm" onClick={() => setShowImport(true)}>Import CSV</button>
        </div>
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

      {/* ── Import CSV Modal ── */}
      {showImport && (
        <div className="modal-overlay" onClick={closeImportModal}>
          <div className="modal modal-wide" style={{ maxHeight: '80dvh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            {!importDone ? (
              <>
                <h3>Import Stocks from CSV</h3>
                <p style={{ marginBottom: 10 }}>Upload your stocks template CSV. Rows with a sell date go to history; rows without go to open holdings.</p>

                <a
                  href={`${import.meta.env.BASE_URL}stocks-template.csv`}
                  download="stocks-template.csv"
                  style={{ display: 'inline-block', fontSize: 13, marginBottom: 14, color: '#1976d2' }}
                >
                  Download template CSV
                </a>

                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  onChange={handleFileChange}
                  style={{ marginBottom: 12, display: 'block', fontSize: 14 }}
                />

                {importParseError && <div className="form-error" style={{ marginBottom: 12 }}>{importParseError}</div>}

                {importRows.length > 0 && (
                  <>
                    {openRows.length > 0 && (
                      <>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Open Holdings ({openRows.length})</div>
                        <table className="import-table">
                          <thead><tr><th>Ticker</th><th>Shares</th><th>Total Cost</th><th>Avg/Share</th><th>Bought</th><th>Notes</th></tr></thead>
                          <tbody>
                            {openRows.map((r, i) => (
                              <tr key={i}>
                                <td>{r.symbol}</td>
                                <td>{r.shares}</td>
                                <td>{formatCurrency(r.total_cost)}</td>
                                <td>{formatCurrency(r.avg_cost)}</td>
                                <td>{r.date_bought}</td>
                                <td>{r.notes ?? '—'}</td>
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
                          <thead><tr><th>Ticker</th><th>Shares</th><th>Avg Cost</th><th>Sell Price</th><th>Bought</th><th>Sold</th><th>P&L</th></tr></thead>
                          <tbody>
                            {closedRows.map((r, i) => {
                              const exitPrice = r.sell_price ?? r.avg_cost;
                              const pl = (exitPrice - r.avg_cost) * r.shares;
                              return (
                                <tr key={i}>
                                  <td>{r.symbol}</td>
                                  <td>{r.shares}</td>
                                  <td>{formatCurrency(r.avg_cost)}</td>
                                  <td>{formatCurrency(exitPrice)}</td>
                                  <td>{r.date_bought}</td>
                                  <td>{r.date_sold}</td>
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
                  {openRows.length} holding{openRows.length !== 1 ? 's' : ''} and {closedRows.length} history record{closedRows.length !== 1 ? 's' : ''} imported successfully.
                </p>
                <button className="btn-primary btn-full" onClick={closeImportModal}>Done</button>
              </>
            )}
          </div>
        </div>
      )}

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
