const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const evaluate=html.slice(html.indexOf('function calcPts(cards){'),html.indexOf('// v286: normal battles'));
const source=html.slice(html.indexOf('const CR_CFG='),html.indexOf('function crAudio(){'));
const context=vm.createContext({});vm.runInContext(evaluate+source+'\nthis.api={CR_CFG,crCreate,crStart,crPlay,crUndo,crAdvance,crAiChoice,crCombinations,crRefill};',context);
const a=context.api;let seed=81623;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
function game(level='normal'){const s=a.crCreate(level,random);a.crStart(s);return s;}
function cards(s,values){s.player.hand=[...values,...Array(10-values.length).fill(null)];s.player.field=[];s.player.readyAt=0;s.player.nextTap=0;}
function playAll(s,values){cards(s,values);values.forEach((_,i)=>{assert.equal(a.crPlay(s,'player',i),true);if(s.phase==='active')a.crAdvance(s,120,random,false);});}
for(const [values,gain] of [[[5,5],4],[[1,1,3,5],7],[[2,2,3,3],10],[[1,3,3,3],14],[[1,2,3,4],18]]){
 const s=game();playAll(s,values);assert.equal(s.blue,50+gain);assert.equal(s.player.ten,1);assert.equal(a.crPlay(s,'player',0),false);
 a.crAdvance(s,800,random,false);assert.equal(s.player.field.length,0);assert.equal(s.player.hand.filter(Boolean).length,10);assert.ok(a.crCombinations(s.player.hand).length);
 assert.equal(s.events.filter(x=>x.kind==='paint').length,1);
}
// Invalid indices never consume a card; undo preserves the original slot and value.
{
 const s=game();cards(s,[5,4,3,1]);assert.ok(a.crPlay(s,'player',0));a.crAdvance(s,120,random,false);assert.ok(a.crPlay(s,'player',1));a.crAdvance(s,120,random,false);
 const before=JSON.stringify(s);assert.equal(a.crPlay(s,'player',99),false);assert.equal(JSON.stringify(s),before);
 assert.ok(a.crUndo(s,0));assert.equal(s.player.hand[0],5);assert.equal(s.player.field[0].value,4);assert.equal(a.crUndo(s,0),false);
 s.paused=true;const paused=JSON.stringify(s);a.crAdvance(s,60000,random);a.crPlay(s,'player',3);a.crUndo(s,1);assert.equal(JSON.stringify(s),paused);
}
// Completing a ten does not refill the used slots while any original cards remain.
for(const who of ['player','dealer']){
 const s=game(),side=s[who];side.hand=[1,2,3,4,5,5,4,3,2,1];
 for(const i of [0,1,2,3]){assert.ok(a.crPlay(s,who,i,random));a.crAdvance(s,120,random,false);}
 a.crAdvance(s,800,random,false);assert.equal(side.hand.filter(Boolean).length,6);assert.equal(side.deals,1);assert.equal(side.field.length,0);
 assert.deepEqual(Array.from(side.hand.slice(4)),[5,5,4,3,2,1]);
 // Spend the other six across two tens, then replenish exactly once.
 for(const group of [[4,5],[6,7,8,9]]){for(const i of group){assert.ok(a.crPlay(s,who,i,random));a.crAdvance(s,120,random,false);}a.crAdvance(s,800,random,false);}
 assert.equal(side.hand.filter(Boolean).length,10);assert.equal(side.deals,2);
}
// No old third/fourth-card restriction: the card is spent and a doomed field clears.
for(const values of [[1,1,1,5,4,3,2,2,4,5],[1,1,2,5,4,3,2,3,4,5]]){
 const s=game();cards(s,values);for(const i of [0,1,2]){assert.ok(a.crPlay(s,'player',i,random));a.crAdvance(s,120,random,false);}
 assert.equal(s.player.field.length,0);assert.equal(s.player.hand.filter(Boolean).length,7);assert.equal(s.blue,50);assert.equal(s.events.at(-1).kind,'reset');
}
{
 const s=game();cards(s,[1,1,3,4,5,4,3,2,2,5]);
 for(const i of [0,1,2]){assert.ok(a.crPlay(s,'player',i,random));a.crAdvance(s,120,random,false);}assert.equal(s.player.field.length,3);
 assert.ok(a.crPlay(s,'player',3,random));assert.equal(s.player.field.length,0);assert.equal(s.player.hand[3],null);assert.equal(s.events.at(-1).sum,9);
}
// Search actual remaining values, not just whether the numeric gap is 1–5.
{
 const s=game();cards(s,[4,4,4]);assert.ok(a.crPlay(s,'player',0,random));assert.equal(s.player.field.length,0);assert.equal(s.player.hand.filter(Boolean).length,2);
 a.crAdvance(s,120,random,false);assert.ok(a.crPlay(s,'player',1,random));a.crAdvance(s,120,random,false);assert.ok(a.crPlay(s,'player',2,random));
 assert.equal(s.player.hand.filter(Boolean).length,10);assert.equal(s.player.deals,2);assert.equal(s.player.field.length,0);assert.equal(s.blue,50);
}
// Over-ten taps also land, then reset; no points or hidden refunds.
{
 const s=game();cards(s,[5,4,3,1]);for(const i of [0,1]){assert.ok(a.crPlay(s,'player',i,random));a.crAdvance(s,120,random,false);}
 assert.ok(a.crPlay(s,'player',2,random));assert.equal(s.player.field.length,0);assert.equal(s.player.hand.filter(Boolean).length,1);assert.equal(s.blue,50);
}
// AI consumes impossible leftovers rather than stalling; both sides use the same rule.
{
 const s=game('hard');s.dealer.hand=[2,null,null,null,null,null,null,null,null,null];
 a.crAdvance(s,3000,random);assert.ok(s.dealer.deals>=2);assert.ok(s.dealer.hand.some(Boolean));
}

