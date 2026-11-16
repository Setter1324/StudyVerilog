import { Fragment, useMemo } from 'react';
import { STAGES, stageById, stagesOf, SUBJECT, TYPE_NAMES, ZONES, zoneById, type StageMeta } from '../state/content';
import { storageAvailable, useProgress } from '../state/progress';
import { Button, Card, Chip, ProgressBar, ValueBadge, ZonePin, type SignalValue } from '../ui';
import { buildIsland, buildValueSprite } from '../world/island';
import { IsoSvg } from '../world/IsoSvg';
import { Walkers } from '../world/Walkers';
import type { WalkerKind } from '../world/walkers';
import s from './Home.module.css';
import { TopBar } from './TopBar';

// 장면은 한 번만 계산한다
const ISLAND = buildIsland();
// 섬의 긴 길을 값 1·0·x를 실은 알파카들이 걷는다 (5.5). 길을 셋으로 나눠 다른 짐을 싣게 한다
const ISLAND_WALK = (() => {
  const w = ISLAND.walk;
  const third = Math.ceil(w.length / 3);
  const kinds: WalkerKind[] = ['1', '0', 'x'];
  return kinds.map((kind, i) => ({ cells: w.slice(i * third, (i + 1) * third + 1), kind, count: 2 }));
})();
const VALUES: { v: SignalValue; text: string }[] = [
  { v: '1', text: '짐 실은 동물' },
  { v: '0', text: '빈손 동물' },
  { v: 'x', text: '안개 속 동물' },
  { v: 'z', text: '끊긴 길' },
];
const SPRITES = Object.fromEntries(VALUES.map(({ v }) => [v, buildValueSprite(v)]));
const VALUE_NOTES: Record<SignalValue, string> = {
  '1': '상자를 싣고 길을 걸어요.',
  '0': '아무것도 싣지 않고 걸어요.',
  x: '값을 아직 몰라요. 초기화하지 않은 reg예요.',
  z: '아무도 지나가지 않는 끊긴 길이에요.',
};

function go(hash: string) {
  window.location.hash = hash;
}

/** 이어서 할 스테이지: 마지막으로 연 것, 그 구역을 다 끝냈으면 다음 구역의 첫 스테이지 (5.2) */
function pickNext(last: string | null, done: Record<string, true>): { stage: StageMeta; firstVisit: boolean; allDone: boolean } {
  const first = STAGES[0]!;
  if (!last) return { stage: first, firstVisit: true, allDone: false };
  const cur = stageById(last) ?? first;
  const zoneStages = stagesOf(cur.zone);
  if (zoneStages.every((st) => done[st.id])) {
    const nextZone = zoneById(cur.zone + 1);
    const nextFirst = nextZone?.ready ? stagesOf(nextZone.id)[0] : undefined;
    if (nextFirst) return { stage: nextFirst, firstVisit: false, allDone: false };
    return { stage: cur, firstVisit: false, allDone: true };
  }
  return { stage: cur, firstVisit: false, allDone: false };
}

