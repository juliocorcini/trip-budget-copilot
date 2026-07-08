package com.trippilot.app;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.text.format.DateUtils;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.DecimalFormat;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.Locale;
import java.util.TimeZone;

/**
 * DEC-468/DEC-471 — calculator-FIRST widget with a conversion toggle.
 *
 * 2.7.1 field feedback (Julio): "é primeiro uma calculadora mesmo, com o botão
 * de ativar ou desativar o conversor". Default mode is pure calculator; the 💱
 * key/chip toggles live FX conversion of the current result. The keypad is
 * available from 3 cells of height (dense 5x4 grid — the new DEFAULT 3x3) and
 * roomier at 4+ cells (4x5 grid).
 *
 * Rates honesty (DEC-256 + 2.7.1): the shown rate must be AT LEAST today's.
 * The app pushes its frozen snapshot (with fetchedAtIso); the widget ALSO
 * fetches the same free daily API natively (open.er-api.com — the exact
 * source of utils/exchange-rates.ts) whenever the freshest known snapshot is
 * not from today, and the ↻ button forces a refresh on demand. Whichever
 * snapshot is fresher wins. This is the ONLY native money math exception
 * (ÂNCORA 10 amendment): converting typed input offline needs rates on the
 * device, and stale rates would lie to the traveler.
 *
 * Interaction: every key is a self-targeted broadcast with a unique data URI
 * (extras are ignored in PendingIntent equality — the URI keeps keys
 * distinct). State (expression + pair + mode) lives in SharedPreferences.
 *
 * Size buckets: mini (1x1: result) → row (Nx1: expression + result + toggles)
 * → compact (2x2: no keypad) → full3 (3x3 DEFAULT: dense keypad) → full
 * (3x4+: comfy keypad + chips row).
 */
public class ConverterWidgetProvider extends ResizableWidgetProvider {

    private static final String ACTION_KEY = "com.trippilot.app.CONVERTER_KEY";
    private static final int MAX_EXPR_LENGTH = 24;
    private static final char[] OPERATORS = {'+', '-', '×', '÷'};

    private static final String RATES_URL = "https://open.er-api.com/v6/latest/";
    private static final long AUTO_FETCH_GAP_MS = 30 * 60_000L; // background retry gap
    private static final long MANUAL_FETCH_GAP_MS = 15_000L;    // ↻ tap-spam guard

    private static final int COLOR_ACCENT = 0xFF2DD4BF;
    private static final int COLOR_CHIP_BG = 0xFF1E293B;
    private static final int COLOR_TEXT_DIM = 0xFF94A3B8;
    private static final int[] PICK_IDS = {
        R.id.conv_pick_0, R.id.conv_pick_1, R.id.conv_pick_2,
        R.id.conv_pick_3, R.id.conv_pick_4, R.id.conv_pick_5,
    };

    // ---------------------------------------------------------------- render

