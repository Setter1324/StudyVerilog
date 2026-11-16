// 콘텐츠 JSON을 읽는 곳. 화면 코드는 여기서만 콘텐츠를 가져온다. (최종계획서 9.4, 14.3)
import stagesJson from '../../content/verilog/stages.json';
import zonesJson from '../../content/verilog/zones.json';
import type { ZoneId } from '../ui';

export interface Zone {
  id: ZoneId;
  name: string;
  weeks: string;
  topics: string;
  ready: boolean;
}

export interface StageMeta {
  id: string;
  zone: ZoneId;
  no: string;
  title: string;
  types: string[];
  preview?: string[];
}

export const SUBJECT = { name: zonesJson.subject, weeks: zonesJson.weeks };
export const ZONES = zonesJson.zones as Zone[];
export const STAGES = stagesJson.stages as StageMeta[];
export const TYPE_NAMES = stagesJson.types as Record<string, string>;

export const stagesOf = (zone: number) => STAGES.filter((s) => s.zone === zone);
export const stageById = (id: string) => STAGES.find((s) => s.id === id);
export const zoneById = (id: number) => ZONES.find((z) => z.id === id);
