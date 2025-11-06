import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Link, router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, TextInput, View, Text, FlatList, Image, Linking } from 'react-native';

import { useAuth } from '~/contexts/AuthContext';
import { supabase } from '~/utils/supabase';
import allProducts from '~/assets/products.json';

dayjs.extend(relativeTime);

// Development mode: Use local JSON data for testing
const DEV_MODE_SKIP_DB = true; // Using local products.json for demo

type Product = (typeof allProducts)[0];

// Function to filter products
const filterProducts = (products: Product[], query: string): Product[] => {
  if (!query || !query.trim()) {
    return products.slice(0, 50); // Show first 50 products by default
  }
  
  const cleanQuery = query.trim().toLowerCase();
  const searchTerms = cleanQuery.split(/\s+/).filter(term => term.length >= 2);
  
  if (searchTerms.length === 0) {
    return products.slice(0, 50);
  }
  
  const filtered = products.filter((product) => {
    const name = (product.name || '').toLowerCase();
    const brand = (product.brand || '').toLowerCase();
    
    return searchTerms.some((term) => {
      return name.includes(term) || (brand && brand.includes(term));
    });
  });
  
  return filtered.slice(0, 50);
};

export default function Home() {
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState([]);
  const [displayedProducts, setDisplayedProducts] = useState<Product[]>([]);
  const { user } = useAuth();
  
  // Load all products on initial mount
  useEffect(() => {
    setDisplayedProducts(allProducts.slice(0, 50));
  }, []);

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

  // Real-time filtering when search text changes
  useEffect(() => {
    if (!search.trim()) {
      // Show all products when search is empty
      setDisplayedProducts(allProducts.slice(0, 50));
    } else {
      // Filter products based on search query
      const filtered = filterProducts(allProducts, search.trim());
      setDisplayedProducts(filtered);
    }
  }, [search]);

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title: 'Price Tracker' }} />

      {/* Search Section */}
      <View className="bg-white px-6 py-6 shadow-sm">
        <Text className="mb-2 text-2xl font-bold text-gray-900">Search Products</Text>
        <Text className="mb-4 text-sm text-gray-600">
          Browse 36,000+ Amazon products - Start typing to filter
        </Text>
        
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Type to search: iPhone, Laptop..."
          placeholderTextColor="#9CA3AF"
          returnKeyType="search"
          className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900"
        />
      </View>

      {/* Products Section */}
      <View className="mt-4 flex-1 px-6">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-lg font-bold text-gray-900">
            {search.trim() ? `Results for "${search}"` : 'All Products'}
          </Text>
          <Text className="text-sm text-gray-500">
            {displayedProducts.length} products
          </Text>
        </View>
        
        {displayedProducts.length === 0 ? (
          <View className="mt-8 items-center justify-center">
            <Text className="text-center text-base text-gray-500">
              No products found.{'\n'}Try a different search term!
            </Text>
          </View>
        ) : (
          <FlatList
            data={displayedProducts}
            contentContainerClassName="gap-3 pb-6"
            showsVerticalScrollIndicator={true}
            keyExtractor={(item) => item?.asin || String(Math.random())}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => item?.url && Linking.openURL(item.url)}
                className="flex-row gap-4 rounded-lg bg-white p-4 shadow-sm active:bg-gray-50">
                {item?.image && (
                  <Image 
                    source={{ uri: item.image }} 
                    className="h-24 w-24 rounded-md bg-gray-100" 
                    resizeMode="contain"
                  />
                )}
                <View className="flex-1 justify-between">
                  <Text className="text-sm text-gray-900" numberOfLines={3}>
                    {item?.name || 'Product'}
                  </Text>
                  <View className="mt-2 flex-row items-center justify-between">
                    <Text className="text-lg font-bold text-teal-600">
                      ${item?.final_price || 'N/A'}
                    </Text>
                    {item?.rating && (
                      <Text className="text-xs text-gray-500">
                        ⭐ {item.rating} ({item.num_ratings || 0})
                      </Text>
                    )}
                  </View>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
    </View>
  );
}