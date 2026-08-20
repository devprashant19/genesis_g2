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

// Spider-Man themed question bank — one per game slot (cycled by gameId hash)
const QUESTION_BANK = [
  {
    question: "Which villain used the Goblin Formula to gain superhuman strength and insanity?",
    options: ['Norman Osborn', 'Otto Octavius', 'Adrian Toomes', 'Mac Gargan'],
  },
  {
    question: "What radioactive creature gave Peter Parker his powers?",
    options: ['A spider', 'A scorpion', 'A wasp', 'A beetle'],
  },
  {
    question: "What is the name of the symbiote that bonded with Eddie Brock?",
    options: ['Venom', 'Carnage', 'Riot', 'Agony'],
  },
  {
    question: "Who is the editor-in-chief of the Daily Bugle?",
    options: ['J. Jonah Jameson', 'Ben Urich', 'Ned Leeds', 'Betty Brant'],
  },
  {
    question: "What is the chemical compound Spider-Man's web-fluid is most commonly compared to?",
    options: ['Nylon polymer', 'Tungsten alloy', 'Carbon fibre', 'Titanium oxide'],
  },
  {
    question: "Which criminal killed Uncle Ben?",
    options: ['A burglar Peter let escape', 'The Vulture', 'Shocker', 'Rhino'],
  },
  {
    question: "Which organisation does Nick Fury lead?",
    options: ['S.H.I.E.L.D.', 'HYDRA', 'Oscorp', 'The Hand'],
  },
  {
    question: "What is Peter Parker's aunt's name?",
    options: ['Aunt May', 'Aunt Harriet', 'Aunt Anna', 'Aunt Martha'],
  },
  {
    question: "Which Spider-Man villain controls mechanical tentacles from his spine?",
    options: ['Doctor Octopus', 'Electro', 'Mysterio', 'Sandman'],
  },
  {
    question: "In which New York borough does Peter Parker live?",
    options: ['Queens', 'Brooklyn', 'Manhattan', 'The Bronx'],
  },
  {
    question: "What university does Peter Parker attend after high school?",
    options: ['Empire State University', 'NYU', 'Columbia', 'MIT'],
  },
  {
    question: "Which supervillain can control sand and reform his body?",
    options: ['Sandman', 'Scorpion', 'Electro', 'Vulture'],
  },
];

const TIMEOUT_QUIPS = [
  "TOO SLOW — EVEN SANDMAN MOVED FASTER!",
  "YOUR SPIDEY-SENSE FELL ASLEEP.",
  "TIMED OUT. J. JONAH JAMESON IS DELIGHTED.",
  "THE VULTURE FLEW AWAY. MISSION FAILED.",
  "NEXT TIME, WEB UP BEFORE THINKING.",
];

const CORRECT_QUIPS = [
  "SPECTACULAR! SPIDEY-SENSE CONFIRMED.",
  "AMAZING — PETER PARKER WOULD BE PROUD.",
  "OUTSTANDING. THE CITY IS SAFER.",
  "YOUR-FRIENDLY-NEIGHBOURHOOD GENIUS.",
  "BULLSEYE! EVEN MYSTERIO CAN'T FOOL YOU.",
];

const WRONG_QUIPS = [
  "WRONG CALL. BACK TO MIDTOWN HIGH.",
  "VENOM APPROVES. WE DON'T.",
  "EVEN FLASH THOMPSON KNEW THAT ONE.",
  "THE SINISTER SIX ARE CELEBRATING.",
  "NOT QUITE — RECALIBRATE SPIDEY-SENSE.",
];

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

