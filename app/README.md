# Art Loop Walk: iOS app

The iPhone app is the Art Loop Walk website (`../index.html`) packaged with [Capacitor](https://capacitorjs.com).
Every time the app opens, it loads the latest gallery list from this GitHub repo, so gallery and exhibition updates reach the app without a new App Store release.
A copy of the list is bundled for offline use.

Only changes to the app's look, layout or features need a new build and App Store submission.

## One-time setup on your Mac

1. Install **Xcode** from the Mac App Store. It's large, so start it first.
2. Install **Node.js** (the LTS version) from https://nodejs.org.
3. Get this repo onto your Mac. Either:
   - [GitHub Desktop](https://desktop.github.com): File → Clone Repository → `artloopwalk/artloopwalk`, or
   - Terminal: `git clone https://github.com/artloopwalk/artloopwalk.git`
4. In Terminal:
   ```
   cd artloopwalk/app
   npm install
   npm run sync
   npm run open
   ```
   `npm run open` opens the project in Xcode.

## Try it in the iPhone simulator

In Xcode, choose an iPhone at the top (e.g. iPhone 16 Pro Max) and press ▶︎ Run.

**App Store screenshots:** run the iPhone 16 Pro Max simulator and press ⌘S to save a screenshot to your Desktop.
Apple needs 3 to 10 of these, at 1320 × 2868.

## Upload to the App Store

You need an active Apple Developer Program membership.

1. In Xcode, click **App** in the left sidebar → **Signing & Capabilities** → choose your **Team** and keep "Automatically manage signing" on.
2. At the top, set the run destination to **Any iOS Device (arm64)**.
3. **Product → Archive.** When the Organizer window opens, click **Distribute App → App Store Connect → Upload**.
4. After about 15 minutes the build appears in App Store Connect under your app's **TestFlight** tab.

## After changing the app's design

Edit `../index.html` as usual. Then pull the latest code and run:
```
cd app
npm run sync
```
In Xcode, increase **Build** (App target → General) by 1, then Archive and upload again.

## Settings already made

- Bundle ID `com.artloopwalk.app`, version 1.0 (build 1)
- iPhone only, portrait only, so no iPad screenshots are needed
- Export compliance is preset to "no non-exempt encryption", so Apple won't ask on each upload
- Icon and splash screen come from `assets/` and are regenerated with `npm run assets`
