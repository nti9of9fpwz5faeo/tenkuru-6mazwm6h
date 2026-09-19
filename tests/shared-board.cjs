const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {engine}=require('./rush-mode.cjs');
const e=engine();
vm.runInContext(fs.readFileSync(path.join(__dirname,'../shared-board.js'),'utf8')+'\nthis.sharedApi={SHARED_CFG,sharedCreate,sharedNeighbor,sharedDistance,sharedMove,sharedPlay,sharedRefill,sharedTick,sharedAiTarget};',e.context);
const {sharedCreate:create,sharedNeighbor:neighbor,sharedDistance:distance,sharedMove:move,sharedPlay:play,sharedRefill:refill,sharedTick:tick,sharedAiTarget:target}=e.context.sharedApi;
function fresh(){const s=create(()=>.3);s.phase='active';return s;}
function field(s,values){s.field=values.map(value=>({value,by:'dealer'}));s.sum=values.reduce((a,b)=>a+b,0);}
// Both players travel along the same grid at the same pace, including empty cells.
for(const who of ['player','dealer']){
 const s=fresh();s.cursor[who]=0;s.board[1]=null;
 assert.equal(move(s,who,'left'),false);assert.equal(move(s,who,'up'),false);
 assert.equal(move(s,who,'right'),true);assert.equal(s.cursor[who],1);
 assert.equal(move(s,who,'down'),false);assert.equal(play(s,who),false);
 tick(s,159,()=>.5,false);assert.equal(move(s,who,'down'),false);
 tick(s,1,()=>.5,false);assert.equal(move(s,who,'down'),true);assert.equal(s.cursor[who],5);
}
assert.equal(neighbor(3,'right'),3);assert.equal(neighbor(12,'left'),12);assert.equal(neighbor(15,'down'),15);
// One shared card is acquired only once, irrespective of player order.
for(const first of ['player','dealer']){
 const s=fresh(),second=first==='player'?'dealer':'player';s.cursor={player:5,dealer:5};s.board[5]=4;
 assert.equal(play(s,first),true);assert.equal(play(s,second),false);assert.equal(s.sum,4);assert.equal(s.field.length,1);assert.equal(s.board[5],null);
}
// Last card receives the role's exact points; no second scoring during resolution.
for(const [values,last,points] of [[[5],5,1],[[4,3],3,2],[[2,2,3],3,3],[[2,2,2],4,4],[[1,2,3],4,5]]){
 const s=fresh();field(s,values);s.board[s.cursor.player]=last;
 assert.equal(play(s,'player'),true);assert.equal(s.score.player,points);assert.equal(s.score.dealer,0);assert.equal(s.phase,'settling');
 assert.equal(play(s,'dealer'),false);assert.equal(play(s,'player'),false);
 const before=Array.from(s.board),cursors=JSON.stringify(s.cursor),epoch=s.epoch;
 tick(s,1099,()=>.8,false);assert.equal(s.phase,'settling');
 tick(s,1,()=>.8,false);assert.equal(s.phase,'active');assert.equal(s.sum,0);assert.equal(s.left,10000);
 before.forEach((v,i)=>assert.equal(s.board[i],v==null?5:v));assert.equal(JSON.stringify(s.cursor),cursors);
 s.now+=200;assert.equal(play(s,'dealer',epoch),false,'old-round input cannot consume a replacement');
}
// Movement cannot be bypassed by confirm; a winning round ends the match once.
{
 const s=fresh();s.board[14]=5;field(s,[5]);s.score.player=9;
 assert.equal(move(s,'player','right'),true);assert.equal(play(s,'player'),false);
 tick(s,160,()=>.5,false);assert.equal(play(s,'player'),true);assert.equal(s.phase,'ended');assert.equal(s.winner,'player');
 const snapshot=JSON.stringify(s);tick(s,10000);assert.equal(JSON.stringify(s),snapshot);assert.equal(play(s,'dealer'),false);
}
// Pause freezes movement, scoring, timer and resolution; timeout cannot score.
{
 const s=fresh();s.paused=true;const snapshot=JSON.stringify(s);
 tick(s,50000);assert.equal(move(s,'player','up'),false);assert.equal(play(s,'player'),false);assert.equal(JSON.stringify(s),snapshot);
 s.paused=false;tick(s,10000,()=>.5,false);assert.equal(s.phase,'settling');assert.equal(play(s,'player'),false);
 s.paused=true;tick(s,50000);assert.equal(s.phase,'settling');s.paused=false;tick(s,1100,()=>.5,false);assert.equal(s.round,2);
}
// Existing legal-card constraints and burst penalty; sudden opponent play is protected.
{
 const s=fresh();field(s,[1,1]);s.board[s.cursor.player]=1;assert.equal(play(s,'player'),false);
 field(s,[4,3]);s.board[s.cursor.player]=5;s.score.player=3;s.lastPlay={by:'dealer',at:s.now};
 assert.equal(play(s,'player'),false);assert.equal(s.board[s.cursor.player],5);
 s.now+=220;assert.equal(play(s,'player'),true);assert.equal(s.score.player,1);assert.equal(s.phase,'settling');
}
// A blocked board resets instead of leaving both players stuck.
{
 const s=fresh();s.board=Array(16).fill(5);s.board[s.cursor.player]=4;field(s,[4]);
 play(s,'player');assert.equal(s.phase,'settling');assert.match(s.feedback,/出せる札がない/);
}
// AI pursues the 10, physically travels and reconsiders when its card is taken.
{
 const s=fresh();s.board=Array(16).fill(5);s.board[15]=2;field(s,[5,3]);s.cursor.dealer=0;
 assert.equal(target(s),15);tick(s,1);assert.equal(s.cursor.dealer,1);assert.equal(s.board[15],2);
 let last=s.cursor.dealer;
 for(let i=0;i<7;i++){tick(s,160);assert.ok(distance(last,s.cursor.dealer)<=1);last=s.cursor.dealer;}
 assert.equal(s.score.dealer,1);assert.equal(s.board[15],null);
 const t=fresh();t.board=Array(16).fill(5);t.board[15]=2;field(t,[5,3]);t.cursor.dealer=0;t.cursor.player=15;
 tick(t,1);play(t,'player');const pos=t.cursor.dealer;tick(t,160);assert.equal(t.cursor.dealer,pos);assert.equal(t.score.dealer,0);
}
// Long seeded matches progress without illegal cursor jumps or corrupted cards.
{
 let seed=42;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
 const s=create(random);s.phase='active';
 for(let i=0;i<10000&&s.phase!=='ended';i++){
  const before=s.cursor.dealer;tick(s,32,random);assert.ok(distance(before,s.cursor.dealer)<=1);
  if(s.phase==='active'&&i%7===0){move(s,'player',['up','down','left','right'][Math.floor(random()*4)]);}
  if(s.phase==='active'&&i%11===0&&s.board[s.cursor.player]+s.sum<=10)play(s,'player');
  assert.equal(s.board.length,16);assert.ok(s.board.every(v=>v==null||Number.isInteger(v)&&v>=1&&v<=5));
  assert.equal(s.sum,s.field.reduce((n,c)=>n+c.value,0));
 }
 assert.equal(s.phase,'ended','AI can finish a match without the player opening every field');
}
console.log('Shared board: acquisition races, scoring, refill, timing, pause, navigation and AI passed.');
