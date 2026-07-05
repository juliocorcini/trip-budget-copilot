package com.trippilot.app;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.DecimalFormat;
import java.util.ArrayList;

/**
 * DEC-468 — converter + calculator widget (council: "calculadora com conversão
 * AO VIVO", no separate convert step). The traveler types an expression on the
 * keypad; the big line always shows the CURRENT result converted FROM→TO with
 * the frozen FX snapshot the app pushed (ÂNCORA 10 honesty: the rate stamp is
 * always visible and rates are never fetched natively).
 *
 * Interaction: every key is a self-targeted broadcast with a unique data URI
 * (extras are ignored in PendingIntent equality — the URI is what keeps keys
 * distinct). State (expression + chosen pair) lives in SharedPreferences.
 *
 * Size buckets: mini (1x1: pair + result) → row (Nx1: expression + result +
 * swap) → compact (2x2/3x2: chips + result, no keypad) → full (>=3x3-ish:
 * everything; 3x4 is the DEFAULT and best format).
 */
public class ConverterWidgetProvider extends ResizableWidgetProvider {

    private static final String ACTION_KEY = "com.trippilot.app.CONVERTER_KEY";
    private static final int MAX_EXPR_LENGTH = 24;
    private static final char[] OPERATORS = {'+', '-', '×', '÷'};

    // ---------------------------------------------------------------- render

    @Override
    protected RemoteViews buildSized(Context context, Bundle options) {
        int width = minWidthDp(options);
        int height = minHeightDp(options);
        boolean unknown = width == 0 && height == 0; // first drop, options not delivered yet
        boolean mini = width > 0 && width < 110;
        boolean row = !mini && height > 0 && height < 110;
        // Keypad needs ~4 cell-rows to keep keys >=30dp tall (council: no
        // sub-touch-target keys); the DEFAULT 3x4 qualifies. Unknown options
        // render the default (full) — the launcher sends real options right
        // after placement and the bucket self-corrects.
        boolean full = unknown || (!mini && !row && height >= 230 && width >= 160);
        // Whatever is left (2x2 / 3x2 / narrow-tall) renders the compact card.

        SharedPreferences prefs = WidgetStore.prefs(context);
        JSONObject conv = WidgetStore.section(context, "converter");
        String from = currency(prefs.getString(WidgetStore.KEY_CONV_FROM, null), conv, "from", "EUR");
        String to = currency(prefs.getString(WidgetStore.KEY_CONV_TO, null), conv, "to", "BRL");
        String expr = prefs.getString(WidgetStore.KEY_CONV_EXPR, "");

        Double result = evaluate(expr);
        Double rate = pairRate(from, to, conv);
        Double converted = result != null && rate != null ? result * rate : null;

        int layout = mini
            ? R.layout.widget_converter_mini
            : row
                ? R.layout.widget_converter_row
                : full ? R.layout.widget_converter_full : R.layout.widget_converter_compact;
        RemoteViews views = new RemoteViews(context.getPackageName(), layout);

        DecimalFormat money = new DecimalFormat("#,##0.00");
        String convertedText = converted != null
            ? to + " " + money.format(converted)
            : rate == null && result != null
                ? context.getString(R.string.widget_converter_no_rate)
                : to + " 0";

        String openPath = openConverterPath(result, from, to);

        if (mini) {
            views.setTextViewText(R.id.conv_pair, from + "→" + to);
            views.setTextViewText(R.id.conv_result, converted != null ? money.format(converted) : "—");
            views.setOnClickPendingIntent(R.id.widget_root, openLink(context, openPath));
            return views;
        }

        String exprText = expr.isEmpty() ? "0" : expr;
        views.setTextViewText(R.id.conv_expr, exprText + eqSuffix(expr, result, from));
        views.setTextViewText(R.id.conv_result, convertedText);

        if (row) {
            views.setTextViewText(R.id.conv_swap, from + " ⇄ " + to);
            views.setOnClickPendingIntent(R.id.conv_swap, keyIntent(context, "swap"));
            views.setOnClickPendingIntent(R.id.widget_root, openLink(context, openPath));
            return views;
        }

        views.setTextViewText(R.id.conv_from_chip, from);
        views.setTextViewText(R.id.conv_to_chip, to);
        views.setTextViewText(R.id.conv_stamp, stampText(from, to, rate, conv));
        views.setOnClickPendingIntent(R.id.conv_from_chip, keyIntent(context, "from"));
        views.setOnClickPendingIntent(R.id.conv_to_chip, keyIntent(context, "to"));
        views.setOnClickPendingIntent(R.id.conv_swap, keyIntent(context, "swap"));

        if (!full) {
            views.setOnClickPendingIntent(R.id.widget_root, openLink(context, openPath));
            return views;
        }

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
        views.setOnClickPendingIntent(R.id.key_open, openLink(context, openPath));
        views.setOnClickPendingIntent(R.id.conv_result, openLink(context, openPath));
        return views;
    }

    /** "12.5+3 " → " = 15.5 EUR" hint next to the raw expression. */
    private static String eqSuffix(String expr, Double result, String from) {
        if (result == null || !hasOperator(expr)) return "";
        return " = " + new DecimalFormat("#,##0.####").format(result) + " " + from;
    }

    private static String stampText(String from, String to, Double rate, JSONObject conv) {
        StringBuilder stamp = new StringBuilder();
        if (rate != null) {
            stamp.append("1 ").append(from).append(" = ")
                .append(new DecimalFormat("#,##0.####").format(rate)).append(' ').append(to);
        }
        String pushed = WidgetStore.str(conv, "rateStamp");
        if (pushed != null) {
            if (stamp.length() > 0) stamp.append(" · ");
            stamp.append(pushed);
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
        if (ACTION_KEY.equals(intent.getAction()) && intent.getData() != null) {
            handleKey(context, intent.getData().getLastPathSegment());
            requestRefresh(context, ConverterWidgetProvider.class);
            return;
        }
        super.onReceive(context, intent);
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
            case "swap": {
                String from = currency(prefs.getString(WidgetStore.KEY_CONV_FROM, null), conv, "from", "EUR");
                String to = currency(prefs.getString(WidgetStore.KEY_CONV_TO, null), conv, "to", "BRL");
                editor.putString(WidgetStore.KEY_CONV_FROM, to);
                editor.putString(WidgetStore.KEY_CONV_TO, from);
                break;
            }
            case "from":
            case "to": {
                String prefKey = token.equals("from") ? WidgetStore.KEY_CONV_FROM : WidgetStore.KEY_CONV_TO;
                String current = currency(prefs.getString(prefKey, null), conv, token, token.equals("from") ? "EUR" : "BRL");
                editor.putString(prefKey, nextCurrency(conv, current));
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

    /** Same convention as domain/money/converter.ts: ratesToBase[X] = base per 1 X. */
    static Double pairRate(String from, String to, JSONObject conv) {
        if (from.equals(to)) return 1.0;
        if (conv == null) return null;
        String base = conv.optString("base", "");
        JSONObject rates = conv.optJSONObject("ratesToBase");
        Double basePerFrom = from.equals(base) ? Double.valueOf(1.0) : positive(rates, from);
        Double basePerTo = to.equals(base) ? Double.valueOf(1.0) : positive(rates, to);
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
