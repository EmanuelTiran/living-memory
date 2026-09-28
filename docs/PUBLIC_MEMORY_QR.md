# Permanent public memory QR

## Architecture and inspected boundaries

The feature extends the existing React application and Express API. `MemoryProfile` remains the source of truth; no second memory entity or QR collection was added. The existing `private` / `shared` visibility values continue to govern owner/family authorization through `requireMemoryPermission`. Public publication is an independent, explicit, owner-approved selection, not a new permission to read the family archive. Thus an archive can remain private to its owner or shared with its family while a carefully selected presentation is public.

Inspection covered `MemoryProfilePage`, profile and family-access routes/services, MemoryProfile/MemoryStory/MemoryBiographyAnswer/MemoryAsset/MemoryRecording, approved story/biography/transcript/profile chat providers, private storage and signed media links, rate limiting, index provisioning, AURA tokens/motion, `AuraTooltipLayer`, and existing browser tests. Existing story approval is family/archive approval, not permission to publish it to everyone. Recording playback and chat both require existing family permissions; neither is enabled anonymously by this feature. No AI retrieval path was changed.

## Identity and lifecycle

- The owner explicitly initializes a QR under **שאלות ומשפחה → קוד QR ושיתוף ציבורי**. The panel loads only when expanded. Existing and newly created memories use the same lazy path; no backfill is needed.
- `randomBytes(24)` creates a 192-bit, 32-character base64url token. A unique partial index covers string `qrToken` values, including disabled and archived profiles. No ObjectId appears in the public URL.
- One atomic compare-and-set fills a missing identity. There is no upsert or regeneration action. Concurrent initialization returns the same identity. A genuine unique-token collision retries only the initializer, at most three times.
- `qrToken`, `qrOrigin` and `qrCreatedAt` are Mongoose-immutable. The deliberately isolated native update in the initializer is their sole writer. Normal profile editing uses the existing strict allowlist and cannot write these fields.
- The origin from the existing `PUBLIC_APP_URL` is pinned with the identity. Later configuration changes do not silently issue a different engraved URL. Keep the original domain, DNS, TLS and `/q/` route operational indefinitely; backups must preserve these fields. A future domain migration must keep the old domain resolving the old paths.
- Initialization activates the code but **does not publish content**. Disable/reactivate preserves the token, origin, archive and selection. Unpublish independently removes public access. Archiving a profile makes all public content unavailable while reserving the token.

## Explicit public approval

`publicPublication` stores a bounded snapshot of only the last owner-approved public presentation. The existing story revision history is capped and therefore cannot be the durable public version. The archive records remain the source of truth for current editing, permissions and explicit removals:

- `enabled`, `approvedAt`, `approvedByUserId`;
- `profileVersion` and the approved name, introduction and portrait reference;
- at most 12 selected story references, fingerprints and approved public title/text/date snapshots;
- at most 12 selected photo references, fingerprints and approved public captions. Image bytes remain in the existing private asset store and are served only while the source asset is active.

The owner reviews the exact name/introduction and individually selects approved stories and active photos, confirms rights to publish, and confirms publication in a native modal dialog. Family stewards, editors, contributors, viewers, unrelated users and system administrators without ownership cannot publish. Existing family roles are unchanged.

Every public read requires an active profile, enabled QR and enabled publication, an active owner account, and unchanged ownership. Editing the name/introduction/portrait or a selected story/photo caption leaves the last published representation visible and marks the owner panel as pending; archive approval and owner QR publication replace it atomically in the profile document. New stories never auto-publish. An explicitly archived story or photo stops being served immediately, even if its public snapshot remains for owner review. A shared archive changed to private also stops serving the QR page immediately. QR disable, unpublish, profile archive, owner suspension or ownership change likewise block public reads. Public photo bytes are never snapshotted or served after asset archiving. Unselected stories, draft revisions, family details, biographies, recordings and transcripts are never automatically added. The code never changes during these transitions.

