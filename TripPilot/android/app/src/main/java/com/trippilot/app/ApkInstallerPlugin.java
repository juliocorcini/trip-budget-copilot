package com.trippilot.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * DEC-210: download the published APK and hand it to the system package
 * installer. We NEVER install silently — Android always shows its own confirm
 * screen; this only removes the "find the built APK and sideload it by hand"
 * friction. OTA (Capgo) refreshes the web bundle; this refreshes the shell.
 */
@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstallerPlugin extends Plugin {

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        final String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("url is required");
            return;
        }

        // API 26+: the app needs the user's "install unknown apps" grant. When it
        // is missing, send them to the exact settings page and stop — they grant
        // it once and retry. (Pre-26 relies on the global unknown-sources prompt.)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
            try {
                Intent settings = new Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getContext().getPackageName()));
                settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(settings);
            } catch (Exception ignored) {
            }
            resolveStatus(call, "permission");
            return;
        }

        new Thread(() -> {
            try {
                final File apk = download(url);
                final Activity activity = getActivity();
                if (activity != null) {
                    activity.runOnUiThread(() -> {
                        try {
                            launchInstaller(apk);
                            resolveStatus(call, "installing");
                        } catch (Exception e) {
                            resolveStatus(call, "failed");
                        }
                    });
                } else {
                    launchInstaller(apk);
                    resolveStatus(call, "installing");
                }
            } catch (Exception e) {
                resolveStatus(call, "failed");
            }
        }).start();
    }

    private File download(String url) throws Exception {
        File dir = new File(getContext().getCacheDir(), "updates");
        if (!dir.exists()) {
            dir.mkdirs();
        }
        // One stable filename so stale downloads do not pile up in the cache.
        File out = new File(dir, "trippilot-update.apk");

        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setConnectTimeout(20000);
        conn.setReadTimeout(60000);
        conn.setInstanceFollowRedirects(true);
        conn.connect();
        if (conn.getResponseCode() / 100 != 2) {
            conn.disconnect();
            throw new Exception("HTTP " + conn.getResponseCode());
        }
        try (InputStream in = conn.getInputStream(); OutputStream os = new FileOutputStream(out)) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) != -1) {
                os.write(buf, 0, n);
            }
            os.flush();
        } finally {
            conn.disconnect();
        }
        return out;
    }

    private void launchInstaller(File apk) {
        Uri uri = FileProvider.getUriForFile(
                getContext(), getContext().getPackageName() + ".fileprovider", apk);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
    }

    private void resolveStatus(PluginCall call, String status) {
        JSObject ret = new JSObject();
        ret.put("status", status);
        call.resolve(ret);
    }
}
