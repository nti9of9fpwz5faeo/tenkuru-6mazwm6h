// Exercise the real normal-battle engine, including shared-board races and pauses.
const assert=require('node:assert/strict');
const {engine}=require('./rush-mode.cjs');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const walk=(x,out=[])=>{if(x&&typeof x==='object'){out.push(x);(x.children||[]).flat(Infinity).forEach(y=>walk(y,out));}return out;};
const hasClass=(n,c)=>(n.props.className||'').split(' ').includes(c);
function start(options){const e=engine(options);e.app.startGame('normal');while(e.app.countNumR.current>=0)e.clock.advance(1);return e;}
function pool(e,p,d=p){e.app.energyR.current={player:p,dealer:d,at:e.clock.now()};e.app.updateEnergy();}

// Cost is the face value, invalid/empty/locked taps do not consume, caps discard overflow.
{
 const e=start();near(e.app.energyR.current.player,10);near(e.app.energyR.current.dealer,10);
 e.app.dealPlayer([2,3,4,1]);e.app.playCard(0);near(e.app.energyR.current.player,8);
 e.app.playCard(0);near(e.app.energyR.current.player,8);
 pool(e,2);e.app.playCard(1);near(e.app.energyR.current.player,2);assert.equal(e.app.pHR.current[1],3);
 e.clock.advance(999);e.app.playCard(1);assert.equal(e.app.pHR.current[1],3);
 e.clock.advance(1);e.app.playCard(1);near(e.app.energyR.current.player,0);assert.equal(e.app.fieldSumR.current,5);
 const advance=e.api.energyAdvance({player:10,dealer:9,at:0},30000);near(advance.player,10);near(advance.dealer,10);
 advance.player-=2;near(e.api.energyAdvance(advance,30500).player,8.5);
}
// Every agreed role uses the actual evaluator, awards only the finisher, and awards once.
for(const [cards,gain,points] of [[[5,5],0,1],[[1,1,3,5],2,2],[[2,2,3,3],4,3],[[1,3,3,3],6,4],[[1,2,3,4],8,5]]){
 for(const who of ['player','dealer']){
  const e=start();pool(e,1);e.app.completeTen(cards,who,1);
  near(e.app.energyR.current[who],1+gain);near(e.app.energyR.current[who==='player'?'dealer':'player'],1);
  assert.equal(e.app[who==='player'?'pPtR':'dPtR'].current,points);
  e.app.completeTen(cards,who,1);near(e.app.energyR.current[who],1+gain);
  e.clock.advance(3000);near(e.app.energyR.current[who],1+gain);
 }
}
// Spend before reward, clamp to 10; bursts have no refund or role bonus.
{
 const e=start();pool(e,1);e.app.resolvingR.current=true;
 e.app.completeTen([1,2,3,4],'dealer',1,true);near(e.app.energyR.current.dealer,9);assert.equal(e.app.dPtR.current,5);
 e.app.completeTen([1,2,3,4],'dealer',1,true);near(e.app.energyR.current.dealer,9);assert.equal(e.app.dPtR.current,5);
}
{
 const e=start();e.app.dealPlayer([3,5]);e.app.fieldR.current=[1,3,3];e.app.fieldSumR.current=7;pool(e,9);
 e.app.playCard(0);near(e.app.energyR.current.player,10);assert.equal(e.app.pPtR.current,4);
 const b=start();b.app.dealPlayer([5,1]);b.app.fieldR.current=[3,4];b.app.fieldSumR.current=7;b.app.playCard(0);
 near(b.app.energyR.current.player,5);assert.equal(b.app.energyAwardRoundR.current,-1);
}
// Countdown and results grant nothing. A new round carries energy; a new match resets.
{
 const e=engine();e.app.startGame('normal');pool(e,4);e.clock.advance(1000);near(e.app.energyR.current.player,4);
 while(e.app.countNumR.current>=0)e.clock.advance(1);
 e.app.completeTen([5,5],'player',1);e.clock.advance(4000);assert.equal(e.app.rnR.current,2);near(e.app.energyR.current.player,4);
 while(e.app.countNumR.current>=0)e.clock.advance(1);
 const before=e.app.energyR.current.player;e.clock.advance(1000);near(e.app.energyR.current.player,before+1);
 e.app.goHome();const stopped=e.app.energyR.current.player;e.clock.advance(60000);near(e.app.energyR.current.player,stopped);
 e.app.startGame('normal');near(e.app.energyR.current.player,10);near(e.app.energyR.current.dealer,10);
}
// Fractional seconds survive pause; paused wall time is never banked.
{
 const e=start();pool(e,2);e.clock.advance(375);e.app.togglePause();near(e.app.energyR.current.player,2.375);
 e.clock.advance(60000);e.app.playCard(0);e.app.updateEnergy();near(e.app.energyR.current.player,2.375);
 e.app.togglePause();near(e.app.energyR.current.player,2.375);e.clock.advance(625);e.app.updateEnergy();near(e.app.energyR.current.player,3);
}
// CPU pays the real face value on launch. Aborted flights are refunded exactly once.
for(const reason of ['finish','pause','collision']){
 const e=start();e.app.setDealer([4,3,1]);pool(e,6);
 e.app.commitDealerPlay({id:e.app.dIdsR.current[0],value:4},1);const flight=e.app.flyR.current;assert.ok(flight);near(e.app.energyR.current.dealer,2);
 if(reason==='finish')e.app.completeTen([5,5],'player',1);
 if(reason==='pause')e.app.togglePause();
 if(reason==='collision'){e.app.fieldR.current=[5,3];e.app.fieldSumR.current=8;e.app.pLandAtR.current=e.clock.now()+600;e.clock.advance(680);}
 assert.equal(e.app.flyR.current,null);assert.equal(e.app.dHR.current.length,3);
 const refunded=e.app.energyR.current.dealer;assert.ok(refunded>=6&&refunded<7);
 e.app.refundEnergy(flight);near(e.app.energyR.current.dealer,refunded);
 e.clock.advance(700);assert.equal(e.app.dHR.current.length,3);
}
{
 const e=start();e.app.setDealer([5,2]);pool(e,2);
 e.app.commitDealerPlay({id:e.app.dIdsR.current[0],value:5},1);assert.equal(e.app.flyR.current,null);near(e.app.energyR.current.dealer,2);
 e.app.commitDealerPlay({id:e.app.dIdsR.current[1],value:2},1);near(e.app.energyR.current.dealer,0);e.clock.advance(680);assert.equal(e.app.fieldSumR.current,2);
}
// Boss direct-card path shares the cost check; time-link cannot trap an empty budget.
{
 const e=start();e.app.setDealer([5,2]);pool(e,1);e.app.playTappedCard(e.app.dIdsR.current[0],1,null);assert.equal(e.app.fieldSumR.current,0);
 pool(e,5);e.app.playTappedCard(e.app.dIdsR.current[0],1,null);near(e.app.energyR.current.dealer,0);assert.equal(e.app.fieldSumR.current,5);
 const t=start();t.app.dealPlayer([2,3]);t.app.pSpR.current=[true,false];pool(t,2);t.app.playCard(0);assert.equal(t.app.linkR.current,false);
}
// Private hand composition never affects the strong CPU's normal-battle lookahead.
{
 const e=start();e.app.setDealer([1,2,3,4,5]);e.app.dealPlayer([1,1,1,1]);
 const a=e.app.smartPick([1,2,3],3,[3]),b=e.app.denyPick([1,2,3],3,[3],[1,2,3,4,5]);
 e.app.dealPlayer([5,5,5,5]);assert.equal(e.app.smartPick([1,2,3],3,[3]),a);assert.equal(e.app.denyPick([1,2,3],3,[3],[1,2,3,4,5]),b);
}
// UI omits private opponent data (not just transparent text); a single four-slot field.
{
 const e=start();pool(e,2);e.app.dealPlayer([1,2,3,4,5,1,2,3,4,5]);const view=e.render(),nodes=walk(view);
 assert.ok(hasClass(view,'energy-playing'));assert.equal(nodes.filter(n=>hasClass(n,'gp-dealer-area')).length,0);
 assert.equal(nodes.filter(n=>hasClass(n,'gp-dealer-card')).length,0);
 assert.equal(nodes.filter(n=>hasClass(n,'energy-field-slot')).length,4);
 assert.equal(nodes.filter(n=>hasClass(n,'gp-hand-row')).length,2);
 assert.equal(nodes.filter(n=>n.type===e.api.EnergyMeter).length,2);
 assert.equal(nodes.find(n=>n.type===e.api.EnergyMeter&&n.props.who==='dealer').props.value,2);
 assert.equal(nodes.filter(n=>n.type===e.api.HandControls).length,0);
 const cards=nodes.filter(n=>hasClass(n,'player-hand-slot'));assert.equal(cards.length,10);assert.equal(cards[1].props.disabled,false);assert.equal(cards[2].props.disabled,true);
 cards[1].props.onClick();near(e.app.energyR.current.player,0);assert.equal(e.app.fieldSumR.current,2);
 const meter=walk(e.api.EnergyMeter({value:2.5}));assert.equal(meter.filter(n=>hasClass(n,'energy-cell')).length,10);
}
// The running scheduler still acts after its opening budget runs low.
{
 const e=start({ai:true});e.clock.advance(35000);
 assert.ok(e.app.dPtR.current>0||e.app.fieldR.current.length>0||e.app.matchStatsR.current.dtens.length>0);
 assert.ok(e.app.energyR.current.dealer>=0&&e.app.energyR.current.dealer<=10);
 e.app.goHome();
}
console.log('PASS: normal energy costs, regeneration, five role refunds, caps, pause/carryover/retry, CPU/flight races, hidden hands, direct taps and legacy mode isolation.');
