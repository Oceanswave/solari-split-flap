import { useState, useEffect, useRef, useCallback } from 'react';

const DEFAULT_QUOTES = [
  ['DESIGN IS NOT JUST', 'WHAT IT LOOKS LIKE.', 'DESIGN IS HOW', 'IT WORKS.', '', '@STEVE JOBS'],
  ['SIMPLICITY IS THE', 'ULTIMATE', 'SOPHISTICATION.', '', '@LEONARDO DA VINCI'],
  ['MAKE IT SIMPLE,', 'BUT SIGNIFICANT.', '', '@DON DRAPER'],
  ['STAY HUNGRY.', 'STAY FOOLISH.', '', '@STEVE JOBS'],
  ['HAVE THE COURAGE', 'TO FOLLOW YOUR', 'HEART AND', 'INTUITION.', '', '@STEVE JOBS'],
  ['I THINK,', 'THEREFORE I AM.', '', '@RENE DESCARTES'],
  ['THE ONLY THING WE', 'HAVE TO FEAR IS', 'FEAR ITSELF.', '', '@FDR'],
  ['IMAGINATION IS', 'MORE IMPORTANT', 'THAN KNOWLEDGE.', '', '@ALBERT EINSTEIN'],
  ['TO BE OR NOT', 'TO BE, THAT IS', 'THE QUESTION.', '', '@SHAKESPEARE'],
  ['IN THE MIDDLE OF', 'DIFFICULTY LIES', 'OPPORTUNITY.', '', '@ALBERT EINSTEIN'],
  ['THAT WHICH DOES', 'NOT KILL US MAKES', 'US STRONGER.', '', '@NIETZSCHE'],
  ['I HAVE NOT FAILED.', 'I HAVE JUST FOUND', '10000 WAYS THAT', 'WONT WORK.', '', '@THOMAS EDISON'],
  ['THE MEDIUM IS', 'THE MESSAGE.', '', '@MARSHALL MCLUHAN'],
];

