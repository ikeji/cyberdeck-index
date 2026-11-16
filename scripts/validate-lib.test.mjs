import test from 'node:test';
import assert from 'node:assert/strict';
import { validateHttpUrl, validateEntryUrls } from './validate-lib.mjs';

test('validateHttpUrl accepts valid http(s) URLs', () => {
  assert.equal(validateHttpUrl('https://www.reddit.com/r/CardPuter/comments/1wn6zjf/meet_term512_turning_the_cardputeradv_into_a/'), null);
  assert.equal(validateHttpUrl('https://www.reddit.com/r/cyberDeck/comments/1qqe20d/the_cgαlpha_is_here/'), null);
  assert.equal(validateHttpUrl('https://www.youtube.com/watch?v=8p2MKLphQlg'), null);
  assert.equal(validateHttpUrl('https://www.youtube.com/watch?v=T6qB6RDLTq8&embeds_referring_euri=https%3A%2F%2Fwww.reddit.com%2F'), null);
  assert.equal(validateHttpUrl('http://example.com/path?a=1&b=2#sec'), null);
});

test('validateHttpUrl rejects brackets, concatenated http URLs, whitespace, and bad schemes', () => {
  assert.match(
    validateHttpUrl('https://www.reddit.com/r/CardPuter/comments/1wn6zjf/meet_term512_turning_the_cardputeradv_into_a/[https://gyazo.com/77fdcd214b7202586e25596caf887404]'),
    /bracket/,
  );
  assert.match(
    validateHttpUrl('https://example.com/post/%5Bhttps%3A%2F%2Fgyazo.com%2Fabc%5D'),
    /second http|bracket/,
  );
  assert.match(
    validateHttpUrl('https://example.com/a/https://gyazo.com/77fdcd214b7202586e25596caf887404'),
    /second http/,
  );
  assert.match(validateHttpUrl('https://example.com/with space'), /whitespace/);
  assert.match(validateHttpUrl('ftp://example.com/file'), /protocol/);
  assert.match(validateHttpUrl(''), /non-empty/);
});

test('validateEntryUrls checks source, links, images (allowing local:), and scrapbox', () => {
  const validEntry = {
    source: { url: 'https://www.reddit.com/r/cyberDeck/comments/1/x/', site: 'reddit' },
    links: [{ url: 'https://cyberdeck.cafe/', site: 'web' }],
    images: [
      { origin: 'https://gyazo.com/' + 'a'.repeat(32), originRaw: 'https://gyazo.com/' + 'a'.repeat(32) + '/raw' },
      { origin: 'local:' + 'b'.repeat(64), originRaw: 'local:' + 'b'.repeat(64) },
    ],
    scrapbox: { url: 'https://scrapbox.io/CYBERDECK/Test' },
  };
  assert.deepEqual(validateEntryUrls(validEntry), []);

  const brokenEntry = {
    ...validEntry,
    source: { url: 'https://www.reddit.com/r/a/comments/1/x/[https://gyazo.com/1234]', site: 'reddit' },
    links: [{ url: 'https://example.com/foohttps://example.org/bar', site: 'web' }],
  };
  const errs = validateEntryUrls(brokenEntry);
  assert.equal(errs.length, 2);
  assert.match(errs[0], /^source\.url/);
  assert.match(errs[1], /^links\[0\]\.url/);
});
