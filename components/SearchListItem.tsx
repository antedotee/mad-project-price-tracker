import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Octicons } from '@expo/vector-icons';

import { Tables } from '~/types/supabase';
import { supabase } from '~/utils/supabase';

dayjs.extend(relativeTime);

type SearchListItemProps = {
  search: Tables<'searches'>;
  onToggleTracked?: () => void;
};

export default function SearchListItem({ search, onToggleTracked }: SearchListItemProps) {
  const toggleIsTracked = async () => {
    if (!search?.id) {
      return;
    }

    const { data, error } = await supabase
      .from('searches')
      .update({ is_tracked: !search?.is_tracked })
      .eq('id', search?.id)
      .select()
      .single();

    if (!error && data) {
      onToggleTracked?.();
    }
  };

  return (
    <Link href={`/search/${search.id}`} asChild>
      <Pressable className="m-2 flex-row items-center justify-between gap-2 rounded bg-white p-4 shadow-sm active:bg-gray-50">
        <View className="flex-1">
          <Text className="text-xl font-semibold">{search.query}</Text>
          <Text className="text-sm text-gray-500">{dayjs(search.created_at).fromNow()}</Text>
          <Text className="text-xs text-gray-400">{search.status}</Text>
        </View>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            toggleIsTracked();
          }}
          className="p-2">
          <Octicons
            name={search.is_tracked ? 'bell-fill' : 'bell'}
            size={22}
            color="dimgray"
          />
        </Pressable>
      </Pressable>
    </Link>
  );
}

