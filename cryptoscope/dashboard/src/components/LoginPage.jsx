import React, { useState } from 'react'
import { Search, Lock, User, AlertCircle, Loader } from 'lucide-react'

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [shake, setShake]       = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Login failed.')
      }

      localStorage.setItem('cs_token', data.token)
      localStorage.setItem('cs_user', data.username)
      onLogin(data.token, data.username)
    } catch (err) {
      setError(err.message)
      setShake(true)
      setTimeout(() => setShake(false), 600)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Background blobs */}
      <div className="login-blob login-blob-1" />
      <div className="login-blob login-blob-2" />

      <div className={`login-card ${shake ? 'login-shake' : ''}`}>
        {/* Logo */}
        <div className="login-logo">
          <div className="logo-icon" style={{ padding: '10px' }}>
            <Search size={24} color="white" />
          </div>
          <span className="title-gradient" style={{ fontSize: '1.5rem', fontWeight: 700 }}>
            CryptoScope
          </span>
        </div>

        <h2 className="login-title">Welcome back</h2>
        <p className="login-subtitle">Sign in to access your dashboard</p>

        <form onSubmit={handleSubmit} className="login-form">
          {/* Username */}
          <div className="login-field">
            <label className="login-label" htmlFor="login-username">Username</label>
            <div className="login-input-wrap">
              <User size={15} className="login-input-icon" />
              <input
                id="login-username"
                type="text"
                className="login-input"
                placeholder="admin"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="login-field">
            <label className="login-label" htmlFor="login-password">Password</label>
            <div className="login-input-wrap">
              <Lock size={15} className="login-input-icon" />
              <input
                id="login-password"
                type="password"
                className="login-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="login-error">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            id="login-submit"
            type="submit"
            className="login-btn"
            disabled={loading}
          >
            {loading
              ? <><Loader size={16} className="spinning" /> Signing in…</>
              : 'Sign In'}
          </button>
        </form>

        <p className="login-footer">
          CryptoScope · AI Market Intelligence
        </p>
      </div>
    </div>
  )
}
