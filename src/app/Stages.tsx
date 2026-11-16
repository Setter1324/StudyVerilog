import { stagesOf, TYPE_NAMES, ZONES } from '../state/content';
import { useProgress } from '../state/progress';
import { Card, Chip, ProgressBar, ZonePin } from '../ui';
import s from './Stages.module.css';
import { TopBar } from './TopBar';

/** 스테이지 목록: 구역별 표. 잠그지 않고 순서는 추천만 한다. (최종계획서 2장 결정 6, 4장) */
export function Stages() {
  const done = useProgress((p) => p.done);
  return (
    <div className={s.page}>
      <TopBar current="stages" />
      <main className={s.main}>
        <h1 className={s.title}>스테이지</h1>
        <p className={s.lede}>수업 순서대로 이어져 있고, 어디서든 시작할 수 있어요.</p>
        {ZONES.map((z) => {
          const list = stagesOf(z.id);
          const n = list.filter((st) => done[st.id]).length;
          return (
            <section key={z.id} className={s.zone} aria-labelledby={`zone-${z.id}`}>
              <div className={s.zoneHead}>
                <ZonePin zone={z.id} dimmed={!z.ready} />
                <h2 id={`zone-${z.id}`} className={s.zoneName}>
                  {z.name}
                </h2>
                <span className={s.weeks}>{z.weeks}</span>
                {!z.ready && <Chip variant="status">준비 중</Chip>}
              </div>
              {z.ready ? (
                <Card className={s.card}>
                  <ProgressBar value={n} max={list.length} label={`${z.name} 진행`} />
                  <ol className={s.list}>
                    {list.map((st) => (
                      <li key={st.id}>
                        <a className={s.row} href={`#/play/${st.id}`}>
                          <span className={s.no}>{st.no}</span>
                          <span className={s.stageTitle}>{st.title}</span>
                          <span className={s.types}>
                            {st.types.map((t) => (
                              <Chip key={t}>{TYPE_NAMES[t] ?? t}</Chip>
                            ))}
                          </span>
                          <span className={s.state}>{done[st.id] ? '✓ 통과' : ''}</span>
                        </a>
                      </li>
                    ))}
                  </ol>
                </Card>
              ) : (
                <p className={s.topics}>{z.topics}</p>
              )}
            </section>
          );
        })}
      </main>
    </div>
  );
}
