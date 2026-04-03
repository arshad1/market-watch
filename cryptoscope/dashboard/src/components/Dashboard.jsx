import React, { useEffect, useState } from 'react';
import BriefCard from './BriefCard';
import { RefreshCw, Search, ShieldAlert, Sparkles } from 'lucide-react';

const Dashboard = ({ token }) => {
  const [briefs, setBriefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const fetchBriefs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/briefs?limit=12', {
        headers: { Authorization: `Bearer ${token}` },
      });
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

  const generateBrief = async () => {
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/briefs/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Brief generation failed');
      await fetchBriefs();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not generate a new market brief.');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    fetchBriefs();
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
              On-demand market brief engine
            </div>
          </div>
        </div>

        <div className="dashboard-actions">
          <button
            onClick={generateBrief}
            disabled={generating}
            className="dashboard-action-btn dashboard-action-btn-primary"
            style={{ opacity: generating ? 0.7 : 1 }}
          >
            <Sparkles size={16} className={generating ? 'spinning' : ''} />
            {generating ? 'Generating...' : 'Generate Brief'}
          </button>

          <button
            onClick={fetchBriefs}
            disabled={loading || generating}
            className="dashboard-action-btn dashboard-action-btn-secondary"
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          >
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            {loading ? 'Loading...' : 'Refresh Briefs'}
          </button>
        </div>
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
          <p>No auto-scheduler is running. Use Generate Brief to create one on demand.</p>
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
