import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, Linking, RefreshControl } from 'react-native';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import SearchListItem from '~/components/SearchListItem';
import { useAuth } from '~/contexts/AuthContext';
import { Tables } from '~/types/supabase';
import { supabase } from '~/utils/supabase';

dayjs.extend(relativeTime);

type PriceDropAlert = {
  id: string;
  created_at: string;
  search_id: string;
  asin: string;
  product_name: string;
  product_url: string | null;
  old_price: number;
  new_price: number;
  price_drop_amount: number;
  price_drop_percent: number;
  is_read: boolean;
};

export default function PriceAlertsScreen() {
  const [history, setHistory] = useState<Tables<'searches'>[]>([]);
  const [alerts, setAlerts] = useState<PriceDropAlert[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'searches' | 'alerts'>('alerts');
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

  const fetchAlerts = async () => {
    if (!user) {
      return;
    }

    const { data, error } = await supabase
      .from('price_drop_alerts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setAlerts(data as PriceDropAlert[]);
    }
  };

  const markAlertAsRead = async (alertId: string) => {
    const { error } = await supabase
      .from('price_drop_alerts')
      .update({ is_read: true })
      .eq('id', alertId);

    if (!error) {
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_read: true } : a));
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('price_drop_alerts')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (!error) {
      fetchAlerts();
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchHistory(), fetchAlerts()]);
    setRefreshing(false);
  };

  useEffect(() => {
    if (user) {
      fetchHistory();
      fetchAlerts();
    }
  }, [user]);

  // Real-time subscription for new price drop alerts
  useEffect(() => {
    if (!user) return;

    const subscription = supabase
      .channel('price-drop-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'price_drop_alerts',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('New price drop alert:', payload.new);
          // Add new alert to the list
          setAlerts(prev => [payload.new as PriceDropAlert, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'price_drop_alerts',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Alert updated:', payload.new);
          // Update alert in the list
          setAlerts(prev => prev.map(a => a.id === payload.new.id ? payload.new as PriceDropAlert : a));
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const unreadCount = alerts.filter(a => !a.is_read).length;

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen 
        options={{ 
          title: 'Price Alerts',
          headerRight: () => unreadCount > 0 && activeTab === 'alerts' ? (
            <Pressable onPress={markAllAsRead} className="mr-4 px-3 py-1">
              <Text className="text-teal-600 font-semibold">Mark all read</Text>
            </Pressable>
          ) : null
        }} 
      />
      
      {/* Tab Switcher */}
      <View className="flex-row bg-white border-b border-gray-200">
        <Pressable
          onPress={() => setActiveTab('alerts')}
          className={`flex-1 py-3 items-center ${activeTab === 'alerts' ? 'border-b-2 border-teal-600' : ''}`}>
          <View className="flex-row items-center gap-2">
            <Text className={`font-semibold ${activeTab === 'alerts' ? 'text-teal-600' : 'text-gray-500'}`}>
              Price Drops
            </Text>
            {unreadCount > 0 && (
              <View className="bg-red-500 rounded-full px-2 py-0.5 min-w-[20px] items-center">
                <Text className="text-white text-xs font-bold">{unreadCount}</Text>
              </View>
            )}
          </View>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('searches')}
          className={`flex-1 py-3 items-center ${activeTab === 'searches' ? 'border-b-2 border-teal-600' : ''}`}>
          <Text className={`font-semibold ${activeTab === 'searches' ? 'text-teal-600' : 'text-gray-500'}`}>
            Tracked Searches
          </Text>
        </Pressable>
      </View>

      {activeTab === 'alerts' ? (
        <FlatList
          data={alerts}
          contentContainerClassName="p-3 gap-3"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                if (!item.is_read) markAlertAsRead(item.id);
                if (item.product_url) Linking.openURL(item.product_url);
              }}
              className={`bg-white rounded-lg p-4 shadow-sm ${!item.is_read ? 'border-l-4 border-teal-600' : ''}`}>
              <View className="flex-row justify-between items-start mb-2">
                <View className="flex-1">
                  <Text className="text-base font-bold text-gray-900" numberOfLines={2}>
                    {item.product_name}
                  </Text>
                  <Text className="text-xs text-gray-500 mt-1">
                    {dayjs(item.created_at).format('MMMM D, YYYY [at] h:mm A')} • {dayjs(item.created_at).fromNow()}
                  </Text>
                </View>
                {!item.is_read && (
                  <View className="w-2 h-2 bg-teal-600 rounded-full mt-1" />
                )}
              </View>
              
              <View className="mt-3">
                <Text className="text-xs text-gray-500 mb-2">Price dropped:</Text>
                <View className="flex-row items-baseline gap-2">
                  <Text className="text-lg font-bold text-gray-400 line-through">
                    ${item.old_price.toFixed(2)}
                  </Text>
                  <Text className="text-xl font-bold text-teal-600">
                    ${item.new_price.toFixed(2)}
                  </Text>
                </View>
              </View>
              
              <View className="flex-row items-center gap-2 mt-3">
                <View className="bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                  <Text className="text-red-600 font-bold text-sm">
                    ↓ ${item.price_drop_amount.toFixed(2)} saved
                  </Text>
                  <Text className="text-red-500 text-xs mt-0.5">
                    {item.price_drop_percent.toFixed(1)}% discount
                  </Text>
                </View>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center px-6 py-12">
              <Text className="mb-2 text-center text-lg font-bold text-gray-900">
                No price drops yet
              </Text>
              <Text className="text-center text-base text-gray-500">
                Price drop alerts will appear here when tracked products go on sale.
              </Text>
              <Text className="text-center text-sm text-gray-400 mt-2">
                Make sure you've tracked some searches and prices have changed.
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={history}
          contentContainerClassName="p-3 gap-2"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
      )}
    </View>
  );
}