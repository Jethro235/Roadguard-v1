# RoadGuard Native

Android-first React Native CLI foundation for RoadGuard.

## 1. Create the native shell

From PowerShell:

```powershell
npx @react-native-community/cli@latest init RoadGuard
cd RoadGuard
```

Then replace the generated `App.tsx` and add the `src/` files from this package.

## 2. Install packages

```powershell
npm install react-native-maps react-native-tts @react-native-async-storage/async-storage
```

## 3. Android permissions

Edit:

`android/app/src/main/AndroidManifest.xml`

Add these before `<application>`:

```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
```

Inside `<application>`, add your Google Maps API key:

```xml
<meta-data
    android:name="com.google.android.geo.API_KEY"
    android:value="${MAPS_API_KEY}" />
```

For a first local test, you can temporarily put the key directly in `android/app/src/main/AndroidManifest.xml`, but do not commit a real production key to Git.

Google Maps on Android requires an API key and a Google Cloud billing-enabled project. See the react-native-maps installation guidance:
https://github.com/react-native-maps/react-native-maps/blob/master/docs/installation.md

## 4. Run

Start Metro:

```powershell
npm start
```

In another terminal:

```powershell
npm run android
```

Use a physical Android phone or an Android emulator with Google Play services.

## Current milestone

- Vehicle modes: Car, Motorcycle, Bus/Minibus
- Real foreground GPS hook
- Google Maps component
- Preventive 500m enforcement-zone calculation
- Voice warning
- Law/fine reference screen
- Motorist rights screen
- Local checkpoint reporting
- 2-hour checkpoint expiry
- Local persistence for reports

## Next milestone

- Native Android background location / geofencing
- Neon PostgreSQL API
- Server-side checkpoint reports and confirmations
- Admin-controlled law/fine versions
- Production Google Maps key restrictions
- Push notifications and safer driving-mode UX
