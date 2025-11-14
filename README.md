# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Connect frontend to the backend API

The app reads the API base URL from the `EXPO_PUBLIC_API_URL` environment variable (or `expo.extra.apiUrl` if provided). For local development with the included NestJS backend:

- Start the backend (listens on port `3010` by default)
- Start Expo with the env var set, for example:

```bash
# web
EXPO_PUBLIC_API_URL=http://localhost:3010 npx expo start --web

# native (Metro dev server)
EXPO_PUBLIC_API_URL=http://localhost:3010 npx expo start
```

On Android emulators, you may need to use `http://10.0.2.2:3010` instead of `localhost`.

## Reordering courses (drag & drop)

- Web: As an admin, open the Explore tab, click "Reorder" to enable drag-and-drop of the course grid. Drop to rearrange; order is saved immediately.
- Mobile (iOS/Android): As an admin, tap "Reorder" on the Explore screen, then long-press a course card to drag it. Release to drop; order is saved automatically. Tap "Done" to exit.

Implementation notes:
- Backend stores an integer `position` on `Course` and orders lists by `position` ascending.
- A protected endpoint `PUT /courses/reorder/bulk` accepts `{ items: [{ id, position }] }` and updates positions in a transaction.
- Frontend uses `@hello-pangea/dnd` on web and `react-native-draggable-flatlist` on native.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
