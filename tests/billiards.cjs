const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');const source=html.split('// ── BILLIARDS ENGINE v304 ──')[1].split('// ── END BILLIARDS ENGINE ──')[0];const ctx={Math,performance};vm.createContext(ctx);vm.runInContext(html.slice(html.indexOf('function calcPts(cards){'),html.indexOf('// v286: normal battles'))+source+';this.api={BB_CFG,bbRole,bbBody,bbPoints,bbCreate,bbStart,bbShoot,bbPhysics,bbStep,bbJoin,bbCanTen,bbReplenish,bbCandidates,bbEvaluate,bbRay};',ctx);const api=ctx.api,{BB_CFG,bbRole,bbBody,bbPoints,bbCreate,bbStart,bbShoot,bbPhysics,bbStep,bbJoin,bbCanTen,bbReplenish,bbCandidates,bbEvaluate,bbRay}=api;
function game(parts){const s=bbCreate();s.bodies=parts.map((b,i)=>bbBody(i+1,b[0],b[1],b[2].map((n,j)=>({x:j*40,y:0,n}))));s.nextId=100;bbStart(s);return s;}
function settle(s){for(let i=0;i<1300&&s.moving;i++)bbStep(s,BB_CFG.step,true);assert.equal(s.moving,false);}
// White cue transfers movement without joining; original numbers remain in a moving compound body.
let s=game([[220,530,[0]],[220,390,[3]],[220,260,[2]]]);assert(bbShoot(s,-Math.PI/2,.7));assert(!bbShoot(s,0,1));for(let i=0;i<250&&!s.events.some(e=>e.kind==='join');i++)bbStep(s,BB_CFG.step,true);let joined=s.bodies.find(b=>b.sum===5);assert(joined);assert.deepEqual(Array.from(joined.parts,p=>p.n).sort(),[2,3]);assert(Math.hypot(joined.vx,joined.vy)>0);assert(s.bodies.some(b=>b.sum===0));settle(s);assert.equal(s.turn,1);assert.equal(s.turnNo,1);
// The finisher, including the opponent stealing an existing 3-2-4, receives the point.
s=game([[220,530,[0]],[220,390,[1]],[180,260,[3,2,4]]]);s.turn=1;assert(bbShoot(s,-Math.PI/2,.8));settle(s);assert.deepEqual(Array.from(s.scores),[0,5]);assert.equal(s.bodies.length,1);assert.equal(s.turn,1);assert.equal(s.shots,1);assert.equal(s.events.filter(e=>e.kind==='ten').length,1);
// Over-ten bodies bounce without merging or deleting numbers.
s=game([[220,530,[0]],[200,330,[4,4]],[210,200,[3]]]);assert(bbShoot(s,-Math.PI/2,.8));settle(s);assert.equal(s.bodies.length,3);assert.equal(s.scores[0],0);assert.equal(s.merged,0);
// Walls, rotations, collision corrections and fixed-step settling remain finite and in bounds.
s=bbCreate();bbStart(s);for(let turn=0;turn<24;turn++){assert(bbShoot(s,turn*2.399,.6+(turn%3)*.2));settle(s);for(const b of s.bodies)for(const p of bbPoints(b)){assert(Number.isFinite(p.x)&&Number.isFinite(p.y));assert(p.x>=BB_CFG.r-1&&p.x<=BB_CFG.w-BB_CFG.r+1,JSON.stringify(p));assert(p.y>=BB_CFG.r-1&&p.y<=BB_CFG.h-BB_CFG.r+1,JSON.stringify(p));}if(s.phase==='ended')break;bbReplenish(s,()=>.5);}
// Pause locks motion / shooting; no delayed double score. Refill preserves all existing positions.
s=bbCreate();bbStart(s);bbShoot(s,0,.6);s.paused=true;const frozen=JSON.stringify(s);for(let i=0;i<200;i++)bbStep(s);assert.equal(JSON.stringify(s),frozen);assert(!bbShoot(s,1,1));s.paused=false;settle(s);
s=game([[50,50,[0]],[150,150,[3,3]]]);assert(!bbCanTen(s));const old=JSON.stringify(s.bodies);bbReplenish(s,()=>.5);assert(bbCanTen(s));assert.equal(JSON.stringify(s.bodies.slice(0,2)),old);assert(s.bodies.length>2);
// Any number of components may form ten; roles score, match ends at 15, ended states reject shots.
s=game([[50,50,[0]],[120,200,[1,1,1,1,1]],[120,260,[5]]]);s.scores[0]=11;bbJoin(s,s.bodies[1],s.bodies[2]);assert.equal(s.phase,'ended');assert.equal(s.winner,0);assert.equal(s.scores[0],15);assert(!bbShoot(s,0,1));
// AI evaluates exactly the live physics without mutating the real board and finds an available ten.
s=game([[220,530,[0]],[220,390,[5]],[220,260,[5]]]);s.turn=1;const snapshot=JSON.stringify(s),candidates=bbCandidates(s);let best=-Infinity;for(const c of candidates.slice(0,60))best=Math.max(best,bbEvaluate(s,c));assert(best>=200,'AI missed an unobstructed scoring shot');assert.equal(JSON.stringify(s),snapshot);
assert(bbRay(s,-Math.PI/2)<140);assert.equal(Object.keys(BB_CFG.levels).length,3);
// Initial boards contain exactly twelve separate numbers and a cue, without overlaps.
for(let seed=1;seed<=20;seed++){let x=seed;const rng=()=>((x=(x*1664525+1013904223)>>>0)/4294967296),g=bbCreate('normal',rng);assert.equal(g.bodies.length,13);assert(g.bodies.every(b=>b.parts.length===1));assert.equal(g.bodies.filter(b=>b.sum===0).length,1);assert.equal(g.bodies.reduce((n,b)=>n+b.sum,0),34);for(let i=0;i<13;i++)for(let j=i+1;j<13;j++)assert(Math.hypot(g.bodies[i].x-g.bodies[j].x,g.bodies[i].y-g.bodies[j].y)>BB_CFG.r*2+6);}
// Same hand ranking as regular Tenkuru; 5+5 is deliberately no role.
for(const [cards,points,label] of [[[5,5],1,'役なし'],[[1,1,3,5],2,'ワンペア'],[[2,2,3,3],3,'ツーペア'],[[1,3,3,3],4,'スリーカード'],[[4,2,1,3],5,'ストレート'],[[2,2,2,2,2],4,'スリーカード']]){const r=bbRole(cards);assert.equal(r.points,points);assert.equal(r.label,label);}
// No-role ten hands over immediately. Only the first scoring shot earns a single extra shot.
s=game([[220,580,[0]],[100,100,[5]],[160,100,[5]]]);bbShoot(s,Math.PI/2,.08);bbJoin(s,s.bodies[1],s.bodies[2]);settle(s);assert.equal(s.turn,1);assert.equal(s.shots,0);assert.equal(s.scores[0],1);
for(const who of [0,1]){
 s=game([[220,580,[0]],[100,100,[1]],[160,100,[3,3,3]]]);s.turn=who;bbShoot(s,Math.PI/2,.08);bbJoin(s,s.bodies[1],s.bodies[2]);
 // Real (non-simulation) settling must not replenish during the bonus transition.
 for(let i=0;i<1300&&s.moving;i++)bbStep(s);assert.equal(s.turn,who);assert.equal(s.shots,1);assert.equal(s.bodies.length,1);assert.equal(s.events.filter(e=>e.kind==='bonus').length,1);assert.equal(s.events.filter(e=>e.kind==='refill').length,0);
 s.bodies.push(bbBody(s.nextId++,100,100,[{x:0,y:0,n:2},{x:40,y:0,n:2}]),bbBody(s.nextId++,200,100,[{x:0,y:0,n:3},{x:40,y:0,n:3}]));
 bbShoot(s,Math.PI/2,.08);bbJoin(s,s.bodies[1],s.bodies[2]);for(let i=0;i<1300&&s.moving;i++)bbStep(s);assert.equal(s.turn,1-who);assert.equal(s.shots,0);assert.equal(s.scores[who],7);assert.equal(s.events.filter(e=>e.kind==='bonus').length,1);assert.equal(s.bodies.filter(b=>b.sum>0).length,12);
}
// Sparse bodies are topped up, but old geometry is untouched and normal count is bounded.
s=game([[40,650,[0]],[80,80,[3,3]],[230,120,[4,4]],[90,270,[1,1,1]],[250,380,[1,1,1]]]);const preserved=JSON.stringify(s.bodies);bbReplenish(s,()=>.5);assert.equal(JSON.stringify(s.bodies.slice(0,5)),preserved);assert(s.bodies.filter(b=>b.sum>0).length>=6);assert(s.bodies.reduce((n,b)=>n+(b.sum?b.parts.length:0),0)<=18);assert(bbCanTen(s));
console.log('PASS: 12-ball starts, roles, 15-point win, bonus turn cap for both players, handover-only refill, density limits;  compound collisions, movement after joining, steals, over-ten bounce, 24-shot stability, pause, replenishment, match end, AI scoring and non-mutation.');
