// NEXT-specific regression checks. Run: node tests/next-mode.cjs
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const take=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const nodes=[];
const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
const node=()=>({connect(){},disconnect(){},start(){nodes.push(this);},stop(){if(this.onended)this.onended();},gain:param(),frequency:param(),playbackRate:param()});
const context={Math,Number,Promise,Set,resumeAC(){},AC:{currentTime:0,destination:{},createBufferSource:node,createGain:node,createOscillator:node,createDynamicsCompressor:()=>({...node(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()})}};
vm.createContext(context);
vm.runInContext(take('function calcPts(cards)','// v286: normal battles')+take('function canPlay(v,fieldSum,field)','// ── BGM')+take('const NX_CFG=','function NextMode(')+'\nthis.api={nxLegal,nxPoints,nxDraw,nxSE,nxStopAudio,NX_AUDIO,NX_CFG,NX_AI};',context);
const a=context.api;
// Exhaust every field of up to four cards, covering third/fourth-card restrictions.
function visit(field){for(let v=1;v<=5;v++){const total=field.reduce((x,y)=>x+y,0)+v,n=field.length+1;const expected=n<=4&&total<=10&&(n!==3||total>=5)&&(n!==4||total===10);assert.equal(a.nxLegal(v,field),expected,JSON.stringify({field,v}));}if(field.length<4)for(let v=1;v<=5;v++)visit([...field,v]);}
visit([]);
for(const [cards,points] of [[[5,5],1],[[4,4,2],1],[[1,1,3,5],2],[[1,1,4,4],3],[[2,2,2,4],4],[[1,2,3,4],5]])assert.equal(a.nxPoints(cards).total,points);
let q=[];for(let i=0;i<500;i++){q=a.nxDraw(q.slice(1));assert.equal(q.length,9);assert(q.every(n=>n>=1&&n<=5));assert(!q.some((v,k)=>k>1&&v===q[k-1]&&v===q[k-2]));}
// Samples must come from the new dedicated buffers, with quieter opponent cues.
a.NX_AUDIO.buffers.play={name:'new-place'};a.NX_AUDIO.buffers.discard={name:'new-discard'};a.NX_AUDIO.buffers.complete={name:'new-complete'};
for(const kind of ['play','discard','complete']){a.nxSE(kind);assert.equal(nodes.at(-1).buffer,a.NX_AUDIO.buffers[kind]);}
assert.equal(a.NX_AUDIO.voices.size,3);a.nxStopAudio();assert.equal(a.NX_AUDIO.voices.size,0);
const nextCode=take('const NX_CFG=','function DiceMode(');
assert(!/playPlaceSE\(|playGoSE\(|playMissSE\(|fxBell\(|fxAir\(|fxTone\(/.test(nextCode),'NEXT must never call the old sound palette');
for(const name of ['place','discard','complete'])assert(fs.existsSync(require('node:path').join(__dirname,'../se/next-v320/'+name+'.mp3')));
assert.equal(Object.keys(a.NX_AI).length,3);assert.equal(a.NX_CFG.roundSec,10);
for(let i=0;i<10;i++)assert(fs.existsSync(require('node:path').join(__dirname,'../img/next-v319/digit-'+i+'.webp')));
console.log('NEXT: exhaustive legal moves, scoring, queue refill, SE dispatch and generated digits passed.');