    @Override
    protected RemoteViews buildSized(Context context, Bundle options) {
        int width = minWidthDp(options);
        int height = minHeightDp(options);
        boolean unknown = width == 0 && height == 0;
        boolean mini = width > 0 && width < 110;
        boolean row = !mini && height > 0 && height < 110;
        boolean full = !mini && !row && height >= 230 && width >= 160;
        boolean full3 = !mini && !row && !full && (unknown || (height >= 150 && width >= 160));

        SharedPreferences prefs = WidgetStore.prefs(context);
        JSONObject conv = WidgetStore.section(context, "converter");
        String from = currency(prefs.getString(WidgetStore.KEY_CONV_FROM, null), conv, "from", "EUR");
        String to = currency(prefs.getString(WidgetStore.KEY_CONV_TO, null), conv, "to", "BRL");
        String expr = prefs.getString(WidgetStore.KEY_CONV_EXPR, "");
        boolean fxOn = "on".equals(prefs.getString(WidgetStore.KEY_CONV_MODE, "off"));
        String picking = prefs.getString(WidgetStore.KEY_CONV_PICKING, null);

        Double result = evaluate(expr);
        RatesInfo rates = resolveRates(context, conv);
        Double rate = fxOn ? pairRate(from, to, rates) : null;
        Double converted = result != null && rate != null ? result * rate : null;

        int layout = mini
            ? R.layout.widget_converter_mini
            : row
                ? R.layout.widget_converter_row
                : full
                    ? R.layout.widget_converter_full
                    : full3 ? R.layout.widget_converter_full3 : R.layout.widget_converter_compact;
        RemoteViews views = new RemoteViews(context.getPackageName(), layout);

        DecimalFormat money = new DecimalFormat("#,##0.00");
        DecimalFormat plain = new DecimalFormat("#,##0.####");
        String bigLine = fxOn
            ? (converted != null
                ? to + " " + money.format(converted)
                : result != null
                    ? context.getString(R.string.widget_converter_no_rate)
                    : to + " 0")
            : (result != null ? plain.format(result) : "0");

        String openPath = openConverterPath(result, from, to);

        if (mini) {
            views.setTextViewText(R.id.conv_pair, fxOn ? from + "→" + to : "🧮");
            views.setTextViewText(
                R.id.conv_result,
                fxOn
                    ? (converted != null ? money.format(converted) : "—")
                    : (result != null ? plain.format(result) : "0")
            );
            views.setOnClickPendingIntent(R.id.widget_root, openLink(context, openPath));
            return views;
        }

        String exprText = expr.isEmpty() ? "0" : expr;
        views.setTextViewText(R.id.conv_expr, exprText + eqSuffix(expr, result, from, fxOn, plain));
        views.setTextViewText(R.id.conv_result, bigLine);
        bindFxToggle(views, context, fxOn);

        if (row) {
            views.setViewVisibility(R.id.conv_swap, fxOn ? android.view.View.VISIBLE : android.view.View.GONE);
            if (fxOn) {
                views.setTextViewText(R.id.conv_swap, from + " ⇄ " + to);
                views.setOnClickPendingIntent(R.id.conv_swap, keyIntent(context, "swap"));
            }
            views.setOnClickPendingIntent(R.id.widget_root, openLink(context, openPath));
            return views;
        }

        if (full3) {
            views.setViewVisibility(R.id.conv_pair_chip, fxOn ? android.view.View.VISIBLE : android.view.View.GONE);
            if (fxOn) {
                boolean pickingFull3 = picking != null;
                views.setTextViewText(R.id.conv_pair_chip,
                    pickingFull3 ? ("▾ " + from + " ⇄ " + to) : (from + " ⇄ " + to));
                views.setOnClickPendingIntent(R.id.conv_pair_chip, keyIntent(context,
                    pickingFull3 ? "close_pick" : "open_pick_from"));
                bindPickerRow(views, context, conv, picking, from, to);
            } else {
                views.setViewVisibility(R.id.conv_pick_row, android.view.View.GONE);
            }
            bindKeypad(views, context);
            views.setOnClickPendingIntent(R.id.key_open, openLink(context, openPath));
            views.setOnClickPendingIntent(R.id.conv_result, openLink(context, openPath));
            return views;
        }

        // compact + full share the chips/stamp row.
        int chipVisibility = fxOn ? android.view.View.VISIBLE : android.view.View.GONE;
        views.setViewVisibility(R.id.conv_from_chip, chipVisibility);
        views.setViewVisibility(R.id.conv_swap, chipVisibility);
        views.setViewVisibility(R.id.conv_to_chip, chipVisibility);
        views.setViewVisibility(R.id.conv_refresh, chipVisibility);
        if (fxOn) {
            boolean pickingFrom = "from".equals(picking);
            boolean pickingTo = "to".equals(picking);
            views.setTextViewText(R.id.conv_from_chip, from + (pickingFrom ? " ▾" : ""));
            views.setTextViewText(R.id.conv_to_chip, to + (pickingTo ? " ▾" : ""));
            views.setOnClickPendingIntent(R.id.conv_from_chip, keyIntent(context, "from"));
            views.setOnClickPendingIntent(R.id.conv_to_chip, keyIntent(context, "to"));
            views.setOnClickPendingIntent(R.id.conv_swap, keyIntent(context, "swap"));
            views.setOnClickPendingIntent(R.id.conv_refresh, keyIntent(context, "refresh"));
            views.setTextViewText(R.id.conv_stamp, stampText(context, from, to, rate, rates));
            bindPickerRow(views, context, conv, picking, from, to);
        } else {
            views.setTextViewText(R.id.conv_stamp, context.getString(R.string.widget_converter_fx_off_hint));
            views.setViewVisibility(R.id.conv_pick_row, android.view.View.GONE);
        }

        if (!full) {
            views.setOnClickPendingIntent(R.id.widget_root, openLink(context, openPath));
            return views;
        }

        bindKeypad(views, context);
        views.setOnClickPendingIntent(R.id.key_open, openLink(context, openPath));
        views.setOnClickPendingIntent(R.id.conv_result, openLink(context, openPath));
        return views;
    }

