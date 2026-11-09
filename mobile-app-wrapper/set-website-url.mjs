#!/usr/bin/env node
// Usage: node mobile-app-wrapper/set-website-url.mjs https://your-domain.com
// Configures the Android & iOS native wrapper app to open your live website directly inside the mobile app (with zero browser bar).

import fs from 'fs';
import path from 'path';

const targetUrl = process.argv[2];
const configPath = path.resolve('capacitor.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

if (!targetUrl || targetUrl === '--offline') {
  delete config.server.url;
  console.log('✅ Configured Android & iOS app to load bundled offline web files (www/).');
} else {
  config.server = {
    ...config.server,
    url: targetUrl,
    cleartext: targetUrl.startsWith('http://')
  };
  console.log(`✅ Configured Android & iOS app to open live website inside the native app: ${targetUrl}`);
}

fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
