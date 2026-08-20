import { useState, useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
import './App.css'

// Hardcoded for now. In a real scenario, this would come from an env var.
const SOCKET_URL = 'http://localhost:3001';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activePlayers, setActivePlayers] = useState(0);

  useEffect(() => {
    // We only connect the socket when the admin submits the correct passcode
    if (isAuthenticated && !socket) {
      const newSocket = io(SOCKET_URL, {
        auth: {
          token: 'admin-secret-token' // In real life, use proper JWT after login
        }
      });

      newSocket.on('connect', () => setIsConnected(true));
      newSocket.on('disconnect', () => setIsConnected(false));
      
      // Listen for lobby updates
      newSocket.on('lobby_count', (count: number) => {
        setActivePlayers(count);
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    }
  }, [isAuthenticated, socket]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === '1234') { // Mock passcode logic
      setIsAuthenticated(true);
    } else {
      alert('Invalid passcode');
    }
  };

  const handleStartEvent = () => {
    if (socket) {
      socket.emit('trigger_start', { passcode: '1234' });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <h1>Admin Control Panel</h1>
        <form onSubmit={handleLogin}>
          <input 
            type="password" 
            value={passcode} 
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Enter Admin Passcode"
          />
          <button type="submit">Access System</button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header>
        <h1>Spider-Man: Power Grid Challenge - LIVE CONTROL</h1>
        <div className={`status ${isConnected ? 'online' : 'offline'}`}>
          {isConnected ? '● Connected to Server' : '○ Disconnected'}
        </div>
      </header>

      <main>
        <section className="lobby-counter">
          <h2>Players Ready</h2>
          <div className="count-display">
            <span className="current">{activePlayers}</span>
            <span className="max">/ 1000</span>
          </div>
        </section>

        <section className="actions" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <button 
            className="start-btn" 
            onClick={handleStartEvent}
            disabled={!isConnected}
          >
            START EVENT (Broadcast GAME_START)
          </button>
          
          <button 
            className="leaderboard-btn" 
            onClick={() => socket?.emit('trigger_leaderboard', { passcode: '1234' })}
            disabled={!isConnected}
            style={{ backgroundColor: '#007bff' }}
          >
            REVEAL LEADERBOARD
          </button>
        </section>
      </main>
    </div>
  )
}

export default App
