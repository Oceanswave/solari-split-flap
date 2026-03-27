import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type CSSProperties,
  type FC,
} from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single quote to display on the board.
 * Each element is one row of text.
 * Prefix a line with `@` to mark it as an author attribution (rendered in gold).
 */
export type Quote = string[];

/** Props for the top-level SolariBoard component. */
export interface SolariBoardProps {
  /** Number of character columns. @default 20 */
  cols?: number;
  /** Number of rows. @default 8 */
  rows?: number;
  /** Array of quotes to cycle through. */
  quotes?: Quote[];
  /** How long (ms) each quote is held on screen before clearing. @default 5000 */
  holdMs?: number;
  /**
   * Stagger delay (ms) between successive cell animations when a new quote
   * appears. Higher = more pronounced left-to-right / top-to-bottom wave.
   * @default 50
   */
  charDelay?: number;
  /** Duration (ms) of a single flap flip animation. @default 150 */
  flipMs?: number;
  /**
   * Drum-step timing range (ms). Each intermediate character flip is spaced
   * by an easing curve between `minGap` and `maxGap` — fast at start,
   * decelerating toward the target character.
   */
  minGap?: number;
  /** @default 160 */
  maxGap?: number;
  /** Enable the synthesised mechanical click sound. @default true */
  sound?: boolean;
  /** Extra CSS class applied to the outer board div. */
  className?: string;
  /** Extra inline styles merged onto the outer board div. */
  style?: CSSProperties;
}

/** Internal props for a single flap cell. */
interface FlapCellProps {
  /** The target character this cell should display. */
  char: string;
  /** Whether this cell is on an author-attributed row (gold text). */
  isAuthor: boolean;
  /** Monotonically increasing key that forces a flip even when `char` hasn't changed. */
  flipKey: number;
  /** Duration of the flip animation in ms. */
  flipMs: number;
  /** Callback fired at the start of every flip (used to trigger click sound). */
  onFlip?: () => void;
}

/** Return value from `layoutQuote`. */
interface LayoutResult {
  /** rows × cols grid of single characters. */
  grid: string[][];
  /** Map of row indices that are author attribution lines. */
  authorRows: Record<number, true>;
}

// ---------------------------------------------------------------------------
// Public Helpers
// ---------------------------------------------------------------------------

/**
 * Word-wrap a plain text string into lines that fit a given column width.
 * An optional `author` is appended as a gold attribution row.
 *
 * @example
 * textToQuote('The only thing we have to fear is fear itself.', 20, 'FDR')
 * // => ['THE ONLY THING WE', 'HAVE TO FEAR IS', 'FEAR ITSELF.', '', '@FDR']
 */
export function textToQuote(text: string, cols: number = 20, author?: string): Quote {
  const upper = text.toUpperCase();
  const words = upper.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= cols) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) lines.push(current);

  if (author) {
    lines.push('');
    lines.push('@' + author.toUpperCase());
  }

  return lines;
}

/**
 * Parse a variety of convenient input formats into `Quote[]`.
 *
 * Accepted inputs:
 * - A single string → auto-wrapped into one quote
 * - An array of strings → each string becomes one auto-wrapped quote
 * - An array of `{ text, author? }` objects → auto-wrapped with optional attribution
 * - A `Quote[]` (array of string arrays) → passed through as-is
 *
 * @example
 * parseQuotes('Hello world')
 * parseQuotes(['Quote one', 'Quote two'])
 * parseQuotes([{ text: 'Be yourself.', author: 'Oscar Wilde' }])
 */
export function parseQuotes(
  input: string | string[] | { text: string; author?: string }[] | Quote[],
  cols: number = 20,
): Quote[] {
  // Single string
  if (typeof input === 'string') {
    return [textToQuote(input, cols)];
  }

  if (!Array.isArray(input) || input.length === 0) {
    return [];
  }

  const first = input[0];

  // Already Quote[] (array of string arrays)
  if (Array.isArray(first)) {
    return input as Quote[];
  }

  // Array of { text, author? } objects
  if (typeof first === 'object' && first !== null && 'text' in first) {
    return (input as { text: string; author?: string }[]).map((q) =>
      textToQuote(q.text, cols, q.author),
    );
  }

  // Array of plain strings
  return (input as string[]).map((s) => textToQuote(s, cols));
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_QUOTES: Quote[] = [
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

/** The character drum — flaps cycle through this ordered sequence. */
const DRUM: string[] = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?\'"\\-:;()'.split('');

/** Reverse look-up: character → index in DRUM. */
const DRUM_INDEX: Record<string, number> = {};
DRUM.forEach((ch, i) => {
  DRUM_INDEX[ch] = i;
});

const KEYFRAMES_ID = 'solari-keyframes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createEmptyGrid(rows: number, cols: number): string[][] {
  const g: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) row.push(' ');
    g.push(row);
  }
  return g;
}

