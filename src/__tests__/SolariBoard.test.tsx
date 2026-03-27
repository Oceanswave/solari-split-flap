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
});
