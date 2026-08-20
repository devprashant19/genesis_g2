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
  
  // Player state
  const [playerName, setPlayerName] = useState('');
  const [playerPhone, setPlayerPhone] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [leaderboard, setLeaderboard] = useState<Array<{playerId: string, score: number}>>([]);
  
  // Gameplay state
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
      setRoundStartMs(Date.now()); // Start the round timer
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
    if (completedGames.includes(game.id)) return; // Already played
    if (completedGames.length >= 7) return; // Reached limit
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
      // Finished all 7 games, compute and submit
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
      // Go back to element selection for the next game
      setGameState('SELECT_ELEMENTS');
    }
  };

  if (!isRegistered) {
    return (
      <div className="container">
        <h1>Spider-Man: Power Grid Challenge</h1>
        <form onSubmit={handleRegister} className="register-form">
          <input 
            type="text" placeholder="Name" value={playerName}
            onChange={e => setPlayerName(e.target.value)} required />
          <input 
            type="tel" placeholder="Phone Number" value={playerPhone}
            onChange={e => setPlayerPhone(e.target.value)} required />
          <button type="submit">Join Event</button>
        </form>
      </div>
    );
  }

  if (gameState === 'LOBBY') {
    return (
      <div className="container">
        <h1>Waiting in Lobby...</h1>
        <p>Waiting for Admin start signal.</p>
      </div>
    );
  }

  if (gameState === 'SELECT_ABILITY') {
    return (
      <div className="container">
        <h1>Select your Ability</h1>
        <p>This modifier applies to all your tasks.</p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 24 }}>
          <button onClick={() => handleAbilitySelect('SPEED')}>Speed (+30s per task)</button>
          <button onClick={() => handleAbilitySelect('STRENGTH')}>Strength (+5 points per correct task)</button>
          <button onClick={() => handleAbilitySelect('DEFENCE')}>Defence (-2 penalty instead of -10)</button>
        </div>
      </div>
    );
  }

  if (gameState === 'SELECT_ELEMENTS') {
    return (
      <div className="container">
        <h1>Mission Control</h1>
        <p>Select a mission to play. You have completed {completedGames.length} of 7 tasks.</p>
        <div className="grid-container" style={{ marginTop: 24 }}>
          {MINI_GAMES.map((game, i) => {
            const isCompleted = completedGames.includes(game.id);
            return (
              <div 
                key={game.id} 
                className={`grid-item ${isCompleted ? 'completed' : ''}`}
                onClick={() => handleGameSelect(game)}
                style={{ 
                  backgroundColor: isCompleted ? '#444' : '#2a2a2a',
                  color: isCompleted ? '#888' : '#fff',
                  cursor: isCompleted ? 'not-allowed' : 'pointer',
                  borderColor: isCompleted ? 'transparent' : '#555',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 16,
                  textAlign: 'center'
                }}
              >
                <span style={{ fontSize: '1rem', marginBottom: 8 }}>Mission {i + 1}</span>
                <span style={{ fontSize: '0.8rem', color: isCompleted ? '#666' : '#aaa' }}>{game.tier}</span>
                {isCompleted && <span style={{ color: '#28a745', fontSize: '0.9rem', marginTop: 8 }}>COMPLETED</span>}
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
      <div className="container">
        <h2>Active Mission: {activeGame.name}</h2>
        <p>Tier: {activeGame.tier} | Time Limit: {taskTimeMs / 1000}s</p>
        <div style={{ marginTop: 32 }}>
          <MiniGamePlaceholder 
            key={activeGame.id}
            gameId={activeGame.id}
            taskTimeMs={taskTimeMs}
            onComplete={handleGameComplete}
          />
        </div>
      </div>
    );
  }

  if (gameState === 'FINISHED') {
    return (
      <div className="container">
        <h1>Event Complete!</h1>
        <h2>Your Final Score: {finalScore}</h2>
        <p>Waiting for the global leaderboard reveal...</p>
      </div>
    );
  }

  if (gameState === 'LEADERBOARD_VIEW') {
    return (
      <div className="container">
        <h1>Global Leaderboard</h1>
        <div style={{ marginTop: 32, textAlign: 'left', display: 'inline-block' }}>
          {leaderboard.map((entry, idx) => (
            <div key={idx} style={{ padding: '8px 16px', borderBottom: '1px solid #444', display: 'flex', justifyContent: 'space-between', gap: 64 }}>
              <span>#{idx + 1} Player {entry.playerId.substring(0,6)}</span>
              <span style={{ fontWeight: 'bold' }}>{entry.score} pts</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

export default App;
