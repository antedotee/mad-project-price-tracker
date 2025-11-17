import { Redirect, Tabs, useRouter, useFocusEffect } from 'expo-router';
import { Modal, Pressable, Text, View, Image } from 'react-native';
import { useState, useEffect, useCallback } from 'react';

import { TabBarIcon } from '~/components/TabBarIcon';
import { useAuth } from '~/contexts/AuthContext';
import { supabase } from '~/utils/supabase';

export default function TabLayout() {
  const { user } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchProfilePhoto();
    }
  }, [user]);

  // Refresh profile photo when returning to this screen
  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchProfilePhoto();
      }
    }, [user])
  );

  const fetchProfilePhoto = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('profile_photo_url')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('Error fetching profile photo:', error);
        return;
      }

      if (data?.profile_photo_url) {
        setProfilePhotoUrl(data.profile_photo_url);
      }
    } catch (error) {
      console.error('Error fetching profile photo:', error);
    }
  };

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleProfilePress = () => {
    setMenuOpen(false);
    router.push('/profile');
  };

  return (
    <>
      <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0d9488',
        tabBarInactiveTintColor: '#6b7280',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => <TabBarIcon name="search" color={color} />,
          headerRight: () => (
            <View className="mr-4" style={{ position: 'relative' }}>
              <Pressable
                onPress={() => setMenuOpen((v) => !v)}
                className="h-9 w-9 items-center justify-center rounded-full bg-teal-600 overflow-hidden">
                {profilePhotoUrl ? (
                  <Image
                    source={{ uri: profilePhotoUrl }}
                    className="h-9 w-9 rounded-full"
                  />
                ) : (
                  <Text className="text-sm font-bold text-white">
                    {user.email?.[0]?.toUpperCase() || 'U'}
                  </Text>
                )}
              </Pressable>
              {/* Dropdown handled via Modal below */}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color }) => <TabBarIcon name="bell" color={color} />,
        }}
      />
      </Tabs>

      {/* Profile Dropdown Modal */}
      <Modal
        visible={menuOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setMenuOpen(false)}>
        {/* Backdrop */}
        <Pressable
          onPress={() => setMenuOpen(false)}
          className="flex-1 bg-black/30"
          style={{ justifyContent: 'flex-start', alignItems: 'flex-end' }}>
          {/* Stop propagation when clicking the card */}
          <Pressable
            onPress={(e) => e.stopPropagation?.()}
            className="mt-14 mr-3 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-xl">
            <Text className="mb-2 truncate text-xs text-gray-500">Signed in as</Text>
            <Text className="mb-3 truncate text-sm font-semibold text-gray-800">
              {user.email}
            </Text>
            <Pressable
              onPress={handleProfilePress}
              className="mb-2 rounded-lg bg-teal-600 py-2 active:bg-teal-700">
              <Text className="text-center text-sm font-semibold text-white">Profile</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                handleLogout();
              }}
              className="rounded-lg bg-red-600 py-2 active:bg-red-700">
              <Text className="text-center text-sm font-semibold text-white">Logout</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}