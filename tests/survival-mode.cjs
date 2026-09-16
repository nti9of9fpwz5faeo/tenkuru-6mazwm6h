const assert=require('node:assert/strict');
const {engine}=require('./rush-mode.cjs');
const walk=(x,out=[])=>{if(x&&typeof x==='object'){out.push(x);(x.children||[]).flat(Infinity).forEach(y=>walk(y,out));}return out;};
const alive=e=>e.app.pHR.current.filter(v=>v!=null).length;
function start(ai=false){const e=engine({ai});e.app.startSurvivalBattle('normal');while(e.app.countNumR.current>=0)e.clock.advance(1);return e;}
const roles=[[[5,5],0,1],[[1,4,5],0,1],[[2,2,1,5],1,2],[[2,2,3,3],2,3],[[1,3,3,3],3,4],[[4,1,2,3],4,5]];
for(const who of ['player','dealer'])for(const [cards,refill,pts] of roles){
 const e=start();e.app.dealPlayer([1,2,...Array(8).fill(null)]);e.app.setDealer([1,2]);
 const deadline=e.app.rushDeadlineR.current;e.app.completeTen(cards,who,1);
 assert.equal(who==='player'?alive(e):e.app.dHR.current.length,2+refill);
 assert.equal(who==='player'?e.app.pPtR.current:e.app.dPtR.current,pts);
 assert.equal(who==='player'?e.app.dHR.current.length:alive(e),2,'only finisher refills');
 e.app.completeTen(cards,who,1);assert.equal(who==='player'?e.app.pPtR.current:e.app.dPtR.current,pts,'duplicate completion ignored');
 e.clock.advance(250);assert.equal(e.app.rushDeadlineR.current,deadline);assert.equal(e.app.fieldR.current.length,0);assert.equal(e.app.rnR.current,1);
}
// Cap applies to both sides at all near-full counts; existing slots survive.
for(const who of ['player','dealer'])for(const n of [7,8,9,10]){
 const e=start();const hand=Array(n).fill(2);e.app.dealPlayer([...hand,...Array(10-n).fill(null)]);e.app.setDealer(hand);
 e.app.completeTen([1,2,3,4],who,1);assert.equal(who==='player'?alive(e):e.app.dHR.current.length,10);
 const notice=walk(e.render()).find(n=>n.props.className==='survival-reward');assert.ok(JSON.stringify(notice).includes((10-n)+'枚補充'));
}
// Actual final player tap resolves role reward BEFORE empty-hand defeat.
{
 const e=start();e.app.dealPlayer([4,...Array(9).fill(null)]);e.app.resolvePlay(3,[1,2],3,'dealer',1);e.app.playCard(0);
 assert.equal(e.app.phaseR.current,'playing');assert.equal(alive(e),4);assert.equal(e.app.pPtR.current,5);
 const tree=e.render();const news=walk(tree).filter(n=>n.type===e.api.SlideCard&&n.props.newRefill);assert.equal(news.length,4);
}
for(const cause of ['no-role','incomplete','burst']){
 const e=start();e.app.pPtR.current=99;e.app.dealPlayer([5,...Array(9).fill(null)]);
 if(cause==='no-role')e.app.resolvePlay(5,[],0,'dealer',1);
 if(cause==='burst')e.app.resolvePlay(4,[3],3,'dealer',1);
 e.app.playCard(0);assert.equal(e.app.phaseR.current,'gameEnd');assert.equal(alive(e),0);
 const data=e.render().props.data;assert.equal(data.winner,'dealer');assert.equal(data.survival.reason,'empty');
 if(cause==='no-role')assert.equal(data.pPt,100,'roleless completion still scores');
 if(cause==='burst')assert.equal(data.dPt,1);
 e.clock.advance(2000);assert.equal(e.app.phaseR.current,'gameEnd');assert.equal(alive(e),0,'no delayed free refill');
}
// Last dealer card is alive in flight; roles save it after landing, roleless does not.
for(const role of [true,false]){
 const e=start();e.app.setDealer([role?4:5]);
 if(role)e.app.resolvePlay(3,[1,2],3,'player',1);else e.app.resolvePlay(5,[],0,'player',1);
 e.app.commitDealerPlay({id:e.app.dIdsR.current[0],value:role?4:5},1);
 assert.equal(e.app.dHR.current.length,0);assert.equal(e.app.checkSurvivalEmpty(),false);assert.ok(e.app.flyR.current);
 e.clock.advance(350);
 if(role){assert.equal(e.app.dHR.current.length,4);assert.equal(e.app.dPtR.current,5);assert.equal(e.app.phaseR.current,'playing');}
 else{assert.equal(e.app.dHR.current.length,0);assert.equal(e.render().props.data.winner,'player');assert.equal(e.app.dPtR.current,1);}
}
// An opponent flight returned by the player's completion is retained exactly once.
{
 const e=start();e.app.setDealer([5]);const id=e.app.dIdsR.current[0];e.app.commitDealerPlay({id,value:5},1);
 e.app.completeTen([1,2,3,4],'player',1);assert.equal(e.app.dHR.current.length,1);assert.equal(e.app.dIdsR.current[0],id);
 e.clock.advance(500);assert.equal(e.app.dHR.current.length,1);assert.equal(e.app.dPtR.current,0);
}
// No energy consumption/regeneration, no 20-point early victory; exact deadline rejects late score.
{
 const e=start();const energy=JSON.stringify(e.app.chargeR.current),save=JSON.stringify(e.app.saveR.current);
 e.app.pPtR.current=22;e.clock.advance(3000);assert.equal(e.app.phaseR.current,'playing');assert.equal(JSON.stringify(e.app.chargeR.current),energy);
 e.clock.jump(57000);e.app.completeTen([1,2,3,4],'dealer',1);assert.equal(e.app.dPtR.current,0);
 assert.equal(e.render().props.data.winner,'player');assert.equal(JSON.stringify(e.app.saveR.current),save);
 for(const [p,d,w] of [[0,0,'draw'],[3,7,'dealer']]){const x=start();x.app.pPtR.current=p;x.app.dPtR.current=d;x.clock.advance(60000);assert.equal(x.render().props.data.winner,w);}
}
// Deadlock clears board only: no free cards, score, or match-time reset.
{
 const e=start();e.app.dealPlayer([3,5,1,...Array(7).fill(null)]);e.app.setDealer([1,5]);e.app.resolvePlay(5,[2,1],3,'dealer',1);
 const p=JSON.stringify(e.app.pHR.current),d=JSON.stringify(e.app.dHR.current),deadline=e.app.rushDeadlineR.current;
 e.clock.advance(1000);assert.equal(e.app.fieldR.current.length,0);assert.equal(JSON.stringify(e.app.pHR.current),p);assert.equal(JSON.stringify(e.app.dHR.current),d);assert.equal(e.app.rushDeadlineR.current,deadline);
}
// Home, rules dialog pauses clock, resume, retry, and leave cancel pending work.
{
 const e=start();const tree=e.render();assert.ok(tree.props.className.includes('survival-playing'));
 assert.equal(walk(tree).filter(n=>n.type===e.api.ChargeMeter||n.type===e.api.VictoryMeter).length,0);
 let clicked=0;const home=e.api.TitleScreen({onSurvival:()=>clicked++});walk(home).find(n=>n.type==='button'&&n.children[0]==='役サバイバル').props.onClick();assert.equal(clicked,1);
 walk(tree).find(n=>n.type==='button'&&n.children[0]==='役一覧 ⓘ').props.onClick();assert.equal(e.app.pausedR.current,true);
 const before=e.app.timeLeftR.current;e.clock.advance(10000);assert.equal(e.app.timeLeftR.current,before);
 walk(e.render()).find(n=>n.type==='button'&&n.children[0]==='閉じて再開').props.onClick();assert.equal(e.app.pausedR.current,false);
 e.clock.advance(1000);assert.equal(e.app.timeLeftR.current,before-1);
 e.app.finishSurvivalMatch();const result=e.render();result.props.onRetry();assert.equal(alive(e),10);assert.equal(e.app.dHR.current.length,10);assert.equal(e.app.pPtR.current,0);
 e.app.goHome();e.clock.advance(8000);assert.equal(e.app.phaseR.current,'survival');assert.equal(e.app.stageOptsR.current,null);
}
// CPU actually plays this mode without charge; whole match terminates without growing hands.
{
 const e=start(true);let moved=false;
 for(let i=0;i<600&&e.app.phaseR.current==='playing';i++){e.clock.advance(100);if(e.app.dHR.current.length<10)moved=true;assert.ok(alive(e)<=10);assert.ok(e.app.dHR.current.length+(e.app.flyR.current?1:0)<=10);}
 assert.ok(moved);assert.equal(e.app.phaseR.current,'gameEnd');
}
console.log('PASS: survival role scores/refills for both sides; cap 10; actual last-card saves/defeats; flights/returns; no free refill/energy/lead victory; 60s/ties; deadlock; home/help/pause/retry; CPU and unchanged saves.');
