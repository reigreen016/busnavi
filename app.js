import {strings,translate,arrivalTime} from './i18n.js?v=16';
import {selectTrips} from './schedule.js?v=15';
import {upcomingGuidance} from './guidance.js?v=15';
import {fitPlatformStrips} from './platforms.js?v=15';
import {time,departureMarkup,destinationLabel} from './presentation.js?v=16';
import {applyRealtime,createRealtimePoller,fresh} from './realtime.js?v=16';
const REALTIME_ENDPOINT='https://busnavi-realtime.rnp9cf8k76.workers.dev/api/realtime';
let snapshot=null,poller;
const $=s=>document.querySelector(s),escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stops=['紙屋町','八丁堀'];
const boxes={1:[67.38,40.03,3.67,2.83],2:[67.38,35.66,3.67,2.83],3:[67.38,31.29,3.67,2.78],4:[67.38,26.97,3.67,2.78],5:[67.38,22.69,3.67,2.87],6:[46.38,35.87,3.56,2.83],7:[46.38,31.72,3.62,2.74],8:[46.38,27.31,3.62,2.91],9:[46.38,23.07,3.62,2.87],16:[37.72,92.29,4.44,3.38],17:[24.89,64.51,4.22,3.25],20:[25.66,28.77,4.5,3.34],21:[37.94,6.59,4.61,3.42],23:[25,4.45,4.44,3.25]};
function now(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date()).split(' ');}
let data,live=true,lang=localStorage.getItem('busnavi-language')||'ja';if(!strings[lang])lang='ja';
const translated=(value,feed)=>feed?translate(feed,lang,value):translate(data.feeds.find(f=>f.translations?.[lang]?.[value])||{},lang,value);
function render(){
 if(!data)return;const text=strings[lang];document.documentElement.lang=lang;$('#language').value=lang;document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=text[el.dataset.i18n]);
 stops.forEach((stop,i)=>{$(i?'#legend-hachi':'#legend-kami').textContent=(lang==='ja'?(i?'八 ':'紙 '):(i?'H ':'K '))+translated(stop);});
 $('#sources').innerHTML=data.feeds.map(f=>`<p>${f.agencies.map(a=>escape(translated(a,f))).join(' / ')}：${escape(f.info[0].feed_start_date)} ～ ${escape(f.info[0].feed_end_date)}</p>`).join('');
 const current=now();if(live){$('#date-input').value=current[0];$('#time-input').value=current[1].slice(0,5);}
 const date=$('#date-input').value,hm=$('#time-input').value,seconds=hm.split(':').reduce((a,b)=>a*60+Number(b),0)*60+(live?Number(current[1].slice(-2)):0);
 $('#clock-time').textContent=hm;$('#clock-mode').textContent=live?text.live:text.fixed;
 $('#service-label').textContent=date+' · '+new Intl.DateTimeFormat(lang,{weekday:'long',timeZone:'Asia/Tokyo'}).format(new Date(date+'T12:00:00+09:00'))+' · '+text.scheduled;
 const trips=selectTrips(data,{stops},date,seconds,t=>live?applyRealtime(t,data,snapshot,date,Date.now()/1000):t),guidance=upcomingGuidance(trips,stops),platforms=new Map(),overview=[];
 guidance.groups.forEach(({stop,available,platforms:pp},i)=>{
 overview.push(`<div class="platform-row platform-row--${i?'hachi':'kami'}"><h3>${escape(translated(stop))}</h3><div class="platform-strip" tabindex="0" aria-label="${escape(translated(stop)+' '+text.platform)}">${pp.length?pp.map(p=>`<span class="overview-number${p.length>1?' overview-number--double':''}"><span class="number-glyph">${escape(p)}</span></span>`).join(''):`<span class="platform-empty">${available?text.unknown:text.empty}</span>`}</div></div>`);
 pp.forEach(p=>{if(!platforms.has(p))platforms.set(p,new Set());platforms.get(p).add(i);});
 });
 $('#upcoming-platforms').innerHTML=overview.join('');fitPlatformStrips();
 $('#map-labels').innerHTML=Object.entries(boxes).map(([p,b])=>{const tags=platforms.get(p)||new Set();return `<div data-platform="${p}" class="stop-highlight ${tags.has(0)?'serves-kami':''} ${tags.has(1)?'serves-hachi':''}" style="left:${b[0]}%;top:${b[1]}%;width:${b[2]}%;height:${b[3]}%"><span class="stop-number">${escape(p)}</span><div class="stop-tags">${[...tags].sort().map(i=>`<span class="stop-tag ${i?'tag-hachi':'tag-kami'}">${lang==='ja'?(i?'八':'紙'):(i?'H':'K')}</span>`).join('')}</div></div>`;}).join('');

 const glowOffset=Date.now()%3000;
 $('#trip-list').innerHTML=trips.slice(0,20).map(t=>`<li class="trip${guidance.selected.has(t)?' trip--soon':''}" style="--glow-offset:-${glowOffset}ms"><div class="trip-time">${departureMarkup(t,lang)}</div><div class="trip-platform">${escape(t.platform||'—')}</div><div class="trip-body"><div class="trip-route">${escape(translated(t.route,data.feeds[t.feed]))} <span class="trip-headsign-inline">${escape(destinationLabel(translated(t.headsign,data.feeds[t.feed]),lang))}</span></div><div class="trip-meta">${stops.filter(s=>s in t.destinations).map((s)=>`<span class="chip chip-${s==='紙屋町'?'kami':'hachi'}" data-arrival-type="${t.arrivalPredictions?.[s]?'realtime':'scheduled'}">${escape(translated(s,data.feeds[t.feed]))} ${escape(arrivalTime(time(t.destinations[s]),lang))}${t.arrivalPredictions?.[s]?'':escape(lang==='ja'?'（'+text.scheduledShort+'）':' ('+text.scheduledShort+')')}</span>`).join('')}</div><small class="trip-agency">${escape(translated(t.agency,data.feeds[t.feed]))}</small></div></li>`).join('');
 const healthy=live?(snapshot?.feeds||[]).filter(f=>f.ok&&fresh(f.timestamp,Date.now()/1000)):[];
 $('#realtime-status').textContent=!live?text.rtHistorical:healthy.length?text.rtActive+(healthy.length<4?' · '+text.rtPartial:''):text.rtUnavailable;
 $('#realtime-updates').innerHTML=(snapshot?.feeds||[]).map(f=>`<p>${escape(translated(f.name))} · ${f.ok&&f.timestamp?escape(new Intl.DateTimeFormat(lang,{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(f.timestamp*1000))):'—'} · ${f.ok&&fresh(f.timestamp,Date.now()/1000)?text.rtUpdated:text.rtStale}</p>`).join('');
 const key=date.replaceAll('-',''),outside=data.feeds.some(f=>key<f.info[0].feed_start_date||key>f.info[0].feed_end_date);
 $('#error').hidden=!outside&&trips.length>0;$('#error').textContent=outside?text.outside:!trips.length?text.empty:'';
}
$('#settings').onsubmit=e=>{e.preventDefault();live=false;poller?.setEnabled(false);render();};$('#now-time').onclick=()=>{live=true;poller?.setEnabled(!document.hidden);render();};
try{const r=await fetch('data/timetable.json',{cache:'no-store'});if(!r.ok)throw Error(r.status);data=await r.json();$('#sources').innerHTML=data.feeds.map(f=>`<p>${f.agencies.map(escape).join(' / ')}：${escape(f.info[0].feed_start_date)} ～ ${escape(f.info[0].feed_end_date)}</p>`).join('');render();poller=createRealtimePoller({endpoint:REALTIME_ENDPOINT,onUpdate:value=>{snapshot=value;render();}});poller.setEnabled(!document.hidden);setInterval(()=>{if(live&&!document.hidden)render();},15000);}catch(e){$('#error').hidden=false;$('#error').textContent=strings[lang].error;console.error(e);}

$('#language').onchange=()=>{lang=$('#language').value;localStorage.setItem('busnavi-language',lang);render();};
setInterval(()=>{const phase=document.body.classList.toggle('phase-hachi');$('.map-wrapper').classList.toggle('phase-hachi',phase);},2000);

document.addEventListener('visibilitychange',()=>{poller?.setEnabled(live&&!document.hidden);if(!document.hidden)render();});

window.addEventListener('resize',()=>fitPlatformStrips());
