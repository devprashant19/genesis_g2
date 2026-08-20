import type { MiniGame } from './gameConfig';

const DEPLOY_SUBTEXTS = [
  "Peter Parker's got nothing on you. You ready?",
  "Your Spider-Sense is tingling — trust it.",
  "The city's counting on you, operative.",
  "Even Mysterio can't fool someone this sharp.",
  "No pressure — just the fate of Queens.",
  "Web up. Suit on. Let's swing.",
];

interface MissionConfirmModalProps {
  game: MiniGame;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function MissionConfirmModal({ game, onConfirm, onCancel }: MissionConfirmModalProps) {
  const subtext = DEPLOY_SUBTEXTS[Math.floor(Math.random() * DEPLOY_SUBTEXTS.length)];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(10, 10, 10, 0.88)',
        boxShadow: 'inset 0 0 100px rgba(230, 36, 41, 0.08)',
        backdropFilter: 'blur(4px)',
        padding: '16px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%', maxWidth: 440,
          borderTop: '2px solid #e62429',
          borderRadius: 4,
          position: 'relative',
        }}
      >
        {/* Corner brackets */}
        <div className="corner-red-tl" />
        <div className="corner-red-tr" />
        <div className="corner-red-bl" />
        <div className="corner-red-br" />

        <div style={{ padding: 32 }}>
          {/* Spider icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#e62429', fontVariationSettings: "'FILL' 1" }}>
              crisis_alert
            </span>
          </div>

          <h2
            className="text-headline"
            style={{ textAlign: 'center', marginBottom: 8, color: 'var(--color-on-surface)' }}
          >
            SWING INTO ACTION?
          </h2>

          <p
            className="text-body text-muted"
            style={{ textAlign: 'center', marginBottom: 6 }}
          >
            Deploying <strong style={{ color: '#e62429' }}>{game.name}</strong>.
          </p>
          <p
            className="text-body text-muted"
            style={{ textAlign: 'center', marginBottom: 32, fontSize: 13, fontStyle: 'italic' }}
          >
            {subtext}
          </p>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className="btn-ghost"
              onClick={onCancel}
              style={{ flex: 1, padding: '14px 24px', borderRadius: 4 }}
            >
              [&nbsp;RETREAT&nbsp;]
            </button>
            <button
              className="btn-primary"
              onClick={onConfirm}
              style={{ flex: 1, padding: '14px 24px', borderRadius: 4 }}
            >
              [&nbsp;SWING!&nbsp;]
            </button>
          </div>
        </div>

        {/* Scanning bar */}
        <div
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: 2,
            background: 'rgba(230, 36, 41, 0.3)',
            animation: 'scanDown 2s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
}
