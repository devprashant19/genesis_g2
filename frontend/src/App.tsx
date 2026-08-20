import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';
import { getMiniGameById, MINI_GAMES } from './gameConfig';
import type { Ability, MiniGame } from './gameConfig';
import MiniGamePlaceholder from './MiniGamePlaceholder';
import type { GameResult } from './MiniGamePlaceholder';
import { buildSubmissionPayload, getTaskTimeMs } from './scoring';
import MissionConfirmModal from './MissionConfirmModal';
import MissionLoadingScreen from './MissionLoadingScreen';

const SOCKET_URL = 'http://localhost:3001';

type GameState = 'LOBBY' | 'SELECT_ABILITY' | 'SELECT_ELEMENTS' | 'PLAY_GAME' | 'FINISHED' | 'LEADERBOARD_VIEW';

// ── WebGL Shader Background ────────────────────────────────────────────
function ShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const syncSize = () => {
      const w = canvas.clientWidth || 1280;
      const h = canvas.clientHeight || 720;
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    };
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(syncSize).observe(canvas);
    syncSize();
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
    if (!gl) return;
    const vs = `attribute vec2 a_position; varying vec2 v_texCoord;
void main(){ v_texCoord=a_position*0.5+0.5; gl_Position=vec4(a_position,0.0,1.0); }`;
    const fs = `precision highp float; varying vec2 v_texCoord;
uniform float u_time; uniform vec2 u_resolution;
void main(){
  vec2 uv=v_texCoord; vec3 color=vec3(0.03,0.03,0.03);
  vec2 grid=fract(uv*40.0+sin(u_time*0.1)*0.05);
  float line=smoothstep(0.0,0.03,grid.x)*smoothstep(1.0,0.97,grid.x)+smoothstep(0.0,0.03,grid.y)*smoothstep(1.0,0.97,grid.y);
  color+=line*vec3(0.9,0.14,0.16)*0.05;
  for(float i=1.0;i<4.0;i++){uv.x+=0.2/i*sin(i*uv.y+u_time*0.5+i);uv.y+=0.1/i*cos(i*uv.x+u_time*0.3+i);}
  float wave=abs(sin(uv.y*10.0+u_time));
  color+=(1.0/(wave*50.0))*vec3(0.9,0.14,0.16);
  gl_FragColor=vec4(color,1.0);
}`;
    function cs(type: number, src: string) {
      const s = (gl as WebGLRenderingContext).createShader(type)!;
      (gl as WebGLRenderingContext).shaderSource(s, src);
      (gl as WebGLRenderingContext).compileShader(s);
      return s;
    }
    const prog = (gl as WebGLRenderingContext).createProgram()!;
    (gl as WebGLRenderingContext).attachShader(prog, cs((gl as WebGLRenderingContext).VERTEX_SHADER, vs));
    (gl as WebGLRenderingContext).attachShader(prog, cs((gl as WebGLRenderingContext).FRAGMENT_SHADER, fs));
    (gl as WebGLRenderingContext).linkProgram(prog);
    (gl as WebGLRenderingContext).useProgram(prog);
    const buf = (gl as WebGLRenderingContext).createBuffer();
    (gl as WebGLRenderingContext).bindBuffer((gl as WebGLRenderingContext).ARRAY_BUFFER, buf);
    (gl as WebGLRenderingContext).bufferData((gl as WebGLRenderingContext).ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), (gl as WebGLRenderingContext).STATIC_DRAW);
    const pos = (gl as WebGLRenderingContext).getAttribLocation(prog, 'a_position');
    (gl as WebGLRenderingContext).enableVertexAttribArray(pos);
    (gl as WebGLRenderingContext).vertexAttribPointer(pos, 2, (gl as WebGLRenderingContext).FLOAT, false, 0, 0);
    const uTime = (gl as WebGLRenderingContext).getUniformLocation(prog, 'u_time');
    const uRes = (gl as WebGLRenderingContext).getUniformLocation(prog, 'u_resolution');
    let raf: number;
    function render(t: number) {
      syncSize();
      (gl as WebGLRenderingContext).viewport(0, 0, canvas!.width, canvas!.height);
      if (uTime) (gl as WebGLRenderingContext).uniform1f(uTime, t * 0.001);
      if (uRes) (gl as WebGLRenderingContext).uniform2f(uRes, canvas!.width, canvas!.height);
      (gl as WebGLRenderingContext).drawArrays((gl as WebGLRenderingContext).TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(render);
    }
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, display: 'block' }}
    />
  );
}

