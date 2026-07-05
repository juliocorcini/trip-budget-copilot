package com.trippilot.app;

import android.app.PendingIntent;
import android.content.Context;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;

/**
 * DEC-468 — next event widget: the soonest upcoming planned occurrence with a
 * countdown chip. The absolute date always rides along in the detail line
 * (Critic: a push-only widget can go stale — "em 2 dias" must never be the
 * only truth). DEFAULT 3x1; 1x1 shows the day count; tall reveals details.
 */
public class NextEventWidgetProvider extends ResizableWidgetProvider {

    @Override
    protected RemoteViews buildSized(Context context, Bundle options) {
        int width = minWidthDp(options);
        int height = minHeightDp(options);
        boolean mini = width > 0 && width < 110;
        boolean tall = !mini && height >= 110;

        JSONObject data = WidgetStore.section(context, "nextEvent");
        PendingIntent open = openApp(context);

        if (mini) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_event_small);
            int days = WidgetStore.intOr(data, "daysUntil", -1);
            views.setTextViewText(R.id.event_days, days >= 0 ? days + "d" : "—");
            if (open != null) views.setOnClickPendingIntent(R.id.widget_root, open);
            return views;
        }

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_event);
        String label = WidgetStore.str(data, "label");
        views.setTextViewText(
            R.id.event_label,
            label != null ? label : context.getString(R.string.widget_event_default)
        );
        String name = WidgetStore.str(data, "name");
        views.setTextViewText(
            R.id.event_name,
            name != null ? name : context.getString(R.string.widget_event_none)
        );
        String countdown = WidgetStore.str(data, "countdown");
        views.setTextViewText(R.id.event_countdown, countdown != null ? countdown : "—");

        String detail = WidgetStore.str(data, "detailLine");
        boolean showDetail = tall && detail != null;
        views.setViewVisibility(R.id.event_detail, showDetail ? View.VISIBLE : View.GONE);
        if (showDetail) views.setTextViewText(R.id.event_detail, detail);

        if (open != null) views.setOnClickPendingIntent(R.id.widget_root, open);
        return views;
    }
}
