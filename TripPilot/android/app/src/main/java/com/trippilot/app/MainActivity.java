package com.trippilot.app;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // B1 (Gate 4): custom Live Update plugin for the active outing (Android 16+).
        registerPlugin(LiveOutingPlugin.class);
        // N5/N6 (Gate 3): rich fallback notification + quick-add buttons (SDK < 36).
        registerPlugin(OutingNotificationPlugin.class);
        // FIELD R2 item 1: save backups straight to the public Downloads folder.
        registerPlugin(DeviceFilePlugin.class);
        // DEC-210: in-app APK self-update (download + system installer hand-off).
        registerPlugin(ApkInstallerPlugin.class);
        // B1 (Onda 4 / DEC-215): receive a shared/opened .csv (Wise → TripPilot).
        registerPlugin(ShareTargetPlugin.class);
        super.onCreate(savedInstanceState);
        // FIELD R2 item 13: remove the Android 12+ stretch overscroll glow on the
        // WebView — CSS overscroll-behavior cannot suppress the native edge effect.
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
            // DEC-431: the Android System WebView paints its OWN native scrollbar for
            // the whole view — a chrome that `::-webkit-scrollbar { display:none }`
            // can never reach (that CSS only hides scrollbars of scrollable *DOM*
            // nodes, not the track the WebView itself draws). Because the web layer
            // is OTA-refreshed, an up-to-date device already runs the hardened CSS,
            // so a scrollbar that still shows on the APK is this native one. Disable
            // it at the source; only a fresh build carries this fix.
            webView.setVerticalScrollBarEnabled(false);
            webView.setHorizontalScrollBarEnabled(false);
        }
        // B1 (Onda 4): the app may be cold-started by a CSV share/open.
        ShareTargetPlugin.handleIntent(this, getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        // launchMode=singleTask: a warm CSV share/open (B1) or App Link (B2)
        // arrives here. super.onNewIntent lets Capacitor's bridge fire the
        // appUrlOpen event the deep-link listener consumes.
        super.onNewIntent(intent);
        setIntent(intent);
        ShareTargetPlugin.handleIntent(this, intent);
    }
}
