package com.trippilot.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

/**
 * DEC-459 — "Livre hoje" home-screen widget.
 *
 * The web layer computes the daily free amount (the Home hero) and pushes the
 * formatted strings through {@link HomeWidgetPlugin}; this provider only ever
 * RENDERS what was last pushed (no math on the native side, so the number can
 * never diverge from the app). While the app has not run yet, the widget shows
 * a neutral "open the app" state.
 *
 * Taps: the body opens the app on the dashboard; the "+" button deep-links to
 * /quick-add through the existing App Links route (setPackage pins the intent
 * to this app, so no browser chooser can appear).
 */
public class HomeWidgetProvider extends AppWidgetProvider {

    static final String PREFS = "trippilot_widget";
    static final String KEY_VALUE = "free_today_value";
    static final String KEY_LABEL = "free_today_label";
    static final String KEY_HINT = "quick_add_hint";

    private static final String APEX = "https://trippilot.pages.dev";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        for (int widgetId : widgetIds) {
            manager.updateAppWidget(widgetId, buildViews(context));
        }
    }

    /** Re-render every instance of the widget with the latest pushed strings. */
    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName provider = new ComponentName(context, HomeWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(provider);
        if (ids.length == 0) return;
        RemoteViews views = buildViews(context);
        for (int id : ids) {
            manager.updateAppWidget(id, views);
        }
    }

    private static RemoteViews buildViews(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String value = prefs.getString(KEY_VALUE, null);
        String label = prefs.getString(KEY_LABEL, context.getString(R.string.widget_label_default));
        String hint = prefs.getString(KEY_HINT, context.getString(R.string.widget_add_default));

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_free_today);
        views.setTextViewText(R.id.widget_label, label);
        views.setTextViewText(
            R.id.widget_value,
            value != null ? value : context.getString(R.string.widget_value_empty)
        );
        views.setTextViewText(R.id.widget_add, hint);

        // Body → open the app (dashboard). A plain launcher intent survives the
        // app being fully killed.
        Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (open != null) {
            open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            views.setOnClickPendingIntent(
                R.id.widget_root,
                PendingIntent.getActivity(
                    context, 0, open,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                )
            );
        }

        // "+" → /quick-add via the App Links path the deep-link listener already
        // consumes (B2/DEC-215 wiring). setPackage keeps it inside this app.
        Intent add = new Intent(Intent.ACTION_VIEW, Uri.parse(APEX + "/quick-add"));
        add.setPackage(context.getPackageName());
        add.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        views.setOnClickPendingIntent(
            R.id.widget_add,
            PendingIntent.getActivity(
                context, 1, add,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            )
        );

        return views;
    }
}
