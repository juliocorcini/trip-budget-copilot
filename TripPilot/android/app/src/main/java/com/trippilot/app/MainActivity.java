package com.trippilot.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // B1 (Gate 4): custom Live Update plugin for the active outing (Android 16+).
        registerPlugin(LiveOutingPlugin.class);
        // N5/N6 (Gate 3): rich fallback notification + quick-add buttons (SDK < 36).
        registerPlugin(OutingNotificationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
