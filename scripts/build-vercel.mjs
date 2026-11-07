// Publish the complete review build, preserving its noindex and security headers.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const result = spawnSync(process.execPath, ['build.mjs'], { cwd: root, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
const output = join(root, '.vercel/output');
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync(join(root, 'dist'), join(output, 'static'), { recursive: true });
const routes = [];
for (const line of readFileSync(join(root, 'dist/_headers'), 'utf8').split('\n')) {
  if (!line.trim()) continue;
  if (line.startsWith('/')) {
    const src = '^' + line.trim().split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$';
    routes.push({ src, headers: {}, continue: true });
  } else {
    const colon = line.indexOf(':');
    if (colon < 0 || !routes.length) throw new Error('Invalid generated header rule');
    routes.at(-1).headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
}
routes.push({ src: '^/$', dest: '/index.html' });
routes.push({ handle: 'filesystem' });
routes.push({ src: '/.*', dest: '/404.html', status: 404 });
rmSync(join(output, 'static/_headers'));
writeFileSync(join(output, 'config.json'), JSON.stringify({ version: 3, routes }, null, 2));
