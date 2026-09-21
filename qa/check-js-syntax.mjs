import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const scriptsDirectory = join(projectRoot, 'js');
const scriptFiles = readdirSync(scriptsDirectory)
  .filter(file => file.endsWith('.js'))
  .sort();

for (const file of scriptFiles) {
  const filePath = join(scriptsDirectory, file);
  const result = spawnSync(process.execPath, ['--check', filePath], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`JavaScript syntax check failed for js/${file}:\n${result.stderr || result.stdout}`);
  }
}

console.log(`JavaScript syntax check passed for ${scriptFiles.length} files.`);
