import { useEffect, useRef, useState } from 'react';

interface MissionLoadingScreenProps {
  missionName: string;
  onComplete: () => void;
}

const LOGS = [
  'ACTIVATING SPIDER-SENSE NEURAL NET...',
  'CALIBRATING WEB-FLUID PRESSURE [PSI: 142]...',
  'SYNCING WITH DAILY BUGLE ENCRYPTED FEED...',
  'SCANNING FOR GOBLIN GLIDER SIGNATURES...',
  'LOADING MULTIVERSE ANCHOR PROTOCOLS...',
  'CROSS-REFERENCING OSCORP THREAT DATABASE...',
  'TUNING SPIDEY-SENSE FREQUENCY [0x8A2BE2]...',
  'DECRYPTING SHIELD BLACKSITE COORDINATES...',
  'BYPASSING SINISTER SIX FIREWALL [LAYER 4]...',
  'DETECTING SYMBIOTE TRACE SIGNATURES...',
  'UPLINK TO PETER PARKER NET-ID ESTABLISHED...',
  'LOADING WEB-SHOOTER TARGETING OVERLAY...',
  'VERIFYING FRIENDLY NEIGHBORHOOD PROTOCOL...',
  'SCANNING QUEENS SECTOR FOR HOSTILES...',
  'DEPLOYING SPIDER-TRACER UPLINK BEACON...',
  'DOWNLOADING AVENGERS TACTICAL SCHEMATIC...',
  'INITIALIZING WALLCRAWL PHYSICS ENGINE...',
  'ESTABLISHING IRON SPIDER COMMS RELAY...',
  'PURGING VENOM CORRUPTION FROM SUIT AI...',
  'LOADING AUNT MAY EVAC CONTINGENCY [B]...',
];

const COMPLETE_QUIPS = [
  '> WITH GREAT POWER COMES GREAT RESPONSIBILITY.',
  '> YOUR SPIDEY-SENSE IS TINGLING. STAY SHARP.',
  '> NEIGHBOURHOOD SECURED. LAUNCH WHEN READY.',
  '> WEB IS HOT. YOU KNOW WHAT TO DO.',
  '> NO PRESSURE — JUST THE FATE OF QUEENS.',
];

function hexCode() {
  return '0x' + Math.floor(Math.random() * 16777215).toString(16).toUpperCase().padStart(6, '0');
}

export default function MissionLoadingScreen({ missionName, onComplete }: MissionLoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [quip] = useState(() => COMPLETE_QUIPS[Math.floor(Math.random() * COMPLETE_QUIPS.length)]);
  const progressRef = useRef(0);
  const doneRef = useRef(false);

  // Drive progress bar over ~2s
  useEffect(() => {
    const interval = setInterval(() => {
      if (progressRef.current >= 100) {
        clearInterval(interval);
        if (!doneRef.current) {
          doneRef.current = true;
          setTimeout(onComplete, 400);
        }
        return;
      }
      const inc = Math.random() * 4 + 2;
      progressRef.current = Math.min(progressRef.current + inc, 100);
      setProgress(Math.floor(progressRef.current));
    }, 80);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stream log lines
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function addLog() {
      if (progressRef.current >= 100) return;
      const ts = new Date().toISOString().substring(11, 23);
      const msg = LOGS[Math.floor(Math.random() * LOGS.length)];
      setLogLines((prev) => {
        const next = [...prev, `[${ts}]  ${hexCode()}  ${msg}`];
        return next.slice(-14);
      });
      timer = setTimeout(addLog, Math.random() * 180 + 60);
    }
    timer = setTimeout(addLog, 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="hud-grid"
      style={{
        position: 'fixed', inset: 0, zIndex: 900,
        background: '#0a0a0a',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px 16px',
        overflow: 'hidden',
      }}
    >
      {/* Scan line */}
      <div className="scan-line-el" />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(19,19,19,0.75)', backdropFilter: 'blur(2px)' }} />

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>

        {/* Icon + title */}
        <div style={{ textAlign: 'center' }}>
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: 64, color: '#e62429', display: 'block', marginBottom: 16,
              fontVariationSettings: "'FILL' 1",
              filter: 'drop-shadow(0 0 20px rgba(230,36,41,0.6))',
            }}
          >
            crisis_alert
          </span>
          <h1
            className="text-display-md glitch-text text-crimson"
            data-text="ACTIVATING SPIDER-SENSE..."
            style={{ textTransform: 'uppercase' }}
          >
            ACTIVATING SPIDER-SENSE...
          </h1>
          <p className="text-label text-muted" style={{ marginTop: 8, letterSpacing: '0.2em' }}>
            MISSION: {missionName.toUpperCase()}
          </p>
        </div>

        {/* Progress bar */}
        <div style={{ width: '100%', position: 'relative' }}>
          {/* Corner brackets */}
          <div style={{ position: 'absolute', top: -4, left: -4, width: 8, height: 8, borderTop: '1px solid #e62429', borderLeft: '1px solid #e62429' }} />
          <div style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, borderTop: '1px solid #e62429', borderRight: '1px solid #e62429' }} />
          <div style={{ position: 'absolute', bottom: -4, left: -4, width: 8, height: 8, borderBottom: '1px solid #e62429', borderLeft: '1px solid #e62429' }} />
          <div style={{ position: 'absolute', bottom: -4, right: -4, width: 8, height: 8, borderBottom: '1px solid #e62429', borderRight: '1px solid #e62429' }} />

          <div
            style={{
              width: '100%', height: 32,
              background: 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.15)',
              padding: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: '#e62429',
                boxShadow: '0 0 20px rgba(230,36,41,0.6)',
                transition: 'width 0.08s linear',
              }}
            />
          </div>

          <div
            style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}
            className="text-label text-muted"
          >
            <span>WEB-UPLINK {progress}% CHARGED</span>
            <span style={{ color: '#e62429', animation: 'spideyBlink 1s infinite' }}>
              SPIDEY-SENSE.OVERRIDE_ACTIVE
            </span>
          </div>
        </div>

        {/* Data stream log */}
        <div
          style={{
            width: '100%',
            borderTop: '1px solid rgba(255,255,255,0.15)',
            paddingTop: 12,
            height: 160,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            gap: 2,
          }}
        >
          {logLines.map((line, i) => (
            <div key={i} className="text-label text-muted" style={{ opacity: 0.7, fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {line}
            </div>
          ))}
          {progress >= 100 && (
            <div className="text-label" style={{ color: '#e62429', fontWeight: 700 }}>
              {quip}
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spideyBlink { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}
