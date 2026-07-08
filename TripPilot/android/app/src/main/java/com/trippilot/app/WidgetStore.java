package com.trippilot.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

/**
 * DEC-468 — storage for the home-screen widget suite. The web layer pushes ONE
 * JSON payload (contract: src/domain/widgets/widget-payload.ts) and every
 * provider reads its own section at render time. The native side NEVER
 * computes money (ÂNCORA 10) — it renders what the app last pushed.
 *
 * Legacy keys (DEC-459) remain the fallback source for the "Livre hoje"
 * widget so a pre-0.72.0 web bundle keeps that widget alive.
 */
final class WidgetStore {

    static final String PREFS = "trippilot_widget";
    static final String KEY_PAYLOAD = "widget_payload_json";

    // Converter widget local state (the traveler's expression + chosen pair
    // survive between pushes and re-renders).
    static final String KEY_CONV_EXPR = "conv_expr";
    static final String KEY_CONV_FROM = "conv_from";
    static final String KEY_CONV_TO = "conv_to";
    // Calculator-first (2.7.1): conversion is a TOGGLE; default OFF.
    static final String KEY_CONV_MODE = "conv_mode"; // "on" | "off"
    // 2.7.7: currency picker state — "from" | "to" | null (closed).
    static final String KEY_CONV_PICKING = "conv_picking";
    // Native-fetched daily rates (converter widget only — never app money):
    // {"base","fetchedAtIso","ratesToBase":{...}} + last attempt throttle.
    static final String KEY_CONV_RATES = "conv_rates_json";
    static final String KEY_CONV_FETCH_AT = "conv_fetch_attempt_at";

    private WidgetStore() {}

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void savePayload(Context context, String json) {
        prefs(context).edit().putString(KEY_PAYLOAD, json).apply();
    }

    /** The whole payload, or an empty object when nothing was pushed yet. */
    static JSONObject payload(Context context) {
        String raw = prefs(context).getString(KEY_PAYLOAD, null);
        if (raw == null) return new JSONObject();
        try {
            return new JSONObject(raw);
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    /** One widget's section, or null when absent (widget shows its empty state). */
    static JSONObject section(Context context, String name) {
        return payload(context).optJSONObject(name);
    }

    /**
     * Null-safe string read. NEVER use bare optString for nullable payload
     * fields: an explicit JSON null comes back as the literal "null" string.
     */
    static String str(JSONObject obj, String key) {
        if (obj == null || obj.isNull(key)) return null;
        String value = obj.optString(key, null);
        return value == null || value.isEmpty() ? null : value;
    }

    /** Null-safe int read; returns fallback for absent/null values. */
    static int intOr(JSONObject obj, String key, int fallback) {
        if (obj == null || obj.isNull(key)) return fallback;
        return obj.optInt(key, fallback);
    }
}
