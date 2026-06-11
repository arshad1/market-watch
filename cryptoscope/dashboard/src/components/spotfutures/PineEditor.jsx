import React, { useState } from 'react';
import { Play, Sparkles, AlertCircle, FileText, CheckCircle } from 'lucide-react';

const TEMPLATES = [
  {
    name: 'SMA / EMA Cross',
    code: `// Simple Moving Average Cross
fast = sma(close, 9)
slow = ema(close, 21)
plot(fast, color=color.blue, title="Fast SMA")
plot(slow, color=color.purple, title="Slow EMA")`
  },
  {
    name: 'Custom RSI Overlay',
    code: `// RSI Custom Indicator
myRsi = rsi(close, 14)
plot(myRsi, color=color.yellow, title="RSI Overlay")`
  },
  {
    name: 'Price Momentum (Close - Open)',
    code: `// Simple Price Momentum
mom = close - open
plot(mom, color=color.teal, title="Bar Momentum")`
  }
];

const PineEditor = ({ onApplyScript, scriptErrors }) => {
  const [code, setCode] = useState(TEMPLATES[0].code);
  const [compiled, setCompiled] = useState(false);

  const handleRun = () => {
    onApplyScript(code);
    setCompiled(true);
    setTimeout(() => setCompiled(false), 2000);
  };

  const handleSelectTemplate = (templateCode) => {
    setCode(templateCode);
    onApplyScript(templateCode);
  };

  return (
    <div className="pine-editor-card glass-card">
      <div className="pine-editor-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="pine-badge-icon">
            <Sparkles size={16} />
          </div>
          <div>
            <h4 style={{ fontWeight: 600, fontSize: '0.95rem' }}>Pine Script Console</h4>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Write custom indicators & plot overlays</div>
          </div>
        </div>
        
        {/* Template Selectors */}
        <div className="pine-templates">
          {TEMPLATES.map((tmpl, idx) => (
            <button
              key={idx}
              className="pine-template-btn"
              onClick={() => handleSelectTemplate(tmpl.code)}
              title="Click to load template"
            >
              <FileText size={11} />
              {tmpl.name}
            </button>
          ))}
        </div>
      </div>

      {/* Editor Body */}
      <div className="pine-editor-body">
        <textarea
          className="pine-textarea"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="// Enter Pine Script here..."
          spellCheck="false"
        />
      </div>

      {/* Editor Footer / Controls */}
      <div className="pine-editor-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="pine-run-btn"
            onClick={handleRun}
          >
            <Play size={13} fill="white" /> Run Script
          </button>
          
          {compiled && scriptErrors.length === 0 && (
            <span className="pine-success-msg animate-fade-in">
              <CheckCircle size={14} color="var(--positive)" /> Script applied!
            </span>
          )}
        </div>

        {scriptErrors.length > 0 && (
          <div className="pine-errors-alert">
            <div className="pine-errors-title">
              <AlertCircle size={13} /> Syntax Error
            </div>
            <div className="pine-errors-list">
              {scriptErrors.map((err, idx) => (
                <div key={idx} className="pine-error-line">{err}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PineEditor;
