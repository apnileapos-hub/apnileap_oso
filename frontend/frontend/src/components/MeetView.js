import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL ||
  (window.location.port === '3000' ? 'http://localhost:5000' : '');

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
const rand = (n) => Math.random().toString(36).toUpperCase().slice(2, 2 + n);
const generateMeetingId  = () => `DC-${rand(4)}-${rand(4)}`;
const generateAccessCode = () => `${Math.floor(100000 + Math.random() * 900000)}`;
const getInitials = (name = '') => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
const COLORS = ['#1f6feb','#8957e5','#cf222e','#bf8700','#1a7f37','#0969da','#9a3691','#c6500a'];
const avatarColor = (name = '') => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return COLORS[Math.abs(h) % COLORS.length];
};
const fmtDT = (iso) => iso ? new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
const reqNotif = () => { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); };

/* ─── Schedule Modal ──────────────────────────────────────────────────────── */
function ScheduleModal({ users, currentUser, editMeeting, onClose, onSave }) {
  const myName = currentUser?.name || currentUser?.email || 'You';
  const [title, setTitle] = useState(editMeeting?.title || '');
  const [type, setType] = useState(editMeeting?.type || 'video');
  const [date, setDate] = useState(editMeeting?.scheduledAt ? new Date(editMeeting.scheduledAt).toISOString().slice(0,10) : new Date().toISOString().slice(0,10));
  const [time, setTime] = useState(editMeeting?.scheduledAt ? new Date(editMeeting.scheduledAt).toTimeString().slice(0,5) : '10:00');
  const [participants, setParticipants] = useState(editMeeting?.participants || []);
  const others = (users || []).filter(u => u.displayName !== myName);

  const toggle = (name) => setParticipants(p => p.includes(name) ? p.filter(x => x !== name) : [...p, name]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const scheduledAt = new Date(`${date}T${time}`).toISOString();
    const mtg = {
      id: editMeeting?.id || Date.now(),
      meetingId: editMeeting?.meetingId || generateMeetingId(),
      accessCode: editMeeting?.accessCode || generateAccessCode(),
      title: title.trim(), type, scheduledAt, participants,
      status: 'scheduled', createdBy: myName, messages: editMeeting?.messages || []
    };
    onSave(mtg);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
      onClick={onClose}>
      <div style={{ background: '#1c2128', border: '1px solid var(--border)', borderRadius: '12px', padding: '28px', width: '460px', maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold', margin: 0 }}>{editMeeting ? '✏️ Edit Meeting' : '📅 Schedule Meeting'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase' }}>Meeting Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Sprint Planning Q2"
              style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }} />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase' }}>Type</label>
              <select value={type} onChange={e => setType(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff', padding: '8px 12px', fontSize: '13px' }}>
                <option value="video">📹 Video Call</option>
                <option value="voice">🎙️ Voice Call</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase' }}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase' }}>Time</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff', padding: '8px 12px', fontSize: '13px', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase' }}>Invite People</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
              {others.map(u => {
                const sel = participants.includes(u.displayName);
                return (
                  <label key={u.accountId} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', background: sel ? 'rgba(98,100,167,0.3)' : 'var(--bg-primary)', border: `1px solid ${sel ? '#6264a7' : 'var(--border)'}`, borderRadius: '16px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-primary)' }}>
                    <input type="checkbox" checked={sel} onChange={() => toggle(u.displayName)} style={{ display: 'none' }} />
                    {u.displayName}
                    {sel && <span style={{ color: '#7f85f5' }}>✓</span>}
                  </label>
                );
              })}
              {others.length === 0 && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>No other users found</span>}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={!title.trim()}
              style={{ flex: 1, padding: '10px', background: '#238636', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', opacity: title.trim() ? 1 : 0.5 }}>
              {editMeeting ? 'Save Changes' : '📅 Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Join Meeting Modal ──────────────────────────────────────────────────── */
function JoinModal({ store, onClose, onJoin }) {
  const [meetId, setMeetId] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');

  const handleJoin = () => {
    setErr('');
    const mtg = (store.meetings || []).find(m => m.meetingId === meetId.trim().toUpperCase());
    if (!mtg) { setErr('Meeting ID not found.'); return; }
    if (mtg.accessCode !== code.trim()) { setErr('Incorrect access code.'); return; }
    onJoin(mtg);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
      onClick={onClose}>
      <div style={{ background: '#1c2128', border: '1px solid var(--border)', borderRadius: '12px', padding: '28px', width: '380px' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3 style={{ color: '#fff', fontSize: '16px', margin: 0 }}>🔑 Join a Meeting</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <input value={meetId} onChange={e => setMeetId(e.target.value)} placeholder="Meeting ID (e.g. DC-XXXX-XXXX)"
            style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff', padding: '10px 12px', fontSize: '13px', boxSizing: 'border-box' }} />
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="6-digit Access Code" type="password"
            style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff', padding: '10px 12px', fontSize: '13px', boxSizing: 'border-box' }} />
          {err && <div style={{ fontSize: '12px', color: '#f85149', background: 'rgba(248,81,73,0.1)', padding: '8px 12px', borderRadius: '6px' }}>{err}</div>}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
            <button onClick={handleJoin} disabled={!meetId.trim() || !code.trim()}
              style={{ flex: 1, padding: '10px', background: '#238636', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '13px', opacity: (meetId.trim() && code.trim()) ? 1 : 0.5 }}>
              Join Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── P2P Call Modal ──────────────────────────────────────────────────────── */
function P2PCallModal({ users, myName, onClose, onStartCall }) {
  const [selected, setSelected] = useState(null);
  const [callType, setCallType] = useState('video');
  const others = users.filter(u => u.displayName !== myName);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
      onClick={onClose}>
      <div style={{ background: '#1c2128', border: '1px solid var(--border)', borderRadius: '12px', padding: '28px', width: '400px', maxHeight: '80vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3 style={{ color: '#fff', fontSize: '16px', margin: 0 }}>📞 Call Someone</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button onClick={() => setCallType('video')} style={{ flex: 1, padding: '8px', background: callType === 'video' ? '#6264a7' : 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '13px' }}>📹 Video</button>
          <button onClick={() => setCallType('voice')} style={{ flex: 1, padding: '8px', background: callType === 'voice' ? '#6264a7' : 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '13px' }}>🎙️ Audio</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
          {others.length === 0 && <div style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>No other users found</div>}
          {others.map(u => (
            <div key={u.accountId} onClick={() => setSelected(u.displayName)}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', background: selected === u.displayName ? 'rgba(98,100,167,0.3)' : 'var(--bg-primary)', border: `1px solid ${selected === u.displayName ? '#6264a7' : 'var(--border)'}` }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: avatarColor(u.displayName), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#fff', fontSize: '13px', flexShrink: 0 }}>
                {getInitials(u.displayName)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: '#fff', fontWeight: '600' }}>{u.displayName}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{u.email || u.displayName}</div>
              </div>
              {selected === u.displayName && <span style={{ color: '#7f85f5', fontSize: '16px' }}>✓</span>}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
          <button disabled={!selected}
            onClick={() => {
              if (!selected) return;
              onStartCall({ name: selected, type: callType });
            }}
            style={{ flex: 1, padding: '10px', background: '#238636', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '13px', opacity: selected ? 1 : 0.5 }}>
            {callType === 'video' ? '📹 Start Video' : '🎙️ Start Call'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Meet View ──────────────────────────────────────────────────────── */
export default function MeetView({ user, issues = [], onOpenIssueDetails }) {
  const [users, setUsers] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [detailTab, setDetailTab] = useState('details'); // 'details' | 'chat'
  const [listTab, setListTab] = useState('upcoming'); // 'upcoming' | 'past' | 'missed'
  const [store, setStore] = useState({ meetings: [], callLogs: [] });

  // Modals
  const [showSchedule, setShowSchedule] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showP2P, setShowP2P] = useState(false);
  const [editMeeting, setEditMeeting] = useState(null);

  // Chat in meeting details
  const [chatText, setChatText] = useState('');
  const [chatIssue, setChatIssue] = useState('');
  const [messages, setMessages] = useState([]);

  // Reminders state
  const [sendingRemind, setSendingRemind] = useState(false);
  const [remindStatus, setRemindStatus] = useState('');

  const myName = user?.name || user?.email || 'You';

  const fetchMeetings = useCallback(async () => {
    try {
      const token = user?.token;
      const res = await axios.get(`${API}/meetings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const formatted = (res.data || []).map(m => ({
        id: m.id,
        title: m.title,
        campusId: m.campusId,
        scheduledAt: `${m.date}T${m.time}:00`,
        date: m.date,
        time: m.time,
        type: 'video',
        link: m.link,
        agenda: m.agenda,
        status: new Date(`${m.date}T${m.time}:00`) < new Date() ? 'missed' : 'scheduled',
        createdBy: 'Admin',
        meetingId: m.id,
        accessCode: '123456'
      }));
      setMeetings(formatted);
      setStore({ meetings: formatted, callLogs: [] });
    } catch (err) {
      console.error("Failed to load meetings", err);
    }
  }, [user]);

  useEffect(() => {
    reqNotif();
    axios.get(`${API}/users`, {
      headers: { Authorization: `Bearer ${user?.token}` }
    }).then(r => setUsers(r.data || [])).catch(() => {});
    fetchMeetings();
  }, [fetchMeetings, user]);

  // Load chat messages when meeting is selected
  useEffect(() => {
    if (selectedMeeting) {
      const token = user?.token;
      axios.get(`${API}/meetings/${selectedMeeting.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => {
        setMessages(res.data || []);
      }).catch(err => console.error("Failed to load messages", err));
    } else {
      setMessages([]);
    }
    setRemindStatus('');
  }, [selectedMeeting, user]);

  const saveMeeting = async (m) => {
    try {
      const token = user?.token;
      const scheduledDate = new Date(m.scheduledAt);
      const dateStr = scheduledDate.toISOString().slice(0, 10);
      const timeStr = scheduledDate.toTimeString().slice(0, 5);
      
      let campusId = "3";
      if (user?.collegeId === "coep-spoke") campusId = "101";
      else if (user?.collegeId === "mmcoep-spoke") campusId = "102";
      else if (user?.collegeId === "rit-spoke") campusId = "103";
      else if (user?.collegeId === "kle-spoke") campusId = "3";

      const payload = {
        id: m.id.toString(),
        title: m.title,
        campusId: campusId,
        date: dateStr,
        time: timeStr,
        link: `http://localhost:3000/calls?meetId=${m.meetingId}&code=${m.accessCode}`,
        agenda: m.agenda || `Sync meeting scheduled by ${m.createdBy}.`
      };

      await axios.post(`${API}/meetings`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      fetchMeetings();
      setShowSchedule(false);
      setEditMeeting(null);
    } catch (err) {
      console.error("Failed to save meeting", err);
      alert("Failed to schedule meeting.");
    }
  };

  const deleteMeeting = async (id) => {
    setMeetings(prev => prev.filter(m => m.id !== id));
    if (selectedMeeting?.id === id) setSelectedMeeting(null);
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatText.trim() || !selectedMeeting) return;
    try {
      const token = user?.token;
      const res = await axios.post(`${API}/meetings/${selectedMeeting.id}/messages`, {
        sender: myName,
        text: chatText.trim(),
        issueKey: chatIssue || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(prev => [...prev, res.data]);
      setChatText('');
      setChatIssue('');
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  const handleSendRemind = async () => {
    if (!selectedMeeting) return;
    setSendingRemind(true);
    setRemindStatus('');
    try {
      const token = user?.token;
      const res = await axios.post(`${API}/meetings/${selectedMeeting.id}/remind`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRemindStatus(res.data.message || 'Warning alerts successfully dispatched to campus coordinators!');
    } catch (err) {
      console.error("Failed to send remind", err);
      setRemindStatus(err.response?.data?.error || 'Failed to dispatch pre-meeting reminders.');
    } finally {
      setSendingRemind(false);
    }
  };

  const handleJoin = (mtg) => {
    setShowJoin(false);
    setSelectedMeeting(mtg);
    setDetailTab('details');
  };

  const handleJoinSelected = () => {
    if (!selectedMeeting) return;
    const updated = { ...selectedMeeting, status: 'live' };
    setSelectedMeeting(updated);
  };

  const handleStartP2PCall = ({ name, type }) => {
    setShowP2P(false);
    const mtg = {
      id: `meet-${Date.now()}`,
      meetingId: generateMeetingId(),
      accessCode: generateAccessCode(),
      title: `Call with ${name}`,
      type,
      participants: [name],
      scheduledAt: new Date().toISOString(),
      status: 'live',
      createdBy: myName,
      messages: [],
      isP2P: true
    };
    setSelectedMeeting(mtg);
    setDetailTab('details');
  };

  const myMeetings = meetings;
  const now = new Date();
  const upcomingMeetings = myMeetings
    .filter(m => m.status === 'live' || (m.status === 'scheduled' && new Date(m.scheduledAt) >= now))
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  const missedMeetings = myMeetings.filter(m => m.status === 'scheduled' && new Date(m.scheduledAt) < now);
  const allContacts = users.filter(u => u.displayName !== myName);

  // All tab: everything — scheduled (future + past) + live
  const allMeetings = [...myMeetings].sort((a, b) => {
    if (a.status === 'live' && b.status !== 'live') return -1;
    if (b.status === 'live' && a.status !== 'live') return 1;
    return new Date(b.scheduledAt) - new Date(a.scheduledAt);
  });

  const visibleMeetings = listTab === 'upcoming' ? upcomingMeetings
    : listTab === 'missed' ? missedMeetings
    : allMeetings;

  const renderMessageText = (text) => {
    const issueRegex = /([A-Z]+-[0-9]+)/g;
    const parts = text.split(issueRegex);
    return parts.map((part, i) => {
      if (part.match(issueRegex)) return <span key={i} className="chat-issue-badge" onClick={() => onOpenIssueDetails && onOpenIssueDetails(part)}>{part}</span>;
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', background: '#111214', border: '1px solid #2d2d2d', borderRadius: '12px', overflow: 'hidden' }}>

      {/* ── LEFT SIDEBAR ──────────────────────────────────────────────────── */}
      <div style={{ width: '320px', borderRight: '1px solid #2d2d2d', display: 'flex', flexDirection: 'column', background: '#18191b', flexShrink: 0 }}>

        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid #2d2d2d' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', margin: '0 0 14px 0' }}>Meet</h2>

          {/* Quick Actions */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => { setShowSchedule(true); setEditMeeting(null); }}
              style={{ flex: 1, padding: '8px 10px', background: '#6264a7', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              📅 Schedule
            </button>
            <button onClick={() => setShowJoin(true)}
              style={{ flex: 1, padding: '8px 10px', background: '#238636', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              🔑 Join
            </button>
            <button onClick={() => setShowP2P(true)}
              style={{ flex: 1, padding: '8px 10px', background: '#0d4a78', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              📞 Call
            </button>
          </div>
        </div>

        {/* List Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #2d2d2d' }}>
          {[{ id: 'upcoming', label: 'Upcoming' }, { id: 'all', label: 'All' }, { id: 'missed', label: 'Missed' }].map(tab => (
            <button key={tab.id} onClick={() => setListTab(tab.id)}
              style={{ flex: 1, padding: '10px 6px', background: 'none', border: 'none', borderBottom: listTab === tab.id ? '2px solid #7f85f5' : '2px solid transparent', color: listTab === tab.id ? '#fff' : 'var(--text-secondary)', fontSize: '12px', fontWeight: listTab === tab.id ? '600' : 'normal', cursor: 'pointer' }}>
              {tab.label}
              {tab.id === 'missed' && missedMeetings.length > 0 && (
                <span style={{ marginLeft: '4px', background: '#da3637', color: '#fff', borderRadius: '8px', padding: '1px 5px', fontSize: '10px' }}>{missedMeetings.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Meetings List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {visibleMeetings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
              {listTab === 'upcoming' ? '📅 No upcoming meetings.\nSchedule one or join with an ID.' : 'No meetings found.'}
            </div>
          ) : (
            visibleMeetings.map(m => {
              const isSelected = selectedMeeting?.id === m.id;
              const isLive = m.status === 'live';
              const isMissed = listTab === 'missed' || (m.status === 'scheduled' && new Date(m.scheduledAt) < now);
              return (
                <div key={m.id} onClick={() => { setSelectedMeeting(m); setDetailTab('details'); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', marginBottom: '4px', background: isSelected ? 'rgba(98,100,167,0.25)' : 'transparent', border: isSelected ? '1px solid rgba(98,100,167,0.4)' : '1px solid transparent', transition: 'background 0.15s' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: isLive ? '#238636' : isMissed ? 'rgba(248,81,73,0.15)' : avatarColor(m.title), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                    <span style={{ fontSize: '16px' }}>{m.type === 'voice' ? '🎙️' : '📹'}</span>
                    {isLive && <span style={{ position: 'absolute', top: -3, right: -3, width: '10px', height: '10px', background: '#3fb950', borderRadius: '50%', border: '2px solid #18191b' }} />}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: isSelected ? '#fff' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.title}</div>
                    <div style={{ fontSize: '11px', color: isLive ? '#3fb950' : isMissed ? '#f85149' : 'var(--text-secondary)', marginTop: '2px' }}>
                      {isLive ? '🟢 Live Now' : isMissed ? '⚠️ Missed · ' + fmtTime(m.scheduledAt) : fmtDT(m.scheduledAt)}
                    </div>
                  </div>
                  {isLive && (
                    <button onClick={e => { e.stopPropagation(); setSelectedMeeting(m); setDetailTab('details'); }}
                      style={{ padding: '4px 10px', background: '#3fb950', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px', fontWeight: '600', cursor: 'pointer', flexShrink: 0 }}>
                      Join
                    </button>
                  )}
                </div>
              );
            })
          )}

          {/* People / Contacts section */}
          <div style={{ marginTop: '12px', padding: '0 4px 4px' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase', padding: '6px 8px' }}>
              People ({allContacts.length})
            </div>
            {allContacts.map(u => (
              <div key={u.accountId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 8px', borderRadius: '6px', cursor: 'pointer', marginBottom: '2px' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: avatarColor(u.displayName), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#fff', fontSize: '12px', flexShrink: 0 }}>
                  {getInitials(u.displayName)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}>{u.displayName}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleStartP2PCall({ name: u.displayName, type: 'voice' })}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '15px', padding: '2px' }} title="Audio Call">📞</button>
                  <button onClick={() => handleStartP2PCall({ name: u.displayName, type: 'video' })}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '15px', padding: '2px' }} title="Video Call">📹</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#202020', overflow: 'hidden' }}>
        {!selectedMeeting ? (
          /* Empty state */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', color: 'var(--text-secondary)', textAlign: 'center' }}>
            <div style={{ fontSize: '72px', marginBottom: '20px' }}>📹</div>
            <h2 style={{ fontSize: '22px', color: '#fff', margin: '0 0 10px 0', fontWeight: 'bold' }}>Ready to meet?</h2>
            <p style={{ fontSize: '14px', maxWidth: '400px', margin: '0 0 28px 0', lineHeight: '1.6' }}>
              Schedule a meeting, join with a meeting ID, or call someone directly from the sidebar.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button onClick={() => setShowSchedule(true)}
                style={{ padding: '12px 22px', background: '#6264a7', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                📅 Schedule a Meeting
              </button>
              <button onClick={() => setShowJoin(true)}
                style={{ padding: '12px 22px', background: '#238636', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                🔑 Join with ID
              </button>
              <button onClick={() => setShowP2P(true)}
                style={{ padding: '12px 22px', background: '#0d4a78', border: '1px solid #388bfd', borderRadius: '8px', color: '#fff', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                📞 Call Someone
              </button>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>

            {/* Meeting Panel Header */}
            <div style={{ padding: '12px 24px', borderBottom: '1px solid #2d2d2d', background: '#18191b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: selectedMeeting.status === 'live' ? '#238636' : avatarColor(selectedMeeting.title), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                  {selectedMeeting.type === 'voice' ? '🎙️' : '📹'}
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff', margin: 0 }}>{selectedMeeting.title}</h3>
                  <div style={{ fontSize: '12px', color: selectedMeeting.status === 'live' ? '#3fb950' : 'var(--text-secondary)', marginTop: '2px' }}>
                    {selectedMeeting.status === 'live' ? '🟢 Live · In Progress' : fmtDT(selectedMeeting.scheduledAt)}
                  </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', marginLeft: '16px', height: '40px', alignItems: 'flex-end' }}>
                  {[{ id: 'details', label: 'Details' }, { id: 'chat', label: 'Chat' }].map(tab => (
                    <button key={tab.id} onClick={() => setDetailTab(tab.id)}
                      style={{ background: 'none', border: 'none', borderBottom: detailTab === tab.id ? '3px solid #7f85f5' : '3px solid transparent', color: detailTab === tab.id ? '#fff' : 'var(--text-secondary)', padding: '8px 14px', fontSize: '13px', fontWeight: detailTab === tab.id ? '600' : 'normal', cursor: 'pointer' }}>
                      {tab.label}
                      {tab.id === 'chat' && messages.length > 0 && (
                        <span style={{ marginLeft: '5px', background: '#6264a7', borderRadius: '8px', padding: '1px 6px', fontSize: '10px' }}>{messages.length}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right action buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {selectedMeeting.status !== 'live' && (
                  <button onClick={handleJoinSelected}
                    style={{ padding: '8px 18px', background: '#6264a7', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>
                    🚀 Join Meeting
                  </button>
                )}
                {selectedMeeting.status === 'live' && (
                  <button onClick={handleJoinSelected}
                    style={{ padding: '8px 18px', background: '#238636', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>
                    🟢 Rejoin
                  </button>
                )}
                <button onClick={() => { setEditMeeting(selectedMeeting); setShowSchedule(true); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '16px' }} title="Edit">⚙️</button>
                <button onClick={() => deleteMeeting(selectedMeeting.id)}
                  style={{ background: 'none', border: 'none', color: '#da3637', cursor: 'pointer', fontSize: '16px' }} title="Delete">🗑️</button>
              </div>
            </div>

            {/* Panel Body */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

              {/* ── DETAILS TAB ── */}
              {detailTab === 'details' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', gap: '20px', flexWrap: 'wrap', alignContent: 'flex-start' }}>

                  {/* Join Banner (if upcoming) */}
                  {selectedMeeting.status === 'scheduled' && new Date(selectedMeeting.scheduledAt) > now && (
                    <div style={{ width: '100%', background: 'rgba(98,100,167,0.12)', border: '1px solid rgba(98,100,167,0.3)', borderRadius: '10px', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '14px', color: '#fff', fontWeight: '600' }}>📅 {selectedMeeting.title}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Scheduled for {fmtDT(selectedMeeting.scheduledAt)}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {(selectedMeeting.participants || []).length} participant{(selectedMeeting.participants || []).length !== 1 ? 's' : ''} invited
                        </div>
                      </div>
                      <button onClick={handleJoinSelected}
                        style={{ padding: '10px 24px', background: '#6264a7', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                        Join Meeting →
                      </button>
                    </div>
                  )}

                  {/* Live Banner */}
                  {selectedMeeting.status === 'live' && (
                    <div style={{ width: '100%', background: 'rgba(35,134,54,0.15)', border: '1px solid rgba(35,134,54,0.4)', borderRadius: '10px', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '14px', color: '#3fb950', fontWeight: '700' }}>🟢 Meeting is Live!</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>This meeting is currently in progress</div>
                      </div>
                      <button onClick={handleJoinSelected}
                        style={{ padding: '10px 24px', background: '#238636', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                        🚀 Join Now
                      </button>
                    </div>
                  )}

                  {/* Info Cards - 2 column */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', width: '100%' }}>

                    {/* Meeting Info */}
                    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '18px' }}>
                      <h4 style={{ fontSize: '13px', color: '#fff', fontWeight: 'bold', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>⚙️ Meeting Info</h4>
                      {[
                        { label: 'Title', value: selectedMeeting.title },
                        { label: 'Type', value: selectedMeeting.type === 'voice' ? '🎙️ Voice Call' : '📹 Video Call' },
                        { label: 'Organizer', value: selectedMeeting.createdBy },
                        { label: 'Scheduled', value: fmtDT(selectedMeeting.scheduledAt) },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '13px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                          <span style={{ color: '#fff', fontWeight: '500', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
                        </div>
                      ))}
                      {/* Status as badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '13px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Status</span>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700',
                          background: selectedMeeting.status === 'live' ? 'rgba(35,134,54,0.2)' : selectedMeeting.status === 'scheduled' ? 'rgba(98,100,167,0.2)' : 'rgba(139,148,158,0.15)',
                          color: selectedMeeting.status === 'live' ? '#3fb950' : selectedMeeting.status === 'scheduled' ? '#7f85f5' : 'var(--text-secondary)',
                          border: `1px solid ${selectedMeeting.status === 'live' ? 'rgba(35,134,54,0.4)' : selectedMeeting.status === 'scheduled' ? 'rgba(98,100,167,0.4)' : 'var(--border)'}`,
                          textTransform: 'capitalize'
                        }}>
                          {selectedMeeting.status === 'live' ? '● Live' : selectedMeeting.status === 'scheduled' ? '◷ Scheduled' : selectedMeeting.status}
                        </span>
                      </div>
                    </div>

                    {/* Access Info */}
                    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '18px' }}>
                      <h4 style={{ fontSize: '13px', color: '#fff', fontWeight: 'bold', margin: '0 0 14px 0' }}>🔐 Access Details</h4>
                      <div style={{ marginBottom: '14px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>Meeting ID</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <code style={{ fontSize: '13px', color: '#58a6ff', background: 'rgba(88,166,255,0.1)', padding: '4px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>{selectedMeeting.meetingId}</code>
                          <button onClick={() => navigator.clipboard?.writeText(selectedMeeting.meetingId)}
                            style={{ padding: '4px 8px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '11px', borderRadius: '4px', cursor: 'pointer' }}>Copy</button>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>Access Code</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <code style={{ fontSize: '13px', color: '#3fb950', background: 'rgba(63,185,80,0.1)', padding: '4px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>{selectedMeeting.accessCode}</code>
                          <button onClick={() => navigator.clipboard?.writeText(selectedMeeting.accessCode)}
                            style={{ padding: '4px 8px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '11px', borderRadius: '4px', cursor: 'pointer' }}>Copy</button>
                        </div>
                      </div>
                      <div style={{ marginTop: '14px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        Share the Meeting ID and Access Code with participants to let them join.
                      </div>
                    </div>
                  </div>

                  {/* Reminders & Alerts */}
                  <div style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '18px' }}>
                    <h4 style={{ fontSize: '13px', color: '#fff', fontWeight: 'bold', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      🚨 Reminders & Alerts
                    </h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 14px 0', lineHeight: '1.5' }}>
                      Send warning notifications and meeting digests to all registered campus coordinators and team members to ensure attendance.
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
                      <button onClick={handleSendRemind} disabled={sendingRemind}
                        style={{
                          padding: '10px 20px',
                          background: '#cf222e',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#fff',
                          fontWeight: '600',
                          fontSize: '13px',
                          cursor: sendingRemind ? 'not-allowed' : 'pointer',
                          opacity: sendingRemind ? 0.7 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => { if (!sendingRemind) e.target.style.background = '#b31d25'; }}
                        onMouseLeave={(e) => { if (!sendingRemind) e.target.style.background = '#cf222e'; }}
                      >
                        {sendingRemind ? '⏳ Dispatching Reminders...' : '🚨 Send Warning Digest'}
                      </button>
                      {remindStatus && (
                        <div style={{
                          fontSize: '12px',
                          color: remindStatus.includes('Failed') || remindStatus.includes('error') ? '#ff7b72' : '#58a6ff',
                          background: remindStatus.includes('Failed') || remindStatus.includes('error') ? 'rgba(248,81,73,0.1)' : 'rgba(88,166,255,0.1)',
                          border: `1px solid ${remindStatus.includes('Failed') || remindStatus.includes('error') ? 'rgba(248,81,73,0.2)' : 'rgba(88,166,255,0.2)'}`,
                          padding: '8px 14px',
                          borderRadius: '8px'
                        }}>
                          {remindStatus}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Participants */}
                  <div style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '18px' }}>
                    <h4 style={{ fontSize: '13px', color: '#fff', fontWeight: 'bold', margin: '0 0 14px 0' }}>👥 Participants ({1 + (selectedMeeting.participants || []).length})</h4>
                    {(selectedMeeting.participants || []).length === 0 ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>No participants invited. Edit the meeting to add people.</div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {[selectedMeeting.createdBy, ...(selectedMeeting.participants || [])].map((p, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'var(--bg-primary)', borderRadius: '20px', border: '1px solid var(--border)' }}>
                            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: avatarColor(p), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '10px', color: '#fff' }}>{getInitials(p)}</div>
                            <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{p}</span>
                            {i === 0 && <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>(host)</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── CHAT TAB ── */}
              {detailTab === 'chat' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>

                  {/* Filter bar */}
                  <div style={{ padding: '8px 20px', borderBottom: '1px solid #2d2d2d', background: '#151618', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Filter by Issue:</span>
                    <select value={chatIssue} onChange={e => setChatIssue(e.target.value)}
                      style={{ background: '#22252a', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', padding: '4px 8px', fontSize: '12px' }}>
                      <option value="">All Messages</option>
                      {issues.map(iss => <option key={iss.key} value={iss.key}>{iss.key}: {iss.fields?.summary?.substring(0, 30)}</option>)}
                    </select>
                  </div>

                  {/* Messages */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {messages.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                        No messages yet. Use chat to discuss this meeting!
                      </div>
                    ) : (
                      messages.map(msg => {
                        const isSelf = msg.sender === myName;
                        return (
                          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isSelf ? 'flex-end' : 'flex-start', maxWidth: '75%', alignSelf: isSelf ? 'flex-end' : 'flex-start' }}>
                            {!isSelf && <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '3px', marginLeft: '6px', fontWeight: '600' }}>{msg.sender}</span>}
                            <div style={{ background: isSelf ? '#6264a7' : '#2b2d31', border: isSelf ? 'none' : '1px solid #3d3e42', color: '#fff', borderRadius: isSelf ? '16px 16px 4px 16px' : '16px 16px 16px 4px', padding: '10px 14px', fontSize: '13px', lineHeight: '1.45', wordWrap: 'break-word' }}>
                              {msg.issueKey && (
                                <div style={{ fontSize: '11px', color: isSelf ? '#e0e0ff' : 'var(--text-secondary)', fontWeight: 'bold', marginBottom: '4px' }}>
                                  Issue: <span className="chat-issue-badge" onClick={() => onOpenIssueDetails && onOpenIssueDetails(msg.issueKey)}>{msg.issueKey}</span>
                                </div>
                              )}
                              <div>{renderMessageText(msg.text)}</div>
                            </div>
                            <span style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '2px', alignSelf: isSelf ? 'flex-end' : 'flex-start' }}>
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Message Input */}
                  <div style={{ padding: '16px 20px', borderTop: '1px solid #2d2d2d', background: '#18191b' }}>
                    <form onSubmit={handleSendChat} style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#202225', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px 6px 12px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <select value={chatIssue} onChange={e => setChatIssue(e.target.value)}
                          style={{ background: '#18191b', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '11px', padding: '4px 6px', maxWidth: '160px' }}>
                          <option value="">Tag Issue Key...</option>
                          {issues.map(iss => <option key={iss.key} value={iss.key}>{iss.key}</option>)}
                        </select>
                      </div>
                      <input type="text" value={chatText} onChange={e => setChatText(e.target.value)} placeholder="Type a message..."
                        style={{ width: '100%', background: 'transparent', border: 'none', color: '#fff', fontSize: '13px', outline: 'none', padding: '6px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #2d2d2d', paddingTop: '6px', marginTop: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-secondary)', fontSize: '15px' }}>
                          <span style={{ cursor: 'pointer' }} title="Emoji">😊</span>
                          <span style={{ cursor: 'pointer' }} title="Attach">📎</span>
                        </div>
                        <button type="submit" disabled={!chatText.trim()} style={{ background: 'none', border: 'none', color: chatText.trim() ? '#7f85f5' : 'var(--text-secondary)', cursor: chatText.trim() ? 'pointer' : 'default' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>

      {/* ── MODALS ── */}
      {showSchedule && <ScheduleModal users={users} currentUser={user} editMeeting={editMeeting} onClose={() => { setShowSchedule(false); setEditMeeting(null); }} onSave={saveMeeting} />}
      {showJoin && <JoinModal store={store} onClose={() => setShowJoin(false)} onJoin={handleJoin} />}
      {showP2P && <P2PCallModal users={users} myName={myName} onClose={() => setShowP2P(false)} onStartCall={handleStartP2PCall} />}
    </div>
  );
}
