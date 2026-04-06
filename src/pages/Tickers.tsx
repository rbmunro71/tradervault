import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import type { TickerMapping } from '../types.ts';
import type { ApiServiceId } from '../types.ts';

// ── Service definitions ────────────────────────────────────────────────────
const SERVICES: { id: ApiServiceId; label: string; url: string }[] = [
  { id: 'alphavantage', label: 'Alpha Vantage', url: 'https://www.alphavantage.co/support/#api-key' },
  { id: 'polygon',      label: 'Polygon.io',    url: 'https://polygon.io/dashboard/signup'          },
  { id: 'finnhub',      label: 'Finnhub',       url: 'https://finnhub.io/register'                  },
  { id: 'iex',          label: 'IEX Cloud',     url: 'https://iexcloud.io/cloud-login#/register'    },
];

// ── API fetch helpers ──────────────────────────────────────────────────────
async function fetchFromService(
  symbol: string,
  service: ApiServiceId,
  apiKey: string,
): Promise<{ price: number; open?: number; close?: number } | null> {
  try {
    if (service === 'alphavantage') {
      const res = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`
      );
      const data = await res.json();
      const q = data?.['Global Quote'];
      const price = parseFloat(q?.['05. price']);
      const open  = parseFloat(q?.['02. open']);
      const close = parseFloat(q?.['08. previous close']);
      return isNaN(price) ? null : { price, open: isNaN(open) ? undefined : open, close: isNaN(close) ? undefined : close };
    }
    if (service === 'polygon') {
      const res = await fetch(
        `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}?apiKey=${apiKey}`
      );
      const data = await res.json();
      const day = data?.ticker?.day;
      const prevDay = data?.ticker?.prevDay;
      if (!day?.c) return null;
      return { price: day.c, open: day.o ?? undefined, close: prevDay?.c ?? undefined };
    }
    if (service === 'finnhub') {
      const res = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`
      );
      const data = await res.json();
      if (!data?.c) return null;
      return { price: data.c, open: data.o ?? undefined, close: data.pc ?? undefined };
    }
    if (service === 'iex') {
      const res = await fetch(
        `https://cloud.iexapis.com/stable/stock/${symbol}/quote?token=${apiKey}`
      );
      const data = await res.json();
      if (!data?.latestPrice) return null;
      return { price: data.latestPrice, open: data.open ?? undefined, close: data.close ?? undefined };
    }
    return null;
  } catch { return null; }
}

// ── Google Sheet helpers ───────────────────────────────────────────────────
function parseCell(cell: string): { col: number; row: number } | null {
  const match = cell.toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  const col = match[1].split('').reduce((acc, c) => acc * 26 + c.charCodeAt(0) - 64, 0) - 1;
  const row = parseInt(match[2]) - 1;
  return { col, row };
}

