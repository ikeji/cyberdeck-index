import { execFileSync } from 'node:child_process';
import { ROOT } from './common.mjs';
import { esc } from '../templates/layout.mjs';

export const REPO_URL = 'https://github.com/ikeji/cyberdeck-index';

export function getBuildInfo({ cwd = ROOT, env = process.env, now = () => new Date() } = {}) {
  const ref = (env.CF_PAGES_COMMIT_SHA || 'HEAD').trim();
  let gitSha = '';
  let gitIso = '';
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%H%n%cI', ref], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    [gitSha = '', gitIso = ''] = out.trim().split('\n');
  } catch {}

  const sha = (env.CF_PAGES_COMMIT_SHA || gitSha).trim();
  const parsed = gitIso ? new Date(gitIso) : now();
  const date = Number.isNaN(parsed.getTime()) ? now() : parsed;
  const jst = new Date(date.getTime() + 9 * 3600_000).toISOString();
  const iso = `${jst.slice(0, 19)}+09:00`;
  const display = `${jst.slice(0, 16).replace('T', ' ')} JST`;

  return {
    sha,
    shortSha: sha.slice(0, 7),
    iso,
    display,
  };
}

export function renderBuildInfo(info, { repoUrl = REPO_URL } = {}) {
  const { sha = '', shortSha = sha.slice(0, 7), iso, display } = info;
  let commitHtml = '';
  if (/^[0-9a-f]{7,40}$/i.test(sha) && repoUrl) {
    commitHtml = ` · <a href="${esc(repoUrl.replace(/\/$/, ''))}/commit/${esc(sha)}" rel="noopener noreferrer"><code>${esc(shortSha)}</code></a>`;
  } else if (shortSha) {
    commitHtml = ` · <code>${esc(shortSha)}</code>`;
  }
  return `<p class="build-info">Updated <time datetime="${esc(iso)}">${esc(display)}</time>${commitHtml}</p>`;
}
