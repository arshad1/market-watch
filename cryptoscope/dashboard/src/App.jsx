import React, { Suspense, lazy, useEffect, useState } from 'react'
import { Search, Layers, Globe, LogOut } from 'lucide-react'
import './index.css'

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const Dashboard = lazy(() => import('./components/Dashboard'))
const StrategyBuilder = lazy(() => import('./components/options/StrategyBuilder'))
const SpotFuturesAnalyzer = lazy(() => import('./components/spotfutures/SpotFuturesAnalyzer'))
const LoginPage = lazy(() => import('./components/LoginPage'))

function App() {
  const [activePage, setActivePage] = useState('dashboard')
  const [token, setToken]           = useState(null)
  const [username, setUsername]     = useState('')
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    const pageTitle = {
      dashboard: 'Market Briefs',
      'spot-futures': 'Spot & Futures',
      options: 'Options Builder',
    }[activePage] || 'Dashboard'

    document.title = token
      ? `CryptoScope | ${pageTitle}`
      : 'CryptoScope | Sign In'
  }, [activePage, token])

  // On mount: restore session from localStorage and verify token
  useEffect(() => {
    const stored = localStorage.getItem('cs_token')
    const storedUser = localStorage.getItem('cs_user')
    if (!stored) { setAuthChecked(true); return }

    fetch(`${API_BASE}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setToken(stored)
          setUsername(storedUser || data.user?.username || '')
        } else {
          localStorage.removeItem('cs_token')
          localStorage.removeItem('cs_user')
        }
      })
      .catch(() => {
        // Network error — keep token for offline use
        setToken(stored)
        setUsername(storedUser || '')
      })
      .finally(() => setAuthChecked(true))
  }, [])

  function handleLogin(newToken, newUsername) {
    setToken(newToken)
    setUsername(newUsername)
  }

  function handleLogout() {
    localStorage.removeItem('cs_token')
    localStorage.removeItem('cs_user')
    setToken(null)
    setUsername('')
    setActivePage('dashboard')
  }

  // Still verifying stored token
  if (!authChecked) {
    return (
      <div className="auth-checking">
        <div className="auth-checking-inner">
          <div className="logo-icon" style={{ padding: '10px', marginBottom: '1rem' }}>
            <Search size={24} color="white" />
          </div>
          <div className="ai-pulse-dots">
            <span /><span /><span />
          </div>
        </div>
      </div>
    )
  }

  // Not authenticated → show login
  if (!token) {
    return (
      <Suspense fallback={<AppLoader />}>
        <LoginPage onLogin={handleLogin} />
      </Suspense>
    )
  }

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
        <div className="nav-right">
          <span className="nav-username">{username}</span>
          <button id="nav-logout" className="nav-logout-btn" onClick={handleLogout} title="Logout">
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </nav>

      {/* ── Page Content ── */}
      <div className="page-content">
        <Suspense fallback={<AppLoader />}>
          {activePage === 'dashboard'    && <Dashboard token={token} />}
          {activePage === 'spot-futures' && <SpotFuturesAnalyzer token={token} />}
          {activePage === 'options'      && <StrategyBuilder token={token} />}
        </Suspense>
      </div>
    </>
  )
}

function AppLoader() {
  return (
    <div className="auth-checking">
      <div className="auth-checking-inner">
        <div className="logo-icon" style={{ padding: '10px', marginBottom: '1rem' }}>
          <Search size={24} color="white" />
        </div>
        <div className="ai-pulse-dots">
          <span /><span /><span />
        </div>
      </div>
    </div>
  )
}

export default App
