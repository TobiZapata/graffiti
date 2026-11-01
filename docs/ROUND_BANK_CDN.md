# Round bank CDN

## Published Mirage bank

Repository: https://github.com/TobiZapata/major-rounds-mirage

Current immutable data directory:

```env
NEXT_PUBLIC_ROUND_BANK_BASE_URL=https://tobizapata.github.io/major-rounds-mirage/v1.0.0
```

GitHub Pages serves the published bank. The jsDelivr GitHub endpoint was tested:
the index loaded, but round requests returned HTTP 403 with
`Package size exceeded the configured limit of 50 MB`. The general jsDelivr
README's 150 MB figure did not match this endpoint. Do not enable that URL for
the complete bank without resolving the restriction with jsDelivr.

The bank contains 990 Mirage rounds from 50 demos (116,780,354 bytes across 992
data files). Version directories must not be changed after publication; add a new
version directory for changed data. Pages has its own storage and transfer limits.

Current career saves do not record the bank URL. Keep the configured v1.0.0 root
when resuming those saves; persist a bank version per Major before upgrading it.

## Reader configuration

By default, the app reads the imported bank from `/round-bank/`. To host it on jsDelivr, publish the contents of `public/round-bank` in a public GitHub repository, preserving `economy-index.json` and the `demos/` directory. Use a pinned commit SHA so the index and replay files stay consistent.

Set this public environment variable before starting development or building the app, replacing the placeholders with your repository, commit and bank directory:

```env
NEXT_PUBLIC_ROUND_BANK_BASE_URL=https://cdn.jsdelivr.net/gh/OWNER/REPO@COMMIT_SHA/path/to/round-bank
```

The URL points to the directory containing `economy-index.json`, not to the file itself. Next.js embeds public environment variables at build time, so rebuild after changing it. No credentials belong in this URL. The CDN must allow browser cross-origin requests and serve the published files; check both the index and a replay URL after publishing.

Only `/round-bank/` requests use this root. Leave the variable unset to use local files. `/round-bank-lab/` remains local.

## Verification

The published index and three gzip samples matched the local files exactly; Pages
returned `Access-Control-Allow-Origin: *`. Chrome then loaded a generated map's
23 rounds (23 unique gzip URLs plus the index) with local `/round-bank/*` requests
blocked. All requests returned HTTP 200; the result was counted once and remained
unchanged after reload. The browser also injected three old animation timestamps
to check the playback clock stays nonnegative and progress can be saved.

Reports: `../cs2-data-lab/output/mirage-cdn-check.json` and
`../cs2-data-lab/output/check-bank-cdn-browser.json`. The reader tests cover local
default, configured bank, unaffected lab paths, gzip, HTTP errors and cancellation.

The emulator build passed with Turbopack. The normal build hit a Google Inter font
query-resolution error in Turbopack; `next build --webpack` passed and was used for
the normal preview. The default build command was not changed.
