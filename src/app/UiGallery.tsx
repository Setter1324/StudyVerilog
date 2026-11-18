import { useState } from 'react';
import {
  Button,
  Card,
  Chip,
  CodeBlank,
  IconButton,
  LockedLine,
  ProgressBar,
  Sheet,
  StageStones,
  SunTrack,
  Tabs,
  ValueBadge,
  ZonePin,
  type SignalValue,
  type ZoneId,
} from '../ui';
import { buildCircuit, isLabel } from '../world/circuit';
import { IsoSvg } from '../world/IsoSvg';
import { SAMPLE_SCENES } from '../world/samples';
import s from './UiGallery.module.css';

const VALUES: SignalValue[] = ['1', '0', 'x', 'z'];
const ZONES: ZoneId[] = [1, 2, 3, 4, 5, 6];
const STONES = Array.from({ length: 15 }, (_, i) => ({ id: `d${i + 1}`, no: `1-${i + 1}`, title: `스테이지 ${i + 1}` }));
const STONES_DONE = { d1: true, d2: true, d3: true };

/** 컴포넌트 보기 (#/ui). 최종계획서 7.7의 11개를 한 화면에 모은다. */
export function UiGallery() {
  const [tab, setTab] = useState('design.sv');
  const [blank, setBlank] = useState('');
  const [sound, setSound] = useState(false);
  const [sheet, setSheet] = useState(false);

  return (
    <main className={s.page}>
      <h1 className={s.h1}>컴포넌트</h1>
      <p className={s.muted}>
        최종계획서 7.7의 컴포넌트 11개와 플레이 상단 바의 2개, 넓은 건물 견본 3개. 메뉴에는 없는 개발용 화면이에요.
      </p>

      <section className={s.section}>
        <h2 className={s.h2}>Button · IconButton</h2>
        <div className={s.row}>
          <Button>이어서 하기</Button>
          <Button variant="secondary">스테이지 고르기</Button>
          <Button disabled>실행 중</Button>
          <IconButton label="소리" pressed={sound} onClick={() => setSound(!sound)}>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M3 8h3l4-3v10l-4-3H3Z" fill="currentColor" />
              {sound && <path d="M13 7a4 4 0 0 1 0 6" fill="none" stroke="currentColor" strokeWidth="1.6" />}
            </svg>
          </IconButton>
          <IconButton label="힌트">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="10" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M8 15h4M8.5 17.5h3" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </IconButton>
        </div>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>Chip · ZonePin · ProgressBar</h2>
        <div className={s.row}>
          <Chip variant="subject">VERILOG · 1~8주차</Chip>
          <Chip>예측</Chip>
          <Chip>빈칸</Chip>
          <Chip variant="status">준비 중</Chip>
        </div>
        <div className={s.row}>
          {ZONES.map((z) => (
            <ZonePin key={z} zone={z} label={`구역 ${z}`} dimmed={z > 1} />
          ))}
        </div>
        <ProgressBar value={4} max={15} label="게이트 마을 진행" />
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>Card · ValueBadge</h2>
        <div className={s.grid}>
          {VALUES.map((v) => (
            <Card key={v}>
              <ValueBadge value={v} showName />
            </Card>
          ))}
        </div>
        <div className={s.grid}>
          <Card variant="hero">
            <Chip>빈칸</Chip>
            <h3 className={s.h3}>1-4 게이트 지연</h3>
            <p className={s.muted}>hero: &quot;이어서 하기&quot; 카드</p>
          </Card>
          <Card variant="highlight">
            <ZonePin zone={1} label="게이트 마을" />
            <h3 className={s.h3}>게이트 마을</h3>
            <p className={s.muted}>highlight: 지금 구역</p>
          </Card>
        </div>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>Tabs · CodeBlank · LockedLine</h2>
        <Tabs
          label="파일"
          idPrefix="gallery"
          items={[
            { id: 'design.sv', label: 'design.sv' },
            { id: 'testbench.sv', label: 'testbench.sv' },
          ]}
          value={tab}
          onChange={setTab}
        />
        <div className={s.code} role="tabpanel" id={`gallery-${tab}`} aria-labelledby={`gallery-tab-${tab}`}>
          <LockedLine line={1}>module test;</LockedLine>
          <LockedLine line={2}>  or #3 (w1, A, B);</LockedLine>
          <div className={s.codeLine}>
            <span className={s.no}>3</span>
            <code>
              {'  and '}
              <CodeBlank
                label="빈칸 1: AND 건물을 지나는 데 걸리는 시간"
                placeholder="?"
                value={blank}
                onChange={(e) => setBlank(e.target.value)}
                wrong={blank !== '' && blank !== '#2'}
              />
              {' (E, w1, C);'}
            </code>
          </div>
          <LockedLine line={4}>endmodule</LockedLine>
        </div>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>StageStones · SunTrack</h2>
        <p className={s.muted}>징검다리: 통과 3개, 지금 1-4. 아래는 통과한 순간(▼가 다음 칸으로 뛴다)과 틀린 순간(지금 칸이 흔들린다).</p>
        <StageStones stages={STONES} current="d4" done={STONES_DONE} zone={1} href={() => '#/ui'} />
        <StageStones stages={STONES} current="d4" done={{ ...STONES_DONE, d4: true }} zone={1} hop href={() => '#/ui'} />
        <StageStones stages={STONES} current="d4" done={STONES_DONE} zone={1} shake={1} href={() => '#/ui'} />
        <p className={s.muted}>해의 길: 실행 전, 엔진 받는 중, 재생 중(40%), 해가 짐, 통과.</p>
        <div className={s.stack}>
          <SunTrack state="idle" />
          <SunTrack state="loading" />
          <SunTrack state="time" value={0.4} />
          <SunTrack state="dusk" />
          <SunTrack state="dusk" passed />
        </div>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>넓은 건물과 문</h2>
        <p className={s.muted}>
          길이 건물에 닿는 칸이 문이에요. 보이는 면(왼쪽 아래, 오른쪽 아래)에는 문을 그리고, 이름 있는 문에는 이름표를 붙여요. 구역 1에는
          쓰지 않는 견본이에요(게이트 입구 계획 4.4).
        </p>
        <div className={s.scenes}>
          {SAMPLE_SCENES.map((sample) => {
            const scene = buildCircuit(sample.scene, sample.values);
            return (
              <figure key={sample.id} className={s.sceneCard} data-sample={sample.id}>
                <IsoSvg
                  scene={{ ...scene, prims: scene.prims.filter((p) => !isLabel(p)) }}
                  top={scene.prims.filter(isLabel)}
                  className={s.sceneSvg}
                  title={sample.title}
                />
                <figcaption className={s.muted}>{sample.title}</figcaption>
              </figure>
            );
          })}
        </div>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>Sheet</h2>
        <Button variant="secondary" onClick={() => setSheet(true)}>
          결과 판 열기
        </Button>
        <Sheet
          open={sheet}
          title="맞았어요"
          onClose={() => setSheet(false)}
          actions={
            <>
              <Button variant="secondary" onClick={() => setSheet(false)}>
                다시 보기
              </Button>
              <Button onClick={() => setSheet(false)}>다음 스테이지</Button>
            </>
          }
        >
          <p>t=15에 E가 1이 됐어요. AND 건물을 지나는 데 2틱이 걸려요.</p>
        </Sheet>
      </section>
    </main>
  );
}
