import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';

const SOCKET_URL = 'http://localhost:3001';
const PASSCODE = '1234';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [lobbyCount, setLobbyCount] = useState(0);
  const [leaderboard, setLeaderboard] = useState<Array<{playerId: string, score: number}> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastAction, setLastAction] = useState<string>('');

  useEffect(() => {
    const newSocket = io(SOCKET_URL, { auth: { token: 'admin-secret-token' } });

    newSocket.on('connect', () => {
      setIsConnected(true);
    });
    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });
    newSocket.on('lobby_count', (count: number) => {
      setLobbyCount(count);
    });
    newSocket.on('SHOW_LEADERBOARD', (board: Array<{playerId: string, score: number}>) => {
      setLeaderboard(board);
    });

    setSocket(newSocket);
    return () => { newSocket.close(); };
  }, []);

  const handleStartGame = () => {
    if (!socket) return;
    socket.emit('trigger_start', { passcode: PASSCODE });
    setLastAction('START signal sent at ' + new Date().toLocaleTimeString());
  };

  const handleRevealLeaderboard = () => {
    if (!socket) return;
    socket.emit('trigger_leaderboard', { passcode: PASSCODE });
    setLastAction('LEADERBOARD revealed at ' + new Date().toLocaleTimeString());
  };

  const handleResetGame = () => {
    if (!socket) return;
    if (!confirm('Are you sure you want to RESET the game? All player screens will return to lobby.')) return;
    socket.emit('trigger_reset', { passcode: PASSCODE });
    setLeaderboard(null);
    setLastAction('RESET sent at ' + new Date().toLocaleTimeString());
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', position: 'relative', overflow: 'hidden' }}>
      {/* HUD grid background */}
      <div className="hud-grid" style={{ position: 'fixed', inset: 0, zIndex: 0, opacity: 0.4 }} />
      {/* Scan line */}
      <div className="scan-line-el" style={{ zIndex: 1 }} />

      {/* Corner brackets */}
      <div style={{ position: 'fixed', top: 24, left: 24, width: 24, height: 24, borderTop: '1px solid rgba(255,255,255,0.2)', borderLeft: '1px solid rgba(255,255,255,0.2)', zIndex: 2 }} />
      <div style={{ position: 'fixed', top: 24, right: 24, width: 24, height: 24, borderTop: '1px solid rgba(255,255,255,0.2)', borderRight: '1px solid rgba(255,255,255,0.2)', zIndex: 2 }} />
      <div style={{ position: 'fixed', bottom: 24, left: 24, width: 24, height: 24, borderBottom: '1px solid rgba(255,255,255,0.2)', borderLeft: '1px solid rgba(255,255,255,0.2)', zIndex: 2 }} />
      <div style={{ position: 'fixed', bottom: 24, right: 24, width: 24, height: 24, borderBottom: '1px solid rgba(255,255,255,0.2)', borderRight: '1px solid rgba(255,255,255,0.2)', zIndex: 2 }} />

      {/* Top App Bar */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', height: 64,
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 0 20px rgba(230,36,41,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="material-symbols-outlined" style={{ color: '#e62429', fontSize: 28, fontVariationSettings: "'FILL' 1" }}>bolt</span>
          <div>
            <div className="text-display-md text-crimson" style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em' }}>
              SPIDEY-SENSE
            </div>
            <div className="text-label text-muted" style={{ fontSize: 10 }}>COMMAND CONTROL PANEL</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Connection badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 4,
            background: isConnected ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${isConnected ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: isConnected ? '#22c55e' : '#6b7280',
              boxShadow: isConnected ? '0 0 8px #22c55e' : 'none',
              animation: isConnected ? 'spideyBlink 2s infinite' : 'none',
            }} />
            <span className="text-label" style={{ color: isConnected ? '#22c55e' : '#6b7280', fontSize: 10 }}>
              {isConnected ? 'ONLINE & AUTHENTICATED' : 'OFFLINE'}
            </span>
          </div>

          {/* Force Reset */}
          <button
            className="btn-ghost"
            onClick={handleResetGame}
            style={{
              padding: '6px 16px', borderRadius: 4,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>restart_alt</span>
            FORCE RESET
          </button>
        </div>
      </header>

      {/* Main */}
      <main style={{ position: 'relative', zIndex: 10, maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
          {/* Live players */}
          <div
            className="glass-panel"
            style={{ padding: '24px', borderRadius: 4, textAlign: 'center', position: 'relative' }}
          >
            <div className="corner-tl" /><div className="corner-tr" /><div className="corner-bl" /><div className="corner-br" />
            <span className="material-symbols-outlined" style={{ color: '#e62429', fontSize: 28, display: 'block', marginBottom: 8, fontVariationSettings: "'FILL' 1" }}>group</span>
            <div className="text-display-lg text-crimson" style={{ fontSize: 48, fontWeight: 800, lineHeight: 1 }}>{lobbyCount}</div>
            <div className="text-label text-muted" style={{ marginTop: 8, letterSpacing: '0.15em' }}>LIVE OPERATIVES</div>
          </div>

          {/* Status */}
          <div
            className="glass-panel"
            style={{ padding: '24px', borderRadius: 4, textAlign: 'center', position: 'relative' }}
          >
            <div className="corner-tl" /><div className="corner-tr" /><div className="corner-bl" /><div className="corner-br" />
            <span className="material-symbols-outlined" style={{ color: isConnected ? '#22c55e' : '#6b7280', fontSize: 28, display: 'block', marginBottom: 8, fontVariationSettings: "'FILL' 1" }}>
              {isConnected ? 'wifi' : 'wifi_off'}
            </span>
            <div className="text-data" style={{ color: isConnected ? '#22c55e' : '#6b7280', fontSize: 18 }}>
              {isConnected ? 'UPLINK SECURE' : 'DISCONNECTED'}
            </div>
            <div className="text-label text-muted" style={{ marginTop: 8, letterSpacing: '0.15em' }}>CONNECTION STATUS</div>
          </div>

          {/* Last action */}
          <div
            className="glass-panel"
            style={{ padding: '24px', borderRadius: 4, textAlign: 'center', position: 'relative' }}
          >
            <div className="corner-tl" /><div className="corner-tr" /><div className="corner-bl" /><div className="corner-br" />
            <span className="material-symbols-outlined" style={{ color: '#82cfff', fontSize: 28, display: 'block', marginBottom: 8, fontVariationSettings: "'FILL' 1" }}>history</span>
            <div className="text-label" style={{ color: '#82cfff', lineHeight: 1.4, letterSpacing: '0.05em' }}>
              {lastAction || 'NO ACTION YET'}
            </div>
            <div className="text-label text-muted" style={{ marginTop: 8, letterSpacing: '0.15em' }}>LAST SIGNAL</div>
          </div>
        </div>

        {/* Control Deck */}
        <div className="glass-panel" style={{ padding: '32px', borderRadius: 4, marginBottom: 32, position: 'relative' }}>
          <h2 className="text-data text-muted" style={{ marginBottom: 24, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.1)', letterSpacing: '0.1em' }}>
            CONTROL DECK
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {/* Start Event */}
            <button
              className="btn-primary hud-panel"
              onClick={handleStartGame}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 16, height: 140, borderRadius: 4, position: 'relative',
                cursor: 'pointer',
              }}
            >
              <div className="corner-tl" /><div className="corner-tr" /><div className="corner-bl" /><div className="corner-br" />
              <span className="material-symbols-outlined" style={{ fontSize: 36, fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
              <span style={{ letterSpacing: '0.15em', fontSize: 13 }}>START EVENT</span>
            </button>

            {/* Reveal Leaderboard */}
            <button
              className="hud-panel"
              onClick={handleRevealLeaderboard}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 16, height: 140, borderRadius: 4,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.15)',
                cursor: 'pointer', color: 'white',
                position: 'relative',
              }}
            >
              <div className="corner-tl" /><div className="corner-tr" /><div className="corner-bl" /><div className="corner-br" />
              <span className="material-symbols-outlined" style={{ fontSize: 36, color: '#82cfff', fontVariationSettings: "'FILL' 1" }}>leaderboard</span>
              <span className="text-label" style={{ letterSpacing: '0.15em', fontSize: 13, color: 'var(--color-on-surface)' }}>REVEAL LEADERBOARD</span>
            </button>
          </div>
        </div>

        {/* Leaderboard Panel */}
        {leaderboard && (
          <div className="glass-panel" style={{ padding: '32px', borderRadius: 4, position: 'relative' }}>
            <h2 className="text-data" style={{ color: '#e62429', marginBottom: 24, letterSpacing: '0.1em' }}>
              LIVE RANKINGS
            </h2>

            {/* Column headers */}
            <div
              className="text-label text-muted"
              style={{
                display: 'grid', gridTemplateColumns: '60px 1fr 100px',
                padding: '8px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                letterSpacing: '0.1em',
              }}
            >
              <span>RANK</span><span>OPERATIVE</span><span style={{ textAlign: 'right' }}>SCORE</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {leaderboard.map((entry, idx) => (
                <div
                  key={idx}
                  className={idx === 0 ? 'elite-row' : ''}
                  style={{
                    display: 'grid', gridTemplateColumns: '60px 1fr 100px',
                    padding: '14px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    alignItems: 'center',
                    transition: 'background 0.2s',
                  }}
                >
                  <span className="text-data" style={{ color: idx === 0 ? '#e62429' : 'rgba(255,255,255,0.4)', fontSize: 16 }}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="text-body" style={{ fontWeight: 700 }}>
                    {entry.playerId.substring(0, 12)}
                  </span>
                  <span className="text-data" style={{ textAlign: 'right', color: idx === 0 ? '#ffb4ac' : 'var(--color-on-surface)', fontSize: 16 }}>
                    {entry.score}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <style>{`@keyframes spideyBlink{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  );
}

export default App;
