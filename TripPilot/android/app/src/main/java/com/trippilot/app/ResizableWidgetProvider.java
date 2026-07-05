package com.trippilot.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.RemoteViews;

/**
 * DEC-468 — base for every TripPilot widget. All widgets are freely resizable
 * down to 1x1: the launcher reports the current cell footprint through the
 * widget options and {@link #buildSized} picks the right layout bucket. Works
 * on every supported API (minSdk 24) — no RemoteViews size-map (API 31+)
 * needed; onAppWidgetOptionsChanged re-renders on every resize.
 *
 * Providers stay dumb renderers (DEC-459): the web layer pushes all data via
 * {@link HomeWidgetPlugin} into {@link WidgetStore}.
 */
public abstract class ResizableWidgetProvider extends AppWidgetProvider {

    static final String APEX = "https://trippilot.pages.dev";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        for (int widgetId : widgetIds) {
            manager.updateAppWidget(
                widgetId,
                buildSized(context, manager.getAppWidgetOptions(widgetId))
            );
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(
        Context context, AppWidgetManager manager, int widgetId, Bundle newOptions
    ) {
        manager.updateAppWidget(widgetId, buildSized(context, newOptions));
    }

    /** Render this widget for the given launcher-reported size options. */
    protected abstract RemoteViews buildSized(Context context, Bundle options);

    /** Portrait width in dp the launcher granted (0 when unknown → default). */
    static int minWidthDp(Bundle options) {
        return options == null ? 0 : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
    }

    /** Landscape (minimum) height in dp (0 when unknown → default). */
    static int minHeightDp(Bundle options) {
        return options == null ? 0 : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
    }

    /** Ask the system to re-deliver onUpdate for every instance of a provider. */
    static void requestRefresh(Context context, Class<? extends AppWidgetProvider> provider) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, provider));
        if (ids.length == 0) return;
        Intent intent = new Intent(context, provider);
        intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        context.sendBroadcast(intent);
    }

    /** Refresh the whole suite — called after every web push. */
    static void refreshAllWidgets(Context context) {
        requestRefresh(context, HomeWidgetProvider.class);
        requestRefresh(context, ConverterWidgetProvider.class);
        requestRefresh(context, QuickActionsWidgetProvider.class);
        requestRefresh(context, MetasWidgetProvider.class);
        requestRefresh(context, PiggyWidgetProvider.class);
        requestRefresh(context, NextEventWidgetProvider.class);
        requestRefresh(context, TodayWidgetProvider.class);
    }

    /** Opens the app on the dashboard (survives the app being fully killed). */
    static PendingIntent openApp(Context context) {
        Intent open = context.getPackageManager()
            .getLaunchIntentForPackage(context.getPackageName());
        if (open == null) return null;
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(
            context, 0, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    /**
     * Deep-links into an in-app route via the App Links path the deep-link
     * listener already consumes (B2/DEC-215). setPackage pins the intent to
     * this app; the distinct data URI keeps every PendingIntent unique.
     */
    static PendingIntent openLink(Context context, String path) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(APEX + path));
        intent.setPackage(context.getPackageName());
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }
}