/** 코드 미리보기 한 줄. {{…}}는 빈칸으로 강조한다 */
function PreviewLine({ text }: { text: string }) {
  const parts = text.split(/(\{\{.*?\}\})/);
  return (
    <div className={s.codeLine}>
      {parts.map((p, i) =>
        p.startsWith('{{') ? (
          <span key={i} className={s.blank}>
            {p.slice(2, -2)}
          </span>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </div>
  );
}

function ContinueCard() {
  const last = useProgress((p) => p.last);
  const done = useProgress((p) => p.done);
  const { stage, firstVisit, allDone } = pickNext(last, done);
  const zone = zoneById(stage.zone)!;
  const zoneStages = stagesOf(zone.id);
  const zoneDone = zoneStages.filter((st) => done[st.id]).length;
  const href = `#/play/${stage.id}`;

  return (
    <Card variant="hero" as="section" className={s.continue} aria-labelledby="continue-title">
      <div className={s.continueHead}>
        <ZonePin zone={zone.id} size="sm" />
        <span className={s.eyebrow}>
          구역 {zone.id} · {zone.name} · 스테이지 {stage.no}
        </span>
      </div>
      <h2 id="continue-title" className={s.continueTitle}>
        {allDone ? '틀린 문제 다시 풀기' : stage.title}
      </h2>
      <div className={s.chips}>
        {stage.types.map((t) => (
          <Chip key={t}>{TYPE_NAMES[t] ?? t}</Chip>
        ))}
      </div>
      {stage.preview && (
        <pre className={s.code} aria-label="코드 미리보기">
          {stage.preview.map((line, i) => (
            <PreviewLine key={i} text={line} />
          ))}
        </pre>
      )}
      {firstVisit ? (
        <p className={s.count}>스테이지 {STAGES.length}개</p>
      ) : (
        <ProgressBar value={zoneDone} max={zoneStages.length} label={`${zone.name} 진행`} />
      )}
      <div className={s.actions}>
        <Button onClick={() => go(href)} className={s.primary}>
          {firstVisit ? '시작하기' : '이어서 하기'}
        </Button>
        <Button variant="secondary" onClick={() => go('#/stages')}>
          스테이지 고르기
        </Button>
      </div>
    </Card>
  );
}

function IslandMap() {
  // 핀 위치를 SVG 좌표에서 백분율로 바꿔 링크를 겹친다
  const pins = useMemo(
    () =>
      ISLAND.pins.map((p) => ({
        ...p,
        left: ((p.x - ISLAND.x) / ISLAND.w) * 100,
        top: ((p.y - 22 - ISLAND.y) / ISLAND.h) * 100,
      })),
    [],
  );
  return (
    <figure className={s.island}>
      <IsoSvg
        scene={ISLAND}
        className={s.islandSvg}
        title="여섯 구역이 한 길로 이어진 블록 섬. 알파카가 값을 싣고 길을 걷는다."
      >
        <Walkers paths={ISLAND_WALK} />
      </IsoSvg>
      {pins.map((p) => {
        const zone = zoneById(p.zone)!;
        const style = { left: `${p.left}%`, top: `${p.top}%` };
        return zone.ready ? (
          <a key={p.zone} href="#/stages" className={s.pinHit} style={style} aria-label={`구역 ${zone.id} ${zone.name} 스테이지 보기`}>
            <span className={s.pinTag}>{zone.name}</span>
          </a>
        ) : (
          <span key={p.zone} className={`${s.pinHit} ${s.pinOff}`} style={style} aria-hidden="true">
            <span className={s.pinTag}>{zone.name} · 준비 중</span>
          </span>
        );
      })}
    </figure>
  );
}

export function Home() {
  const last = useProgress((p) => p.last);
  const done = useProgress((p) => p.done);
  const currentZone = last ? stageById(last)?.zone : undefined;

  return (
    <div className={s.page}>
      <TopBar current="home" />
      <main className={s.main}>
        <div className={s.hero}>
          <div className={s.left}>
            <div className={s.titleBlock}>
              <Chip variant="subject">
                {SUBJECT.name} · {SUBJECT.weeks}
              </Chip>
              <h1 className={s.title}>
                <span className={s.kw}>KW</span> STUDY SITE
              </h1>
              <p className={s.tagline}>코드를 채우면, 회로가 걷기 시작해요.</p>
              <p className={s.lede}>
                수업에서 배운 Verilog를 블록 마을에서 눈으로 보며 다시 풀어요. 설치도 로그인도 필요 없어요.
              </p>
            </div>
            <ContinueCard />
          </div>
          <IslandMap />
        </div>

        <section className={s.section} aria-labelledby="values-title">
          <h2 id="values-title" className={s.sectionTitle}>
            값 읽는 법
          </h2>
          <div className={s.values}>
            {VALUES.map(({ v, text }) => (
              <Card key={v} className={s.valueCard}>
                <IsoSvg scene={SPRITES[v]!} className={s.sprite} />
                <div>
                  <ValueBadge value={v} />
                  <p className={s.valueName}>{text}</p>
                  <p className={s.valueNote}>{VALUE_NOTES[v]}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className={s.section} aria-labelledby="zones-title">
          <h2 id="zones-title" className={s.sectionTitle}>
            구역
          </h2>
          <p className={s.sectionLede}>수업 순서대로 이어져 있고, 어디서든 시작할 수 있어요.</p>
          <ul className={s.zones}>
            {ZONES.map((z) => {
              const list = stagesOf(z.id);
              const n = list.filter((st) => done[st.id]).length;
              const body = (
                <>
                  <div className={s.zoneHead}>
                    <ZonePin zone={z.id} dimmed={!z.ready} />
                    <span className={s.zoneWeeks}>{z.weeks}</span>
                  </div>
                  <h3 className={s.zoneName}>{z.name}</h3>
                  <p className={s.zoneTopics}>{z.topics}</p>
                  {z.ready ? (
                    <ProgressBar value={n} max={list.length} label={`${z.name} 진행`} />
                  ) : (
                    <Chip variant="status">준비 중</Chip>
                  )}
                </>
              );
              return (
                <Card key={z.id} as="li" variant={currentZone === z.id ? 'highlight' : 'default'} className={z.ready ? s.zone : `${s.zone} ${s.zoneOff}`}>
                  {z.ready ? (
                    <a href="#/stages" className={s.zoneLink} aria-label={`구역 ${z.id} ${z.name}`}>
                      {body}
                    </a>
                  ) : (
                    <div aria-disabled="true">{body}</div>
                  )}
                </Card>
              );
            })}
          </ul>
        </section>
      </main>
      <footer className={s.footer}>
        <span>COM&apos;s 부원 프로젝트</span>
        <span>{storageAvailable ? '진행도는 이 브라우저에만 저장돼요' : '이 브라우저에서는 진행도가 저장되지 않아요'}</span>
        <a href="https://coms.kw.ac.kr" target="_blank" rel="noreferrer">
          COM&apos;s Apps
        </a>
        <a href="https://github.com/Setter1324/StudyVerilog" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </footer>
    </div>
  );
}
