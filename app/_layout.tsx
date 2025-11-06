import '../global.css';

import { Stack } from 'expo-router';
import AuthContextProvider from '../contexts/AuthContext';

export default function Layout() {
  return (
    <AuthContextProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack>
    </AuthContextProvider>
  );
}
