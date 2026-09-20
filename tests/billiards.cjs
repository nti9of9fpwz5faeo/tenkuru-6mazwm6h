const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8'),source=html.split('// ── BILLIARDS ENGINE v306 ──')[1].split('// ── END BILLIARDS ENGINE ──')[0],ctx={Math,performance};vm.createContext(ctx);
vm.runInContext(html.slice(html.indexOf('function calcPts(cards){'),html.indexOf('// v286: normal battles'))+source+';this.api={BB_CFG,bbRole,bbBody,bbPoints,bbCreate,bbStart,bbShoot,bbPhysics,bbStep,bbJoin,bbBreak,bbFollowingPlayer,bbPlace,bbValidPlacement,bbPlacementOptions,bbChoosePlacement,bbCandidates,bbEvaluate,bbRay};',ctx);
const {BB_CFG,bbRole,bbBody,bbPoints,bbCreate,bbStart,bbShoot,bbPhysics,bbStep,bbJoin,bbBreak,bbFollowingPlayer,bbPlace,bbValidPlacement,bbPlacementOptions,bbChoosePlacement,bbCandidates,bbEvaluate,bbRay}=ctx.api;
function game(parts){const s=bbCreate('normal',()=>.5);s.bodies=parts.map((b,i)=>bbBody(i+1,b[0],b[1],b[2].map((n,j)=>({x:j*40,y:0,n}))));s.nextId=100;bbStart(s);return s;}
function settle(s){for(let i=0;i<1300&&s.moving;i++)bbStep(s);assert.equal(s.moving,false);}
function placeAll(s){const who=s.placer;while(s.placing){const p=bbChoosePlacement(s,()=>.5);assert(p);assert(bbPlace(s,who,p.x,p.y));}}
function numbers(s){return [...s.bodies.flatMap(b=>b.parts.filter(p=>p.n).map(p=>p.n)),...s.returnBalls].sort((a,b)=>a-b);}
// Every initial board has exactly twelve separate numbers and one cue, without contact.
for(let seed=1;seed<=20;seed++){let x=seed;const rng=()=>((x=(x*1664525+1013904223)>>>0)/4294967296),s=bbCreate('normal',rng);assert.equal(s.bodies.length,13);assert(s.bodies.every(b=>b.parts.length===1));assert.equal(s.bodies.filter(b=>b.sum===0).length,1);assert.equal(s.bodies.reduce((n,b)=>n+b.sum,0),34);for(let i=0;i<13;i++)for(let j=i+1;j<13;j++)assert(Math.hypot(s.bodies[i].x-s.bodies[j].x,s.bodies[i].y-s.bodies[j].y)>46);}
// A white-ball contact breaks the ENTIRE rotated cluster, retaining every number.
let s=game([[220,530,[0]],[180,380,[3,2,4]]]);const original=numbers(s);assert(bbShoot(s,-Math.PI/2,.55));for(let i=0;i<500&&!s.events.some(e=>e.kind==='break');i++)bbStep(s);assert(s.events.some(e=>e.kind==='break'));assert.equal(s.bodies.length,4);assert(s.bodies.every(b=>b.parts.length===1));assert.deepEqual(numbers(s),original);assert.equal(s.scores[0],0);
for(let i=0;i<35;i++)bbStep(s);assert(s.bodies.every(b=>b.parts.length===1),'immediate rejoin after breaking');settle(s);assert.deepEqual(numbers(s),original);
s=game([[50,600,[0]],[180,260,[1,2,3]]]);s.bodies[1].a=.7;const before=bbPoints(s.bodies[1]);const pieces=bbBreak(s,s.bodies[1]);for(let i=0;i<3;i++){assert.equal(pieces[i].x,before[i].x);assert.equal(pieces[i].y,before[i].y);assert.equal(pieces[i].parts[0].n,before[i].n);}
// A numbered ball can still complete an intact opponent-built cluster (white stays separate).
s=game([[220,530,[0]],[220,390,[1]],[180,260,[3,2,4]]]);s.turn=1;assert(bbShoot(s,-Math.PI/2,.8));settle(s);assert.deepEqual(Array.from(s.scores),[0,5]);assert.equal(s.placing,true);assert.equal(s.placer,0);assert.deepEqual(Array.from(s.returnBalls).sort(),[1,2,3,4]);assert(!bbShoot(s,0,1));
// Placement refuses the wrong side, overlap, edges, NaN and paused/stale input.
let p=bbPlacementOptions(s)[0],snapshot=JSON.stringify(s);assert(!bbPlace(s,1,p.x,p.y));assert(!bbPlace(s,0,-2,p.y));assert(!bbPlace(s,0,NaN,p.y));assert(!bbPlace(s,0,s.bodies[0].x,s.bodies[0].y));assert.equal(JSON.stringify(s),snapshot);
s.paused=true;assert(!bbPlace(s,0,p.x,p.y));const frozen=JSON.stringify(s);for(let i=0;i<100;i++)bbStep(s);assert.equal(JSON.stringify(s),frozen);s.paused=false;
const survivors=JSON.stringify(s.bodies),inventory=numbers(s);assert(bbPlace(s,0,p.x,p.y));assert(!bbPlace(s,0,p.x,p.y));assert.equal(s.returnBalls.length,3);assert.equal(s.shots,1);assert.equal(s.turn,1);assert.equal(s.placing,true);assert.equal(JSON.stringify(s.bodies.slice(0,1)),survivors);placeAll(s);assert.deepEqual(numbers(s),inventory);assert.equal(s.turn,1);assert.equal(s.shots,1);assert.equal(s.events.filter(e=>e.kind==='bonus').length,1);
// All five ranks receive the correct points. BOTH players get an extra shot for 5+5 too.
for(const [values,points,label]of [[[5,5],1,'役なし'],[[1,1,3,5],2,'ワンペア'],[[2,2,3,3],3,'ツーペア'],[[1,3,3,3],4,'スリーカード'],[[1,2,3,4],5,'ストレート']]){const role=bbRole(values);assert.equal(role.points,points);assert.equal(role.label,label);for(const who of [0,1]){
 s=game([[220,600,[0]],[80,100,[values[0]]],[180,100,values.slice(1)]]);s.turn=who;const all=numbers(s);bbShoot(s,Math.PI/2,.08);bbJoin(s,s.bodies[1],s.bodies[2]);settle(s);assert.equal(s.placer,1-who);assert.equal(s.returnBalls.length,values.length);assert.equal(s.scores[who],points);assert.equal(s.events.filter(e=>e.kind==='bonus').length,0);placeAll(s);assert.equal(s.turn,who);assert.equal(s.shots,1);assert.deepEqual(numbers(s),all);assert.equal(s.events.filter(e=>e.kind==='bonus').length,1);
 // A second ten still retains the same player, with placement by the next shooter's opponent.
 s.bodies=[s.bodies[0],bbBody(300,80,100,[{x:0,y:0,n:values[0]}]),bbBody(301,180,100,values.slice(1).map((n,i)=>({x:i*40,y:0,n})))];
 bbShoot(s,Math.PI/2,.08);bbJoin(s,s.bodies[1],s.bodies[2]);settle(s);assert.equal(s.placer,1-who);assert.equal(s.nextShooter,who);assert.notEqual(s.placer,s.nextShooter);placeAll(s);assert.equal(s.turn,who);assert.equal(s.shots,2);assert.equal(s.scores[who],points*2);assert.equal(s.events.filter(e=>e.kind==='bonus').length,2);
}}
// Long no-role streaks retain both players through shot 8, then a miss hands over.
for(const who of [0,1]){s=game([[220,600,[0]],[80,100,[5]],[150,100,[5]]]);s.turn=who;
 for(let shot=1;shot<=8;shot++){s.bodies=[bbBody(1,220,600,[{x:0,y:0,n:0}]),bbBody(2,80,100,[{x:0,y:0,n:5}]),bbBody(3,150,100,[{x:0,y:0,n:5}])];bbShoot(s,Math.PI/2,.08);bbJoin(s,s.bodies[1],s.bodies[2]);settle(s);assert.equal(s.nextShooter,who);assert.equal(s.placer,1-who);const p=bbPlacementOptions(s)[0];assert(!bbPlace(s,who,p.x,p.y));placeAll(s);assert.equal(s.turn,who);assert.equal(s.shots,shot);assert.equal(s.scores[who],shot);}
 s.bodies=[bbBody(1,220,600,[{x:0,y:0,n:0}]),bbBody(2,80,100,[{x:0,y:0,n:1}])];bbShoot(s,Math.PI/2,.08);settle(s);assert.equal(s.turn,1-who);assert.equal(s.shots,0);
}
// Placement ownership follows the computed NEXT player, even for a handover with a pending return.
for(const who of [0,1]){s=game([[220,600,[0]]]);s.turn=who;s.returnBalls=[1];bbShoot(s,Math.PI/2,.08);settle(s);assert.equal(s.nextShooter,1-who);assert.equal(s.placer,who);placeAll(s);assert.equal(s.turn,1-who);assert.equal(s.shots,0);}
// Multiple tens in one shot all return to the opposing placer, with just one bonus shot.
s=game([[220,600,[0]],[80,100,[5]],[150,100,[5]],[80,260,[1]],[150,260,[3,3,3]]]);const multi=numbers(s);bbShoot(s,Math.PI/2,.08);bbJoin(s,s.bodies[1],s.bodies[2]);bbJoin(s,s.bodies[1],s.bodies[2]);settle(s);assert.equal(s.returnBalls.length,6);assert.equal(s.scores[0],5);placeAll(s);assert.equal(s.events.filter(e=>e.kind==='bonus').length,1);assert.deepEqual(numbers(s),multi);
// Numeric >10 contact bounces rather than joining. White does not contact this cluster.
s=game([[400,650,[0]],[100,100,[4,4]],[100,141,[3]]]);s.bodies[2].vy=-100;for(let i=0;i<5;i++)bbPhysics(s,BB_CFG.step);assert.equal(s.bodies.length,3);assert.equal(s.merged,0);assert.equal(s.scores[0],0);
// No ten means ordinary handover without arbitrary new balls.
s=game([[220,600,[0]],[70,60,[1]],[300,70,[2]]]);const unchanged=numbers(s);bbShoot(s,Math.PI/2,.08);settle(s);assert.equal(s.turn,1);assert.equal(s.placing,false);assert.deepEqual(numbers(s),unchanged);
// Winning ten ends at 15 without forcing a placement phase or a bonus input.
s=game([[220,600,[0]],[80,100,[5]],[150,100,[5]]]);s.scores[0]=14;bbShoot(s,Math.PI/2,.08);bbJoin(s,s.bodies[1],s.bodies[2]);assert.equal(s.phase,'ended');assert.equal(s.scores[0],15);assert(!bbShoot(s,0,1));assert(!bbPlace(s,1,100,300));
// AI planning uses the same break rules and cannot mutate live state.
s=game([[220,530,[0]],[220,390,[5]],[220,260,[5]]]);s.turn=1;snapshot=JSON.stringify(s);let best=-Infinity;for(const c of bbCandidates(s).slice(0,60))best=Math.max(best,bbEvaluate(s,c));assert(best>=200);assert.equal(JSON.stringify(s),snapshot);assert(bbRay(s,-Math.PI/2)<140);
// Repeated real shots/placements conserve all 12 numbers; boundaries and finite physics hold.
s=bbCreate('normal',()=>.5);bbStart(s);const twelve=numbers(s);for(let shot=0;shot<35;shot++){assert(bbShoot(s,shot*2.399,.6+(shot%3)*.2));settle(s);assert.deepEqual(numbers(s),twelve);if(s.phase==='ended')break;placeAll(s);for(const b of s.bodies)for(const p of bbPoints(b)){assert(Number.isFinite(p.x)&&Number.isFinite(p.y));assert(p.x>=19&&p.x<=421,JSON.stringify(p));assert(p.y>=19&&p.y<=s.h-19,JSON.stringify(p));}assert.deepEqual(numbers(s),twelve);}
console.log('PASS: cue breaks all components, no instant rejoin, numeric completion, both placers, invalid/pause guards, all-role bonuses including 5+5, unlimited streaks, next-shooter-based placement, multi-ten queue, no auto-refill, win, AI, 35-shot conservation and stability.');