function hashId(id: string) {
  return id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

export default function MiniGamePlaceholder({ gameId, taskTimeMs = 15000, onComplete }: MiniGamePlaceholderProps) {
  const qIndex = hashId(gameId) % QUESTION_BANK.length;
  const { question, options } = QUESTION_BANK[qIndex];
  const [correctIndex] = useState(() => 0); // correct answer is always options[0]; shuffle below
  const [shuffledOptions] = useState<string[]>(() => {
    // Shuffle so the correct answer isn't always first
    const arr = [...options];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  });
  const [trueCorrectIndex] = useState<number>(() => {
    // After shuffle, find where options[0] (the correct answer) ended up
    return shuffledOptions.indexOf(options[0]);
  });

  const [answered, setAnswered] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [timeLeft, setTimeLeft] = useState(Math.ceil(taskTimeMs / 1000));
  const startRef = useRef(Date.now());
  const timeoutRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const totalSeconds = Math.ceil(taskTimeMs / 1000);

  const [correctQuip] = useState(() => CORRECT_QUIPS[Math.floor(Math.random() * CORRECT_QUIPS.length)]);
  const [wrongQuip] = useState(() => WRONG_QUIPS[Math.floor(Math.random() * WRONG_QUIPS.length)]);
  const [timeoutQuip] = useState(() => TIMEOUT_QUIPS[Math.floor(Math.random() * TIMEOUT_QUIPS.length)]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); return 0; }
        return t - 1;
      });
    }, 1000) as unknown as number;

    timeoutRef.current = setTimeout(() => {
      if (!answered) finish(false, true);
    }, taskTimeMs) as unknown as number;

    return () => {
      clearInterval(timerRef.current!);
      clearTimeout(timeoutRef.current!);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish(correct: boolean, didTimeout = false) {
    if (answered) return;
    setAnswered(true);
    setTimedOut(didTimeout);
    clearInterval(timerRef.current!);
    clearTimeout(timeoutRef.current!);
    const elapsedMs = Date.now() - startRef.current;
    setTimeout(() => onComplete({ gameId, correct, elapsedMs, timedOut: didTimeout }), 1000);
  }

  function handleChoice(i: number) {
    if (answered) return;
    setSelected(i);
    finish(i === trueCorrectIndex);
  }

  const progress = timeLeft / totalSeconds;
  const circumference = 2 * Math.PI * 48;
  const dashOffset = circumference * (1 - progress);
  const isUrgent = timeLeft <= 5;

  // Result quip shown after answering
  const resultQuip = timedOut ? timeoutQuip : (selected === trueCorrectIndex ? correctQuip : wrongQuip);

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Timer ring */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div
          style={{
            width: 64, height: 64, borderRadius: '50%',
            border: '2px solid #e62429',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
            boxShadow: isUrgent ? '0 0 25px rgba(230,36,41,0.9)' : '0 0 20px rgba(230,36,41,0.6)',
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'rotate(-90deg)' }}
            viewBox="0 0 100 100"
          >
            <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(230,36,41,0.2)" strokeWidth="3" />
            <circle
              cx="50" cy="50" r="48" fill="none"
              stroke={isUrgent ? '#ff2222' : '#e62429'}
              strokeWidth="3"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <span
            className="text-data"
            style={{ color: isUrgent ? '#ff4444' : '#e62429', position: 'relative', zIndex: 1, fontSize: 16 }}
          >
            {timeLeft}
          </span>
        </div>
      </div>

      {/* Question panel */}
      <div
        className="glass-panel"
        style={{ padding: '32px', position: 'relative', boxShadow: '0 0 20px rgba(230,36,41,0.3)' }}
      >
        <div className="corner-red-tl" />
        <div className="corner-red-br" />
        <div className="text-label" style={{ color: '#e62429', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>crisis_alert</span>
          SPIDER-SENSE ASSESSMENT — {gameId.replace(/_/g, ' ').toUpperCase()}
        </div>
        <p className="text-headline text-on-surface">{question}</p>

        {/* Result quip */}
        {answered && (
          <p
            className="text-label"
            style={{
              marginTop: 16,
              color: timedOut ? '#facc15' : (selected === trueCorrectIndex ? '#22c55e' : '#e62429'),
              letterSpacing: '0.1em',
              fontWeight: 700,
            }}
          >
            {resultQuip}
          </p>
        )}
      </div>

      {/* Answer options */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {shuffledOptions.map((opt, i) => {
          const isCorrectAnswer = i === trueCorrectIndex;
          const isSelected = selected === i;
          let borderColor = 'rgba(255,255,255,0.15)';
          let bgColor = 'rgba(255,255,255,0.03)';
          let textColor = 'var(--color-on-surface)';

          if (answered && isCorrectAnswer) {
            borderColor = '#22c55e';
            bgColor = 'rgba(34,197,94,0.12)';
            textColor = '#22c55e';
          } else if (answered && isSelected && !isCorrectAnswer) {
            borderColor = '#e62429';
            bgColor = 'rgba(230,36,41,0.12)';
            textColor = '#e62429';
          }

          return (
            <button
              key={i}
              onClick={() => handleChoice(i)}
              disabled={answered}
              style={{
                position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px',
                border: `1px solid ${borderColor}`,
                background: bgColor,
                backdropFilter: 'blur(8px)',
                cursor: answered ? 'default' : 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                outline: 'none',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                if (!answered) {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#e62429';
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(230,36,41,0.08)';
                }
              }}
              onMouseLeave={(e) => {
                if (!answered) {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.15)';
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)';
                }
              }}
            >
              <span className="text-body" style={{ color: textColor }}>{opt}</span>
              <span className="text-label" style={{ color: textColor, flexShrink: 0 }}>[ {OPTION_LABELS[i]} ]</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
