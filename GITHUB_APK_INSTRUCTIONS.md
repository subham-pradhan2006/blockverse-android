# Build Blockverse 3D Android APK online — no Android Studio

GitHub Actions builds the game on a GitHub-hosted Linux computer. Your Windows PC needs **no Android Studio, Android SDK, Java, Gradle or Node.js** for this option. You need a GitHub account and internet access.

## One-time upload

1. Visit https://github.com/new and create a repository (e.g. `blockverse-android`). You can choose **Private**. Do not initialize it with a README to keep the first upload simple.
2. On the newly created repo page, click **uploading an existing file** (or **Add file → Upload files**).
3. Open the extracted `Blockverse_Android_GitHub_APK_Builder` folder. **Drag the files and folders inside it** to the GitHub upload area. The project root of the repository must contain `package.json`, `src/`, `scripts/` and `.github/workflows/build-android-apk.yml` — not a single parent folder. Include `.github`; it is required for the workflow.
4. Click **Commit changes**. If the web uploader does not preserve the `.github/workflows` directory, use **Add file → Create new file**, name it `.github/workflows/build-android-apk.yml`, paste the workflow from the ZIP and commit.

## Build and download the APK

1. Open your repository's **Actions** tab. If prompted to enable workflows, allow them.
2. Select **Build Blockverse Android APK** in the left panel.
3. Click **Run workflow → Run workflow**.
4. When the run has a green success check, open the run and locate **Artifacts**.
5. Download **Blockverse-3D-Android-APK**. GitHub downloads an artifact ZIP; unzip it to get `Blockverse_3D_Android_Install.apk`.
6. Transfer that APK to your Android phone, then open it to install. Android may require you to permit installation from that file manager/source. Only install APKs you built yourself from trusted code.

## Important

- The file you install is the **APK inside GitHub's artifact ZIP**, not this project ZIP.
- The GitHub build uses a debug-signed APK for personal testing. Publishing to Play Store requires a separately signed release build (usually AAB).
- This is a Capacitor/WebView game packaged as an Android app. It opens as an app, with no browser tab; it is not a native-engine rewrite.
- Game snapshots are stored in app-local IndexedDB. Do not clear the app's data or uninstall if you want to retain saves. Existing saves from a different application/package are not automatically imported.
- Hardware performance and persistence behavior have not yet been tested on an actual Android handset.
- GitHub may limit Actions minutes and artifact retention based on your account/repository type. This workflow retains the APK artifact for 14 days.

## Expected repository structure

```text
package.json
src/App.tsx
src/mobile-storage.js
original/blockverse_3d_sandbox (1).tsx
capacitor.config.json
scripts/configure-android.py
.github/workflows/build-android-apk.yml
```

## If the build fails

Open the failed GitHub Actions run, expand the red step and copy its final error lines. The earlier error about `SDK location not found` should not occur because GitHub configures the Android SDK on its server.
