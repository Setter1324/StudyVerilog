# KW STUDY SITE 작업 규칙

Verilog 수업을 블록 월드에서 복습하는 정적 웹 사이트. 기준 문서는 `docs/KW-STUDY-SITE-최종계획서.md`다. (프로젝트 문서 `claude/KW-STUDY-SITE-최종계획서.md`의 사본이며, 아직 저장소에 복사하지 않았다. 복사하기 전에는 프로젝트 문서를 읽는다.) 판단이 갈리면 그 문서를 따르고, 문서와 어긋나는 결정을 하게 되면 먼저 주찬에게 묻는다.

## 지킬 규칙 (계획서 14.3)

- 화면 코드는 `Runner`(`src/runner/types.ts`)와 `Timeline`(`src/sim/types.ts`)만 안다. 엔진이 무엇인지 모른다.
- 색, 간격, 반지름은 `src/ui/tokens.css`의 변수로만 쓴다.
- 1·0·x·z는 색, 모양, 글자를 함께 쓴다.
- 스테이지는 `content/verilog/`의 JSON으로만 더한다. 스테이지별 분기 코드를 쓰지 않는다.
- 채점은 결과(신호 값, 로그)로 한다. 같은 동작을 하는 다른 코드도 정답이다.
- 강의자료 PDF와 캡처, 다른 게임(마인크래프트 포함)의 그림과 소리를 저장소에 넣지 않는다. `lecture/`는 `.gitignore`에 있다.
- 새 의존성은 계획서 10장의 표에서 먼저 찾고, 표에 없으면 이유와 라이선스를 PR에 적는다.
- 라이브러리는 쓰기 전에 현재 문서를 확인한다. 버전은 `package-lock.json`으로 고정한다.
- 모든 변경은 PR로 하고 CI가 통과한 뒤 합친다. `main`은 곧바로 배포된다.
- 커밋 머리말: `feat:`, `fix:`, `content:`(스테이지), `engine:`, `docs:`.

## 주찬에게 물을 것 (14.4)

스테이지 문구와 정답(강의자료 기준), 스테이지 잠금 정책 변경, COM's Apps 등록 문구, 범위 변경. (라이선스는 앱 코드 MIT로 정해졌다.)
폴더 안의 세부 구조, 컴포넌트 내부 구현, 테스트 구성, 장면 JSON 형식은 스스로 정해도 된다.

## 명령

```bash
npm ci            # 설치 (처음에는 npm install로 package-lock.json 생성)
npm run dev       # 개발 서버
npm run typecheck && npm run lint && npm test
npm run build     # dist/ (VITE_BASE로 하위 경로 변경 가능)
```

## 현재 단계

0단계(엔진 검증) 전. 뼈대와 빈 페이지만 있다. 다음 순서는 계획서 14.2.
