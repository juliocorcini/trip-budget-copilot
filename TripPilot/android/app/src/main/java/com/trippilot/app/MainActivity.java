package com.trippilot.app;

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
        super.onCreate(savedInstanceState);
        // FIELD R2 item 13: remove the Android 12+ stretch overscroll glow on the
        // WebView — CSS overscroll-behavior cannot suppress the native edge effect.
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        }
    }
}
