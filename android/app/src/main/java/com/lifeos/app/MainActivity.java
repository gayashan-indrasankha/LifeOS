package com.lifeos.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.ServerSocket;
import java.net.URL;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

public class MainActivity extends Activity {
    private static final int OPEN_BACKUP = 1;
    private static final int SAVE_BACKUP = 2;
    private static final String VERSION = "0.1.0";

    private WebView webView;
    private FrameLayout frame;
    private TextView status;
    private Process server;
    private String origin;
    private String downloadUrl;
    private ValueCallback<Uri[]> uploadCallback;
    private boolean mainFrameFailed;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        frame = new FrameLayout(this);
        boolean dark = (getResources().getConfiguration().uiMode
            & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            // Android 15+ places target-SDK-35 content behind the system bars.
            // Keep the WebView and startup screen inside the visible safe area.
            frame.setBackgroundColor(dark ? 0xFF13181F : 0xFFFFFFFF);
            frame.setOnApplyWindowInsetsListener((view, insets) -> {
                Insets safeArea = insets.getInsets(WindowInsets.Type.systemBars()
                    | WindowInsets.Type.displayCutout());
                view.setPadding(safeArea.left, safeArea.top, safeArea.right, safeArea.bottom);
                return insets;
            });
        }
        webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setUserAgentString(
            webView.getSettings().getUserAgentString() + " LifeOSAndroid/1");
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(true);
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void setDarkMode(boolean dark) {
                runOnUiThread(() -> updateSystemBars(dark));
            }
        }, "LifeOSAndroidSystemBars");
        CookieManager.getInstance().setAcceptCookie(true);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                mainFrameFailed = false;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (origin != null && (url.equals(origin) || url.startsWith(origin + "/"))) {
                    return false;
                }
                if (url.startsWith("https://")) {
                    startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl()));
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (mainFrameFailed || origin == null ||
                    !(url.equals(origin) || url.startsWith(origin + "/"))) return;
                status.setVisibility(View.GONE);
                view.evaluateJavascript("(() => {"
                    + "const sync = () => LifeOSAndroidSystemBars.setDarkMode("
                    + "document.documentElement.classList.contains('dark'));"
                    + "sync();"
                    + "new MutationObserver(sync).observe(document.documentElement,"
                    + "{attributes:true,attributeFilter:['class']});"
                    + "})()", null);
                if (url.startsWith("https://")) installCloudRefresh(view);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        WebResourceError error) {
                if (!request.isForMainFrame()) return;
                mainFrameFailed = true;
                status.setText("LifeOS could not connect. Check your internet connection.\n\nTap to retry.");
                status.setVisibility(View.VISIBLE);
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (uploadCallback != null) uploadCallback.onReceiveValue(null);
                uploadCallback = callback;
                Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType("application/json");
                startActivityForResult(pick, OPEN_BACKUP);
                return true;
            }
        });
        webView.setDownloadListener((url, agent, disposition, mimeType, length) -> {
            if (origin == null || !url.startsWith(origin + "/")) return;
            downloadUrl = url;
            String fileName = "lifeos-backup.json";
            String candidate = android.webkit.URLUtil.guessFileName(url, disposition, mimeType);
            if (candidate.endsWith(".json")) fileName = candidate;
            Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            save.addCategory(Intent.CATEGORY_OPENABLE);
            save.setType("application/json");
            save.putExtra(Intent.EXTRA_TITLE, fileName);
            startActivityForResult(save, SAVE_BACKUP);
        });
        frame.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        status = new TextView(this);
        status.setText("Starting LifeOS…");
        status.setTextSize(18);
        status.setGravity(Gravity.CENTER);
        status.setBackgroundColor(0xFFF5F7FF);
        status.setTextColor(0xFF102047);
        frame.addView(status, new FrameLayout.LayoutParams(-1, -1));
        setContentView(frame);
        frame.post(() -> updateSystemBars(dark));
        status.setOnClickListener(view -> {
            if (!BuildConfig.LIFEOS_CLOUD_URL.isEmpty()
                && BuildConfig.LIFEOS_CLOUD_URL.equals(origin)) {
                status.setText("Connecting to LifeOS…");
                webView.loadUrl(origin);
            }
        });
        chooseAppMode();
    }

    private void chooseAppMode() {
        if (BuildConfig.LIFEOS_CLOUD_URL.isEmpty()) {
            new Thread(this::startLocalApp, "lifeos-startup").start();
            return;
        }
        File localDatabase = new File(new File(getFilesDir(), "data"), "database");
        if (!localDatabase.exists()) {
            openCloudApp();
            return;
        }
        new AlertDialog.Builder(this)
            .setTitle("Move LifeOS data online")
            .setMessage("This phone has LifeOS data stored locally. Open the local app to export a JSON backup, then sign in online and restore it there. Your local data will stay on this phone.")
            .setPositiveButton("Open local data", (dialog, which) ->
                new Thread(this::startLocalApp, "lifeos-startup").start())
            .setNeutralButton("Open online LifeOS", (dialog, which) -> openCloudApp())
            .setNegativeButton("Cancel", (dialog, which) -> finish())
            .show();
    }

    private void openCloudApp() {
        origin = BuildConfig.LIFEOS_CLOUD_URL;
        status.setText("Connecting to LifeOS…");
        webView.loadUrl(origin);
    }

    private void updateSystemBars(boolean dark) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) return;
        frame.setBackgroundColor(dark ? 0xFF13181F : 0xFFFFFFFF);
        WindowInsetsController controller = frame.getWindowInsetsController();
        if (controller != null) {
            int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            controller.setSystemBarsAppearance(dark ? 0 : mask, mask);
        }
    }

    private void installCloudRefresh(WebView view) {
        view.evaluateJavascript("(() => {"
            + "if (window.__lifeosAndroidSync) return 'already-installed';"
            + "window.__lifeosAndroidSync = true;"
            + "const style = document.createElement('style');"
            + "style.textContent = '.lifeos-android header.sticky{background:var(--card);"
            + "-webkit-backdrop-filter:none;backdrop-filter:none}';"
            + "document.head.appendChild(style);"
            + "let lastRefresh = Date.now();"
            + "const refresh = () => {"
            + "if (window.__lifeosRealtimeConnected) return;"
            + "if (!document.querySelector('.lifeos-android') || document.hidden || !navigator.onLine) return;"
            + "if (Date.now() - lastRefresh < 2000) return;"
            + "const active = document.activeElement;"
            + "if (active && active.matches('input,textarea,select,[contenteditable]')) return;"
            + "lastRefresh = Date.now();"
            + "if (window.next && window.next.router && typeof window.next.router.refresh === 'function')"
            + "window.next.router.refresh();"
            + "else window.location.reload();"
            + "};"
            + "window.addEventListener('lifeos:android-resume', refresh);"
            + "window.addEventListener('focus', refresh);"
            + "window.addEventListener('online', refresh);"
            + "document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });"
            + "window.setInterval(refresh, 15000);"
            + "return window.next && window.next.router ? 'router' : 'reload';"
            + "})()", result -> Log.i("LifeOSSync", "Cloud refresh mode: " + result));
    }

    private void startLocalApp() {
        try {
            File runtime = extractRuntime();
            File node = new File(getApplicationInfo().nativeLibraryDir, "libnode.so");
            if (!node.exists()) throw new IOException("Android Node runtime is missing.");
            File dataDir = new File(getFilesDir(), "data");
            if (!dataDir.exists() && !dataDir.mkdirs()) throw new IOException("Cannot create data folder.");
            int port;
            try (ServerSocket socket = new ServerSocket(0)) {
                port = socket.getLocalPort();
            }
            origin = "http://127.0.0.1:" + port;
            ProcessBuilder builder = new ProcessBuilder(
                node.getAbsolutePath(), new File(runtime, "android/launcher.cjs").getAbsolutePath());
            builder.directory(runtime);
            builder.redirectErrorStream(true);
            builder.environment().put("PORT", Integer.toString(port));
            builder.environment().put("HABITFLOW_ANDROID_DATA_DIR", dataDir.getAbsolutePath());
            builder.environment().put("HOME", getFilesDir().getAbsolutePath());
            builder.environment().put("TMPDIR", getCacheDir().getAbsolutePath());
            server = builder.start();
            captureServerLog(server, new File(dataDir, "server.log"));
            for (int attempt = 0; attempt < 240; attempt++) {
                if (!server.isAlive()) throw new IOException("LifeOS stopped during startup. Check server.log.");
                HttpURLConnection connection = null;
                try {
                    connection = (HttpURLConnection) new URL(origin + "/api/health").openConnection();
                    connection.setConnectTimeout(1000);
                    connection.setReadTimeout(1000);
                    if (connection.getResponseCode() == 200) {
                        runOnUiThread(() -> {
                            status.setVisibility(View.GONE);
                            webView.loadUrl(origin);
                        });
                        return;
                    }
                } catch (IOException ignored) {
                    // The local server is still starting.
                } finally {
                    if (connection != null) connection.disconnect();
                }
                Thread.sleep(500);
            }
            throw new IOException("LifeOS did not become ready. Check server.log.");
        } catch (Exception error) {
            runOnUiThread(() -> status.setText("LifeOS could not start.\n\n" + error.getMessage()));
        }
    }

    private File extractRuntime() throws IOException {
        File target = new File(getFilesDir(), "runtime-" + VERSION);
        File marker = new File(target, "android/launcher.cjs");
        long packageUpdateTime;
        try {
            packageUpdateTime = getPackageManager()
                .getPackageInfo(getPackageName(), 0).lastUpdateTime;
        } catch (PackageManager.NameNotFoundException error) {
            throw new IOException("Cannot identify the installed LifeOS package.", error);
        }
        if (marker.exists() && getPreferences(MODE_PRIVATE)
            .getLong("runtime-package-update-time", 0) == packageUpdateTime) return target;
        File temporary = new File(getFilesDir(), "runtime-extract");
        deleteTree(temporary);
        if (!temporary.mkdirs()) throw new IOException("Cannot create runtime folder.");
        String allowed = temporary.getCanonicalPath() + File.separator;
        try (ZipInputStream zip = new ZipInputStream(getAssets().open("lifeos-runtime.zip"))) {
            ZipEntry entry;
            byte[] buffer = new byte[64 * 1024];
            while ((entry = zip.getNextEntry()) != null) {
                File output = new File(temporary, entry.getName());
                if (!output.getCanonicalPath().startsWith(allowed)) {
                    throw new IOException("Invalid runtime archive path.");
                }
                if (entry.isDirectory()) {
                    if (!output.isDirectory() && !output.mkdirs()) throw new IOException("Cannot create folder.");
                } else {
                    File parent = output.getParentFile();
                    if (!parent.isDirectory() && !parent.mkdirs()) throw new IOException("Cannot create folder.");
                    try (FileOutputStream file = new FileOutputStream(output)) {
                        int count;
                        while ((count = zip.read(buffer)) != -1) file.write(buffer, 0, count);
                    }
                }
                zip.closeEntry();
            }
        }
        if (!new File(temporary, "android/launcher.cjs").exists()) {
            throw new IOException("The bundled LifeOS app is incomplete.");
        }
        deleteTree(target);
        if (!temporary.renameTo(target)) throw new IOException("Cannot install runtime files.");
        if (!getPreferences(MODE_PRIVATE).edit()
            .putLong("runtime-package-update-time", packageUpdateTime).commit()) {
            throw new IOException("Cannot record the installed LifeOS version.");
        }
        return target;
    }

    private void captureServerLog(Process process, File log) {
        new Thread(() -> {
            try (InputStream input = process.getInputStream();
                 FileOutputStream output = new FileOutputStream(log, true)) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            } catch (IOException ignored) {
                // The startup screen reports failure if the server exits.
            }
        }, "lifeos-server-log").start();
    }

    private void deleteTree(File file) throws IOException {
        if (!file.exists()) return;
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) for (File child : children) deleteTree(child);
        }
        if (!file.delete()) throw new IOException("Cannot clean old runtime files.");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == OPEN_BACKUP) {
            if (uploadCallback != null) {
                uploadCallback.onReceiveValue(resultCode == RESULT_OK && data != null
                    ? new Uri[]{data.getData()} : null);
                uploadCallback = null;
            }
        } else if (requestCode == SAVE_BACKUP && resultCode == RESULT_OK && data != null) {
            Uri destination = data.getData();
            String url = downloadUrl;
            new Thread(() -> saveBackup(url, destination), "lifeos-backup-download").start();
        }
    }

    private void saveBackup(String url, Uri destination) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(url).openConnection();
            String cookies = CookieManager.getInstance().getCookie(origin);
            if (cookies != null) connection.setRequestProperty("Cookie", cookies);
            if (connection.getResponseCode() != 200) throw new IOException("Backup download failed.");
            try (InputStream input = connection.getInputStream();
                 java.io.OutputStream output = getContentResolver().openOutputStream(destination)) {
                if (output == null) throw new IOException("Cannot write the chosen file.");
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            }
            runOnUiThread(() -> Toast.makeText(this, "LifeOS backup saved", Toast.LENGTH_LONG).show());
        } catch (IOException error) {
            runOnUiThread(() -> Toast.makeText(this,
                "Backup export failed: " + error.getMessage(), Toast.LENGTH_LONG).show());
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null && origin != null) {
            webView.post(() -> webView.evaluateJavascript(
                "window.dispatchEvent(new Event('lifeos:android-resume'))", null));
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (server != null) server.destroy();
        webView.destroy();
        super.onDestroy();
    }
}
