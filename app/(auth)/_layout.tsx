import { Redirect, Slot, Stack } from 'expo-router';

import { useAuth } from '../../contexts/AuthContext';

export default function AuthLayout() {
  const { user } = useAuth();

  if (user) {
    return <Redirect href="/" />;
  }
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Slot />
    </Stack>
  );
}