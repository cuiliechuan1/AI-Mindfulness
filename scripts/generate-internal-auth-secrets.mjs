import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const secretDirectory = resolve(projectRoot, '.internal-test-secrets');
const passwordPath = resolve(secretDirectory, 'password.txt');
const privateKeyPath = resolve(secretDirectory, 'signing-private-key.pkcs8.b64');
const publicKeyPath = resolve(secretDirectory, 'signing-public-key.spki.b64');
const middlewarePath = resolve(projectRoot, 'middleware.js');
const rotate = process.argv.includes('--rotate');

async function readIfPresent(path) {
  try {
    return (await readFile(path, 'utf8')).trim();
  } catch (error) {
    if (error && error.code === 'ENOENT') return '';
    throw error;
  }
}

await mkdir(secretDirectory, {recursive: true});
let password = rotate ? '' : await readIfPresent(passwordPath);
let privateKeyBase64 = rotate ? '' : await readIfPresent(privateKeyPath);
let publicKeyBase64 = rotate ? '' : await readIfPresent(publicKeyPath);

if (!password) password = randomBytes(32).toString('base64url');

if (!privateKeyBase64) {
  const {privateKey, publicKey} = generateKeyPairSync('ec', {namedCurve: 'prime256v1'});
  privateKeyBase64 = privateKey.export({type: 'pkcs8', format: 'der'}).toString('base64');
  publicKeyBase64 = publicKey.export({type: 'spki', format: 'der'}).toString('base64');
} else if (!publicKeyBase64) {
  const privateKey = createPrivateKey({
    key: Buffer.from(privateKeyBase64, 'base64'),
    type: 'pkcs8',
    format: 'der',
  });
  publicKeyBase64 = createPublicKey(privateKey).export({type: 'spki', format: 'der'}).toString('base64');
}

await Promise.all([
  writeFile(passwordPath, `${password}\n`, {encoding: 'utf8', mode: 0o600}),
  writeFile(privateKeyPath, `${privateKeyBase64}\n`, {encoding: 'utf8', mode: 0o600}),
  writeFile(publicKeyPath, `${publicKeyBase64}\n`, {encoding: 'utf8', mode: 0o600}),
]);

const middleware = await readFile(middlewarePath, 'utf8');
const keyPattern = /const INTERNAL_AUTH_PUBLIC_KEY_SPKI_B64 = '[^']+';/;
if (!keyPattern.test(middleware)) throw new Error('middleware.js public-key slot was not found.');
const updatedMiddleware = middleware.replace(
  keyPattern,
  `const INTERNAL_AUTH_PUBLIC_KEY_SPKI_B64 = '${publicKeyBase64}';`,
);
if (updatedMiddleware !== middleware) await writeFile(middlewarePath, updatedMiddleware, 'utf8');

console.log(`Internal auth material is ready in ignored directory: ${secretDirectory}`);
console.log('No password or private-key value was printed.');
