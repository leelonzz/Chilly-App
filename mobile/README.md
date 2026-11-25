# Chilly (iPhone app via Expo Go)

A Pomodoro timer: 25 min focus, 5 min short break, 15 min long break every 4th round.
It vibrates when a round ends and keeps the screen awake while running.

## Run it on your iPhone

1. Install **Expo Go** from the App Store.
2. On any computer (Windows, Mac or Linux) with Node.js installed:
   ```bash
   cd mobile
   npm install
   npx expo start
   ```
3. Scan the QR code with the iPhone Camera app. It opens in Expo Go.
   Phone and computer must be on the same Wi-Fi. If they aren't, use `npx expo start --tunnel`.

No computer? Open https://snack.expo.dev in a browser, paste `App.tsx` over the
example code, and open the Snack in Expo Go (sign in to the same Expo account
in both, or scan the QR code).
