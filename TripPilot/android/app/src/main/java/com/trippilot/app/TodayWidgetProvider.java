package com.trippilot.app;

import android.app.PendingIntent;
import android.content.Context;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * DEC-468 — "Hoje" widget: today's total spend + the latest expense rows
 * (emoji + description + amount, pushed formatted). DEFAULT 3x2 (3 rows);
 * 1x1 keeps the total; taller sizes reveal up to five rows. Tap opens the
 * expense list.
 */
public class TodayWidgetProvider extends ResizableWidgetProvider {

    private static final int[] ROW_IDS = {
        R.id.today_row_1, R.id.today_row_2, R.id.today_row_3,
        R.id.today_row_4, R.id.today_row_5,
    };

    @Override
    protected RemoteViews buildSized(Context context, Bundle options) {
        int width = minWidthDp(options);
        int height = minHeightDp(options);
        boolean mini = (width > 0 && width < 110) || (height > 0 && height < 110);

        JSONObject data = WidgetStore.section(context, "today");
        String label = WidgetStore.str(data, "label");
        if (label == null) label = context.getString(R.string.widget_today_default);
        String total = WidgetStore.str(data, "totalLine");
        if (total == null) total = context.getString(R.string.widget_today_empty);
        PendingIntent open = openLink(context, "/expenses");

        if (mini) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_today_small);
            views.setTextViewText(R.id.today_label, label);
            views.setTextViewText(R.id.today_total, total);
            views.setOnClickPendingIntent(R.id.widget_root, open);
            return views;
        }

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_today);
        views.setTextViewText(R.id.today_label, label);
        views.setTextViewText(R.id.today_total, total);

        JSONArray items = data != null ? data.optJSONArray("items") : null;
        int capacity = height >= 230 ? 5 : height >= 180 ? 4 : 3;
        for (int i = 0; i < ROW_IDS.length; i++) {
            JSONObject item = items != null && i < capacity ? items.optJSONObject(i) : null;
            views.setViewVisibility(ROW_IDS[i], item != null ? View.VISIBLE : View.GONE);
            if (item == null) continue;
            views.setTextViewText(
                ROW_IDS[i],
                item.optString("emoji", "💸") + "  " + item.optString("text", "")
            );
        }
        views.setOnClickPendingIntent(R.id.widget_root, open);
        return views;
    }
}
