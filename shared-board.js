// Shared 4×4 battle. The state owns both cursors and consumes cards synchronously.
const SHARED_CFG={cols:4,size:16,stepMs:160,roundMs:10000,target:10,settleMs:1100};
function sharedNeighbor(slot,dir){
 const row=Math.floor(slot/4),col=slot%4;
 if(dir==='left'&&col>0)return slot-1;
 if(dir==='right'&&col<3)return slot+1;
 if(dir==='up'&&row>0)return slot-4;
 if(dir==='down'&&row<3)return slot+4;
 return slot;
}
function sharedDistance(a,b){return Math.abs(a%4-b%4)+Math.abs(Math.floor(a/4)-Math.floor(b/4));}
function sharedDeck(random=Math.random){
 const cards=Array.from({length:16},(_,i)=>i<15?i%5+1:Math.floor(random()*5)+1);
 for(let i=15;i>0;i--){const j=Math.floor(random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];}
 return cards;
}
function sharedCreate(random=Math.random){
 return {board:sharedDeck(random),cursor:{player:13,dealer:2},ready:{player:0,dealer:0},score:{player:0,dealer:0},field:[],sum:0,
  phase:'ready',paused:false,now:0,left:SHARED_CFG.roundMs,round:1,epoch:0,revision:0,feedback:'',winner:null,aiTarget:-1,aiThinkAt:0,lastPlay:null};
}
function sharedLegal(s,slot){return s.board[slot]!=null&&canPlay(s.board[slot],s.sum,s.field.map(c=>c.value));}
function sharedMove(s,who,dir){
 if(s.phase!=='active'||s.paused||s.now<s.ready[who])return false;
 const next=sharedNeighbor(s.cursor[who],dir);if(next===s.cursor[who])return false;
 s.cursor[who]=next;s.ready[who]=s.now+SHARED_CFG.stepMs;return true;
}
function sharedSettle(s,message){
 s.feedback=message;s.aiTarget=-1;s.epoch++;
 if(s.score.player>=SHARED_CFG.target||s.score.dealer>=SHARED_CFG.target){
  s.phase='ended';s.winner=s.score.player>=SHARED_CFG.target?'player':'dealer';
 }else{s.phase='settling';s.settleAt=s.now+SHARED_CFG.settleMs;}
}
function sharedPlay(s,who,epoch=s.epoch){
 if(s.phase!=='active'||s.paused||epoch!==s.epoch||s.now<s.ready[who]||s.left<=0)return false;
 const slot=s.cursor[who];if(!sharedLegal(s,slot))return false;
 const value=s.board[slot],other=who==='player'?'dealer':'player';
 // Preserve the existing game's protection against a near-simultaneous accidental burst.
 if(s.sum+value>10&&s.lastPlay&&s.lastPlay.by===other&&s.now-s.lastPlay.at<220)return false;
 s.board[slot]=null;s.field.push({value,by:who});s.sum+=value;s.revision++;
 s.lastPlay={by:who,at:s.now};s.ready[who]=s.now+SHARED_CFG.stepMs;s.aiThinkAt=s.now+120;s.aiTarget=-1;
 if(s.sum===10){const role=calcPts(s.field.map(c=>c.value));s.score[who]+=role.total;sharedSettle(s,(who==='player'?'YOU':'DEALER')+' · '+role.label);}
 else if(s.sum>10){s.score[who]=Math.max(0,s.score[who]-2);sharedSettle(s,(who==='player'?'YOU':'DEALER')+' · バースト −2pt');}
 else if(!s.board.some((v,i)=>v!=null&&v+s.sum<=10&&sharedLegal(s,i)))sharedSettle(s,'出せる札がないので、場をリセット');
 return true;
}
function sharedRefill(s,random=Math.random){
 // Occupied cells and cursor positions stay fixed. Only consumed cards are replaced.
 s.board=s.board.map(v=>v==null?Math.floor(random()*5)+1:v);
 s.field=[];s.sum=0;s.lastPlay=null;s.round++;s.revision++;s.epoch++;s.left=SHARED_CFG.roundMs;
 s.ready={player:s.now+SHARED_CFG.stepMs,dealer:s.now+SHARED_CFG.stepMs};
 s.aiTarget=-1;s.aiThinkAt=s.now+280;s.phase='active';s.feedback='';
}
function sharedAiTarget(s){
 let best=-1,bestScore=-Infinity;
 for(let i=0;i<16;i++){
  if(!sharedLegal(s,i)||s.board[i]+s.sum>10)continue;
  const value=s.board[i],sum=s.sum+value,travel=sharedDistance(s.cursor.dealer,i);
  let score;
  if(sum===10)score=1000+calcPts([...s.field.map(c=>c.value),value]).total*20-travel*25;
  else{
   score=50-travel*7+(i===s.cursor.player?9:0);
   const finishers=s.board.map((v,j)=>j!==i&&v!=null&&v+sum===10?j:-1).filter(j=>j>=0);
   if(finishers.length){
    const mine=Math.min(...finishers.map(j=>sharedDistance(i,j)+1));
    // The player can move while the dealer approaches its first card.
    const theirs=Math.max(0,Math.min(...finishers.map(j=>sharedDistance(s.cursor.player,j)))-travel);
    score+=(theirs-mine)*18;
   }
  }
  if(score>bestScore){bestScore=score;best=i;}
 }
 return best;
}
function sharedTick(s,ms,random=Math.random,withAi=true){
 if(s.paused||s.phase==='ready'||s.phase==='ended')return;
 s.now+=Math.max(0,ms);
 if(s.phase==='settling'){if(s.now>=s.settleAt)sharedRefill(s,random);return;}
 s.left=Math.max(0,s.left-Math.max(0,ms));
 if(s.left<=0){sharedSettle(s,'時間切れ · 場をリセット');return;}
 if(!withAi)return;
 if(s.now>=s.aiThinkAt){s.aiTarget=sharedAiTarget(s);s.aiThinkAt=s.now+240;}
 const target=s.aiTarget;
 if(target<0||!sharedLegal(s,target)||s.now<s.ready.dealer)return;
 const from=s.cursor.dealer;
 if(from===target){sharedPlay(s,'dealer');return;}
 const dir=from%4!==target%4?(from%4<target%4?'right':'left'):(from<target?'down':'up');
 sharedMove(s,'dealer',dir);
}
function SharedBoardMode({side,onSideChange,onBack}){
 const game=useRef(null);if(!game.current)game.current=sharedCreate();
 const[,render]=useState(0),last=useRef(performance.now()),shown=useRef(''),dialog=useRef(null),pauseButton=useRef(null);
 const s=game.current;
 function paint(){render(n=>n+1);}
 function sync(){const now=performance.now();sharedTick(game.current,now-last.current);last.current=now;}
 function act(fn){sync();const before=game.current.revision,ok=fn(game.current);if(ok&&game.current.revision!==before){try{playPlaceSE();}catch(e){}}paint();}
 function pause(){sync();if(game.current.phase==='ended')return;game.current.paused=true;paint();}
 function resume(){game.current.paused=false;last.current=performance.now();paint();requestAnimationFrame(()=>pauseButton.current&&pauseButton.current.focus());}
 function start(){game.current.phase='active';game.current.aiThinkAt=350;last.current=performance.now();paint();}
 function retry(){game.current=sharedCreate();last.current=performance.now();paint();}
 useEffect(()=>{
  const timer=setInterval(()=>{sync();paint();},32);
  const hidden=()=>{if(document.hidden&&game.current.phase!=='ready')pause();};
  const blur=()=>{if(game.current.phase==='active'||game.current.phase==='settling')pause();};
  document.addEventListener('visibilitychange',hidden);window.addEventListener('blur',blur);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('blur',blur);};
 },[]);
 const modal=s.paused||s.phase==='ready'||s.phase==='ended';
 useEffect(()=>{if(modal&&dialog.current){const el=dialog.current.querySelector('button');if(el)el.focus();}},[modal,s.phase]);
 useEffect(()=>{
  if(s.feedback&&shown.current!==s.feedback){shown.current=s.feedback;try{if(s.sum===10)fxBell({f:s.winner==='dealer'?660:1046,v:.08,d:.35});}catch(e){}}
  if(!s.feedback)shown.current='';
 },[s.feedback]);
 const active=s.phase==='active'&&!s.paused;
 const value=s.board[s.cursor.player];
 const playable=active&&s.now>=s.ready.player&&sharedLegal(s,s.cursor.player);
 const hint=value==null?'空きマス · 十字キーで移動':!sharedLegal(s,s.cursor.player)?'この札は今は出せない':s.sum+value>10?'この札を出すとバースト':s.sum+value===10?'この札で10になる':'十字キーで選んで「出す」';
 function trap(e){
  if(e.key==='Escape'&&s.paused){e.preventDefault();resume();return;}
  if(e.key!=='Tab')return;
  const els=[...e.currentTarget.querySelectorAll('button,input')].filter(el=>!el.disabled),first=els[0],end=els[els.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();end.focus();}
  else if(!e.shiftKey&&document.activeElement===end){e.preventDefault();first.focus();}
 }
 return h('main',{className:'shared-screen'},
  h('div',{className:'shared-shell',inert:modal?'':undefined},
   h('header',{className:'shared-header'},h('div',null,h('span',{className:'shared-eyebrow'},'TEN-KURU'),h('h1',null,'4×4対戦')),
    h('span',{className:'shared-round'},'ROUND '+String(s.round).padStart(2,'0')),
    h('button',{ref:pauseButton,className:'shared-pause','aria-label':'一時停止',onClick:pause},'Ⅱ')),
   h('div',{className:'shared-hud'},
    h('div',{className:'shared-score player'},h('span',null,'YOU'),h('b',null,s.score.player),h('small',null,'あと '+Math.max(0,10-s.score.player)+'pt')),
    h('div',{className:'shared-time'+(s.left<=3000?' hurry':'')},h('span',null,'TIME'),h('b',null,Math.ceil(s.left/1000)),h('small',null,'10pt 先取')),
    h('div',{className:'shared-score dealer'},h('span',null,'DEALER'),h('b',null,s.score.dealer),h('small',null,'あと '+Math.max(0,10-s.score.dealer)+'pt'))),
   h('section',{className:'shared-field','aria-label':'場のカード'},
    h('div',{className:'shared-played'},Array.from({length:4},(_,i)=>{const card=s.field[i];return h('div',{key:i,className:'shared-played-card '+(card?card.by:'empty')},card?card.value:'');})),
    h('div',{className:'shared-sum'},h('span',null,'TOTAL'),h('b',null,s.sum),h('small',null,s.sum<=10?'あと '+(10-s.sum):'BURST'))),
   h('section',{className:'shared-arena','aria-label':'二人で使う16枚のカード'},
    h('div',{className:'shared-legend'},h('span',{className:'player'},'▼ YOU'),h('span',null,'SHARED CARDS'),h('span',{className:'dealer'},'DEALER ◆')),
    h('div',{className:'shared-grid'},s.board.map((v,i)=>{
     const p=s.cursor.player===i,d=s.cursor.dealer===i;
     return h('div',{key:i,'data-slot':i,className:'shared-cell'+(v==null?' empty':'')+(p?' player-cursor':'')+(d?' dealer-cursor':''),
      'aria-label':(Math.floor(i/4)+1)+'行'+(i%4+1)+'列 '+(v==null?'空き':v)+(p?' 自分の選択':'')+(d?' 相手の選択':'')},
      v!=null&&h('span',{className:'shared-value'},v),v!=null&&h('small',{className:'shared-corner'},v),
      p&&h('span',{className:'shared-marker player'},'YOU'),d&&h('span',{className:'shared-marker dealer'},'CPU'));
    })),
    s.phase==='settling'&&h('div',{className:'shared-settle',role:'status'},h('b',null,s.feedback),h('small',null,'空いたマスに補充'))),
   h('div',{className:'shared-hint'},hint),
   h(HandControls,{side,onMove:dir=>act(g=>sharedMove(g,'player',dir)),onPlay:()=>act(g=>sharedPlay(g,'player')),canMove:active,canPlay:playable})),
  modal&&h('div',{className:'shared-overlay'},h('section',{className:'shared-dialog',ref:dialog,role:'dialog','aria-modal':true,'aria-labelledby':'shared-dialog-title',onKeyDown:trap},
   h('div',{className:'shared-dialog-content'},h('p',{className:'shared-eyebrow'},'TEN-KURU · 4×4'),
   h('h2',{id:'shared-dialog-title'},s.paused?'ひとやすみ':s.phase==='ended'?(s.winner==='player'?'勝利！':'もう一勝負！'):'16枚の共有盤面'),
   s.phase==='ready'&&h(React.Fragment,null,
    h('p',{className:'shared-lead'},'相手のカーソルを見て、次の一手を。'),
    h('ul',null,h('li',null,'青が自分、オレンジが相手。十字キーで選んで「出す」。'),h('li',null,'最後の1枚で10にした側が、役の得点を獲得。10pt先取。'),h('li',null,'取ったマスは空いたまま。場のリセット時に補充。'),h('li',null,'1回の場は10秒。10を超えると自分が−2pt。')),
    h('p',{className:'shared-role-note'},'役なし 1 · ワンペア 2 · ツーペア 3\nスリーカード 4 · ストレート 5pt')),
   s.phase==='ended'&&!s.paused&&h(React.Fragment,null,h('p',{className:'shared-result'},'YOU '+s.score.player+' — '+s.score.dealer+' DEALER'),h('p',{className:'shared-lead'},s.feedback)),
   (s.paused||s.phase==='ready')&&h(ControlSettings,{side,onChange:onSideChange})),
   h('div',{className:'shared-dialog-actions'},h('button',{className:'shared-primary',onClick:s.paused?resume:s.phase==='ended'?retry:start},s.paused?'再開':s.phase==='ended'?'もう一度':'対戦する'),
   h('button',{className:'shared-secondary',onClick:onBack},'ホームへ')))));
}
