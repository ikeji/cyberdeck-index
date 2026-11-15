import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRss, rfc822 } from './rss-lib.mjs';

const sampleEntry = (overrides = {}) => ({
  id: '10e29fb4fb5c27c201e19317',
  title: 'Deck <One> & "Two"',
  source: { url: 'https://www.reddit.com/r/cyberDeck/comments/1/x/?a=1&b=2', site: 'reddit', label: null },
  links: [],
  images: [
    {
      status: 'ok',
      files: { thumb: 'img/ba/ba48.thumb.webp', full: 'img/ba/ba48.webp' },
      width: 1600,
      height: 1200,
    },
  ],
  tags: ['Handheld'],
  related: [],
  comment: 'Note with <b>tag</b> & text',
  addedAt: '2026-11-13T13:28:48.113Z',
  ...overrides,
});

test('rfc822 formats valid ISO dates and ignores invalid ones', () => {
  assert.equal(rfc822('2026-11-13T13:28:48.113Z'), 'Fri, 13 Nov 2026 13:28:48 GMT');
  assert.equal(rfc822(''), undefined);
  assert.equal(rfc822('not-a-date'), undefined);
});

test('buildRss generates valid RSS 2.0 XML with escaped fields and limit', () => {
  const entries = [
    sampleEntry(),
    sampleEntry({ id: '2'.repeat(24), title: 'Second', images: [], comment: null, tags: [], addedAt: undefined, scrapbox: { updated: '2026-10-01T00:00:00.000Z' } }),
    sampleEntry({ id: '3'.repeat(24), title: 'Third (excluded by limit)' }),
  ];
  const xml = buildRss(entries, { siteUrl: 'https://example.com/', base: '/sub', limit: 2 });

  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<link>https:\/\/example\.com\/sub\/<\/link>/);
  assert.match(xml, /<atom:link href="https:\/\/example\.com\/sub\/rss\.xml" rel="self" type="application\/rss\+xml"\/>/);
  assert.match(xml, /<lastBuildDate>Fri, 13 Nov 2026 13:28:48 GMT<\/lastBuildDate>/);
  assert.match(xml, /<title>Deck &lt;One&gt; &amp; &quot;Two&quot;<\/title>/);
  assert.match(xml, /<guid isPermaLink="true">https:\/\/example\.com\/sub\/e\/10e29fb4fb5c27c201e19317\/<\/guid>/);
  assert.match(xml, /<category>Reddit<\/category><category>Handheld<\/category>/);
  assert.match(xml, /https:\/\/example\.com\/sub\/img\/ba\/ba48\.thumb\.webp/);
  assert.match(xml, /Note with &amp;lt;b&amp;gt;tag&amp;lt;\/b&amp;gt; &amp;amp; text/);
  assert.match(xml, /<pubDate>Thu, 01 Oct 2026 00:00:00 GMT<\/pubDate>/);
  assert.doesNotMatch(xml, /Third/);
});