const DRUM = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?\'"\\-:;()'.split('');
const DRUM_INDEX = {};
DRUM.forEach((ch, i) => { DRUM_INDEX[ch] = i; });

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function FlapCell({ char, isAuthor, flipKey }) {
  const [displayChar, setDisplayChar] = useState(' ');
  const [prevChar, setPrevChar] = useState(' ');
  const [isFlipping, setIsFlipping] = useState(false);
  const flipTimeoutRef = useRef(null);

  useEffect(() => {
    if (char === displayChar) return;

    setPrevChar(displayChar);
    setIsFlipping(true);

    if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);

    flipTimeoutRef.current = setTimeout(() => {
      setDisplayChar(char);
      setIsFlipping(false);
    }, 150);

    return () => {
      if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
    };
  }, [char, flipKey]);

  const color = isAuthor ? '#f5c542' : '#f0f0f0';

  return (
    <div style={styles.cell}>
      <div style={styles.flapDisplay}>
        {/* Top half — shows current char */}
        <div style={styles.flapTop}>
          <span style={{ ...styles.flapTopChar, color }}>{displayChar}</span>
          <div style={styles.flapTopLine} />
        </div>

        {/* Bottom half — shows new char immediately (revealed by flip) */}
        <div style={styles.flapBottom}>
          <span style={{ ...styles.flapBottomChar, color }}>{char}</span>
        </div>

        {/* Flip element */}
        <div style={{
          ...styles.flapFlip,
          display: isFlipping ? 'block' : 'none',
          animation: isFlipping ? 'solari-flap-down 0.15s ease-in forwards' : 'none',
        }}>
          <div style={styles.flapFlipFront}>
            <span style={{ ...styles.flapTopChar, color }}>{prevChar}</span>
          </div>
          <div style={styles.flapFlipBack}>
            <span style={{ ...styles.flapBottomChar, color }}>{char}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SolariBoard({
  cols = 20,
  rows = 8,
  quotes = DEFAULT_QUOTES,
  holdMs = 4000,
  charDelay = 8,
  sound = true,
  className = '',
  style: customStyle = {},
}) {
  const [grid, setGrid] = useState(() => {
    const g = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) row.push(' ');
      g.push(row);
    }
    return g;
  });
  const [authorRows, setAuthorRows] = useState({});
  const [flipKeys, setFlipKeys] = useState(() =>
    Array.from({ length: rows * cols }, () => 0)
  );

  const audioCtxRef = useRef(null);
  const shuffledRef = useRef(shuffle(quotes));
  const qIndexRef = useRef(0);
  const timersRef = useRef([]);
  const mountedRef = useRef(true);

  // Inject keyframes
  useEffect(() => {
    if (document.getElementById('solari-keyframes')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'solari-keyframes';
    styleEl.textContent = `
      @keyframes solari-flap-down {
        0%   { transform: rotateX(0deg); }
        100% { transform: rotateX(-180deg); }
      }
    `;
    document.head.appendChild(styleEl);
    return () => {
      const el = document.getElementById('solari-keyframes');
      if (el) el.remove();
    };
  }, []);

  // Audio
  const initAudio = useCallback(() => {
    if (audioCtxRef.current || !sound) return;
    try {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { /* ignore */ }
  }, [sound]);

  useEffect(() => {
    const handler = () => initAudio();
    document.addEventListener('click', handler, { once: true });
    document.addEventListener('keydown', handler, { once: true });
    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('keydown', handler);
    };
  }, [initAudio]);

  const layoutQuote = useCallback((lines) => {
    const g = [];
    const aRows = {};
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) row.push(' ');
      g.push(row);
    }
    const usedRows = Math.min(lines.length, rows);
    const startRow = Math.floor((rows - usedRows) / 2);

    for (let l = 0; l < usedRows; l++) {
      let line = lines[l];
      const isAuthor = line.charAt(0) === '@';
      if (isAuthor) {
        line = line.substring(1);
        aRows[startRow + l] = true;
      }
      const pad = Math.floor((cols - line.length) / 2);
      for (let ch = 0; ch < line.length; ch++) {
        g[startRow + l][pad + ch] = line[ch];
      }
    }
    return { grid: g, authorRows: aRows };
  }, [rows, cols]);

  // Drum-step animation via staggered state updates
  const animateToGrid = useCallback((targetGrid, targetAuthorRows, callback) => {
    // Clear old timers
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];

    let maxTime = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const target = targetGrid[r][c];
        const delay = idx * charDelay;

        // Calculate drum steps
        const fromIdx = DRUM_INDEX[' '] || 0; // simplified — we set whole grid at once
        const toIdx = DRUM_INDEX[target] !== undefined ? DRUM_INDEX[target] : 0;

        let steps = [];
        let pos = fromIdx;
        if (target !== ' ') {
          while (pos !== toIdx) {
            pos = (pos + 1) % DRUM.length;
            steps.push(DRUM[pos]);
          }
        }

        if (steps.length === 0 && target !== ' ') {
          steps = [target];
        }

        // Schedule intermediate flips for drum effect
        let cumulative = 0;
        const minGap = 35;
        const maxGap = 160;

        for (let s = 0; s < steps.length; s++) {
          const progress = steps.length > 1 ? s / (steps.length - 1) : 1;
          const gap = minGap + (maxGap - minGap) * progress * progress;
          const ch = steps[s];

          const tid = setTimeout(() => {
            if (!mountedRef.current) return;
            setGrid(prev => {
              const newGrid = prev.map(row => row.slice());
              newGrid[r][c] = ch;
              return newGrid;
            });
            setFlipKeys(prev => {
              const next = prev.slice();
              next[idx]++;
              return next;
            });
          }, delay + cumulative);

          timersRef.current.push(tid);
          cumulative += gap;
        }

        if (delay + cumulative > maxTime) maxTime = delay + cumulative;
      }
    }

    // Set author rows after animation
    const tid1 = setTimeout(() => {
      if (mountedRef.current) setAuthorRows(targetAuthorRows);
    }, maxTime + 100);
    timersRef.current.push(tid1);

    // Callback after hold
    if (callback) {
      const tid2 = setTimeout(() => {
        if (mountedRef.current) callback();
      }, maxTime + 200 + holdMs);
      timersRef.current.push(tid2);
    }
  }, [rows, cols, charDelay, holdMs]);

  const clearBoard = useCallback((callback) => {
    setAuthorRows({});
    const emptyResult = layoutQuote([]);
    let totalDelay = 0;

    const indices = Array.from({ length: rows * cols }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    for (let k = 0; k < indices.length; k++) {
      const idx = indices[k];
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      const delay = k * 3;

      const tid = setTimeout(() => {
        if (!mountedRef.current) return;
        setGrid(prev => {
          const newGrid = prev.map(row => row.slice());
          newGrid[r][c] = ' ';
          return newGrid;
        });
        setFlipKeys(prev => {
          const next = prev.slice();
          next[idx]++;
          return next;
        });
      }, delay);
      timersRef.current.push(tid);
      totalDelay = delay + 150;
    }

    if (callback) {
      const tid = setTimeout(() => {
        if (mountedRef.current) callback();
      }, totalDelay + 400);
      timersRef.current.push(tid);
    }
  }, [rows, cols, layoutQuote]);

  // Main cycle
  useEffect(() => {
    mountedRef.current = true;
    shuffledRef.current = shuffle(quotes);
    qIndexRef.current = 0;

    function cycle() {
      if (!mountedRef.current) return;
      const quote = shuffledRef.current[qIndexRef.current % shuffledRef.current.length];
      const result = layoutQuote(quote);
      animateToGrid(result.grid, result.authorRows, () => {
        qIndexRef.current++;
        clearBoard(() => cycle());
      });
    }

    const startTid = setTimeout(cycle, 500);

    return () => {
      mountedRef.current = false;
      clearTimeout(startTid);
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current = [];
    };
  }, [quotes, layoutQuote, animateToGrid, clearBoard]);

  return (
    <div className={className} style={{ ...styles.board, ...customStyle }}>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} style={styles.row}>
          {Array.from({ length: cols }, (_, c) => {
            const idx = r * cols + c;
            return (
              <FlapCell
                key={idx}
                char={grid[r][c]}
                isAuthor={!!authorRows[r]}
                flipKey={flipKeys[idx]}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

const styles = {
  board: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    padding: '16px',
    background: '#1a1a1a',
    borderRadius: '8px',
    width: 'fit-content',
    overflow: 'hidden',
  },
  row: {
    display: 'flex',
    gap: '3px',
  },
  cell: {
    width: '28px',
    height: '40px',
    perspective: '200px',
  },
  flapDisplay: {
    position: 'relative',
    width: '100%',
    height: '100%',
    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', 'Consolas', ui-monospace, monospace",
    fontSize: '1.1rem',
    fontWeight: 'bold',
    color: '#f0f0f0',
    textAlign: 'center',
  },
  flapTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '50%',
    background: '#2a2a2a',
    borderRadius: '3px 3px 0 0',
    overflow: 'hidden',
    zIndex: 1,
  },
  flapTopChar: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '200%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },
  flapTopLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '1px',
    background: '#111',
    zIndex: 5,
  },
  flapBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    height: '50%',
    background: '#222',
    borderRadius: '0 0 3px 3px',
    overflow: 'hidden',
    zIndex: 1,
  },
  flapBottomChar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    height: '200%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },
  flapFlip: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '50%',
    transformOrigin: 'center bottom',
    transformStyle: 'preserve-3d',
    zIndex: 10,
    pointerEvents: 'none',
  },
  flapFlipFront: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: '#2a2a2a',
    borderRadius: '3px 3px 0 0',
    backfaceVisibility: 'hidden',
    overflow: 'hidden',
  },
  flapFlipBack: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: '#222',
    borderRadius: '0 0 3px 3px',
    backfaceVisibility: 'hidden',
    transform: 'rotateX(180deg)',
    overflow: 'hidden',
  },
};
