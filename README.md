# Solari Split-Flap Display

A realistic split-flap (Solari board) display for the web. Cycles through quotes with authentic mechanical flip animations and optional click sounds via the Web Audio API.

Inspired by the classic electromechanical displays found in airports and train stations worldwide.

![Solari Board](https://img.shields.io/badge/display-split--flap-yellow)
![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- Authentic split-flap flip animation using CSS 3D transforms
- Character drum cycling — characters flip through the full alphabet like a real Solari board
- Mechanical click sound via Web Audio API (synthesized, no audio files needed)
- Author attribution rendered in gold (animated in-colour during flips)
- Configurable grid size, timing, and quotes
- Helper utilities for easy text input — just pass plain strings
- Available as both a **standalone HTML** page and a **React + TypeScript** component

## Quick Start — Standalone HTML

Open `demo/index.html` in your browser. That's it — no build step, no dependencies.

## React Component

```bash
npm install solari-split-flap
```

### Simplest usage — just pass strings

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

### With authors

```tsx
import { SolariBoard, parseQuotes } from 'solari-split-flap';

const quotes = parseQuotes([
  { text: 'The only thing we have to fear is fear itself.', author: 'FDR' },
  { text: 'I think, therefore I am.', author: 'Descartes' },
  { text: 'Imagination is more important than knowledge.', author: 'Einstein' },
]);

function App() {
  return <SolariBoard quotes={quotes} />;
}
```

### Word-wrap a single string

```tsx
import { textToQuote } from 'solari-split-flap';

const quote = textToQuote('The quick brown fox jumps over the lazy dog.', 20);
// => ['THE QUICK BROWN FOX', 'JUMPS OVER THE LAZY', 'DOG.']
```

### Advanced — manual line control

If you need precise control over where lines break, pass `Quote[]` (arrays of strings) directly:

```tsx
const myQuotes = [
  ['HELLO WORLD', '', '@A PROGRAMMER'],
  ['THE QUICK BROWN', 'FOX JUMPS OVER', 'THE LAZY DOG.'],
];

<SolariBoard quotes={myQuotes} cols={20} rows={6} />
```

Lines prefixed with `@` are rendered in gold as author attributions.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `cols` | number | `20` | Number of columns (characters per row) |
| `rows` | number | `8` | Number of rows |
| `quotes` | `Quote[]` | Built-in quotes | Array of quotes to cycle through |
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
import type { SolariBoardProps, Quote } from 'solari-split-flap';
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
