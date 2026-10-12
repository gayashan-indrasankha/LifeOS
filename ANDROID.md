# LifeOS for Android

Set `LIFEOS_CLOUD_URL` to the deployed HTTPS LifeOS origin when building the shared-cloud APK. It opens the same account and database as the web and Windows apps. An existing installation with local data can still open its embedded local app to export a JSON backup before switching online. See [CLOUD.md](CLOUD.md). The details below describe the retained local runtime and offline test build used when `LIFEOS_CLOUD_URL` is unset.

The Android package embeds the existing Next.js standalone server and PGlite database. It runs on the phone's loopback interface and displays LifeOS in a WebView. No remote server is needed after installation. The app uses its private storage for its account, sessions, and productivity data. The Android database is separate from the Windows database. Use **Settings → Export my data** on Windows, then create a local account in the Android app and use **Settings → Restore from a backup** to transfer productivity data. The backup does not include account credentials.

## Current verification

`npm run android:smoke` checks the staged local server on the development computer, including registration, authenticated Home and export, and account persistence after a restart. `assembleDebug` compiles and signs an ARM64 APK. The debug APK was installed and launched on an Infinix Note 50 (X6858, Android 16, ARM64, 4 KB pages). On that phone, the account screen rendered and registration, authenticated dashboard, and JSON export passed while Wi-Fi and mobile data were disabled. A backup restore was also observed returning to Home with data visible after the Android loopback origin fix. Long-term data persistence still needs verification.

The bundled third-party Node executable has some 4 KB-aligned ELF load segments. Android devices that use 16 KB memory pages may reject it; the APK's ZIP alignment check does not establish ELF compatibility. Check the phone with `adb shell getconf PAGESIZE` before relying on this build. A 16 KB result requires a different Node runtime and a new build.

## Build

Requirements: Node.js 20.9 or newer, JDK 17 or newer, Android SDK platform 35 and build tools 35.0.0, and an ARM64 Android Node.js 24 executable. Set `JAVA_HOME` and `ANDROID_HOME`. The Android project includes a Gradle 8.11.1 wrapper.

The build expects the Android Node executable at `.android-toolchain/node/libnode.so`, or at the path in `LIFEOS_ANDROID_NODE_BINARY`. It must be an Android ARM64 PIE executable named `libnode.so` so Android extracts it into the app's executable native library directory. The currently evaluated runtime is [Node 24.21.0 for Android ARM64](https://github.com/Delusions6515/node-android-build/releases/tag/node-android-arm64-24), from `node-android-arm64-24.21.0.tar.xz` (archive SHA-256 `08ec25a88585932ce7f5ffe6ccc0d27606027f130de6d9318f3ea08d4654990e`). Its `nodejs-v24.21.0-android-arm64/bin/node` file is copied to the expected path. Review the third-party runtime before distributing the APK.

From the repository root:

```powershell
npm.cmd run android:apk
```

The signed debug APK is copied to `dist-android/LifeOS-0.1.0-arm64.apk`. The build prints its SHA-256 hash. This is a personal test build signed with the local Android debug key. Retain that key to install future updates over the existing app; installing a build signed with another key requires uninstalling the old package, which deletes its private data. Export a JSON backup before uninstalling.

For a distributable cloud build, keep the Android signing keystore and its passwords outside Git. Set `LIFEOS_CLOUD_URL` to the deployed HTTPS origin, plus `LIFEOS_ANDROID_KEYSTORE`, `LIFEOS_ANDROID_KEYSTORE_PASSWORD`, `LIFEOS_ANDROID_KEY_ALIAS`, and `LIFEOS_ANDROID_KEY_PASSWORD`. Then run `npm.cmd run android:release-apk`. The signed, non-debuggable APK is copied to `dist-android/LifeOS-0.1.0-arm64-release.apk`. The first release key for this installation is in the ignored `.android-toolchain/release/` directory on the build computer. Back up both `lifeos-release.jks` and `signing.env` securely: future updates must use the same key. A debug-signed installation must be uninstalled before installing this release-signed package.

For an already prepared runtime, run `npm.cmd run android:smoke` and `android\gradlew.bat assembleDebug` separately. The server bundle is staged in the ignored `android-stage/` directory; the Android SDK, Node executable, and generated APK are also ignored by Git.

## Device check

Connect an ARM64 Android phone with USB debugging enabled and confirm it appears in `adb devices`. Install with `adb install -r dist-android/LifeOS-0.1.0-arm64.apk`. Open LifeOS, register a local account, restart the app, check that data remains, then verify habit check-ins, Settings backup import/export, and navigation without internet. If startup fails, inspect the private `data/server.log` or `data/startup-error.log` using Android Studio's device explorer or `adb run-as com.lifeos.app` for the debug build.

The application binds only to `127.0.0.1`. Android's private app storage and local authentication protect the data, but other apps on the same phone can technically reach an open loopback port while LifeOS runs. The package grants only the Android `INTERNET` permission, which is needed for the local WebView connection.
