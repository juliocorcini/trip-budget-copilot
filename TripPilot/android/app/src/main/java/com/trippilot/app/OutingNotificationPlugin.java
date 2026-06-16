package com.trippilot.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.NumberFormat;
import java.util.Currency;
import java.util.Locale;

/**
 * N5/N6 (Gate 3): the rich fallback notification for the active outing on devices
 * that do NOT support the Android 16 Live Update (SDK < 36 — e.g. One UI 7). It
 * replaces the plain Capacitor LocalNotifications path with:
 *
 *   - a styled, accent-colored ongoing notification (BigTextStyle body),
 *   - quick-add VALUE buttons mirroring the active-outing screen, and
 *   - a {@link OutingActionReceiver} that logs a tap to a SharedPreferences queue
 *     and re-renders the notification WITHOUT opening the app.
 *
 * The JS layer drains the queue on resume ({@code drainQueue}) and registers the
 * real expenses through the domain orchestrator, then re-syncs the authoritative
 * total. All state needed to re-render after a background tap lives in prefs, so
 * the receiver never needs the WebView.
 */
@CapacitorPlugin(name = "OutingNotifier")
public class OutingNotificationPlugin extends Plugin {

    static final int NOTIFICATION_ID = 1001;
    static final String CHANNEL_ID = "outing_quick";
    static final String PREFS = "trippilot_outing_notif";
    static final String ACTION_QUICK_ADD = "com.trippilot.app.OUTING_QUICK_ADD";
    static final String EXTRA_AMOUNT = "amount_cents";

    static final String KEY_TITLE = "title";
    static final String KEY_ACCENT = "accent";
    static final String KEY_BASE_TOTAL = "base_total";
    static final String KEY_TARGET = "target";
    static final String KEY_AVG = "avg";
    static final String KEY_LOCALE = "locale";
    static final String KEY_CURRENCY = "currency";
    static final String KEY_TPL_NO_TARGET = "tpl_no_target";
    static final String KEY_TPL_UNDER = "tpl_under";
    static final String KEY_TPL_OVER = "tpl_over";
    static final String KEY_TPL_DRINKS = "tpl_drinks";
    static final String KEY_QUICKS = "quicks";
    static final String KEY_PENDING = "pending";
    static final String KEY_PENDING_SUM = "pending_sum";

