import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import { getBuildInfo, renderBuildInfo } from './build-info.mjs';

test('getBuildInfo reads commit hash and timestamp from git repository', () => {
  const info = getBuildInfo({ env: {} });
  assert.match(info.sha, /^[0-9a-f]{40}$/);
  assert.equal(info.shortSha, info.sha.slice(0, 7));
  assert.match(info.iso, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/);
  assert.match(info.display, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} JST$/);
});

test('getBuildInfo falls back when outside git repo and respects CF_PAGES_COMMIT_SHA', () => {
  const fixedNow = () => new Date('2026-11-15T16:30:00Z');
  const info = getBuildInfo({
    cwd: os.tmpdir(),
    env: { CF_PAGES_COMMIT_SHA: 'abcdef1234567890abcdef1234567890abcdef12' },
    now: fixedNow,
  });
  assert.equal(info.sha, 'abcdef1234567890abcdef1234567890abcdef12');
  assert.equal(info.shortSha, 'abcdef1');
  assert.equal(info.iso, '2026-11-16T01:30:00+09:00');
  assert.equal(info.display, '2026-11-16 01:30 JST');
});

test('renderBuildInfo renders linked commit hash and escapes attributes', () => {
  const html = renderBuildInfo({
    sha: 'c776167fee2d6f351fe242ca23a592ea5f1dccef',
    shortSha: 'c776167',
    iso: '2026-11-16T01:24:40+09:00',
    display: '2026-11-16 01:24 JST',
  });
  assert.equal(
    html,
    '<p class="build-info">Updated <time datetime="2026-11-16T01:24:40+09:00">2026-11-16 01:24 JST</time> · <a href="https://github.com/ikeji/cyberdeck-index/commit/c776167fee2d6f351fe242ca23a592ea5f1dccef" rel="noopener noreferrer"><code>c776167</code></a></p>',
  );

  const noSha = renderBuildInfo({ sha: '', shortSha: '', iso: '2026-11-16T01:24:40+09:00', display: '2026-11-16 01:24 JST' });
  assert.equal(noSha, '<p class="build-info">Updated <time datetime="2026-11-16T01:24:40+09:00">2026-11-16 01:24 JST</time></p>');
});