    /**
     * The 💱 toggle: wires the tap and paints the BIG LINE by mode — teal
     * currency result when conversion is live, plain white number when the
     * widget is a pure calculator (emoji glyphs ignore textColor, so the
     * state signal lives on the result line, not the key).
     */
    private void bindFxToggle(RemoteViews views, Context context, boolean fxOn) {
        views.setTextColor(R.id.conv_result, fxOn ? COLOR_ACCENT : 0xFFF8FAFC);
        views.setOnClickPendingIntent(R.id.conv_fx, keyIntent(context, "fx"));
    }

    private void bindKeypad(RemoteViews views, Context context) {
        String[][] keys = {
            {"7", String.valueOf(R.id.key_7)}, {"8", String.valueOf(R.id.key_8)},
            {"9", String.valueOf(R.id.key_9)}, {"div", String.valueOf(R.id.key_div)},
            {"4", String.valueOf(R.id.key_4)}, {"5", String.valueOf(R.id.key_5)},
            {"6", String.valueOf(R.id.key_6)}, {"mul", String.valueOf(R.id.key_mul)},
            {"1", String.valueOf(R.id.key_1)}, {"2", String.valueOf(R.id.key_2)},
            {"3", String.valueOf(R.id.key_3)}, {"sub", String.valueOf(R.id.key_sub)},
            {"0", String.valueOf(R.id.key_0)}, {"dot", String.valueOf(R.id.key_dot)},
            {"back", String.valueOf(R.id.key_back)}, {"add", String.valueOf(R.id.key_add)},
            {"clear", String.valueOf(R.id.key_clear)}, {"eq", String.valueOf(R.id.key_eq)},
        };
        for (String[] key : keys) {
            views.setOnClickPendingIntent(Integer.parseInt(key[1]), keyIntent(context, key[0]));
        }
    }

    /**
     * Populates the currency picker row: shows 6 chips from the currencies
     * array, highlighting the currently active one. Hidden when no picking
     * target is active.
     */
    private void bindPickerRow(RemoteViews views, Context context, JSONObject conv,
                               String picking, String from, String to) {
        boolean active = "from".equals(picking) || "to".equals(picking);
        views.setViewVisibility(R.id.conv_pick_row,
            active ? android.view.View.VISIBLE : android.view.View.GONE);
        if (!active) return;

        String selected = "from".equals(picking) ? from : to;
        JSONArray list = conv != null ? conv.optJSONArray("currencies") : null;
        int count = list != null ? Math.min(list.length(), PICK_IDS.length) : 0;

        for (int i = 0; i < PICK_IDS.length; i++) {
            if (i < count) {
                String code = list.optString(i, "");
                boolean isSel = code.equals(selected);
                views.setViewVisibility(PICK_IDS[i], android.view.View.VISIBLE);
                views.setTextViewText(PICK_IDS[i], code);
                views.setTextColor(PICK_IDS[i], isSel ? 0xFF0B1220 : 0xFFF8FAFC);
                views.setInt(PICK_IDS[i], "setBackgroundResource",
                    isSel ? R.drawable.widget_chip_active : R.drawable.widget_chip);
                views.setOnClickPendingIntent(PICK_IDS[i], keyIntent(context, "pick_" + i));
            } else {
                views.setViewVisibility(PICK_IDS[i], android.view.View.GONE);
            }
        }
    }

    /** "12.5+3" → " = 15.5 EUR" hint beside the raw expression (FX mode only). */
    private static String eqSuffix(String expr, Double result, String from, boolean fxOn, DecimalFormat plain) {
        if (!fxOn || result == null || !hasOperator(expr)) return "";
        return " = " + plain.format(result) + " " + from;
    }

