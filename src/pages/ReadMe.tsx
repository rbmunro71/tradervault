import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Section {
  title: string;
  content: React.ReactNode;
}

export default function ReadMe() {
  const navigate = useNavigate();
  const [open, setOpen] = useState<number | null>(0);

  const toggle = (i: number) => setOpen(open === i ? null : i);

  const sections: Section[] = [
    {
      title: 'CSV Import — Formatting Numbers Correctly',
      content: (
        <div className="readme-body">
          <p>
            Before importing a <code>.csv</code> file to TraderVault, make sure any dollar amounts or large
            numbers are <strong>not formatted with commas</strong> (e.g. use <code>70000</code> or{' '}
            <code>70000.00</code>, not <code>$70,000.00</code>). Commas inside a number break the CSV
            column alignment and cause import errors.
          </p>

          <h4>In Excel</h4>
          <ol>
            <li>Select the column (click the column letter to select all, or highlight just the cells).</li>
            <li>Right-click → <strong>Format Cells</strong> (or press <kbd>Ctrl+1</kbd>).</li>
            <li>Go to the <strong>Number</strong> tab.</li>
            <li>Choose <strong>Number</strong> from the list (not "Currency" or "Accounting").</li>
            <li>Set decimal places to 0 or 2 as you prefer.</li>
            <li>Make sure <strong>"Use 1000 Separator (,)"</strong> is <em>unchecked</em>.</li>
            <li>Click <strong>OK</strong>.</li>
          </ol>

          <h4>In Google Sheets</h4>
          <ol>
            <li>Select the column.</li>
            <li>Go to <strong>Format → Number → Custom number format</strong>.</li>
            <li>
              Type <code>0</code> (no decimals) or <code>0.00</code> (two decimals) and click{' '}
              <strong>Apply</strong>.
            </li>
          </ol>

          <p className="readme-note">
            Tip: After reformatting, re-save the file as <code>.csv</code> before importing.
          </p>
        </div>
      ),
    },
    {
      title: 'Stock Holdings CSV — Column Reference',
      content: (
        <div className="readme-body">
          <p>Download the template from the Holdings → Import CSV dialog. Columns:</p>
          <table className="readme-table">
            <thead><tr><th>Column</th><th>Required</th><th>Notes</th></tr></thead>
            <tbody>
              <tr><td>Ticker</td><td>Yes</td><td>Stock symbol (e.g. AAPL)</td></tr>
              <tr><td>Shares</td><td>Yes</td><td>Number of shares owned</td></tr>
              <tr><td>Total Cost Basis</td><td>Yes</td><td>Total amount paid (no commas — see above)</td></tr>
              <tr><td>Date Bought</td><td>Yes</td><td>MM/DD/YYYY</td></tr>
              <tr><td>Date Sold</td><td>No</td><td>Leave blank for open positions</td></tr>
              <tr><td>Sell Price</td><td>No</td><td>Total sale amount — required if Date Sold is filled</td></tr>
              <tr><td>Notes</td><td>No</td><td>Any notes you want attached to the record</td></tr>
            </tbody>
          </table>
          <p className="readme-note">Rows with a Date Sold go to History. Rows without go to open Holdings.</p>
        </div>
      ),
    },
    {
      title: 'Options CSV — Column Reference',
      content: (
        <div className="readme-body">
          <p>Download the template from the Options → Import CSV dialog. Columns:</p>
          <table className="readme-table">
            <thead><tr><th>Column</th><th>Required</th><th>Notes</th></tr></thead>
            <tbody>
              <tr><td>Ticker</td><td>Yes</td><td>Underlying symbol (e.g. TSLA)</td></tr>
              <tr><td># of Contracts</td><td>Yes</td><td>Number of contracts (1 contract = 100 shares)</td></tr>
              <tr><td>Buy/Sell</td><td>Yes</td><td>Must be BUY or SELL</td></tr>
              <tr><td>Put/Call</td><td>Yes</td><td>Must be PUT or CALL</td></tr>
              <tr><td>Strike Price</td><td>Yes</td><td>Strike price of the contract (no commas)</td></tr>
              <tr><td>Premium/Share</td><td>Yes</td><td>Per-share premium (no commas)</td></tr>
              <tr><td>Date Opened</td><td>Yes</td><td>MM/DD/YYYY</td></tr>
              <tr><td>Exp. Date</td><td>Yes</td><td>MM/DD/YYYY</td></tr>
              <tr><td>Close Date</td><td>No</td><td>Leave blank for open contracts</td></tr>
            </tbody>
          </table>
          <p className="readme-note">Rows with a Close Date go to History. Rows without go to open Options.</p>
        </div>
      ),
    },
    {
      title: 'General Tips',
      content: (
        <div className="readme-body">
          <ul>
            <li>All data is stored <strong>locally on your device</strong> — nothing is sent to a server.</li>
            <li>Use the <strong>ROI Calculator</strong> to estimate annualized return on a potential options trade before entering it.</li>
            <li>If you originally recorded open and close entries separately in your spreadsheet, combine them into a single row before importing.</li>
            <li>Clearing your browser cache or app data will erase all stored records.</li>
          </ul>
        </div>
      ),
    },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Read Me</h2>
        <button className="btn-ghost" onClick={() => navigate(-1)}>← Back</button>
      </div>

      <div className="readme-sections">
        {sections.map((s, i) => (
          <div key={i} className="readme-section">
            <button className="readme-section-header" onClick={() => toggle(i)}>
              <span>{s.title}</span>
              <span className="readme-chevron">{open === i ? '▲' : '▼'}</span>
            </button>
            {open === i && <div className="readme-section-body">{s.content}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
