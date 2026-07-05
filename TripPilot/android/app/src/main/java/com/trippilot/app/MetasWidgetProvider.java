package com.trippilot.app;

import android.app.PendingIntent;
import android.content.Context;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * DEC-468 — metas widget: mirrors the home occasion carousel (planned metas
 * first with remaining/done — including the "N antigas" pre-plan history —
 * then activity counts). 1x1 shows the top meta; the DEFAULT 3x2 shows three
 * rows; taller sizes reveal up to six. Tap opens the expense list.
 */
public class MetasWidgetProvider extends ResizableWidgetProvider {

    private static final int[] ROW_IDS = {
        R.id.meta_row_1, R.id.meta_row_2, R.id.meta_row_3,
        R.id.meta_row_4, R.id.meta_row_5, R.id.meta_row_6,
    };
    private static final int[] EMOJI_IDS = {
        R.id.meta_emoji_1, R.id.meta_emoji_2, R.id.meta_emoji_3,
        R.id.meta_emoji_4, R.id.meta_emoji_5, R.id.meta_emoji_6,
    };
    private static final int[] NAME_IDS = {
        R.id.meta_name_1, R.id.meta_name_2, R.id.meta_name_3,
        R.id.meta_name_4, R.id.meta_name_5, R.id.meta_name_6,
    };
    private static final int[] COUNT_IDS = {
        R.id.meta_count_1, R.id.meta_count_2, R.id.meta_count_3,
        R.id.meta_count_4, R.id.meta_count_5, R.id.meta_count_6,
    };
    private static final int[] DETAIL_IDS = {
        R.id.meta_detail_1, R.id.meta_detail_2, R.id.meta_detail_3,
        R.id.meta_detail_4, R.id.meta_detail_5, R.id.meta_detail_6,
    };

    @Override
    protected RemoteViews buildSized(Context context, Bundle options) {
        int width = minWidthDp(options);
        int height = minHeightDp(options);
        boolean mini = width > 0 && width < 110;

        JSONObject data = WidgetStore.section(context, "metas");
        JSONArray items = data != null ? data.optJSONArray("items") : null;
        PendingIntent open = openLink(context, "/expenses");

        if (mini) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_metas_small);
            JSONObject top = items != null ? items.optJSONObject(0) : null;
            if (top != null) {
                views.setTextViewText(R.id.meta_top_emoji, top.optString("emoji", "🎯"));
                views.setTextViewText(R.id.meta_top_count, String.valueOf(top.optInt("count", 0)));
            }
            views.setOnClickPendingIntent(R.id.widget_root, open);
            return views;
        }

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_metas);
        String label = WidgetStore.str(data, "label");
        views.setTextViewText(
            R.id.metas_label,
            label != null ? label : context.getString(R.string.widget_metas_default)
        );

        // 3 rows on the default 2-cell height; taller widgets reveal more —
        // roughly one extra row per ~35dp beyond the default card.
        int capacity = height >= 230 ? 6 : height >= 180 ? 5 : height >= 140 ? 4 : 3;
        // Wide-but-short (Nx1) still shows one row so the widget never looks dead.
        if (height > 0 && height < 110) capacity = 1;

        for (int i = 0; i < ROW_IDS.length; i++) {
            JSONObject item = items != null && i < capacity ? items.optJSONObject(i) : null;
            views.setViewVisibility(ROW_IDS[i], item != null ? View.VISIBLE : View.GONE);
            if (item == null) continue;
            views.setTextViewText(EMOJI_IDS[i], item.optString("emoji", "💸"));
            views.setTextViewText(NAME_IDS[i], item.optString("name", ""));
            views.setTextViewText(COUNT_IDS[i], String.valueOf(item.optInt("count", 0)));
            views.setTextViewText(DETAIL_IDS[i], item.optString("detail", ""));
        }
        views.setOnClickPendingIntent(R.id.widget_root, open);
        return views;
    }
}