    private static final String DEFAULT_ACCENT = "#C75B39";

    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject ret = new JSObject();
        // Action-button notifications are available on every API this app targets;
        // the JS layer only routes here when the Live Update (SDK >= 36) is absent.
        ret.put("supported", true);
        call.resolve();
    }

    @PluginMethod
    public void show(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);

        JSONArray quicks = new JSONArray();
        JSArray raw = call.getArray("quickAdds", new JSArray());
        try {
            for (int i = 0; i < raw.length(); i++) {
                JSONObject o = raw.getJSONObject(i);
                JSONObject q = new JSONObject();
                q.put("a", o.optLong("amountCents", 0));
                q.put("l", o.optString("label", ""));
                quicks.put(q);
            }
        } catch (Exception ignored) {
            // Malformed quick-adds → render the notification without buttons.
        }

        // `show` carries the authoritative total (JS already reconciled any queued
        // taps before calling it), so the displayed total resets to base + (still
        // un-drained) pending. We do NOT clear pending here — only drainQueue does,
        // so a tap that races an in-app update is never lost.
        prefs.edit()
                .putString(KEY_TITLE, call.getString("title", ""))
                .putString(KEY_ACCENT, call.getString("accentColor", DEFAULT_ACCENT))
                .putLong(KEY_BASE_TOTAL, call.getInt("totalCents", 0).longValue())
                .putLong(KEY_TARGET, call.getInt("targetCents", -1).longValue())
                .putLong(KEY_AVG, call.getInt("avgDrinkCents", -1).longValue())
                .putString(KEY_LOCALE, call.getString("locale", "en"))
                .putString(KEY_CURRENCY, call.getString("currency", "EUR"))
                .putString(KEY_TPL_NO_TARGET, call.getString("tplNoTarget", ""))
                .putString(KEY_TPL_UNDER, call.getString("tplUnder", ""))
                .putString(KEY_TPL_OVER, call.getString("tplOver", ""))
                .putString(KEY_TPL_DRINKS, call.getString("tplDrinks", ""))
                .putString(KEY_QUICKS, quicks.toString())
                .apply();

        postNotification(ctx);
        call.resolve();
    }

    @PluginMethod
    public void drainQueue(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String pending = prefs.getString(KEY_PENDING, "[]");
        prefs.edit().remove(KEY_PENDING).remove(KEY_PENDING_SUM).apply();

        JSObject ret = new JSObject();
        try {
            ret.put("items", new JSArray(pending));
        } catch (Exception e) {
            ret.put("items", new JSArray());
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        Context ctx = getContext();
        NotificationManagerCompat.from(ctx).cancel(NOTIFICATION_ID);
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply();
        call.resolve();
    }

    /**
     * Builds and posts the notification from the persisted state. Shared by the
     * plugin ({@code show}) and the broadcast receiver (background tap), so the
     * rendering is identical whether or not the WebView is alive.
     */
    static void postNotification(Context ctx) {
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        ensureChannel(ctx);

        long total = prefs.getLong(KEY_BASE_TOTAL, 0) + prefs.getLong(KEY_PENDING_SUM, 0);
        int accent = parseColor(prefs.getString(KEY_ACCENT, DEFAULT_ACCENT));
        String title = prefs.getString(KEY_TITLE, "");
        String body = buildBody(prefs, total);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(ctx.getApplicationInfo().icon)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setColor(accent)
                .setColorized(true)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(buildOpenIntent(ctx));

        // One action button per quick-add value (Android shows up to ~3). Each
        // fires a broadcast carrying its amount — no Activity launch.
        try {
            JSONArray quicks = new JSONArray(prefs.getString(KEY_QUICKS, "[]"));
            for (int i = 0; i < quicks.length(); i++) {
                JSONObject q = quicks.getJSONObject(i);
                long amount = q.optLong("a", 0);
                String label = q.optString("l", "");
                if (amount <= 0) continue;
                builder.addAction(0, label, buildQuickAddIntent(ctx, amount, i));
            }
        } catch (Exception ignored) {
            // No buttons if the stored list is unreadable — body still renders.
        }

        try {
            NotificationManagerCompat.from(ctx).notify(NOTIFICATION_ID, builder.build());
        } catch (SecurityException e) {
            // POST_NOTIFICATIONS not granted — the JS layer already gates on this.
        }
    }

    /** Appends a tapped amount to the pending queue (called by the receiver). */
    static void enqueue(Context ctx, long amountCents) {
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            JSONArray pending = new JSONArray(prefs.getString(KEY_PENDING, "[]"));
            JSONObject item = new JSONObject();
            item.put("amountCents", amountCents);
            item.put("ts", System.currentTimeMillis());
            pending.put(item);
            long sum = prefs.getLong(KEY_PENDING_SUM, 0) + amountCents;
            prefs.edit()
                    .putString(KEY_PENDING, pending.toString())
                    .putLong(KEY_PENDING_SUM, sum)
                    .apply();
        } catch (Exception ignored) {
            // If the queue is corrupt, drop this tap rather than crash the receiver.
        }
    }

    private static String buildBody(SharedPreferences prefs, long totalCents) {
        long target = prefs.getLong(KEY_TARGET, -1);
        long avg = prefs.getLong(KEY_AVG, -1);
        String currency = prefs.getString(KEY_CURRENCY, "EUR");
        String locale = prefs.getString(KEY_LOCALE, "en");

        if (target <= 0) {
            return money(prefs.getString(KEY_TPL_NO_TARGET, "{{total}}"), "{{total}}", totalCents, currency, locale);
        }
        if (totalCents <= target) {
            String body = prefs.getString(KEY_TPL_UNDER, "{{total}} / {{left}}");
            body = money(body, "{{total}}", totalCents, currency, locale);
            body = money(body, "{{left}}", target - totalCents, currency, locale);
            if (avg > 0) {
                long drinks = (target - totalCents) / avg;
                if (drinks > 0) {
                    body += "\n" + prefs.getString(KEY_TPL_DRINKS, "{{count}}")
                            .replace("{{count}}", String.valueOf(drinks));
                }
            }
            return body;
        }
        String body = prefs.getString(KEY_TPL_OVER, "{{total}} / {{over}}");
        body = money(body, "{{total}}", totalCents, currency, locale);
        body = money(body, "{{over}}", totalCents - target, currency, locale);
        return body;
    }

    private static String money(String template, String token, long cents, String currency, String locale) {
        return template.replace(token, formatMoney(cents, currency, locale));
    }

    private static String formatMoney(long cents, String currency, String locale) {
        try {
            NumberFormat nf = NumberFormat.getCurrencyInstance(Locale.forLanguageTag(locale));
            try {
                nf.setCurrency(Currency.getInstance(currency));
            } catch (IllegalArgumentException ignored) {
                // Unknown ISO code — keep the locale's default currency symbol.
            }
            // Whole amounts read cleaner without trailing ",00" in a glanceable chip.
            if (cents % 100 == 0) {
                nf.setMaximumFractionDigits(0);
            }
            return nf.format(cents / 100.0);
        } catch (Exception e) {
            return String.valueOf(cents / 100.0);
        }
    }

    private static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm =
                    (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
                // LOW: silent updates (no sound/heads-up) for an ongoing tracker.
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID, "Active outing", NotificationManager.IMPORTANCE_LOW);
                channel.setDescription("Live total of the outing in progress");
                nm.createNotificationChannel(channel);
            }
        }
    }

    private static PendingIntent buildOpenIntent(Context ctx) {
        Intent intent = new Intent(ctx, MainActivity.class);
        intent.setAction(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_LAUNCHER);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(
                ctx, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent buildQuickAddIntent(Context ctx, long amountCents, int index) {
        Intent intent = new Intent(ctx, OutingActionReceiver.class);
        intent.setAction(ACTION_QUICK_ADD);
        intent.putExtra(EXTRA_AMOUNT, amountCents);
        // Distinct request code per button so extras are not collapsed together.
        return PendingIntent.getBroadcast(
                ctx, 1100 + index, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static int parseColor(String hex) {
        try {
            return Color.parseColor(hex == null ? DEFAULT_ACCENT : hex.trim());
        } catch (IllegalArgumentException e) {
            return Color.parseColor(DEFAULT_ACCENT);
        }
    }
}