function getCsvUrl(url: string): string {
  if (url.includes('output=csv')) return url;
  const match = url.match(/\/spreadsheets\/d\/([^/]+)/);
  if (!match) return url;
  const gidMatch = url.match(/[#&?]gid=(\d+)/);
  const gid = gidMatch ? `&gid=${gidMatch[1]}` : '';
  return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv${gid}`;
}

async function fetchCsvData(csvUrl: string): Promise<string[][] | null> {
  try {
    const res = await fetch(csvUrl);
    if (!res.ok) return null;
    const text = await res.text();
    return text.split('\n').map(row => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (const ch of row) {
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
        current += ch;
      }
      result.push(current.trim());
      return result;
    });
  } catch { return null; }
}

function getCellValue(csv: string[][], cell: string): number | null {
  const pos = parseCell(cell);
  if (!pos) return null;
  const row = csv[pos.row];
  if (!row) return null;
  const raw = row[pos.col] ?? '';
  const val = parseFloat(raw.replace(/[$,\s]/g, ''));
  return isNaN(val) ? null : val;
}

// ── Component ──────────────────────────────────────────────────────────────
export default function Tickers() {
  const { sheetConfig, saveSheetConfig, getAllActiveTickers, setPrice, prices } = useStore();
  const activeTickers = getAllActiveTickers();

  // Migrate legacy single apiKey to apiKeys map
  const initialApiKeys: Partial<Record<ApiServiceId, string>> = sheetConfig.apiKeys ?? {};
  if (sheetConfig.apiService && sheetConfig.apiKey && !initialApiKeys[sheetConfig.apiService]) {
    initialApiKeys[sheetConfig.apiService] = sheetConfig.apiKey;
  }

  const [apiKeys, setApiKeys] = useState<Partial<Record<ApiServiceId, string>>>(initialApiKeys);
  const [savedKeys, setSavedKeys] = useState<Partial<Record<ApiServiceId, boolean>>>({});

  const [sheetUrl, setSheetUrl]   = useState(sheetConfig.url);
  const [mappings, setMappings]   = useState<TickerMapping[]>(sheetConfig.mappings);
  const [urlSaved, setUrlSaved]   = useState(false);
  const [showSheet, setShowSheet] = useState(false);

  const [fetchStatus, setFetchStatus] = useState<Record<string, 'fetching' | 'ok' | 'error'>>({});
  const [fetchingService, setFetchingService] = useState<ApiServiceId | null>(null);

  // Keep mappings in sync with active tickers
  useEffect(() => {
    const updated = [...mappings];
    let changed = false;
    for (const ticker of activeTickers) {
      if (!updated.find(m => m.symbol === ticker)) {
        updated.push({ symbol: ticker, priceCell: '', openCell: '', closeCell: '' });
        changed = true;
      }
    }
    const filtered = updated.filter(m => activeTickers.includes(m.symbol));
    if (changed || filtered.length !== updated.length) setMappings(filtered);
  }, [activeTickers.join(',')]);

  const updateKey = (id: ApiServiceId, value: string) => {
    setApiKeys(prev => ({ ...prev, [id]: value }));
  };

  const saveKey = (id: ApiServiceId) => {
    const updated = { ...sheetConfig, apiKeys: { ...apiKeys }, apiService: undefined, apiKey: undefined };
    saveSheetConfig(updated);
    setSavedKeys(prev => ({ ...prev, [id]: true }));
    setTimeout(() => setSavedKeys(prev => ({ ...prev, [id]: false })), 2000);
  };

  const saveSheetUrl = () => {
    saveSheetConfig({ ...sheetConfig, url: sheetUrl, mappings });
    setUrlSaved(true);
    setTimeout(() => setUrlSaved(false), 2000);
  };

  const updateMapping = (symbol: string, field: keyof TickerMapping, value: string | number | undefined) => {
    setMappings(prev => prev.map(m => m.symbol === symbol ? { ...m, [field]: value } : m));
  };

  const fetchWithService = async (serviceId: ApiServiceId) => {
    const key = apiKeys[serviceId];
    if (!key) return;

    setFetchingService(serviceId);
    const status: Record<string, 'fetching' | 'ok' | 'error'> = {};
    activeTickers.forEach(t => { status[t] = 'fetching'; });
    setFetchStatus({ ...status });

    for (const ticker of activeTickers) {
      const result = await fetchFromService(ticker, serviceId, key);
      if (result) {
        setPrice(ticker, { symbol: ticker, price: result.price, open: result.open, close: result.close, fetchedAt: Date.now() });
        status[ticker] = 'ok';
      } else {
        status[ticker] = 'error';
      }
      setFetchStatus({ ...status });
    }

    saveSheetConfig({ ...sheetConfig, apiKeys: { ...apiKeys }, url: sheetUrl, mappings });
    setFetchingService(null);
  };

  const fetchFromSheet = async () => {
    if (!sheetUrl) return;
    setFetchingService('alphavantage'); // reuse state just for loading indicator
    const status: Record<string, 'fetching' | 'ok' | 'error'> = {};
    activeTickers.forEach(t => { status[t] = 'fetching'; });
    setFetchStatus({ ...status });

    const csvData = await fetchCsvData(getCsvUrl(sheetUrl));
    for (const ticker of activeTickers) {
      const mapping = mappings.find(m => m.symbol === ticker);
      if (csvData && mapping?.priceCell) {
        const price = getCellValue(csvData, mapping.priceCell);
        if (price !== null) {
          const open  = mapping.openCell  ? getCellValue(csvData, mapping.openCell)  ?? undefined : undefined;
          const close = mapping.closeCell ? getCellValue(csvData, mapping.closeCell) ?? undefined : undefined;
          setPrice(ticker, { symbol: ticker, price, open, close, fetchedAt: Date.now() });
          status[ticker] = 'ok';
        } else {
          status[ticker] = 'error';
        }
      } else {
        status[ticker] = 'error';
      }
      setFetchStatus({ ...status });
    }
    setFetchingService(null);
  };

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const ageMinutes = (ts: number) => Math.floor((Date.now() - ts) / 60000);
  const isBusy = fetchingService !== null;

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Tickers & Prices</h2>
      </div>

      {/* ── API Services ── */}
      <div className="card form-card" style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: '#424242', marginBottom: 14, lineHeight: 1.5 }}>
          Sign up for a free API key from any service below, paste it in, and tap Fetch Data to pull live prices for all your tickers.
        </p>

        <div className="service-rows">
          {SERVICES.map(s => {
            const key = apiKeys[s.id] ?? '';
            const isFetchingThis = fetchingService === s.id;
            return (
              <div key={s.id} className="service-row">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="service-row-label"
                >
                  {s.label}
                </a>
                <input
                  className="service-row-input"
                  placeholder="Paste API key"
                  value={key}
                  onChange={e => updateKey(s.id, e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  onBlur={() => { if (key) saveKey(s.id); }}
                />
                <button
                  className="btn-primary btn-sm"
                  onClick={() => fetchWithService(s.id)}
                  disabled={!key || isBusy || activeTickers.length === 0}
                >
                  {isFetchingThis ? '...' : 'Fetch Data'}
                </button>
                {savedKeys[s.id] && <span style={{ fontSize: 11, color: '#4caf50' }}>Saved</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Google Sheet toggle ── */}
      <div style={{ marginBottom: 12 }}>
        <button
          className="link-btn"
          style={{ fontSize: 13, color: '#757575' }}
          onClick={() => setShowSheet(v => !v)}
        >
          {showSheet ? '▾' : '▸'} Google Sheet (manual cell mapping)
        </button>
      </div>

      {showSheet && (
        <div className="card form-card" style={{ marginBottom: 16 }}>
          <div className="form-group">
            <label>Google Sheet URL</label>
            <input
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetUrl}
              onChange={e => setSheetUrl(e.target.value)}
            />
            <div style={{ fontSize: 12, color: '#757575', marginTop: 4 }}>
              File → Share → Publish to web → CSV format. Paste that URL here.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn-primary btn-sm" onClick={saveSheetUrl}>Save URL</button>
            <button
              className="btn-ghost btn-sm"
              onClick={fetchFromSheet}
              disabled={!sheetUrl || isBusy || activeTickers.length === 0}
            >
              Fetch from Sheet
            </button>
            {urlSaved && <span style={{ fontSize: 12, color: '#4caf50' }}>Saved!</span>}
          </div>
        </div>
      )}

      {/* ── Per-ticker cards ── */}
      {activeTickers.length === 0 && (
        <div className="empty-state">No active tickers. Add holdings or options first.</div>
      )}

      {mappings.map(mapping => {
        const priceData = prices[mapping.symbol];
        const st  = fetchStatus[mapping.symbol];
        const age = priceData ? ageMinutes(priceData.fetchedAt) : null;

        return (
          <div key={mapping.symbol} className="ticker-card">
            <div className="ticker-card-header">
              <span className="ticker-symbol">{mapping.symbol}</span>
              <div className="ticker-meta">
                {st === 'fetching' && <span className="ticker-age">fetching...</span>}
                {st === 'error'    && <span style={{ color: '#f44336', fontSize: 12 }}>fetch failed</span>}
                {st === 'ok' && priceData && (
                  <span className="ticker-age">{age}m ago</span>
                )}
              </div>
            </div>

            <div className="ticker-grid">
              <div className="ticker-cell-row">
                <span className="tcr-label">Price</span>
                <span className="tcr-value">{priceData ? fmt(priceData.price) : '—'}</span>
              </div>
              <div className="ticker-cell-row">
                <span className="tcr-label">Open</span>
                <span className="tcr-value">{priceData?.open !== undefined ? fmt(priceData.open) : '—'}</span>
              </div>
              <div className="ticker-cell-row">
                <span className="tcr-label">Manual</span>
                <input
                  className="tcr-input"
                  type="number"
                  step="0.01"
                  placeholder="override"
                  value={mapping.manualPrice ?? ''}
                  onChange={e => updateMapping(mapping.symbol, 'manualPrice', e.target.value ? Number(e.target.value) : undefined)}
                />
                <span className="tcr-value">{mapping.manualPrice ? fmt(mapping.manualPrice) : '—'}</span>
              </div>
              <div className="ticker-cell-row">
                <span className="tcr-label">Close</span>
                <span className="tcr-value">{priceData?.close !== undefined ? fmt(priceData.close) : '—'}</span>
              </div>
            </div>
          </div>
        );
      })}

      {mappings.length > 0 && (
        <button className="btn-ghost btn-full" style={{ marginTop: 8 }} onClick={saveSheetUrl}>
          Save Cell Mappings
        </button>
      )}
    </div>
  );
}
