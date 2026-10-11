# LifeOS for Windows

LifeOS is packaged as a Windows installer. Download `LifeOS Setup <version>.exe` from the **LifeOS-Windows-Installer** artifact of a successful [Windows desktop installer](.github/workflows/desktop-check.yml) workflow run, or build it from source. The installed app runs without Docker, PostgreSQL, Node.js, or an internet connection on the destination PC.

To build it in GitHub, open **Actions → Windows desktop installer → Run workflow** and select the branch. When the run finishes, open its summary, download **LifeOS-Windows-Installer** under **Artifacts**, and extract the setup executable from the ZIP.

## Install and uninstall

Run the installer and follow its setup wizard. You can install for your Windows account or for all users, choose the installation directory, and create desktop and Start Menu shortcuts. The final page can launch LifeOS. Because the installer is currently unsigned, Windows may show an unknown publisher warning.

Setup grants Windows sandboxed processes read and execute access to the chosen LifeOS program folder. This prevents a startup crash on folders whose inherited permissions omit application-package access. The grant does not apply to your LifeOS data folder.

Remove LifeOS through **Windows Settings → Apps → Installed apps** or its Start Menu uninstall entry. Closing the app before uninstalling or upgrading lets its embedded database shut down cleanly. Uninstalling the program does not delete your LifeOS data. Installing a newer version for the same Windows account uses that account's existing data.

LifeOS keeps its database and encrypted session secret in the current Windows user's application data directory (`%APPDATA%\LifeOS`). If an older HabitFlow desktop database exists, it continues using `%APPDATA%\HabitFlow` instead. These directories are separate from the chosen program installation directory, so choosing another install location or uninstalling the program leaves the data in place. Each Windows account has its own data. Back up the application data directory before replacing or moving a PC, with LifeOS closed; moving only the installer does not move your data. The desktop database is separate from local Docker PostgreSQL and Neon, and the installer does not import their accounts or habits.

## Build from source

On Windows with Node.js 24 and npm installed, from the repository root:

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run desktop:package
```

The versioned installer is written to `dist-desktop/LifeOS Setup <version>.exe` (for example, `LifeOS Setup 0.1.0.exe`). The build also creates `dist-desktop/win-unpacked/` for package verification. Generated output is ignored by Git. A release distributed to others should be code signed.

The desktop process starts an embedded PGlite database, applies the checked-in Drizzle migrations, and starts the Next.js standalone server on a random `127.0.0.1` port. It opens that server in an Electron window. Other software running under the same Windows machine can technically reach loopback ports, so keep Windows user accounts separate on shared PCs. The web deployment and its Neon database remain separately configured in [DEPLOYMENT.md](DEPLOYMENT.md).

## Verify a build

After `npm run build`, `npm run desktop:smoke` checks the standalone server with a temporary PGlite database and authenticated routes, without opening a window or touching normal application data. The Windows workflow builds and inspects the installer, then runs `node tests/desktop/portable.mjs` against the unpacked Electron app with an isolated temporary data directory. That test checks a real window, authenticated writes, and persistence after a clean restart. It does not run the installer or change the user's installed application. Installer wizard choices and the Windows uninstall entry still need a manual release check on a test machine; see [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md).
