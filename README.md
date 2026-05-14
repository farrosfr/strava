# Daily Threads Watermark

Astro static web app for creating daily sport/activity captions and watermarked images for Threads.

## Features

- Start-date based day counter.
- Daily run/walk, push-up, other sport, and other activity inputs.
- Automatic totals from saved daily entries.
- Optional Strava activities CSV import for run/walk totals.
- Automated Strava run/walk summary from GitHub Actions.
- Day-by-day history table for validating Strava run/walk totals and saved push-ups.
- Browser-only image crop and watermark export.
- Threads text draft redirect.
- Native image sharing on browsers that support the Web Share API with files.
- Local browser storage, no backend required.

## Use

Run locally:

```sh
npm install
npm run dev
```

1. Set the start date, for example `2026-05-14`.
2. Add today's run/walk, push-ups, and other activity.
3. Click **Save day** so future totals can be calculated.
4. Upload a photo.
5. Choose the crop ratio. `4:5` is the default because it gives a feed post more vertical space, while `1:1` is available for square posts.
6. Open a Threads text draft, share the generated image, download the image, or copy the generated caption.

## Threads Drafts

The **Open Threads** button uses `https://www.threads.net/intent/post?text=...` to prefill the caption.

The **Share image** button uses the browser's native share sheet with the generated PNG and caption. On supported mobile browsers this can share into Threads. If file sharing is not available, it downloads the image and opens the Threads text draft.

The share text also appends `#Running Threads` so Threads can offer the Running Threads topic. Threads may still require selecting the topic in the composer before posting:

```text
https://www.threads.com/search?q=Running%20Threads&serp_type=deeplink
```

## Strava

The public site does not call Strava directly. GitHub Actions fetches Strava with repository secrets and writes a public summary file to `public/data/strava-summary.json`.

Full PC setup guide: [STRAVA_SETUP.md](STRAVA_SETUP.md)

Add these repository secrets:

- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_REFRESH_TOKEN`

Optional repository variable:

- `STRAVA_START_DATE`, defaults to `2026-05-14`

The workflow `.github/workflows/update-strava.yml` runs every 30 minutes and can also be triggered manually.

A static public site must not contain a Strava client secret. Only the generated summary JSON is public.

The safe static workflow is:

1. Export activities from Strava.
2. Upload the CSV in the **Import Strava CSV** panel.
3. The browser reads the file locally and calculates run/walk distance by date.

CSV import is still available as a fallback when the Strava workflow has not been configured.

## History Validation

The app shows a **History** table under the preview. It merges:

- Strava daily run/walk totals from `public/data/strava-summary.json`
- saved push-up and activity entries from browser local storage
- current unsaved form values for the selected post date

Use **Save day** after adding push-ups or manual activity so those values stay in the history table.

## GitHub Pages

This project deploys through GitHub Actions with `.github/workflows/deploy.yml`.

Repository Pages source should be set to **GitHub Actions**.
