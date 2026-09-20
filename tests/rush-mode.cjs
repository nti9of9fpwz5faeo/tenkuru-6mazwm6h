// Offline execution of the real App engine with a deterministic clock.
// No browser, external requests, audio, or saved-player progress is used.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const cssTree=require('css-tree');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
cssTree.parse(html.slice(html.indexOf('/* v253 10秒ラッシュ */'),html.indexOf('</style>')));
function makeClock(){
 let now=10000,id=0;const jobs=new Map();
 const add=(fn,ms,interval)=>{const key=++id;jobs.set(key,{fn,at:now+Math.max(1,ms||0),interval});return key;};
 return {now:()=>now,setTimeout:(fn,ms)=>add(fn,ms,0),setInterval:(fn,ms)=>add(fn,ms,ms),clear:key=>jobs.delete(key),reset:()=>jobs.clear(),
 jump:ms=>{now+=ms;},advance(ms){const to=now+ms;let n=0;while(true){const next=[...jobs].filter(([,j])=>j.at<=to).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;if(++n>20000)throw Error('Timer loop');const[key,j]=next;now=j.at;if(j.interval)j.at+=j.interval;else jobs.delete(key);j.fn();}now=to;}};
}
function engine({ai=false}={}){
 const clock=makeClock();const dom=new JSDOM('<body><div id="root"></div></body>',{url:'https://example.test/'});
 const soundNode=()=>({connect(){},gain:{value:0}});
 dom.window.AudioContext=class{constructor(){this.sampleRate=10;this.state='running';}createConvolver(){return soundNode();}createGain(){return soundNode();}createBuffer(ch,n){return{getChannelData:()=>new Float32Array(n)}}};
 const cells=[];let cursor=0;
 const hooks={createElement:(type,props,...children)=>({type,props:props||{},children}),Fragment:'fragment',
 useState:v=>{const i=cursor++;if(!(i in cells))cells[i]=typeof v==='function'?v():v;return[cells[i],n=>{cells[i]=typeof n==='function'?n(cells[i]):n;}];},
 useRef:v=>{const i=cursor++;if(!(i in cells))cells[i]={current:v};return cells[i];},useEffect(){},useCallback:f=>f,useMemo:f=>f()};
 const context=vm.createContext({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,localStorage:dom.window.localStorage,React:hooks,ReactDOM:{createRoot:()=>({render(){}})},console,performance:{now:clock.now},Date:class extends Date{static now(){return clock.now()}},setTimeout:clock.setTimeout,clearTimeout:clock.clear,setInterval:clock.setInterval,clearInterval:clock.clear,requestAnimationFrame:fn=>clock.setTimeout(fn,16),cancelAnimationFrame:clock.clear,Image:class{},Audio:class{play(){return Promise.resolve()}pause(){}}});
 const capture=`  if(globalThis.__capture) return {startGame,energyR,updateEnergy,stopEnergy,spendEnergy,refundEnergy,energyAwardRoundR,returnEnergyFlight,smartPick,denyPick,playTappedCard,pSpR,linkR,enterLink,exitLink,movePlayerCursor,playSelectedCard,pCursorR,pMoveUntilR,changeControlSide,dCursorSlotR,dSlotsR,dCurR,curBusyR,cursorToCard,cancelCursor,setFrz,setLocks,setCmd,rStopR,
  startSurvivalBattle,finishSurvivalMatch,goSurvival,refillSurvival,checkSurvivalEmpty,startChargeBattle,finishChargeMatch,updateCharge,refundCharge,togglePause,chargeR,pausedR,pLandAtR,matchStatsR,goCharge,startRushBattle,startStage,startTimer,doCountdown,playCard,resolvePlay,completeTen,finishRushRound,finishRushBoard,goHome,goRush,commitDealerPlay,dealPlayer,setDealer,rushExpired,
  phaseR,stageR,stageOptsR,rushMatchR,rushClosedR,rushDeadlineR,timeLeftR,pPtR,dPtR,rnR,roundTokR,pHR,dHR,dIdsR,fieldR,fieldSumR,flyR,lockR,resolvingR,countNumR,saveR,
  silenceAi:()=>{scheduleAi=()=>{};},openRound:()=>{countNumR.current=-1;lockR.current=false;resolvingR.current=false;startTimer(rnR.current);},
  state:()=>({phase:phaseR.current,p:pPtR.current,d:dPtR.current,wins:rushMatchR.current,closed:rushClosedR.current,field:[...fieldR.current],rn:rnR.current})};\n`;
 const code=source.replace('  const curStage=stageCtx?',capture+'  const curStage=stageCtx?');
 vm.runInContext(code+`\n[${['resumeAC','stopBGM','startBGM','stopChronoHum','duckBGM','playGoSE','playPlaceSE','playComboSfx','playBurstSE','playWinSE2','playLoseSE','fxBell','fxAir'].map(n=>JSON.stringify(n)).join(',')}].forEach(n=>{this[n]=()=>{};});\nthis.testApi={ENERGY_CFG,energyAdvance,EnergyMeter,calcPts,HAND_NAV,handNeighbor,handPath,loadControlSide,ControlSettings,HandControls,SurvivalScreen,SurvivalResult,SurvivalRoles,survivalStage,SlideCard,VictoryMeter,ChargeScreen,ChargeResult,ChargeMeter,CHARGE_CFG,chargeStage,chargeAdvance,App,RUSH_CFG,rushRoundResult,rushStage,TitleScreen,RushScreen,RushResult};`,context);
 clock.reset();context.__capture=true;const app=context.testApi.App();if(!ai)app.silenceAi();
 return {clock,app,api:context.testApi,context,dom,render:()=>{cursor=0;context.__capture=false;return context.testApi.App();}};
}
module.exports={engine,makeClock};
if(require.main===module){
function start(){const e=engine();e.app.startRushBattle('normal');e.clock.advance(5000);assert.equal(e.app.phaseR.current,'playing');assert.equal(e.app.countNumR.current,-1);return e;}
function freshRound(e){e.app.startTimer(e.app.rnR.current);}
function ten(e,cards=[5,5],who='player'){e.app.completeTen(cards,who,e.app.rnR.current);}
// Reachable home entry, mode rules, difficulty callbacks, result callbacks.
{
 const e=engine();const walk=(x,out=[])=>{if(x&&typeof x==='object'){out.push(x);(x.children||[]).flat(Infinity).forEach(y=>walk(y,out));}return out;};
 let clicked=0;const tree=e.api.TitleScreen({onRush:()=>clicked++});const button=walk(tree).find(n=>n.type==='button'&&n.children[0]==='10秒ラッシュ');assert.ok(button);button.props.onClick();assert.equal(clicked,1);
 const entry=e.api.RushScreen({onBattle:d=>{assert.equal(d,'normal');clicked++;},onBack:()=>clicked++});walk(entry).find(n=>n.children[0]==='チャレンジする').props.onClick();assert.equal(clicked,2);
 assert.equal(e.api.rushStage('hard').rush,true);assert.equal(e.api.rushStage('normal').noBoost,true);
}
// Ten scores roles, clears only the board, and the original deadline keeps running.
{
 const e=start();freshRound(e);const deadline=e.app.rushDeadlineR.current;ten(e,[1,2,3,4]);assert.equal(e.app.pPtR.current,5);assert.equal(e.app.rushMatchR.current.pWins,0);assert.equal(e.app.rnR.current,1);
 e.clock.advance(200);assert.equal(e.app.fieldR.current.length,0);assert.equal(e.app.rushDeadlineR.current,deadline);assert.equal(e.app.resolvingR.current,false);
 ten(e,[5,5],'dealer');e.clock.advance(300);assert.equal(e.app.dPtR.current,1);assert.ok(e.app.timeLeftR.current<10);
 e.clock.advance(9500);assert.equal(e.app.rushMatchR.current.pWins,1);assert.equal(e.app.rushMatchR.current.history.length,1);assert.equal(e.app.rushMatchR.current.history[0].pp,5);
 e.app.finishRushRound(1);assert.equal(e.app.rushMatchR.current.pWins,1);
 e.clock.advance(2500);assert.equal(e.app.rnR.current,2);assert.equal(e.app.pPtR.current,0);assert.equal(e.app.dPtR.current,0);assert.equal(e.app.pHR.current.length,10);assert.equal(e.app.dHR.current.length,10);
}
// Burst gives the opponent one point; four-card reset stays in the same round.
{
 const e=start();freshRound(e);const end=e.app.rushDeadlineR.current;
 e.app.resolvePlay(5,[3,4],7,'player',1);assert.equal(e.app.dPtR.current,1);assert.equal(e.app.pPtR.current,0);e.clock.advance(200);
 e.app.resolvePlay(5,[3,4],7,'dealer',1);assert.equal(e.app.pPtR.current,1);e.clock.advance(200);
 e.app.resolvePlay(1,[1,1,1],3,'player',1);e.clock.advance(200);assert.equal(e.app.fieldR.current.length,0);assert.equal(e.app.rnR.current,1);assert.equal(e.app.rushDeadlineR.current,end);
}
// A queued card at exactly zero cannot score, even before the timer callback runs.
{
 const e=start();freshRound(e);e.clock.jump(10000);ten(e,[1,2,3,4]);assert.equal(e.app.pPtR.current,0);assert.equal(e.app.rushMatchR.current.history.length,1);assert.equal(e.app.rushMatchR.current.history[0].winner,'draw');
 e.app.finishRushRound(1);assert.equal(e.app.rushMatchR.current.history.length,1);
}
// Winning five points does not end a match; five rounds does. Draws count for neither.
for(const winner of ['player','dealer']){
 const e=start();const before=JSON.stringify(e.app.saveR.current);
 for(let i=0;i<5;i++){
   freshRound(e);ten(e,[1,2,3,4],winner);e.clock.advance(10000);
   if(i<4){assert.equal(e.app.phaseR.current,'playing');e.clock.advance(2500);}else assert.equal(e.app.phaseR.current,'gameEnd');
 }
 assert.equal(e.app.rushMatchR.current[winner==='player'?'pWins':'dWins'],5);
 assert.equal(JSON.stringify(e.app.saveR.current),before,'rush must not award puzzle pieces or stars');
 const count=e.app.rushMatchR.current.history.length;e.clock.advance(10000);assert.equal(e.app.rushMatchR.current.history.length,count);
}
// Empty hand refills immediately; no cross-round refill timer is left behind.
{
 const e=start();freshRound(e);e.app.dealPlayer([5,...Array(9).fill(null)]);e.app.playCard(0);assert.equal(e.app.pHR.current.length,10);assert.equal(e.app.pHR.current.filter(v=>v!==null).length,10);
}
// Leaving during countdown, board settlement, or round break cancels future play.
for(const when of ['countdown','settlement','break']){
 const e=when==='countdown'?engine():start();if(when==='countdown')e.app.startRushBattle('normal');else{freshRound(e);ten(e);if(when==='break')e.clock.advance(10000);}
 e.app.goHome();const before=e.app.rushMatchR.current.history.length;e.clock.advance(15000);assert.equal(e.app.phaseR.current,'rush');assert.equal(e.app.stageOptsR.current,null);assert.equal(e.app.rushMatchR.current.history.length,before);
}
// A returned card can be launched again before its first animation callback fires.
// That stale callback must not land the second launch early.
{
 const e=start();freshRound(e);e.app.setDealer([5,3,2]);const id=e.app.dIdsR.current[0];
 e.app.commitDealerPlay({id,value:5},1);e.clock.advance(50);ten(e);e.clock.advance(200);
 e.app.commitDealerPlay({id,value:5},1);const second=e.app.flyR.current;assert.ok(second);
 e.clock.advance(100);assert.equal(e.app.flyR.current,second);assert.equal(e.app.fieldR.current.length,0);
 e.clock.advance(200);assert.equal(e.app.flyR.current,null);assert.equal(e.app.fieldR.current[0],5);
}
// A valid last-moment score counts, but its board-reset callback cannot reopen a closed round.
{
 const e=start();freshRound(e);e.clock.advance(9950);ten(e);e.clock.advance(250);
 assert.equal(e.app.rushMatchR.current.pWins,1);assert.equal(e.app.resolvingR.current,true);assert.equal(e.app.rushClosedR.current,true);
}
// Existing normal battle still ends a round on ten and applies its original burst penalty.
{
 const e=engine();e.app.stageOptsR.current={};e.app.stageR.current=null;e.app.phaseR.current='playing';e.app.countNumR.current=-1;e.app.completeTen([5,5],'player',1);assert.equal(e.app.pPtR.current,1);assert.equal(e.app.resolvingR.current,true);assert.equal(e.app.rushMatchR.current.history.length,0);
 e.clock.advance(4100);assert.equal(e.app.rnR.current,2);
 const b=engine();b.app.stageOptsR.current={};b.app.phaseR.current='playing';b.app.pPtR.current=4;b.app.resolvePlay(5,[3,4],7,'player',1);assert.equal(b.app.pPtR.current,2);assert.equal(b.app.dPtR.current,0);
}
// v293: rush has no burst. A card that would pass 10 bounces back and stays in hand; the CPU never plays past 10.
{
 const e=start();freshRound(e);e.app.dealPlayer([5,4,3,...Array(7).fill(null)]);e.app.setDealer([]);
 e.app.playCard(0);e.clock.advance(400);e.app.playCard(1);e.clock.advance(400);
 assert.equal(e.app.fieldSumR.current,9);
 e.app.playCard(2);e.clock.advance(400);
 assert.equal(e.app.fieldSumR.current,9,'over-10 card is bounced, not played');assert.equal(e.app.pHR.current[2],3,'bounced card stays in hand');assert.equal(e.app.dPtR.current,0,'no burst point');
}
console.log('PASS: rush home entry; role scoring; uninterrupted deadline; burst; v293 no-burst bounce; board reset; exact-deadline rejection; ties; both match winners; refill; leave/cancel; unchanged saves and normal rules.');

}
