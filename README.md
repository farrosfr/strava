# Daily Threads Watermark

Static web app for creating daily sport/activity captions and watermarked images for Threads.

## Features

- Start-date based day counter.
- Daily run/walk, push-up, other sport, and other activity inputs.
- Automatic totals from saved daily entries.
- Optional Strava activities CSV import for run/walk totals.
- Browser-only image crop and watermark export.
- Threads text draft redirect.
- Native image sharing on browsers that support the Web Share API with files.
- Local browser storage, no backend required.

## Use

Open `index.html` in a browser.

1. Set the start date, for example `2026-05-14`.
2. Add today's run/walk, push-ups, and other activity.
3. Click **Save day** so future totals can be calculated.
4. Upload a photo.
5. Choose the crop ratio. `4:5` is the default because it gives a feed post more vertical space, while `1:1` is available for square posts.
6. Open a Threads text draft, share the generated image, download the image, or copy the generated caption.

## Threads Drafts

The **Open Threads** button uses `https://www.threads.net/intent/post?text=...` to prefill the caption.

The **Share image** button uses the browser's native share sheet with the generated PNG and caption. On supported mobile browsers this can share into Threads. If file sharing is not available, it downloads the image and opens the Threads text draft.

## Strava

This version cannot directly access a private Strava account from GitHub Pages without OAuth and a secure token exchange service. A static public site must not contain a Strava client secret.

The safe static workflow is:

1. Export activities from Strava.
2. Upload the CSV in the **Import Strava CSV** panel.
3. The browser reads the file locally and calculates run/walk distance by date.

A later version can add a small backend or serverless function for Strava OAuth.

## GitHub Pages

Commit these files to a repository and enable Pages from the repository settings:

- Source: deploy from branch
- Branch: `main`
- Folder: `/root`

The `.nojekyll` file is included so GitHub Pages serves the static files directly.
