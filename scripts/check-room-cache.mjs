import assert from 'node:assert/strict';

// Run against next start after building; this only requests public page shells.
const origin = process.argv[2] || 'http://localhost:3035';
const codes = ['CACH', 'OTHR'];
for (const code of codes) {
  for (const suffix of ['', '/simulation', '/match?id=example', '/draft']) {
    const url = `${origin}/room/${code}${suffix}`;
    let html;
    for (let visit = 0; visit < 2; visit++) {
      const response = await fetch(url, { redirect: 'manual' });
      assert.equal(response.status, 200, url);
      assert.match(response.headers.get('cache-control') || '', /s-maxage=/, url);
      if (visit === 1) assert.equal(response.headers.get('x-nextjs-cache'), 'HIT', url);
      html = await response.text();
    }
    assert.ok(html.includes(code), `Missing room ID: ${url}`);
    assert.ok(!html.includes(codes.find(other => other !== code)), `Room ID leaked: ${url}`);
  }
  const path = `${origin}/room/${code}/simulation`;
  const regular = await (await fetch(path)).text();
  const results = await (await fetch(`${path}?results=1`)).text();
  assert.equal(results, regular, 'The cached shell must not depend on the results query');
}
console.log('Room shells cache on repeat visits, isolate room IDs, and share no query-specific state.');
