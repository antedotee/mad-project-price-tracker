import dayjs from 'dayjs';

import { useLocalSearchParams, Stack } from 'expo-router';

import { useEffect, useState } from 'react';

import { Text, View, Image, FlatList, ActivityIndicator } from 'react-native';

import { Tables } from '~/types/supabase';

import { supabase } from '~/utils/supabase';

export default function ProductDetailsScreen() {
  const [product, setProduct] = useState<Tables<'products'> | null>(null);

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
    supabase
      .from('products')
      .select('*, product_snapshot(*)')
      .eq('asin', asinValue)
      .single()
      .then(({ data, error }) => {
        console.log(error);
        setProduct(data);
        setProductSnapshots(data?.product_snapshot || []);
        setIsLoading(false);
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
      <Stack.Screen options={{ title: product.name || 'Product Details' }} />
      <FlatList
        data={productSnapshots}
        contentContainerClassName="gap-2"
        renderItem={({ item }) => (
          <View className="flex flex-row justify-between bg-white p-3">
            <Text>{dayjs(item.created_at).format('MMMM D, YYYY h:mm A')}</Text>
            <Text>$ {item.final_price}</Text>
          </View>
        )}
        ListHeaderComponent={
          <View>
            <View
              // onPress={() => Linking.openURL(item.url)}
              className="flex-row gap-2 bg-white p-3">
              {product.image && (
                <Image source={{ uri: product.image }} className="h-20 w-20" resizeMode="contain" />
              )}
              <Text className="flex-1" numberOfLines={4}>
                {product.name}
              </Text>
              <Text>$ {product.final_price}</Text>
            </View>
            <Text className="mt-4 p-2 font-semibold">Price history</Text>
          </View>
        }
      />
    </View>
  );
}

