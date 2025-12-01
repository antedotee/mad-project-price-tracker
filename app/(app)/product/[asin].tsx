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

  useEffect(() => {
    const asinValue = Array.isArray(asin) ? asin[0] : asin;
    
    if (!asinValue) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    // First, try to fetch from Supabase
    supabase
      .from('products')
      .select('*, product_snapshot(*)')
      .eq('asin', asinValue)
      .single()
      .then(({ data, error }) => {
        if (data && !error) {
          // Product found in Supabase
          setProduct({
            asin: data.asin,
            name: data.name,
            image: data.image,
            url: data.url,
            final_price: data.final_price,
            currency: data.currency,
          });
          setProductSnapshots(data?.product_snapshot || []);
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
        renderItem={({ item }) => (
          <View className="flex flex-row justify-between items-center bg-white p-4 rounded-lg shadow-sm">
            <View className="flex-1">
              <Text className="text-sm text-gray-600">{dayjs(item.created_at).format('MMMM D, YYYY')}</Text>
              <Text className="text-xs text-gray-400">{dayjs(item.created_at).format('h:mm A')}</Text>
            </View>
            <Text className="text-lg font-bold text-teal-600">${item.final_price}</Text>
          </View>
        )}
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

