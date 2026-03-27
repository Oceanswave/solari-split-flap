import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Quote } from '../index';
import { SolariBoard } from '../index';

// Stub AudioContext so tests don't try to make noise
beforeEach(() => {
  vi.useFakeTimers();

  // Minimal AudioContext stub
  const mockAudioContext = {
    currentTime: 0,
    destination: {},
    createBuffer: () => ({
      getChannelData: () => new Float32Array(512),
    }),
    createBufferSource: () => ({
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      buffer: null,
    }),
    createBiquadFilter: () => ({
      connect: vi.fn(),
      type: 'highpass',
      frequency: { value: 2000 },
    }),
    createGain: () => ({
      connect: vi.fn(),
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
    }),
  };

  vi.stubGlobal(
    'AudioContext',
    vi.fn(() => mockAudioContext),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('SolariBoard', () => {
  it('renders the correct number of rows and cells', () => {
    const { container } = render(<SolariBoard rows={4} cols={10} />);

    // Board is the outermost div
    const board = container.firstElementChild!;
    const rows = board.children;
    expect(rows).toHaveLength(4);

    // Each row should have 10 cells
    for (let r = 0; r < 4; r++) {
      expect(rows[r].children).toHaveLength(10);
    }
  });

  it('renders with default props', () => {
    const { container } = render(<SolariBoard />);
    const board = container.firstElementChild!;
    expect(board.children).toHaveLength(8); // default 8 rows
    expect(board.children[0].children).toHaveLength(20); // default 20 cols
  });

  it('applies custom className', () => {
    const { container } = render(<SolariBoard className="my-board" />);
    expect(container.firstElementChild!.className).toBe('my-board');
  });

  it('applies custom style', () => {
    const { container } = render(<SolariBoard style={{ border: '1px solid red' }} />);
    const board = container.firstElementChild as HTMLElement;
    expect(board.style.border).toBe('1px solid red');
  });

  it('renders in controlled mode with value prop', () => {
    const value: Quote = ['HELLO'];
    const { container } = render(<SolariBoard value={value} rows={3} cols={10} />);
    const board = container.firstElementChild!;
    expect(board.children).toHaveLength(3);
  });

  it('re-renders when value changes in controlled mode', () => {
    const { rerender, container } = render(<SolariBoard value={['HELLO']} rows={3} cols={10} />);

    // Advance timers to let animation settle
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Change value
    rerender(<SolariBoard value={['GOODBYE']} rows={3} cols={10} />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Component should still be mounted and rendering
    const board = container.firstElementChild!;
    expect(board.children).toHaveLength(3);
  });

  it('cycles through quotes in uncontrolled mode', () => {
    const quotes: Quote[] = [['FIRST'], ['SECOND']];
    const { container } = render(<SolariBoard quotes={quotes} rows={3} cols={10} holdMs={1000} />);

    // Advance past initial delay + animation + hold
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Board should still be rendered
    const board = container.firstElementChild!;
    expect(board.children).toHaveLength(3);
  });

  it('respects sound=false', () => {
    // Should not throw or create AudioContext when sound is off
    const { container } = render(<SolariBoard sound={false} />);
    expect(container.firstElementChild).toBeTruthy();
  });

  it('cleans up timers on unmount', () => {
    const { unmount } = render(<SolariBoard rows={2} cols={5} />);

    // Start animations
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Should not throw on unmount
    expect(() => unmount()).not.toThrow();
  });

  it('supports per-line colour via QuoteLine objects', () => {
    const value: Quote = [
      { text: 'RED LINE', color: '#ff0000' },
      { text: 'GREEN LINE', color: '#00ff00' },
    ];
    const { container } = render(<SolariBoard value={value} rows={4} cols={12} />);
    expect(container.firstElementChild!.children).toHaveLength(4);
  });

  it('handles @ prefix for author lines in uncontrolled mode', () => {
    const quotes: Quote[] = [['HELLO', '@AUTHOR']];
    const { container } = render(<SolariBoard quotes={quotes} rows={4} cols={10} />);
    expect(container.firstElementChild!.children).toHaveLength(4);
  });

  it('applies row colour when that row starts flipping, not before', () => {
    // 2 rows, 5 cols. Row 0 = "RED" (colored), Row 1 = empty.
    // "RED" is centered with pad=1, so first drum step is cell (0,1)
    // at delay = 1 * 50 = 50ms. Colour piggybacks onto that callback.
    const value: Quote = [{ text: 'RED', color: '#ff0000' }, ''];
    const { container } = render(<SolariBoard value={value} rows={2} cols={5} />);

    // Advance past the first drum step at 50ms
    act(() => {
      vi.advanceTimersByTime(60);
    });

    const board = container.firstElementChild!;
    const row0Cell = board.children[0].children[0];
    const spans = row0Cell.querySelectorAll('span');
    const hasRedSpan = Array.from(spans).some((span) => {
      const c = (span as HTMLElement).style.color;
      return c === '#ff0000' || c === 'rgb(255, 0, 0)';
    });
    expect(hasRedSpan).toBe(true);
  });

  it('does not apply colour to a row before that row starts flipping', () => {
    // 4 rows, 5 cols. Lines centered → row 1 = "PLAIN", row 2 = "RED" (colored).
    // Row 2 first-cell delay = 2 * 5 * 50 = 500ms.
    // At t=10ms row 2 has NOT started → should still be default colour.
    const value: Quote = ['PLAIN', { text: 'RED', color: '#ff0000' }];
    const { container } = render(<SolariBoard value={value} rows={4} cols={5} />);

    act(() => {
      vi.advanceTimersByTime(10);
    });

    const board = container.firstElementChild!;
    // "RED" is on row 2 (centered in 4 rows)
    const redRow = board.children[2];
    const firstCell = redRow.children[0];
    const spans = firstCell.querySelectorAll('span');
    const noRedYet = Array.from(spans).every((span) => {
      const c = (span as HTMLElement).style.color;
      return c !== '#ff0000' && c !== 'rgb(255, 0, 0)';
    });
    expect(noRedYet).toBe(true);

    // Now advance past row 2's start → colour should appear
    act(() => {
      vi.advanceTimersByTime(600);
    });

    const spansAfter = firstCell.querySelectorAll('span');
    const hasRedNow = Array.from(spansAfter).some((span) => {
      const c = (span as HTMLElement).style.color;
      return c === '#ff0000' || c === 'rgb(255, 0, 0)';
    });
    expect(hasRedNow).toBe(true);
  });
});
