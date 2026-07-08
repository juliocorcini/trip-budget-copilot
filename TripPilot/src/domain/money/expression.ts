/**
 * E2 / M1 — the amount field accepts a small arithmetic expression
 * ("12+3,50", "10*2", "5+5+2") evaluated WITHOUT `eval`.
 *
 * The parser is locale-tolerant: it accepts both "," and "." as decimal or
 * thousands separators, matching how the app already shows money in pt-BR / es
 * (comma decimal) and en (dot decimal). Invalid input returns `null` so the
 * caller can fall back gracefully (never throws, never crashes a render).
 */

type Token = { type: 'num'; value: number } | { type: 'op'; op: '+' | '-' | '*' | '/' };

const ALLOWED_RE = /^[0-9+\-*/.,\sxX×÷]+$/;

/** Parses a single locale-formatted number token ("1.234,56", "5,5", "12"). */
export function parseLocaleNumber(token: string): number | null {
  const s = token.trim();
  if (s === '') return null;

  let normalized: string | null = null;
  if (/^\d+$/.test(s)) {
    normalized = s;
  } else if (/^\d+,\d+$/.test(s)) {
    // Single comma = decimal (pt-BR / es).
    normalized = s.replace(',', '.');
  } else if (/^\d+\.\d+$/.test(s)) {
    // Single dot = decimal (en / canonical).
    normalized = s;
  } else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    // pt-BR / es grouped: dots group thousands, comma is the decimal.
    normalized = s.split('.').join('').replace(',', '.');
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    // en grouped: commas group thousands, dot is the decimal.
    normalized = s.split(',').join('');
  }

  if (normalized === null) return null;
  const value = parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  let numberBuffer = '';

  const flush = (): boolean => {
    if (numberBuffer === '') return true;
    const value = parseLocaleNumber(numberBuffer);
    if (value === null) return false;
    tokens.push({ type: 'num', value });
    numberBuffer = '';
    return true;
  };

  for (const ch of input) {
    if (ch === ' ') {
      if (!flush()) return null;
    } else if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      if (!flush()) return null;
      tokens.push({ type: 'op', op: ch });
    } else if (ch === 'x' || ch === 'X' || ch === '×') {
      if (!flush()) return null;
      tokens.push({ type: 'op', op: '*' });
    } else if (ch === '÷') {
      if (!flush()) return null;
      tokens.push({ type: 'op', op: '/' });
    } else if (/[0-9.,]/.test(ch)) {
      numberBuffer += ch;
    } else {
      return null;
    }
  }
  if (!flush()) return null;
  return tokens;
}

function evaluateTokens(tokens: Token[]): number | null {
  // Must be num (op num)* — an odd-length, strictly alternating sequence.
  if (tokens.length === 0 || tokens.length % 2 === 0) return null;

  const values: number[] = [];
  const ops: Array<'+' | '-' | '*' | '/'> = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (i % 2 === 0) {
      if (token.type !== 'num') return null;
      values.push(token.value);
    } else {
      if (token.type !== 'op') return null;
      ops.push(token.op);
    }
  }

  // First pass: collapse * and / (higher precedence).
  const valueStack: number[] = [values[0]!];
  const addSubOps: Array<'+' | '-'> = [];
  for (let k = 0; k < ops.length; k++) {
    const op = ops[k]!;
    const next = values[k + 1]!;
    if (op === '*') {
      valueStack.push(valueStack.pop()! * next);
    } else if (op === '/') {
      if (next === 0) return null;
      valueStack.push(valueStack.pop()! / next);
    } else {
      addSubOps.push(op);
      valueStack.push(next);
    }
  }

  // Second pass: apply + and - left to right.
  let result = valueStack[0]!;
  for (let k = 0; k < addSubOps.length; k++) {
    result = addSubOps[k] === '+' ? result + valueStack[k + 1]! : result - valueStack[k + 1]!;
  }

  return Number.isFinite(result) ? result : null;
}

/**
 * Evaluates an amount expression to a decimal number, or `null` when the input
 * is not a valid number/expression. Plain numbers ("5,5", "1.234,56") and
 * arithmetic ("12+3,50", "10*2") are both supported.
 */
export function evaluateAmountExpression(raw: string): number | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === '' || !ALLOWED_RE.test(trimmed)) return null;

  const tokens = tokenize(trimmed);
  if (tokens === null) return null;
  return evaluateTokens(tokens);
}
