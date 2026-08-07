import {readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const latestParticipantPath = resolve(projectRoot, 'index.html');
const cloudbaseTargetPath = resolve(projectRoot, 'cloudbase', 'mied', 'index.html');

const latestParticipant = await readFile(latestParticipantPath, 'utf8');
const cloudbaseLoginSource = await readFile(cloudbaseTargetPath, 'utf8');

function extractElement(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  if (start < 0) throw new Error(`Missing start token: ${startToken}`);
  const end = source.indexOf(endToken, start);
  if (end < 0) throw new Error(`Missing end token after ${startToken}: ${endToken}`);
  return source.slice(start, end + endToken.length);
}

function extractBefore(source, startToken, nextToken) {
  const start = source.indexOf(startToken);
  if (start < 0) throw new Error(`Missing start token: ${startToken}`);
  const end = source.indexOf(nextToken, start);
  if (end < 0) throw new Error(`Missing next token after ${startToken}: ${nextToken}`);
  return source.slice(start, end).trim();
}

const authStyles = extractElement(cloudbaseLoginSource, '<style id="miedAuthStyles">', '</style>');
const authShellEndToken = cloudbaseLoginSource.includes('<section class="rui-admin-host')
  ? '<section class="rui-admin-host'
  : '<section class="launcher"';
let authShell = extractBefore(
  cloudbaseLoginSource,
  '<section class="auth-shell"',
  authShellEndToken,
);
const authModalStart = cloudbaseLoginSource.indexOf('<div class="modal" id="authAccountModal">');
const authScriptStart = cloudbaseLoginSource.indexOf('<script id="miedAuthScript">', authModalStart);
const authScriptEnd = cloudbaseLoginSource.indexOf('</script>', authScriptStart);
if (authModalStart < 0 || authScriptStart < 0 || authScriptEnd < 0) {
  throw new Error('The downloaded CloudBase page does not contain the expected account UI.');
}
let authExtras = cloudbaseLoginSource.slice(authModalStart, authScriptEnd + '</script>'.length);

const initialStyles = `<style id="miedInitialStyles">
.mied-initial{position:fixed;inset:0;z-index:12000;overflow:auto;overflow-x:hidden;background:
  radial-gradient(circle at 82% 18%,rgba(32,121,115,.11),transparent 31%),
  radial-gradient(circle at 15% 84%,rgba(194,143,72,.10),transparent 28%),#f6f8f9;color:#1d282f}
.mied-initial[hidden]{display:none}
.mied-initial-bar{display:flex;align-items:center;justify-content:space-between;max-width:1180px;margin:0 auto;padding:25px 32px}
.mied-initial-brand{display:flex;align-items:center;gap:12px;font:800 15px/1.2 "Noto Sans SC","Microsoft YaHei",sans-serif;letter-spacing:.02em}
.mied-initial-mark{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:#204447;color:#f7fbfa;font:800 18px/1 Georgia,serif;box-shadow:0 8px 24px rgba(32,68,71,.14)}
.mied-initial-version{color:#708086;font:600 12px/1.2 "Noto Sans SC","Microsoft YaHei",sans-serif}
.mied-initial-main{display:grid;grid-template-columns:minmax(0,1.12fr) minmax(340px,.72fr);gap:76px;align-items:center;width:100%;max-width:1060px;min-height:calc(100vh - 150px);margin:0 auto;padding:42px 32px 72px}
.mied-initial-main,.mied-initial-copy,.mied-entry-card{min-width:0}
.mied-initial-copy{max-width:610px}
.mied-initial-kicker{margin:0 0 18px;color:#207973;font:800 12px/1.4 "Noto Sans SC","Microsoft YaHei",sans-serif;letter-spacing:.16em;text-transform:uppercase}
.mied-initial h1{max-width:590px;margin:0;color:#17282d;font:600 clamp(40px,5vw,68px)/1.16 "Noto Serif SC","Songti SC",Georgia,serif;letter-spacing:-.035em;overflow-wrap:anywhere}
.mied-initial-lead{max-width:570px;margin:25px 0 0;color:#53666c;font:400 17px/1.9 "Noto Sans SC","Microsoft YaHei",sans-serif}
.mied-initial-notes{display:flex;flex-wrap:wrap;gap:10px;margin-top:31px}
.mied-initial-note{padding:9px 12px;border:1px solid #d8e1e3;border-radius:999px;background:rgba(252,253,253,.78);color:#52666b;font:700 12px/1.2 "Noto Sans SC","Microsoft YaHei",sans-serif}
.mied-entry-card{padding:31px;border:1px solid #d9e0e3;border-radius:8px;background:rgba(252,253,253,.96);box-shadow:0 22px 60px rgba(29,40,47,.10)}
.mied-entry-card small{display:block;color:#207973;font:800 11px/1.4 "Noto Sans SC","Microsoft YaHei",sans-serif;letter-spacing:.13em}
.mied-entry-card h2{margin:10px 0 9px;color:#1d282f;font:600 28px/1.25 "Noto Serif SC","Songti SC",Georgia,serif}
.mied-entry-card p{margin:0 0 24px;color:#66777c;font:400 14px/1.75 "Noto Sans SC","Microsoft YaHei",sans-serif}
.mied-entry-actions{display:grid;gap:11px}
.mied-entry-button{width:100%;min-height:50px;border:1px solid #207973;border-radius:3px;background:#207973;color:#fff;font:800 14px/1 "Noto Sans SC","Microsoft YaHei",sans-serif;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease,background .18s ease}
.mied-entry-button:hover{transform:translateY(-1px);background:#196b66;box-shadow:0 10px 24px rgba(32,121,115,.18)}
.mied-entry-button.secondary{background:transparent;color:#315f5d}
.mied-entry-button.secondary:hover{background:#edf5f3}
.mied-entry-privacy{margin-top:18px!important;padding-top:17px;border-top:1px solid #e4e9eb;color:#77858a!important;font-size:11px!important}
.rui-admin-host{position:fixed;inset:0;z-index:1050;background:#f3f6f5}
.rui-admin-host.hidden{display:none}
.rui-admin-frame{display:block;width:100%;height:100%;border:0;background:#f3f6f5}
@media(max-width:820px){
  .mied-initial-bar{padding:18px 20px}.mied-initial-version{display:none}
  .mied-initial-main{grid-template-columns:1fr;gap:38px;min-height:auto;padding:54px 20px 45px}
  .mied-initial h1{font-size:clamp(36px,11vw,48px)}.mied-initial-lead{font-size:15px;overflow-wrap:anywhere}
  .mied-entry-card{padding:24px}.mied-initial-notes{margin-top:23px}
}
@media(prefers-reduced-motion:reduce){.mied-entry-button{transition:none}}
</style>`;

const initialShell = `<section class="mied-initial" id="miedInitial" aria-labelledby="miedInitialTitle">
  <header class="mied-initial-bar">
    <div class="mied-initial-brand"><span class="mied-initial-mark">M</span><span>MIED · 与哀伤同行</span></div>
    <span class="mied-initial-version">研究体验版 · v18</span>
  </header>
  <main class="mied-initial-main">
    <div class="mied-initial-copy">
      <p class="mied-initial-kicker">Meaning-centered grief support</p>
      <h1 id="miedInitialTitle">在哀伤中，找到可以继续前行的意义。</h1>
      <p class="mied-initial-lead">MIED 将意义导向的心理教育、日常练习与阶段测评放在同一个温和、清晰的体验中。你可以按自己的节奏参与，也可以随时暂停或退出。</p>
      <div class="mied-initial-notes" aria-label="体验说明">
        <span class="mied-initial-note">参与完全自愿</span>
        <span class="mied-initial-note">可随时退出</span>
        <span class="mied-initial-note">当前版本仅保存于本浏览器</span>
      </div>
    </div>
    <section class="mied-entry-card" aria-label="进入 MIED">
      <small>WELCOME TO MIED</small>
      <h2>准备好后，从这里开始</h2>
      <p>参与者进入账户登录后可继续测评与练习；研究人员使用团队账户进入 Rui 更新后的研究运营后台。</p>
      <div class="mied-entry-actions">
        <button class="mied-entry-button" type="button" data-mied-entry="participant">参与者登录</button>
        <button class="mied-entry-button secondary" type="button" data-mied-entry="research">研究团队入口</button>
      </div>
      <p class="mied-entry-privacy">不连接 MeaningBridge 的通知接口，也不会在此收集邮箱。手机号规则沿用当前版本：仅填写后六位用于匹配追踪。</p>
    </section>
  </main>
</section>`;

const ruiAdminHost = `<section class="rui-admin-host hidden" id="ruiAdminHost" aria-label="MIED 研究团队运营台">
  <iframe class="rui-admin-frame" id="ruiAdminFrame" src="rui-admin.html?v=rui-0806-4" title="MIED 研究团队运营台"></iframe>
</section>`;

const initialScript = `<script id="miedInitialScript">
function openMiedEntry(kind){
  const initial=document.getElementById('miedInitial');
  if(initial)initial.hidden=true;
  document.body.classList.remove('mied-entry-open');
  const message=kind==='research'?'请使用研究团队账户登录。':'请登录或注册参与者账户。';
  if(typeof currentUser!=='undefined'&&currentUser){
    if(kind==='research'&&currentUser.role!=='admin'){
      if(typeof showAuth==='function')showAuth('当前账户不是研究团队账户。','login');
      return;
    }
    if(typeof enterForUser==='function')enterForUser(currentUser);
  }else if(typeof showAuth==='function'){
    showAuth(message,'login');
  }
}
document.querySelectorAll('[data-mied-entry]').forEach(button=>button.addEventListener('click',()=>openMiedEntry(button.dataset.miedEntry)));
window.addEventListener('message',event=>{
  const frame=document.getElementById('ruiAdminFrame');
  if(event.origin!==location.origin||!frame)return;
  if(event.data?.type==='mied:return-participant'&&typeof enterParticipantPreview==='function')enterParticipantPreview();
  if(event.data?.type==='mied:logout'&&typeof logout==='function')logout('已退出研究后台。');
});
window.MIEDRuiBridge={openEntry:openMiedEntry,version:'rui-0806'};
</script>`;

authShell = authShell
  .replace(
    '演示数据仅保存在当前浏览器；请勿录入真实姓名、电话、问卷答案或其他敏感信息。',
    '账户与作答数据仅保存在当前浏览器；除手机号后六位用于追踪匹配外，请勿录入真实姓名、完整电话、邮箱或其他敏感信息。',
  )
  .replace(
    '我知道这是浏览器端功能演示，不会在此录入真实个人信息或研究数据。',
    '我知道数据仅保存在当前浏览器；除手机号后六位用于追踪匹配外，不会录入其他真实个人信息。',
  );

const enterForUserPattern = /function enterForUser\(user\)\{[\s\S]*?\n\}/;
const enterForUserReplacement = `function enterForUser(user){
  currentUser=user;writeSession(user);hideAuth();updateIdentity(user);compatibilityStatus(user);
  if(user.role==='admin'){
    el('launcher')?.classList.add('hidden');el('appWrap')?.classList.add('hidden');
    el('adminWrap')?.classList.add('hidden');el('adminMobileNav')?.classList.add('hidden');
    el('ruiAdminHost')?.classList.remove('hidden');
    renderAdminAuthAccounts();
  }else{
    el('ruiAdminHost')?.classList.add('hidden');
    el('adminWrap')?.classList.add('hidden');el('adminMobileNav')?.classList.add('hidden');
    el('appWrap')?.classList.add('hidden');el('mobileNav')?.classList.add('hidden');
    el('launcher')?.classList.remove('hidden');
    if(user.mustChangePassword)setTimeout(()=>openAccountModal(true),160);
  }
}
function enterParticipantPreview(){
  if(!currentUser||currentUser.role!=='admin')return;
  el('ruiAdminHost')?.classList.add('hidden');
  el('adminWrap')?.classList.add('hidden');el('adminMobileNav')?.classList.add('hidden');
  el('appWrap')?.classList.add('hidden');el('mobileNav')?.classList.add('hidden');
  el('launcher')?.classList.remove('hidden');updateIdentity(currentUser);
  toast('已进入参与者端，可通过“研究团队后台”返回后台。');
}`;
if (!enterForUserPattern.test(authExtras)) throw new Error('Could not locate enterForUser in the account module.');
authExtras = authExtras.replace(/\nfunction enterParticipantPreview\(\)\{[\s\S]*?\n\}/g, '');
authExtras = authExtras.replace(enterForUserPattern, enterForUserReplacement);
authExtras = authExtras.replace(
  "function hideProductViews(){['launcher','appWrap','adminWrap','mobileNav','adminMobileNav'].forEach",
  "function hideProductViews(){['launcher','appWrap','adminWrap','mobileNav','adminMobileNav','ruiAdminHost'].forEach",
);

const oldAdminBindings =
  "if(el('adminLogout'))el('adminLogout').onclick=()=>logout('已退出研究后台。');if(el('adminBackHome'))el('adminBackHome').onclick=()=>logout('已退出研究后台。');if(el('openAdmin'))el('openAdmin').onclick=()=>{if(currentUser?.role==='admin')enterForUser(currentUser);else logout('请使用研究团队账号登录后台。')};";
const newAdminBindings =
  "if(el('adminLogout'))el('adminLogout').onclick=()=>logout('已退出研究后台。');if(el('adminBackHome'))el('adminBackHome').onclick=enterParticipantPreview;if(el('openAdmin'))el('openAdmin').onclick=()=>{if(currentUser?.role==='admin')enterForUser(currentUser);else logout('请使用研究团队账号登录后台。')};";
if (authExtras.includes(oldAdminBindings)) {
  authExtras = authExtras.replace(oldAdminBindings, newAdminBindings);
} else if (!authExtras.includes(newAdminBindings)) {
  throw new Error('Could not locate the account module admin bindings.');
}

let assembled = latestParticipant
  .replace(/^<meta name="robots"[^\n]*\r?\n/m, '')
  .replace(/^<meta name="googlebot"[^\n]*\r?\n/m, '')
  .replace(/^<meta name="referrer"[^\n]*\r?\n/m, '')
  .replace(
    '<title>MIED-与哀伤同行</title>',
    '<title>MIED-与哀伤同行 · 账户整合版 v18</title>',
  )
  .replace('<span class="sync-pill">● 数据已同步</span>', '<span class="sync-pill">● 本浏览器数据</span>')
  .replace(
    /\n\.internal-test-banner\{[\s\S]*?\n@media\(max-width:760px\)\{\.internal-test-banner[^\n]*\}\r?\n/,
    '\n',
  );

const bodyStart = assembled.indexOf('<body>');
const launcherStart = assembled.indexOf('<section class="launcher"', bodyStart);
if (bodyStart < 0 || launcherStart < 0) throw new Error('Could not locate the EdgeOne body wrapper.');
assembled =
  assembled.slice(0, bodyStart) +
  '<body class="auth-locked mied-entry-open">\n' +
  initialShell +
  '\n\n' +
  authShell +
  '\n\n' +
  ruiAdminHost +
  '\n\n' +
  assembled.slice(launcherStart);

const headEnd = assembled.indexOf('</head>');
if (headEnd < 0) throw new Error('Could not locate </head>.');
assembled = assembled.slice(0, headEnd) + authStyles + '\n\n' + initialStyles + '\n\n' + assembled.slice(headEnd);

const bodyEnd = assembled.lastIndexOf('</body>');
if (bodyEnd < 0) throw new Error('Could not locate </body>.');
assembled = assembled.slice(0, bodyEnd) + authExtras + '\n\n' + initialScript + '\n\n' + assembled.slice(bodyEnd);

await writeFile(cloudbaseTargetPath, assembled, 'utf8');
console.log(`Assembled CloudBase participant and account page at ${cloudbaseTargetPath}`);
