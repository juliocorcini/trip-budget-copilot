package com.trippilot.app;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * DEC-459 — bridge that lets the web layer push the "Livre hoje" strings into
 * the home-screen widget. The web side formats everything (amount + locale
 * labels); native only stores and re-renders, so widget copy always follows
 * the in-app language and the widget number always equals the Home hero.
 *
 * DEC-468 — `push` receives the whole widget-suite payload (one JSON for all
 * seven widgets; contract in src/domain/widgets/widget-payload.ts) and
 * re-renders every provider. `update` stays for pre-0.72.0 web bundles.
 */
@CapacitorPlugin(name = "HomeWidget")
public class HomeWidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        String value = call.getString("value");
        String label = call.getString("label");
        String addHint = call.getString("addHint");
        if (value == null || value.isEmpty()) {
            call.reject("value is required");
            return;
        }

        Context context = getContext();
        SharedPreferences.Editor editor = context
            .getSharedPreferences(HomeWidgetProvider.PREFS, Context.MODE_PRIVATE)
            .edit();
        editor.putString(HomeWidgetProvider.KEY_VALUE, value);
        if (label != null && !label.isEmpty()) {
            editor.putString(HomeWidgetProvider.KEY_LABEL, label);
        }
        if (addHint != null && !addHint.isEmpty()) {
            editor.putString(HomeWidgetProvider.KEY_HINT, addHint);
        }
        editor.apply();

        HomeWidgetProvider.refreshAll(context);
        call.resolve();
    }

    @PluginMethod
    public void push(PluginCall call) {
        String data = call.getString("data");
        if (data == null || data.isEmpty()) {
            call.reject("data is required");
            return;
        }
        Context context = getContext();
        WidgetStore.savePayload(context, data);
        ResizableWidgetProvider.refreshAllWidgets(context);
        call.resolve();
    }
}