    private static String stampText(Context context, String from, String to, Double rate, RatesInfo rates) {
        StringBuilder stamp = new StringBuilder();
        if (rate != null) {
            stamp.append("1 ").append(from).append(" = ")
                .append(new DecimalFormat("#,##0.####").format(rate)).append(' ').append(to);
        }
        String freshness = rates == null ? null : rates.freshnessLabel(context);
        if (freshness != null) {
            if (stamp.length() > 0) stamp.append(" · ");
            stamp.append(freshness);
        }
        return stamp.toString();
    }

    private static String openConverterPath(Double result, String from, String to) {
        StringBuilder path = new StringBuilder("/converter?from=").append(from).append("&to=").append(to);
        if (result != null && result > 0) {
            path.append("&amount=").append(new DecimalFormat("0.##").format(result).replace(',', '.'));
        }
        return path.toString();
    }

    // ---------------------------------------------------------------- input

    private PendingIntent keyIntent(Context context, String token) {
        Intent intent = new Intent(context, ConverterWidgetProvider.class);
        intent.setAction(ACTION_KEY);
        intent.setData(Uri.parse("trippilot://converter/key/" + token));
        return PendingIntent.getBroadcast(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        boolean forceFetch = false;
        if (ACTION_KEY.equals(intent.getAction()) && intent.getData() != null) {
            String token = intent.getData().getLastPathSegment();
            if ("refresh".equals(token)) {
                forceFetch = true;
            } else {
                handleKey(context, token);
            }
            requestRefresh(context, ConverterWidgetProvider.class);
        } else {
            super.onReceive(context, intent);
        }

        // Keep the rate at least today's (2.7.1): fetch in the background when
        // the freshest known snapshot is stale — or immediately on ↻. goAsync
        // keeps the receiver alive for the network round-trip.
        if (shouldFetch(context, forceFetch)) {
            final PendingResult pending = goAsync();
            final Context app = context.getApplicationContext();
            new Thread(() -> {
                try {
                    fetchAndStoreRates(app);
                } finally {
                    pending.finish();
                }
            }).start();
        }
    }

    private static void handleKey(Context context, String token) {
        if (token == null) return;
        SharedPreferences prefs = WidgetStore.prefs(context);
        String expr = prefs.getString(WidgetStore.KEY_CONV_EXPR, "");
        JSONObject conv = WidgetStore.section(context, "converter");
        SharedPreferences.Editor editor = prefs.edit();

        switch (token) {
            case "clear":
                editor.putString(WidgetStore.KEY_CONV_EXPR, "");
                break;
            case "back":
                if (!expr.isEmpty()) {
                    editor.putString(WidgetStore.KEY_CONV_EXPR, expr.substring(0, expr.length() - 1));
                }
                break;
            case "eq": {
                Double result = evaluate(expr);
                if (result != null) {
                    editor.putString(WidgetStore.KEY_CONV_EXPR, plainNumber(result));
                }
                break;
            }
            case "fx": {
                boolean on = "on".equals(prefs.getString(WidgetStore.KEY_CONV_MODE, "off"));
                editor.putString(WidgetStore.KEY_CONV_MODE, on ? "off" : "on");
                break;
            }
            case "swap": {
                String from = currency(prefs.getString(WidgetStore.KEY_CONV_FROM, null), conv, "from", "EUR");
                String to = currency(prefs.getString(WidgetStore.KEY_CONV_TO, null), conv, "to", "BRL");
                editor.putString(WidgetStore.KEY_CONV_FROM, to);
                editor.putString(WidgetStore.KEY_CONV_TO, from);
                editor.putString(WidgetStore.KEY_CONV_PICKING, null);
                break;
            }
            case "from":
            case "to": {
                String currentPicking = prefs.getString(WidgetStore.KEY_CONV_PICKING, null);
                if (token.equals(currentPicking)) {
                    editor.putString(WidgetStore.KEY_CONV_PICKING, null);
                } else {
                    editor.putString(WidgetStore.KEY_CONV_PICKING, token);
                }
                break;
            }
            case "open_pick_from": {
                String cur = prefs.getString(WidgetStore.KEY_CONV_PICKING, null);
                editor.putString(WidgetStore.KEY_CONV_PICKING,
                    "from".equals(cur) ? "to" : cur == null ? "from" : null);
                break;
            }
            case "close_pick": {
                editor.putString(WidgetStore.KEY_CONV_PICKING, null);
                break;
            }
            case "pick_0": case "pick_1": case "pick_2":
            case "pick_3": case "pick_4": case "pick_5": {
                String pickTarget = prefs.getString(WidgetStore.KEY_CONV_PICKING, null);
                if (pickTarget != null) {
                    int idx = token.charAt(token.length() - 1) - '0';
                    JSONArray list = conv != null ? conv.optJSONArray("currencies") : null;
                    if (list != null && idx < list.length()) {
                        String code = list.optString(idx, null);
                        if (code != null) {
                            String prefKey = "from".equals(pickTarget)
                                ? WidgetStore.KEY_CONV_FROM : WidgetStore.KEY_CONV_TO;
                            editor.putString(prefKey, code);
                        }
                    }
                    editor.putString(WidgetStore.KEY_CONV_PICKING, null);
                }
                break;
            }
            default:
                editor.putString(WidgetStore.KEY_CONV_EXPR, appendToken(expr, token));
        }
        editor.apply();
    }

    /** Calculator append rules — bounded, one dot per number, ops replaceable. */
    static String appendToken(String expr, String token) {
        String ch = token.equals("dot") ? "."
            : token.equals("add") ? "+"
            : token.equals("sub") ? "-"
            : token.equals("mul") ? "×"
            : token.equals("div") ? "÷"
            : token;
        boolean isOp = ch.length() == 1 && isOperator(ch.charAt(0));
        boolean isDigit = ch.length() == 1 && Character.isDigit(ch.charAt(0));
        if (!isOp && !isDigit && !ch.equals(".")) return expr;
        if (expr.length() >= MAX_EXPR_LENGTH && !isOp) return expr;

        if (isOp) {
            if (expr.isEmpty()) return ch.equals("-") ? "-" : expr;
            char last = expr.charAt(expr.length() - 1);
            if (isOperator(last)) return expr.substring(0, expr.length() - 1) + ch;
            if (last == '.') return expr; // finish the number first
            return expr + ch;
        }
        if (ch.equals(".")) {
            if (expr.isEmpty() || isOperator(expr.charAt(expr.length() - 1))) return expr + "0.";
            if (currentNumberHasDot(expr)) return expr;
            return expr + ".";
        }
        if (expr.equals("0")) return ch; // no leading zeros
        return expr + ch;
    }

    private static boolean currentNumberHasDot(String expr) {
        for (int i = expr.length() - 1; i >= 0; i--) {
            char c = expr.charAt(i);
            if (isOperator(c)) return false;
            if (c == '.') return true;
        }
        return false;
    }

    private static boolean isOperator(char c) {
        for (char op : OPERATORS) if (op == c) return true;
        return false;
    }

    private static boolean hasOperator(String expr) {
        // A leading minus is a sign, not an operation.
        for (int i = 1; i < expr.length(); i++) if (isOperator(expr.charAt(i))) return true;
        return false;
    }

    // ------------------------------------------------------------ calculator

    /**
     * Evaluates the expression with ×÷ precedence over +− (two passes). A
     * trailing operator is ignored so the live result never flickers to an
     * error while typing. Returns null for empty/degenerate input, division
     * by zero or overflow — the UI shows "—" instead of lying.
     */
    static Double evaluate(String expr) {
        if (expr == null || expr.isEmpty()) return null;
        String s = expr;
        char last = s.charAt(s.length() - 1);
        if (isOperatorStatic(last)) s = s.substring(0, s.length() - 1);
        if (s.isEmpty() || s.equals("-")) return null;

        ArrayList<Double> numbers = new ArrayList<>();
        ArrayList<Character> ops = new ArrayList<>();
        int i = 0;
        while (i < s.length()) {
            int start = i;
            // A minus is a sign when it starts the expression or follows an op.
            if (s.charAt(i) == '-' && (i == 0 || isOperatorStatic(s.charAt(i - 1)))) i++;
            while (i < s.length() && (Character.isDigit(s.charAt(i)) || s.charAt(i) == '.')) i++;
            if (start == i) return null; // two operators in a row / bad token
            try {
                numbers.add(Double.parseDouble(s.substring(start, i)));
            } catch (NumberFormatException e) {
                return null;
            }
            if (i < s.length()) {
                if (!isOperatorStatic(s.charAt(i))) return null;
                ops.add(s.charAt(i));
                i++;
            }
        }
        if (numbers.size() != ops.size() + 1) return null;

        // Pass 1: × and ÷.
        for (int k = 0; k < ops.size(); ) {
            char op = ops.get(k);
            if (op == '×' || op == '÷') {
                double a = numbers.get(k);
                double b = numbers.get(k + 1);
                if (op == '÷' && b == 0) return null;
                numbers.set(k, op == '×' ? a * b : a / b);
                numbers.remove(k + 1);
                ops.remove(k);
            } else {
                k++;
            }
        }
        // Pass 2: + and −.
        double acc = numbers.get(0);
        for (int k = 0; k < ops.size(); k++) {
            acc = ops.get(k) == '+' ? acc + numbers.get(k + 1) : acc - numbers.get(k + 1);
        }
        if (Double.isNaN(acc) || Double.isInfinite(acc)) return null;
        return acc;
    }

    private static boolean isOperatorStatic(char c) {
        return c == '+' || c == '-' || c == '×' || c == '÷';
    }

    /** Plain machine format for folding "=" back into the expression. */
    static String plainNumber(double value) {
        if (value == Math.rint(value) && Math.abs(value) < 1e15) {
            return String.valueOf((long) value);
        }
        String plain = new java.math.BigDecimal(value)
            .setScale(8, java.math.RoundingMode.HALF_UP)
            .stripTrailingZeros()
            .toPlainString();
        return plain.length() > MAX_EXPR_LENGTH ? plain.substring(0, MAX_EXPR_LENGTH) : plain;
    }

    // ------------------------------------------------------------------ FX

    /** The freshest known snapshot: app-pushed vs natively-fetched. */
    static final class RatesInfo {
        final String base;
        final JSONObject ratesToBase;
        final long fetchedAtMs;
        final String pushedStamp; // pre-localized "câmbio de 04/07" (app push)
        final boolean fromNative;

        RatesInfo(String base, JSONObject ratesToBase, long fetchedAtMs, String pushedStamp, boolean fromNative) {
            this.base = base;
            this.ratesToBase = ratesToBase;
            this.fetchedAtMs = fetchedAtMs;
            this.pushedStamp = pushedStamp;
            this.fromNative = fromNative;
        }

        String freshnessLabel(Context context) {
            if (fetchedAtMs > 0 && DateUtils.isToday(fetchedAtMs)) {
                return context.getString(R.string.widget_converter_rate_today);
            }
            if (fromNative && fetchedAtMs > 0) {
                String day = new SimpleDateFormat("dd/MM", Locale.getDefault()).format(fetchedAtMs);
                return context.getString(R.string.widget_converter_rate_of_native, day);
            }
            return pushedStamp; // app-localized text, or null when never stamped
        }
    }

    /** Picks whichever snapshot (pushed payload vs native fetch) is fresher. */
    static RatesInfo resolveRates(Context context, JSONObject conv) {
        RatesInfo pushed = null;
        if (conv != null) {
            JSONObject rates = conv.optJSONObject("ratesToBase");
            String base = WidgetStore.str(conv, "base");
            if (rates != null && base != null) {
                pushed = new RatesInfo(
                    base, rates, parseIsoMs(WidgetStore.str(conv, "fetchedAtIso")),
                    WidgetStore.str(conv, "rateStamp"), false
                );
            }
        }

        RatesInfo fetched = null;
        String raw = WidgetStore.prefs(context).getString(WidgetStore.KEY_CONV_RATES, null);
        if (raw != null) {
            try {
                JSONObject stored = new JSONObject(raw);
                JSONObject rates = stored.optJSONObject("ratesToBase");
                String base = WidgetStore.str(stored, "base");
                if (rates != null && base != null) {
                    fetched = new RatesInfo(base, rates, stored.optLong("fetchedAtMs", 0), null, true);
                }
            } catch (Exception ignored) {
                // Corrupt cache — fall back to the pushed snapshot.
            }
        }

        if (pushed == null) return fetched;
        if (fetched == null) return pushed;
        return fetched.fetchedAtMs >= pushed.fetchedAtMs ? fetched : pushed;
    }

    /** Best-effort ISO-8601 → epoch ms (UTC); 0 when absent/unparsable. */
    private static long parseIsoMs(String iso) {
        if (iso == null || iso.length() < 19) return 0;
        try {
            SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US);
            format.setTimeZone(TimeZone.getTimeZone("UTC"));
            return format.parse(iso.substring(0, 19)).getTime();
        } catch (Exception e) {
            return 0;
        }
    }

