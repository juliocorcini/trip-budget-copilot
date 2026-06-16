package com.trippilot.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import androidx.annotation.RequiresApi;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * FIELD R2 item 1: save a text file straight to the public Downloads folder.
 *
 * `@capacitor/filesystem` has no Downloads directory and its Documents path is
 * sandboxed on Android 11+, so backups landed where the traveler could not find
 * them. This writes through MediaStore.Downloads on API 29+ (no permission
 * required) and falls back to the legacy public Downloads dir on older devices.
 * The JS boundary falls back to Documents if this ever rejects.
 */
@CapacitorPlugin(name = "DeviceFile")
public class DeviceFilePlugin extends Plugin {

    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        String name = call.getString("name");
        String data = call.getString("data");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        if (name == null || data == null) {
            call.reject("name and data are required");
            return;
        }

        byte[] bytes = data.getBytes(StandardCharsets.UTF_8);
        try {
            String uri = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                    ? saveViaMediaStore(name, mimeType, bytes)
                    : saveLegacy(name, bytes);
            if (uri == null) {
                call.reject("Could not write to Downloads");
                return;
            }
            JSObject ret = new JSObject();
            ret.put("uri", uri);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not write to Downloads", e);
        }
    }

    @RequiresApi(api = Build.VERSION_CODES.Q)
    private String saveViaMediaStore(String name, String mimeType, byte[] bytes) throws Exception {
        Context ctx = getContext();
        ContentResolver resolver = ctx.getContentResolver();

        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, name);
        values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
        values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

        Uri item = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (item == null) {
            return null;
        }
        try (OutputStream out = resolver.openOutputStream(item)) {
            if (out == null) {
                return null;
            }
            out.write(bytes);
        }
        return item.toString();
    }

    private String saveLegacy(String name, byte[] bytes) throws Exception {
        File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        if (dir != null && !dir.exists()) {
            dir.mkdirs();
        }
        File file = new File(dir, name);
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(bytes);
        }
        return Uri.fromFile(file).toString();
    }
}
