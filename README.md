# SwaKosh (स्वकोश) — Smart Lists, Rich Notes, Card OCR & Post-Quantum KeePass (`.kdbx`) Vault

A complete, production-ready, **Zero-Knowledge / Bring Your Own Storage (BYOS)** personal & family utility application (Mobile WebApp + Android `.apk` & iOS `.ipa` Native Wrapper) featuring:

1. **🛡️ Post-Quantum + KeePass (`.kdbx`) Compatible Secret Vault:**
   - **NIST FIPS-203 `ML-KEM-768` (CRYSTALS-Kyber)** lattice-based key encapsulation combined with **`AES-256-GCM`** and **`PBKDF2-SHA-512` (210,000 iterations)** ([src/services/pqKdbxVault.js](./src/services/pqKdbxVault.js)).
   - **Open & Export `.kdbx` Files:** Mounts KeePass `.kdbx` (v3.1 / v4.x binary headers `0x9AA2D903 0xB54BFB67`) and `.kdbx.xml` files with Master Password + optional Key File, and exports standard `.kdbx` databases.
   - **Built-in Live 6-Digit 2FA / TOTP Authenticator (`otpauth://`)** with 30-second countdown timer and **Quantum-Entropy Password Generator**.
2. **👨‍👩‍👧‍👦 Family & Friends Circle + Zero-Knowledge Cloud Sharing:**
   - Add contacts to `Family` or `Friend` circles and share any **Active List**, **Rich Note**, or **Vault Entry** directly between your **Google Drive** (`drive.permissions.create`) or **iCloud Drive** and their cloud account ([src/services/cloudSync.js](./src/services/cloudSync.js)).
3. **📋 Master List → Active Sub-List System:**
   - Reusable Master Blueprints (Indian Monthly Grocery, Travel Packing, Festival Preparation, Home Maintenance) + interactive Wizard to tick items and customize quantities inline.
4. **🏷️ 7-Platform Online Deal Finder:**
   - Compares active grocery lists across **JioMart**, **BigBasket**, **Amazon Fresh**, **Flipkart Grocery**, **Blinkit**, **Zepto**, and **Swiggy Instamart**.
5. **🪪 Visiting Card OCR Scanner & `.vcf` Contact Export:**
   - Camera capture, photo upload, on-device OCR field extraction, and 1-tap Call, WhatsApp, Map & `.vcf` export.
6. **📱 Native Mobile App UI + Android/iOS Wrapper + Desktop Mode:**
   - Configured with Capacitor ([capacitor.config.json](./capacitor.config.json)), GitHub Actions Android APK builder ([.github/workflows/build-mobile-apps.yml](./.github/workflows/build-mobile-apps.yml)), GitLab CI ([.gitlab-ci.yml](./.gitlab-ci.yml)), and Cloudflare Pages headers ([_headers](./_headers)).