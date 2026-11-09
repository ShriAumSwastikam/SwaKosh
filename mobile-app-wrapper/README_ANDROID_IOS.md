# 📱 How to Install MasterVault as a Native Mobile App (Android & iOS)

MasterVault is built with a **100% Native Mobile App UI** (`430px` phone shell, native bottom navigation bar, safe-area support, touch physics, and zero browser clutter) and supports **two ways** to install on Android & iOS so users never feel they are inside a browser:

---

## Method 1: Native Android (`.apk`) & iOS (`.ipa`) Wrapper App (Opens Website Inside the App)

We have configured **Capacitor (Android + iOS)** in [capacitor.config.json](../capacitor.config.json) and an automated **GitHub Actions APK Builder** in [.github/workflows/build-mobile-apps.yml](../.github/workflows/build-mobile-apps.yml).

### How It Works:
- When the user installs this app on Android or iOS, it opens in a **100% full-screen native WebView container**—there is **no Chrome/Safari browser bar, no tabs, and no URL bar**.
- If you host the website (e.g., on GitHub Pages, Vercel, Netlify, or your own domain) and want the installed mobile app to always load your live website automatically:
  ```bash
  node mobile-app-wrapper/set-website-url.mjs https://your-website-url.com
  ```
- Whenever you push to GitHub (`main` branch), **GitHub Actions** automatically compiles the ready-to-install **Android `.apk`** file (`MasterVault-Android-APK` under the repository's **Actions** tab)!

### Building Locally (Optional):
```bash
npm install
npm run mobile:init
# For Android (.apk):
npx cap open android
# For iOS (Xcode .ipa on macOS):
npx cap open ios
```

---

## Method 2: Instant 1-Tap Direct Phone Install (No Play Store / App Store Needed)

Because [index.html](../index.html) and [manifest.json](../manifest.json) include native `display: "standalone"` and `apple-mobile-web-app-capable="yes"` configurations:
- **On Android:** Tap **"📲 Install App"** inside the app header (or **"Install App"** in Chrome menu). Android compiles a native **WebAPK** and places the **MasterVault** icon in your app drawer. It opens as a standalone native app (not inside Chrome).
- **On iPhone / iOS:** Open the link once in Safari → Tap **Share** (`⬆️`) → Tap **"Add to Home Screen"**. iOS places the **MasterVault** icon on your Home Screen and opens it full-screen without Safari's address bar or bottom toolbar.
