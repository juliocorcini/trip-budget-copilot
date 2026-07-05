package com.trippilot.app;

import android.app.PendingIntent;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;

/**
 * DEC-459 — "Livre hoje" home-screen widget, DEC-468 — resizable buckets.
 *
 * The web layer computes the daily free amount (the Home hero) and pushes the
 * formatted strings; this provider only ever RENDERS what was last pushed (no
 * math on the native side, so the number can never diverge from the app).
 *
 * Size buckets (launcher-reported dp):
 * - mini  (width < 110): the number, nothing else — 1x1.
 * - row   (height < 110): label + number + quick-add pill — 3x1 DEFAULT.
 * - tall  (>= 3x2): adds spent-today, day-of-trip and the phase progress bar.
 *
 * Data: payload section "freeToday" (DEC-468) with fallback to the legacy
 * DEC-459 keys so a pre-0.72.0 web bundle keeps this widget alive.
 */
public class HomeWidgetProvider extends ResizableWidgetProvider {

    static final String PREFS = WidgetStore.PREFS;
    static final String KEY_VALUE = "free_today_value";
    static final String KEY_LABEL = "free_today_label";
    static final String KEY_HINT = "quick_add_hint";

    /** Kept for the legacy `update` plugin path (pre-payload web bundles). */
    static void refreshAll(Context context) {
        requestRefresh(context, HomeWidgetProvider.class);
    }

    @Override
    protected RemoteViews buildSized(Context context, Bundle options) {
        int width = minWidthDp(options);
        int height = minHeightDp(options);

        JSONObject data = WidgetStore.section(context, "freeToday");
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String value = WidgetStore.str(data, "value");
        if (value == null) value = prefs.getString(KEY_VALUE, null);
        String label = WidgetStore.str(data, "label");
        if (label == null) {
            label = prefs.getString(KEY_LABEL, context.getString(R.string.widget_label_default));
        }
        String hint = WidgetStore.str(data, "addHint");
        if (hint == null) {
            hint = prefs.getString(KEY_HINT, context.getString(R.string.widget_add_default));
        }
        if (value == null) value = context.getString(R.string.widget_value_empty);

        boolean mini = width > 0 && width < 110;
        boolean tall = !mini && height >= 110;
        int layout = mini
            ? R.layout.widget_free_today_small
            : tall ? R.layout.widget_free_today_tall : R.layout.widget_free_today;

        RemoteViews views = new RemoteViews(context.getPackageName(), layout);
        views.setTextViewText(R.id.widget_label, label);
        views.setTextViewText(R.id.widget_value, value);

        if (tall) {
            String spentLine = WidgetStore.str(data, "spentLine");
            views.setViewVisibility(R.id.widget_spent, spentLine != null ? View.VISIBLE : View.GONE);
            if (spentLine != null) views.setTextViewText(R.id.widget_spent, spentLine);

            String dayLine = WidgetStore.str(data, "dayLine");
            views.setViewVisibility(R.id.widget_day, dayLine != null ? View.VISIBLE : View.GONE);
            if (dayLine != null) views.setTextViewText(R.id.widget_day, dayLine);

            int progress = WidgetStore.intOr(data, "progressPct", -1);
            views.setViewVisibility(R.id.widget_progress, progress >= 0 ? View.VISIBLE : View.GONE);
            if (progress >= 0) views.setProgressBar(R.id.widget_progress, 100, progress, false);
        }

        PendingIntent open = openApp(context);
        if (open != null) views.setOnClickPendingIntent(R.id.widget_root, open);
        if (!mini) {
            views.setTextViewText(R.id.widget_add, hint);
            views.setOnClickPendingIntent(R.id.widget_add, openLink(context, "/quick-add"));
        }
        return views;
    }
}
