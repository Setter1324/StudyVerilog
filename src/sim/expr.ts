// 보기로 주는 불 함수(Verilog 식)를 값으로 계산한다. 보스 1-15의 "파형 H와 불 함수"가 쓴다. (최종계획서 8.3, 8.5)
// 플레이 화면과 CI의 스테이지 검증이 같이 쓰므로 런타임 TS 문법(enum 등)을 쓰지 않는다.

export type Bit = '0' | '1' | 'x';

const TOKEN = /\s*(1'b[01]|[A-Za-z_][\w$]*|~\^|\^~|&&|\|\||[01]|[~!&|^()])/y;

function tokenize(src: string): string[] {
  const out: string[] = [];
  TOKEN.lastIndex = 0;
  let at = 0;
  while (at < src.length) {
    if (/^\s*$/.test(src.slice(at))) break;
    TOKEN.lastIndex = at;
    const m = TOKEN.exec(src);
    if (!m) throw new Error(`식을 읽지 못했어요: ${src.slice(at).trim()}`);
    out.push(m[1]!);
    at = TOKEN.lastIndex;
  }
  return out;
}

const bit = (v: string | undefined): Bit => (v === '0' || v === '1' ? v : 'x');
const not = (a: Bit): Bit => (a === 'x' ? 'x' : a === '1' ? '0' : '1');
const and = (a: Bit, b: Bit): Bit => (a === '0' || b === '0' ? '0' : a === '1' && b === '1' ? '1' : 'x');
const or = (a: Bit, b: Bit): Bit => (a === '1' || b === '1' ? '1' : a === '0' && b === '0' ? '0' : 'x');
const xor = (a: Bit, b: Bit): Bit => (a === 'x' || b === 'x' ? 'x' : a === b ? '0' : '1');

/**
 * 한 비트짜리 식을 계산한다. 이름, 0, 1, 1'b0, 1'b1, ~ ! & | ^ ~^ ^~ && ||, 괄호를 읽는다.
 * 우선순위는 Verilog와 같다: 단항 > & > ^ > |.
 * @param env 이름 → 값('0', '1', 그 밖은 x로 본다)
 */
export function evalExpr(src: string, env: Record<string, string>): Bit {
  const toks = tokenize(src);
  let i = 0;
  const peek = () => toks[i];
  const take = () => toks[i++];

  const primary = (): Bit => {
    const t = take();
    if (t === undefined) throw new Error('식이 끝나 버렸어요');
    if (t === '(') {
      const v = orExpr();
      if (take() !== ')') throw new Error('괄호가 닫히지 않았어요');
      return v;
    }
    if (t === '0' || t === "1'b0") return '0';
    if (t === '1' || t === "1'b1") return '1';
    if (/^[A-Za-z_]/.test(t)) {
      if (!(t in env)) throw new Error(`모르는 이름이에요: ${t}`);
      return bit(env[t]);
    }
    throw new Error(`여기에 ${t}가 올 수 없어요`);
  };
  const unary = (): Bit => {
    const t = peek();
    if (t === '~' || t === '!') {
      take();
      return not(unary());
    }
    return primary();
  };
  const andExpr = (): Bit => {
    let v = unary();
    while (peek() === '&' || peek() === '&&') {
      take();
      v = and(v, unary());
    }
    return v;
  };
  const xorExpr = (): Bit => {
    let v = andExpr();
    while (peek() === '^' || peek() === '~^' || peek() === '^~') {
      const op = take();
      const r = xor(v, andExpr());
      v = op === '^' ? r : not(r);
    }
    return v;
  };
  const orExpr = (): Bit => {
    let v = xorExpr();
    while (peek() === '|' || peek() === '||') {
      take();
      v = or(v, xorExpr());
    }
    return v;
  };

  const v = orExpr();
  if (i < toks.length) throw new Error(`식 끝에 남은 글자가 있어요: ${toks.slice(i).join(' ')}`);
  return v;
}
