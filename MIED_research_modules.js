(()=>{
const $=id=>document.getElementById(id),RESEARCH_WAVES=['T0','T1','T2','T3'],ARM_KEY='mied_research_arms_v30',PRACTICE_KEY='mied_practice_access_v21',TASK_KEY='mied_daily_tasks_v27',html=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function groupData(){try{return JSON.parse(localStorage.getItem('mied_participant_groups_v22')||'{}')}catch(e){return{groups:[],assignments:{}}}}function arms(){try{return JSON.parse(localStorage.getItem(ARM_KEY)||'{}')}catch(e){return{}}}function saveArms(x){localStorage.setItem(ARM_KEY,JSON.stringify(x))}function armForGroup(group){const map=arms();return map[group]||(/对照/.test(group)?'control':'intervention')}function usage(){try{return JSON.parse(localStorage.getItem(PRACTICE_KEY)||'{"usage":[]}').usage||[]}catch(e){return[]}}function tasks(){try{return JSON.parse(localStorage.getItem(TASK_KEY)||'{"tasks":[]}').tasks||[]}catch(e){return[]}}
function participantArm(pid){const groups=groupData();let group=groups.assignments?.[pid];if(!group)try{group=allParticipants().find(x=>x.id===pid)?.group}catch(e){}return armForGroup(group||'待分组')}
function armParticipants(arm){
  try{
    const groups=groupData();
    return allParticipants().filter(person=>armForGroup(groups.assignments?.[person.id]||person.group||'待分组')===arm);
  }catch(e){return[]}
}
function recordScore(r){const meta=r.scores?._meta||{},v=meta.normalized??meta.overall;return Number.isFinite(Number(v))?Number(v):null}function waveData(arm,wave){const ids=new Set(armParticipants(arm).map(x=>x.id)),rows=(state.assessmentRecords||[]).filter(x=>ids.has(x.participantId)&&x.wave===wave),scores=rows.map(recordScore).filter(Number.isFinite);return{records:rows.length,participants:new Set(rows.map(x=>x.participantId)).size,mean:scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length*10)/10:null}}
function allArmData(arm){
  const participants=armParticipants(arm),ids=new Set(participants.map(x=>x.id));
  const rows=(state.assessmentRecords||[]).filter(record=>ids.has(record.participantId));
  const waves=Object.fromEntries(RESEARCH_WAVES.map(wave=>{
    const waveRows=rows.filter(record=>record.wave===wave),scores=waveRows.map(recordScore).filter(Number.isFinite);
    return[wave,{records:waveRows.length,participants:new Set(waveRows.map(x=>x.participantId)).size,mean:scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length*10)/10:null}];
  }));
  return{participants,waves,records:rows.length,completed:new Set(rows.map(x=>x.participantId)).size};
}
function dailyRecords(){const out=[];[...(state.dailyAssessmentRecords||[]),...(state.dailyScaleRecords||[])].forEach(r=>out.push(r));Object.entries(state.daily||{}).forEach(([date,d])=>[...(d.assessmentRecords||[]),...(d.scaleRecords||[]),...(d.assessments||[])].forEach(r=>out.push({...r,date:r.date||date})));return out}function dailyKind(r){const text=`${r.scaleKey||r.scale_id||''} ${r.scaleName||r.scale_name||''}`.toLowerCase();return/哀伤|grief|pg/.test(text)?'grief':/正念|mind|ffmq/.test(text)?'mindfulness':''}function dailySeries(arm,kind){const rows=dailyRecords().filter(r=>participantArm(r.participantId||'MIED-001')===arm&&dailyKind(r)===kind),map={};rows.forEach(r=>{const date=r.date||String(r.completedAt||'').slice(0,10),score=recordScore(r)??Number(r.totalScore??r.total_score);if(!date||!Number.isFinite(score))return;(map[date]=map[date]||[]).push(score)});return Object.entries(map).sort(([a],[b])=>a.localeCompare(b)).map(([date,values])=>({date,value:values.reduce((a,b)=>a+b,0)/values.length}))}
function lineSvg(seriesA,seriesB,labels=RESEARCH_WAVES){const width=650,height=220,pad=36,all=[...seriesA,...seriesB].filter(Number.isFinite),max=Math.max(100,...all),min=Math.min(0,...all),x=i=>pad+i*(width-pad*2)/Math.max(1,labels.length-1),y=v=>height-pad-(v-min)/(max-min||1)*(height-pad*2),points=arr=>arr.map((v,i)=>Number.isFinite(v)?`${x(i)},${y(v)}`:null).filter(Boolean).join(' ');return`<svg class="svg-chart" viewBox="0 0 ${width} ${height}" role="img"><g stroke="#e1e8e4" stroke-width="1">${[0,1,2,3,4].map(i=>`<line x1="${pad}" y1="${pad+i*(height-pad*2)/4}" x2="${width-pad}" y2="${pad+i*(height-pad*2)/4}"/>`).join('')}</g><polyline fill="none" stroke="#2e746b" stroke-width="4" points="${points(seriesA)}"/><polyline fill="none" stroke="#ad7a42" stroke-width="4" points="${points(seriesB)}"/>${labels.map((l,i)=>`<text x="${x(i)}" y="${height-10}" text-anchor="middle" fill="#718084" font-size="11">${l}</text>`).join('')}${seriesA.map((v,i)=>Number.isFinite(v)?`<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="#2e746b"/>`:'').join('')}${seriesB.map((v,i)=>Number.isFinite(v)?`<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="#ad7a42"/>`:'').join('')}</svg>`}
function comparisonSvg(a,b,label='最新可用均分'){const max=Math.max(100,a||0,b||0),h=190,y=v=>160-(v||0)/max*125;return`<svg class="svg-chart" viewBox="0 0 330 210"><line x1="35" y1="160" x2="300" y2="160" stroke="#dfe7e3"/><rect x="75" y="${y(a)}" width="70" height="${160-y(a)}" rx="7" fill="#2e746b"/><rect x="190" y="${y(b)}" width="70" height="${160-y(b)}" rx="7" fill="#ad7a42"/><text x="110" y="180" text-anchor="middle" font-size="11" fill="#60726e">干预组</text><text x="225" y="180" text-anchor="middle" font-size="11" fill="#60726e">对照组</text><text x="110" y="${y(a)-7}" text-anchor="middle" font-size="12" fill="#2e746b">${a??'—'}</text><text x="225" y="${y(b)-7}" text-anchor="middle" font-size="12" fill="#ad7a42">${b??'—'}</text></svg>`}
function dailyChart(kind,title){const a=dailySeries('intervention',kind),b=dailySeries('control',kind),dates=[...new Set([...a.map(x=>x.date),...b.map(x=>x.date)])].sort().slice(-14);if(!dates.length)return`<article class="research-chart-card"><h3>${title}</h3><p>按研究组汇总的每日平均得分</p><div class="empty-chart">暂无每日${title}记录，产生数据后自动生成趋势图。</div></article>`;const av=dates.map(d=>a.find(x=>x.date===d)?.value),bv=dates.map(d=>b.find(x=>x.date===d)?.value);return`<article class="research-chart-card"><h3>${title}</h3><p>最近14个记录日的组均值</p>${lineSvg(av,bv,dates.map(x=>x.slice(5)))}</article>`}
function renderAssessmentResearch(){const page=$('admin-assessments');if(!page)return;const head=page.querySelector('.admin-page-head');head.querySelector('span').textContent='测量节点与研究组量表数据';head.querySelector('h2').textContent='量表测评';head.querySelector('p').textContent='先管理 T0、T1、T2、T3 四个测量节点的开放状态，再查看干预组与对照组的完成情况、组间趋势及每日哀伤/正念数据。';[...page.children].filter(x=>!x.classList.contains('admin-page-head')&&x.id!=='researchAssessmentRoot').forEach(x=>x.style.display='');let root=$('researchAssessmentRoot');if(!root){root=document.createElement('div');root.id='researchAssessmentRoot';page.appendChild(root)}const groups=groupData().groups||[],intervention=allArmData('intervention'),control=allArmData('control'),seriesA=RESEARCH_WAVES.map(w=>intervention.waves[w].mean),seriesB=RESEARCH_WAVES.map(w=>control.waves[w].mean),latestA=[...seriesA].reverse().find(Number.isFinite),latestB=[...seriesB].reverse().find(Number.isFinite);root.innerHTML=`<div class="panel-head" style="margin-top:18px"><div><small>补充分组分析</small><h3>干预组与对照组趋势</h3></div><span class="panel-tag">T0–T3</span></div><div class="arm-config"><b>研究分组归类</b><div>${groups.map(g=>`<label class="arm-chip">${html(g)}<select data-arm-group="${html(g)}"><option value="intervention" ${armForGroup(g)==='intervention'?'selected':''}>干预组</option><option value="control" ${armForGroup(g)==='control'?'selected':''}>对照组</option></select></label>`).join('')}</div></div><div class="arm-overview-grid">${armCard('intervention','干预组',intervention)}${armCard('control','对照组',control)}</div><div class="research-chart-grid"><article class="research-chart-card"><h3>T0–T3 总体量表趋势</h3><p>各时间点全部量表得分的组均值</p>${lineSvg(seriesA,seriesB)}<div class="chart-legend"><span><i style="background:#2e746b"></i>干预组</span><span><i style="background:#ad7a42"></i>对照组</span></div></article><article class="research-chart-card"><h3>两组最新结果对比</h3><p>取各组最新有数据时间点的平均分</p>${comparisonSvg(latestA,latestB)}</article></div><div class="daily-chart-grid">${dailyChart('grief','每日哀伤')}${dailyChart('mindfulness','每日正念')}</div>`;root.querySelectorAll('[data-arm-group]').forEach(select=>select.onchange=()=>{const x=arms();x[select.dataset.armGroup]=select.value;saveArms(x);renderAssessmentResearch()})}
function armCard(kind,label,data){return`<article class="arm-card ${kind==='control'?'control':''}"><div class="arm-card-head"><div><h3>${label}</h3><small>${kind==='control'?'仅展示测评与随访必要信息':'展示完整干预测评进度'}</small></div><span>${data.participants.length} 人</span></div><div class="arm-kpis"><div><b>${data.records}</b><span>量表记录</span></div><div><b>${data.completed}</b><span>已有测评参与者</span></div><div><b>${data.participants.length?Math.round(data.completed/data.participants.length*100):0}%</b><span>参与覆盖</span></div></div><div class="wave-stat-grid">${Object.entries(data.waves).map(([w,x])=>`<div class="wave-stat"><b>${w}</b><span>${x.records}份 · ${x.mean??'—'}分</span></div>`).join('')}</div></article>`}
function ensureNavigation(){const nav=document.querySelector('.admin-nav'),intervention=nav?.querySelector('[data-admin-page="intervention"]'),assessment=nav?.querySelector('[data-admin-page="assessments"]');if(intervention){intervention.innerHTML='<i>课</i>课堂考勤';intervention.dataset.adminPage='intervention'}if(assessment)assessment.innerHTML='<i>测</i>量表测评';if(nav&&!nav.querySelector('[data-admin-page="practice-records"]'))assessment?.insertAdjacentHTML('afterend','<button data-admin-page="practice-records"><i>练</i>练习记录</button>');if(!$('admin-practice-records'))$('admin-assessments')?.insertAdjacentHTML('afterend','<section class="admin-page" id="admin-practice-records"><div class="admin-page-head"><div><span>任务与资源练习</span><h2>练习记录</h2><p>分别查看打卡任务和自愿练习的发布、完成与使用记录；练习权限在自愿练习页维护。</p></div></div><div class="research-module-tabs"><button data-practice-module="task">打卡任务</button><button data-practice-module="resource">自愿练习</button></div><div class="practice-module-view" id="taskPracticeRecords"></div><div class="practice-module-view" id="resourcePracticeRecords"></div></section>');document.querySelectorAll('[data-admin-page="practice-records"]').forEach(x=>x.onclick=()=>showAdminPage('practice-records'))}
function renderAttendance(){const page=$('admin-intervention');if(!page)return;const head=page.querySelector('.admin-page-head');head.querySelector('span').textContent='八周课堂记录';head.querySelector('h2').textContent='课堂考勤';head.querySelector('p').textContent='记录并同步每位参与者八周课程的实际出勤分钟数、完成状态和课程材料。';head.querySelector('button')?.classList.add('hidden');$('interventionCourseView')?.classList.add('active')}
function renderPracticeRecords(){const page=$('admin-practice-records');if(!page)return;const active=adminState.practiceRecordTab||'task';page.querySelectorAll('[data-practice-module]').forEach(x=>{x.classList.toggle('active',x.dataset.practiceModule===active);x.onclick=()=>{adminState.practiceRecordTab=x.dataset.practiceModule;saveAdmin();renderPracticeRecords()}});page.querySelectorAll('.practice-module-view').forEach(x=>x.classList.toggle('active',x.id===(active==='task'?'taskPracticeRecords':'resourcePracticeRecords')));const logs=usage().filter(x=>x.status==='completed'),published=tasks(),recommended=logs.filter(x=>x.recommended),voluntary=logs.filter(x=>!x.recommended);$('taskPracticeRecords').innerHTML=`<div class="practice-record-summary"><div><b>${published.length}</b><span>已发布任务</span></div><div><b>${recommended.length}</b><span>推荐练习完成</span></div><div><b>${recommended.reduce((a,b)=>a+(Number(b.minutes)||0),0)}</b><span>完成分钟</span></div><div><b>${new Set(recommended.map(x=>x.participantId)).size}</b><span>参与者</span></div></div><article class="admin-panel"><div class="panel-head"><div><small>任务发布与完成</small><h3>打卡任务记录</h3></div></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>日期/时间</th><th>参与者或分组</th><th>任务</th><th>状态</th><th>时长</th></tr></thead><tbody>${[...published.map(x=>({time:x.date,target:x.group==='all'?'全部分组':x.group,name:x.practices.join(' + '),status:'已发布',minutes:'—'})),...recommended.map(x=>({time:new Date(x.usedAt).toLocaleString('zh-CN'),target:x.participantId,name:x.title,status:'已完成',minutes:`${x.minutes||0}分钟`}))].map(x=>`<tr><td>${html(x.time)}</td><td>${html(x.target)}</td><td>${html(x.name)}</td><td>${x.status}</td><td>${x.minutes}</td></tr>`).join('')||'<tr><td colspan="5">暂无打卡任务记录。</td></tr>'}</tbody></table></div></article>`;$('resourcePracticeRecords').innerHTML=`<div class="practice-record-summary"><div><b>${voluntary.length}</b><span>自愿练习完成</span></div><div><b>${voluntary.reduce((a,b)=>a+(Number(b.minutes)||0),0)}</b><span>练习分钟</span></div><div><b>${new Set(voluntary.map(x=>x.participantId)).size}</b><span>参与者</span></div><div><b>${practices.length}</b><span>可配置练习</span></div></div><article class="admin-panel"><div class="panel-head"><div><small>自主使用</small><h3>自愿练习使用记录</h3></div></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>参与者</th><th>练习</th><th>完成时间</th><th>时长</th><th>心灯</th></tr></thead><tbody>${voluntary.map(x=>`<tr><td>${html(x.participantId)}</td><td>${html(x.title)}</td><td>${new Date(x.usedAt).toLocaleString('zh-CN')}</td><td>${x.minutes||0}分钟</td><td>+${x.awarded||0}</td></tr>`).join('')||'<tr><td colspan="5">暂无自愿练习记录。</td></tr>'}</tbody></table></div></article>`;const access=$('participantPracticeAccess'),usagePanel=$('participantPracticeUsage');if(access)$('resourcePracticeRecords').appendChild(access);if(usagePanel)usagePanel.classList.add('hidden')}
function configureSettings(){const page=$('admin-settings');if(!page)return;const tz=$('studyTimezone')?.closest('label');if(tz)tz.remove();const versionInput=$('studyVersion');if(versionInput){const panel=versionInput.closest('.admin-panel');versionInput.closest('label')?.remove();let rollback=$('versionRollbackPanel');if(!rollback){rollback=document.createElement('div');rollback.id='versionRollbackPanel';rollback.className='version-rollback-panel';panel.appendChild(rollback)}const history=adminState.versionHistory||[];rollback.innerHTML=`<h3>平台版本与回退</h3><div class="version-rollback-row"><label>选择运行版本<select id="studyVersionSelect"><option value="v0.30 · 2026-08">v0.30 · 当前版本</option><option value="v0.29 · 2026-08">v0.29 · 参与者总览</option><option value="v0.27 · 2026-08">v0.27 · 打卡任务发布</option><option value="v0.15 · 2026-07">v0.15 · 课程同步</option><option value="v0.10 · 2026-07">v0.10 · 初始研究版</option></select></label><button id="rollbackVersion">回退到所选版本</button></div><div class="version-history">${history.slice(0,5).map(x=>`<div><span>${html(x.version)}</span><span>${html(x.time)} · ${html(x.operator||'研究管理员')}</span></div>`).join('')||'<div><span>尚无版本回退记录</span><span>—</span></div>'}</div>`;$('studyVersionSelect').value=adminState.settings?.studyVersion||'v0.30 · 2026-08';$('rollbackVersion').onclick=()=>{const version=$('studyVersionSelect').value;if(!confirm(`确认将研究配置回退到 ${version}？本原型只切换配置版本，不删除现有研究数据。`))return;adminState.settings={...(adminState.settings||{}),studyVersion:version};adminState.versionHistory=[{version,time:new Date().toLocaleString('zh-CN'),operator:'研究管理员'},...(adminState.versionHistory||[])];addAdminActivity(`研究配置版本回退至 ${version}`);saveAdmin();configureSettings();toast('版本配置已切换。')}}if($('saveAdminSettings'))$('saveAdminSettings').onclick=()=>{adminState.settings={...(adminState.settings||{}),studyName:$('studyName')?.value||'',studyVersion:$('studyVersionSelect')?.value||'v0.30 · 2026-08'};addAdminActivity('研究基础设置已保存');saveAdmin();toast('研究设置已保存。')}}
function normalizeResearchNavigation(){
  document.querySelectorAll('[data-admin-page="intervention"]').forEach(button=>{
    button.innerHTML=button.querySelector('i')?'<i>课</i>课堂考勤':'课堂考勤';
  });
  document.querySelectorAll('[data-admin-page="assessments"]').forEach(button=>{
    button.innerHTML=button.querySelector('i')?'<i>测</i>量表测评':'量表测评';
  });
  const more=document.querySelector('#adminMoreSheet .admin-more-grid');
  if(more&&!more.querySelector('[data-admin-page="practice-records"]')){
    const assessment=more.querySelector('[data-admin-page="assessments"]');
    assessment?.insertAdjacentHTML('afterend','<button data-admin-page="practice-records">练习记录</button>');
  }
  document.querySelectorAll('[data-admin-page="practice-records"]').forEach(button=>button.onclick=()=>showAdminPage('practice-records'));
}
ensureNavigation();
normalizeResearchNavigation();
adminTitles.intervention='课堂考勤';
adminTitles.assessments='量表测评';
adminTitles['practice-records']='练习记录';
const baseRenderAdminPage=renderAdminPage;
renderAdminPage=function(id){
  if(id==='practice-records'){
    document.querySelectorAll('.admin-page').forEach(p=>p.classList.toggle('active',p.id==='admin-practice-records'));
    document.querySelectorAll('[data-admin-page]').forEach(b=>b.classList.toggle('active',b.dataset.adminPage==='practice-records'));
    $('adminPageTitle').textContent='练习记录';
    renderPracticeRecords();
    return;
  }
  baseRenderAdminPage(id);
  if(id==='intervention')renderAttendance();
  if(id==='assessments')renderAssessmentResearch();
  if(id==='settings')configureSettings();
};
const baseRenderAdminAll=renderAdminAll;
renderAdminAll=function(){
  baseRenderAdminAll();
  renderAttendance();
  renderAssessmentResearch();
  renderPracticeRecords();
  configureSettings();
};
document.documentElement.dataset.researchModulesVersion='v31';
function relabelPracticeResource(){
  const page=$('admin-practice-records');
  if(!page)return;
  const tab=page.querySelector('[data-practice-module="resource"]');
  if(tab)tab.textContent='资源练习';
  const eyebrow=page.querySelector('.admin-page-head span');
  if(eyebrow)eyebrow.textContent='任务与资源练习';
  const intro=page.querySelector('.admin-page-head p');
  if(intro)intro.textContent='分别查看打卡任务和资源练习的发布、完成与使用记录；每位参与者的练习权限在资源练习页维护。';
  const resource=$('resourcePracticeRecords');
  if(resource){
    resource.querySelectorAll('span,h3,td').forEach(node=>{node.textContent=node.textContent.replaceAll('自愿练习','资源练习')});
  }
}
const baseResearchPracticeRender=renderPracticeRecords;
renderPracticeRecords=function(){
  const page=$('admin-practice-records'),access=$('participantPracticeAccess');
  if(page&&access?.parentElement?.id==='resourcePracticeRecords')page.appendChild(access);
  baseResearchPracticeRender();
  relabelPracticeResource();
};
relabelPracticeResource();
})();
