# LifeOS shared cloud deployment

LifeOS uses one Next.js application and one PostgreSQL database for the web, Windows, and Android clients. The cloud site owns authentication and all active data. The installed Android app listens for committed database changes while it is open and refreshes the affected page; a 15-second refresh is retained when the stream is disconnected. JSON export and restore remain available in Settings.

## Provision the service

Create a Neon PostgreSQL project and a Vercel project for this repository. Use a dedicated Neon branch for Preview. Configure Vercel Production with `DATABASE_URL` (Neon pooled URL with `sslmode=require`), `BETTER_AUTH_SECRET` (a unique random secret of at least 32 characters), `BETTER_AUTH_URL`, and `NEXT_PUBLIC_APP_URL` (both the same canonical HTTPS origin). Keep every secret in Vercel's environment settings, never in Git or an APK/installer. Apply the reviewed Drizzle migrations to Neon before promoting the deployment. Follow [DEPLOYMENT.md](DEPLOYMENT.md) for the complete release checklist and smoke test.

The Vercel and Neon projects do not exist merely because the repository contains deployment instructions. Complete deployment and verify `/api/health`, registration, login, a saved check-in, and JSON export on the hosted site before packaging either app.

## Package the connected apps

Set `LIFEOS_CLOUD_URL` to the verified canonical HTTPS origin while building each app. For example, `https://lifeos.example.com`. It is a public URL, not a database credential. The packaging commands require an HTTPS origin and a healthy `/api/health` response before embedding the URL. The existing `desktop:package` and `android:apk` commands then build the connected packages. An app built without this value continues to use its local database.

Do not change the Windows app ID or Android application ID when upgrading. The packages retain the embedded local runtime so an installation with old local data can still be opened to export a backup. Upgrading does not delete the local database. New installations open the cloud site directly. Existing installations present a choice between opening local data and opening online LifeOS; first export local data, then sign in online and import it.

## Migrate existing data

1. Export a JSON backup from each existing installation that contains data to keep. Store the files somewhere private and verify that they open as JSON.
2. Register or sign in to one account on the hosted LifeOS site. Use that _same_ account in Windows and Android.
3. In Settings, select a backup and choose **Add without replacing**. The import is transactional: identical records are skipped and any conflicting record causes the entire import to roll back. It can be repeated safely. Check the record counts and key pages after import.
4. If two backups conflict, keep both original files and resolve the differences before trying again. **Replace data and restore** remains available for a deliberate full restore, but it deletes the account's existing productivity records first.
5. Export a fresh backup of the hosted account after verification. Keep regular backups independently of the cloud provider.

Local account passwords and sessions are intentionally absent from backups. A local login is not automatically a cloud login. Create the cloud account separately, then import the productivity data into it.

Vercel Functions currently limit a non-streamed request or response payload to 4.5 MB. LifeOS streams backup downloads and compresses uploads over 4 MB before sending them. The import accepts up to 25 MB of uncompressed JSON and 4 MB compressed. If a backup remains above the compressed limit, the app stops before upload and leaves all data untouched. Keep the original file and local database; a larger archive needs a separate transfer path.
