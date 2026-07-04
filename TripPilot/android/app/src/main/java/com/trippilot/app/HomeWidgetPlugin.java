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
}
