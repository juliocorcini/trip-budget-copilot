package com.trippilot.app;

import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.text.TextUtils;

import androidx.core.content.IntentCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

/**
 * B1 (Onda 4 / DEC-215): receive a `.csv` shared from another app (Wise, Files…)
 * and hand the text to the web layer, which routes it through the existing Wise
 * import preview (the pure `parseWiseCsv` path). The CSV may arrive via
 * ACTION_SEND (EXTRA_STREAM/EXTRA_TEXT) or ACTION_VIEW (content/file Uri).
 *
 * The CSV is buffered in a static field because the launch intent is read in
 * MainActivity.onCreate, which can run before the JS bridge has loaded this
 * plugin. JS drains it with getPending(); a warm share (onNewIntent) is pushed
 * live through the "csvShared" event.
 */
@CapacitorPlugin(name = "ShareTarget")
public class ShareTargetPlugin extends Plugin {
    private static ShareTargetPlugin instance;
    private static String pendingCsv;

    @Override
    public void load() {
        instance = this;
    }

    /** Reads + buffers any CSV carried by the intent. Returns true when found. */
    public static boolean handleIntent(Context context, Intent intent) {
        String csv = extractCsv(context, intent);
        if (TextUtils.isEmpty(csv)) {
            return false;
        }
        pendingCsv = csv;
        if (instance != null) {
            JSObject data = new JSObject();
            data.put("csv", csv);
            instance.notifyListeners("csvShared", data);
        }
        return true;
    }

    @PluginMethod
    public void getPending(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("csv", pendingCsv);
        pendingCsv = null;
        call.resolve(ret);
    }

    private static String extractCsv(Context context, Intent intent) {
        if (intent == null) {
            return null;
        }
        String action = intent.getAction();
        if (Intent.ACTION_SEND.equals(action)) {
            Uri stream = IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri.class);
            if (stream != null) {
                String fromStream = readUri(context, stream);
                if (!TextUtils.isEmpty(fromStream)) {
                    return fromStream;
                }
            }
            CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
            return text != null ? text.toString() : null;
        }
        if (Intent.ACTION_VIEW.equals(action)) {
            Uri data = intent.getData();
            if (data != null && isReadableScheme(data.getScheme())) {
                return readUri(context, data);
            }
        }
        return null;
    }

    /** Only local content can be read as a file; http(s) App Links are not CSVs. */
    private static boolean isReadableScheme(String scheme) {
        return ContentResolver.SCHEME_CONTENT.equals(scheme) || ContentResolver.SCHEME_FILE.equals(scheme);
    }

    private static String readUri(Context context, Uri uri) {
        ContentResolver resolver = context.getContentResolver();
        StringBuilder builder = new StringBuilder();
        try (InputStream input = resolver.openInputStream(uri)) {
            if (input == null) {
                return null;
            }
            BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8));
            String line;
            boolean first = true;
            while ((line = reader.readLine()) != null) {
                if (!first) {
                    builder.append('\n');
                }
                builder.append(line);
                first = false;
            }
        } catch (IOException | SecurityException error) {
            return null;
        }
        return builder.toString();
    }
}
