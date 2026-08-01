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
