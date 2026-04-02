import React, { useState } from 'react'
import Dashboard from './components/Dashboard'
import StrategyBuilder from './components/options/StrategyBuilder'
import SpotFuturesAnalyzer from './components/spotfutures/SpotFuturesAnalyzer'
import { Search, Layers, Globe } from 'lucide-react'
import './index.css'

function App() {
  const [activePage, setActivePage] = useState('dashboard')

  return (
    <>
      {/* ── Global Nav Bar ── */}
      <nav className="global-nav">
        <div className="nav-logo">
          <div className="logo-icon" style={{ padding: '7px' }}>
            <Search size={20} color="white" />
          </div>
          <span className="title-gradient" style={{ fontSize: '1.2rem', fontWeight: 700 }}>CryptoScope</span>
        </div>
        <div className="nav-links">
          <button
            id="nav-dashboard"
            className={`nav-link ${activePage === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActivePage('dashboard')}
          >
            <Search size={15} /> Market Briefs
          </button>
          <button
            id="nav-spot-futures"
            className={`nav-link ${activePage === 'spot-futures' ? 'active' : ''}`}
            onClick={() => setActivePage('spot-futures')}
          >
            <Globe size={15} /> Spot &amp; Futures
          </button>
          <button
            id="nav-options"
            className={`nav-link ${activePage === 'options' ? 'active' : ''}`}
            onClick={() => setActivePage('options')}
          >
            <Layers size={15} /> Options Builder
          </button>
        </div>
      </nav>

      {/* ── Page Content ── */}
      <div className="page-content">
        {activePage === 'dashboard' && <Dashboard />}
        {activePage === 'spot-futures' && <SpotFuturesAnalyzer />}
        {activePage === 'options' && <StrategyBuilder />}
      </div>
    </>
  )
}

export default App

