package com.trippilot.app;

import android.app.PendingIntent;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.service.quicksettings.TileService;

/**
 * DEC-459 — Quick Settings tile "Registrar gasto". One swipe down + one tap
 * lands on /quick-add, so logging works even mid-purchase with the phone half
 * out of the pocket. Uses the same App Links deep-link path as the widget "+".
 */
public class QuickAddTileService extends TileService {

    private static final String APEX = "https://trippilot.pages.dev";

    @Override
    public void onClick() {
        super.onClick();
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(APEX + "/quick-add"));
        intent.setPackage(getPackageName());
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        // Android 14+ requires the PendingIntent form; the plain Intent form is
        // deprecated and silently ignored on newer releases.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            PendingIntent pending = PendingIntent.getActivity(
                this, 2, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            startActivityAndCollapse(pending);
        } else {
            startActivityAndCollapse(intent);
        }
    }
}
