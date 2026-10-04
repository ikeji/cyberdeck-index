import test from 'node:test';
import assert from 'node:assert/strict';
import { extract, parseLinkLine, imageRaw, siteOf } from './extract-lib.mjs';

const page = (lines, extra = {}) => ({
  id: 'a'.repeat(24), title: lines[0], created: 1700000000, updated: 1700000100, views: 3, image: null, links: [],
  lines: lines.map((text) => ({ text })), ...extra,
});

test('reddit post', () => {
  const r = extract(page(['T', '[https://gyazo.com/' + 'b'.repeat(32) + ']', '', 'https://www.reddit.com/r/cyberDeck/comments/x/y/']));
  assert.equal(r.memo, false);
  assert.equal(r.entry.source.site, 'reddit');
  assert.equal(r.entry.images.length, 1);
  assert.equal(r.entry.images[0].originRaw, 'https://gyazo.com/' + 'b'.repeat(32) + '/raw');
  assert.equal(r.entry.comment, null);
});

test('article with label', () => {
  const r = extract(page(['T', '[https://scrapbox.io/files/abc.png]', '[https://cyberdeck.cafe/mix/sanyo Sanyo]']));
  assert.equal(r.entry.source.site, 'web');
  assert.equal(r.entry.source.label, 'Sanyo');
  assert.equal(r.entry.images[0].origin, 'https://scrapbox.io/files/abc.png');
});

test('no source -> memo', () => {
  assert.equal(extract(page(['T', 'hello'])).memo, true);
});

test('many plain lines -> memo', () => {
  assert.equal(extract(page(['T', 'https://example.com/', 'a', 'b', 'c', 'd', 'e', 'f'])).memo, true);
  assert.equal(extract(page(['T', 'https://example.com/', 'a', 'b', 'c'])).memo, false);
});

test('tags and comment', () => {
  const r = extract(page(['T', 'https://example.com/', '#IKeJIのおすすめ', 'memo text #x'], { links: ['IKeJIのおすすめ', 'x', 'Other'] }));
  assert.deepEqual(r.entry.tags, ['IKeJIのおすすめ', 'x']);
  assert.deepEqual(r.entry.related, ['Other']);
  assert.equal(r.entry.comment, 'memo text #x');
});

test('reddit preferred over other links', () => {
  const r = extract(page(['T', 'https://example.com/', 'https://www.reddit.com/r/a/comments/1/']));
  assert.equal(r.entry.source.site, 'reddit');
  assert.equal(r.entry.links[0].url, 'https://example.com/');
});

test('parseLinkLine order', () => {
  assert.deepEqual(parseLinkLine('[label https://a.b/]'), { url: 'https://a.b/', label: 'label' });
  assert.equal(parseLinkLine('[not a link]'), null);
});

test('helpers', () => {
  assert.equal(siteOf('https://old.reddit.com/x'), 'reddit');
  assert.equal(imageRaw('https://i.gyazo.com/x.png'), 'https://i.gyazo.com/x.png');
});

test('label with nested brackets', () => {
  const r = extract(page(['T', '[https://www.reddit.com/r/a/comments/1/x/ Title [WIP] : r/a]']));
  assert.equal(r.entry.source.url, 'https://www.reddit.com/r/a/comments/1/x/');
  assert.equal(r.entry.source.label, 'Title [WIP] : r/a');
});

test('page-only line is not a comment', () => {
  const r = extract(page(['T', 'https://example.com/', '[Raspberry Pi]'], { links: ['Raspberry Pi'] }));
  assert.equal(r.entry.comment, null);
  assert.deepEqual(r.entry.related, ['Raspberry Pi']);
});
