# StudyVerilog (KW STUDY SITE)

코드를 채우면, 회로가 걷기 시작해요. 학교 Verilog 수업(1~8주차)을 블록 마을에서 눈으로 보며 복습하는 학습 게임이다.

- 정적 웹 사이트 (Vite + React + TypeScript), GitHub Pages 배포: `https://setter1324.github.io/StudyVerilog/`
- 실행 엔진: 브라우저 안에서 도는 Icarus Verilog (WebAssembly), 서버 없음
- 기준 문서: 최종 계획 보고서 (`docs/`에 사본을 둘 예정)

## 개발

```bash
nvm use           # Node 22 (Windows는 Node 22 이상 설치)
npm install       # 처음에만. 이후에는 npm ci
npm run dev
```

## 라이선스

미정. 엔진(Icarus Verilog)이 GPL-2.0-or-later라서 계획서 15.1절에 따라 정한다.
