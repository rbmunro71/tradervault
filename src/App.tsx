import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Landing from './pages/Auth';
import Dashboard from './pages/Dashboard';
import AccountView from './pages/AccountView';
import AddStock from './pages/AddStock';
import AddOption from './pages/AddOption';
import ROICalculator from './pages/ROICalculator';
import Tickers from './pages/Tickers';
import './index.css';

export default function App() {
  const [entered, setEntered] = useState(false);

  if (!entered) return <Landing onEnter={() => setEntered(true)} />;

  return (
    <BrowserRouter>
      <div className="app">
        <div className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/:accountId" element={<AccountView />} />
            <Route path="/:accountId/add-stock" element={<AddStock />} />
            <Route path="/:accountId/edit-stock/:stockId" element={<AddStock />} />
            <Route path="/:accountId/add-option" element={<AddOption />} />
            <Route path="/:accountId/edit-option/:optionId" element={<AddOption />} />
            <Route path="/roi" element={<ROICalculator />} />
            <Route path="/tickers" element={<Tickers />} />
          </Routes>
        </div>
        <nav className="bottom-nav">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <span className="nav-icon">📊</span>
            <span>Accounts</span>
          </NavLink>
          <NavLink to="/tickers" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <span className="nav-icon">📡</span>
            <span>Tickers</span>
          </NavLink>
          <NavLink to="/roi" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <span className="nav-icon">🧮</span>
            <span>ROI</span>
          </NavLink>
        </nav>
      </div>
    </BrowserRouter>
  );
}
