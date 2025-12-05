import dayjs from 'dayjs';

import { useLocalSearchParams, Stack } from 'expo-router';

import { useEffect, useState } from 'react';

import { Text, View, Image, FlatList, ActivityIndicator, Linking } from 'react-native';

import allProducts from '~/assets/products.json';

import { Button } from '~/components/Button';

import { Tables } from '~/types/supabase';

import { supabase } from '~/utils/supabase';

type JsonProduct = (typeof allProducts)[0];

type ProductDisplay = {
  asin: string;
  name: string;
  image: string | null;
  url: string | null;
  final_price: number | null;
  currency: string;
};

export default function ProductDetailsScreen() {
  const [product, setProduct] = useState<ProductDisplay | null>(null);

  const [productSnapshots, setProductSnapshots] = useState<Tables<'product_snapshot'>[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  const { asin } = useLocalSearchParams<{ asin: string }>();

  const fetchProductData = async (asinValue: string) => {
    setIsLoading(true);
    
    // Fetch product and snapshots separately for better ordering
    Promise.all([
      // Fetch product
      supabase
        .from('products')
        .select('*')
        .eq('asin', asinValue)
        .single(),
      // Fetch snapshots with proper ordering
      supabase
        .from('product_snapshot')
        .select('*')
        .eq('asin', asinValue)
        .order('created_at', { ascending: false })
    ]).then(([productResult, snapshotsResult]) => {
      if (productResult.data && !productResult.error) {
        // Product found in Supabase
        setProduct({
          asin: productResult.data.asin,
          name: productResult.data.name,
          image: productResult.data.image,
          url: productResult.data.url,
          final_price: productResult.data.final_price,
          currency: productResult.data.currency,
        });
        
        // Set snapshots (already ordered by query)
        const snapshots = snapshotsResult.data || [];
        console.log(`Loaded ${snapshots.length} price snapshots for product ${asinValue}`);
        setProductSnapshots(snapshots);
        setIsLoading(false);
      } else {
          // Product not found in Supabase, try JSON fallback
          const jsonProduct = allProducts.find((p: JsonProduct) => p.asin === asinValue);
          
          if (jsonProduct) {
            // Convert JSON product to display format
            setProduct({
              asin: jsonProduct.asin,
              name: jsonProduct.name,
              image: jsonProduct.image || null,
              url: jsonProduct.url || null,
              final_price: jsonProduct.final_price || null,
              currency: jsonProduct.currency || 'USD',
            });
            // No snapshots available for JSON products
            setProductSnapshots([]);
            setIsLoading(false);
          } else {
            // Product not found in either Supabase or JSON
            setProduct(null);
            setProductSnapshots([]);
            setIsLoading(false);
          }
        }
      });
  };

  useEffect(() => {
    const asinValue = Array.isArray(asin) ? asin[0] : asin;
    
    if (!asinValue) {
      setIsLoading(false);
      return;
    }

    fetchProductData(asinValue);

    // Set up real-time subscription for price snapshots
    const subscription = supabase
      .channel(`product-snapshots-${asinValue}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'product_snapshot',
          filter: `asin=eq.${asinValue}`,
        },
        (payload) => {
          console.log('✅ New snapshot received via real-time:', payload.new);
          // Add new snapshot to the list (at the beginning since we want newest first)
          setProductSnapshots(prev => [payload.new as Tables<'product_snapshot'>, ...prev]);
          
          // Also update product price if it changed
          if (payload.new && 'final_price' in payload.new) {
            setProduct(prev => prev ? {
              ...prev,
              final_price: payload.new.final_price as number,
            } : null);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
          filter: `asin=eq.${asinValue}`,
        },
        (payload) => {
          console.log('✅ Product updated via real-time:', payload.new);
          if (payload.new && product) {
            setProduct({
              ...product,
              final_price: payload.new.final_price as number | null,
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Real-time subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time subscription active for product:', asinValue);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Real-time subscription error for product:', asinValue);
        }
      });

    return () => {
      subscription.unsubscribe();
    };
  }, [asin]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (!product) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Product not found</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title: 'Product Details' }} />
      <FlatList
        data={productSnapshots}
        contentContainerClassName="gap-3 pb-6"
        renderItem={({ item, index }) => {
          const previousSnapshot = productSnapshots[index + 1];
          const priceChanged = previousSnapshot && previousSnapshot.final_price !== item.final_price;
          const priceDropped = previousSnapshot && item.final_price < previousSnapshot.final_price;
          const priceIncreased = previousSnapshot && item.final_price > previousSnapshot.final_price;
          
          return (
            <View className="flex flex-row justify-between items-center bg-white p-4 rounded-lg shadow-sm">
              <View className="flex-1">
                <Text className="text-sm text-gray-600">{dayjs(item.created_at).format('MMMM D, YYYY')}</Text>
                <Text className="text-xs text-gray-400">{dayjs(item.created_at).format('h:mm A')}</Text>
                {priceDropped && (
                  <Text className="text-xs text-red-600 font-semibold mt-1">
                    ↓ Price dropped from ${previousSnapshot.final_price.toFixed(2)}
                  </Text>
                )}
                {priceIncreased && (
                  <Text className="text-xs text-green-600 font-semibold mt-1">
                    ↑ Price increased from ${previousSnapshot.final_price.toFixed(2)}
                  </Text>
                )}
              </View>
              <View className="items-end">
                <Text className={`text-lg font-bold ${priceDropped ? 'text-red-600' : priceIncreased ? 'text-green-600' : 'text-teal-600'}`}>
                  ${item.final_price.toFixed(2)}
                </Text>
                {priceChanged && previousSnapshot && (
                  <Text className={`text-xs mt-1 ${priceDropped ? 'text-red-600' : 'text-green-600'}`}>
                    {priceDropped ? '↓' : '↑'} ${Math.abs(item.final_price - previousSnapshot.final_price).toFixed(2)}
                    ({Math.abs(((item.final_price - previousSnapshot.final_price) / previousSnapshot.final_price) * 100).toFixed(1)}%)
                  </Text>
                )}
              </View>
            </View>
          );
        }}
        ListHeaderComponent={
          <View className="gap-4">
            {/* Product Image Section */}
            <View className="bg-white p-4 items-center">
              {product.image && (
                <Image 
                  source={{ uri: product.image }} 
                  className="h-64 w-64 rounded-lg bg-gray-100" 
                  resizeMode="contain" 
                />
              )}
            </View>

            {/* Product Info Section */}
            <View className="bg-white p-4 gap-3">
              <Text className="text-xl font-bold text-gray-900" numberOfLines={3}>
                {product.name}
              </Text>
              
              <View className="flex-row items-baseline gap-2">
                <Text className="text-3xl font-bold text-teal-600">
                  {product.final_price !== null ? `$${product.final_price}` : 'Price N/A'}
                </Text>
                {product.currency && product.currency !== 'USD' && (
                  <Text className="text-sm text-gray-500">{product.currency}</Text>
                )}
              </View>

              {product.url && (
                <Button
                  className="mt-2"
                  title="Open on Amazon"
                  onPress={() => Linking.openURL(product.url!)}
                />
              )}
            </View>

            {/* Price History Header */}
            <View className="px-4">
              <Text className="text-lg font-semibold text-gray-900">Price History</Text>
              <Text className="text-sm text-gray-500 mt-1">
                {productSnapshots.length} {productSnapshots.length === 1 ? 'snapshot' : 'snapshots'} recorded
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View className="bg-white p-6 rounded-lg items-center">
            <Text className="text-gray-500 text-center">
              No price history available yet.
            </Text>
            <Text className="text-gray-400 text-sm text-center mt-1">
              Price snapshots will appear here as they are recorded.
            </Text>
          </View>
        }
      />
    </View>
  );
}

