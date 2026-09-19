// Run the shipped engine under a deterministic clock; no production test hooks.
const assert=require('node:assert/strict');
const {engine}=require('./rush-mode.cjs');
const walk=(x,out=[])=>{if(x&&typeof x==='object'){out.push(x);(x.children||[]).flat(Infinity).forEach(y=>walk(y,out));}return out;};
function start(){const e=engine();e.app.startRushBattle('normal');while(e.app.countNumR.current>=0)e.clock.advance(1);e.app.openRound();return e;}
const hasClass=(n,c)=>(n.props.className||'').split(' ').includes(c);
{
 const e=engine(),{handNeighbor,handPath}=e.api;
 assert.equal(handNeighbor(4,'right'),4);assert.equal(handNeighbor(5,'left'),5);
 assert.equal(handNeighbor(2,'up'),2);assert.equal(handNeighbor(7,'down'),7);
 for(let from=0;from<10;from++)for(let to=0;to<10;to++){
   const path=handPath(from,to),distance=Math.abs(from%5-to%5)+Math.abs(Math.floor(from/5)-Math.floor(to/5));
   assert.equal(path.length,distance);let previous=from;
   for(const slot of path){assert.ok(['up','down','left','right'].some(d=>handNeighbor(previous,d)===slot));previous=slot;}
   assert.equal(previous,to);
 }
}
// Physical travel cannot be bypassed by rapid taps or immediate confirmation.
{
 const e=start(),a=e.app,step=e.api.HAND_NAV.stepMs;
 a.dealPlayer([5,5,4,1,1,3,3,2,2,3]);assert.equal(a.pCursorR.current,2);
 assert.equal(a.movePlayerCursor('right'),true);assert.equal(a.pCursorR.current,3);
 for(let i=0;i<8;i++)assert.equal(a.movePlayerCursor('right'),false);
 a.playSelectedCard();assert.equal(a.fieldR.current.length,0);
 e.clock.advance(step-1);a.playSelectedCard();assert.equal(a.fieldR.current.length,0);
 e.clock.advance(1);a.playSelectedCard();assert.equal(a.fieldR.current.join(','),'1');
 assert.equal(a.pHR.current[3],null);assert.equal(a.pCursorR.current,3);
 a.playSelectedCard();assert.equal(a.fieldR.current.length,1,'empty selected slot is not a new card');
 const before=a.pHR.current.join(',');a.movePlayerCursor('left');e.clock.advance(step);assert.equal(a.pHR.current.join(','),before,'navigation never plays');
 const nodes=walk(e.render());assert.equal(nodes.filter(n=>hasClass(n,'player-hand-slot')).length,10);
 assert.equal(nodes.find(n=>hasClass(n,'player-hand-slot')&&n.props['data-slot']===3).props.className,'player-hand-slot empty');
 const selected=nodes.find(n=>hasClass(n,'player-hand-slot')&&hasClass(n,'selected'));assert.equal(selected.props['data-slot'],2);
 assert.equal(nodes.filter(n=>hasClass(n,'gp-dealer-card')).length,10);
 const card=walk(selected).find(n=>n.type===e.api.SlideCard);card.props.onPlay();assert.equal(a.fieldR.current.length,1,'direct card callback cannot bypass cursor');
}
// Pause, locks, frozen cards, designation, countdown and exit all block play safely.
{
 const e=start(),a=e.app;a.dealPlayer(Array(10).fill(1));
 a.togglePause();const slot=a.pCursorR.current;a.movePlayerCursor('down');a.playSelectedCard();assert.equal(a.pCursorR.current,slot);assert.equal(a.fieldR.current.length,0);
 a.togglePause();a.setFrz({2:3});a.playSelectedCard();assert.equal(a.fieldR.current.length,0);
 a.setFrz({});a.setLocks([false,false,true]);a.playSelectedCard();assert.equal(a.fieldR.current.length,0);
 a.setLocks([]);a.setCmd(4);a.playSelectedCard();assert.equal(a.fieldR.current.length,0);
 a.setCmd(null);a.rStopR.current=true;assert.equal(a.movePlayerCursor('right'),false);a.playSelectedCard();assert.equal(a.fieldR.current.length,0);
 a.rStopR.current=false;a.countNumR.current=0;a.playSelectedCard();assert.equal(a.fieldR.current.length,0);
 a.countNumR.current=-1;a.goHome();a.playSelectedCard();assert.equal(a.fieldR.current.length,0);
}
// Opponent uses the same 2D grid, including empty slots; never compresses or teleports.
{
 const e=start(),a=e.app,step=e.api.HAND_NAV.stepMs;
 a.setDealer(Array(10).fill(1));const ids=Array.from(a.dIdsR.current),target=ids[9];
 a.setDealer([1,1],[false,false],[ids[2],target]);assert.equal(a.dSlotsR.current[9],target);
 let arrived=0;a.cursorToCard(target,()=>arrived++,()=>true);
 e.clock.advance(1);assert.equal(a.dCursorSlotR.current,3);assert.equal(a.dCurR.current,null);
 e.clock.advance(step-1);assert.equal(a.dCursorSlotR.current,4);
 e.clock.advance(step);assert.equal(a.dCursorSlotR.current,9);assert.equal(arrived,0);
 e.clock.advance(step+80);assert.equal(arrived,1);
 a.setDealer([1],[false],[ids[2]]);assert.equal(a.dCursorSlotR.current,9);assert.equal(a.dCurR.current,null);
 const cards=walk(e.render()).filter(n=>hasClass(n,'gp-dealer-card'));assert.equal(cards.length,10);assert.ok(hasClass(cards[9],'dsel'));assert.ok(hasClass(cards[9],'empty'));
 a.cursorToCard(ids[2],()=>arrived++,()=>true);a.togglePause();e.clock.advance(2000);assert.equal(arrived,1);assert.equal(a.curBusyR.current,false);
}
// Invalidated target is canceled once; stale callbacks cannot leak into the next game.
{
 const e=start(),a=e.app;a.setDealer(Array(10).fill(2));let arrived=0,canceled=0;
 const id=a.dIdsR.current[9];a.cursorToCard(id,()=>arrived++,()=>true,()=>canceled++);
 a.setDealer([2]);e.clock.advance(2000);assert.equal(arrived,0);assert.equal(canceled,1);
 a.setDealer(Array(10).fill(2));a.cursorToCard(a.dIdsR.current[9],()=>arrived++,()=>true);
 a.goHome();e.clock.advance(2000);assert.equal(arrived,0);
 a.startRushBattle('normal');assert.equal(a.pCursorR.current,2);assert.equal(a.dCursorSlotR.current,2);
}
// Side preference is validated and persisted, available from home and pause.
{
 const e=start(),a=e.app;a.changeControlSide('right');assert.equal(e.api.loadControlSide(),'right');
 assert.equal(walk(e.render()).find(n=>n.type===e.api.HandControls).props.side,'right');
 a.changeControlSide('invalid');assert.equal(e.api.loadControlSide(),'right');
 a.togglePause();assert.equal(walk(e.render()).find(n=>n.type===e.api.ControlSettings).props.side,'right');
 a.changeControlSide('left');assert.equal(e.api.loadControlSide(),'left');
 e.dom.window.localStorage.setItem('tenkuru.controlSide.v1','invalid');assert.equal(e.api.loadControlSide(),'left');
 assert.ok(walk(e.api.TitleScreen({})).some(n=>n.type==='button'&&n.children[0]==='操作設定'));
}
console.log('PASS: 2D boundaries, fixed slots, movement timing, no tap bypass, one-card confirmation, locks/pause/countdown, CPU empty-slot travel/cancellation, persistent left/right settings.');
