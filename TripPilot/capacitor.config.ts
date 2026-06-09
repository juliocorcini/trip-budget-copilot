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
  },
};

export default config;
