import {
  type CSSProperties,
  type FC,
  forwardRef,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single line within a quote.
 * - Plain string — rendered in the default colour (`#f0f0f0`).
 *   Prefix with `@` for gold author attribution (`#f5c542`).
 * - Object — `text` is the content, `color` sets the CSS colour for that row.
 */
export type QuoteLine = string | { text: string; color?: string };

/**
 * A single quote to display on the board.
 * Each element is one row of text.
 */
export type Quote = QuoteLine[];

/** Options for {@link textToQuote}. */
export interface TextToQuoteOptions {
  /** Author attribution appended as a gold line. */
  author?: string;
  /** CSS colour applied to every body line (not the author line). */
  color?: string;
  /** CSS colour for the author line. @default '#f5c542' (gold) */
  authorColor?: string;
}

/** Imperative handle exposed via `ref` on `<SolariBoard>`. */
export interface SolariBoardHandle {
  /** Animate the board to a specific quote (same as changing `value`). */
  flipTo: (quote: Quote) => void;
  /** Clear the board (all cells flip back to blank). */
  clear: () => void;
}

/** Props for the top-level SolariBoard component. */
export interface SolariBoardProps {
  /** Number of character columns. @default 20 */
  cols?: number;
  /** Number of rows. @default 8 */
  rows?: number;
  /**
   * **Controlled mode.** Pass a single `Quote` and the board will animate
   * to it whenever it changes. When set, `quotes` / `holdMs` are ignored
   * and no auto-cycling occurs — you own the state.
   *
   * @example
   * const [msg, setMsg] = useState<Quote>(['HELLO WORLD']);
   * <SolariBoard value={msg} />
   */
  value?: Quote;
  /** Array of quotes to cycle through (uncontrolled mode). Ignored when `value` is set. */
  quotes?: Quote[];
  /** Default text colour for rows without an explicit colour. @default '#f0f0f0' */
  defaultColor?: string;
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
  /**
   * Custom drum characters. Flaps cycle through this ordered sequence.
   * @default ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?\'"\\-:;()'
   */
  drum?: string;
  /**
   * Scale multiplier for cell dimensions. `1` = default (28×40px cells).
   * Use `0.5` for half-size, `2` for double, etc.
   * @default 1
   */
  scale?: number;
  /**
   * Callback fired when all cells have finished flipping to their targets.
   * In uncontrolled mode, fires after each quote finishes (before the hold period).
   */
  onAnimationComplete?: () => void;
  /** Extra CSS class applied to the outer board div. */
  className?: string;
  /** Extra inline styles merged onto the outer board div. */
  style?: CSSProperties;
  /** Ref for imperative handle (flipTo, clear). */
  ref?: Ref<SolariBoardHandle>;
}

/** Internal props for a single flap cell. */
interface FlapCellProps {
  /** The target character this cell should display. */
  char: string;
  /** CSS colour for this cell's text. */
  color: string;
  /** Monotonically increasing key that forces a flip even when `char` hasn't changed. */
  flipKey: number;
  /** Cell width in px. */
  cellWidth: number;
  /** Cell height in px. */
  cellHeight: number;
  /** CSS font-size string. */
  fontSize: string;
  /** Duration of the flip animation in ms. */
  flipMs: number;
  /** Callback fired at the start of every flip (used to trigger click sound). */
  onFlip?: () => void;
}

/** Return value from `layoutQuote`. */
interface LayoutResult {
  /** rows × cols grid of single characters. */
  grid: string[][];
  /** Map of row index → CSS colour string for rows with explicit colours. */
  rowColors: Record<number, string>;
}

/** Default gold colour for `@` author attribution lines. */
const AUTHOR_COLOR = '#f5c542';

/** Default text colour. */
const DEFAULT_TEXT_COLOR = '#f0f0f0';

// ---------------------------------------------------------------------------
// Public Helpers
// ---------------------------------------------------------------------------

/**
 * Word-wrap a plain text string into lines that fit a given column width.
 *
 * @example
 * textToQuote('The only thing we have to fear is fear itself.', 20, { author: 'FDR' })
 * textToQuote('Danger!', 20, { color: '#ff4444', author: 'System', authorColor: '#aaa' })
 */
export function textToQuote(text: string, cols: number = 20, options?: TextToQuoteOptions): Quote {
  const opts = options ?? {};

  const upper = text.toUpperCase();
  const words = upper.split(/\s+/);
  const rawLines: string[] = [];
  let current = '';

  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= cols) {
      current += ` ${word}`;
    } else {
      rawLines.push(current);
      current = word;
    }
  }
  if (current.length > 0) rawLines.push(current);

  // Convert to QuoteLine[], applying body colour if specified
  const bodyColor = opts.color;
  const lines: Quote = bodyColor ? rawLines.map((l) => ({ text: l, color: bodyColor })) : rawLines;

  if (opts.author) {
    lines.push(opts.color ? { text: '', color: opts.color } : '');
    const authorColor = opts.authorColor ?? AUTHOR_COLOR;
    lines.push({ text: opts.author.toUpperCase(), color: authorColor });
  }

  return lines;
}

