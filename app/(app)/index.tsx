import { Redirect } from 'expo-router';

export default function AppIndex() {
  // Redirect to tabs when user navigates to /(app)
  return <Redirect href="/(app)/(tabs)" />;
}