The UI presents up to the latest 100 approved stories and 100 active photos, plus any selected active items outside those windows and a selected last-published story whose current revision is still a draft. The latter may be retained during an unrelated republication; an archived item may not. Republishing replaces the selection. Current schemas do not provide life-date fields; the public page uses existing story occurrence dates without inventing biographical dates.

## Routes

- `GET /q/:token`: existing SPA entry, rendering the public memory directly without login, dashboard, internal-ID redirect or a continue screen. Express adds no-store/noindex/no-referrer headers to this path. Preserve this route as a compatibility boundary in future frontend rewrites.
- `GET /api/public/memories/:token`: minimal public DTO containing the last-published name, introduction, selected story versions and opaque selected-photo URLs. One indexed profile lookup, one indexed owner-state check and two bounded, memory-scoped content reads. Queries have a 5-second database budget. The resolver includes the unique partial-index type predicate explicitly; this was necessary for index selection in local MongoDB testing.
- `GET /api/public/memories/:token/photos/:photo`: rechecks profile, QR, publication, selection and live asset ownership/status. The opaque handle is bound to token, source and approved version. Original private storage URLs, filenames and IDs are never returned. Reuses the existing checksum-verified private file reader, then Sharp auto-orients, bounds decoded pixels, resizes to at most 1600×1600 and emits WebP without EXIF/GPS/XMP metadata. No PDFs or original files are publicly served.
- `GET /api/memories/:memoryId/qr`: authenticated owner review data, current status and SVG.
- `POST /api/memories/:memoryId/qr`: strict actions `initialize`, `publish`, `unpublish`, `set_enabled`; changes other than initialization require `confirmed:true`. Publication verifies the exact reviewed versions and scopes every selected source to the same memory.

All these APIs reject unknown query/body keys. They accept no redirect destination. QR APIs and pages use `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow, noarchive` and `Referrer-Policy: no-referrer`. The React public page also declares noindex/no-referrer metadata. If an external frontend host serves the SPA, configure the same `/q/*` headers and SPA fallback there; Express headers cannot configure an unrelated host.

The existing process-local limiter bounds public requests to 120/minute/IP, photo requests to 60/minute/IP, and management to 30/minute/user. Use shared edge limits for a multi-instance/high-traffic deployment. No visitor database, cookies, fingerprinting or scan analytics were added. Application request logs redact QR tokens from public paths; configure upstream access logs similarly. Already downloaded material cannot be recalled. The open page revalidates each minute and on visibility/pageshow; server revocation applies to each new read, not previously received bytes or an in-flight response.

## Native presentation and export

The public page reuses BrandLogo, MemoryProfile hero classes, shared surface cards/buttons, Rubik, AURA color/radius/shadow/motion variables, native details disclosure, RTL and visible keyboard focus. The hero is scoped to avoid global profile styles affecting its two-column/mobile composition. It presents the portrait, identity and short introduction before selected stories and photos. Long stories expand on request. Images have useful alt text; statuses include words, not color alone. Motion uses the existing arrival token and is disabled for reduced-motion preferences. No Header, global theme or tooltip implementation was changed.

Owner tooltips explain identity permanence, public selection, SVG export/quiet zone, preview, disable/reactivate, publication and unpublication. All use `data-aura-tooltip` and the existing `AuraTooltipLayer`, including its delay, keyboard support, Escape dismissal and placement.

The application generates the QR locally using `qrcode`, with black modules, opaque white background, four-module quiet zone and H error correction. Download is genuine vector SVG, not a canvas screenshot. No paid service, external redirect or third-party scan dependency exists. Test the final printed/engraved size, surface and lighting on real phones before manufacturing. Do not crop the white margin or overlay logos on the modules.

## Database and rollout

New MemoryProfile fields: `qrToken`, `qrOrigin`, `qrCreatedAt`, `qrEnabled`, `publicPublication`. They are excluded from default reads and existing `toJSON` serialization. Existing records remain unchanged until owner initialization.

