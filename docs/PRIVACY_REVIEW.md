# Pre-publication privacy review

Reviewed October 13, 2026. No personal identity details, real trading records, saved credentials or private machine paths were detected in the current release files after the corrections below.

## Scope and evidence

| Area | Result |
|---|---|
| Source, documentation, templates, captions and SVG | Searched for identity/contact information, account details, credential patterns, private keys, machine paths, old profiles and historical record exports; no unresolved findings. |
| Fictional fixtures | The 180 seed trades are generated deterministically in `demo/fixtures.ts`; the sample CSV/TSV contains the fictional $19 round trip. Prompts and notes use general teaching text. |
| Images | All 20 demo screenshots and the poster were visually reviewed. No personal records, credential values, desktop UI or identifying browser tabs are shown. No EXIF, XMP, IPTC or comment fields were detected. |
| Video | Reviewed the composition and its source images, and sampled all 20 scenes including the introduction and closing. The MP4 contains one video stream and no audio. Its metadata contains only technical encoder/container details and a Remotion software comment. |
| Local database and settings | All nine application/junction tables are empty. No saved settings or credential encryption-key file is present. The ignored local environment contains only the relative database URL. |
| Git exclusions | Verified 23 private/generated path examples are ignored and seven intended public source/assets are included, using Git against a disposable copy of the ignore rules. |
| Source and static archives | Recreated and inspected both ZIPs, including extracted text and compiled demo assets. No databases, credentials, private environments, assistant files, logs, caches or dependency installations are included. ZIP integrity checks passed. |
| Publishing workflow | Only the allowlisted static assets and compiled demo are uploaded to Pages. The demo's provider responses are simulated and its connection policy blocks fetch/WebSocket requests. |

## Corrections made during this review

- Replaced the old SPY chart document, which contained performance figures of uncertain origin, with a general explanation without historical statistics. Removed outdated descriptions of deleted functionality and random-data fallback.
- Added ignore rules for local assistant/cloud credential directories, secret exports, browser network captures, dumps and backup files.
- Expanded `npm run check:release` to detect more credential formats, private-key files, both Windows path styles, authenticated URLs and additional runtime artifacts. The scanner reports filenames/categories without printing secret values. Reserved-domain test fixtures are identified separately from real credentials.
- Updated both release archives to include these corrections and this review.

## Upload the reviewed release

Use the regenerated `QuantJournal-source.zip` for repository source, or `QuantJournal-demo.zip` for the static site. The archives are saved under the ignored `.local/release` folder. The working directory still contains local dependencies, build output, database files and diagnostic material; do not upload it wholesale. The database being empty does not make runtime files appropriate to publish.

The workspace has no valid Git repository or commit history, so there is no local history to inspect. This review covers the present files and regenerated archives. If you publish into an existing repository that previously contained private information, its existing commits need a separate review.

After adding new imports, credentials, screenshots or documents, rerun the release check and review those assets before rebuilding a release. Pattern searches are a detection aid; they are not proof that all possible personal information can be recognized automatically.
