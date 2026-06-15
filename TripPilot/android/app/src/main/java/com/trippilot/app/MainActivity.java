package com.trippilot.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // B1 (Gate 4): custom Live Update plugin for the active outing.
        registerPlugin(LiveOutingPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
