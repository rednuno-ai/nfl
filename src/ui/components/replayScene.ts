import type { PossessionLogEntry } from '@engine/simulation/gameSim';

export interface Point { x: number; y: number }
export interface Keyframe extends Point { t: number }
export interface ReplayPlayer extends Point { id: string; role: string; num: number; team: 'home' | 'away'; path: Keyframe[] }
export interface ReplayScene {
  players: ReplayPlayer[]; ball: Keyframe[]; los: number; firstDown: number;
  direction: number; kind: 'idle' | 'pass' | 'run' | 'sack' | 'kick';
  throwT: number; catchT: number; carrier: string | null; turnover: boolean;
}
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function pathValue(path: Keyframe[], t: number): Point {
  if (t <= path[0].t) return path[0];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    if (t <= b.t) {
      const u = clamp((t - a.t) / (b.t - a.t || 1), 0, 1);
      const eased = u * u * (3 - 2 * u);
      return { x: lerp(a.x, b.x, eased), y: lerp(a.y, b.y, eased) };
    }
  }
  return path[path.length - 1];
}

// Presentation only: never roll RNG, advance a down or write career state here.
// Coordinates include both ten-yard end zones, matching the supplied demo.
export function buildReplay(entry?: PossessionLogEntry): ReplayScene {
  const direction = entry?.possession === 'opponent' ? -1 : 1;
  const los = 10 + clamp(entry?.displayBallOnBefore ?? 25, 0, 100);
  const end = 10 + clamp(entry?.displayBallOnAfter ?? 25, 0, 100);
  const text = entry?.text ?? '';
  const kind: ReplayScene['kind'] = !entry ? 'idle' : entry.replay?.kind ??
    (/extra point|field goal|punts?\b/i.test(text) ? 'kick' : /sack/i.test(text) ? 'sack' : /pass|throw|complet|intercept|picked off/i.test(text) ? 'pass' : entry.down > 0 ? 'run' : 'idle');
  const complete = entry?.replay?.complete ?? !/incomplete|incompletion|broken up|falls|dropped|intercept|picked off/i.test(text);
  const interception = entry?.replay?.interception ?? /intercept|picked off/i.test(text);
  const fumble = entry?.replay?.fumble ?? /fumbl/i.test(text);
  const offense = entry?.possession === 'opponent' ? 'away' : 'home';
  const formation: [string, string, number, number, number][] = [
    ['C','OL',55,-.6,26.65],['LG','OL',66,-.6,23.65],['RG','OL',67,-.6,29.65],['LT','OL',74,-.6,20.15],['RT','OL',75,-.6,33.15],
    ['QB','QB',12,-6,26.65],['RB','RB',28,-6,22.65],['TE','TE',87,-.6,37.65],['WR1','WR',11,0,5.65],['WR2','WR',19,0,47.65],['SL','WR',83,-1,42.65],
    ['DT1','DL',91,1,24.15],['DT2','DL',99,1,29.15],['DE1','DL',94,1,20.15],['DE2','DL',97,1,33.15],['LB1','LB',52,5,21.65],['LB2','LB',54,5.5,26.65],['LB3','LB',58,5,35.65],['CB1','CB',24,7,7.65],['CB2','CB',29,7,45.65],['FS','S',21,15,18.65],['SS','S',31,13,32.65],
  ];
  const players: ReplayPlayer[] = formation.map(([id,role,num,dx,y],i) => {
    const x = clamp(los + dx * direction, .5, 119.5);
    return { id,role,num,x,y,team:i<11?offense:offense==='home'?'away':'home',path:[{t:0,x,y},{t:1,x,y}] };
  });
  const byId = Object.fromEntries(players.map(p => [p.id,p]));
  const setPath = (p: ReplayPlayer, frames: Keyframe[]) => { p.path = frames.map(f => ({...f,x:clamp(f.x,.5,119.5),y:clamp(f.y,1,52.3)})); };
  const frame = (t: number, p: Point): Keyframe => ({t,x:p.x,y:p.y});
  const qb = byId.QB;
  if (kind === 'idle') return {players,ball:qb.path,los,firstDown:los,direction,kind,throwT:0,catchT:0,carrier:null,turnover:false};
  const targetId = entry?.replay?.target === 'te' ? 'TE' : entry?.replay?.target === 'checkdown' ? 'RB' : 'WR1';
  const carrierId = kind === 'sack' || entry?.replay?.scramble ? 'QB' : kind === 'pass' ? targetId : 'RB';
  const runner = byId[carrierId];
  const throwT = .28, catchT = .60;
  const final = {x:end,y:kind === 'sack'?27.5:runner.y};
  const catchPoint = {x:complete || interception ? end : clamp(los + direction * 12,10,110),y:runner.y};
  for (const p of players) {
    const dx = p.team === offense ? (p.role === 'OL' ? .7 : 6) : -1;
    setPath(p,[frame(0,p),{t:1,x:p.x+dx*direction,y:p.y}]);
  }
  setPath(qb,[frame(0,qb),{t:throwT,x:qb.x-direction,y:qb.y},{t:1,x:qb.x-direction,y:qb.y}]);
  let ball: Keyframe[];
  if (kind === 'pass') {
    setPath(runner,[frame(0,runner),{t:.2,x:los+direction*3,y:runner.y},frame(catchT,catchPoint),frame(1,complete?final:catchPoint)]);
    ball = [frame(0,qb),{t:throwT,x:qb.x-direction,y:qb.y},frame(catchT,catchPoint),frame(1,complete || interception?final:catchPoint)];
  } else if (kind === 'kick') {
    ball = [frame(0,qb),{t:.2,x:qb.x,y:qb.y},{t:1,x:end,y:26.65}];
  } else {
    setPath(runner,[frame(0,runner),{t:.18,x:kind==='sack'?qb.x:los-direction*2,y:26.65},frame(1,final)]);
    ball = [frame(0,qb),frame(.18,pathValue(runner.path,.18)),frame(1,final)];
  }
  // Pursuit is illustrative; its endpoint is always the recorded spot.
  for (const id of ['LB1','LB2','CB1','SS','DE1']) {
    const p=byId[id];
    setPath(p,[frame(0,p),{t:.3,x:p.x-direction,y:p.y},frame(1,{x:final.x+direction*.6,y:final.y+.7})]);
  }
  if (interception) setPath(byId.CB1,[frame(0,byId.CB1),frame(catchT,catchPoint),frame(1,final)]);
  return {players,ball,los,firstDown:clamp(los+direction*(entry?.distance??10),10,110),direction,kind,throwT:kind==='kick'?.2:throwT,catchT:kind==='kick'?1:catchT,carrier:kind==='kick'||(kind==='pass'&&!complete&&!interception)?null:interception?'CB1':fumble?null:carrierId,turnover:interception||fumble};
}

export function ballHeight(scene: ReplayScene, t: number) {
  if (!['pass','kick'].includes(scene.kind) || t < scene.throwT || t > scene.catchT) return 0;
  return Math.sin((t-scene.throwT)/(scene.catchT-scene.throwT)*Math.PI)*(scene.kind==='kick'?10:5.5);
}
