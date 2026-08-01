import {readFile, readdir, stat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {dirname, extname, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const requiredFiles = [
  '.env.example',
  '.gitignore',
  'DEPLOYMENT.md',
  'edge-functions/api/internal-auth.js',
  'edgeone.json',
  'index.html',
  'internal-login.html',
  'middleware.js',
  'package.json',
  'robots.txt',
];
const errors = [];

async function text(path) {
  return readFile(resolve(projectRoot, path), 'utf8');
}

for (const file of requiredFiles) {
  try {
    if (!(await stat(resolve(projectRoot, file))).isFile()) errors.push(`${file} is not a file.`);
  } catch {
    errors.push(`${file} is missing.`);
  }
}

const [indexHtml, referenceHtml, loginHtml, robots, gitignore, envExample, middleware, edgeoneRaw] = await Promise.all([
  text('index.html'),
  text('Liechuan/MIED-AI_Liechuan_7.31.html'),
  text('internal-login.html'),
  text('robots.txt'),
  text('.gitignore'),
  text('.env.example'),
  text('middleware.js'),
  text('edgeone.json'),
]);

const requiredNotice = '内部测试版本，仅供功能与体验测试，不用于正式研究或临床服务。';
for (const [file, contents] of [['index.html', indexHtml], ['internal-login.html', loginHtml]]) {
  if (!contents.includes(requiredNotice)) errors.push(`${file} lacks the exact internal-test notice.`);
  if (!/name="robots"[^>]*noindex[^>]*nofollow/i.test(contents)) errors.push(`${file} lacks noindex,nofollow metadata.`);
  if (/[A-Za-z]:\\(?:Users|Documents|Desktop|桌面)\\/i.test(contents)) errors.push(`${file} contains a local Windows absolute path.`);
  if (/(?:src|href)=["'](?:file:|[A-Za-z]:\\)/i.test(contents)) errors.push(`${file} contains a non-deployable asset URL.`);
}
for (const [file, contents] of [['index.html', indexHtml], ['Liechuan/MIED-AI_Liechuan_7.31.html', referenceHtml]]) {
  if (contents.includes('demo_phone6') || contents.includes('手机号后六位')) {
    errors.push(`${file} still asks internal testers for part of a real phone number.`);
  }
}

if (!/^User-agent: \*\r?\nDisallow: \/\s*$/m.test(robots)) errors.push('robots.txt does not disallow all crawlers.');
for (const ignored of ['.env', '.env.local', '.env.production', '.edgeone/.token', '.edgeone/auth.json', 'node_modules/', 'dist/', '.internal-test-secrets/']) {
  if (!gitignore.includes(ignored)) errors.push(`.gitignore lacks ${ignored}.`);
}
for (const name of ['INTERNAL_TEST_PASSWORD=', 'INTERNAL_TEST_SIGNING_PRIVATE_KEY=']) {
  if (!envExample.includes(name)) errors.push(`.env.example lacks ${name}`);
}
if (/^INTERNAL_TEST_(?:PASSWORD|SIGNING_PRIVATE_KEY)=.+$/m.test(envExample)) errors.push('.env.example contains a non-empty secret value.');
if (middleware.includes('EDGEONE_INTERNAL_AUTH_PUBLIC_KEY_PLACEHOLDER')) errors.push('Internal-auth public key has not been generated.');

let edgeone;
try {
  edgeone = JSON.parse(edgeoneRaw);
} catch {
  errors.push('edgeone.json is invalid JSON.');
}
if (edgeone) {
  if (edgeone.installCommand !== 'npm ci') errors.push('edgeone.json installCommand must be npm ci.');
  if (edgeone.buildCommand !== 'npm run build') errors.push('edgeone.json buildCommand must be npm run build.');
  if (edgeone.outputDirectory !== 'dist') errors.push('edgeone.json outputDirectory must be dist.');
  const serializedHeaders = JSON.stringify(edgeone.headers || []);
  for (const expected of ['Content-Security-Policy', 'X-Robots-Tag', 'noindex']) {
    if (!serializedHeaders.includes(expected)) errors.push(`edgeone.json headers lack ${expected}.`);
  }
}

const secretPatterns = [
  ['Tencent Cloud SecretId', /AKID[A-Za-z0-9]{13,40}/g],
  ['OpenAI API key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{30,}\b/g],
  ['Slack token', /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g],
];

async function collectFiles(directory) {
  const found = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    if (['.git', '.internal-test-secrets', 'node_modules'].includes(entry.name)) continue;
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) found.push(...await collectFiles(fullPath));
    else found.push(fullPath);
  }
  return found;
}

for (const file of await collectFiles(projectRoot)) {
  if (!['.css', '.html', '.js', '.json', '.md', '.mjs', '.txt'].includes(extname(file).toLowerCase())) continue;
  const contents = await readFile(file, 'utf8');
  for (const [label, pattern] of secretPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(contents)) errors.push(`${relative(projectRoot, file)} contains a possible ${label}.`);
  }
}

for (const file of [
  'middleware.js',
  'edge-functions/api/internal-auth.js',
  'scripts/build.mjs',
  'scripts/generate-internal-auth-secrets.mjs',
  'scripts/validate.mjs',
]) {
  const result = spawnSync(process.execPath, ['--check', resolve(projectRoot, file)], {encoding: 'utf8'});
  if (result.status !== 0) errors.push(`${file} failed syntax check: ${(result.stderr || result.stdout).trim()}`);
}

if (errors.length) {
  console.error(`Validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Validation passed: deployment structure, noindex controls, paths, syntax, and common secret signatures.');
