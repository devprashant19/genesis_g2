import { useState, useEffect, useRef } from 'react';

export interface GameResult {
  gameId: string;
  correct: boolean;
  elapsedMs: number;
  timedOut: boolean;
}

interface MiniGamePlaceholderProps {
  gameId: string;
  taskTimeMs?: number;
  onComplete: (result: GameResult) => void;
}

export default function MiniGamePlaceholder({ gameId, taskTimeMs = 15000, onComplete }: MiniGamePlaceholderProps) {
  const [answered, setAnswered] = useState(false);
  const startRef = useRef(Date.now());
  const timeoutRef = useRef<number | null>(null);

  const [correctIndex] = useState(() => Math.floor(Math.random() * 4));

  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      if (!answered) {
        finish(false, true);
      }
    }, taskTimeMs) as unknown as number;
    return () => clearTimeout(timeoutRef.current!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish(correct: boolean, timedOut = false) {
    if (answered) return;
    setAnswered(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const elapsedMs = Date.now() - startRef.current;
    onComplete({ gameId, correct, elapsedMs, timedOut });
  }

  return (
    <div style={{ padding: 16, border: '1px solid #444', borderRadius: 8, backgroundColor: '#222' }}>
      <h3 style={{ margin: '0 0 8px 0', color: '#e23636' }}>{gameId}</h3>
      <p style={{ opacity: 0.8 }}>Time limit: {taskTimeMs / 1000}s</p>
      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[0, 1, 2, 3].map((i) => (
          <button 
            key={i} 
            disabled={answered} 
            onClick={() => finish(i === correctIndex)}
            style={{ 
              padding: '12px 24px', 
              fontSize: '1.2rem',
              backgroundColor: answered ? (i === correctIndex ? '#28a745' : '#444') : '#333'
            }}
          >
            Option {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