/**
 * Parse a variety of convenient input formats into `Quote[]`.
 *
 * Accepted inputs:
 * - A single string → auto-wrapped into one quote
 * - An array of strings → each string becomes one auto-wrapped quote
 * - An array of `{ text, author?, color?, authorColor? }` objects
 * - A `Quote[]` (array of arrays) → passed through as-is
 *
 * @example
 * parseQuotes('Hello world')
 * parseQuotes(['Quote one', 'Quote two'])
 * parseQuotes([{ text: 'Be yourself.', author: 'Oscar Wilde' }])
 * parseQuotes([{ text: 'Alert!', color: '#ff4444' }])
 */
export function parseQuotes(
  input:
    | string
    | string[]
    | { text: string; author?: string; color?: string; authorColor?: string }[]
    | Quote[],
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

  // Already Quote[] (array of arrays)
  if (Array.isArray(first)) {
    return input as Quote[];
  }

  // Array of { text, author?, color?, authorColor? } objects
  if (typeof first === 'object' && first !== null && 'text' in first) {
    return (input as { text: string; author?: string; color?: string; authorColor?: string }[]).map(
      (q) =>
        textToQuote(q.text, cols, {
          author: q.author,
          color: q.color,
          authorColor: q.authorColor,
        }),
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
  [
    'I HAVE NOT FAILED.',
    'I HAVE JUST FOUND',
    '10000 WAYS THAT',
    'WONT WORK.',
    '',
    '@THOMAS EDISON',
  ],
  ['THE MEDIUM IS', 'THE MESSAGE.', '', '@MARSHALL MCLUHAN'],
];

/** Default drum character sequence. */
const DEFAULT_DRUM = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?\'"\\-:;()';

/** Build drum array and reverse look-up from a drum string. */
function buildDrum(drumStr: string): { drum: string[]; drumIndex: Record<string, number> } {
  const drum = drumStr.split('');
  const drumIndex: Record<string, number> = {};
  for (let i = 0; i < drum.length; i++) {
    drumIndex[drum[i]] = i;
  }
  return { drum, drumIndex };
}

// Pre-compute for the default drum (most users)
const DEFAULT_DRUM_DATA = buildDrum(DEFAULT_DRUM);

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

/** Extract the plain text and optional colour from a QuoteLine. */
function resolveLine(line: QuoteLine): { text: string; color?: string } {
  if (typeof line === 'string') {
    if (line.charAt(0) === '@') {
      return { text: line.substring(1), color: AUTHOR_COLOR };
    }
    return { text: line };
  }
  return { text: line.text, color: line.color };
}

// ---------------------------------------------------------------------------
// FlapCell — a single character cell with 3-D flip animation
// ---------------------------------------------------------------------------

const FlapCell: FC<FlapCellProps> = ({
  char,
  color,
  flipKey,
  cellWidth,
  cellHeight,
  fontSize,
  flipMs,
  onFlip,
}) => {
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

  const animDuration = `${flipMs / 1000}s`;

  return (
    <div style={{ ...cellStyles.cell, width: `${cellWidth}px`, height: `${cellHeight}px` }}>
      <div style={{ ...cellStyles.flapDisplay, fontSize }}>
        {/* Top half — shows current character */}
        <div style={cellStyles.flapTop}>
          <span style={{ ...cellStyles.flapTopChar, color }}>{displayChar}</span>
          <div style={cellStyles.flapTopLine} />
        </div>

        {/* Bottom half — shows incoming character (revealed as flap falls) */}
        <div style={cellStyles.flapBottom}>
          <span style={{ ...cellStyles.flapBottomChar, color }}>{char}</span>
        </div>

        {/* Animated flip element */}
        <div
          style={{
            ...cellStyles.flapFlip,
            display: isFlipping ? 'block' : 'none',
            animation: isFlipping ? `solari-flap-down ${animDuration} ease-in forwards` : 'none',
          }}
        >
          <div style={cellStyles.flapFlipFront}>
            <span style={{ ...cellStyles.flapTopChar, color }}>{prevChar}</span>
          </div>
          <div style={cellStyles.flapFlipBack}>
            <span style={{ ...cellStyles.flapBottomChar, color }}>{char}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// SolariBoard — the full board component
// ---------------------------------------------------------------------------

const SolariBoard = forwardRef<SolariBoardHandle, SolariBoardProps>(function SolariBoard(
  {
    cols = 20,
    rows = 8,
    value,
    quotes = DEFAULT_QUOTES,
    defaultColor = DEFAULT_TEXT_COLOR,
    holdMs = 5000,
    charDelay = 50,
    flipMs = 150,
    minGap = 35,
    maxGap = 160,
    sound = true,
    drum: drumProp,
    scale = 1,
    onAnimationComplete,
    className = '',
    style: customStyle = {},
  },
  ref,
) {
  const isControlled = value !== undefined;

  // Drum data — recompute only if a custom drum string is provided
  const { drum: DRUM, drumIndex: DRUM_INDEX } = drumProp ? buildDrum(drumProp) : DEFAULT_DRUM_DATA;
  const [grid, setGrid] = useState<string[][]>(() => createEmptyGrid(rows, cols));
  const [rowColors, setRowColors] = useState<Record<number, string>>({});
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
      const w = window as unknown as Record<string, typeof AudioContext>;
      const Ctor = w.AudioContext ?? w.webkitAudioContext;
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
    (quoteLines: QuoteLine[]): LayoutResult => {
      const g = createEmptyGrid(rows, cols);
      const colors: Record<number, string> = {};

      const usedRows = Math.min(quoteLines.length, rows);
      const startRow = Math.floor((rows - usedRows) / 2);

      for (let l = 0; l < usedRows; l++) {
        const resolved = resolveLine(quoteLines[l]);
        const line = resolved.text;
        if (resolved.color) {
          colors[startRow + l] = resolved.color;
        }
        const pad = Math.floor((cols - line.length) / 2);
        for (let ch = 0; ch < line.length; ch++) {
          g[startRow + l][pad + ch] = line[ch];
        }
      }

      return { grid: g, rowColors: colors };
    },
    [rows, cols],
  );

  // ---- Animation: drum-step each cell towards its target character ----
  const animateToGrid = useCallback(
    (
      targetGrid: string[][],
      targetRowColors: Record<number, string>,
      callback?: () => void,
    ): void => {
      // Cancel any in-flight timers
      for (const t of timersRef.current) clearTimeout(t);
      timersRef.current = [];

      let maxTime = 0;

      // Track which rows have had their colour applied so we can
      // piggyback the colour update onto the first drum-step callback
      // that fires for each row — no separate timer needed.
      const colorApplied = new Set<number>();

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
            const isFirstFlipInRow = !colorApplied.has(r);
            if (isFirstFlipInRow) colorApplied.add(r);

            const tid = setTimeout(() => {
              if (!mountedRef.current) return;
              // Apply this row's colour in the same batch as the first flip
              if (isFirstFlipInRow) {
                setRowColors((prev) => {
                  const next = { ...prev };
                  if (targetRowColors[r]) {
                    next[r] = targetRowColors[r];
                  } else {
                    delete next[r];
                  }
                  return next;
                });
              }
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

      // For rows with no drum steps (all cells already match), apply
      // their colour synchronously — nothing to wait for.
      for (let r = 0; r < rows; r++) {
        if (!colorApplied.has(r)) {
          setRowColors((prev) => {
            const next = { ...prev };
            if (targetRowColors[r]) {
              next[r] = targetRowColors[r];
            } else {
              delete next[r];
            }
            return next;
          });
        }
      }

      // Fire onAnimationComplete after all drums have settled
      if (onAnimationComplete) {
        const tidComplete = setTimeout(() => {
          if (mountedRef.current) onAnimationComplete();
        }, maxTime + 100);
        timersRef.current.push(tidComplete);
      }

      // Fire callback after hold period
      if (callback) {
        const tid2 = setTimeout(
          () => {
            if (mountedRef.current) callback();
          },
          maxTime + 200 + holdMs,
        );
        timersRef.current.push(tid2);
      }
    },
    [rows, cols, charDelay, minGap, maxGap, holdMs, DRUM, DRUM_INDEX, onAnimationComplete],
  );

  // ---- Clear board: flip all cells back to space in shuffled order ----
  const clearBoard = useCallback(
    (callback?: () => void): void => {
      setRowColors({});

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
    [rows, cols, flipMs],
  );

  // ---- Imperative ref handle ----
  useImperativeHandle(
    ref,
    () => ({
      flipTo(quote: Quote) {
        const result = layoutQuote(quote);
        animateToGrid(result.grid, result.rowColors);
      },
      clear() {
        clearBoard();
      },
    }),
    [layoutQuote, animateToGrid, clearBoard],
  );

  // ---- Controlled mode: animate to `value` whenever it changes ----
  useEffect(() => {
    if (!isControlled || !value) return;

    mountedRef.current = true;
    const result = layoutQuote(value);
    animateToGrid(result.grid, result.rowColors);

    return () => {
      mountedRef.current = false;
      for (const t of timersRef.current) clearTimeout(t);
      timersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isControlled, value, layoutQuote, animateToGrid]);

  // ---- Uncontrolled mode: auto-cycle through `quotes` ----
  useEffect(() => {
    if (isControlled) return;

    mountedRef.current = true;
    shuffledRef.current = shuffle(quotes);
    qIndexRef.current = 0;

    function cycle(): void {
      if (!mountedRef.current) return;
      const quote = shuffledRef.current[qIndexRef.current % shuffledRef.current.length];
      const result = layoutQuote(quote);
      animateToGrid(result.grid, result.rowColors, () => {
        qIndexRef.current++;
        clearBoard(() => cycle());
      });
    }

    const startTid = setTimeout(cycle, 500);

    return () => {
      mountedRef.current = false;
      clearTimeout(startTid);
      for (const t of timersRef.current) clearTimeout(t);
      timersRef.current = [];
    };
  }, [isControlled, quotes, layoutQuote, animateToGrid, clearBoard]);

  // ---- Scaled dimensions ----
  const cellW = Math.round(28 * scale);
  const cellH = Math.round(40 * scale);
  const gapPx = `${Math.round(3 * scale)}px`;
  const padPx = `${Math.round(16 * scale)}px`;
  const fontSize = `${(1.1 * scale).toFixed(2)}rem`;

  // ---- Render ----
  return (
    <div
      className={className}
      style={{ ...boardStyles.board, gap: gapPx, padding: padPx, ...customStyle }}
    >
      {Array.from({ length: rows }, (_, r) => (
        <div key={`row-${r}`} style={{ ...boardStyles.row, gap: gapPx }}>
          {Array.from({ length: cols }, (_, c) => {
            const idx = r * cols + c;
            return (
              <FlapCell
                key={`cell-${r}-${c}`}
                char={grid[r][c]}
                color={rowColors[r] ?? defaultColor}
                flipKey={flipKeys[idx]}
                flipMs={flipMs}
                onFlip={playClick}
                cellWidth={cellW}
                cellHeight={cellH}
                fontSize={fontSize}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
});

export default SolariBoard;

// ---------------------------------------------------------------------------
// Styles (inline CSSProperties — no external stylesheet needed)
// ---------------------------------------------------------------------------

const boardStyles: Record<string, CSSProperties> = {
  board: {
    display: 'flex',
    flexDirection: 'column',
    background: '#1a1a1a',
    borderRadius: '8px',
    width: 'fit-content',
    overflow: 'hidden',
  },
  row: {
    display: 'flex',
  },
};

const cellStyles: Record<string, CSSProperties> = {
  cell: {
    perspective: '200px',
  },
  flapDisplay: {
    position: 'relative',
    width: '100%',
    height: '100%',
    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', 'Consolas', ui-monospace, monospace",
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
