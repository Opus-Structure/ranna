# Deploying Ranna to the cPanel server

The site `https://ranna-service.com` runs on the shared cPanel host (Octenium). Neon provides the
database, auth, realtime and storage.

## How a deploy works

- Every push to `master` on `Opus-Structure/ranna` (remote `org`) starts the **Deploy to cPanel**
  workflow (`.github/workflows/deploy-cpanel.yml`).
- It builds the app on GitHub (Next.js standalone), uploads it to `/home/mzdrmgcf/ranna-app`,
  unpacks it, and restarts the app by touching `ranna-app/tmp/restart.txt`.
- A deploy takes a few minutes. Watch it in the repo's **Actions** tab.
- Other branches do not deploy. To deploy by hand: Actions → Deploy to cPanel → **Run workflow**.

## Conditions to remember

1. **Push to the right remote.** Only `org` (`Opus-Structure/ranna`) deploys. `origin`
   (`prodashar-afk/ranna`) has no workflow.
2. **A failed build changes nothing.** If the build fails, nothing is uploaded and the live site
   stays as it was. Read the log in the Actions tab.
3. **Server settings are not overwritten.** `/home/mzdrmgcf/ranna-app/.env.production` holds the
   secrets and is never touched by a deploy. To change a setting, edit that file (cPanel File
   Manager) or the variables in **Setup Node.js App**, then restart the app.
4. **`NEXT_PUBLIC_*` values are fixed at build time.** They come from GitHub → Settings →
   Secrets and variables → Actions → **Variables**: `NEXT_PUBLIC_APP_URL`,
   `NEXT_PUBLIC_ASSETS_URL`, `NEXT_PUBLIC_REALTIME_URL`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. Change
   the variable, then push again (or re-run the workflow).
5. **Database changes are not automatic.** A deploy only ships code. When a commit adds a file
   under `db/migrations/`, run that SQL in Neon (SQL Editor, branch `main`, database `neondb`)
   at the same time as the deploy. Otherwise the new code queries columns that do not exist and
   logged-in pages fail with "This screen couldn't load".
6. **The cPanel token is a secret.** The workflow uses the GitHub secret `CPANEL_API_TOKEN`. If
   the cPanel API token is rotated, update that secret or deploys will fail.
7. **The daily cron job** (cPanel → Cron Jobs) calls `/api/cron/daily` with `CRON_SECRET` read
   from `.env.production`. If `CRON_SECRET` changes there, the cron job picks it up on its own.

## When something breaks

- Server errors from page requests are appended to `/home/mzdrmgcf/ranna-app/tmp/app-errors.log`
  (one JSON line each; the file resets after 1 MB). Read it in cPanel File Manager.
- cPanel → Metrics → Errors only shows Passenger start-up messages, not app errors.
- Quick checks: `/en/login` and `/en/s/demo` should return 200; `/api/cron/daily` without a token
  should return 401.
