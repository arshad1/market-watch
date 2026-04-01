import React, { useEffect, useState } from 'react';
import BriefCard from './BriefCard';
import { RefreshCw, Search, ShieldAlert } from 'lucide-react';

const Dashboard = () => {
  const [briefs, setBriefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBriefs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/briefs?limit=12');
      if (!res.ok) throw new Error('API request failed');
      const data = await res.json();
      setBriefs(data.briefs || []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Could not connect to CryptoScope API engine.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBriefs();
    // Poll every 3 minutes
    const interval = setInterval(fetchBriefs, 180000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dashboard-container animate-fade-in">
      <header className="header">
        <div className="logo-container">
          <div className="logo-icon">
            <Search color="white" size={28} />
          </div>
          <div>
            <h1 className="title-gradient">CryptoScope</h1>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
              Autopilot Analysis Engine
            </div>
          </div>
        </div>
        
        <button 
          onClick={fetchBriefs} 
          disabled={loading}
          style={{ 
            background: 'rgba(255,255,255,0.05)', 
            border: '1px solid var(--border-card)', 
            padding: '10px 16px', 
            borderRadius: '12px',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
        >
          <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          {loading ? 'Syncing...' : 'Refresh Flow'}
        </button>
      </header>
      
      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--negative)', padding: '16px', borderRadius: '12px', color: 'var(--negative)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <ShieldAlert size={20} />
          {error}
        </div>
      )}

      {briefs.length === 0 && !loading && !error ? (
        <div className="empty-state">
          <Search className="empty-state-icon" style={{ margin: '0 auto' }} />
          <h3>No Briefs Generated Yet</h3>
          <p>The AI Engine hasn't scheduled any analysis runs or database is empty.</p>
        </div>
      ) : (
        <div className="brief-grid">
          {briefs.map((brief, idx) => (
            <BriefCard key={brief.id} brief={brief} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
