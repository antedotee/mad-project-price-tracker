import { Stack } from 'expo-router';
import { View, Text, FlatList } from 'react-native';

export default function PriceAlertsScreen() {
  // Placeholder for future price alerts functionality
  const alerts: any[] = [];

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title: 'Price Alerts' }} />
      
      <View className="bg-white px-6 py-6 shadow-sm">
        <Text className="mb-2 text-2xl font-bold text-gray-900">Price Alerts</Text>
        <Text className="text-sm text-gray-600">
          Get notified when prices drop on your tracked products
        </Text>
      </View>

      <View className="flex-1 items-center justify-center px-6">
        <View className="max-w-md items-center">
          <Text className="mb-2 text-center text-lg font-bold text-gray-900">
            Coming Soon
          </Text>
          <Text className="text-center text-base text-gray-500">
            Price alerts feature will be available soon. You'll be able to set alerts for your favorite products and get notified when prices drop.
          </Text>
        </View>
      </View>
    </View>
  );
}