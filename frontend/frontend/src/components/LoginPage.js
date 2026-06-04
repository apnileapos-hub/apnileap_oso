import React, { useState } from 'react';

const DEMO_EMAIL = 'admin@devcobra.io';
const DEMO_PASS  = 'Admin@123';

export default function LoginPage({ onLogin }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

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
    // Simulate enterprise SSO auth delay
    await new Promise((r) => setTimeout(r, 1800));
    setLoading(false);

    const name = email
      .split('@')[0]
      .replace(/[._-]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    onLogin({ name, email, role: 'Project Manager', avatar: name.charAt(0).toUpperCase() });
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
              <div className="login-logo-name">DevCobra</div>
              <div className="login-logo-tagline">Analytics Platform</div>
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
            Connected to&nbsp;<strong>devcobraaa.atlassian.net</strong>&nbsp;· SCRUM
          </div>

          <div className="login-stats-row">
            <div className="login-stat">
              <div className="login-stat-value">SCRUM</div>
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
              <span>DevCobra</span>
            </div>
            <h2 className="login-form-title">Welcome back</h2>
            <p className="login-form-subtitle">Sign in to your analytics dashboard</p>
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

          <div className="login-divider"><span>or continue with</span></div>

          <button id="login-demo-btn" className="demo-btn" onClick={fillDemo} type="button">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L9.8 5.5H15L10.9 8.3L12.5 13L8 10L3.5 13L5.1 8.3L1 5.5H6.2L8 1Z" fill="#d29922" opacity=".8"/>
            </svg>
            Use demo credentials
          </button>

          <p className="login-hint">
            Demo&nbsp;&nbsp;
            <code>admin@devcobra.io</code>
            &nbsp;/&nbsp;
            <code>Admin@123</code>
          </p>

          <p className="login-footer-note">
            By signing in you agree to DevCobra's&nbsp;
            <span className="login-link">Terms of Service</span>
            &nbsp;and&nbsp;
            <span className="login-link">Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  );
}