    static boolean shouldFetch(Context context, boolean force) {
        SharedPreferences prefs = WidgetStore.prefs(context);
        long lastAttempt = prefs.getLong(WidgetStore.KEY_CONV_FETCH_AT, 0);
        long now = System.currentTimeMillis();
        if (now - lastAttempt < (force ? MANUAL_FETCH_GAP_MS : AUTO_FETCH_GAP_MS)) return false;
        if (force) return true;
        RatesInfo rates = resolveRates(context, WidgetStore.section(context, "converter"));
        return rates == null || rates.fetchedAtMs <= 0 || !DateUtils.isToday(rates.fetchedAtMs);
    }

    /**
     * Pulls today's reference rates (same free API and inversion as
     * utils/exchange-rates.ts) and stores them for the widget only. Any
     * failure is silent — the last snapshot keeps rendering.
     */
    static void fetchAndStoreRates(Context context) {
        SharedPreferences prefs = WidgetStore.prefs(context);
        prefs.edit().putLong(WidgetStore.KEY_CONV_FETCH_AT, System.currentTimeMillis()).apply();

        JSONObject conv = WidgetStore.section(context, "converter");
        String base = conv != null ? WidgetStore.str(conv, "base") : null;
        if (base == null) {
            base = currency(prefs.getString(WidgetStore.KEY_CONV_FROM, null), conv, "from", "EUR");
        }

        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(RATES_URL + base).openConnection();
            connection.setConnectTimeout(8000);
            connection.setReadTimeout(8000);
            connection.setRequestProperty("Accept", "application/json");
            if (connection.getResponseCode() != 200) return;

            StringBuilder body = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) body.append(line);
            }
            JSONObject data = new JSONObject(body.toString());
            if (!"success".equals(data.optString("result"))) return;
            JSONObject perBase = data.optJSONObject("rates");
            if (perBase == null) return;

            // Invert to base-units-per-1-foreign — the payload convention.
            JSONObject ratesToBase = new JSONObject();
            Iterator<String> codes = perBase.keys();
            while (codes.hasNext()) {
                String code = codes.next();
                double value = perBase.optDouble(code, -1);
                if (!code.equals(base) && value > 0) {
                    ratesToBase.put(code, 1 / value);
                }
            }
            if (ratesToBase.length() == 0) return;

            JSONObject stored = new JSONObject();
            stored.put("base", base);
            stored.put("fetchedAtMs", System.currentTimeMillis());
            stored.put("ratesToBase", ratesToBase);
            prefs.edit().putString(WidgetStore.KEY_CONV_RATES, stored.toString()).apply();
            requestRefresh(context, ConverterWidgetProvider.class);
        } catch (Exception ignored) {
            // Offline/timeout/bad payload — keep the previous snapshot.
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    /** Same convention as domain/money/converter.ts: ratesToBase[X] = base per 1 X. */
    static Double pairRate(String from, String to, RatesInfo rates) {
        if (from.equals(to)) return 1.0;
        if (rates == null) return null;
        Double basePerFrom = from.equals(rates.base) ? Double.valueOf(1.0) : positive(rates.ratesToBase, from);
        Double basePerTo = to.equals(rates.base) ? Double.valueOf(1.0) : positive(rates.ratesToBase, to);
        if (basePerFrom == null || basePerTo == null) return null;
        return basePerFrom / basePerTo;
    }

    private static Double positive(JSONObject rates, String code) {
        if (rates == null) return null;
        double value = rates.optDouble(code, -1);
        return value > 0 ? value : null;
    }

    private static String currency(String stored, JSONObject conv, String field, String fallback) {
        if (stored != null && !stored.isEmpty()) return stored;
        String pushed = WidgetStore.str(conv, field);
        return pushed != null ? pushed : fallback;
    }

    private static String nextCurrency(JSONObject conv, String current) {
        JSONArray list = conv != null ? conv.optJSONArray("currencies") : null;
        if (list == null || list.length() == 0) return current;
        int index = -1;
        for (int i = 0; i < list.length(); i++) {
            if (current.equals(list.optString(i))) {
                index = i;
                break;
            }
        }
        return list.optString((index + 1) % list.length(), current);
    }
}
