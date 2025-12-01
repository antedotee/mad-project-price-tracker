import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, Text, FlatList } from 'react-native';

import SearchListItem from '~/components/SearchListItem';
import { useAuth } from '~/contexts/AuthContext';
import { Tables } from '~/types/supabase';
import { supabase } from '~/utils/supabase';

export default function PriceAlertsScreen() {
  const [history, setHistory] = useState<Tables<'searches'>[]>([]);
  const { user } = useAuth();

  const fetchHistory = () => {
    if (!user) {
      return;
    }

    supabase
      .from('searches')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_tracked', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => setHistory(data || []));
  };

  useEffect(() => {
    fetchHistory();
  }, [user]);

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ title: 'Tracked Searches' }} />
      
      <FlatList
        data={history}
        contentContainerClassName="p-3 gap-2"
        onRefresh={fetchHistory}
        refreshing={false}
        renderItem={({ item }) => <SearchListItem search={item} onToggleTracked={fetchHistory} />}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center px-6 py-12">
            <Text className="mb-2 text-center text-lg font-bold text-gray-900">
              No tracked searches
            </Text>
            <Text className="text-center text-base text-gray-500">
              Start tracking searches to see them here. Tap the bell icon on any search to track it.
            </Text>
          </View>
        }
      />
    </View>
  );
}