import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Link, router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, TextInput, View, Text, FlatList } from 'react-native';

import { useAuth } from '~/contexts/AuthContext';
import { supabase } from '~/utils/supabase';

dayjs.extend(relativeTime);

// Development mode: Skip database calls
const DEV_MODE_SKIP_DB = __DEV__;

export default function Home() {
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState([]);
  const { user } = useAuth();

  const fetchHistory = () => {
    if (DEV_MODE_SKIP_DB) {
      // In dev mode, skip database calls
      setHistory([]);
      return;
    }

    if (!user?.id) return;
    
    supabase
      .from('searches')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.log('Error fetching history:', error.message);
          return;
        }
        setHistory(data || []);
      });
  };

  useEffect(() => {
    if (DEV_MODE_SKIP_DB) {
      // Skip database calls in dev mode
      return;
    }
    
    if (user?.id) {
      fetchHistory();
    }
  }, [user?.id]);

  const performSearch = async () => {
    if (!search.trim()) {
      return;
    }

    // In dev mode, navigate directly to show products from search.json
    if (DEV_MODE_SKIP_DB) {
      // Generate a mock ID with the search query encoded
      const encodedQuery = encodeURIComponent(search.trim());
      const mockId = `query-${encodedQuery}`;
      console.log('🔍 Navigating to search results with ID:', mockId);
      console.log('🔍 Search query:', search.trim());
      
      // Store the query in localStorage as a workaround
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('lastSearchQuery', search.trim());
        console.log('🔍 Stored search query in localStorage');
      }
      
      const href = `/search/${mockId}`;
      console.log('🔍 Href:', href);
      router.push(href);
      return;
    }

    if (!user?.id) {
      console.log('No user ID available');
      return;
    }

    // save this search in database
    const { data, error } = await supabase
      .from('searches')
      .insert({
        query: search,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.log('Error creating search:', error.message);
      return;
    }

    if (data) {
      router.push(`/search/${data.id}`);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ title: 'Search' }} />

      <View className="flex-row gap-3 p-3">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search for a product"
          className="flex-1 rounded border border-gray-300 bg-white p-3"
        />
        <Pressable onPress={performSearch} className="rounded bg-teal-500 p-3">
          <Text>Search</Text>
        </Pressable>
      </View>

      <FlatList
        data={history}
        contentContainerClassName="p-3 gap-2 "
        onRefresh={fetchHistory}
        refreshing={false}
        renderItem={({ item }) => (
          <Link href={`/search/${item.id}`} asChild>
            <Pressable className=" border-b border-gray-200 pb-2">
              <Text className="text-lg font-semibold">{item.query}</Text>
              <Text className="color-gray">{dayjs(item.created_at).fromNow()}</Text>
            </Pressable>
          </Link>
        )}
      />
    </View>
  );
}