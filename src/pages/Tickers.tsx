import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import type { TickerMapping } from '../types.ts';

// ── Service definitions ────────────────────────────────────────────────────
const SERVICES = [
  { id: 'alphavantage', label: 'Alpha Vantage' },
  { id: 'polygon',      label: 'Polygon.io'   },
  { id: 'finnhub',      label: 'Finnhub'      },
  { id: 'iex',          label: 'IEX Cloud'    },
] as const;

type ServiceId = typeof SERVICES[number]['id'];

// ── API fetch helpers ──────────────────────────────────────────────────────
async function fetchFromService(
  symbol: string,
  service: ServiceId,
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
      return isNaN(price) ? null : {
        price,
        open:  isNaN(open)  ? undefined : open,
        close: isNaN(close) ? undefined : close,
      };
    }

    if (service === 'polygon') {
      const res = await fetch(
        `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}?apiKey=${apiKey}`
      );
      const data = await res.json();
      const day     = data?.ticker?.day;
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

  const [apiService, setApiService] = useState<ServiceId | ''>(sheetConfig.apiService ?? '');
  const [apiKey,     setApiKey]     = useState(sheetConfig.apiKey ?? '');
  const [apiKeySaved, setApiKeySaved] = useState(false);

  const [sheetUrl, setSheetUrl]   = useState(sheetConfig.url);
  const [mappings, setMappings]   = useState<TickerMapping[]>(sheetConfig.mappings);
  const [urlSaved, setUrlSaved]   = useState(false);
  const [showSheet, setShowSheet] = useState(false);

  const [fetchStatus, setFetchStatus] = useState<Record<string, 'fetching' | 'ok' | 'fallback' | 'error'>>({});
  const [isFetching, setIsFetching] = useState(false);

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

  const saveApiConfig = () => {
    saveSheetConfig({ ...sheetConfig, apiService: apiService || undefined, apiKey: apiKey || undefined });
    setApiKeySaved(true);
    setTimeout(() => setApiKeySaved(false), 2000);
  };

  const saveSheetUrl = () => {
    saveSheetConfig({ ...sheetConfig, url: sheetUrl, mappings });
    setUrlSaved(true);
    setTimeout(() => setUrlSaved(false), 2000);
  };

  const updateMapping = (symbol: string, field: keyof TickerMapping, value: string | number | undefined) => {
    setMappings(prev => prev.map(m => m.symbol === symbol ? { ...m, [field]: value } : m));
  };

  const fetchPrices = async () => {
    setIsFetching(true);
    const status: Record<string, 'fetching' | 'ok' | 'fallback' | 'error'> = {};
    activeTickers.forEach(t => { status[t] = 'fetching'; });
    setFetchStatus({ ...status });

    // Pre-fetch sheet CSV if needed
    let csvData: string[][] | null = null;
    if (sheetUrl && (!apiService || !apiKey)) {
      const csvUrl = getCsvUrl(sheetUrl);
      csvData = await fetchCsvData(csvUrl);
    }

    for (const ticker of activeTickers) {
      const mapping = mappings.find(m => m.symbol === ticker);
      let price: number | null = null;
      let open:  number | undefined;
      let close: number | undefined;

      // 1. Manual override
      if (mapping?.manualPrice && mapping.manualPrice > 0) {
        price = mapping.manualPrice;
      }

      // 2. API service
      if (price === null && apiService && apiKey) {
        const result = await fetchFromService(ticker, apiService, apiKey);
        if (result) {
          price = result.price;
          open  = result.open;
          close = result.close;
        }
      }

      // 3. Google Sheet fallback
      if (price === null && csvData && mapping?.priceCell) {
        const sheetPrice = getCellValue(csvData, mapping.priceCell);
        if (sheetPrice !== null) {
          price = sheetPrice;
          if (mapping.openCell)  open  = getCellValue(csvData, mapping.openCell)  ?? undefined;
          if (mapping.closeCell) close = getCellValue(csvData, mapping.closeCell) ?? undefined;
        }
      }

      if (price !== null) {
        setPrice(ticker, { symbol: ticker, price, open, close, fetchedAt: Date.now() });
        status[ticker] = 'ok';
      } else {
        status[ticker] = 'error';
      }
      setFetchStatus({ ...status });
    }

    saveSheetConfig({ ...sheetConfig, url: sheetUrl, mappings, apiService: apiService || undefined, apiKey: apiKey || undefined });
    setIsFetching(false);
  };

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const ageMinutes = (ts: number) => Math.floor((Date.now() - ts) / 60000);
  const hasApiConfig = !!(apiService && apiKey);

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Tickers & Prices</h2>
        <button
          className="btn-primary btn-sm"
          onClick={fetchPrices}
          disabled={isFetching || activeTickers.length === 0}
        >
          {isFetching ? 'Fetching...' : 'Fetch Prices'}
        </button>
      </div>

      {/* ── API Service Card ── */}
      <div className="card form-card" style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: '#424242', marginBottom: 14, lineHeight: 1.5 }}>
          For live prices and balance updates, sign up for one of these services and enter your API key below.
        </p>
        <div className="service-grid">
          {SERVICES.map(s => (
            <button
              key={s.id}
              className={`service-btn${apiService === s.id ? ' service-btn-active' : ''}`}
              onClick={() => setApiService(prev => prev === s.id ? '' : s.id as ServiceId)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {apiService && (
          <div className="form-group" style={{ marginTop: 14, marginBottom: 0 }}>
            <label>API Key</label>
            <input
              placeholder="Paste your API key here"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
          <button className="btn-primary btn-sm" onClick={saveApiConfig} disabled={!apiService}>
            Save
          </button>
          {apiKeySaved && <span style={{ fontSize: 12, color: '#4caf50' }}>Saved!</span>}
          {hasApiConfig && (
            <span style={{ fontSize: 12, color: '#757575', marginLeft: 4 }}>
              Using {SERVICES.find(s => s.id === apiService)?.label}
            </span>
          )}
        </div>
      </div>

      {/* ── Google Sheet toggle ── */}
      <div style={{ marginBottom: 12 }}>
        <button
          className="link-btn"
          style={{ fontSize: 13, color: '#757575' }}
          onClick={() => setShowSheet(v => !v)}
        >
          {showSheet ? '▾' : '▸'} Google Sheet {hasApiConfig ? '(optional fallback)' : '(manual cell mapping)'}
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
            {urlSaved && <span style={{ fontSize: 12, color: '#4caf50' }}>Saved!</span>}
          </div>
        </div>
      )}

      {/* ── Per-ticker cards ── */}
      {activeTickers.length === 0 ? (
        <div className="empty-state">No active tickers. Add holdings or options first.</div>
      ) : (
        !hasApiConfig && (
          <div style={{ marginBottom: 8, fontSize: 12, color: '#757575' }}>
            No API key saved. Enter cell references below to pull prices from your Google Sheet, or set a manual price.
          </div>
        )
      )}

      {mappings.map(mapping => {
        const priceData = prices[mapping.symbol];
        const st  = fetchStatus[mapping.symbol];
        const age = priceData ? ageMinutes(priceData.fetchedAt) : null;
        const serviceLabel = hasApiConfig ? SERVICES.find(s => s.id === apiService)?.label : 'Sheet';

        return (
          <div key={mapping.symbol} className="ticker-card">
            <div className="ticker-card-header">
              <span className="ticker-symbol">{mapping.symbol}</span>
              <div className="ticker-meta">
                {st === 'fetching' && <span className="ticker-age">fetching...</span>}
                {st === 'error'    && <span style={{ color: '#f44336', fontSize: 12 }}>fetch failed</span>}
                {st === 'ok' && priceData && (
                  <span className="ticker-age">({serviceLabel}) · {age}m ago</span>
                )}
              </div>
            </div>

            <div className="ticker-grid">
              {/* Price */}
              <div className="ticker-cell-row">
                <span className="tcr-label">Price</span>
                {!hasApiConfig && (
                  <input
                    className="tcr-input"
                    placeholder="e.g. B5"
                    value={mapping.priceCell}
                    onChange={e => updateMapping(mapping.symbol, 'priceCell', e.target.value.toUpperCase())}
                  />
                )}
                <span className="tcr-value">{priceData ? fmt(priceData.price) : '—'}</span>
              </div>

              {/* Open */}
              <div className="ticker-cell-row">
                <span className="tcr-label">Open</span>
                {!hasApiConfig && (
                  <input
                    className="tcr-input"
                    placeholder="e.g. C5"
                    value={mapping.openCell}
                    onChange={e => updateMapping(mapping.symbol, 'openCell', e.target.value.toUpperCase())}
                  />
                )}
                <span className="tcr-value">{priceData?.open !== undefined ? fmt(priceData.open) : '—'}</span>
              </div>

              {/* Manual override */}
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

              {/* Prev Close */}
              <div className="ticker-cell-row">
                <span className="tcr-label">Close</span>
                {!hasApiConfig && (
                  <input
                    className="tcr-input"
                    placeholder="e.g. D5"
                    value={mapping.closeCell}
                    onChange={e => updateMapping(mapping.symbol, 'closeCell', e.target.value.toUpperCase())}
                  />
                )}
                <span className="tcr-value">{priceData?.close !== undefined ? fmt(priceData.close) : '—'}</span>
              </div>
            </div>
          </div>
        );
      })}

      {mappings.length > 0 && !hasApiConfig && (
        <button className="btn-primary btn-full" style={{ marginTop: 8 }} onClick={saveSheetUrl}>
          Save Cell Mappings
        </button>
      )}
    </div>
  );
}