// ---------------------------------------------------------------------------
// FlapCell — a single character cell with 3-D flip animation
// ---------------------------------------------------------------------------

const FlapCell: FC<FlapCellProps> = ({ char, isAuthor, flipKey, flipMs, onFlip }) => {
  const [displayChar, setDisplayChar] = useState<string>(' ');
  const [prevChar, setPrevChar] = useState<string>(' ');
  const [isFlipping, setIsFlipping] = useState<boolean>(false);
  const flipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (char === displayChar) return;

    setPrevChar(displayChar);
    setIsFlipping(true);
    onFlip?.();

    if (flipTimeoutRef.current !== null) clearTimeout(flipTimeoutRef.current);

    flipTimeoutRef.current = setTimeout(() => {
      setDisplayChar(char);
      setIsFlipping(false);
    }, flipMs);

    return () => {
      if (flipTimeoutRef.current !== null) clearTimeout(flipTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char, flipKey]);

  const color: string = isAuthor ? '#f5c542' : '#f0f0f0';
  const animDuration = `${flipMs / 1000}s`;

  return (
    <div style={styles.cell}>
      <div style={styles.flapDisplay}>
        {/* Top half — shows current character */}
        <div style={styles.flapTop}>
          <span style={{ ...styles.flapTopChar, color }}>{displayChar}</span>
          <div style={styles.flapTopLine} />
        </div>

        {/* Bottom half — shows incoming character (revealed as flap falls) */}
        <div style={styles.flapBottom}>
          <span style={{ ...styles.flapBottomChar, color }}>{char}</span>
        </div>

        {/* Animated flip element */}
        <div
          style={{
            ...styles.flapFlip,
            display: isFlipping ? 'block' : 'none',
            animation: isFlipping
              ? `solari-flap-down ${animDuration} ease-in forwards`
              : 'none',
          }}
        >
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
};

// ---------------------------------------------------------------------------
// SolariBoard — the full board component
// ---------------------------------------------------------------------------

const SolariBoard: FC<SolariBoardProps> = ({
  cols = 20,
  rows = 8,
  quotes = DEFAULT_QUOTES,
  holdMs = 5000,
  charDelay = 50,
  flipMs = 150,
  minGap = 35,
  maxGap = 160,
  sound = true,
  className = '',
  style: customStyle = {},
}) => {
  const [grid, setGrid] = useState<string[][]>(() => createEmptyGrid(rows, cols));
  const [authorRows, setAuthorRows] = useState<Record<number, true>>({});
  const [flipKeys, setFlipKeys] = useState<number[]>(() =>
    Array.from({ length: rows * cols }, () => 0),
  );

  const audioCtxRef = useRef<AudioContext | null>(null);
  const shuffledRef = useRef<Quote[]>(shuffle(quotes));
  const qIndexRef = useRef<number>(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mountedRef = useRef<boolean>(true);

  // ---- Inject @keyframes once ----
  useEffect(() => {
    if (document.getElementById(KEYFRAMES_ID)) return;
    const el = document.createElement('style');
    el.id = KEYFRAMES_ID;
    el.textContent = `
      @keyframes solari-flap-down {
        0%   { transform: rotateX(0deg); }
        100% { transform: rotateX(-180deg); }
      }
    `;
    document.head.appendChild(el);
    return () => {
      document.getElementById(KEYFRAMES_ID)?.remove();
    };
  }, []);

  // ---- Web Audio: init + playClick ----
  const initAudio = useCallback((): void => {
    if (audioCtxRef.current || !sound) return;
    try {
      const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
      audioCtxRef.current = new Ctor();
    } catch {
      /* browser does not support Web Audio */
    }
  }, [sound]);

  const playClick = useCallback((): void => {
    const ctx = audioCtxRef.current;
    if (!ctx || !sound) return;

    const duration = 0.012; // 12 ms burst
    const now = ctx.currentTime;

    // White-noise buffer
    const bufferSize = Math.ceil(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Highpass filter → crisp plastic snap
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1800 + Math.random() * 400;

    // Gain envelope: quick attack, fast exponential decay
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08 + Math.random() * 0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(now);
    source.stop(now + duration);
  }, [sound]);

  // Activate AudioContext on first user gesture (browser autoplay policy)
  useEffect(() => {
    const handler = (): void => initAudio();
    document.addEventListener('click', handler, { once: true });
    document.addEventListener('keydown', handler, { once: true });
    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('keydown', handler);
    };
  }, [initAudio]);

  // ---- Layout: position a quote's lines centred on the grid ----
  const layoutQuote = useCallback(
    (lines: string[]): LayoutResult => {
      const g = createEmptyGrid(rows, cols);
      const aRows: Record<number, true> = {};

      const usedRows = Math.min(lines.length, rows);
      const startRow = Math.floor((rows - usedRows) / 2);

      for (let l = 0; l < usedRows; l++) {
        let line = lines[l];
        const isAuthorLine = line.charAt(0) === '@';
        if (isAuthorLine) {
          line = line.substring(1);
          aRows[startRow + l] = true;
        }
        const pad = Math.floor((cols - line.length) / 2);
        for (let ch = 0; ch < line.length; ch++) {
          g[startRow + l][pad + ch] = line[ch];
        }
      }

      return { grid: g, authorRows: aRows };
    },
    [rows, cols],
  );

  // ---- Animation: drum-step each cell towards its target character ----
  const animateToGrid = useCallback(
    (
      targetGrid: string[][],
      targetAuthorRows: Record<number, true>,
      callback?: () => void,
    ): void => {
      // Cancel any in-flight timers
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];

      let maxTime = 0;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          const target = targetGrid[r][c];
          const delay = idx * charDelay;

          // Build the drum step sequence from current → target
          const fromIdx = DRUM_INDEX[' '] ?? 0;
          const toIdx = DRUM_INDEX[target] ?? 0;

          const steps: string[] = [];
          let pos = fromIdx;
          if (target !== ' ') {
            while (pos !== toIdx) {
              pos = (pos + 1) % DRUM.length;
              steps.push(DRUM[pos]);
            }
          }
          if (steps.length === 0 && target !== ' ') {
            steps.push(target);
          }

          // Schedule each intermediate flip with easing timing
          let cumulative = 0;
          for (let s = 0; s < steps.length; s++) {
            const progress = steps.length > 1 ? s / (steps.length - 1) : 1;
            const gap = minGap + (maxGap - minGap) * progress * progress;
            const ch = steps[s];

            const tid = setTimeout(() => {
              if (!mountedRef.current) return;
              setGrid((prev) => {
                const next = prev.map((row) => row.slice());
                next[r][c] = ch;
                return next;
              });
              setFlipKeys((prev) => {
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

      // Apply author row styling immediately so cells flip in colour
      setAuthorRows(targetAuthorRows);

      // Fire callback after hold period
      if (callback) {
        const tid2 = setTimeout(() => {
          if (mountedRef.current) callback();
        }, maxTime + 200 + holdMs);
        timersRef.current.push(tid2);
      }
    },
    [rows, cols, charDelay, flipMs, minGap, maxGap, holdMs],
  );

  // ---- Clear board: flip all cells back to space in shuffled order ----
  const clearBoard = useCallback(
    (callback?: () => void): void => {
      setAuthorRows({});

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
        const delay = k * 5; // slight stagger per cell

        const tid = setTimeout(() => {
          if (!mountedRef.current) return;
          setGrid((prev) => {
            const next = prev.map((row) => row.slice());
            next[r][c] = ' ';
            return next;
          });
          setFlipKeys((prev) => {
            const next = prev.slice();
            next[idx]++;
            return next;
          });
        }, delay);
        timersRef.current.push(tid);
        totalDelay = delay + flipMs;
      }

      if (callback) {
        const tid = setTimeout(() => {
          if (mountedRef.current) callback();
        }, totalDelay + 400);
        timersRef.current.push(tid);
      }
    },
    [rows, cols, flipMs, layoutQuote],
  );

  // ---- Main quote cycle ----
  useEffect(() => {
    mountedRef.current = true;
    shuffledRef.current = shuffle(quotes);
    qIndexRef.current = 0;

    function cycle(): void {
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
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
    };
  }, [quotes, layoutQuote, animateToGrid, clearBoard]);

  // ---- Render ----
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
                flipMs={flipMs}
                onFlip={playClick}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default SolariBoard;

// ---------------------------------------------------------------------------
// Styles (inline CSSProperties — no external stylesheet needed)
// ---------------------------------------------------------------------------

const styles: Record<string, CSSProperties> = {
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
    fontFamily:
      "'SF Mono', 'Fira Code', 'Cascadia Code', 'Consolas', ui-monospace, monospace",
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
