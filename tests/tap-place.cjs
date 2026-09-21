const assert=require('node:assert/strict');
const {engine}=require('./rush-mode.cjs');
if(/TAP_PLACE_CFG=\{enabled:false\}/.test(require('node:fs').readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8'))){console.log('SKIP: tap-place is disabled (v312 TAP_PLACE_CFG.enabled=false)');process.exit(0);}
const walk=(x,out=[])=>{if(x&&typeof x==='object'){out.push(x);(x.children||[]).flat(Infinity).forEach(y=>walk(y,out));}return out;};
const has=(x,c)=>(x.props.className||'').split(' ').includes(c);
function start(){const e=engine();e.app.startGame('normal');while(e.app.countNumR.current>=0)e.clock.advance(1);e.app.dealPlayer([1,2,3,4,5,1,2,3,4,5]);return e;}
// Selection is reversible and never spends a card, time budget, or energy.
{
 const e=start(),a=e.app,hand=JSON.stringify(a.pHR.current),time=a.timeLeftR.current;
 a.chooseHandCard(0);assert.equal(a.tapPickR.current.index,0);assert.equal(JSON.stringify(a.pHR.current),hand);assert.equal(a.fieldR.current.length,0);assert.equal(a.timeLeftR.current,time);
 a.chooseHandCard(2);assert.equal(a.tapPickR.current.index,2);a.chooseHandCard(2);assert.equal(a.tapPickR.current,null);
 a.placePickedCard(3);assert.equal(a.fieldR.current.length,0);
 a.chooseHandCard(0);a.placePickedCard(3);assert.deepEqual(Array.from(a.fieldR.current),[1]);assert.deepEqual(Array.from(a.fieldPlacesR.current),[3]);assert.equal(a.pHR.current[0],null);assert.equal(a.tapPickR.current,null);
 a.placePickedCard(0);assert.equal(a.fieldR.current.length,1); // stale duplicate tap
 a.chooseHandCard(1);a.placePickedCard(3);assert.equal(a.pHR.current[1],2);assert.equal(a.tapPickR.current.index,1);
 a.placePickedCard(1);assert.deepEqual(Array.from(a.fieldPlacesR.current),[3,1]);assert.equal(a.fieldSumR.current,3);
}
// Slot order cannot alter the role or score. Complete a straight in non-sequential slots.
{
 const e=start(),a=e.app;
 for(const [card,slot] of [[0,3],[1,1],[2,0],[3,2]]){a.chooseHandCard(card);a.placePickedCard(slot);}
 assert.deepEqual(Array.from(a.fieldR.current),[1,2,3,4]);assert.deepEqual(Array.from(a.fieldPlacesR.current),[3,1,0,2]);assert.equal(a.pPtR.current,5);assert.equal(a.tapPickR.current,null);
}
// Pause, replace/redeal, freeze, round reset and navigation cannot leave a stale tap armed.
{
 const e=start(),a=e.app;a.chooseHandCard(0);a.togglePause();assert.equal(a.tapPickR.current,null);a.placePickedCard(0);assert.equal(a.fieldR.current.length,0);a.togglePause();
 a.chooseHandCard(0);a.dealPlayer([1,2,3,4,5,1,2,3,4,5]);assert.equal(a.tapPickR.current,null);a.placePickedCard(0);assert.equal(a.fieldR.current.length,0);
 a.chooseHandCard(0);a.setFrz({0:5});a.placePickedCard(0);assert.equal(a.pHR.current[0],1);assert.equal(a.fieldR.current.length,0);a.setFrz({});
 a.resetField();assert.equal(a.tapPickR.current,null);assert.equal(a.fieldPlacesR.current.length,0);
 a.chooseHandCard(0);a.goHome();assert.equal(a.tapPickR.current,null);a.placePickedCard(1);assert.equal(a.fieldR.current.length,0);
}
// AI filling a chosen slot must not overwrite anything or spend the selected hand card.
{
 const e=start(),a=e.app;a.chooseHandCard(0);a.resolvePlay(2,[],0,'dealer',1,false,false,3);
 a.placePickedCard(3);assert.equal(a.pHR.current[0],1);assert.equal(a.fieldR.current.length,1);
 a.placePickedCard(2);assert.deepEqual(Array.from(a.fieldPlacesR.current),[3,2]);assert.equal(a.fieldSumR.current,3);
}
// Player can claim the AI's landing slot first; the AI returns its exact card without a duplicate.
{
 const e=start(),a=e.app;a.setDealer([2,4]);const id=a.dIdsR.current[0];a.commitDealerPlay({id,value:2},1);assert.equal(a.flyR.current.placeSlot,0);
 a.chooseHandCard(0);a.placePickedCard(0);e.clock.advance(700);assert.deepEqual(Array.from(a.fieldR.current),[1]);assert.equal(a.dIdsR.current.filter(x=>x===id).length,1);assert.equal(a.dHR.current.length,2);
}
// Actual AI flight lands in the first physical empty slot, not after the last logical card.
{
 const e=start(),a=e.app;a.chooseHandCard(0);a.placePickedCard(3);a.setDealer([2,4]);const id=a.dIdsR.current[0];a.commitDealerPlay({id,value:2},1);assert.equal(a.flyR.current.placeSlot,0);e.clock.advance(700);
 assert.deepEqual(Array.from(a.fieldPlacesR.current),[3,0]);assert.equal(a.fieldSumR.current,3);
 a.removeFieldIdx([0]);assert.deepEqual(Array.from(a.fieldPlacesR.current),[0]);assert.deepEqual(Array.from(a.fieldR.current),[2]);
}
// Real UI handlers implement both steps with accessible, fixed empty slots.
{
 const e=start();let nodes=walk(e.render());assert.equal(nodes.filter(n=>has(n,'tp-field-cell')).length,4);assert.equal(nodes.filter(n=>has(n,'tp-empty')).length,4);
 const card=nodes.find(n=>has(n,'player-hand-slot')&&n.props['data-slot']===0);assert.equal(card.type,'button');card.props.onClick();nodes=walk(e.render());
 assert.equal(nodes.find(n=>has(n,'player-hand-slot')&&n.props['data-slot']===0).props['aria-pressed'],true);
 const target=nodes.find(n=>n.props['aria-label']==='場の枠4に置く');assert.equal(target.props.disabled,false);target.props.onClick();nodes=walk(e.render());
 assert.equal(nodes.filter(n=>has(n,'tp-empty')).length,3);assert.equal(nodes.find(n=>has(n,'tp-field-cell')&&n.props['data-field-slot']===3).props.className.includes('filled'),true);
}
// Other modes retain their direct/cursor controls and never acquire placement slots.
for(const mode of ['startRushBattle','startChargeBattle','startSurvivalBattle']){
 const e=engine();e.app[mode]('normal');while(e.app.countNumR.current>=0)e.clock.advance(1);e.app.chooseHandCard(0);assert.equal(e.app.tapPickR.current,null);assert.equal(walk(e.render()).filter(n=>has(n,'tp-field-cell')).length,0);
}
console.log('PASS: select/change/cancel, four physical destinations, straight scoring, occupied-slot races, both AI flight outcomes, freeze/pause/redeal/reset/home, accessible UI handlers, other mode isolation.');
