import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';
import { Ability, getMiniGameById, MINI_GAMES, MiniGame } from './gameConfig';
import MiniGamePlaceholder, { GameResult } from './MiniGamePlaceholder';
import { buildSubmissionPayload, getTaskTimeMs } from './scoring';

const SOCKET_URL = 'http://localhost:3001';

type GameState = 'LOBBY' | 'SELECT_ABILITY' | 'SELECT_ELEMENTS' | 'PLAY_GAME' | 'FINISHED' | 'LEADERBOARD_VIEW';

function App() {
  const [gameState, setGameState] = useState<GameState>('LOBBY');
  const [socket, setSocket] = useState<Socket | null>(null);
  
  const [playerName, setPlayerName] = useState('');
  const [playerPhone, setPlayerPhone] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [leaderboard, setLeaderboard] = useState<Array<{playerId: string, score: number}>>([]);
  
  const [ability, setAbility] = useState<Ability | null>(null);
  const [completedGames, setCompletedGames] = useState<string[]>([]);
  const [activeGame, setActiveGame] = useState<MiniGame | null>(null);
  const [results, setResults] = useState<GameResult[]>([]);
  const [roundStartMs, setRoundStartMs] = useState(0);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${SOCKET_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName, phone: playerPhone })
      });
      const data = await response.json();
      
      if (data.token) {
        setIsRegistered(true);
        setPlayerId(data.playerId);
        connectSocket(data.token);
      } else {
        alert('Registration failed');
      }
    } catch (err) {
      console.error(err);
      alert('Error registering');
    }
  };

  const connectSocket = (token: string) => {
    const newSocket = io(SOCKET_URL, { auth: { token } });
    newSocket.on('connect', () => console.log('Connected to server lobby'));
    newSocket.on('GAME_START', () => {
      setRoundStartMs(Date.now());
      setGameState('SELECT_ABILITY');
    });
    newSocket.on('SHOW_LEADERBOARD', (board: Array<{playerId: string, score: number}>) => {
      setLeaderboard(board);
      setGameState('LEADERBOARD_VIEW');
    });
    setSocket(newSocket);
  };

  const handleAbilitySelect = (ab: Ability) => {
    setAbility(ab);
    setGameState('SELECT_ELEMENTS');
  };

  const handleGameSelect = (game: MiniGame) => {
    if (completedGames.includes(game.id)) return;
    if (completedGames.length >= 7) return;
    setActiveGame(game);
    setGameState('PLAY_GAME');
  };

  const handleGameComplete = async (result: GameResult) => {
    const newResults = [...results, result];
    const newCompleted = [...completedGames, result.gameId];
    setResults(newResults);
    setCompletedGames(newCompleted);
    setActiveGame(null);

    if (newCompleted.length >= 7) {
      const payload = buildSubmissionPayload(playerId, ability!, newResults, roundStartMs);
      try {
        const response = await fetch(`${SOCKET_URL}/submit-score`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${socket?.auth?.token}`
          },
          body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (data.ok) {
          setFinalScore(data.score);
          setGameState('FINISHED');
        } else {
          alert('Submission error: ' + data.error);
        }
      } catch (err) {
        console.error('Error submitting score', err);
        alert('Failed to submit score');
      }
    } else {
      setGameState('SELECT_ELEMENTS');
    }
  };

  // Helper to render the inner content
  const renderContent = () => {
    if (!isRegistered) {
      return (
        <div className="glass-card" style={{ maxWidth: 400, margin: '0 auto', padding: '2rem', borderRadius: 8 }}>
          <h1 className="text-glow-cyan" style={{ textAlign: 'center', marginBottom: '2rem' }}>Spider-Man: Power Grid</h1>
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input 
              type="text" placeholder="Hero Name" value={playerName}
              onChange={e => setPlayerName(e.target.value)} required 
              style={{ padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--arcade-neon-cyan)', color: 'white', borderRadius: 4 }}
            />
            <input 
              type="tel" placeholder="Comm Link (Phone)" value={playerPhone}
              onChange={e => setPlayerPhone(e.target.value)} required 
              style={{ padding: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--arcade-neon-cyan)', color: 'white', borderRadius: 4 }}
            />
            <button type="submit" className="btn-arcade" style={{ padding: '16px', marginTop: '1rem' }}>ENTER GRID</button>
          </form>
        </div>
      );
    }

    if (gameState === 'LOBBY') {
      return (
        <div className="glass-card animate-pulse-fast" style={{ maxWidth: 600, margin: '0 auto', padding: '3rem', textAlign: 'center', borderRadius: 8 }}>
          <h1 className="text-glow-pink">AWAITING DEPLOYMENT</h1>
          <p style={{ marginTop: '1rem', color: 'var(--muted-foreground)' }}>Waiting for Host signal to commence...</p>
        </div>
      );
    }

    if (gameState === 'SELECT_ABILITY') {
      return (
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <h1 className="text-glow-cyan" style={{ marginBottom: '1rem' }}>SELECT MODIFIER</h1>
          <p style={{ color: 'var(--muted-foreground)', marginBottom: '3rem' }}>This modifier applies to all your missions.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem' }}>
            <button className="btn-arcade" onClick={() => handleAbilitySelect('SPEED')} style={{ padding: '2rem' }}>
              <div style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>SPEED</div>
              <div style={{ fontSize: '0.8rem', color: '#ccc' }}>+30s per task</div>
            </button>
            <button className="btn-arcade" onClick={() => handleAbilitySelect('STRENGTH')} style={{ padding: '2rem' }}>
              <div style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>STRENGTH</div>
              <div style={{ fontSize: '0.8rem', color: '#ccc' }}>+5 pts per correct task</div>
            </button>
            <button className="btn-arcade" onClick={() => handleAbilitySelect('DEFENCE')} style={{ padding: '2rem' }}>
              <div style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>DEFENCE</div>
              <div style={{ fontSize: '0.8rem', color: '#ccc' }}>-2 penalty (instead of -10)</div>
            </button>
          </div>
        </div>
      );
    }

    if (gameState === 'SELECT_ELEMENTS') {
      return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 className="text-glow-pink">MISSION CONTROL</h1>
            <p style={{ color: 'var(--arcade-neon-yellow)' }}>COMPLETED: {completedGames.length} / 7</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            {MINI_GAMES.map((game, i) => {
              const isCompleted = completedGames.includes(game.id);
              return (
                <div 
                  key={game.id} 
                  className={isCompleted ? "glass-card" : "box-arcade animate-shine"}
                  onClick={() => handleGameSelect(game)}
                  style={{ 
                    cursor: isCompleted ? 'not-allowed' : 'pointer',
                    opacity: isCompleted ? 0.5 : 1,
                    filter: isCompleted ? 'grayscale(100%)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '2rem 1rem',
                    textAlign: 'center',
                    borderRadius: 8
                  }}
                >
                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem', fontFamily: '"Press Start 2P", cursive' }}>{i + 1}</span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--arcade-neon-cyan)' }}>{game.tier}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (gameState === 'PLAY_GAME' && activeGame) {
      const taskTimeMs = getTaskTimeMs(activeGame.timeLimitMs, ability!);
      return (
        <div className="glass-card" style={{ maxWidth: 800, margin: '0 auto', padding: '2rem', borderRadius: 8 }}>
          <h2 className="text-glow-cyan" style={{ textAlign: 'center' }}>{activeGame.name}</h2>
          <p style={{ textAlign: 'center', color: 'var(--arcade-neon-pink)', marginBottom: '2rem' }}>
            TIER: {activeGame.tier} | TIME: {taskTimeMs / 1000}s
          </p>
          <MiniGamePlaceholder 
            key={activeGame.id}
            gameId={activeGame.id}
            taskTimeMs={taskTimeMs}
            onComplete={handleGameComplete}
          />
        </div>
      );
    }

    if (gameState === 'FINISHED') {
      return (
        <div className="box-arcade" style={{ maxWidth: 600, margin: '0 auto', padding: '3rem', textAlign: 'center' }}>
          <h1 className="text-glow-cyan">SYSTEM OVERRIDE COMPLETE</h1>
          <h2 style={{ fontSize: '3rem', margin: '2rem 0', color: 'var(--arcade-neon-yellow)' }}>{finalScore} PTS</h2>
          <p className="animate-pulse-fast" style={{ color: 'var(--arcade-neon-pink)' }}>Waiting for global leaderboard sync...</p>
        </div>
      );
    }

    if (gameState === 'LEADERBOARD_VIEW') {
      return (
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <h1 className="text-glow-pink" style={{ textAlign: 'center', marginBottom: '3rem' }}>GLOBAL RANKINGS</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {leaderboard.map((entry, idx) => (
              <div key={idx} className="glass-card" style={{ padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 8 }}>
                <span style={{ fontSize: '1.5rem', color: idx === 0 ? 'var(--arcade-neon-yellow)' : 'white' }}>
                  #{idx + 1} {entry.playerId.substring(0,6)}
                </span>
                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--arcade-neon-cyan)' }}>
                  {entry.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="gamified-theme" style={{ minHeight: '100vh', position: 'relative' }}>
      <div className="bg-grid-fade" />
      <div className="bg-grid" style={{ position: 'absolute', inset: 0, opacity: 0.3 }} />
      <div style={{ position: 'relative', zIndex: 10, padding: '4rem 1rem' }}>
        {renderContent()}
      </div>
    </div>
  );
}

export default App;
