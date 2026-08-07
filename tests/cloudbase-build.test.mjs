import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cloudbasePage = resolve(projectRoot, 'cloudbase', 'mied', 'index.html');
const ruiAdminPage = resolve(projectRoot, 'cloudbase', 'mied', 'rui-admin.html');

test('CloudBase page combines the account entry with participant assessment v18', async () => {
  const html = await readFile(cloudbasePage, 'utf8');

  assert.match(html, /<body class="auth-locked mied-entry-open">/);
  assert.match(html, /id="authShell"/);
  assert.match(html, /id="miedInitial"/);
  assert.match(html, /在哀伤中，找到可以继续前行的意义/);
  assert.match(html, /data-mied-entry="participant"/);
  assert.match(html, /data-mied-entry="research"/);
  assert.match(html, /id="ruiAdminHost"/);
  assert.match(html, /src="rui-admin\.html\?v=rui-0806-4"/);
  assert.equal((html.match(/id="ruiAdminHost"/g) || []).length, 1);
  assert.equal((html.match(/id="ruiAdminFrame"/g) || []).length, 1);
  assert.doesNotMatch(html, /\/api\/notify|clerk/i);
  assert.match(html, /账户整合版 v18/);
  assert.match(html, /key:'demo_phone6'[^\n]+你的手机号后六位[^\n]+pattern:'\\\\d\{6\}'/);
  assert.match(html, /document\.documentElement\.dataset\.assessmentVersion='v18'/);
  assert.match(html, /const TEXT_ONLY_SCALES=new Set\(\['DAAPGQ','ERRI'\]\)/);
  assert.match(html, /reverseScoredItems:\['scs_1','scs_4','scs_8','scs_9','scs_11','scs_12'\]/);
  assert.match(html, /const expectedPtgi=\{relationships:6,newPossibilities:3,strength:4,spiritualChange:3,appreciationLife:4\}/);
  assert.doesNotMatch(html, /const scaleOrder=\[[^\]]*'IPGDS'/);
  assert.doesNotMatch(html, /id="internalTestLogout"|内部测试版本/);
  assert.doesNotMatch(html, /name="robots"[^>]*noindex/i);
  assert.match(html, /<span class="sync-pill">● 本浏览器数据<\/span>/);
  assert.doesNotMatch(html, /<span class="sync-pill">● 数据已同步<\/span>/);
});

test('research administrators can switch to the participant side without logging out', async () => {
  const html = await readFile(cloudbasePage, 'utf8');

  assert.match(html, /function enterParticipantPreview\(\)/);
  assert.match(html, /ruiAdminHost'\)\?\.classList\.remove\('hidden'\)/);
  assert.match(html, /ruiAdminHost'\)\?\.classList\.add\('hidden'\)/);
  assert.match(html, /adminBackHome'\)\.onclick=enterParticipantPreview/);
  assert.doesNotMatch(html, /adminBackHome'\)\.textContent='退出后台'/);
});

test('Rui 0806 research operations page is integrated without fake synchronization claims', async () => {
  const html = await readFile(ruiAdminPage, 'utf8');

  assert.match(html, /MIED｜研究团队运营台/);
  assert.match(html, /参与者与账户/);
  assert.match(html, /干预与依从性/);
  assert.match(html, /每日参与/);
  assert.match(html, /测量与评价/);
  assert.match(html, /风险与安全/);
  assert.match(html, /消息与协作/);
  assert.match(html, /数据与系统/);
  assert.match(html, /本浏览器演示数据/);
  assert.doesNotMatch(html, /数据同步完成/);
  assert.match(html, /mied:return-participant/);
  assert.match(html, /mied:logout/);
  assert.doesNotMatch(html, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
});

test('all inline scripts in the assembled CloudBase page are syntactically valid', async () => {
  const html = await readFile(cloudbasePage, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]);

  assert.ok(scripts.length >= 2);
  for (const [index, source] of scripts.entries()) {
    assert.doesNotThrow(() => new Function(source), `inline script ${index + 1} should parse`);
  }
});

test('all inline scripts in the Rui operations page are syntactically valid', async () => {
  const html = await readFile(ruiAdminPage, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]);

  assert.ok(scripts.length >= 1);
  for (const [index, source] of scripts.entries()) {
    assert.doesNotThrow(() => new Function(source), `Rui inline script ${index + 1} should parse`);
  }
});
