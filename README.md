# RoadGuard

RoadGuard is a React Native CLI Android app with vehicle selection, live GPS
zone warnings, checkpoint reporting, voice alerts, road-law references, and
motorist-rights guidance. The map needs a valid Android Google Maps API key;
the rest of the app remains usable if maps or location are unavailable.

Use Node.js 22.11 or later and Java 17. Start Metro with `npm start`, then run
`npm run android` from a second terminal. Grant location permission to enable
live warnings and checkpoint reporting; without it the app stays in demo mode.

The remaining setup and troubleshooting instructions below follow the
React Native CLI workflow.

# RoadGuard MVP behavior

First launch asks for a vehicle. Select **Settings** to change the warning
distance, voice alerts, GPS, optional API URL, or Android background monitoring.
Seeded map areas are illustrative demo coordinates, not official locations.
Law references are unverified placeholders and do not include fine amounts.
Community reports are temporary user reports, never official information.

## RoadGuard API and Neon setup

The optional API lives in `server/` and is separate from the React Native
dependency graph. It needs Node.js 22.11+, PostgreSQL access through Neon, and
an administrator-provided token. No credentials are committed.

1. Create a Neon database and keep its connection string private.
2. Copy `server/.env.example` to `server/.env`, then fill in `DATABASE_URL`
   and a random `ADMIN_TOKEN` of at least 32 characters locally. Do not commit
   `server/.env`.
3. Install the server dependency from `server/` with `npm install`.
4. Apply `server/migrations/001_initial_schema.sql` to the database using the
   provider's SQL editor or `psql`.
5. Start the API with `npm start` from `server/`, or `npm run server` from the
   project root. The admin review page is at `/admin`; it keeps the token only
   in the current page memory.
6. In RoadGuard Settings, set the API base URL to the deployed HTTPS URL. For
   Android emulator development, `http://10.0.2.2:3000` may be used when the
   Android build permits local cleartext development traffic.

Without a reachable database, `/health` reports degraded and the app remains
in demo/offline mode. The API only receives coordinates when the user taps the
checkpoint report action. It stores no trip history and expires reports after
two hours. The in-memory rate limiter is suitable for a single-instance MVP;
use a shared limiter before horizontal scaling.

Run mobile checks with `npm test -- --runInBand`, `npm run lint`, and
`npx tsc --noEmit`. Run API validation tests with `npm run test:server`.
Background location is an Android foreground service with an ongoing
notification; permission policy and behavior still require real-device QA.

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
