package com.trippilot.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * N5/N6 (Gate 3): handles a quick-add VALUE button tap on the active-outing
 * notification. It runs in the background (no Activity launch) — even if the app
 * process was killed, Android starts it just to deliver this broadcast. The tap
 * is queued in SharedPreferences and the notification is re-rendered with the
 * new running total. The JS layer drains the queue and persists the real
 * expenses the next time it resumes.
 */
public class OutingActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !OutingNotificationPlugin.ACTION_QUICK_ADD.equals(intent.getAction())) {
            return;
        }
        long amount = intent.getLongExtra(OutingNotificationPlugin.EXTRA_AMOUNT, 0);
        if (amount <= 0) return;

        Context ctx = context.getApplicationContext();
        OutingNotificationPlugin.enqueue(ctx, amount);
        OutingNotificationPlugin.postNotification(ctx);
        // FIELD item 10: if the app is open, push the tap to JS now so the active
        // outing screen updates immediately (otherwise it only refreshed on the
        // next resume). No-op when the WebView is not alive.
        OutingNotificationPlugin.notifyQuickAdd(amount);
    }
}
