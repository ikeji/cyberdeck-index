import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, makeId, parseTags, parseMeta, youtubeId, siteOf, imageRaw } from './add-lib.mjs';

test('normalizeUrl: reddit', () => {
  assert.equal(normalizeUrl('https://old.reddit.com/r/cyberDeck/comments/1/x?utm_source=share#c'), 'https://www.reddit.com/r/cyberDeck/comments/1/x/');
  assert.equal(makeId('https://www.reddit.com/r/a/comments/1/x'), makeId('https://reddit.com/r/a/comments/1/x/?foo=1'));
});

test('normalizeUrl: tracking params / youtube', () => {
  assert.equal(normalizeUrl('https://example.com/p?id=3&utm_medium=x&fbclid=y'), 'https://example.com/p?id=3');
  assert.equal(normalizeUrl('https://www.youtube.com/watch?v=abc&t=10&list=z'), 'https://www.youtube.com/watch?v=abc');
});

test('normalizeUrl: rejects malformed concatenated URLs', () => {
  assert.throws(() => normalizeUrl('https://www.reddit.com/r/CardPuter/comments/1wn6zjf/meet_term512/[https://gyazo.com/77fdcd214b7202586e25596caf887404]'), /Invalid URL/);
  assert.throws(() => normalizeUrl('https://example.com/a/https://example.org/b'), /Invalid URL/);
});

test('makeId is 24 hex', () => assert.match(makeId('https://example.com/'), /^[0-9a-f]{24}$/));

test('parseTags', () => {
  assert.deepEqual(parseTags('#a, b  a'), ['a', 'b']);
  assert.deepEqual(parseTags(['x', '#y', '']), ['x', 'y']);
});

test('parseMeta', () => {
  const m = parseMeta('<title>T &amp; U</title><meta property="og:title" content="OG &quot;t&quot;"><meta content="/i.png" property="og:image">', 'https://e.com/a/b');
  assert.equal(m.title, 'OG "t"');
  assert.deepEqual(m.images, ['https://e.com/i.png']);
});

test('youtubeId', () => {
  assert.equal(youtubeId('https://youtu.be/8p2MKLphQlg'), '8p2MKLphQlg');
  assert.equal(youtubeId('https://www.youtube.com/watch?v=8p2MKLphQlg&t=1'), '8p2MKLphQlg');
  assert.equal(youtubeId('https://example.com/'), null);
});

test('siteOf and imageRaw', () => {
  assert.equal(siteOf('https://old.reddit.com/x'), 'reddit');
  assert.equal(siteOf('https://x.com/user/status/1'), 'twitter');
  assert.equal(siteOf('https://cyberdeck.cafe/mix/sanyo'), 'web');
  assert.equal(imageRaw('https://gyazo.com/' + 'b'.repeat(32)), 'https://gyazo.com/' + 'b'.repeat(32) + '/raw');
  assert.equal(imageRaw('https://i.gyazo.com/x.png'), 'https://i.gyazo.com/x.png');
});
