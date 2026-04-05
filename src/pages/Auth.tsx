import { useState } from 'react';

const DISCLAIMER =
  'This app is only as secure as your phone. Your trading data is stored locally on your device and is not encrypted. ' +
  'Anyone with access to your phone can view your data. We recommend keeping your phone secure with a passcode or biometric lock. ' +
  'This app only records the data you enter—it does not make any transactions on your behalf. ' +
  'You can download a CSV to transfer your data, but data inputted here does not update on other devices. ' +
  'We are not responsible for data loss, unauthorized access, or any financial decisions made using this app. ' +
  'Always verify stock prices with your broker before making trades. ' +
  'Past performance does not guarantee future results.';

export default function Landing({ onEnter }: { onEnter: () => void }) {
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-logo">📊</div>
        <h1 className="auth-title">TraderVault</h1>
        <p className="auth-subtitle">Your personal trading journal</p>

        <button
          className="btn-primary btn-full"
          style={{ marginTop: 8, marginBottom: 20, fontSize: 16, padding: '14px' }}
          onClick={onEnter}
        >
          Enter App
        </button>

        <button
          className="link-btn"
          style={{ fontSize: 13, color: '#757575' }}
          onClick={() => setShowDisclaimer(true)}
        >
          Disclaimer
        </button>
      </div>

      {showDisclaimer && (
        <div className="modal-overlay" onClick={() => setShowDisclaimer(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Disclaimer</h3>
            <p style={{ lineHeight: 1.6, marginBottom: 20 }}>{DISCLAIMER}</p>
            <button className="btn-primary btn-full" onClick={() => setShowDisclaimer(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
