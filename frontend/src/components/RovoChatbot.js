import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

export default function RovoChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: 'rovo', text: 'Hi! I am LIA, your APNILEAP AI Copilot powered by Llama 3. Ask me anything about GitLab boards, BookStack wikis, project statuses, or meeting schedules!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { sender: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const token = localStorage.getItem('apnileap-token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const response = await axios.post('/api/rovo/chat', { message: input }, { headers });
      const rovoMsg = { sender: 'rovo', text: response.data.reply || "Sorry, I couldn't process that query." };
      setMessages(prev => [...prev, rovoMsg]);
    } catch (err) {
      setMessages(prev => [...prev, { sender: 'rovo', text: 'Failed to communicate with LIA engine. Make sure the database is running.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000, fontFamily: 'system-ui, sans-serif' }}>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366f1, #a855f7)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 8px 32px rgba(168, 85, 247, 0.4)',
          fontSize: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s',
          outline: 'none'
        }}
        onMouseEnter={(e) => e.target.style.transform = 'scale(1.08)'}
        onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
      >
        {isOpen ? '✕' : '💬'}
      </button>
 
      {/* Chat Window */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: '75px',
          right: '0',
          width: '380px',
          height: '500px',
          background: 'rgba(17, 24, 39, 0.95)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            padding: '16px',
            color: 'white',
            fontWeight: '700',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>🤖 LIA AI Copilot</span>
            <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '12px' }}>Active</span>
          </div>
 
          {/* Messages Container */}
          <div style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            color: '#f3f4f6'
          }}>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: msg.sender === 'user' ? '#6366f1' : 'rgba(255, 255, 255, 0.05)',
                  border: msg.sender === 'user' ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  fontSize: '13.5px',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-line'
                }}
              >
                {msg.text}
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.05)', padding: '10px 14px', borderRadius: '12px', fontSize: '13px', color: '#9ca3af' }}>
                Thinking...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
 
          {/* Input Form */}
          <form onSubmit={handleSend} style={{ padding: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask LIA to query status or meetings..."
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: 'white',
                fontSize: '13px',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
