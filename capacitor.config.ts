/// <reference types="@capacitor/local-notifications" />
import type { CapacitorConfig } from '@capacitor/cli';
import { MM_NOTIF_ICON_COLOR } from './src/app/notification-theme';

const config: CapacitorConfig = {
  appId: 'app.medminder.med',
  appName: 'MedMinder',
  webDir: 'www',
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      forceCodeForRefreshToken: false,
    },
    /** Status bar + tray: small icon + olive tint (matches `--ion-color-primary`). */
    LocalNotifications: {
      smallIcon: 'ic_stat_medminder',
      iconColor: MM_NOTIF_ICON_COLOR,
    },
  },
};

export default config;
