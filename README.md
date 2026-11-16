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

앱 코드는 [MIT](LICENSE) (Copyright (c) 2026 김주찬).
실행 엔진(Icarus Verilog)은 GPL-2.0-or-later를 그대로 따른다. 엔진 소스와 빌드 방법은 `engine/`에 둔다. 그 밖의 의존성은 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에 있다.
