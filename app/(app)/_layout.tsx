import { Redirect, Stack } from 'expo-router';

import { useAuth } from '~/contexts/AuthContext';

export default function AppGroupLayout() {
  const { user } = useAuth();

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }
  
  return <Stack screenOptions={{ headerShown: false }} />;
}


