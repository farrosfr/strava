# Strava Setup Guide

Use this guide on your PC to connect the app with your Strava account.

## 1. Open Strava API Settings

Go to:

```text
https://www.strava.com/settings/api
```

Create an app with these values:

```text
Application Name: Daily Threads Watermark
Category: Health & Fitness
Website: https://farrosfr.github.io/strava/
Authorization Callback Domain: localhost
```

Save the app.

## 2. Copy App Credentials

From the Strava API page, copy:

```text
Client ID
Client Secret
```

Keep `Client Secret` private.

## 3. Authorize Your Strava Account

Open this URL in your browser. Replace `CLIENT_ID` with your real Strava client ID:

```text
https://www.strava.com/oauth/authorize?client_id=CLIENT_ID&redirect_uri=http://localhost/exchange_token&response_type=code&approval_prompt=force&scope=read,activity:read_all
```

Approve access.

After approval, the browser will redirect to a broken localhost page. That is normal.

Copy the `code` value from the address bar:

```text
http://localhost/exchange_token?state=&code=COPY_THIS_CODE&scope=read,activity:read_all
```

Only copy the value after `code=`.

## 4. Exchange Code For Refresh Token

In your PC terminal, run this command. Replace the values first:

```sh
curl -X POST https://www.strava.com/oauth/token \
  -d client_id=CLIENT_ID \
  -d client_secret=CLIENT_SECRET \
  -d code=CODE_FROM_BROWSER \
  -d grant_type=authorization_code
```

The response will include:

```json
{
  "refresh_token": "COPY_THIS_REFRESH_TOKEN"
}
```

Copy the `refresh_token`.

## 5. Install And Login To GitHub CLI

If you do not have GitHub CLI, install it:

```text
https://cli.github.com/
```

Login:

```sh
gh auth login
```

Choose GitHub.com and follow the browser login steps.

## 6. Add GitHub Secrets

Run these commands in your PC terminal:

```sh
gh secret set STRAVA_CLIENT_ID --repo farrosfr/strava
gh secret set STRAVA_CLIENT_SECRET --repo farrosfr/strava
gh secret set STRAVA_REFRESH_TOKEN --repo farrosfr/strava
```

Paste the correct value when each command asks for input:

```text
STRAVA_CLIENT_ID: your Strava Client ID
STRAVA_CLIENT_SECRET: your Strava Client Secret
STRAVA_REFRESH_TOKEN: refresh_token from step 4
```

The start date is already set in the repo variable:

```text
STRAVA_START_DATE=2026-05-14
```

## 7. Run Strava Sync

Trigger the workflow:

```sh
gh workflow run "Update Strava summary" --repo farrosfr/strava
```

Check workflow status:

```sh
gh run list --repo farrosfr/strava --limit 5
```

## 8. Verify The Result

Open:

```text
https://farrosfr.github.io/strava/data/strava-summary.json
```

If connected, it should include:

```json
{
  "source": "strava"
}
```

Then open the app:

```text
https://farrosfr.github.io/strava/
```

The app will auto-fill:

- run/walk today
- run/walk total since `2026-05-14`

Manual input remains available as a fallback or override.

## Useful Links

```text
App: https://farrosfr.github.io/strava/
Repo: https://github.com/farrosfr/strava
Strava API Settings: https://www.strava.com/settings/api
Strava API Docs: https://developers.strava.com/docs/authentication/
```