New index: `memory_profiles_permanent_qr`, `{qrToken:1}`, unique, partial filter `{qrToken:{$type:'string'}}`. The existing fail-closed startup index provisioner creates it. No collection, destructive migration, index removal or production database operation is required by this implementation.

Before rollout, point the existing environment configuration at **staging** and run:

```powershell
npm.cmd run db:indexes --workspace server
```

Confirm the index with `db.memory_profiles.getIndexes()`, then test the same release against representative staging data. Use the intended production `PUBLIC_APP_URL` before initializing any production QR. It must be a durable HTTPS origin; missing configuration prevents initialization. There are no new environment variables.

Runtime additions: `qrcode` and `sharp`. Test-only additions: `jsqr` (independent decoder) and `mongodb-memory-server` (temporary local database). Install native Sharp binaries for the deployment platform through the lockfile (`npm ci`), including optional native packages. MongoDB test binaries are downloaded/cached by the test harness; offline CI should pre-cache them or supply its supported `MONGOMS_SYSTEM_BINARY` setting. The tests create their own loopback database and never use `MONGODB_URI`.

## Verification

- Full server suite: 157 files / 979 tests passed with `GOOGLE_CLIENT_ID=' '` only in the test process, preserving the repository's existing unconfigured-provider test fixture.
- New real-MongoDB suite: 15 tests cover entropy/unique index, concurrent initialization, private/shared denial, explicit public DTO, missing/disabled/archived states, normal edits and immutable identity, unpublication, version withdrawal, owner-only access including steward denial, foreign/draft/stale selections, strict validation/open-redirect rejection, photo metadata removal and revocation, serialization, index plan and SVG decoding.
- Resolver explain against 1,001 isolated test documents used `memory_profiles_permanent_qr` and examined one document. Windows MongoDB's explain host metadata required relaxed UTF-8 decoding only for this test diagnostic; application reads remain strict.
- Exported SVG was rasterized at 240 and 1024 pixels, independently decoded with jsQR to the exact stored URL, and that decoded token resolved successfully through Express. SVG structure and white quiet-zone pixels were checked.
- Browser checks cover mobile widths 320/390, tablet 768, desktop 1440, RTL, reading/disclosure, reduced motion, unavailable/error states, owner selection/confirmation/cancellation, SVG download, stable URL after disable/reactivate, family viewer exclusion and AURA tooltips. Existing MemoryProfile browser regression tests also pass. Screenshots are under `test-results/qr-*.png` and use intercepted test-only content.
- Lint and production client build pass. Vite retains the existing >500 kB bundle advisory. The existing MemoryProfile story UI emits a `defaultOpen` React warning in its regression fixture; it predates this feature.
- Dependency audit reports no advisories for the added packages, but existing `multer`, `qs`, `vitest` / `@vitest/mocker` advisories remain outside this feature's dependency scope. Address those before calling the entire application production-ready.

Remaining release checks: staging auth/storage/index permissions; cold photo-render latency and expected traffic under representative load; correctly configured frontend/proxy cache and noindex rules; real-device scans of the final physical material; continued ownership of the engraved domain. No production database was contacted, no mail sent, and no commit, push or deployment performed.

## Changed implementation files

Server: `src/app.js`, `src/middleware/requestLogger.js`, `src/modules/memories/MemoryProfile.js`, new `memoryQrValidation.js`, `memoryQrService.js`, `memoryQrRoutes.js`, and the exported existing reader in `src/modules/media/memoryAssetService.js`.

Client: `src/App.jsx`, `src/api/memoryApi.js`, the owner-panel insertion in `MemoryProfilePage.jsx`, and new `MemoryQrPanel.jsx`, `PublicMemoryPage.jsx`, `MemoryQr.css` under `src/features/memories`.

Dependencies/tests: `server/package.json`, root `package-lock.json`, `server/tests/memoryQr.test.js`, `server/e2e/memoryQr.e2e.js`. Existing Admin and FamilyAccess work has been preserved.
