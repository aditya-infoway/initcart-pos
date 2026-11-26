
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.initcart.pos',
  appName: 'InitCart POS',
  webDir: 'dist',

  server: {
    url: 'https://initcart.com/pos/',
    cleartext: false
  },

  plugins: {
    App: {
      launchUrl: 'https://initcart.com/pos/'
    }
  }
};

export default config;
