package com.trippilot.app;

import android.app.PendingIntent;
import android.content.Context;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;

/**
 * DEC-468 — piggy bank widget: the settled cofrinho balance (DEC-464
 * semantics, pushed by the app) plus savings-goal progress. DEFAULT 2x2;
 * 1x1 keeps 🐷 + balance. Tap opens the app (the cofrinho card lives on
 * the dashboard).
 */
public class PiggyWidgetProvider extends ResizableWidgetProvider {

    @Override
    protected RemoteViews buildSized(Context context, Bundle options) {
        int width = minWidthDp(options);
        int height = minHeightDp(options);
        boolean mini = (width > 0 && width < 110) || (height > 0 && height < 110);

        JSONObject data = WidgetStore.section(context, "piggy");
        String value = WidgetStore.str(data, "value");
        if (value == null) value = context.getString(R.string.widget_value_empty);
        PendingIntent open = openApp(context);

        if (mini) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_piggy_small);
            views.setTextViewText(R.id.piggy_value, value);
            if (open != null) views.setOnClickPendingIntent(R.id.widget_root, open);
            return views;
        }

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_piggy);
        String label = WidgetStore.str(data, "label");
        views.setTextViewText(
            R.id.piggy_label,
            label != null ? label : context.getString(R.string.widget_piggy_default)
        );
        views.setTextViewText(R.id.piggy_value, value);

        int progress = WidgetStore.intOr(data, "progressPct", -1);
        views.setViewVisibility(R.id.piggy_progress, progress >= 0 ? View.VISIBLE : View.GONE);
        if (progress >= 0) views.setProgressBar(R.id.piggy_progress, 100, progress, false);

        String goalLine = WidgetStore.str(data, "goalLine");
        views.setViewVisibility(R.id.piggy_goal, goalLine != null ? View.VISIBLE : View.GONE);
        if (goalLine != null) views.setTextViewText(R.id.piggy_goal, goalLine);

        if (open != null) views.setOnClickPendingIntent(R.id.widget_root, open);
        return views;
    }
}