// ── Score Badge (top-right, shown once registered) ────────────────────
function ScoreBadge({ score }: { score: number }) {
  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px',
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.15)',
        boxShadow: '0 0 20px rgba(230,36,41,0.2)',
      }}
    >
      <div
        className="text-display-md text-crimson"
        style={{ fontSize: 24, letterSpacing: '-0.02em', fontWeight: 800 }}
      >
        SPIDEY-SENSE
      </div>
      <div className="text-data" style={{ color: '#ffb4ac', fontWeight: 700 }}>
        {score} PTS
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────
function App() {
  const [gameState, setGameState] = useState<GameState>('LOBBY');
  const [socket, setSocket] = useState<Socket | null>(null);

  const [playerName, setPlayerName] = useState('');
  const [playerEmail, setPlayerEmail] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [leaderboard, setLeaderboard] = useState<Array<{playerId: string, score: number}>>([]);
  const [score, setScore] = useState(50); // starts at 50

  const [ability, setAbility] = useState<Ability | null>(null);
  const [completedGames, setCompletedGames] = useState<string[]>([]);
  const [activeGame, setActiveGame] = useState<MiniGame | null>(null);
  const [results, setResults] = useState<GameResult[]>([]);
  const [roundStartMs, setRoundStartMs] = useState(0);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  // Modal / loading states
  const [pendingGame, setPendingGame] = useState<MiniGame | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showLoading, setShowLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${SOCKET_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName, phone: playerEmail })
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
    newSocket.on('RESET_GAME', () => {
      // Disconnect and wipe all state → forces user back to login
      newSocket.disconnect();
      setSocket(null);
      setIsRegistered(false);
      setPlayerName('');
      setPlayerEmail('');
      setPlayerId('');
      setGameState('LOBBY');
      setCompletedGames([]);
      setResults([]);
      setFinalScore(null);
      setAbility(null);
      setActiveGame(null);
      setPendingGame(null);
      setShowConfirm(false);
      setShowLoading(false);
      setLeaderboard([]);
      setScore(50);
    });
    setSocket(newSocket);
  };

  const handleAbilitySelect = (ab: Ability) => {
    setAbility(ab);
    setGameState('SELECT_ELEMENTS');
  };

  // Clicking a mission card → show confirm modal
  const handleMissionClick = (game: MiniGame) => {
    if (completedGames.includes(game.id)) return;
    if (completedGames.length >= 7) return;
    setPendingGame(game);
    setShowConfirm(true);
  };

  // Confirmed → show loading screen
  const handleConfirmDeploy = () => {
    setShowConfirm(false);
    setShowLoading(true);
    setActiveGame(pendingGame);
  };

  // Loading complete → go to PLAY_GAME
  const handleLoadingComplete = () => {
    setShowLoading(false);
    setGameState('PLAY_GAME');
  };

  const handleGameComplete = async (result: GameResult) => {
    const newResults = [...results, result];
    const newCompleted = [...completedGames, result.gameId];
    setResults(newResults);
    setCompletedGames(newCompleted);
    setActiveGame(null);

    // Update score locally for display
    if (result.correct) setScore((s) => s + 10);
    else if (!result.timedOut) setScore((s) => Math.max(0, s - 5));

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

  // ── Screens ────────────────────────────────────────────────────────

  // LOGIN
  if (!isRegistered) {
    return (
      <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <ShaderBackground />
        {/* grid overlay */}
        <div className="hud-grid" style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none', opacity: 0.5 }} />

        <main style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 420, padding: '0 16px' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 32, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 16, height: 16, borderTop: '1px solid #e62429', borderLeft: '1px solid #e62429' }} />
            <div style={{ position: 'absolute', top: 0, right: 0, width: 16, height: 16, borderTop: '1px solid #e62429', borderRight: '1px solid #e62429' }} />
            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 800,
              letterSpacing: '-0.02em', textTransform: 'uppercase',
              color: '#e62429', textShadow: '0 0 30px rgba(230,36,41,0.5)',
              paddingTop: 4,
            }}>
              SPIDEY-SENSE
            </h1>
            <p className="text-label text-muted" style={{ marginTop: 8, letterSpacing: '0.2em' }}>
              TACTICAL COMMAND AUTHENTICATION
            </p>
          </div>

          {/* Glass card */}
          <div className="glass-panel" style={{ borderRadius: 4, padding: 32 }}>
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Username */}
              <div style={{ position: 'relative' }}>
                <label className="text-label text-muted" style={{ display: 'block', marginBottom: 4 }}>USERNAME</label>
                <input
                  type="text"
                  id="username"
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                  required
                  placeholder="Enter callsign"
                  style={{ paddingBottom: 8 }}
                />
              </div>

              {/* Email */}
              <div style={{ position: 'relative', paddingTop: 8 }}>
                <label className="text-label text-muted" style={{ display: 'block', marginBottom: 4 }}>EMAIL</label>
                <input
                  type="email"
                  id="email"
                  value={playerEmail}
                  onChange={e => setPlayerEmail(e.target.value)}
                  required
                  placeholder="Enter email"
                  style={{ paddingBottom: 8 }}
                />
              </div>

              {/* Submit */}
              <div style={{ paddingTop: 16 }}>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{
                    width: '100%', padding: '14px 24px', borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  <span style={{ opacity: 0.8 }}>[</span>
                  <span style={{ letterSpacing: '0.15em' }}>ENTER</span>
                  <span style={{ opacity: 0.8 }}>]</span>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>login</span>
                </button>
              </div>
            </form>
          </div>

          {/* Status */}
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--color-tertiary)',
              boxShadow: '0 0 8px #82cfff',
              animation: 'spideyBlink 2s infinite',
            }} />
            <span className="text-label text-muted">SYSTEM_SECURE</span>
          </div>
        </main>

        <style>{`@keyframes spideyBlink{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
      </div>
    );
  }

  // LOBBY — Awaiting Deployment
  if (gameState === 'LOBBY') {
    return (
      <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
        <div className="hud-grid" style={{ position: 'fixed', inset: 0, zIndex: 0, opacity: 0.5 }} />
        <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(to bottom, var(--color-background), transparent, var(--color-background))', zIndex: 0, pointerEvents: 'none' }} />
        <div className="scan-line-el" style={{ zIndex: 2 }} />

        {/* Corner decorations */}
        <div style={{ position: 'fixed', top: 32, left: 32, width: 32, height: 32, borderTop: '2px solid rgba(255,255,255,0.15)', borderLeft: '2px solid rgba(255,255,255,0.15)' }} />
        <div style={{ position: 'fixed', top: 32, right: 32, width: 32, height: 32, borderTop: '2px solid rgba(255,255,255,0.15)', borderRight: '2px solid rgba(255,255,255,0.15)' }} />
        <div style={{ position: 'fixed', bottom: 32, right: 32, width: 32, height: 32, borderBottom: '2px solid rgba(255,255,255,0.15)', borderRight: '2px solid rgba(255,255,255,0.15)' }} />

        <main style={{
          position: 'relative', zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', padding: '32px 16px',
        }}>
          {/* Radar */}
          <div style={{ position: 'relative', width: 256, height: 256, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
            {/* Outer ring */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', opacity: 0.3 }} />
            {/* Middle ring - pulsing */}
            <div className="radar-pulse" style={{ position: 'absolute', inset: 16, borderRadius: '50%', border: '1px solid #e62429' }} />
            {/* Inner core */}
            <div style={{
              position: 'absolute', inset: 64,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(12px)',
              border: '1px solid #e62429',
              boxShadow: '0 0 20px rgba(230,36,41,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="material-symbols-outlined" style={{ color: '#e62429', fontSize: 40, fontVariationSettings: "'FILL' 1" }}>radar</span>
            </div>
          </div>

          {/* Status card */}
          <div
            className="glass-panel"
            style={{
              textAlign: 'center', padding: '16px 32px',
              borderRadius: 4, position: 'relative',
            }}
          >
            <h1 className="text-display-md" style={{ textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
              Awaiting Deployment
            </h1>
            <p className="text-label" style={{ color: '#ffb4ac', marginTop: 8, letterSpacing: '0.2em', animation: 'spideyBlink 2s infinite' }}>
              WAITING FOR HOST TO INITIATE SEQUENCE...
            </p>
          </div>

          {/* Status indicators */}
          <div style={{ position: 'fixed', bottom: 32, left: 32, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="text-label text-muted" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>signal_cellular_alt</span>
              UPLINK STATUS: <span style={{ color: '#82cfff' }}>SECURE</span>
            </div>
            <LatencyDisplay />
          </div>
        </main>
        <style>{`@keyframes spideyBlink{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
      </div>
    );
  }

  // SELECT ABILITY
  if (gameState === 'SELECT_ABILITY') {
    const abilities: { id: Ability; icon: string; label: string; desc: string }[] = [
      { id: 'SPEED',    icon: 'speed',    label: 'SPEED',    desc: '+30s per task — more time on each mission' },
      { id: 'STRENGTH', icon: 'bolt',     label: 'STRENGTH', desc: '+5 pts per correct answer — power through' },
      { id: 'DEFENCE',  icon: 'shield',   label: 'DEFENCE',  desc: '-2 penalty (instead of -10) — stay safe' },
    ];
    return (
      <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', background: '#0a0a0a' }}>
        <div className="hud-grid" style={{ position: 'fixed', inset: 0, zIndex: 0, opacity: 0.4 }} />
        <ScoreBadge score={score} />

        <main style={{
          position: 'relative', zIndex: 10,
          maxWidth: 860, margin: '0 auto',
          padding: '100px 24px 40px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 48,
        }}>
          <div style={{ textAlign: 'center' }}>
            <h1 className="text-display-md text-crimson" style={{ textTransform: 'uppercase', marginBottom: 8 }}>
              SELECT MODIFIER
            </h1>
            <p className="text-body text-muted">This modifier applies to all your missions. Choose wisely.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, width: '100%' }}>
            {abilities.map((ab) => (
              <button
                key={ab.id}
                onClick={() => handleAbilitySelect(ab.id)}
                className="hud-panel"
                style={{
                  padding: 32, border: '1px solid rgba(255,255,255,0.15)',
                  cursor: 'pointer', background: 'transparent',
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16,
                  textAlign: 'left',
                }}
              >
                <div className="corner-tl" /><div className="corner-tr" /><div className="corner-bl" /><div className="corner-br" />
                <div style={{
                  width: 48, height: 48, borderRadius: 4,
                  background: 'rgba(230,36,41,0.12)', border: '1px solid rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span className="material-symbols-outlined" style={{ color: '#ffb4ac', fontSize: 24, fontVariationSettings: "'FILL' 1" }}>{ab.icon}</span>
                </div>
                <div>
                  <div className="text-data" style={{ color: 'var(--color-on-surface)', marginBottom: 8 }}>{ab.label}</div>
                  <div className="text-body text-muted" style={{ fontSize: 14 }}>{ab.desc}</div>
                </div>
                <div className="btn-primary" style={{ padding: '8px 20px', borderRadius: 4, pointerEvents: 'none' }}>
                  [ SELECT ]
                </div>
              </button>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // MISSION CONTROL (SELECT_ELEMENTS)
  if (gameState === 'SELECT_ELEMENTS' || showConfirm || showLoading) {
    const tierIcons: Record<string, string> = {
      VERY_EASY: 'bolt', EASY: 'speed', MEDIUM: 'memory', HARD: 'security',
    };
    const tierColors: Record<string, string> = {
      VERY_EASY: '#82cfff', EASY: '#4ade80', MEDIUM: '#facc15', HARD: '#f87171',
    };

    return (
      <div style={{ position: 'relative', minHeight: '100vh', background: '#0a0a0a', overflow: 'hidden' }}>
        <div className="hud-grid" style={{ position: 'fixed', inset: 0, zIndex: 0, opacity: 0.4 }} />
        <ScoreBadge score={score} />

        {/* Confirm modal */}
        {showConfirm && pendingGame && (
          <MissionConfirmModal
            game={pendingGame}
            onConfirm={handleConfirmDeploy}
            onCancel={() => { setShowConfirm(false); setPendingGame(null); }}
          />
        )}

        {/* Loading screen */}
        {showLoading && activeGame && (
          <MissionLoadingScreen
            missionName={activeGame.name}
            onComplete={handleLoadingComplete}
          />
        )}

        <main style={{ position: 'relative', zIndex: 10, padding: '80px 24px 32px' }}>
          {/* Header */}
          <div style={{ marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 16 }}>
            <h1 className="text-display-md" style={{ textTransform: 'uppercase', letterSpacing: '-0.01em' }}>Mission Control</h1>
            <p className="text-label" style={{ color: '#e62429', marginTop: 4 }}>
              COMPLETED: {completedGames.length} / 7 — SELECT YOUR NEXT OBJECTIVE
            </p>
          </div>

          {/* 4×3 grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
          }}>
            {MINI_GAMES.map((game, i) => {
              const isCompleted = completedGames.includes(game.id);
              const icon = tierIcons[game.tier] || 'bolt';
              const tierColor = tierColors[game.tier] || '#ffb4ac';
              return (
                <div
                  key={game.id}
                  className="hud-panel"
                  onClick={() => !isCompleted && handleMissionClick(game)}
                  style={{
                    padding: 16,
                    cursor: isCompleted ? 'not-allowed' : 'pointer',
                    opacity: isCompleted ? 0.45 : 1,
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    minHeight: 180,
                    borderRadius: 4,
                    position: 'relative',
                  }}
                >
                  <div className="corner-tl" /><div className="corner-tr" /><div className="corner-bl" /><div className="corner-br" />

                  {/* Top row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{
                      width: 44, height: 44,
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 4,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span className="material-symbols-outlined" style={{ color: '#ffb4ac', fontSize: 20, fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                    </div>
                    <span className="text-label" style={{ color: isCompleted ? '#22c55e' : 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>
                      {isCompleted ? '✓ DONE' : 'LOCKED'}
                    </span>
                  </div>

                  {/* Mission name */}
                  <div>
                    <div className="text-data" style={{ fontSize: 14, color: 'var(--color-on-surface)', marginBottom: 4, textTransform: 'uppercase' }}>
                      {game.name}
                    </div>
                    <div className="text-label" style={{ color: tierColor, fontSize: 10 }}>
                      {game.tier.replace('_', ' ')}
                    </div>
                  </div>

                  {/* Deploy button */}
                  <div style={{ marginTop: 12 }}>
                    <div
                      className={isCompleted ? '' : 'btn-primary'}
                      style={{
                        width: '100%', padding: '8px 0',
                        borderRadius: 4, textAlign: 'center',
                        fontSize: 11, letterSpacing: '0.1em',
                        background: isCompleted ? 'rgba(255,255,255,0.05)' : undefined,
                        color: isCompleted ? 'rgba(255,255,255,0.3)' : undefined,
                        border: isCompleted ? '1px solid rgba(255,255,255,0.1)' : undefined,
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 500,
                      }}
                    >
                      {isCompleted ? '[ COMPLETE ]' : '[ DEPLOY ]'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        <style>{`
          @media (max-width: 1024px) { .mission-grid { grid-template-columns: repeat(3, 1fr) !important; } }
          @media (max-width: 640px)  { .mission-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        `}</style>
      </div>
    );
  }

  // PLAY_GAME
  if (gameState === 'PLAY_GAME' && activeGame) {
    const taskTimeMs = getTaskTimeMs(activeGame.timeLimitMs, ability!);
    return (
      <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', background: '#0a0a0a' }}>
        {/* Animated grid */}
        <div className="hud-grid-red" style={{ position: 'fixed', inset: 0, zIndex: 0 }} />
        <div className="scan-line-el" style={{ zIndex: 2 }} />
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(19,19,19,0.8)', backdropFilter: 'blur(2px)', zIndex: 1 }} />

        {/* Top bar */}
        <header style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
          height: 64,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px',
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setGameState('SELECT_ELEMENTS')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ffb4ac' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 24 }}>arrow_back</span>
            </button>
            <div className="text-display-md text-crimson" style={{ fontSize: 20, fontWeight: 800 }}>SPIDEY-SENSE</div>
          </div>
          <div className="text-data" style={{ color: '#ffb4ac' }}>{score} PTS</div>
        </header>

        <main style={{
          position: 'relative', zIndex: 10,
          width: '100%', minHeight: '100vh',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '80px 24px 40px',
        }}>
          <div style={{ width: '100%', maxWidth: 720 }}>
            <MiniGamePlaceholder
              key={activeGame.id}
              gameId={activeGame.id}
              taskTimeMs={taskTimeMs}
              onComplete={handleGameComplete}
            />
          </div>
        </main>
      </div>
    );
  }

  // FINISHED
  if (gameState === 'FINISHED') {
    return (
      <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', overflow: 'hidden' }}>
        <div className="hud-grid" style={{ position: 'fixed', inset: 0, zIndex: 0, opacity: 0.4 }} />
        <div className="scan-line-el" style={{ zIndex: 2 }} />

        <div
          className="glass-panel"
          style={{
            position: 'relative', zIndex: 10,
            maxWidth: 600, width: '100%', margin: '0 24px',
            padding: '64px 48px', borderRadius: 4, textAlign: 'center',
          }}
        >
          <div className="corner-red-tl" /><div className="corner-red-tr" /><div className="corner-red-bl" /><div className="corner-red-br" />

          <h1 className="text-display-md" style={{ textTransform: 'uppercase', marginBottom: 16 }}>SYSTEM OVERRIDE COMPLETE</h1>

          <div
            className="text-display-lg"
            style={{ color: '#e62429', margin: '32px 0', textShadow: '0 0 30px rgba(230,36,41,0.6)' }}
          >
            {finalScore} PTS
          </div>

          <div
            className="text-label"
            style={{
              color: '#ffb4ac', letterSpacing: '0.2em',
              padding: '12px 24px', border: '1px solid rgba(255,255,255,0.15)',
              display: 'inline-block',
              animation: 'spideyBlink 2s infinite',
            }}
          >
            AWAITING GLOBAL LEADERBOARD SYNC...
          </div>
        </div>

        <style>{`@keyframes spideyBlink{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
      </div>
    );
  }

  // LEADERBOARD_VIEW
  if (gameState === 'LEADERBOARD_VIEW') {
    return (
      <div style={{ position: 'relative', minHeight: '100vh', background: '#0a0a0a', overflow: 'hidden' }}>
        <div className="hud-grid" style={{ position: 'fixed', inset: 0, zIndex: 0, opacity: 0.4 }} />
        <ScoreBadge score={score} />

        <main style={{ position: 'relative', zIndex: 10, maxWidth: 800, margin: '0 auto', padding: '80px 24px 40px' }}>
          <div style={{ marginBottom: 32 }}>
            <h1 className="text-display-md" style={{ textTransform: 'uppercase' }}>GLOBAL RANKINGS</h1>
            <p className="text-label text-muted" style={{ marginTop: 4 }}>LIVE FEED // UPLINK SECURE</p>
          </div>

          <div className="glass-panel" style={{ borderRadius: 4, overflow: 'hidden' }}>
            {/* Header row */}
            <div
              className="text-label text-muted"
              style={{
                display: 'grid', gridTemplateColumns: '60px 1fr 120px 120px',
                padding: '12px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.03)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
              }}
            >
              <span>RANK</span>
              <span>OPERATIVE</span>
              <span style={{ textAlign: 'right' }}>SCORE</span>
              <span style={{ textAlign: 'right' }}>PTS</span>
            </div>

            {/* Rows */}
            {leaderboard.map((entry, idx) => {
              const isFirst = idx === 0;
              const isMe = entry.playerId === playerId;
              return (
                <div
                  key={idx}
                  className={isFirst ? 'elite-row' : ''}
                  style={{
                    display: 'grid', gridTemplateColumns: '60px 1fr 120px 120px',
                    padding: '14px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    alignItems: 'center',
                    background: isMe && !isFirst ? 'rgba(255,255,255,0.06)' : undefined,
                    transition: 'background 0.2s',
                  }}
                >
                  <span className="text-data" style={{ color: isFirst ? '#e62429' : 'rgba(255,255,255,0.5)', fontSize: 16 }}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="text-body" style={{ fontWeight: 700, color: isFirst ? 'var(--color-on-surface)' : 'var(--color-on-surface)' }}>
                    {entry.playerId.substring(0, 10)}{isMe ? ' (YOU)' : ''}
                  </span>
                  <span className="text-data" style={{ textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>—</span>
                  <span className="text-data" style={{ textAlign: 'right', color: isFirst ? '#ffb4ac' : 'var(--color-on-surface)', fontSize: 16 }}>
                    {entry.score}
                  </span>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  return null;
}

// ── Latency Display Helper ─────────────────────────────────────────────
function LatencyDisplay() {
  const [latency, setLatency] = useState(12);
  useEffect(() => {
    const id = setInterval(() => {
      setLatency(12 + Math.floor(Math.random() * 5) - 2);
    }, 2000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-label text-muted" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>speed</span>
      LATENCY: <span style={{ color: '#e62429' }}>{latency}MS</span>
    </div>
  );
}

export default App;
