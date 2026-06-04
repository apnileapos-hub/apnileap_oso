import React, { useState, useEffect } from 'react';

const DEMO_EMAIL = 'admin@devcobra.io';
const DEMO_PASS  = 'Admin@123';

export default function LoginPage({ onLogin }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [modalType, setModalType] = useState(null); // 'terms' | 'privacy' | null
  const [jiraBaseUrl, setJiraBaseUrl] = useState('devcobraaa.atlassian.net');
  const [jiraProjectKey, setJiraProjectKey] = useState('SCRUM');

  useEffect(() => {
    const API = process.env.REACT_APP_API_URL || (window.location.port === '3000' ? 'http://localhost:5000' : '');
    fetch(`${API}/settings`)
      .then(res => res.json())
      .then(data => {
        if (data.jiraProjectKey) setJiraProjectKey(data.jiraProjectKey);
        if (data.jiraBaseUrl) {
          const cleanUrl = data.jiraBaseUrl.replace(/^https?:\/\//, '');
          setJiraBaseUrl(cleanUrl);
        }
      })
      .catch(err => console.warn("Failed to load JIRA settings for login page", err));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.includes('@') || !email.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const API = process.env.REACT_APP_API_URL || (window.location.port === '3000' ? 'http://localhost:5000' : '');
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Login failed');
      }
      
      const data = await res.json();
      onLogin({ ...data.user, token: data.token, avatar: data.user.name.charAt(0).toUpperCase() });
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  const fillDemo = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASS);
    setError('');
  };

  return (
    <div className="login-page">
      {/* ── Left branding panel ── */}
      <div className="login-brand">
        <div className="login-blob login-blob-1" />
        <div className="login-blob login-blob-2" />
        <div className="login-blob login-blob-3" />

        <div className="login-brand-content">
          <div className="login-logo">
            <div className="login-logo-icon">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M14 2L25 8V20L14 26L3 20V8L14 2Z" fill="rgba(88,166,255,0.3)" stroke="#58a6ff" strokeWidth="1.5"/>
                <path d="M14 7L21 11V17L14 21L7 17V11L14 7Z" fill="rgba(88,166,255,0.5)"/>
                <circle cx="14" cy="14" r="3" fill="#58a6ff"/>
              </svg>
            </div>
            <div>
              <div className="login-logo-name">APNILEAP</div>
              <div className="login-logo-tagline">Enterprise Platform</div>
            </div>
          </div>

          <h1 className="login-headline">
            Your Jira projects,<br />
            <span className="login-headline-accent">beautifully visualized.</span>
          </h1>

          <p className="login-desc">
            Real-time analytics, team workload insights, and sprint progress — all in one enterprise-grade dashboard.
          </p>

          <ul className="login-features">
            {[
              'Live Jira issue sync',
              'Team workload analytics',
              'Sprint velocity tracking',
              'Priority & status intelligence',
            ].map((f) => (
              <li key={f}>
                <span className="login-check-icon">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="7" fill="rgba(63,185,80,0.2)"/>
                    <path d="M4 7L6.2 9.2L10 5" stroke="#3fb950" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                {f}
              </li>
            ))}
          </ul>

          <div className="login-project-badge">
            <span className="login-jira-dot" />
            Connected to&nbsp;<strong>{jiraBaseUrl}</strong>&nbsp;· {jiraProjectKey}
          </div>

          <div className="login-stats-row">
            <div className="login-stat">
              <div className="login-stat-value">{jiraProjectKey}</div>
              <div className="login-stat-label">Project Key</div>
            </div>
            <div className="login-stat-divider" />
            <div className="login-stat">
              <div className="login-stat-value">Live</div>
              <div className="login-stat-label">Data Sync</div>
            </div>
            <div className="login-stat-divider" />
            <div className="login-stat">
              <div className="login-stat-value">Cloud</div>
              <div className="login-stat-label">Jira Edition</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="login-form-panel">
        <div className="login-form-card">
          <div className="login-form-header">
            <div className="login-form-logo-sm">
              <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
                <path d="M14 2L25 8V20L14 26L3 20V8L14 2Z" fill="rgba(88,166,255,0.3)" stroke="#58a6ff" strokeWidth="1.5"/>
                <circle cx="14" cy="14" r="3" fill="#58a6ff"/>
              </svg>
              <span>APNILEAP</span>
            </div>
            <h2 className="login-form-title">Welcome back</h2>
            <p className="login-form-subtitle">Sign in to your APNILEAP portal</p>
          </div>

          {error && (
            <div className="login-error" role="alert">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="7" fill="rgba(248,81,73,0.3)"/>
                <path d="M7 4V7.5M7 9.5V10" stroke="#f85149" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form" noValidate>
            {/* Email */}
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Email address</label>
              <div className="form-input-wrap">
                <svg className="form-input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="3" width="14" height="10" rx="2" stroke="#484f58" strokeWidth="1.2"/>
                  <path d="M1 5.5L8 9.5L15 5.5" stroke="#484f58" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <input
                  id="login-email"
                  type="email"
                  className="form-input"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="form-group">
              <div className="form-label-row">
                <label className="form-label" htmlFor="login-password">Password</label>
                <button type="button" className="form-forgot">Forgot password?</button>
              </div>
              <div className="form-input-wrap">
                <svg className="form-input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="#484f58" strokeWidth="1.2"/>
                  <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="#484f58" strokeWidth="1.2" strokeLinecap="round"/>
                  <circle cx="8" cy="10.5" r="1" fill="#484f58"/>
                </svg>
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="form-eye-btn"
                  onClick={() => setShowPass((p) => !p)}
                  tabIndex={-1}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M2 2L14 14M6.5 6.6A2 2 0 0 0 9.4 9.5M4.2 4.3C2.8 5.3 1.8 6.6 1.5 8c.8 3 3.6 5 6.5 5 1.3 0 2.5-.4 3.5-1M7 3.1C7.3 3 7.7 3 8 3c2.9 0 5.7 2 6.5 5-.3 1-.9 2-1.7 2.7" stroke="#484f58" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M1.5 8C2.3 5 5.1 3 8 3s5.7 2 6.5 5c-.8 3-3.6 5-6.5 5S2.3 11 1.5 8Z" stroke="#484f58" strokeWidth="1.2"/>
                      <circle cx="8" cy="8" r="2" stroke="#484f58" strokeWidth="1.2"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <label className="form-check">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Remember me for 30 days</span>
            </label>

            {/* Submit */}
            <button
              id="login-submit-btn"
              type="submit"
              className={`login-btn ${loading ? 'loading' : ''}`}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="login-spinner" />
                  Authenticating…
                </>
              ) : (
                <>
                  Sign in to Dashboard
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8H13M9 4L13 8L9 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="login-divider"><span>or quick sign-in</span></div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              className="demo-btn"
              onClick={() => {
                setEmail('moderator@apnileap.com');
                setPassword('Vanyx@1512');
                setError('');
              }}
              type="button"
              style={{ padding: '8px', fontSize: '12px' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              </svg>
              Platform Moderator
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="demo-btn"
                onClick={() => {
                  setEmail('spoc-kle@college.edu');
                  setPassword('Admin@123');
                  setError('');
                }}
                type="button"
                style={{ flex: 1, padding: '8px', fontSize: '11px' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px', verticalAlign: 'middle' }}>
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                  <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path>
                </svg>
                KLE Coordinator
              </button>
              <button
                className="demo-btn"
                onClick={() => {
                  setEmail('spoc-coep@college.edu');
                  setPassword('Admin@123');
                  setError('');
                }}
                type="button"
                style={{ flex: 1, padding: '8px', fontSize: '11px' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px', verticalAlign: 'middle' }}>
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                  <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path>
                </svg>
                COEP Coordinator
              </button>
            </div>
            <button id="login-demo-btn" className="demo-btn" onClick={fillDemo} type="button" style={{ padding: '8px', fontSize: '12px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              Jira Administrator
            </button>
          </div>

          <p className="login-footer-note">
            By signing in you agree to APNILEAP's&nbsp;
            <span className="login-link" onClick={() => setModalType('terms')} style={{ cursor: 'pointer', textDecoration: 'underline' }}>Terms of Service</span>
            &nbsp;and&nbsp;
            <span className="login-link" onClick={() => setModalType('privacy')} style={{ cursor: 'pointer', textDecoration: 'underline' }}>Privacy Policy</span>
          </p>
        </div>
      </div>

      {/* ── Terms / Privacy Modal ── */}
      {modalType && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }} onClick={() => setModalType(null)}>
          <div style={{
            background: '#1c2128',
            border: '1px solid #30363d',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '80vh',
            overflowY: 'auto',
            color: '#c9d1d9',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #30363d', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: 'bold' }}>
                {modalType === 'terms' ? '📄 Terms of Service' : '🔒 Privacy Policy'}
              </h3>
              <button onClick={() => setModalType(null)} style={{ background: 'none', border: 'none', color: '#8b949e', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: '13.5px', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {modalType === 'terms' ? (
                <>
                  <p>Welcome to APNILEAP! By using our platform, you agree to these terms.</p>
                  <strong>1. Account Security</strong>
                  <p>You must maintain the confidentiality of your account credentials. All activities under your account are your responsibility.</p>
                  <strong>2. Prohibited Uses</strong>
                  <p>You agree not to bypass security controls, automate actions without explicit API authorization, or upload malicious files.</p>
                  <strong>3. Service Modification</strong>
                  <p>APNILEAP reserves the right to modify, suspend, or terminate services at any time for platform maintenance or security updates.</p>
                </>
              ) : (
                <>
                  <p>APNILEAP values your privacy. This policy explains how we protect your information.</p>
                  <strong>1. Information Collection</strong>
                  <p>We collect credentials, active campus assignments, and system audit history to ensure safe execution tracking.</p>
                  <strong>2. Data Encryption</strong>
                  <p>All sensitive information, including active session tokens and passwords, is encrypted using industry-standard protocols.</p>
                  <strong>3. Cookies and Storage</strong>
                  <p>We use localized browser storage (such as localStorage) solely to maintain active login states and enhance session persistence.</p>
                </>
              )}
            </div>
            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setModalType(null)} style={{ padding: '8px 20px', background: '#238636', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: '600', cursor: 'pointer' }}>
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
