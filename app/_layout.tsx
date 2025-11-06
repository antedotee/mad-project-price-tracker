import '../global.css';

import { Stack } from 'expo-router';
import AuthContextProvider from '../contexts/AuthContext';

export default function Layout() {
  return (
    <AuthContextProvider>
      <Stack />
    </AuthContextProvider>
  );
}
