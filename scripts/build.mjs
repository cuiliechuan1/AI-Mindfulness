import {cp, mkdir, rm} from 'node:fs/promises';
import {basename, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = resolve(projectRoot, 'dist');
if (dirname(outputDirectory) !== projectRoot || basename(outputDirectory) !== 'dist') {
  throw new Error(`Refusing to clean unexpected output path: ${outputDirectory}`);
}

await rm(outputDirectory, {recursive: true, force: true});
await mkdir(outputDirectory, {recursive: true});

for (const file of ['index.html', 'internal-login.html', 'robots.txt']) {
  await cp(resolve(projectRoot, file), resolve(outputDirectory, file));
}

console.log(`Built static assets in ${outputDirectory}`);
