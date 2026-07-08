package com.trippilot.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Collections;

/**
 * B1/B2 (Gate 4): Android 16 "Live Update" for the active outing — a promoted
 * ongoing ProgressStyle notification that surfaces in the status-bar chip, lock
 * screen and (on One UI 8) the Samsung Now Bar, reflecting the live outing total.
 *
 * Scope of this cut: post / update / cancel a promoted-ongoing notification via
 * NotificationManagerCompat (no foreground service, no broadcast actions yet —
 * those are device-validated refinements per the Track B spec). The plugin only
 * reports itself supported on API >= 36 so older devices keep the proven
 * LocalNotifications path with zero regression.
 */
@CapacitorPlugin(name = "LiveOuting")
public class LiveOutingPlugin extends Plugin {

    private static final int NOTIFICATION_ID = 2001;
    private static final String CHANNEL_ID = "outing_live";
    private static final String DEFAULT_ACCENT = "#C75B39";

    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("supported", Build.VERSION.SDK_INT >= 36);
        call.resolve(ret);
    }

    @PluginMethod
    public void update(PluginCall call) {
        Context ctx = getContext();
        String title = call.getString("title", "");
        String body = call.getString("body", "");
        String statusText = call.getString("statusText", "");
        int progress = call.getInt("progress", 0);
        int max = call.getInt("max", 0);
        int color = parseColor(call.getString("accentColor", DEFAULT_ACCENT));

        ensureChannel(ctx);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(body)
                .setColor(color)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setRequestPromotedOngoing(true)
                .setShortCriticalText(statusText)
                .setContentIntent(buildOpenIntent(ctx));

        // A determinate bar only makes sense when the outing has a target; without
        // one we post a standard (still promotable) ongoing notification.
        if (max > 0) {
            NotificationCompat.ProgressStyle style = new NotificationCompat.ProgressStyle()
                    .setProgressSegments(Collections.singletonList(
                            new NotificationCompat.ProgressStyle.Segment(max).setColor(color)))
                    .setProgress(Math.max(0, Math.min(progress, max)));
            builder.setStyle(style);
        }

        try {
            NotificationManagerCompat.from(ctx).notify(NOTIFICATION_ID, builder.build());
        } catch (SecurityException e) {
            // POST_NOTIFICATIONS not granted — the JS layer already gates on this.
        }
        call.resolve();
    }

    @PluginMethod
    public void end(PluginCall call) {
        NotificationManagerCompat.from(getContext()).cancel(NOTIFICATION_ID);
        call.resolve();
    }

    private void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm =
                    (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
                // IMPORTANCE_DEFAULT (not MIN) is required for the notification to be
                // eligible for promotion to a Live Update.
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID, "Active outing", NotificationManager.IMPORTANCE_DEFAULT);
                channel.setDescription("Live total of the outing in progress");
                nm.createNotificationChannel(channel);
            }
        }
    }

    private PendingIntent buildOpenIntent(Context ctx) {
        Intent intent = new Intent(ctx, MainActivity.class);
        intent.setAction(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_LAUNCHER);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(ctx, 0, intent, flags);
    }

    private int parseColor(String hex) {
        try {
            return Color.parseColor(hex == null ? DEFAULT_ACCENT : hex.trim());
        } catch (IllegalArgumentException e) {
            return Color.parseColor(DEFAULT_ACCENT);
        }
    }
}