// Independent fields, fair AI and immediate terminal state; no post-win simulation.
{
 const s=game('hard');s.dealer.field=[{index:0,value:3}];s.dealer.hand[0]=null;
 playAll(s,[1,2,3,4]);assert.equal(s.dealer.field.length,1);
 const first=a.crAiChoice(s,()=>0);s.player.hand=Array(10).fill(5);assert.equal(a.crAiChoice(s,()=>0),first);
 s.blue=96;playAll(s,[5,5]);assert.equal(s.phase,'ended');assert.equal(s.winner,'player');assert.equal(s.blue,100);const end=JSON.stringify(s);a.crAdvance(s,99999,random);assert.equal(JSON.stringify(s),end);
 const d=game();d.blue=4;d.dealer.hand=[5,5,...Array(8).fill(null)];assert.ok(a.crPlay(d,'dealer',0));a.crAdvance(d,120,random,false);assert.ok(a.crPlay(d,'dealer',1));assert.equal(d.winner,'dealer');assert.equal(d.blue,0);
}
// Every possible legal hand composition has a reachable 10; refills respect the cap.
let checked=0;
for(let n=0;n<1024;n++){let v=n,hand=[];for(let i=1;i<=5;i++){const count=v%4;v=Math.floor(v/4);hand.push(...Array(count).fill(i));}if(hand.length!==10)continue;assert.ok(a.crCombinations(hand).length);checked++;}
for(let i=0;i<300;i++){const hand=a.crRefill(Array(10).fill(null),random);for(let v=1;v<=5;v++)assert.ok(hand.filter(x=>x===v).length<=3);}
// Seeded simulation verifies three measurably distinct CPU strengths without private input.
const stats={};
for(const level of ['easy','normal','hard']){let total=0,paint=0;
 for(let run=0;run<40;run++){const s=game(level);for(let t=0;t<60000;t+=50){a.crAdvance(s,50,random);s.blue=50;}total+=s.dealer.ten;paint+=s.events.filter(e=>e.kind==='paint').reduce((n,e)=>n+e.gain,0);}
 stats[level]={tenPerMinute:total/40};
}
assert.ok(stats.hard.tenPerMinute>stats.normal.tenPerMinute*1.25);assert.ok(stats.normal.tenPerMinute>stats.easy.tenPerMinute*1.25);
console.log('PASS: role paint amounts, cap/refill, invalid taps, undo, pause, independent fields, private AI, both victories, '+checked+' hand compositions.',stats);
