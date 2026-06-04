import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL ||
  (window.location.port === '3000' ? 'http://localhost:5000' : '');

/* ─── ID / CODE generators ──────────────────────────────────────────────── */
const rand = (n) => Math.random().toString(36).toUpperCase().slice(2, 2 + n);
const generateMeetingId  = ()  => `DC-${rand(4)}-${rand(4)}`;
const generateAccessCode = ()  => `${Math.floor(100000 + Math.random() * 900000)}`;

/* ─── Helpers ───────────────────────────────────────────────────────────── */
const getInitials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
const COLORS = ['#1f6feb','#8957e5','#cf222e','#bf8700','#1a7f37','#0969da','#9a3691','#c6500a'];
const avatarColor = (name = '') => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return COLORS[Math.abs(h) % COLORS.length];
};
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
const fmtDT   = (iso) => iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

/* ─── Storage ───────────────────────────────────────────────────────────── */
const KEY = 'dc_calls_v4';
const loadStore = () => {
  try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : { meetings: [], callLogs: [] }; }
  catch { return { meetings: [], callLogs: [] }; }
};
const saveStore = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };

/* ─── Desktop notifications ─────────────────────────────────────────────── */
async function reqNotif() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') return (await Notification.requestPermission()) === 'granted';
  return false;
}
function pushNotif(title, body, onClick) {
  if (Notification?.permission !== 'granted') return null;
  const n = new Notification(title, { body, requireInteraction: true, icon: '/favicon.ico' });
  if (onClick) n.onclick = () => { window.focus(); onClick(); n.close(); };
  return n;
}

/* ─── Avatar ────────────────────────────────────────────────────────────── */
function Avatar({ name = '', size = 32, style = {} }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: avatarColor(name),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.34, fontWeight: 700, color: '#fff', flexShrink: 0, ...style,
    }}>
      {getInitials(name)}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CALLING SCREEN — ring animation, NO auto-accept, cancel only
