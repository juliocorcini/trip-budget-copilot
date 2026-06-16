import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trippilot.app',
  appName: 'TripPilot',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_flight',
      iconColor: '#C75B39',
    },
    // FIELD item 20 (G8b): self-hosted live-updates managed by us. autoUpdate
    // off → the plugin never contacts Capgo Cloud; we fetch our own manifest on
    // Pages and call download()/set() manually. resetWhenUpdate keeps the rule
    // that installing a fresh APK drops any stale OTA bundle.
    CapacitorUpdater: {
      autoUpdate: false,
      resetWhenUpdate: true,
    },
  },
};

export default config;
