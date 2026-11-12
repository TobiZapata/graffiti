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

Mirage career saves do not record the bank URL. Keep its configured v1.0.0 root
when resuming those saves; persist a bank version per Major before upgrading it.

## Published Dust2 bank

Repository: https://github.com/TobiZapata/major-rounds-dust2

```env
NEXT_PUBLIC_ROUND_BANK_DUST2_BASE_URL=https://tobizapata.github.io/major-rounds-dust2/v1.0.0
```

The full bank has 1,000 eligible rounds from 49 demos. Equipment evidence is
supported for 914 rounds; those rounds also have derived metrics and resolution
data. Its 1,004 data files total 127,192,231 bytes. Original `.dem` files are not
published. `v1.0.0` is a fixed directory and Git tag; publish future changes under
a new version instead of editing these files.

`v0.0.0` preserves the original 22-round bank. Dust2 progress saved before this
publication has no `dust2BankVersion` field and uses that legacy index to preserve
its assembly pool. New progress stores `dust2BankVersion: "v1.0.0"`. All legacy
replay hashes also exist unchanged in v1.0.0, so playback and derived data remain
compatible. Mirage keeps its existing configuration.

## Reader configuration

The published Mirage and Dust2 v1.0.0 Pages roots are built-in defaults, so a
production build does not depend on local environment files. Environment values
can override each root; an explicitly empty value uses imported local files from
`/round-bank/` or `/round-bank-dust2/`. Dust2's metrics and resolutions use the same
root. `/round-bank-lab/` remains local. Generated local banks are excluded from Git.

Both public variables are configured in the local `.env.local`:

```env
NEXT_PUBLIC_ROUND_BANK_BASE_URL=https://tobizapata.github.io/major-rounds-mirage/v1.0.0
NEXT_PUBLIC_ROUND_BANK_DUST2_BASE_URL=https://tobizapata.github.io/major-rounds-dust2/v1.0.0
```

The URL points to the directory containing `economy-index.json`, not to the file itself. Next.js embeds public environment variables at build time, so rebuild after changing an override. No credentials belong in these URLs. The CDN must allow browser cross-origin requests and serve the published files; check both the index and a replay URL after publishing.

Production matches choose Mirage or Dust2 through a seeded 50/50 draw shared by
player and NPC matches. The choice is fixed per matchup/series, so refreshing does
not reroll it. Existing progress keeps its stored map; legacy progress without a
map stays on Mirage. The BO1 lab retains manual controls for testing.

To prepare a future Dust2 version from CS2 Data Lab, use a new destination:

```powershell
node scripts/import-round-bank.mjs ../cs2-data-lab/output/round-bank-dust2 ../major-rounds-dust2/NEW_VERSION de_dust2
node scripts/build-round-metrics.mjs de_dust2 ../major-rounds-dust2/NEW_VERSION
node scripts/build-round-resolution.mjs de_dust2 ../major-rounds-dust2/NEW_VERSION
```

Verify the files, commit them, create a new tag and push to the data repository's
`main` branch. Pages publishes from its root; `.nojekyll` keeps the data unchanged.
Do not move existing tags. Keep old version directories for saved matches.

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

Dust2: both catalogs, both derived gzip indexes and three replay gzip samples
returned HTTP 200, matched local bytes/checksums and allowed cross-origin reads.
The legacy index also returned HTTP 200 with its 22 rounds. Pages reports `built`.
Chrome then generated and sought a BO1 with local Dust2 requests blocked, saved
and resumed a v1 career, and resumed a legacy save through the v0 index. All 16
recorded Pages responses returned HTTP 200; no JavaScript exceptions occurred.
Firebase requests were blocked for this offline browser check; no cloud saves
were written. Reports: `../cs2-data-lab/output/dust2-pages-http-check.json` and
`../cs2-data-lab/output/check-dust2-pages-browser.json`.

The initial Pages integration passed 218 unit tests and a Webpack build.

The radar/Dust2 production release passed 221 unit tests, 235 Firestore security
checks and lint with no errors. Both random map choices were verified in Chrome,
including saved progress and reloads. The deployed `graffity-major` Firestore
rules were read back and matched the tested rules byte-for-byte. The app deploys
through the GitHub/Vercel integration when this feature is merged into `main`.

The emulator build passed with Turbopack. The normal build hit a Google Inter font
query-resolution error in Turbopack; `next build --webpack` passed and was used for
the normal preview. The default build command was not changed.
