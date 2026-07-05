package com.trippilot.app;

import android.content.Context;
import android.os.Bundle;
import android.widget.RemoteViews;

import org.json.JSONObject;

/**
 * DEC-468 — quick actions widget: the four everyday actions one tap from the
 * home screen (register expense / scan receipt / start outing / converter).
 * Buckets: 1x1 = single quick-add pill; row (DEFAULT 4x1) = four labeled
 * targets; 2x2+ = grid with bigger targets. Labels are pushed localized.
 */
public class QuickActionsWidgetProvider extends ResizableWidgetProvider {

    @Override
    protected RemoteViews buildSized(Context context, Bundle options) {
        int width = minWidthDp(options);
        int height = minHeightDp(options);
        boolean mini = width > 0 && width < 110;
        boolean grid = !mini && height >= 110;

        if (mini) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_actions_small);
            views.setOnClickPendingIntent(R.id.action_add, openLink(context, "/quick-add"));
            views.setOnClickPendingIntent(R.id.widget_root, openLink(context, "/quick-add"));
            return views;
        }

        RemoteViews views = new RemoteViews(
            context.getPackageName(),
            grid ? R.layout.widget_actions_grid : R.layout.widget_actions_row
        );
        JSONObject data = WidgetStore.section(context, "actions");
        setLabel(views, R.id.action_add_label, data, "add",
            context.getString(R.string.widget_action_add_default));
        setLabel(views, R.id.action_scan_label, data, "scan",
            context.getString(R.string.widget_action_scan_default));
        setLabel(views, R.id.action_outing_label, data, "outing",
            context.getString(R.string.widget_action_outing_default));
        setLabel(views, R.id.action_convert_label, data, "convert",
            context.getString(R.string.widget_action_convert_default));

        views.setOnClickPendingIntent(R.id.action_add, openLink(context, "/quick-add"));
        views.setOnClickPendingIntent(R.id.action_scan, openLink(context, "/receipt/scan"));
        views.setOnClickPendingIntent(R.id.action_outing, openLink(context, "/outings/new"));
        views.setOnClickPendingIntent(R.id.action_convert, openLink(context, "/converter"));
        return views;
    }

    private static void setLabel(RemoteViews views, int viewId, JSONObject data, String key, String fallback) {
        String label = WidgetStore.str(data, key);
        views.setTextViewText(viewId, label != null ? label : fallback);
    }
}
