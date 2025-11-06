import { StatusBar } from 'expo-status-bar';
import { Platform, Text, View, Pressable } from 'react-native';

import { supabase } from '~/utils/supabase';

export default function Modal() {
  return (
    <View className="flex-1 bg-gray-50">
      <View className="flex-1 items-center justify-center px-6">
        <View className="w-full max-w-md rounded-lg bg-white p-6 shadow-sm">
          <Text className="mb-4 text-center text-xl font-bold text-gray-900">
            Account Settings
          </Text>
          <Text className="mb-6 text-center text-base text-gray-600">
            Are you sure you want to sign out?
          </Text>
          <Pressable
            onPress={() => supabase.auth.signOut()}
            className="rounded-lg bg-red-600 py-4 shadow-sm active:bg-red-700">
            <Text className="text-center text-base font-semibold text-white">
              Sign Out
            </Text>
          </Pressable>
        </View>
      </View>

      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </View>
  );
}