═══════════════════════════════════════════════════════════════════════════ */
function CallingScreen({ meeting, onCancel }) {
  const [elapsed, setElapsed] = useState(0);
  const notifRef = useRef(null);

  useEffect(() => {
    reqNotif().then(ok => {
      if (ok) {
        const names = (meeting.participants || []).join(', ') || 'someone';
        notifRef.current = pushNotif(
          `📞 Calling ${names}…`,
          `Waiting for ${names} to pick up — ${meeting.meetingId}`,
          () => {}
        );
      }
    });
    return () => notifRef.current?.close();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const names = (meeting.participants || []).join(', ') || 'someone';
  const single = (meeting.participants || []).length === 1;

  return (
    <div className="mc-calling-screen">
      <div className="mc-ring mc-ring-1" /><div className="mc-ring mc-ring-2" /><div className="mc-ring mc-ring-3" />
      <div className="mc-calling-center">
        <div className="mc-calling-avatars">
          {(meeting.participants || []).slice(0, 3).map((p, i) => (
            <Avatar key={i} name={p} size={single ? 96 : 72}
              style={{ border: '4px solid rgba(255,255,255,.15)', boxShadow: '0 0 40px rgba(0,0,0,.5)', marginLeft: i > 0 ? -20 : 0 }} />
          ))}
        </div>
        <div className="mc-calling-name">{names}</div>
        <div className="mc-calling-status">
          <span className="mc-calling-dot" />
          {meeting.type === 'voice' ? 'Voice Calling…' : 'Video calling…'}
          <span className="mc-calling-timer">{fmt(elapsed)}</span>
        </div>
        <div className="mc-calling-type-tag">
          {meeting.type === 'voice' ? '🎙️ Voice' : '📹 Video'} · ID: <strong>{meeting.meetingId}</strong>
        </div>
        <div className="mc-calling-note">Waiting for the other person to pick up…</div>
        <div className="mc-calling-controls">
          <button className="mc-call-ctrl mc-call-cancel" onClick={onCancel}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
            </svg>
            <span>Cancel Call</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Incoming Call BANNER — shown to the person being called
═══════════════════════════════════════════════════════════════════════════ */
function IncomingCallBanner({ call, onAccept, onDecline }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => { const t = setInterval(() => setElapsed(e => e + 1), 1000); return () => clearInterval(t); }, []);
  return (
    <div className="mc-incoming-banner">
      <div className="mc-incoming-pulse" />
      <Avatar name={call.callerName || 'Unknown'} size={46} style={{ flexShrink: 0 }} />
      <div className="mc-incoming-info">
        <div className="mc-incoming-caller">{call.callerName}</div>
        <div className="mc-incoming-type">
          {call.type === 'voice' ? '🎙️ Voice Call' : '📹 Video call'}
          <span className="mc-incoming-timer"> · {fmt(elapsed)}</span>
        </div>
        <div className="mc-incoming-id">Meeting: <code>{call.meetingId}</code></div>
      </div>
      <div className="mc-incoming-actions">
        <button className="mc-inc-btn mc-inc-decline" onClick={onDecline} title="Decline">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
          </svg>
        </button>
        <button className="mc-inc-btn mc-inc-accept" onClick={onAccept} title="Accept">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACCESS GATE — enter meeting ID + access code
═══════════════════════════════════════════════════════════════════════════ */
function AccessGate({ onClose, onVerified, store }) {
  const [meetingId,   setMeetingId]   = useState('');
  const [accessCode,  setAccessCode]  = useState('');
  const [error,       setError]       = useState('');
  const [step,        setStep]        = useState(1); // 1=id, 2=code

  const verifyId = () => {
    const id = meetingId.trim().toUpperCase();
    const found = store.meetings.find(m => m.meetingId === id);
    if (!found) return setError('No meeting found with this ID.');
    setError('');
    setStep(2);
  };

  const verifyCode = () => {
    const id   = meetingId.trim().toUpperCase();
    const mtg  = store.meetings.find(m => m.meetingId === id);
    if (!mtg) return setError('Meeting not found.');
    if (mtg.accessCode !== accessCode.replace(/\s/g, '')) return setError('Incorrect access code. Please try again.');
    setError('');
    onVerified(mtg);
  };

  return (
    <div className="mc-modal-overlay" onClick={onClose}>
      <div className="mc-modal mc-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="mc-modal-header">
          <div className="mc-modal-title">🔒 Join a Meeting</div>
          <button className="mc-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="mc-modal-body">
          {/* Progress dots */}
          <div className="mc-gate-steps">
            <div className={`mc-gate-step ${step >= 1 ? 'active' : ''}`}>1</div>
            <div className="mc-gate-step-line" />
            <div className={`mc-gate-step ${step >= 2 ? 'active' : ''}`}>2</div>
          </div>

          {step === 1 && (
            <>
              <div className="mc-form-row">
                <label className="mc-form-label">Meeting ID</label>
                <input className="mc-form-input mc-code-input" value={meetingId}
                  onChange={e => setMeetingId(e.target.value.toUpperCase())}
                  placeholder="DC-XXXX-XXXX" autoFocus
                  onKeyDown={e => e.key === 'Enter' && verifyId()}
                />
                <div className="mc-form-hint">Ask the host for the meeting ID</div>
              </div>
              {error && <div className="mc-error-msg">{error}</div>}
              <div className="mc-modal-footer">
                <button className="mc-btn-secondary" onClick={onClose}>Cancel</button>
                <button className="mc-btn-primary" disabled={!meetingId.trim()} onClick={verifyId}>Next →</button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="mc-form-row">
                <label className="mc-form-label">Access Code</label>
                <input className="mc-form-input mc-code-input" value={accessCode}
                  onChange={e => setAccessCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit code" autoFocus maxLength={6}
                  onKeyDown={e => e.key === 'Enter' && verifyCode()}
                />
                <div className="mc-form-hint">Enter the 6-digit access code for <strong>{meetingId}</strong></div>
              </div>
              {error && <div className="mc-error-msg">{error}</div>}
              <div className="mc-modal-footer">
                <button className="mc-btn-secondary" onClick={() => { setStep(1); setError(''); }}>← Back</button>
                <button className="mc-btn-primary" disabled={accessCode.length < 6} onClick={verifyCode}>Verify & Join</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   JOIN OPTIONS SCREEN
═══════════════════════════════════════════════════════════════════════════ */
function JoinOptionsScreen({ meeting, currentUser, onJoin, onCancel }) {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(meeting.type !== 'voice');
  const [mode,  setMode]  = useState('normal');
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    let activeStream = null;
    if (camOn || micOn) {
      navigator.mediaDevices.getUserMedia({ video: camOn, audio: micOn })
        .then(s => {
          activeStream = s;
          setStream(s);
          if (videoRef.current && camOn) videoRef.current.srcObject = s;
        }).catch(console.error);
    } else {
      setStream(null);
    }
    return () => {
      if (activeStream) activeStream.getTracks().forEach(t => t.stop());
    };
  }, [camOn, micOn]);

  const handleJoin = () => {
    if (stream) stream.getTracks().forEach(t => t.stop());
    onJoin({ micOn: mode === 'viewer' ? false : micOn, camOn: mode === 'audio-only' || mode === 'viewer' ? false : camOn, mode });
  };

  const handleCancel = () => {
    if (stream) stream.getTracks().forEach(t => t.stop());
    onCancel();
  };

  const MODES = [
    { id: 'normal',     emoji: '🎙️📹', label: 'Audio & Video',  desc: 'Mic + camera on' },
    { id: 'audio-only', emoji: '🎙️',   label: 'Audio Only',     desc: 'No camera' },
    { id: 'muted',      emoji: '🔇📹', label: 'Camera Only',    desc: 'Muted, camera on' },
    { id: 'viewer',     emoji: '👁️',   label: 'View Only',      desc: 'No mic or camera' },
  ];

  const allPeople = [meeting.createdBy, ...(meeting.participants || [])].filter(Boolean);

  return (
    <div className="mc-join-screen">
      <div className="mc-join-card">
        <div className="mc-join-header">
          <div>
            <div className="mc-join-title">{meeting.title}</div>
            <div className="mc-join-meta">
              {meeting.type === 'voice' ? '🎙️ Voice' : '📹 Video'} ·&nbsp;
              <code className="mc-join-code-inline">{meeting.meetingId}</code>
            </div>
          </div>
          <button className="mc-modal-close" onClick={handleCancel}>✕</button>
        </div>

        {/* Participants */}
        <div className="mc-join-participants">
          <div className="mc-join-sect-label">In this meeting ({allPeople.length})</div>
          <div className="mc-join-people-row">
            {allPeople.map((p, i) => (
              <div key={i} className="mc-join-person">
                <Avatar name={p} size={40} style={{ border: '2px solid var(--border)' }} />
                <div className="mc-join-person-name">{p}</div>
                {p === meeting.createdBy && <span className="mc-join-host-tag">Host</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="mc-join-preview">
          <div className="mc-join-cam-preview">
            {camOn && stream ? (
              <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Avatar name={currentUser?.name || 'You'} size={64} />
            )}
            <div className="mc-join-preview-label">Your Preview</div>
            {!camOn && <div className="mc-join-cam-off-badge">📷 Camera Off</div>}
          </div>
          <div className="mc-join-device-toggles">
            <button className={`mc-join-toggle ${micOn ? 'on' : 'off'}`} onClick={() => setMicOn(m => !m)}>
              {micOn ? '🎙️' : '🔇'} <span>{micOn ? 'Mic On' : 'Mic Off'}</span>
            </button>
            {meeting.type !== 'voice' && (
              <button className={`mc-join-toggle ${camOn ? 'on' : 'off'}`} onClick={() => setCamOn(c => !c)}>
                {camOn ? '📹' : '📷'} <span>{camOn ? 'Cam On' : 'Cam Off'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Mode select */}
        <div className="mc-join-modes">
          <div className="mc-join-sect-label">Join as</div>
          <div className="mc-join-mode-grid">
            {MODES.filter(m => meeting.type === 'voice' ? m.id !== 'muted' : true).map(m => (
              <button key={m.id} className={`mc-join-mode-btn ${mode === m.id ? 'selected' : ''}`} onClick={() => setMode(m.id)}>
                <span className="mc-join-mode-icon">{m.emoji}</span>
                <span className="mc-join-mode-label">{m.label}</span>
                <span className="mc-join-mode-desc">{m.desc}</span>
                {mode === m.id && <svg className="mc-join-mode-check" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>}
              </button>
            ))}
          </div>
        </div>

        {/* Access code reminder */}
        <div className="mc-join-access-info">
          <span>🔑</span>
          <span>Access code: <code>{meeting.accessCode}</code></span>
          <button className="mc-copy-btn" onClick={() => navigator.clipboard?.writeText(meeting.accessCode)}>Copy</button>
        </div>

        <div className="mc-join-actions">
          <button className="mc-btn-secondary" onClick={handleCancel}>Cancel</button>
          <button className="mc-btn-primary mc-join-now-btn" onClick={handleJoin}>
            📹 Join Now
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ADD PEOPLE MODAL
═══════════════════════════════════════════════════════════════════════════ */
function AddPeopleModal({ users, currentParticipants, onClose, onAdd }) {
  const [selected, setSelected] = useState([]);
  const available = users.filter(u => !currentParticipants.includes(u.displayName));
  const toggle = n => setSelected(p => p.includes(n) ? p.filter(x => x !== n) : [...p, n]);

  return (
    <div className="mc-modal-overlay" onClick={onClose}>
      <div className="mc-modal mc-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="mc-modal-header">
          <div className="mc-modal-title">👥 Add People</div>
          <button className="mc-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="mc-modal-body">
          <div className="mc-form-row">
            <label className="mc-form-label">Select to invite</label>
            <div className="mc-invitees-grid">
              {available.length === 0
                ? <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Everyone is already in this meeting.</div>
                : available.map(u => {
                  const sel = selected.includes(u.displayName);
                  return (
                    <label key={u.accountId} className={`mc-invitee-chip ${sel ? 'selected' : ''}`}>
                      <input type="checkbox" checked={sel} onChange={() => toggle(u.displayName)} style={{ display: 'none' }} />
                      <Avatar name={u.displayName} size={22} />
                      <span>{u.displayName}</span>
                      {sel && <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>}
                    </label>
                  );
                })
              }
            </div>
          </div>
          <div className="mc-modal-footer">
            <button className="mc-btn-secondary" onClick={onClose}>Close</button>
            <button className="mc-btn-primary" disabled={!selected.length} onClick={() => { onAdd(selected); onClose(); }}>
              Add {selected.length > 0 ? `(${selected.length})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ZOOM-LIKE INTERACTIVE WHITEBOARD
   with Pen, Eraser, brush sizes, colors, dark/light themes, and PNG export
═══════════════════════════════════════════════════════════════════════════ */
function MeetingWhiteboard({ onClose }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const isDrawingRef = useRef(false);
  
  const [boardTheme, setBoardTheme] = useState('dark'); // 'dark' | 'light'
  const [tool, setTool] = useState('pen'); // 'pen' | 'eraser'
  
  const darkColors = ['#ffffff', '#ff7b72', '#58a6ff', '#3fb950', '#d29922', '#bc8cff'];
  const lightColors = ['#21262d', '#cf222e', '#0969da', '#1a7f37', '#c6500a', '#8250df'];
  
  const colors = boardTheme === 'dark' ? darkColors : lightColors;
  const [brushColor, setBrushColor] = useState(colors[0]);
  const [brushSize, setBrushSize] = useState(5);

  useEffect(() => {
    setBrushColor(boardTheme === 'dark' ? '#ffffff' : '#21262d');
  }, [boardTheme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctxRef.current = ctx;
    
    // Set initial background
    ctx.fillStyle = boardTheme === 'dark' ? '#0d0f12' : '#f6f8fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const toggleTheme = () => {
    const newTheme = boardTheme === 'dark' ? 'light' : 'dark';
    setBoardTheme(newTheme);
    
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, 0, 0);
    
    ctx.fillStyle = newTheme === 'dark' ? '#0d0f12' : '#f6f8fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.drawImage(tempCanvas, 0, 0);
  };

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    
    return { x, y };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = ctxRef.current;
    if (!ctx) return;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawingRef.current = true;
  };

  const draw = (e) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = ctxRef.current;
    if (!ctx) return;

    ctx.lineTo(x, y);
    ctx.strokeStyle = tool === 'eraser' 
      ? (boardTheme === 'dark' ? '#0d0f12' : '#f6f8fa') 
      : brushColor;
    ctx.lineWidth = brushSize;
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawingRef.current) {
      ctxRef.current?.closePath();
      isDrawingRef.current = false;
    }
  };

  const clearCanvas = () => {
    if (!window.confirm('Clear the whiteboard?')) return;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    
    ctx.fillStyle = boardTheme === 'dark' ? '#0d0f12' : '#f6f8fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const exportCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `Whiteboard-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div className="mc-whiteboard-container">
      <div className="mc-whiteboard-toolbar">
        <div className="mc-wb-group">
          <button 
            type="button"
            className={`mc-wb-btn ${tool === 'pen' ? 'active' : ''}`} 
            onClick={() => setTool('pen')}
            title="Pen"
          >
            🖌️
          </button>
          <button 
            type="button"
            className={`mc-wb-btn ${tool === 'eraser' ? 'active' : ''}`} 
            onClick={() => setTool('eraser')}
            title="Eraser"
          >
            🧽
          </button>
        </div>

        {tool === 'pen' && (
          <div className="mc-wb-group">
            {colors.map(c => (
              <button 
                type="button"
                key={c}
                className={`mc-wb-color-chip ${brushColor === c ? 'active' : ''}`}
                style={{ background: c }}
                onClick={() => setBrushColor(c)}
              />
            ))}
          </div>
        )}

        <div className="mc-wb-group">
          {[2, 5, 12, 24].map(sz => (
            <button 
              type="button"
              key={sz}
              className={`mc-wb-size-chip ${brushSize === sz ? 'active' : ''}`}
              onClick={() => setBrushSize(sz)}
            >
              {sz === 2 ? 'Small' : sz === 5 ? 'Medium' : sz === 12 ? 'Large' : 'XL'}
            </button>
          ))}
        </div>

        <div className="mc-wb-group">
          <button type="button" className="mc-wb-action-btn" onClick={toggleTheme}>
            🌓 Theme: {boardTheme === 'dark' ? 'Dark' : 'Light'}
          </button>
          <button type="button" className="mc-wb-action-btn" onClick={clearCanvas}>
            🗑️ Clear
          </button>
          <button type="button" className="mc-wb-action-btn" onClick={exportCanvas} style={{ color: '#58a6ff', borderColor: 'rgba(88,166,255,0.3)' }}>
            💾 Save PNG
          </button>
        </div>
      </div>

      <div className={`mc-whiteboard-canvas-wrapper theme-${boardTheme}`}>
        <canvas 
          ref={canvasRef} 
          className="mc-whiteboard-canvas"
          width={1920}
          height={1080}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   IN-MEETING OVERLAY — with suspend, chat/notes/info tabs, add people
═══════════════════════════════════════════════════════════════════════════ */
function InMeetingOverlay({ meeting, currentUser, joinOptions, allUsers, onEnd, onSuspend, onAddParticipant, onParticipantJoined, onSendMessage }) {
  const [muted,        setMuted]        = useState(!joinOptions?.micOn);
  const [videoOn,      setVideoOn]      = useState(joinOptions?.camOn || false);
  const [sharing,      setSharing]      = useState(false);
  const [handRaised,   setHandRaised]   = useState(false);
  const [sidePanel,    setSidePanel]    = useState(null); // null | 'chat' | 'participants' | 'notes' | 'info'
  const [chatTab,      setChatTab]      = useState('chat'); // chat | notes | info
  const [chatMessages, setChatMessages] = useState(meeting.messages || []);
  const [chatInput,    setChatInput]    = useState('');
  const [notes,        setNotes]        = useState(() => {
    try { return localStorage.getItem(`dc_notes_${meeting.meetingId}`) || ''; } catch { return ''; }
  });
  
  // Active/Joined participants shown in grid/mini row
  const [participants, setParticipants] = useState(meeting.participants || []);
  useEffect(() => setParticipants(meeting.participants || []), [meeting.participants]);
  
  // Teams-style invited participants tracker
  // { [displayName]: { status: 'calling' | 'declined' | 'no-answer' | 'joined', timeLeft: 15 } }
  const [invitedParticipants, setInvitedParticipants] = useState({});
  const [whiteboardActive, setWhiteboardActive] = useState(false);
  const [showAddPeople, setShowAddPeople] = useState(false);
  const [elapsed,      setElapsed]      = useState(meeting._resumeElapsed || 0);
  const [screenStream, setScreenStream] = useState(null);
  const [videoStream,  setVideoStream]  = useState(null);
  const myVideoRef = useRef(null);
  const chatEndRef = useRef(null);
  const elapsedRef = useRef(elapsed);
  elapsedRef.current = elapsed;

  // Notification helper
  const myName = currentUser?.name || 'You';

  useEffect(() => {
    let activeStream = null;
    if (videoOn || !muted) {
      navigator.mediaDevices.getUserMedia({ video: videoOn, audio: !muted })
        .then(s => {
          activeStream = s;
          setVideoStream(s);
          if (myVideoRef.current && videoOn) myVideoRef.current.srcObject = s;
        }).catch(console.error);
    } else {
      setVideoStream(null);
    }
    return () => {
      if (activeStream) activeStream.getTracks().forEach(t => t.stop());
    };
  }, [videoOn, muted]);

  useEffect(() => { const t = setInterval(() => setElapsed(e => e + 1), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);
  useEffect(() => () => { screenStream?.getTracks().forEach(t => t.stop()); }, [screenStream]);
  
  useEffect(() => {
    try { localStorage.setItem(`dc_notes_${meeting.meetingId}`, notes); } catch {}
  }, [notes, meeting.meetingId]);

  // Outgoing Invite Ringing Countdown timer
  useEffect(() => {
    const activeInvites = Object.entries(invitedParticipants).filter(([_, data]) => data.status === 'calling');
    if (activeInvites.length === 0) return;

    const interval = setInterval(() => {
      setInvitedParticipants(prev => {
        const updated = { ...prev };
        let changed = false;
        for (const [name, data] of Object.entries(updated)) {
          if (data.status === 'calling') {
            if (data.timeLeft <= 1) {
              updated[name] = { ...data, status: 'no-answer', timeLeft: 0 };
              pushNotif('⚠️ Did not answer', `${name} did not answer the call invite.`);
              changed = true;
            } else {
              updated[name] = { ...data, timeLeft: data.timeLeft - 1 };
              changed = true;
            }
          }
        }
        return changed ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [invitedParticipants]);

  // Invitation actions
  const triggerInvite = (name) => {
    setInvitedParticipants(prev => ({
      ...prev,
      [name]: { status: 'calling', timeLeft: 15 }
    }));
    pushNotif('📞 Calling', `Calling ${name}...`, () => window.focus());
  };

  const handleAcceptInvite = (name) => {
    setInvitedParticipants(prev => ({
      ...prev,
      [name]: { ...prev[name], status: 'joined', timeLeft: 0 }
    }));
    setParticipants(prev => [...new Set([...prev, name])]);
    pushNotif('👋 Joined', `${name} joined the meeting`);
    if (onParticipantJoined) {
      onParticipantJoined(name);
    }
  };

  const handleDeclineInvite = (name) => {
    setInvitedParticipants(prev => ({
      ...prev,
      [name]: { ...prev[name], status: 'declined', timeLeft: 0 }
    }));
    pushNotif('❌ Call Declined', `${name} declined the call invite`);
  };

  const handleTimeoutInvite = (name) => {
    setInvitedParticipants(prev => ({
      ...prev,
      [name]: { ...prev[name], status: 'no-answer', timeLeft: 0 }
    }));
    pushNotif('⚠️ Did not answer', `${name} missed the call`);
  };

  const handleCallBack = (name) => {
    triggerInvite(name);
  };

  const handleScreenShare = async () => {
    if (sharing) { 
      screenStream?.getTracks().forEach(t => t.stop()); 
      setScreenStream(null); 
      setSharing(false); 
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setScreenStream(stream); 
        setSharing(true);
        setWhiteboardActive(false); // Disable whiteboard if sharing screen
        stream.getTracks()[0].onended = () => { setSharing(false); setScreenStream(null); };
      } catch {}
    }
  };

  const toggleWhiteboard = () => {
    if (!whiteboardActive) {
      setWhiteboardActive(true);
      if (sharing) {
        screenStream?.getTracks().forEach(t => t.stop());
        setScreenStream(null);
        setSharing(false);
      }
    } else {
      setWhiteboardActive(false);
    }
  };

  const sendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const newMsg = { id: Date.now(), sender: currentUser?.name || 'You', text: chatInput.trim(), timestamp: new Date().toISOString() };
    setChatMessages(prev => [...prev, newMsg]);
    if (onSendMessage) onSendMessage(newMsg);
    setChatInput('');
  };

  const copyMeetingId   = () => navigator.clipboard?.writeText(meeting.meetingId);
  const copyAccessCode  = () => navigator.clipboard?.writeText(meeting.accessCode);

  const toggleSide = (panel) => setSidePanel(p => p === panel ? null : panel);

  return (
    <div className="mc-overlay">
      {/* Outgoing Call Simulator Panel */}
      {Object.entries(invitedParticipants).some(([_, data]) => data.status === 'calling') && (
        <div className="teams-simulation-banner">
          <div className="teams-simulation-header">
            <span>Teams Call Simulator</span>
          </div>
          <div className="teams-simulation-body">
            {Object.entries(invitedParticipants)
              .filter(([_, data]) => data.status === 'calling')
              .map(([name, data]) => (
                <div className="teams-simulation-item" key={name}>
                  <div className="teams-simulation-name">Calling {name}...</div>
                  <div style={{ fontSize: '10px', color: '#8b949e', marginBottom: '4px' }}>
                    Auto-timeout in {data.timeLeft}s
                  </div>
                  <div className="teams-simulation-timer-wrap">
                    <div 
                      className="teams-simulation-timer-bar" 
                      style={{ width: `${(data.timeLeft / 15) * 100}%` }} 
                    />
                  </div>
                  <div className="teams-simulation-actions" style={{ marginTop: '8px' }}>
                    <button 
                      type="button"
                      className="teams-sim-btn accept" 
                      onClick={() => handleAcceptInvite(name)}
                    >
                      ✔️ Accept
                    </button>
                    <button 
                      type="button"
                      className="teams-sim-btn decline" 
                      onClick={() => handleDeclineInvite(name)}
                    >
                      ❌ Decline
                    </button>
                    <button 
                      type="button"
                      className="teams-sim-btn timeout" 
                      onClick={() => handleTimeoutInvite(name)}
                    >
                      ⌛ Timeout
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ─── Top bar ─── */}
      <div className="mc-topbar">
        <div className="mc-topbar-left">
          <div className="mc-call-type-badge">
            {meeting.type === 'voice' ? '🎙️ Voice' : '📹 Video'}
          </div>
          <div className="mc-meeting-name">{meeting.title}</div>
          <code className="mc-topbar-mid-id">{meeting.meetingId}</code>
          {joinOptions?.mode === 'viewer' && <span className="mc-viewer-badge">👁️ View Only</span>}
        </div>
        <div className="mc-topbar-center">
          <div className="mc-live-dot" />
          <div className="mc-timer">{fmt(elapsed)}</div>
        </div>
        <div className="mc-topbar-right">
          <button className={`mc-ctrl-sm ${sidePanel === 'participants' ? 'active' : ''}`}
            onClick={() => toggleSide('participants')}>
            👥 {participants.length + 1}
          </button>
          <button className={`mc-ctrl-sm ${sidePanel === 'chat' ? 'active' : ''}`}
            onClick={() => { setSidePanel(p => p === 'chat' ? null : 'chat'); setChatTab('chat'); }}>
            💬 Chat
            {chatMessages.length > 0 && <span className="mc-badge">{chatMessages.length}</span>}
          </button>
          <button className={`mc-ctrl-sm ${sidePanel === 'notes' ? 'active' : ''}`}
            onClick={() => { setSidePanel(p => p === 'notes' ? null : 'notes'); setChatTab('notes'); }}>
            📝 Notes
          </button>
          <button className={`mc-ctrl-sm ${sidePanel === 'info' ? 'active' : ''}`}
            onClick={() => { setSidePanel(p => p === 'info' ? null : 'info'); setChatTab('info'); }}>
            🔑 Info
          </button>
        </div>
      </div>

      {/* ─── Main ─── */}
      <div className="mc-main">
        <div className={`mc-layout-container ${sidePanel ? 'mc-grid-shrink' : ''}`}>
          {whiteboardActive ? (
            /* Whiteboard Split View */
            <div className="mc-sharing-layout">
              <MeetingWhiteboard onClose={() => setWhiteboardActive(false)} />
              
              {/* Horizontal Participant mini grid */}
              <div className="mc-participants-row">
                <div className="mc-video-tile-mini mc-you-tile">
                  {videoOn && videoStream ? (
                    <video ref={myVideoRef} autoPlay muted playsInline style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                  ) : (
                    <Avatar name={currentUser?.name || 'You'} size={32} />
                  )}
                  <div className="mc-tile-name-mini">You{muted ? ' 🔇' : ''}</div>
                  {handRaised && <div className="mc-hand-badge-mini">✋</div>}
                </div>
                {participants.map((p, i) => (
                  <div key={i} className="mc-video-tile-mini">
                    <Avatar name={p} size={32} />
                    <div className="mc-tile-name-mini">{p}</div>
                    <div className="mc-tile-muted-mini">🔇</div>
                  </div>
                ))}
              </div>
            </div>
          ) : sharing ? (
            /* Screen Sharing Split View */
            <div className="mc-sharing-layout">
              <div className="mc-screen-tile-large">
                <video ref={el => { if (el && screenStream) el.srcObject = screenStream; }} className="mc-screen-video" muted autoPlay playsInline />
                <div className="mc-screen-label">📺 You are sharing your screen</div>
              </div>
              
              {/* Horizontal Participant mini grid */}
              <div className="mc-participants-row">
                <div className="mc-video-tile-mini mc-you-tile">
                  {videoOn && videoStream ? (
                    <video ref={myVideoRef} autoPlay muted playsInline style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                  ) : (
                    <Avatar name={currentUser?.name || 'You'} size={32} />
                  )}
                  <div className="mc-tile-name-mini">You{muted ? ' 🔇' : ''}</div>
                  {handRaised && <div className="mc-hand-badge-mini">✋</div>}
                </div>
                {participants.map((p, i) => (
                  <div key={i} className="mc-video-tile-mini">
                    <Avatar name={p} size={32} />
                    <div className="mc-tile-name-mini">{p}</div>
                    <div className="mc-tile-muted-mini">🔇</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Standard Grid View */
            <div className="mc-grid" style={{ height: '100%' }}>
              {participants.map((p, i) => (
                <div key={i} className="mc-video-tile">
                  <Avatar name={p} size={56} />
                  <div className="mc-tile-name">{p}</div>
                  <div className="mc-tile-muted">🔇</div>
                </div>
              ))}
              <div className="mc-video-tile mc-you-tile">
                {videoOn && videoStream ? (
                  <video ref={myVideoRef} autoPlay muted playsInline style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                ) : (
                  <Avatar name={currentUser?.name || 'You'} size={56} />
                )}
                <div className="mc-tile-name" style={{ zIndex: 2 }}>You{muted ? ' 🔇' : ''}</div>
                {handRaised && <div className="mc-hand-badge" style={{ zIndex: 2 }}>✋</div>}
              </div>
            </div>
          )}
        </div>

        {/* ─── Side panel ─── */}
        {sidePanel && (
          <div className="mc-side-panel">
            {/* Participants */}
            {sidePanel === 'participants' && (
              <>
                <div className="mc-panel-header">
                  <span>People ({participants.length + 1})</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="mc-ctrl-sm" onClick={() => setShowAddPeople(true)} style={{ fontSize: 11 }}>+ Add</button>
                    <button className="mc-panel-close" onClick={() => setSidePanel(null)}>✕</button>
                  </div>
                </div>
                <div className="mc-panel-body">
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#8b949e', margin: '8px 0 4px 12px', textTransform: 'uppercase' }}>
                    In this meeting ({participants.length + 1})
                  </div>
                  
                  <div className="mc-participant-row mc-you-row">
                    <Avatar name={currentUser?.name || 'You'} size={36} />
                    <div className="mc-participant-info">
                      <div className="mc-participant-name">{currentUser?.name || 'You'} <span className="mc-you-tag">(You)</span></div>
                      <div className="mc-participant-status">{joinOptions?.mode === 'viewer' ? '👁️ Viewer' : muted ? '🔇 Muted' : '🎙️ Speaking'}</div>
                    </div>
                  </div>
                  {participants.map((p, i) => (
                    <div key={i} className="mc-participant-row">
                      <Avatar name={p} size={36} />
                      <div className="mc-participant-info">
                        <div className="mc-participant-name">{p}</div>
                        <div className="mc-participant-status">🔇 Muted</div>
                      </div>
                    </div>
                  ))}

                  {/* Teams Style Invited Section */}
                  {Object.keys(invitedParticipants).length > 0 && (
                    <>
                      <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#8b949e', margin: '18px 0 4px 12px', textTransform: 'uppercase' }}>
                        Others Invited ({Object.keys(invitedParticipants).length})
                      </div>
                      {Object.entries(invitedParticipants).map(([name, data]) => (
                        <div className="mc-participant-row" key={name}>
                          <Avatar name={name} size={36} style={{ opacity: data.status === 'joined' ? 1 : 0.6 }} />
                          <div className="mc-participant-info" style={{ flex: 1 }}>
                            <div className="mc-participant-name" style={{ color: data.status === 'joined' ? '#c9d1d9' : '#8b949e' }}>
                              {name}
                            </div>
                            <div className="mc-participant-status" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px' }}>
                              {data.status === 'calling' && <span className="pulse-calling-dot" />}
                              {data.status === 'calling' && <span style={{ color: '#58a6ff' }}>Calling...</span>}
                              {data.status === 'declined' && <span style={{ color: '#ff7b72' }}>Declined</span>}
                              {data.status === 'no-answer' && <span style={{ color: '#8b949e' }}>Did not answer</span>}
                              {data.status === 'joined' && <span style={{ color: '#3fb950' }}>Joined</span>}
                            </div>
                          </div>
                          {(data.status === 'declined' || data.status === 'no-answer') && (
                            <button 
                              type="button"
                              className="mc-ctrl-sm" 
                              onClick={() => handleCallBack(name)} 
                              style={{ padding: '2px 8px', fontSize: '10px', background: '#21262d', border: '1px solid #30363d', color: '#58a6ff' }}
                            >
                              Call back
                            </button>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </>
            )}

            {/* Chat / Notes / Info tabs */}
            {(sidePanel === 'chat' || sidePanel === 'notes' || sidePanel === 'info') && (
              <>
                <div className="mc-panel-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Meeting Sidebar</span>
                    <button className="mc-panel-close" onClick={() => setSidePanel(null)}>✕</button>
                  </div>
                  <div className="mc-panel-tabs">
                    {['chat', 'notes', 'info'].map(t => (
                      <button key={t} className={`mc-panel-tab ${chatTab === t ? 'active' : ''}`}
                        onClick={() => { setChatTab(t); setSidePanel(t); }}>
                        {t === 'chat' ? '💬 Chat' : t === 'notes' ? '📝 Notes' : '🔑 Info'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CHAT */}
                {chatTab === 'chat' && (
                  <>
                    <div className="mc-chat-messages">
                      {chatMessages.length === 0 && <div className="mc-chat-empty">No messages yet. Say hello! 👋</div>}
                      {chatMessages.map(m => (
                        <div key={m.id} className={`mc-chat-msg ${m.sender === (currentUser?.name || 'You') ? 'mc-chat-mine' : ''}`}>
                          <div className="mc-chat-sender">{m.sender}</div>
                          <div className="mc-chat-bubble">{m.text}</div>
                          <div className="mc-chat-time">{fmtTime(m.time)}</div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                    <form className="mc-chat-form" onSubmit={sendChat}>
                      <input className="mc-chat-input" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Type a message…" />
                      <button type="submit" className="mc-chat-send">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                      </button>
                    </form>
                  </>
                )}

                {/* NOTES */}
                {chatTab === 'notes' && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 12, gap: 8 }}>
                    <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>
                      📝 Notes auto-saved · {meeting.meetingId}
                    </div>
                    <textarea
                      className="mc-notes-textarea"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder={`Meeting Notes — ${meeting.title}\n\nKey points:\n- \n\nAction items:\n- \n\nDecisions:\n- `}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="mc-btn-secondary" style={{ fontSize: 11, padding: '5px 10px' }}
                        onClick={() => navigator.clipboard?.writeText(notes)}>
                        📋 Copy Notes
                      </button>
                      <button className="mc-btn-secondary" style={{ fontSize: 11, padding: '5px 10px', color: 'var(--danger)' }}
                        onClick={() => { if (window.confirm('Clear all notes?')) setNotes(''); }}>
                        🗑 Clear
                      </button>
                    </div>
                  </div>
                )}

                {/* MEETING INFO */}
                {chatTab === 'info' && (
                  <div className="mc-info-panel">
                    <div className="mc-info-section">
                      <div className="mc-info-label">Meeting Title</div>
                      <div className="mc-info-value">{meeting.title}</div>
                    </div>
                    <div className="mc-info-section">
                      <div className="mc-info-label">Meeting ID</div>
                      <div className="mc-info-value mc-info-code">
                        <code>{meeting.meetingId}</code>
                        <button className="mc-copy-btn" onClick={copyMeetingId}>Copy</button>
                      </div>
                    </div>
                    <div className="mc-info-section">
                      <div className="mc-info-label">Access Code</div>
                      <div className="mc-info-value mc-info-code">
                        <code className="mc-access-code-big">{meeting.accessCode}</code>
                        <button className="mc-copy-btn" onClick={copyAccessCode}>Copy</button>
                      </div>
                      <div className="mc-info-hint">Share this code only with invited participants</div>
                    </div>
                    <div className="mc-info-section">
                      <div className="mc-info-label">Type</div>
                      <div className="mc-info-value">{meeting.type === 'voice' ? '🎙️ Voice Call' : '📹 Video Meeting'}</div>
                    </div>
                    <div className="mc-info-section">
                      <div className="mc-info-label">Duration</div>
                      <div className="mc-info-value">⏱ {fmt(elapsed)}</div>
                    </div>
                    <div className="mc-info-section">
                      <div className="mc-info-label">Host</div>
                      <div className="mc-info-value">{meeting.createdBy}</div>
                    </div>
                    <div className="mc-info-section">
                      <div className="mc-info-label">Participants ({participants.length + 1})</div>
                      <div className="mc-info-people">
                        {[currentUser?.name || 'You', ...participants].map((p, i) => (
                          <div key={i} className="mc-info-person">
                            <Avatar name={p} size={24} />
                            <span>{p}</span>
                            {i === 0 && <span className="mc-you-tag">(You)</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                    <button className="mc-btn-secondary" style={{ margin: '8px 12px', fontSize: 12 }}
                      onClick={() => navigator.clipboard?.writeText(`Join my meeting!\nID: ${meeting.meetingId}\nCode: ${meeting.accessCode}`)}>
                      📤 Share Invite
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ─── Controls ─── */}
      <div className="mc-controls">
        {joinOptions?.mode !== 'viewer' && (
          <>
            <button className={`mc-ctrl-btn ${muted ? 'mc-ctrl-danger' : ''}`} onClick={() => setMuted(m => !m)}>
              <span style={{ fontSize: 18 }}>{muted ? '🔇' : '🎙️'}</span>
              <span>{muted ? 'Unmute' : 'Mute'}</span>
            </button>
            {meeting.type !== 'voice' && (
              <button className={`mc-ctrl-btn ${!videoOn ? 'mc-ctrl-danger' : ''}`} onClick={() => setVideoOn(v => !v)}>
                <span style={{ fontSize: 18 }}>{videoOn ? '📹' : '📷'}</span>
                <span>{videoOn ? 'Stop Cam' : 'Start Cam'}</span>
              </button>
            )}
            <button className={`mc-ctrl-btn ${sharing ? 'mc-ctrl-active' : ''}`} onClick={handleScreenShare}>
              <span style={{ fontSize: 18 }}>🖥️</span>
              <span>{sharing ? 'Stop Share' : 'Share'}</span>
            </button>
            {meeting.type !== 'voice' && (
              <button className={`mc-ctrl-btn ${whiteboardActive ? 'mc-ctrl-active' : ''}`} onClick={toggleWhiteboard}>
                <span style={{ fontSize: 18 }}>🎨</span>
                <span>Whiteboard</span>
              </button>
            )}
            <button className={`mc-ctrl-btn ${handRaised ? 'mc-ctrl-active' : ''}`} onClick={() => setHandRaised(h => !h)}>
              <span style={{ fontSize: 18 }}>✋</span>
              <span>{handRaised ? 'Lower' : 'Raise Hand'}</span>
            </button>
          </>
        )}
        <button className={`mc-ctrl-btn ${sidePanel === 'chat' ? 'mc-ctrl-active' : ''}`}
          onClick={() => { toggleSide('chat'); setChatTab('chat'); }}>
          <span style={{ fontSize: 18 }}>💬</span><span>Chat</span>
        </button>
        <button className={`mc-ctrl-btn ${sidePanel === 'notes' ? 'mc-ctrl-active' : ''}`}
          onClick={() => { toggleSide('notes'); setChatTab('notes'); }}>
          <span style={{ fontSize: 18 }}>📝</span><span>Notes</span>
        </button>
        <button className={`mc-ctrl-btn ${sidePanel === 'participants' ? 'mc-ctrl-active' : ''}`}
          onClick={() => toggleSide('participants')}>
          <span style={{ fontSize: 18 }}>👥</span><span>People</span>
        </button>
        <button className="mc-ctrl-btn" onClick={() => setShowAddPeople(true)}>
          <span style={{ fontSize: 18 }}>➕</span><span>Add</span>
        </button>

        <div className="mc-ctrl-divider" />

        {/* Suspend */}
        <button className="mc-ctrl-btn mc-ctrl-suspend" onClick={() => onSuspend(elapsedRef.current)}
          title="Suspend and resume later">
          <span style={{ fontSize: 18 }}>⏸</span><span>Suspend</span>
        </button>

        {/* End */}
        <button className="mc-ctrl-btn mc-ctrl-end" onClick={() => onEnd(elapsedRef.current)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
          </svg>
          <span>End Call</span>
        </button>
      </div>

      {showAddPeople && (
        <AddPeopleModal
          users={allUsers}
          currentParticipants={[currentUser?.name || 'You', ...participants]}
          onClose={() => setShowAddPeople(false)}
          onAdd={names => {
            names.forEach(name => triggerInvite(name));
            onAddParticipant(names);
            setShowAddPeople(false);
          }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCHEDULE MODAL
═══════════════════════════════════════════════════════════════════════════ */
function ScheduleModal({ users, currentUser, onClose, onSave, editMeeting }) {
  const now = new Date(); now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
  const [title,      setTitle]      = useState(editMeeting?.title || '');
  const [dateTime,   setDateTime]   = useState(editMeeting?.scheduledAt?.slice(0, 16) || now.toISOString().slice(0, 16));
  const [duration,   setDuration]   = useState(editMeeting?.duration || 30);
  const [type,       setType]       = useState(editMeeting?.type || 'video');
  const [recurrence, setRecurrence] = useState(editMeeting?.recurrence || 'none');
  const [invitees,   setInvitees]   = useState(editMeeting?.participants || []);
  const [agenda,     setAgenda]     = useState(editMeeting?.agenda || '');
  const [error,      setError]      = useState('');
  const [generated,  setGenerated]  = useState(null); // show IDs after save

  const myName     = currentUser?.name || 'You';
  const otherUsers = users.filter(u => u.displayName !== myName);
  const toggle     = n => setInvitees(p => p.includes(n) ? p.filter(x => x !== n) : [...p, n]);

  const submit = (e) => {
    e.preventDefault();
    if (!title.trim()) return setError('Title required.');
    if (!invitees.length) return setError('Invite at least one participant.');
    setError('');
    const meetingId  = editMeeting?.meetingId  || generateMeetingId();
    const accessCode = editMeeting?.accessCode || generateAccessCode();
    const mtg = {
      id: editMeeting?.id || Date.now(),
      meetingId, accessCode,
      title: title.trim(),
      scheduledAt: new Date(dateTime).toISOString(),
      duration: Number(duration),
      type, recurrence,
      participants: invitees,
      agenda: agenda.trim(),
      createdBy: myName,
      status: 'scheduled',
    };
    onSave(mtg);
    setGenerated({ meetingId, accessCode });
  };

  if (generated) {
    return (
      <div className="mc-modal-overlay" onClick={onClose}>
        <div className="mc-modal mc-modal-sm" onClick={e => e.stopPropagation()}>
          <div className="mc-modal-header">
            <div className="mc-modal-title">✅ Meeting Scheduled!</div>
            <button className="mc-modal-close" onClick={onClose}>✕</button>
          </div>
          <div className="mc-modal-body">
            <div className="mc-generated-block">
              <div className="mc-gen-label">Meeting ID</div>
              <div className="mc-gen-code">{generated.meetingId}</div>
              <button className="mc-copy-btn" onClick={() => navigator.clipboard?.writeText(generated.meetingId)}>Copy</button>
            </div>
            <div className="mc-generated-block mc-generated-code">
              <div className="mc-gen-label">Access Code</div>
              <div className="mc-gen-code mc-gen-access">{generated.accessCode}</div>
              <button className="mc-copy-btn" onClick={() => navigator.clipboard?.writeText(generated.accessCode)}>Copy</button>
            </div>
            <div className="mc-gen-note">🔒 Share this access code <strong>only</strong> with invited participants. Only they can join.</div>
            <button className="mc-btn-primary" style={{ width: '100%', marginTop: 16, justifyContent: 'center' }}
              onClick={() => navigator.clipboard?.writeText(`Join my DevCobra meeting!\nTitle: ${title}\nID: ${generated.meetingId}\nCode: ${generated.accessCode}`)}>
              📤 Copy Full Invite
            </button>
            <div className="mc-modal-footer">
              <button className="mc-btn-secondary" onClick={onClose}>Done</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mc-modal-overlay" onClick={onClose}>
      <div className="mc-modal" onClick={e => e.stopPropagation()}>
        <div className="mc-modal-header">
          <div className="mc-modal-title">📅 {editMeeting ? 'Edit Meeting' : 'Schedule Meeting'}</div>
          <button className="mc-modal-close" onClick={onClose}>✕</button>
        </div>
        <form className="mc-modal-body" onSubmit={submit}>
          {error && <div className="mc-error-msg">{error}</div>}
          {editMeeting && (
            <div className="mc-existing-ids">
              ID: <code>{editMeeting.meetingId}</code> · Code: <code>{editMeeting.accessCode}</code>
            </div>
          )}
          <div className="mc-form-row">
            <label className="mc-form-label">Title *</label>
            <input className="mc-form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Sprint Planning, Design Review…" autoFocus />
          </div>
          <div className="mc-form-2col">
            <div className="mc-form-row">
              <label className="mc-form-label">Date & Time *</label>
              <input className="mc-form-input" type="datetime-local" value={dateTime} onChange={e => setDateTime(e.target.value)} />
            </div>
            <div className="mc-form-row">
              <label className="mc-form-label">Duration</label>
              <select className="mc-form-input" value={duration} onChange={e => setDuration(e.target.value)}>
                {[15,30,45,60,90,120].map(d => <option key={d} value={d}>{d < 60 ? `${d} min` : `${d/60}h`}</option>)}
              </select>
            </div>
          </div>
          <div className="mc-form-2col">
            <div className="mc-form-row">
              <label className="mc-form-label">Type</label>
              <div className="mc-type-toggle">
                <button type="button" className={`mc-type-btn ${type==='voice'?'active':''}`} onClick={()=>setType('voice')}>🎙️ Voice</button>
                <button type="button" className={`mc-type-btn ${type==='video'?'active':''}`} onClick={()=>setType('video')}>📹 Video</button>
              </div>
            </div>
            <div className="mc-form-row">
              <label className="mc-form-label">Recurrence</label>
              <select className="mc-form-input" value={recurrence} onChange={e => setRecurrence(e.target.value)}>
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every 2 weeks</option>
              </select>
            </div>
          </div>
          <div className="mc-form-row">
            <label className="mc-form-label">Invite Participants *</label>
            <div className="mc-invitees-grid">
              {otherUsers.map(u => {
                const sel = invitees.includes(u.displayName);
                return (
                  <label key={u.accountId} className={`mc-invitee-chip ${sel?'selected':''}`}>
                    <input type="checkbox" checked={sel} onChange={() => toggle(u.displayName)} style={{ display: 'none' }} />
                    <Avatar name={u.displayName} size={22} /><span>{u.displayName}</span>
                    {sel && <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>}
                  </label>
                );
              })}
              {otherUsers.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No other users found.</div>}
            </div>
          </div>
          <div className="mc-form-row">
            <label className="mc-form-label">Agenda</label>
            <textarea className="mc-form-input mc-form-textarea" value={agenda} onChange={e => setAgenda(e.target.value)} placeholder="What will be discussed…" rows={3} />
          </div>
          <div className="mc-modal-footer">
            <button type="button" className="mc-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="mc-btn-primary">{editMeeting ? 'Save Changes' : 'Schedule & Generate Code'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MEETING CARD
═══════════════════════════════════════════════════════════════════════════ */
function MeetingCard({ meeting, myName, onJoin, onResume, onEdit, onDelete, missed }) {
  const isHost    = meeting.createdBy === myName;
  const suspended = meeting.status === 'suspended';
  const allPeople = [meeting.createdBy, ...(meeting.participants || [])].filter(Boolean);

  return (
    <div className={`mc-meeting-card ${missed ? 'mc-card-missed' : ''} ${suspended ? 'mc-card-suspended' : ''}`}>
      <div className="mc-card-left">
        <div className={`mc-type-dot ${meeting.type === 'voice' ? 'voice' : 'video'}`}>
          {meeting.type === 'voice' ? '🎙️' : '📹'}
        </div>
        <div className="mc-card-time-col">
          <div className="mc-card-date">{fmtDate(meeting.scheduledAt)}</div>
          <div className="mc-card-time">{fmtTime(meeting.scheduledAt)}</div>
          <div className="mc-card-dur">{meeting.duration} min</div>
        </div>
      </div>

      <div className="mc-card-body">
        <div className="mc-card-title">{meeting.title}</div>
        <div className="mc-card-meta">
          {isHost   && <span className="mc-host-badge">Host</span>}
          {missed   && <span className="mc-missed-badge">Missed</span>}
          {suspended && <span className="mc-suspended-badge">⏸ Suspended · {fmt(meeting._suspendedElapsed || 0)}</span>}
          {meeting.recurrence && meeting.recurrence !== 'none' && <span className="mc-recur-badge">🔄 {meeting.recurrence}</span>}
        </div>
        <div className="mc-card-id-row">
          <code className="mc-card-mtg-id">{meeting.meetingId}</code>
          <span className="mc-card-code-sep">·</span>
          <span className="mc-card-access-code">🔑 {meeting.accessCode}</span>
        </div>
        {meeting.agenda && <div className="mc-card-agenda">{meeting.agenda}</div>}
        <div className="mc-card-people">
          {allPeople.slice(0, 5).map((n, i) => <Avatar key={i} name={n} size={26} style={{ marginLeft: i > 0 ? -8 : 0, border: '2px solid var(--bg-card)' }} />)}
          {allPeople.length > 5 && <div className="mc-people-more">+{allPeople.length - 5}</div>}
          <span className="mc-people-names">{allPeople.slice(0, 2).join(', ')}{allPeople.length > 2 ? ` +${allPeople.length - 2}` : ''}</span>
        </div>
      </div>

      <div className="mc-card-actions">
        {suspended && onResume && (
          <button className="mc-btn-resume" onClick={onResume}>▶ Resume</button>
        )}
        {!suspended && !missed && onJoin && (
          <button className="mc-btn-join" onClick={onJoin}>Join</button>
        )}
        {isHost && onEdit && !missed && !suspended && (
          <button className="mc-btn-icon" onClick={onEdit} title="Edit">✏️</button>
        )}
        {(isHost || missed || suspended) && onDelete && (
          <button className="mc-btn-icon mc-btn-danger-icon" onClick={onDelete} title="Delete">🗑</button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CALL LOG CARD
═══════════════════════════════════════════════════════════════════════════ */
function CallLogCard({ log, myName }) {
  const dur    = log.actualDuration || (log.endedAt && log.startedAt ? Math.round((new Date(log.endedAt) - new Date(log.startedAt)) / 1000) : 0);
  const isHost = log.host === myName;
  const others = (log.participants || []).filter(p => p !== myName);
  return (
    <div className="mc-log-card">
      <div className={`mc-type-dot ${log.type === 'voice' ? 'voice' : 'video'}`}>
        {log.type === 'voice' ? '🎙️' : '📹'}
      </div>
      <div className="mc-log-body">
        <div className="mc-log-title">{log.title}</div>
        <div className="mc-log-meta">
          {isHost && <span className="mc-host-badge">You hosted</span>}
          {log.joinMode && log.joinMode !== 'normal' && <span className="mc-recur-badge">joined as {log.joinMode}</span>}
          <span className="mc-log-people">with {others.length > 0 ? others.slice(0, 2).join(', ') : 'no one'}{others.length > 2 ? ` +${others.length - 2}` : ''}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          <code>{log.meetingId}</code>
        </div>
      </div>
      <div className="mc-log-right">
        <div className="mc-log-date">{fmtDT(log.endedAt)}</div>
        <div className="mc-log-duration">⏱ {fmt(dur)}</div>
        <div className={`mc-log-type-pill ${log.type}`}>{log.type === 'voice' ? '🎙️ Voice' : '📹 Video'}</div>
      </div>
    </div>
  );
}
function LobbyScreen({ meeting, currentUser, onLeave, onStartMeeting }) {
  return (
    <div className="mc-lobby-container">
      <div className="mc-lobby-card">
        <div className="mc-lobby-loading">
          <div className="mc-lobby-spinner" />
        </div>
        <h2 className="mc-lobby-title">Meeting Lobby</h2>
        <p className="mc-lobby-desc">⌛ Waiting for the host to start the meeting...</p>
        <div className="mc-lobby-details">
          <div className="mc-lobby-detail-row">
            <span className="mc-lobby-detail-label">Title:</span>
            <span className="mc-lobby-detail-val">{meeting.title}</span>
          </div>
          <div className="mc-lobby-detail-row">
            <span className="mc-lobby-detail-label">Host:</span>
            <span className="mc-lobby-detail-val">{meeting.createdBy}</span>
          </div>
          <div className="mc-lobby-detail-row">
            <span className="mc-lobby-detail-label">Scheduled:</span>
            <span className="mc-lobby-detail-val">{new Date(meeting.scheduledAt).toLocaleString()}</span>
          </div>
          <div className="mc-lobby-detail-row">
            <span className="mc-lobby-detail-label">Meeting ID:</span>
            <span className="mc-lobby-detail-val" style={{ fontFamily: 'monospace' }}>{meeting.meetingId}</span>
          </div>
        </div>
        <div className="mc-lobby-actions">
          <button type="button" className="mc-btn-secondary" style={{ width: '100%' }} onClick={onLeave}>Leave Lobby</button>
          <button type="button" className="mc-btn-primary" style={{ width: '100%', justifyContent: 'center', background: '#238636' }} onClick={onStartMeeting}>🚀 Simulate Host Starting Meeting</button>
        </div>
      </div>
    </div>
  );
}


const getAvatarColor = (name) => {
  if (!name) return '#6264a7';
  const colors = ['#e056fd', '#30336b', '#130cb7', '#10ac84', '#ff9f43', '#ee5253', '#0abde3', '#5f27cd'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN CALLS VIEW
   ═══════════════════════════════════════════════════════════════════════════ */
export default function CallsView({ user, issues = [], onOpenIssueDetails }) {
  const [users,         setUsers]         = useState([]);
  const [store,         setStore]         = useState(loadStore);
  const [screen,        setScreen]        = useState('main');
  const [pendingMtg,    setPendingMtg]    = useState(null);
  const [activeMeeting, setActiveMeeting] = useState(null);
  const [joinOptions,   setJoinOptions]   = useState(null);
  const [incomingCall,  setIncomingCall]  = useState(null);
  const [activeTab,     setActiveTab]     = useState('upcoming');
  const [showSchedule,  setShowSchedule]  = useState(false);
  const [showAccessGate,setShowAccessGate]= useState(false);
  const [showVoiceCall, setShowVoiceCall] = useState(false);
  const [editMeeting,   setEditMeeting]   = useState(null);
  const callingNotifRef = useRef(null);

  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [discussionTab, setDiscussionTab] = useState('chat');
  const [discussionSearch, setDiscussionSearch] = useState('');
  const [newMessageText, setNewMessageText] = useState('');
  const [newMessageIssue, setNewMessageIssue] = useState('');
  const [chatFilterIssue, setChatFilterIssue] = useState('');
  const [filterType, setFilterType] = useState('chats'); // 'chats' | 'meetings' | 'calls'
  const [favExpanded, setFavExpanded] = useState(true);
  const [recentExpanded, setRecentExpanded] = useState(true);

  // ── Team Channels (unified with personal chats, like MS Teams) ────────────
  const [teams, setTeams] = useState([]);
  const [teamsExpanded, setTeamsExpanded] = useState(true);
  const [selectedTeamChannel, setSelectedTeamChannel] = useState(null);
  const [teamChatMessages, setTeamChatMessages] = useState([]);
  const [teamChatText, setTeamChatText] = useState('');
  const [teamChatIssue, setTeamChatIssue] = useState('');
  const [teamDiscussionTab, setTeamDiscussionTab] = useState('chat');

  const renderMessageText = (text) => {
    const issueRegex = /([A-Z]+-[0-9]+)/g;
    const parts = text.split(issueRegex);
    return parts.map((part, i) => {
      if (part.match(issueRegex)) {
        return (
          <span 
            key={i} 
            className="chat-issue-badge" 
            onClick={() => onOpenIssueDetails && onOpenIssueDetails(part)}
          >
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  // Auto-select first meeting if available and none selected yet
  useEffect(() => {
    if (store.meetings.length > 0 && !selectedMeeting) {
      setSelectedMeeting(store.meetings[0]);
    }
  }, [store.meetings, selectedMeeting]);

  useEffect(() => { saveStore(store); }, [store]);
  useEffect(() => {
    reqNotif();
    axios.get(`${API}/users`).then(r => setUsers(r.data || [])).catch(() => {});
    // Fetch teams for the unified Chat sidebar
    axios.get(`${API}/teams`).then(r => setTeams(r.data || [])).catch(() => {});
  }, []);

  const handleSelectTeamChannel = useCallback(async (team) => {
    setSelectedTeamChannel(team);
    setSelectedMeeting(null); // deselect meeting
    setTeamChatText('');
    setTeamChatIssue('');
    setChatFilterIssue('');
    setTeamDiscussionTab('chat');
    try {
      const res = await axios.get(`${API}/teams/${team.id}/messages`, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      setTeamChatMessages(res.data || []);
    } catch (err) {
      console.error('Error loading team messages:', err);
      setTeamChatMessages([]);
    }
  }, [user]);

  const handleSendTeamMessage = useCallback(async (e) => {
    e.preventDefault();
    if (!teamChatText.trim() || !selectedTeamChannel) return;
    try {
      const res = await axios.post(`${API}/teams/${selectedTeamChannel.id}/messages`, {
        sender: user?.name || user?.email || 'You',
        text: teamChatText.trim(),
        issueKey: teamChatIssue || null,
        teamName: selectedTeamChannel.name
      }, { headers: { Authorization: `Bearer ${user?.token}` } });
      setTeamChatMessages(prev => [...prev, res.data]);
      setTeamChatText('');
      setTeamChatIssue('');
    } catch (err) {
      console.error('Error sending team message:', err);
    }
  }, [teamChatText, teamChatIssue, selectedTeamChannel, user]);

  const myName = user?.name || user?.email || 'You';

  const myMeetings       = store.meetings.filter(m => m.createdBy === myName || (m.participants || []).includes(myName));
  const upcomingMeetings = myMeetings.filter(m => (m.status === 'scheduled' || m.status === 'suspended') && new Date(m.scheduledAt) >= new Date()).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  const suspendedMeetings= myMeetings.filter(m => m.status === 'suspended');
  const pastMeetings     = store.callLogs.filter(l => (l.participants || []).includes(myName) || l.host === myName).sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt));
  const missedMeetings   = myMeetings.filter(m => m.status === 'scheduled' && new Date(m.scheduledAt) < new Date());
  const handleSendInCallMessage = (msg) => {
    setStore(prev => {
      const meetings = prev.meetings.map(m => {
        if (m.meetingId === activeMeeting?.meetingId) {
          return {
            ...m,
            messages: [...(m.messages || []), msg]
          };
        }
        return m;
      });
      const updatedStore = { ...prev, meetings };
      saveStore(updatedStore);
      return updatedStore;
    });

    setActiveMeeting(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: [...(prev.messages || []), msg]
      };
    });

    if (selectedMeeting && selectedMeeting.meetingId === activeMeeting?.meetingId) {
      setSelectedMeeting(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [...(prev.messages || []), msg]
        };
      });
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessageText.trim() || !selectedMeeting) return;
    
    const newMsg = {
      id: Date.now(),
      sender: myName,
      text: newMessageText.trim(),
      timestamp: new Date().toISOString(),
      issueKey: newMessageIssue || null
    };

    setStore(prev => {
      const meetings = prev.meetings.map(m => {
        if (m.meetingId === selectedMeeting.meetingId) {
          return {
            ...m,
            messages: [...(m.messages || []), newMsg]
          };
        }
        return m;
      });
      const updatedStore = { ...prev, meetings };
      saveStore(updatedStore);
      return updatedStore;
    });

    setSelectedMeeting(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: [...(prev.messages || []), newMsg]
      };
    });

    setNewMessageText('');
    setNewMessageIssue('');
  };

  /* ─── save meeting ─── */
  const saveMeeting = (m) => {
    setStore(prev => {
      const meetings = prev.meetings.some(x => x.id === m.id) ? prev.meetings.map(x => x.id === m.id ? m : x) : [...prev.meetings, m];
      return { ...prev, meetings };
    });

    // Notify invited participants!
    if (m.status === 'scheduled' && m.participants && m.participants.length > 0) {
      m.participants.forEach(p => {
        pushNotif(
          '📅 Meeting Invitation', 
          `You have been invited to "${m.title}" by ${m.createdBy} at ${new Date(m.scheduledAt).toLocaleTimeString()}`
        );
      });
      
      // Log simulated meeting invitation emails!
      axios.post(`${API}/emails/simulate-meeting-email`, {
        meeting: m
      }).catch(err => console.error("Failed to log simulated meeting email:", err));
    }

    setShowSchedule(false); setEditMeeting(null);
  };

  const deleteMeeting = id => setStore(prev => ({ ...prev, meetings: prev.meetings.filter(m => m.id !== id) }));

  /* ─── INITIATE call ─── */
  const initiateCall = (meeting) => {
    setShowVoiceCall(false);
    const mtg = { ...meeting, meetingId: meeting.meetingId || generateMeetingId(), accessCode: meeting.accessCode || generateAccessCode() };
    setPendingMtg(mtg);
    setScreen('calling');

    // Desktop notif to simulate Incoming Call on other side
    reqNotif().then(ok => {
      if (ok) {
        const names = (mtg.participants || []).join(', ') || 'someone';
        callingNotifRef.current = pushNotif(
          '📞 Incoming Call',
          `${myName} is calling — ${mtg.meetingId}`,
          () => { window.focus(); }
        );
      }
    });

    // After 2 seconds show incoming banner (simulates other person seeing the call)
    setTimeout(() => {
      setIncomingCall({ id: mtg.id, callerName: myName, type: mtg.type, title: mtg.title, meetingId: mtg.meetingId, participants: mtg.participants });
    }, 2000);
  };

  /* ─── Caller cancels ─── */
  const onCallingCancel = () => {
    callingNotifRef.current?.close();
    setIncomingCall(null);
    setPendingMtg(null);
    setScreen('main');
  };

  /* ─── Incoming Call: accept → join options ─── */
  const onIncomingAccept = () => {
    callingNotifRef.current?.close();
    setIncomingCall(null);
    setScreen('join-options');
    // pendingMtg already set when caller initiated
  };

  const onIncomingDecline = () => {
    setIncomingCall(null);
    // Cancel the calling screen too
    onCallingCancel();
  };

  /* ─── Open join options ─── */
  const openJoinOptions = (meeting) => {
    const isHost = meeting.createdBy === myName;
    if (!isHost && meeting.status === 'scheduled') {
      // Non-host joining a scheduled meeting -> wait in Lobby!
      setPendingMtg(meeting);
      setScreen('lobby');
    } else {
      setPendingMtg(meeting);
      setScreen('join-options');
    }
  };

  /* ─── Confirm join with options ─── */
  const onConfirmJoin = useCallback((opts) => {
    setJoinOptions(opts);
    const isHost = pendingMtg.createdBy === myName;
    if (isHost && pendingMtg.status === 'scheduled') {
      // Host starts the meeting! Update status to 'live' in store
      setStore(prev => {
        const meetings = prev.meetings.map(m => m.id === pendingMtg.id ? { ...m, status: 'live' } : m);
        const updatedStore = { ...prev, meetings };
        saveStore(updatedStore);
        return updatedStore;
      });
    }
    setActiveMeeting({ ...pendingMtg, status: isHost ? 'live' : pendingMtg.status, _startedAt: new Date().toISOString(), _resumeElapsed: pendingMtg._suspendedElapsed || 0 });
    setScreen('in-meeting');
  }, [pendingMtg, myName]);

  /* ─── End Call — always saves duration ─── */
  const endCall = useCallback((elapsed) => {
    if (!activeMeeting) return;
    const log = {
      id: Date.now(),
      meetingId: activeMeeting.meetingId,
      title: activeMeeting.title,
      type: activeMeeting.type,
      host: myName,
      participants: [myName, ...(activeMeeting.participants || [])],
      startedAt: activeMeeting._startedAt || new Date().toISOString(),
      endedAt: new Date().toISOString(),
      actualDuration: elapsed || 0,
      joinMode: joinOptions?.mode || 'normal',
    };
    setStore(prev => ({
      ...prev,
      callLogs: [log, ...prev.callLogs],
      meetings: prev.meetings.map(m => m.id === activeMeeting.id ? { ...m, status: 'completed', _actualDuration: elapsed } : m),
    }));
    setActiveMeeting(null); setJoinOptions(null); setScreen('main'); setPendingMtg(null);
  }, [activeMeeting, myName, joinOptions]);

  /* ─── Suspend meeting — saves elapsed time ─── */
  const suspendMeeting = useCallback((elapsed) => {
    if (!activeMeeting) return;
    setStore(prev => ({
      ...prev,
      meetings: prev.meetings.map(m =>
        m.id === activeMeeting.id
          ? { ...m, status: 'suspended', _suspendedElapsed: elapsed, _suspendedAt: new Date().toISOString() }
          : m
      ),
    }));
    setActiveMeeting(null); setJoinOptions(null); setScreen('main'); setPendingMtg(null);
  }, [activeMeeting]);

  /* ─── Resume suspended meeting ─── */
  const resumeMeeting = (meeting) => {
    setPendingMtg(meeting);
    setScreen('join-options');
  };

  /* ─── Add participants mid-call (notify only) ─── */
  const addParticipant = useCallback((names) => {
    if (!activeMeeting) return;
    names.forEach(n => {
      pushNotif('📞 Discussion Invite', `${myName} is asking you to join the discussion`, () => window.focus());
    });
  }, [activeMeeting, myName]);

  /* ─── Receive participant accepted joined event ─── */
  const handleParticipantJoined = useCallback((name) => {
    setActiveMeeting(prev => {
      if (!prev) return prev;
      const newParticipants = [...new Set([...(prev.participants || []), name])];
      return { ...prev, participants: newParticipants };
    });
    setStore(prev => ({
      ...prev,
      meetings: prev.meetings.map(m =>
        m.id === activeMeeting?.id ? { ...m, participants: [...new Set([...(m.participants || []), name])] } : m
      ),
    }));
  }, [activeMeeting]);

  /* ─── Lobby sync checks (detect when host starts) ─── */
  useEffect(() => {
    if (screen !== 'lobby' || !pendingMtg) return;

    const syncCheck = () => {
      const latestStore = loadStore();
      const match = latestStore.meetings.find(m => m.meetingId === pendingMtg.meetingId);
      if (match && match.status === 'live') {
        setPendingMtg(match);
        setScreen('join-options');
        pushNotif('🔔 Meeting Started', `"${match.title}" has been started by the host.`);
      }
    };

    window.addEventListener('storage', syncCheck);
    const t = setInterval(syncCheck, 1500);

    return () => {
      window.removeEventListener('storage', syncCheck);
      clearInterval(t);
    };
  }, [screen, pendingMtg]);

  /* ─── Force start meeting as Host (Simulated) ─── */
  const startMeetingAsHost = (meeting) => {
    setStore(prev => {
      const meetings = prev.meetings.map(m => m.meetingId === meeting.meetingId ? { ...m, status: 'live' } : m);
      const updatedStore = { ...prev, meetings };
      saveStore(updatedStore);
      return updatedStore;
    });
    const updatedMtg = { ...meeting, status: 'live' };
    setPendingMtg(updatedMtg);
    setScreen('join-options');
  };

  /* ─── Instant meeting ─── */
  const handleInstantMeeting = () => {
    openJoinOptions({ id: Date.now(), meetingId: generateMeetingId(), accessCode: generateAccessCode(), title: 'Instant Meeting', type: 'video', participants: [], scheduledAt: new Date().toISOString(), status: 'live', createdBy: myName });
  };

  /* ─── Screens ─── */
  if (screen === 'calling' && pendingMtg) {
    return <CallingScreen meeting={pendingMtg} onCancel={onCallingCancel} />;
  }
  if (screen === 'lobby' && pendingMtg) {
    return <LobbyScreen meeting={pendingMtg} currentUser={user} onLeave={() => { setPendingMtg(null); setScreen('main'); }} onStartMeeting={() => startMeetingAsHost(pendingMtg)} />;
  }
  if (screen === 'join-options' && pendingMtg) {
    return <JoinOptionsScreen meeting={pendingMtg} currentUser={user} onJoin={onConfirmJoin} onCancel={() => { setPendingMtg(null); setScreen('main'); }} />;
  }
  if (screen === 'in-meeting' && activeMeeting) {
    return <InMeetingOverlay
      meeting={activeMeeting} currentUser={user} joinOptions={joinOptions}
      allUsers={users} onEnd={endCall} onSuspend={suspendMeeting} onAddParticipant={addParticipant}
      onParticipantJoined={handleParticipantJoined}
      onSendMessage={handleSendInCallMessage}
    />;
  }


  const chatMessagesToShow = selectedMeeting 
    ? (chatFilterIssue 
      ? (selectedMeeting.messages || []).filter(m => m.issueKey === chatFilterIssue || (m.text || '').includes(chatFilterIssue))
      : (selectedMeeting.messages || []))
    : [];

  /* ─── MAIN PAGE ─── */
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', background: '#111214', border: '1px solid #2d2d2d', borderRadius: '12px', overflow: 'hidden' }}>
      {/* Incoming Call banner */}
      {incomingCall && (
        <IncomingCallBanner call={incomingCall} onAccept={onIncomingAccept} onDecline={onIncomingDecline} />
      )}

      {/* Left sidebar: Discussions list (Teams Chat Style) */}
      <div style={{ width: '320px', borderRight: '1px solid #2d2d2d', display: 'flex', flexDirection: 'column', background: '#18191b', flexShrink: 0 }}>
        
        {/* Sidebar Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid #2d2d2d' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', margin: 0 }}>Chat</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <span style={{ cursor: 'pointer', color: '#8b949e', fontSize: '15px' }} title="New Chat" onClick={handleInstantMeeting}>📝</span>
            </div>
          </div>
          
          <input
            type="text"
            placeholder="Search chat or room..."
            value={discussionSearch}
            onChange={(e) => setDiscussionSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 12px',
              background: '#22252a',
              border: '1px solid #30363d',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '13px',
              marginBottom: '12px'
            }}
          />

          {/* Teams Filter Pills */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { id: 'chats', label: 'Chats' },
              { id: 'meetings', label: 'Meetings' },
              { id: 'calls', label: 'Calls' }
            ].map(pill => (
              <button
                key={pill.id}
                onClick={() => setFilterType(pill.id)}
                style={{
                  padding: '4px 10px',
                  background: filterType === pill.id ? '#2f3136' : 'transparent',
                  border: '1px solid ' + (filterType === pill.id ? '#4f5054' : 'transparent'),
                  borderRadius: '20px',
                  color: filterType === pill.id ? '#fff' : '#8b949e',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        {/* Discussions List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          
          {/* Favourites Section */}
          <div style={{ marginBottom: '12px' }}>
            <div
              onClick={() => setFavExpanded(!favExpanded)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '6px 8px',
                color: '#8b949e',
                fontSize: '11px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                cursor: 'pointer',
                userSelect: 'none'
              }}
            >
              <span style={{marginRight: '6px', transform: favExpanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.15s'}}>&gt;</span>
              Favourites
            </div>
            
            {favExpanded && (
              <div style={{ paddingLeft: '4px' }}>
                {myMeetings
                  .filter(m => m.createdBy === myName) // Host rooms are marked as favourites
                  .filter(m => m.title.toLowerCase().includes(discussionSearch.toLowerCase()))
                  .filter(m => {
                    if (filterType === 'meetings') return m.type !== 'voice';
                    if (filterType === 'calls') return m.type === 'voice';
                    return true;
                  })
                  .map(m => {
                    const isSelected = selectedMeeting && selectedMeeting.meetingId === m.meetingId;
                    const isLive = m.status === 'live';
                    const lastMsg = m.messages && m.messages.length > 0 ? m.messages[m.messages.length - 1] : null;

                    return (
                      <div
                        key={m.id}
                        onClick={() => { setSelectedMeeting(m); setDiscussionTab('chat'); }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(98, 100, 167, 0.25)' : 'transparent',
                          border: isSelected ? '1px solid rgba(98, 100, 167, 0.4)' : '1px solid transparent',
                          color: isSelected ? '#fff' : '#c9d1d9',
                          marginBottom: '2px'
                        }}
                      >
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: isLive ? '#238636' : '#2b303a',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          marginRight: '12px',
                          fontSize: '12px',
                          position: 'relative'
                        }}>
                          {m.type === 'voice' ? '🎙️' : '📹'}
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontWeight: '600', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.title}</div>
                          <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {lastMsg ? `${lastMsg.sender.split(' ')[0]}: ${lastMsg.text}` : 'No messages'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Recent Chats Section */}
          <div>
            <div
              onClick={() => setRecentExpanded(!recentExpanded)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '6px 8px',
                color: '#8b949e',
                fontSize: '11px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                cursor: 'pointer',
                userSelect: 'none'
              }}
            >
              <span style={{marginRight: '6px', transform: recentExpanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.15s'}}>&gt;</span>
              Recent Chats
            </div>

            {recentExpanded && (
              <div style={{ paddingLeft: '4px' }}>
                {myMeetings
                  .filter(m => m.createdBy !== myName) // Non-host rooms
                  .filter(m => m.title.toLowerCase().includes(discussionSearch.toLowerCase()))
                  .filter(m => {
                    if (filterType === 'meetings') return m.type !== 'voice';
                    if (filterType === 'calls') return m.type === 'voice';
                    return true;
                  })
                  .map(m => {
                    const isSelected = selectedMeeting && selectedMeeting.meetingId === m.meetingId;
                    const isLive = m.status === 'live';
                    const lastMsg = m.messages && m.messages.length > 0 ? m.messages[m.messages.length - 1] : null;

                    return (
                      <div
                        key={m.id}
                        onClick={() => { setSelectedMeeting(m); setDiscussionTab('chat'); }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(98, 100, 167, 0.25)' : 'transparent',
                          border: isSelected ? '1px solid rgba(98, 100, 167, 0.4)' : '1px solid transparent',
                          color: isSelected ? '#fff' : '#c9d1d9',
                          marginBottom: '2px'
                        }}
                      >
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: isLive ? '#238636' : '#2b303a',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          marginRight: '12px',
                          fontSize: '12px',
                          position: 'relative'
                        }}>
                          {m.type === 'voice' ? '🎙️' : '📹'}
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontWeight: '600', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.title}</div>
                          <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {lastMsg ? `${lastMsg.sender.split(' ')[0]}: ${lastMsg.text}` : 'No messages'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

        </div>

          {/* ── Teams & Channels Section ── */}
          {teams.length > 0 && (
            <div style={{ marginTop: '4px' }}>
              <div
                onClick={() => setTeamsExpanded(!teamsExpanded)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '6px 8px',
                  color: '#8b949e',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <span style={{ marginRight: '6px', transform: teamsExpanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.15s' }}>&#62;</span>
                Teams & Channels
              </div>

              {teamsExpanded && (
                <div style={{ paddingLeft: '4px' }}>
                  {teams
                    .filter(t => t.name.toLowerCase().includes(discussionSearch.toLowerCase()))
                    .map(t => {
                      const isSelected = selectedTeamChannel && selectedTeamChannel.id === t.id;
                      const lastMsg = teamChatMessages.length > 0 && selectedTeamChannel?.id === t.id
                        ? teamChatMessages[teamChatMessages.length - 1] : null;
                      return (
                        <div
                          key={t.id}
                          onClick={() => handleSelectTeamChannel(t)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '10px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            background: isSelected ? 'rgba(98, 100, 167, 0.25)' : 'transparent',
                            border: isSelected ? '1px solid rgba(98, 100, 167, 0.4)' : '1px solid transparent',
                            color: isSelected ? '#fff' : '#c9d1d9',
                            marginBottom: '2px'
                          }}
                        >
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '8px',
                            background: '#6264a7', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 'bold', marginRight: '12px', fontSize: '13px', flexShrink: 0
                          }}>
                            {t.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{ fontWeight: '600', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {t.name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '2px' }}>
                              {lastMsg ? `${lastMsg.sender?.split(' ')[0]}: ${lastMsg.text}` : `${(t.members || []).length} member${(t.members || []).length !== 1 ? 's' : ''}`}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

      </div>

      {/* Right Column: Selected Workspace (MS Teams Chat styled background) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#202020' }}>
        {suspendedMeetings.length > 0 && (
          <div className="mc-suspended-banner" style={{ margin: 0, borderRadius: 0 }}>
            ⏸ You have {suspendedMeetings.length} suspended meeting{suspendedMeetings.length > 1 ? 's' : ''} —&nbsp;
            {suspendedMeetings.map(m => (
              <button key={m.id} className="mc-resume-inline-btn" onClick={() => resumeMeeting(m)}>
                ▶ Resume "{m.title}"
              </button>
            ))}
          </div>
        )}

        {!selectedMeeting && !selectedTeamChannel ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', color: '#8b949e', textAlign: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>💬</div>
            <h3 style={{ fontSize: '18px', color: '#fff', margin: '0 0 8px 0' }}>Welcome to Chat</h3>
            <p style={{ fontSize: '13px', maxWidth: '380px', margin: 0 }}>
              Pick a person, meeting room, or team channel from the sidebar to start chatting, hop on a call, or discuss issues together.
            </p>
          </div>
        ) : selectedTeamChannel ? (
          /* ── TEAM CHANNEL PANEL ── */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Team Channel Header */}
            <div style={{ padding: '10px 20px', borderBottom: '1px solid #2d2d2d', background: '#18191b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '52px' }}>
              <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#6264a7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', marginRight: '12px', fontSize: '14px' }}>
                  {selectedTeamChannel.name.slice(0, 1).toUpperCase()}
                </div>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', margin: 0, marginRight: '24px' }}>{selectedTeamChannel.name}</h3>
                <div style={{ fontSize: '12px', color: '#8b949e' }}>{(selectedTeamChannel.members || []).length} members</div>

                {/* Tabs: Chat | Details */}
                <div style={{ display: 'flex', gap: '4px', height: '100%', marginLeft: '20px' }}>
                  {[{ id: 'chat', label: 'Chat' }, { id: 'info', label: 'Members & Info' }].map(tab => {
                    const isActive = teamDiscussionTab === tab.id;
                    return (
                      <button key={tab.id} onClick={() => setTeamDiscussionTab(tab.id)}
                        style={{ background: 'none', border: 'none', borderBottom: isActive ? '3px solid #7f85f5' : '3px solid transparent', color: isActive ? '#fff' : '#8b949e', padding: '12px 14px', fontSize: '13px', fontWeight: isActive ? 'bold' : 'normal', cursor: 'pointer' }}>
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Call controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button onClick={() => setShowVoiceCall(true)} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '18px' }} title="Audio Call">📞</button>
                <button onClick={() => openJoinOptions({ id: Date.now(), meetingId: generateMeetingId(), accessCode: generateAccessCode(), title: selectedTeamChannel.name, type: 'video', participants: [], scheduledAt: new Date().toISOString(), status: 'scheduled', createdBy: myName })} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '18px' }} title="Video Call">📹</button>
              </div>
            </div>

            {/* Team Channel Body */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {teamDiscussionTab === 'chat' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                  {/* Filter bar */}
                  <div style={{ padding: '8px 20px', borderBottom: '1px solid #2d2d2d', background: '#151618', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '11px', color: '#8b949e', fontWeight: '600' }}>Filter:</span>
                    <select value={chatFilterIssue} onChange={e => setChatFilterIssue(e.target.value)}
                      style={{ background: '#22252a', border: '1px solid #30363d', borderRadius: '4px', color: '#c9d1d9', padding: '4px 8px', fontSize: '12px' }}>
                      <option value="">All Messages</option>
                      {issues.map(iss => <option key={iss.key} value={iss.key}>{iss.key}: {iss.fields?.summary?.substring(0, 30)}</option>)}
                    </select>
                  </div>
                  {/* Messages */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {teamChatMessages
                      .filter(m => !chatFilterIssue || m.issueKey === chatFilterIssue || (m.text || '').includes(chatFilterIssue))
                      .length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e', fontSize: '13px' }}>No messages yet in #{selectedTeamChannel.name}. Say hello! 👋</div>
                    ) : (
                      (() => {
                        const filtered = teamChatMessages.filter(m => !chatFilterIssue || m.issueKey === chatFilterIssue || (m.text || '').includes(chatFilterIssue));
                        const groups = [];
                        let lastDate = '';
                        filtered.forEach(m => {
                          const dateStr = new Date(m.timestamp || m.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
                          if (dateStr !== lastDate) { groups.push({ type: 'divider', date: dateStr, id: `tdiv-${m.id || m._id}` }); lastDate = dateStr; }
                          groups.push({ type: 'message', data: m, id: m.id || m._id });
                        });
                        return groups.map(group => {
                          if (group.type === 'divider') return (
                            <div key={group.id} style={{ display: 'flex', alignItems: 'center', margin: '20px 0', color: '#8b949e', fontSize: '11px' }}>
                              <div style={{ flex: 1, height: '1px', background: '#2d2d2d' }} />
                              <span style={{ padding: '0 12px' }}>{group.date}</span>
                              <div style={{ flex: 1, height: '1px', background: '#2d2d2d' }} />
                            </div>
                          );
                          const msg = group.data;
                          const isSelf = msg.sender === myName;
                          return (
                            <div key={group.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isSelf ? 'flex-end' : 'flex-start', maxWidth: '80%', alignSelf: isSelf ? 'flex-end' : 'flex-start', marginBottom: '4px' }}>
                              {!isSelf && <span style={{ fontSize: '11px', color: '#8b949e', marginBottom: '2px', marginLeft: '6px', fontWeight: '600' }}>{msg.sender}</span>}
                              <div style={{ background: isSelf ? '#6264a7' : '#2b2d31', border: isSelf ? 'none' : '1px solid #3d3e42', color: '#fff', borderRadius: isSelf ? '16px 16px 4px 16px' : '16px 16px 16px 4px', padding: '10px 14px', fontSize: '13px', lineHeight: '1.45', wordWrap: 'break-word', maxWidth: '100%' }}>
                                {msg.issueKey && (
                                  <div style={{ fontSize: '11px', color: isSelf ? '#e0e0ff' : '#8b949e', fontWeight: 'bold', marginBottom: '4px' }}>
                                    Issue: <span className="chat-issue-badge" onClick={() => onOpenIssueDetails && onOpenIssueDetails(msg.issueKey)}>{msg.issueKey}</span>
                                  </div>
                                )}
                                <div>{renderMessageText(msg.text)}</div>
                              </div>
                              <span style={{ fontSize: '9px', color: '#8b949e', marginTop: '2px', alignSelf: isSelf ? 'flex-end' : 'flex-start' }}>{new Date(msg.timestamp || msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          );
                        });
                      })()
                    )}
                  </div>
                  {/* Team message input */}
                  <div style={{ padding: '16px 20px', borderTop: '1px solid #2d2d2d', background: '#18191b' }}>
                    <form onSubmit={handleSendTeamMessage} style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#202225', border: '1px solid #30363d', borderRadius: '8px', padding: '8px 12px 6px 12px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <select value={teamChatIssue} onChange={e => setTeamChatIssue(e.target.value)}
                          style={{ background: '#18191b', border: '1px solid #30363d', borderRadius: '4px', color: '#c9d1d9', fontSize: '11px', padding: '4px 6px', maxWidth: '160px' }}>
                          <option value="">Tag Issue Key...</option>
                          {issues.map(iss => <option key={iss.key} value={iss.key}>{iss.key}</option>)}
                        </select>
                      </div>
                      <input type="text" value={teamChatText} onChange={e => setTeamChatText(e.target.value)}
                        placeholder={`Message #${selectedTeamChannel.name}...`}
                        style={{ width: '100%', background: 'transparent', border: 'none', color: '#fff', fontSize: '13px', outline: 'none', padding: '6px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #2d2d2d', paddingTop: '6px', marginTop: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#8b949e', fontSize: '15px' }}>
                          <span style={{ cursor: 'pointer' }} title="Emoji">😊</span>
                          <span style={{ cursor: 'pointer' }} title="Attach">📎</span>
                          <span style={{ cursor: 'pointer' }} title="Image">🖼️</span>
                        </div>
                        <button type="submit" style={{ background: 'none', border: 'none', color: teamChatText.trim() ? '#7f85f5' : '#8b949e', cursor: teamChatText.trim() ? 'pointer' : 'default' }} disabled={!teamChatText.trim()}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
              {teamDiscussionTab === 'info' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ background: '#161b22', border: '1px solid #30363d', padding: '20px', borderRadius: '8px' }}>
                    <h4 style={{ fontSize: '14px', color: '#fff', fontWeight: 'bold', margin: '0 0 16px 0', borderBottom: '1px solid #30363d', paddingBottom: '8px' }}>🏷️ Channel Info</h4>
                    <div style={{ fontSize: '13px', color: '#c9d1d9', marginBottom: '8px' }}><span style={{ color: '#8b949e' }}>Name: </span>{selectedTeamChannel.name}</div>
                    <div style={{ fontSize: '13px', color: '#c9d1d9' }}><span style={{ color: '#8b949e' }}>Members: </span>{(selectedTeamChannel.members || []).length}</div>
                  </div>
                  <div style={{ background: '#161b22', border: '1px solid #30363d', padding: '20px', borderRadius: '8px' }}>
                    <h4 style={{ fontSize: '14px', color: '#fff', fontWeight: 'bold', margin: '0 0 16px 0', borderBottom: '1px solid #30363d', paddingBottom: '8px' }}>👥 Members ({(selectedTeamChannel.members || []).length})</h4>
                    {(selectedTeamChannel.members || []).length === 0 ? (
                      <div style={{ color: '#8b949e', fontSize: '12px' }}>No members assigned.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(selectedTeamChannel.members || []).map((m, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#fff', padding: '6px', background: '#0d1117', borderRadius: '4px' }}>
                            <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#6264a7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '11px' }}>
                              {typeof m === 'string' ? m.slice(0,1).toUpperCase() : '?'}
                            </div>
                            <span>{typeof m === 'string' ? m : (m.displayName || m)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
            
            {/* Selected Meeting Header (Styled like Teams Header with Inline tabs next to Title) */}
            <div style={{ padding: '10px 20px', borderBottom: '1px solid #2d2d2d', background: '#18191b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '52px' }}>
              <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: getAvatarColor(selectedMeeting.title),
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  marginRight: '12px',
                  fontSize: '14px'
                }}>
                  {getInitials(selectedMeeting.title)}
                </div>
                
                {/* Room Title */}
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', margin: 0, marginRight: '24px', whiteSpace: 'nowrap' }}>
                  {selectedMeeting.title}
                </h3>

                {/* Inline Header Tabs (Same to Same as Teams: Chat Files Photos) */}
                <div style={{ display: 'flex', gap: '4px', height: '100%' }}>
                  {[
                    { id: 'chat', label: 'Chat' },
                    { id: 'info', label: 'Details & Logs' }
                  ].map(tab => {
                    const isActive = discussionTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setDiscussionTab(tab.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          borderBottom: isActive ? '3px solid #7f85f5' : '3px solid transparent',
                          color: isActive ? '#fff' : '#8b949e',
                          padding: '12px 14px',
                          fontSize: '13px',
                          fontWeight: isActive ? 'bold' : 'normal',
                          cursor: 'pointer'
                        }}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Call Controls & Action Icons (Teams Header Style) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button
                  onClick={() => openJoinOptions({ ...selectedMeeting, type: 'video' })}
                  style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '18px' }}
                  title="Video Call"
                >
                  📹
                </button>
                <button
                  onClick={() => openJoinOptions({ ...selectedMeeting, type: 'voice' })}
                  style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '18px' }}
                  title="Audio Call"
                >
                  📞
                </button>
                <button
                  onClick={() => { setEditMeeting(selectedMeeting); setShowSchedule(true); }}
                  style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '16px' }}
                  title="Edit Settings"
                >
                  ⚙️
                </button>
                <button
                  onClick={() => deleteMeeting(selectedMeeting.id)}
                  style={{ background: 'none', border: 'none', color: '#da3637', cursor: 'pointer', fontSize: '16px' }}
                  title="Remove Meeting Room"
                >
                  🗑️
                </button>
              </div>
            </div>

            {/* Workspace Body */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              
              {/* 💬 TAB: CHAT FEED */}
              {discussionTab === 'chat' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                  
                  {/* Chat Filter Bar */}
                  <div style={{ padding: '8px 20px', borderBottom: '1px solid #2d2d2d', background: '#151618', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '11px', color: '#8b949e', fontWeight: '600' }}>Filter Chat:</span>
                    <select
                      value={chatFilterIssue}
                      onChange={(e) => setChatFilterIssue(e.target.value)}
                      style={{
                        background: '#22252a',
                        border: '1px solid #30363d',
                        borderRadius: '4px',
                        color: '#c9d1d9',
                        padding: '4px 8px',
                        fontSize: '12px'
                      }}
                    >
                      <option value="">All Discussion Threads</option>
                      {issues.map(iss => (
                        <option key={iss.key} value={iss.key}>{iss.key}: {iss.fields?.summary?.substring(0, 30)}...</option>
                      ))}
                    </select>
                  </div>

                  {/* Messages list */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(!chatMessagesToShow || chatMessagesToShow.length === 0) ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e', fontSize: '13px' }}>
                        {chatFilterIssue ? 'No chat messages matching this issue context.' : 'No chat messages in this discussion room yet. Start the conversation below!'}
                      </div>
                    ) : (
                      (() => {
                        const groups = [];
                        let lastDate = '';
                        chatMessagesToShow.forEach(m => {
                          const dateStr = new Date(m.timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
                          if (dateStr !== lastDate) {
                            groups.push({ type: 'divider', date: dateStr, id: `div-${m.id}` });
                            lastDate = dateStr;
                          }
                          groups.push({ type: 'message', data: m, id: m.id });
                        });

                        return groups.map(group => {
                          if (group.type === 'divider') {
                            return (
                              <div key={group.id} style={{ display: 'flex', alignItems: 'center', margin: '20px 0', color: '#8b949e', fontSize: '11px', fontWeight: '500' }}>
                                <div style={{ flex: 1, height: '1px', background: '#2d2d2d' }}></div>
                                <span style={{ padding: '0 12px' }}>{group.date}</span>
                                <div style={{ flex: 1, height: '1px', background: '#2d2d2d' }}></div>
                              </div>
                            );
                          }

                          const msg = group.data;
                          const isSelf = msg.sender === myName;

                          return (
                            <div
                              key={group.id}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: isSelf ? 'flex-end' : 'flex-start',
                                maxWidth: '80%',
                                alignSelf: isSelf ? 'flex-end' : 'flex-start',
                                marginBottom: '4px'
                              }}
                            >
                              {!isSelf && (
                                <span style={{ fontSize: '11px', color: '#8b949e', marginBottom: '2px', marginLeft: '6px', fontWeight: '600' }}>
                                  {msg.sender}
                                </span>
                              )}

                              <div
                                style={{
                                  background: isSelf ? '#6264a7' : '#2b2d31',
                                  border: isSelf ? 'none' : '1px solid #3d3e42',
                                  color: '#fff',
                                  borderRadius: isSelf ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                  padding: '10px 14px',
                                  fontSize: '13px',
                                  lineHeight: '1.45',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                                  wordWrap: 'break-word',
                                  maxWidth: '100%'
                                }}
                              >
                                {msg.issueKey && (
                                  <div style={{ fontSize: '11px', color: isSelf ? '#e0e0ff' : '#8b949e', fontWeight: 'bold', marginBottom: '4px' }}>
                                    Issue context: <span className="chat-issue-badge" onClick={() => onOpenIssueDetails && onOpenIssueDetails(msg.issueKey)}>{msg.issueKey}</span>
                                  </div>
                                )}
                                <div>{renderMessageText(msg.text)}</div>
                              </div>

                              <span style={{ fontSize: '9px', color: '#8b949e', marginTop: '2px', alignSelf: isSelf ? 'flex-end' : 'flex-start', marginRight: isSelf ? '4px' : '0', marginLeft: !isSelf ? '4px' : '0' }}>
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          );
                        });
                      })()
                    )}
                  </div>

                  {/* Input Card Container (Same to Same as Teams style) */}
                  <div style={{ padding: '16px 20px', borderTop: '1px solid #2d2d2d', background: '#18191b' }}>
                    <form onSubmit={(e) => { handleSendMessage(e); }} style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#202225', border: '1px solid #30363d', borderRadius: '8px', padding: '8px 12px 6px 12px' }}>
                      
                      {/* Top Row: Tag issue key dropdown */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <select
                          value={newMessageIssue}
                          onChange={(e) => setNewMessageIssue(e.target.value)}
                          style={{
                            background: '#18191b',
                            border: '1px solid #30363d',
                            borderRadius: '4px',
                            color: '#c9d1d9',
                            fontSize: '11px',
                            padding: '4px 6px',
                            maxWidth: '160px'
                          }}
                        >
                          <option value="">Tag Issue Key...</option>
                          {issues.map(iss => (
                            <option key={iss.key} value={iss.key}>{iss.key}</option>
                          ))}
                        </select>
                      </div>

                      {/* Middle input text line */}
                      <input
                        type="text"
                        value={newMessageText}
                        onChange={(e) => setNewMessageText(e.target.value)}
                        placeholder="Type a message..."
                        style={{
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          color: '#fff',
                          fontSize: '13px',
                          outline: 'none',
                          padding: '6px 0'
                        }}
                      />

                      {/* Bottom tools row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #2d2d2d', paddingTop: '6px', marginTop: '4px' }}>
                        
                        {/* Left icons tray */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#8b949e', fontSize: '15px' }}>
                          <span style={{ cursor: 'pointer' }} title="Insert Emoji">😊</span>
                          <span style={{ cursor: 'pointer' }} title="Attach Files">📎</span>
                          <span style={{ cursor: 'pointer' }} title="Insert Image">🖼️</span>
                          <span style={{ cursor: 'pointer', fontSize: '9px', fontWeight: 'bold', border: '1.5px solid #8b949e', borderRadius: '3px', padding: '1px 3px', lineHeight: '1' }} title="GIF">GIF</span>
                          <span style={{ cursor: 'pointer' }} title="Loop component">📅</span>
                          <span style={{ cursor: 'pointer' }} title="More options">+</span>
                        </div>

                        {/* Right send control */}
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <button
                            type="submit"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: newMessageText.trim() ? '#7f85f5' : '#8b949e',
                              cursor: newMessageText.trim() ? 'pointer' : 'default',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            disabled={!newMessageText.trim()}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                            </svg>
                          </button>
                        </div>

                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* 📅 TAB: MEETING DETAILS */}
              {discussionTab === 'info' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  
                  {/* Details Card */}
                  <div style={{ background: '#161b22', border: '1px solid #30363d', padding: '20px', borderRadius: '8px' }}>
                    <h4 style={{ fontSize: '14px', color: '#fff', fontWeight: 'bold', margin: '0 0 16px 0', borderBottom: '1px solid #30363d', paddingBottom: '8px' }}>
                      ⚙️ Room Properties
                    </h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#8b949e' }}>Title:</span>
                        <span style={{ color: '#fff', fontWeight: 'bold' }}>{selectedMeeting.title}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#8b949e' }}>Created By:</span>
                        <span style={{ color: '#fff' }}>{selectedMeeting.createdBy}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#8b949e' }}>Scheduled Date:</span>
                        <span style={{ color: '#fff' }}>{new Date(selectedMeeting.scheduledAt).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#8b949e' }}>Scheduled Time:</span>
                        <span style={{ color: '#fff' }}>{new Date(selectedMeeting.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#8b949e' }}>Meeting ID:</span>
                        <span style={{ color: '#fff', fontFamily: 'monospace' }}>
                          {selectedMeeting.meetingId} &nbsp;
                          <button
                            onClick={() => navigator.clipboard?.writeText(selectedMeeting.meetingId)}
                            style={{ padding: '2px 6px', background: '#21262d', border: '1px solid #30363d', color: '#8b949e', fontSize: '10px', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Copy
                          </button>
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#8b949e' }}>Access Code:</span>
                        <span style={{ color: '#fff', fontFamily: 'monospace' }}>
                          {selectedMeeting.accessCode} &nbsp;
                          <button
                            onClick={() => navigator.clipboard?.writeText(selectedMeeting.accessCode)}
                            style={{ padding: '2px 6px', background: '#21262d', border: '1px solid #30363d', color: '#8b949e', fontSize: '10px', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Copy
                          </button>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Participants List */}
                  <div style={{ background: '#161b22', border: '1px solid #30363d', padding: '20px', borderRadius: '8px' }}>
                    <h4 style={{ fontSize: '14px', color: '#fff', fontWeight: 'bold', margin: '0 0 16px 0', borderBottom: '1px solid #30363d', paddingBottom: '8px' }}>
                      👥 Invited Participants ({selectedMeeting.participants?.length || 0})
                    </h4>
                    {(!selectedMeeting.participants || selectedMeeting.participants.length === 0) ? (
                      <div style={{ color: '#8b949e', fontSize: '12px' }}>No participants invited to this room. You can call them in when starting the meeting.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {selectedMeeting.participants.map((p, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#fff', padding: '6px', background: '#0d1117', borderRadius: '4px' }}>
                            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#6264a7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '10px' }}>
                              {getInitials(p)}
                            </div>
                            <span>{p}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>

      {/* Voice Call modal */}
      {showVoiceCall && (() => {
        const VoiceCallInline = () => {
          const [selected, setSelected] = useState([]);
          const others = users.filter(u => u.displayName !== myName);
          const toggle = n => setSelected(p => p.includes(n) ? p.filter(x => x !== n) : [...p, n]);
          return (
            <div className="mc-modal-overlay" onClick={() => setShowVoiceCall(false)}>
              <div className="mc-modal mc-modal-sm" onClick={e => e.stopPropagation()}>
                <div className="mc-modal-header">
                  <div className="mc-modal-title">🎙️ New Voice Call</div>
                  <button className="mc-modal-close" onClick={() => setShowVoiceCall(false)}>✕</button>
                </div>
                <div className="mc-modal-body">
                  <div className="mc-form-row">
                    <label className="mc-form-label">Select people to call</label>
                    <div className="mc-invitees-grid">
                      {others.map(u => {
                        const sel = selected.includes(u.displayName);
                        return (
                          <label key={u.accountId} className={`mc-invitee-chip ${sel ? 'selected' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '6px 12px', background: sel ? 'rgba(56,139,253,0.1)' : '#1f2226', border: '1px solid #30363d', borderRadius: '20px', fontSize: '12px', color: '#c9d1d9', marginBottom: '6px' }}>
                            <input type="checkbox" checked={sel} onChange={() => toggle(u.displayName)} style={{ display: 'none' }} />
                            <span>{u.displayName}</span>
                            {sel && <span style={{ color: '#58a6ff' }}>✓</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mc-modal-footer">
                    <button className="mc-btn-secondary" onClick={() => setShowVoiceCall(false)}>Cancel</button>
                    <button className="mc-btn-green" disabled={!selected.length}
                      onClick={() => {
                        setShowVoiceCall(false);
                        initiateCall({ id: Date.now(), meetingId: generateMeetingId(), accessCode: generateAccessCode(), title: `Call with ${selected.join(', ')}`, type: 'voice', participants: selected, scheduledAt: new Date().toISOString(), status: 'calling', createdBy: myName });
                      }}>
                      🎙️ Start Call
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        };
        return <VoiceCallInline />;
      })()}

      {/* Modals */}
      {showSchedule   && <ScheduleModal users={users} currentUser={user} editMeeting={editMeeting} onClose={() => { setShowSchedule(false); setEditMeeting(null); }} onSave={saveMeeting} />}
      {showAccessGate && <AccessGate store={store} onClose={() => setShowAccessGate(false)} onVerified={m => { setShowAccessGate(false); openJoinOptions(m); }} />}
    </div>
  );
}


