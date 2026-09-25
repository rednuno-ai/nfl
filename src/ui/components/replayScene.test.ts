import { describe, it, expect } from 'vitest';
import { buildReplay, pathValue, ballHeight } from './replayScene';
import type { PossessionLogEntry } from '@engine/simulation/gameSim';
const entry = (changes: Partial<PossessionLogEntry> = {}): PossessionLogEntry => ({
  quarter:1,overtime:false,clockLabel:'14:15',text:'Pass complete for 12 yards.',playerInvolved:true,down:1,distance:10,possession:'player',displayBallOnBefore:25,displayBallOnAfter:37,scoringPlay:false,turnover:false,scorePlayerAfter:0,scoreOpponentAfter:0,momentum:'neutral',
  replay:{kind:'pass',complete:true,interception:false,fumble:false,scramble:false},...changes,
});
describe('demo artwork driven by official replay data',()=>{
  it('is deterministic, creates 22 players, and never mutates the saved entry',()=>{
    const input=entry(), before=JSON.stringify(input);
    expect(buildReplay(input)).toEqual(buildReplay(input));
    expect(buildReplay(input).players).toHaveLength(22);
    expect(JSON.stringify(input)).toBe(before);
  });
  it('ends complete passes at the official spot with an airborne arc',()=>{
    const scene=buildReplay(entry());
    expect(pathValue(scene.ball,1).x).toBe(47);
    expect(ballHeight(scene,.44)).toBeGreaterThan(0);
    expect(ballHeight(scene,1)).toBe(0);
  });
  it('mirrors opponent offense and the first down marker',()=>{
    const scene=buildReplay(entry({possession:'opponent',displayBallOnBefore:75,displayBallOnAfter:63}));
    expect(scene.direction).toBe(-1); expect(scene.firstDown).toBe(75);
    expect(pathValue(scene.ball,1).x).toBe(73);
    expect(scene.players.find(p=>p.id==='QB')?.team).toBe('away');
  });
  it('does not invent a catch for an incomplete pass',()=>{
    const scene=buildReplay(entry({displayBallOnAfter:25,replay:{kind:'pass',complete:false,interception:false,fumble:false,scramble:false}}));
    expect(scene.carrier).toBeNull(); expect(scene.turnover).toBe(false);
  });
  it('shows a defender with the ball on interceptions, not on turnover on downs',()=>{
    expect(buildReplay(entry({turnover:true,replay:{kind:'pass',complete:false,interception:true,fumble:false,scramble:false}})).carrier).toBe('CB1');
    expect(buildReplay(entry({turnover:true,text:'Turnover on downs.'})).turnover).toBe(false);
  });
  it('keeps a sack behind the line, without an airborne pass',()=>{
    const scene=buildReplay(entry({displayBallOnAfter:19,replay:{kind:'sack',complete:false,interception:false,fumble:false,scramble:false}}));
    expect(pathValue(scene.ball,1).x).toBe(29); expect(scene.carrier).toBe('QB'); expect(ballHeight(scene,.44)).toBe(0);
  });
  it('supports old saves, kicks and a static initial formation',()=>{
    expect(buildReplay(entry({replay:undefined,text:'Field goal is good.'})).kind).toBe('kick');
    expect(buildReplay(entry({replay:undefined,text:'Run for 12 yards.'})).kind).toBe('run');
    expect(buildReplay().kind).toBe('idle');
  });
  it('keeps all paths ordered, finite and in bounds, including goal-line plays',()=>{
    for(const possession of ['player','opponent'] as const) for(const start of [0,1,50,99,100]) for(const kind of ['run','pass','sack'] as const){
      const scene=buildReplay(entry({possession,displayBallOnBefore:start,displayBallOnAfter:start,replay:{kind,complete:true,interception:false,fumble:false,scramble:false}}));
      for(const path of [scene.ball,...scene.players.map(p=>p.path)]){
        for(let i=1;i<path.length;i++) expect(path[i].t).toBeGreaterThan(path[i-1].t);
        for(let t=0;t<=1;t+=.05){const p=pathValue(path,t);expect(Number.isFinite(p.x)).toBe(true);expect(p.x).toBeGreaterThanOrEqual(0);expect(p.x).toBeLessThanOrEqual(120);expect(p.y).toBeGreaterThanOrEqual(0);expect(p.y).toBeLessThanOrEqual(53.3);}
      }
    }
  });
});
