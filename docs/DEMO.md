# Demo, video, and GitHub Pages

The local Next.js app remains the full application. The separate Vite demo runs in a browser with 180 fictional trades across January–June 2026. Its reference date is June 30. AI responses, model lists, connection tests, Python checks and market data are simulated. Real credential fields are disabled. The static demo’s content security policy blocks fetch/WebSocket connections.

## Run and test locally

Use Node.js 22.18 or later:

```sh
npm ci
npm run demo:build
npm run demo:preview
```

Open `http://127.0.0.1:4173/#/dashboard`. On Windows, `run_Demo.bat` prepares, builds and starts the preview using the local Node executables. Development mode is available through `npm run demo:dev`; the strict connection policy also blocks Vite’s hot-reload WebSocket, so reload after changes.

Try Dashboard filters, Calendar views/day links, every Reports tab, manual and pasted imports, tags, trade edits/deletion, Journal notes/evaluations, Daily Review, and AI/market configuration. Begin the import lesson with **Try Sample Import** and check $19 net P&L. Refresh or share a trade detail link. Test **Clear Data**, then **Reset Demo**. Changes remain in browser storage, isolated by the site’s base path; storage failures show a warning and use temporary memory.

The main entry points are `/dashboard`, `/calendar`, `/reports`, `/trades`, `/journal`, `/journal/<id>`, `/new-trade`, `/daily-review`, `/settings`, `/import-guide`, and `/tour`, all after `#`. Charts contain synthetic prices; unknown symbols, dates outside the fixtures, weekends and unsupported intervals return missing/unsupported data.

## Media

- [SVG feature map](../public/media/quantjournal-features.svg)
- [Two-minute MP4 walkthrough](../public/media/quantjournal-tour.mp4)
- [Poster](../public/media/quantjournal-poster.png)
- [English WebVTT captions](../public/media/quantjournal-tour.vtt)
- Editable Remotion composition: `media/root.tsx`; captured fictional demo screens: `public/media/*.jpg`.

The MP4 is 1920×1080, 30 fps, H.264, 120 seconds, with English text and no audio. The demo’s **Watch Tour** page uses controls, a poster and `preload="none"`, without autoplay. The first 30 seconds after the intro teach broker import and reconciliation.

```sh
npm run video:studio
npm run video:render
npm run video:poster
node scripts/video-captions.mjs
```

Remotion finds or downloads a compatible Chromium browser when needed. You can supply an installed browser with an additional `--browser-executable` argument. Regenerate captions after changing scene timings; update screenshot assets using only the fictional demo at a 1920×1080 viewport. Rendering is done locally; publishing does not rerender the video. [Remotion CLI documentation](https://www.remotion.dev/docs/cli/render)

## Publish when testing is complete

1. Upload the cleaned source to your GitHub repository, including `public/media`, `public/imports`, the lockfile and `.github/workflows/demo-pages.yml`. Exclude `.local`, `.env`, databases, caches, dependencies and build output. Keep the safe `.env.example`.
2. In **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**.
3. In **Actions**, run **Publish QuantJournal Demo** manually. The workflow installs dependencies, generates Prisma types, runs demo type-checking/tests/privacy checks, builds the static demo and publishes only `demo/dist`.
4. Open the URL returned by the deployment. Check a shared hash route, downloads, guide screenshots, video playback and mobile navigation.

The workflow derives the asset base path from GitHub Pages metadata, supporting both repository sites and account-root/custom-domain sites. It does not require AI/market keys or a database service. The reviewed release is published at [SirusAI/QuantJournal-Local-Trading-Journal](https://github.com/SirusAI/QuantJournal-Local-Trading-Journal), with its [live demo](https://sirusai.github.io/QuantJournal-Local-Trading-Journal/). For your own fork, follow the manual publishing steps above. [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Vite deployment guide](https://vite.dev/guide/static-deploy.html)

For a manual repository-subpath build, set `DEMO_BASE_PATH` to `/your-repository/` before `npm run demo:build`. Clear that variable for a local root-path build. Static archives must be served over HTTP; opening index.html directly with a file URL is not supported.
