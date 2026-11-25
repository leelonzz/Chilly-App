# Journal (iPhone app via Expo Go)

A private journal with photos. Everything is stored on your phone only.

- Write entries with a title, text and a mood
- Add photos from your library (several at once) or take one with the camera
- Tap a photo to see it full screen; tap ✕ to remove it
- Search entries, edit them, or delete them (their photos are deleted too)

## Run it on your iPhone

1. Install **Expo Go** from the App Store.
2. On any computer with Node.js:
   ```bash
   cd journal
   npm install
   npx expo start
   ```
3. Scan the QR code with the iPhone Camera app. Phone and computer must be on
   the same Wi-Fi, or use `npx expo start --tunnel`.

No computer? Paste `App.tsx` into https://snack.expo.dev and open it in Expo Go.

Note: entries live inside Expo Go's storage. Deleting Expo Go deletes your journal.
