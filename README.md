# Solari Split-Flap Display

A realistic split-flap (Solari board) display for the web. Cycles through quotes with authentic mechanical flip animations and optional click sounds via the Web Audio API.

Inspired by the classic electromechanical displays found in airports and train stations worldwide.

![Solari Board](https://img.shields.io/badge/display-split--flap-yellow)
![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- Authentic split-flap flip animation using CSS 3D transforms
- Character drum cycling — characters flip through the full alphabet like a real Solari board
- Mechanical click sound via Web Audio API (synthesized, no audio files needed)
- **Controlled mode** — drive the board from React state, animate on prop changes
- **Uncontrolled mode** — auto-cycle through a list of quotes
- Per-line colours — any row can have its own CSS colour
- `@` shorthand still works for gold author attributions
- Helper utilities for easy text input — just pass plain strings
- Configurable grid size, timing, and quotes
- Linted and formatted with [Biome](https://biomejs.dev/)
- Available as both a **standalone HTML** page and a **React + TypeScript** component

## Quick Start — Standalone HTML

Open `demo/index.html` in your browser. That's it — no build step, no dependencies.

## React Component

```bash
npm install solari-split-flap
```

### Controlled mode — drive it from React state

Pass a single `value` and the board animates to it whenever it changes. No auto-cycling — you own the state.

```tsx
import { useState } from 'react';
import { SolariBoard, textToQuote } from 'solari-split-flap';

function App() {
  const [message, setMessage] = useState(textToQuote('Hello world', 20));

  return (
    <>
      <SolariBoard value={message} />
      <button onClick={() => setMessage(textToQuote('Goodbye world', 20))}>
        Change
      </button>
    </>
  );
}
```

### Uncontrolled mode — auto-cycle through quotes

```tsx
import { SolariBoard, parseQuotes } from 'solari-split-flap';

const quotes = parseQuotes([
  'The only limit is your imagination.',
  'Stay hungry. Stay foolish.',
  'Make it simple, but significant.',
]);

function App() {
  return <SolariBoard quotes={quotes} />;
}
```

### With authors (gold attribution)

```tsx
const quotes = parseQuotes([
  { text: 'The only thing we have to fear is fear itself.', author: 'FDR' },
  { text: 'I think, therefore I am.', author: 'Descartes' },
]);
```

### Custom colours per quote

```tsx
const quotes = parseQuotes([
  { text: 'System online.', color: '#4ade80' },
  { text: 'Warning: disk full.', color: '#f87171' },
  { text: 'Welcome aboard!', color: '#60a5fa', author: 'Captain' },
  { text: 'Danger!', color: '#ff4444', author: 'System', authorColor: '#aaaaaa' },
]);
```

### Per-line colour control

Each line in a quote can be a plain string or a `{ text, color? }` object — mix and match freely:

```tsx
const quotes = [
  [
    { text: 'RED ALERT', color: '#ff4444' },
    { text: 'ALL SYSTEMS', color: '#ffffff' },
    { text: 'NOMINAL', color: '#4ade80' },
  ],
  [
    'PLAIN WHITE LINE',
    { text: 'GOLD ACCENT', color: '#f5c542' },
    '@CLASSIC AUTHOR STYLE',       // still works — gold via @ prefix
  ],
];

<SolariBoard quotes={quotes} />
```

### Board-wide default colour

```tsx
<SolariBoard defaultColor="#60a5fa" />   {/* all text blue unless overridden */}
```

### Word-wrap a single string

```tsx
import { textToQuote } from 'solari-split-flap';

// Simple
textToQuote('The quick brown fox jumps over the lazy dog.', 20)

// With colour
textToQuote('Alert!', 20, { color: '#ff4444', author: 'System', authorColor: '#aaa' })
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `Quote` | — | **Controlled mode.** Board animates to this value on change. When set, `quotes`/`holdMs` are ignored. |
| `quotes` | `Quote[]` | Built-in quotes | **Uncontrolled mode.** Array of quotes to auto-cycle through. Ignored when `value` is set. |
| `cols` | number | `20` | Number of columns (characters per row) |
| `rows` | number | `8` | Number of rows |
| `defaultColor` | string | `'#f0f0f0'` | Default text colour for rows without an explicit colour |
| `holdMs` | number | `5000` | Milliseconds to hold each quote before clearing |
| `charDelay` | number | `50` | Stagger delay (ms) between cell animations |
| `flipMs` | number | `150` | Duration of a single flap flip |
| `minGap` | number | `35` | Fastest drum-step interval (ms) |
| `maxGap` | number | `160` | Slowest drum-step interval (ms) |
| `sound` | boolean | `true` | Enable/disable flip click sounds |
| `className` | string | `''` | Additional CSS class for the board |
| `style` | object | `{}` | Additional inline styles for the board |

### Exports

```tsx
import { SolariBoard, textToQuote, parseQuotes } from 'solari-split-flap';
import type { SolariBoardProps, Quote, QuoteLine, TextToQuoteOptions } from 'solari-split-flap';
```

### Types

```tsx
type QuoteLine = string | { text: string; color?: string };
type Quote = QuoteLine[];

interface TextToQuoteOptions {
  author?: string;
  color?: string;         // body line colour
  authorColor?: string;   // author line colour (default: '#f5c542' gold)
}
```

## Development

```bash
npm install
npm run lint          # Biome check
npm run lint:fix      # Biome auto-fix
npm run format        # Biome format
npm run typecheck     # TypeScript --noEmit
npm run ci            # Biome ci + typecheck (use in CI pipelines)
npm run build         # Compile to dist/
```

## How It Works

Each cell in the grid consists of four layers:

1. **Top flap** — shows the top half of the current character
2. **Bottom flap** — shows the bottom half of the new character (revealed as the top flap falls)
3. **Flip front** — animated element showing the old character's top half, rotates down
4. **Flip back** — backface of the flip, shows the new character's bottom half

The flip animation uses `rotateX(-180deg)` with `backface-visibility: hidden` and `transform-style: preserve-3d` for realistic 3D flipping.

Characters cycle through a **drum** (`SPACE → A-Z → 0-9 → punctuation`) to reach their target, just like a real mechanical display where each flap must pass through all intermediate characters.

Timing decelerates toward the target character (fast start, slow finish) for a natural mechanical feel.

## License

MIT
