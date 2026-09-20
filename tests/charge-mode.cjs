// Exercise the shipped game functions with the same deterministic offline harness.
const assert=require('node:assert/strict');
const {engine}=require('./rush-mode.cjs');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function start(){const e=engine();e.app.startChargeBattle('hard');while(e.app.countNumR.current>=0)e.clock.advance(1);return e;}
const walk=(x,out=[])=>{if(x&&typeof x==='object'){out.push(x);(x.children||[]).flat(Infinity).forEach(y=>walk(y,out));}return out;};
{
 const e=engine();let clicked=0;
 walk(e.api.TitleScreen({onCharge:()=>clicked++})).find(n=>n.children[0]==='60秒チャージ').props.onClick();
 walk(e.api.ChargeScreen({onBattle:d=>{assert.equal(d,'normal');clicked++;}})).find(n=>n.children[0]==='チャレンジする').props.onClick();assert.equal(clicked,2);
 for(const who of ['player','dealer']){const meter=e.api.ChargeMeter({who,value:2.5});assert.equal(meter.props.role,'meter');assert.equal(meter.props['aria-valuenow'],2.5);}
 for(const winner of ['player','dealer','draw']){const t=e.api.ChargeResult({data:{winner,pPt:5,dPt:3,charge:{tens:2,bursts:1}},onRetry:()=>clicked++,onBack:()=>clicked++});const buttons=walk(t).filter(n=>n.type==='button');buttons.forEach(n=>n.props.onClick());}assert.equal(clicked,8);
 assert.equal(e.api.chargeStage('hard').rush,false);assert.equal(e.api.chargeStage('hard').charge,true);
}
// Countdown cannot replenish energy; each side starts with precisely two cards.
{
 const e=start();near(e.app.chargeR.current.player,2);near(e.app.chargeR.current.dealer,2);near(e.app.timeLeftR.current,60);
 e.app.dealPlayer([2,2,3,3]);e.app.playCard(0);e.app.playCard(1);e.app.playCard(2);
 assert.equal(e.app.fieldR.current.join(','),'2,2');assert.equal(e.app.pHR.current[2],3);near(e.app.chargeR.current.player,0);
 e.clock.advance(1499);e.app.playCard(2);assert.equal(e.app.fieldR.current.length,2);
 e.clock.advance(1);e.app.playCard(2);assert.equal(e.app.fieldR.current.join(','),'2,2,3');near(e.app.chargeR.current.player,0);near(e.app.chargeR.current.dealer,3);
 e.clock.advance(6000);near(e.app.chargeR.current.player,4);near(e.app.chargeR.current.dealer,4);
 e.app.playCard(3);assert.equal(e.app.pPtR.current,3);near(e.app.chargeR.current.player,3);assert.equal(e.app.pHR.current.filter(v=>v!==null).length,10);
 const deadline=e.app.rushDeadlineR.current;e.clock.advance(200);assert.equal(e.app.rushDeadlineR.current,deadline);assert.equal(e.app.rnR.current,1);
}
// Invalid taps and empty slots never cost energy; overflow at maximum is discarded.
{
 const e=start();e.app.dealPlayer([1,1,1,null]);e.app.playCard(0);e.app.playCard(1);e.clock.advance(3000);const before=e.app.chargeR.current.player;
 e.app.playCard(2);e.app.playCard(3);near(e.app.chargeR.current.player,before);
 const p=e.api.chargeAdvance({player:4,dealer:4,at:0},30000);p.player--;near(e.api.chargeAdvance(p,30750).player,3.5);
}
// Dealer spends the same budget; a returned flight refunds once only.
{
 const e=start();e.app.setDealer([2,2,3,3]);
 for(let i=0;i<2;i++){e.app.commitDealerPlay({id:e.app.dIdsR.current[0],value:2},1);e.clock.advance(300);}
 near(e.app.chargeR.current.dealer,0.4);e.app.commitDealerPlay({id:e.app.dIdsR.current[0],value:3},1);assert.equal(e.app.flyR.current,null);assert.equal(e.app.fieldR.current.join(','),'2,2');
 e.clock.advance(900);e.app.commitDealerPlay({id:e.app.dIdsR.current[0],value:3},1);const flight=e.app.flyR.current;assert.ok(flight);near(e.app.chargeR.current.dealer,0);
 e.app.completeTen([5,5],'player',1);near(e.app.chargeR.current.dealer,1);e.app.refundCharge(flight);near(e.app.chargeR.current.dealer,1);assert.equal(e.app.dHR.current.length,2);
 e.clock.advance(300);near(e.app.chargeR.current.dealer,1.2);assert.equal(e.app.fieldR.current.length,0);
}
// A collision on the dealer's final card must not create an extra ten-card refill.
{
 const e=start();e.app.setDealer([5]);e.app.commitDealerPlay({id:e.app.dIdsR.current[0],value:5},1);
 e.clock.advance(250);e.app.fieldR.current=[4,3];e.app.fieldSumR.current=7;e.app.pLandAtR.current=e.clock.now();e.clock.advance(50);
 assert.equal(e.app.dHR.current.length,1);near(e.app.chargeR.current.dealer,2.2);assert.equal(e.app.dPtR.current,0);
}
// One uninterrupted 60-second score contest; role points, bursts, and tie support.
for(const winner of ['player','dealer','draw']){
 const e=start();const before=JSON.stringify(e.app.saveR.current);
 if(winner!=='draw')e.app.completeTen([1,2,3,4],winner,1);
 e.clock.advance(10000);assert.equal(e.app.phaseR.current,'playing');assert.equal(e.app.rnR.current,1);assert.equal(e.app.rushMatchR.current.history.length,0);
 e.clock.advance(49950);assert.equal(e.app.phaseR.current,'playing');e.clock.advance(50);assert.equal(e.app.phaseR.current,'gameEnd');assert.equal(e.app.rushClosedR.current,true);near(e.app.timeLeftR.current,0);
 assert.equal(JSON.stringify(e.app.saveR.current),before);const pts=e.app.pPtR.current;e.app.completeTen([1,2,3,4],'player',1);assert.equal(e.app.pPtR.current,pts);
}
{
 const e=start();e.app.resolvePlay(5,[3,4],7,'player',1);assert.equal(e.app.dPtR.current,1);assert.equal(e.app.matchStatsR.current.bursts,1);e.clock.advance(200);assert.equal(e.app.fieldR.current.length,0);
 e.clock.jump(59800);e.app.completeTen([1,2,3,4],'player',1);assert.equal(e.app.pPtR.current,0);assert.equal(e.app.phaseR.current,'gameEnd');
}
// Pausing beyond the old deadline cannot end the match or accrue charge.
{
 const e=start();e.app.dealPlayer([2,2]);e.app.playCard(0);e.clock.advance(725);e.app.togglePause();const before={...e.app.chargeR.current},left=e.app.timeLeftR.current;
 assert.equal(e.app.pausedR.current,true);e.clock.advance(70000);e.app.playCard(1);e.app.updateCharge();near(e.app.chargeR.current.player,before.player);near(e.app.timeLeftR.current,left);assert.equal(e.app.phaseR.current,'playing');
 e.app.togglePause();assert.equal(e.app.pausedR.current,false);near(e.app.chargeR.current.player,before.player);e.clock.advance(750);e.app.updateCharge();near(e.app.chargeR.current.player,before.player+0.5);
}
// Countdown/settlement cancellation and a clean retry with two energy.
for(const when of ['countdown','settlement']){
 const e=when==='countdown'?engine():start();if(when==='countdown')e.app.startChargeBattle('normal');else e.app.completeTen([5,5],'player',1);
 e.app.goHome();e.clock.advance(70000);assert.equal(e.app.phaseR.current,'charge');assert.equal(e.app.stageOptsR.current,null);
 e.app.startChargeBattle('normal');while(e.app.countNumR.current>=0)e.clock.advance(1);near(e.app.chargeR.current.player,2);near(e.app.chargeR.current.dealer,2);near(e.app.timeLeftR.current,60);assert.equal(e.app.pPtR.current,0);
}
// Run the actual CPU scheduler/cursor/flight sequence across repeated regeneration.
for(const diff of ['normal','hard']){
 const e=engine({ai:true});e.app.startChargeBattle(diff);while(e.app.countNumR.current>=0)e.clock.advance(1);
 e.app.dealPlayer(Array(10).fill(5));e.app.setDealer(Array(10).fill(5));
 e.clock.advance(30000);assert.ok(e.app.dPtR.current>=3,'CPU must keep playing after using initial energy');assert.equal(e.app.phaseR.current,'playing');assert.ok(e.app.chargeR.current.dealer>=0&&e.app.chargeR.current.dealer<=4);
 e.clock.advance(30000);assert.equal(e.app.phaseR.current,'gameEnd');
}
// The complete App view puts energy near hands, with no separate score tiles.
{
 const e=start();const view=e.render(),nodes=walk(view),hasClass=(n,c)=>(n.props.className||'').split(' ').includes(c);
 assert.ok(hasClass(view,'charge-playing'));
 assert.equal(nodes.filter(n=>hasClass(n,'gp-score')).length,0);
 assert.equal(nodes.filter(n=>hasClass(n,'gp-dealer-cards')).length,1);
 assert.equal(nodes.filter(n=>hasClass(n,'gp-hand-row')).length,2);
 const dealer=nodes.find(n=>hasClass(n,'gp-dealer-area')),hand=nodes.find(n=>hasClass(n,'charge-hand-header'));
 assert.equal(walk(dealer).filter(n=>hasClass(n,'gp-dealer-card')).length,10);
 assert.equal(walk(dealer).filter(n=>n.type===e.api.ChargeMeter&&n.props.who==='dealer').length,1);
 assert.equal(walk(hand).filter(n=>n.type===e.api.ChargeMeter&&n.props.who==='player').length,1);
 assert.equal(nodes.filter(n=>n.type===e.api.VictoryMeter).length,1);
 assert.equal(nodes.filter(n=>hasClass(n,'charge-field-slot')).length,4);
 const meter=e.api.ChargeMeter({value:3.5,who:'player'}),cells=walk(meter).filter(n=>hasClass(n,'charge-cell'));
 assert.equal(cells.length,4);assert.equal(cells.filter(n=>hasClass(n,'ready')).length,3);assert.equal(cells[3].children[0].props.style.width,'50%');
 for(const [difference,position] of [[-20,'0%'],[-8,'30%'],[0,'50%'],[8,'70%'],[20,'100%'],[23,'100%']]){
  const meter=e.api.VictoryMeter({difference}),all=walk(meter);assert.equal(meter.props['aria-valuenow'],Math.max(-20,Math.min(20,difference)));
  assert.equal(all.find(n=>hasClass(n,'victory-marker')).props.style.top,position);
  assert.equal(all.find(n=>hasClass(n,'victory-zero')).children[1].children[0],'0');
 }
}
// First to a 20-point DIFFERENCE wins immediately, including overshoot and bursts.
for(const winner of ['player','dealer'])for(const cause of ['exact','role','burst']){
 const e=start(),own=winner==='player'?'pPtR':'dPtR',other=winner==='player'?'dPtR':'pPtR';
 e.app[own].current=26;e.app[other].current=7;const before=JSON.stringify(e.app.saveR.current);
 if(cause==='burst')e.app.resolvePlay(5,[3,4],7,winner==='player'?'dealer':'player',1);
 else e.app.completeTen(cause==='role'?[1,2,3,4]:[5,5],winner,1);
 assert.equal(e.app.phaseR.current,'gameEnd');assert.equal(e.app.rushClosedR.current,true);assert.ok(e.app.timeLeftR.current>0);
 const result=e.render();assert.equal(result.type,e.api.ChargeResult);assert.equal(result.props.data.winner,winner);assert.equal(result.props.data.charge.reason,'limit');assert.ok(result.props.data.charge.remaining>0);
 const pts=e.app[own].current;e.clock.advance(70000);assert.equal(e.app[own].current,pts);assert.equal(JSON.stringify(e.app.saveR.current),before);
 result.props.onRetry();assert.equal(e.app.phaseR.current,'playing');assert.equal(e.app.pPtR.current,0);assert.equal(e.app.dPtR.current,0);
}
{
 const e=start();e.app.pPtR.current=20;e.app.dPtR.current=19;e.app.completeTen([5,5],'player',1);assert.equal(e.app.phaseR.current,'playing','20 total is not 20 lead');
 e.clock.advance(60000);const data=e.render().props.data;assert.equal(data.winner,'player');assert.equal(data.charge.reason,'time');
 const t=start();t.clock.advance(60000);assert.equal(t.render().props.data.winner,'draw');
 const late=start();late.app.pPtR.current=19;late.clock.jump(60000);late.app.completeTen([5,5],'player',1);assert.equal(late.app.pPtR.current,19);assert.equal(late.render().props.data.charge.reason,'time');
}
// v257: Reproduce the reported 2+1+5 board using the actual 50ms match timer.
function deadlock(){
 const e=start();e.app.dealPlayer([3,5,1,3,3,1,5]);e.app.setDealer([1,1,5,5]);
 e.app.resolvePlay(5,[2,1],3,'dealer',1);return e;
}
{
 const e=deadlock(),a=e.app;const ph=JSON.stringify(a.pHR.current),dh=JSON.stringify(a.dHR.current),ids=JSON.stringify(a.dIdsR.current),stats=JSON.stringify(a.matchStatsR.current),deadline=a.rushDeadlineR.current;
 a.pPtR.current=7;a.dPtR.current=3;e.clock.advance(700);assert.equal(a.fieldSumR.current,8);
 e.clock.advance(100);assert.ok(walk(e.render()).some(n=>n.props.className==='charge-reset-notice'&&n.children[0]==='場をリセット'));
 e.clock.advance(200);assert.equal(a.fieldR.current.length,0);assert.equal(a.fieldSumR.current,0);assert.equal(a.resolvingR.current,false);
 assert.equal(a.pPtR.current,7);assert.equal(a.dPtR.current,3);assert.equal(a.rushDeadlineR.current,deadline);near(a.timeLeftR.current,59);
 assert.equal(JSON.stringify(a.pHR.current),ph);assert.equal(JSON.stringify(a.dHR.current),dh);assert.equal(JSON.stringify(a.dIdsR.current),ids);assert.equal(JSON.stringify(a.matchStatsR.current),stats);
 near(a.chargeR.current.player,2+1/1.5);near(a.chargeR.current.dealer,2+1/1.5);
 e.clock.advance(1000);assert.equal(walk(e.render()).filter(n=>n.props.className==='charge-reset-notice').length,0);assert.equal(a.fieldR.current.length,0);
}
// One safe card on either side prevents a reset, even while its gauge is empty.
for(const who of ['player','dealer']){
 const e=deadlock();if(who==='player')e.app.dealPlayer([2]);else e.app.setDealer([2]);
 e.app.chargeR.current={player:0,dealer:0,at:e.clock.now()};e.clock.advance(1200);assert.equal(e.app.fieldSumR.current,8);assert.equal(e.app.resolvingR.current,false);
}
// An incomplete low total in slot three is also a deadlock; an empty field is not.
{
 const e=start();e.app.dealPlayer([1,1]);e.app.setDealer([1,1]);e.app.resolvePlay(1,[1],1,'dealer',1);e.clock.advance(1000);assert.equal(e.app.fieldR.current.length,0);
 const hand=JSON.stringify(e.app.pHR.current);e.clock.advance(1500);assert.equal(JSON.stringify(e.app.pHR.current),hand);assert.equal(e.app.resolvingR.current,false);
}
// A safe flight remains eligible until it lands; an unsafe flight is returned once.
{
 const e=deadlock();e.app.setDealer([2,5]);e.app.stageOptsR.current.flyMs=1200;
 e.app.commitDealerPlay({id:e.app.dIdsR.current[0],value:2},1);e.clock.advance(1000);assert.equal(e.app.fieldSumR.current,8);assert.ok(e.app.flyR.current);
 e.clock.advance(400);assert.equal(e.app.fieldR.current.length,0);assert.ok(e.app.dPtR.current>0);
}
{
 const e=deadlock();e.app.setDealer([5]);const id=e.app.dIdsR.current[0];e.clock.advance(700);e.app.commitDealerPlay({id,value:5},1);assert.ok(e.app.flyR.current);
 e.clock.advance(300);assert.equal(e.app.fieldR.current.length,0);assert.equal(e.app.dHR.current.join(','),'5');assert.equal(e.app.dIdsR.current[0],id);near(e.app.chargeR.current.dealer,2+1/1.5);assert.equal(e.app.dPtR.current,0);assert.equal(e.app.pPtR.current,0);
}
// Pending checks cannot run during pause, after leaving, or at the match deadline.
{
 const e=deadlock();e.clock.advance(650);e.app.togglePause();e.clock.advance(10000);assert.equal(e.app.fieldSumR.current,8);
 e.app.togglePause();e.clock.advance(650);assert.equal(e.app.fieldSumR.current,8);e.clock.advance(350);assert.equal(e.app.fieldR.current.length,0);
}
{
 const e=deadlock();e.clock.advance(650);e.app.goHome();e.clock.advance(2000);assert.equal(e.app.phaseR.current,'charge');assert.equal(walk(e.render()).filter(n=>n.props.className==='charge-reset-notice').length,0);
 const last=start();last.clock.advance(59400);last.app.dealPlayer([1,5]);last.app.setDealer([1,5]);last.app.resolvePlay(5,[2,1],3,'dealer',1);last.clock.advance(600);assert.equal(last.app.phaseR.current,'gameEnd');assert.equal(last.app.pPtR.current,0);assert.equal(last.app.dPtR.current,0);
 const rush=engine();rush.app.startRushBattle('hard');while(rush.app.countNumR.current>=0)rush.clock.advance(1);rush.app.dealPlayer([1,5]);rush.app.setDealer([1,5]);rush.app.resolvePlay(5,[2,1],3,'dealer',1);rush.clock.advance(1500);assert.equal(rush.app.fieldSumR.current,0,'v293: rush has no burst, so a stuck board resets like charge');
}
console.log('PASS: charge hand bars and single-row opponent; automatic deadlock reset preserving hands/charge/score/clock; fixed-center victory meter; exact/overshoot/burst 20-point-lead finishes; timed wins/draws; equal energy; CPU; pause/retry; saves.');
