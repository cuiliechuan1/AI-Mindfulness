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
let authShell = extractBefore(
  cloudbaseLoginSource,
  '<section class="auth-shell"',
  '<section class="launcher"',
);
const authModalStart = cloudbaseLoginSource.indexOf('<div class="modal" id="authAccountModal">');
const authScriptStart = cloudbaseLoginSource.indexOf('<script id="miedAuthScript">', authModalStart);
const authScriptEnd = cloudbaseLoginSource.indexOf('</script>', authScriptStart);
if (authModalStart < 0 || authScriptStart < 0 || authScriptEnd < 0) {
  throw new Error('The downloaded CloudBase page does not contain the expected account UI.');
}
let authExtras = cloudbaseLoginSource.slice(authModalStart, authScriptEnd + '</script>'.length);

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
    if(typeof enterAdmin==='function')enterAdmin();
    if(el('adminBackHome')){el('adminBackHome').textContent='进入参与者端';el('adminBackHome').title='以研究人员身份查看参与者端'}
    renderAdminAuthAccounts();
  }else{
    el('adminWrap')?.classList.add('hidden');el('adminMobileNav')?.classList.add('hidden');
    el('appWrap')?.classList.add('hidden');el('mobileNav')?.classList.add('hidden');
    el('launcher')?.classList.remove('hidden');
    if(user.mustChangePassword)setTimeout(()=>openAccountModal(true),160);
  }
}
function enterParticipantPreview(){
  if(!currentUser||currentUser.role!=='admin')return;
  el('adminWrap')?.classList.add('hidden');el('adminMobileNav')?.classList.add('hidden');
  el('appWrap')?.classList.add('hidden');el('mobileNav')?.classList.add('hidden');
  el('launcher')?.classList.remove('hidden');updateIdentity(currentUser);
  toast('已进入参与者端，可通过“研究团队后台”返回后台。');
}`;
if (!enterForUserPattern.test(authExtras)) throw new Error('Could not locate enterForUser in the account module.');
authExtras = authExtras.replace(enterForUserPattern, enterForUserReplacement);

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
  '<body class="auth-locked">\n' +
  authShell +
  '\n\n' +
  assembled.slice(launcherStart);

const headEnd = assembled.indexOf('</head>');
if (headEnd < 0) throw new Error('Could not locate </head>.');
assembled = assembled.slice(0, headEnd) + authStyles + '\n\n' + assembled.slice(headEnd);

const bodyEnd = assembled.lastIndexOf('</body>');
if (bodyEnd < 0) throw new Error('Could not locate </body>.');
assembled = assembled.slice(0, bodyEnd) + authExtras + '\n\n' + assembled.slice(bodyEnd);

await writeFile(cloudbaseTargetPath, assembled, 'utf8');
console.log(`Assembled CloudBase participant and account page at ${cloudbaseTargetPath}`);
