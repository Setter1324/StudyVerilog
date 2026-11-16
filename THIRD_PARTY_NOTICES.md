# Third-party notices

의존성을 더할 때마다 이름, 라이선스, 출처를 여기에 적는다. (계획서 10.4)

| 이름 | 라이선스 | 출처 | 쓰는 곳 |
| --- | --- | --- | --- |
| React | MIT | https://github.com/facebook/react | 화면 |
| Vite | MIT | https://github.com/vitejs/vite | 빌드 |
| Zustand | MIT | https://github.com/pmndrs/zustand | 상태 |
| Icarus Verilog (VeriSim의 wasm 빌드) | GPL-2.0-or-later / GPL-2.0 | https://github.com/steveicarus/iverilog, https://github.com/senolgulgonul/verisim | 엔진 검증(CI에서만 받는다). `engine/COPYING`, `engine/verisim.lock.json` |

| Pretendard v1.3.9 | OFL-1.1 | https://github.com/orioncactus/pretendard | 본문 글꼴. 저작자가 배포한 KS X 1001 서브셋 woff2 4개를 그대로 둔다. `public/fonts/pretendard/LICENSE.txt` |
| JetBrains Mono v2.304 | OFL-1.1 | https://github.com/JetBrains/JetBrainsMono | 코드 글꼴. 배포 woff2 그대로. `public/fonts/jetbrains-mono/OFL.txt` |
| D2Coding VER1.4.0 | OFL-1.1 | https://github.com/naver/d2codingfont | 코드 속 한글. ttf를 글자 변경 없이 woff2로만 바꿨다. `public/fonts/d2coding/LICENSE.txt` |

글꼴은 OFL의 예약 글꼴 이름(Reserved Font Name) 때문에 직접 서브셋하지 않는다.

효과음은 Web Audio로 코드에서 만든다(`src/audio/sfx.ts`). 배경음을 넣으면 파일, 출처, 라이선스를 이 표에 적는다(`content/audio.json`, `public/audio/`).
