// 월드, 파형, 채점기가 함께 쓰는 공통 형식. (최종계획서 9.3)
// 값 v는 '0' | '1' | 'x' | 'z' 또는 벡터 문자열('10x1').
export interface Timeline {
  end: number; // $finish 시각
  signals: Record<string, { width: number; changes: [t: number, v: string][] }>;
  log: { t: number; text: string }[];
}
