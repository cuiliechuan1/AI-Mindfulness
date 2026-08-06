import assert from 'node:assert/strict';
import {readFile, readdir, stat} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = resolve(projectRoot, 'dist');

test('build output contains only the intended static files', async () => {
  const files = (await readdir(outputDirectory)).sort();
  assert.deepEqual(files, ['index.html', 'internal-login.html', 'robots.txt']);
  for (const file of files) assert.equal((await stat(resolve(outputDirectory, file))).isFile(), true);
});

test('built pages carry internal-test and crawler controls', async () => {
  const notice = '内部测试版本，仅供功能与体验测试，不用于正式研究或临床服务。';
  for (const file of ['index.html', 'internal-login.html']) {
    const html = await readFile(resolve(outputDirectory, file), 'utf8');
    assert.ok(html.includes(notice));
    assert.match(html, /name="robots"[^>]*noindex[^>]*nofollow/i);
  }
  const index = await readFile(resolve(outputDirectory, 'index.html'), 'utf8');
  assert.match(index, /id="internalTestLogout"/);
  assert.match(index, /JSON\.stringify\(\{action: 'logout'\}\)/);
  assert.equal(await readFile(resolve(outputDirectory, 'robots.txt'), 'utf8'), 'User-agent: *\nDisallow: /\n');
});

test('built participant page includes the assessment v18 corrections', async () => {
  const index = await readFile(resolve(outputDirectory, 'index.html'), 'utf8');
  assert.doesNotMatch(index, /^(?:<<<<<<<|=======|>>>>>>>)/m);
  assert.match(index, /document\.documentElement\.dataset\.assessmentVersion='v18'/);
  assert.match(index, /const TEXT_ONLY_SCALES=new Set\(\['DAAPGQ','ERRI'\]\)/);
  assert.match(index, /reverseScoredItems:\['scs_1','scs_4','scs_8','scs_9','scs_11','scs_12'\]/);
  assert.match(index, /const expectedPtgi=\{relationships:6,newPossibilities:3,strength:4,spiritualChange:3,appreciationLife:4\}/);
  assert.doesNotMatch(index, /const scaleOrder=\[[^\]]*'IPGDS'/);
  assert.match(index, /key:'demo_phone6'[^\n]+你的手机号后六位[^\n]+pattern:'\\\\d\{6\}'[^\n]+请输入6位数字/);
});

test('all inline participant scripts are syntactically valid', async () => {
  const index = await readFile(resolve(outputDirectory, 'index.html'), 'utf8');
  const scripts = [...index.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
  assert.ok(scripts.length >= 2);
  for (const [position, source] of scripts.entries()) {
    assert.doesNotThrow(() => new Function(source), `inline script ${position + 1} must parse`);
  }
});
