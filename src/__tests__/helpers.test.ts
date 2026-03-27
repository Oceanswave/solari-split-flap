import { describe, expect, it } from 'vitest';
import { parseQuotes, textToQuote } from '../index';

// ---------------------------------------------------------------------------
// textToQuote
// ---------------------------------------------------------------------------

describe('textToQuote', () => {
  it('wraps a short string into a single line', () => {
    const result = textToQuote('HELLO', 20);
    expect(result).toEqual(['HELLO']);
  });

  it('uppercases input', () => {
    const result = textToQuote('hello world', 20);
    expect(result).toEqual(['HELLO WORLD']);
  });

  it('wraps long text across multiple lines', () => {
    const result = textToQuote('The quick brown fox jumps over the lazy dog', 20);
    for (const line of result) {
      const text = typeof line === 'string' ? line : line.text;
      expect(text.length).toBeLessThanOrEqual(20);
    }
    expect(result.length).toBeGreaterThan(1);
  });

  it('respects column width boundary', () => {
    // "AAAA BBBB" = 9 chars, fits in cols=10
    const result = textToQuote('aaaa bbbb', 10);
    expect(result).toEqual(['AAAA BBBB']);
  });

  it('breaks at column width', () => {
    // "AAAA BBBBB" = 10 chars, but "AAAA" + " " + "BBBBB" = 10, fits in cols=10
    const result = textToQuote('aaaa bbbbb', 10);
    expect(result).toEqual(['AAAA BBBBB']);

    // Doesn't fit in cols=9
    const result2 = textToQuote('aaaa bbbbb', 9);
    expect(result2).toEqual(['AAAA', 'BBBBB']);
  });

  it('appends author attribution line', () => {
    const result = textToQuote('Hello', 20, { author: 'World' });
    expect(result).toHaveLength(3); // text, blank, author
    expect(result[1]).toBe('');

    const authorLine = result[2];
    expect(typeof authorLine).toBe('object');
    if (typeof authorLine === 'object') {
      expect(authorLine.text).toBe('WORLD');
      expect(authorLine.color).toBe('#f5c542');
    }
  });

  it('uses custom author colour', () => {
    const result = textToQuote('Hello', 20, { author: 'World', authorColor: '#ff0000' });
    const authorLine = result[result.length - 1];
    expect(typeof authorLine).toBe('object');
    if (typeof authorLine === 'object') {
      expect(authorLine.color).toBe('#ff0000');
    }
  });

  it('applies body colour to all text lines', () => {
    const result = textToQuote('Hello world this is a test', 10, { color: '#00ff00' });
    for (const line of result) {
      expect(typeof line).toBe('object');
      if (typeof line === 'object') {
        expect(line.color).toBe('#00ff00');
      }
    }
  });

  it('applies body colour but keeps author colour separate', () => {
    const result = textToQuote('Hello', 20, {
      color: '#00ff00',
      author: 'Author',
      authorColor: '#0000ff',
    });
    const bodyLine = result[0];
    const authorLine = result[result.length - 1];

    expect(typeof bodyLine).toBe('object');
    if (typeof bodyLine === 'object') {
      expect(bodyLine.color).toBe('#00ff00');
    }

    expect(typeof authorLine).toBe('object');
    if (typeof authorLine === 'object') {
      expect(authorLine.color).toBe('#0000ff');
    }
  });

  it('defaults cols to 20', () => {
    const result = textToQuote('Hello');
    expect(result).toEqual(['HELLO']);
  });

  it('handles empty string', () => {
    const result = textToQuote('', 20);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// parseQuotes
// ---------------------------------------------------------------------------

describe('parseQuotes', () => {
  it('parses a single string', () => {
    const result = parseQuotes('Hello world');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(['HELLO WORLD']);
  });

  it('parses an array of strings', () => {
    const result = parseQuotes(['Hello', 'World']);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(['HELLO']);
    expect(result[1]).toEqual(['WORLD']);
  });

  it('parses an array of { text, author } objects', () => {
    const result = parseQuotes([{ text: 'Be yourself.', author: 'Oscar Wilde' }]);
    expect(result).toHaveLength(1);
    const quote = result[0];
    expect(quote[0]).toBe('BE YOURSELF.');
    // Last line should be author with gold colour
    const authorLine = quote[quote.length - 1];
    expect(typeof authorLine).toBe('object');
    if (typeof authorLine === 'object') {
      expect(authorLine.text).toBe('OSCAR WILDE');
    }
  });

  it('parses { text, color } objects', () => {
    const result = parseQuotes([{ text: 'Alert!', color: '#ff0000' }]);
    expect(result).toHaveLength(1);
    const line = result[0][0];
    expect(typeof line).toBe('object');
    if (typeof line === 'object') {
      expect(line.color).toBe('#ff0000');
    }
  });

  it('passes through Quote[] (array of arrays) as-is', () => {
    const input = [['HELLO', 'WORLD'], ['FOO']];
    const result = parseQuotes(input);
    expect(result).toBe(input); // same reference
  });

  it('returns empty array for empty input', () => {
    expect(parseQuotes([])).toEqual([]);
  });

  it('respects custom cols parameter', () => {
    const result = parseQuotes('Hello world', 5);
    expect(result).toHaveLength(1);
    // "HELLO" = 5, "WORLD" = 5, won't fit on same line at cols=5
    expect(result[0]).toEqual(['HELLO', 'WORLD']);
  });

  it('handles { text, author, color, authorColor } all together', () => {
    const result = parseQuotes([
      { text: 'Danger', color: '#ff0000', author: 'System', authorColor: '#aaaaaa' },
    ]);
    expect(result).toHaveLength(1);
    const quote = result[0];

    const bodyLine = quote[0];
    expect(typeof bodyLine).toBe('object');
    if (typeof bodyLine === 'object') {
      expect(bodyLine.color).toBe('#ff0000');
    }

    const authorLine = quote[quote.length - 1];
    expect(typeof authorLine).toBe('object');
    if (typeof authorLine === 'object') {
      expect(authorLine.color).toBe('#aaaaaa');
    }
  });
});
