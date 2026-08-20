import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3001';
const PASSCODE = '1234'; // In a real app, this should be secret

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [lobbyCount, setLobbyCount] = useState(0);
  const [leaderboard, setLeaderboard] = useState<Array<{playerId: string, score: number}> | null>(null);

  useEffect(() => {
    // Admin connects just like a player, but maybe we could have a specific admin auth
    const newSocket = io(SOCKET_URL);
    
    newSocket.on('connect', () => {
      console.log('Admin connected');
    });

    // Listen for lobby updates (this needs backend support to broadcast to everyone)
    // For now, we'll just poll or rely on a specific event
    newSocket.on('LOBBY_UPDATE', (count: number) => {
      setLobbyCount(count);
    });

    newSocket.on('SHOW_LEADERBOARD', (board: Array<{playerId: string, score: number}>) => {
      setLeaderboard(board);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const handleStartGame = () => {
    if (!socket) return;
    socket.emit('trigger_start', { passcode: PASSCODE });
    alert('Start signal sent!');
  };

  const handleRevealLeaderboard = () => {
    if (!socket) return;
    socket.emit('admin_reveal_leaderboard', { passcode: PASSCODE });
    alert('Leaderboard reveal sent!');
  };

  return (
    <div className="gamified-theme" style={{ minHeight: '100vh', position: 'relative' }}>
      <div className="bg-grid-fade" />
      <div className="bg-grid" style={{ position: 'absolute', inset: 0, opacity: 0.3 }} />
      
      <div style={{ position: 'relative', zIndex: 10, padding: '4rem 1rem', maxWidth: 800, margin: '0 auto' }}>
        <h1 className="text-glow-pink" style={{ textAlign: 'center', marginBottom: '3rem' }}>HOST OVERRIDE TERMINAL</h1>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div className="box-arcade" style={{ padding: '2rem', textAlign: 'center' }}>
            <h2 style={{ color: 'var(--arcade-neon-cyan)', marginBottom: '1rem' }}>SYSTEM STATUS</h2>
            <div style={{ fontSize: '3rem', color: 'white', marginBottom: '1rem' }}>
              {lobbyCount}
            </div>
            <p style={{ color: 'var(--muted-foreground)' }}>Active Connections</p>
          </div>
          
          <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center' }}>
            <button className="btn-arcade" onClick={handleStartGame} style={{ padding: '1rem' }}>
              INITIATE SEQUENCE
            </button>
            <button className="btn-arcade" onClick={handleRevealLeaderboard} style={{ padding: '1rem', filter: 'hue-rotate(90deg)' }}>
              REVEAL LEADERBOARD
            </button>
          </div>
        </div>

        {leaderboard && (
          <div className="glass-card" style={{ marginTop: '3rem', padding: '2rem' }}>
            <h2 className="text-glow-cyan" style={{ marginBottom: '2rem' }}>LIVE RANKINGS</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {leaderboard.map((entry, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <span>#{idx + 1} {entry.playerId.substring(0,6)}</span>
                  <span style={{ color: 'var(--arcade-neon-yellow)' }}>{entry.score} PTS</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
