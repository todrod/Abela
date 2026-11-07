import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
function fixture(t, edit = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), 'abela-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const path of ['build.mjs', 'src', 'content']) cpSync(join(root, path), join(dir, path), { recursive: true });
  const path = join(dir, 'content/site.json');
  const content = JSON.parse(readFileSync(path, 'utf8'));
  edit(content, dir);
  writeFileSync(path, JSON.stringify(content));
  return {
    build(production = false) {
      return spawnSync(process.execPath, ['build.mjs', ...(production ? ['--production'] : [])], { cwd: dir, encoding: 'utf8' });
    },
    read(path) { return readFileSync(join(dir, 'dist', path), 'utf8'); },
    dir,
  };
}
function successful(result) { assert.equal(result.status, 0, result.stderr); }
function checkLinks(f) {
  const dir = join(f.dir, 'dist');
  for (const page of readdirSync(dir).filter(x => x.endsWith('.html'))) {
    const html = f.read(page);
    assert.equal([...html.matchAll(/<h1\b/g)].length, 1, `${page}: one h1`);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length, `${page}: unique IDs`);
    for (const [, attr, value] of html.matchAll(/\b(href|src|poster)="([^"]+)"/g)) {
      if (/^(?:[a-z]+:|\/\/)/i.test(value)) continue;
      const [path, hash] = value.split('#');
      const target = path === '/' ? 'index.html' : path || page;
      assert.ok(existsSync(join(dir, target)), `${page}: missing ${attr} ${value}`);
      if (hash) assert.ok(f.read(target).includes(`id="${hash}"`), `${page}: missing anchor ${value}`);
    }
  }
}

test('staging builds complete pages with valid links, anchors, and assets', t => {
  const f = fixture(t);
  successful(f.build());
  checkLinks(f);
  assert.match(f.read('index.html'), /noindex, nofollow/);
  assert.match(f.read('robots.txt'), /Disallow: \//);
  assert.match(f.read('404.html'), /<base href="\/">/);
});

test('production omits unapproved content and placeholder assets', t => {
  const f = fixture(t);
  successful(f.build(true));
  checkLinks(f);
  assert.doesNotMatch(f.read('index.html'), /staging-banner|flag-draft|813-873-0000|placeholder/);
  assert.ok(!existsSync(join(f.dir, 'dist/assets/abela-portrait-placeholder.jpg')));
  assert.ok(!existsSync(join(f.dir, 'dist/condition-coronary.html')));
});

test('independently approved condition does not link to unpublished biography', t => {
  const f = fixture(t, (c, dir) => {
    c.areasOfCare[0].status = 'confirmed';
    const path = join(dir, 'content/conditions.json');
    const conditions = JSON.parse(readFileSync(path, 'utf8'));
    conditions[c.areasOfCare[0].id].status = 'confirmed';
    writeFileSync(path, JSON.stringify(conditions));
  });
  successful(f.build(true));
  checkLinks(f);
});

test('immutable cache policy is restricted to fingerprinted assets', t => {
  const f = fixture(t);
  successful(f.build());
  const headers = f.read('_headers');
  assert.match(headers, /\/assets\/office-contact\.vcf\n  Cache-Control: public, max-age=0, must-revalidate/);
  for (const [, path] of headers.matchAll(/([^\n]+)\n  Cache-Control: public, max-age=31536000, immutable/g)) {
    assert.match(path, /\.[a-f0-9]{10}\.(css|js|woff2)$/);
  }
});

test('confirmed contact data creates safe structured data, contact card, and sitemap', t => {
  const f = fixture(t, c => {
    c.contact.phone.status = c.contact.address.status = 'confirmed';
    c.site.url = { value: 'https://example.com', status: 'confirmed' };
    c.physician.name.value = 'Doctor </script><script>alert(1)</script>';
  });
  successful(f.build(true));
  checkLinks(f);
  const json = f.read('index.html').match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1];
  assert.equal(JSON.parse(json).name, 'Doctor </script><script>alert(1)</script>');
  assert.match(f.read('assets/office-contact.vcf'), /TEL;TYPE=WORK,VOICE/);
  assert.match(f.read('sitemap.xml'), /https:\/\/example.com\//);
  assert.doesNotMatch(f.read('sitemap.xml'), /404.html/);
});

test('production rejects an accidentally approved placeholder portrait', t => {
  const f = fixture(t, c => {
    c.physician.portrait.status = 'confirmed';
    c.physician.shortBio.status = 'confirmed';
  });
  const result = f.build(true);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Production build contains staging markers/);
});


test('home and biography include lightweight controllable heart animation', t => {
  const f = fixture(t);
  successful(f.build());
  for (const page of ['index.html', 'about.html']) {
    const html = f.read(page);
    assert.match(html, /<video[^>]*data-heart-film[^>]*muted loop playsinline/);
    assert.match(html, /data-toggle-motion/);
    assert.match(html, /heart-cycle\.mp4/);
    assert.doesNotMatch(html, /heart-cycle\.gif/);
  }
});
