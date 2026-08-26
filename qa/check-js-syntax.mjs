import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const scriptsDirectory = join(projectRoot, 'js');
const scriptFiles = readdirSync(scriptsDirectory)
  .filter(file => file.endsWith('.js'))
  .sort();

for (const file of scriptFiles) {
  const filePath = join(scriptsDirectory, file);
  new Script(readFileSync(filePath, 'utf8'), { filename: `js/${file}` });
}

console.log(`JavaScript syntax check passed for ${scriptFiles.length} files.`);
