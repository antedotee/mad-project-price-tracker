import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Octicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';

import { Tables } from '~/types/supabase';
import { supabase } from '~/utils/supabase';

dayjs.extend(relativeTime);

type SearchListItemProps = {
  search: Tables<'searches'>;
  onToggleTracked?: () => void;
};

export default function SearchListItem({ search, onToggleTracked }: SearchListItemProps) {
  const [isTracked, setIsTracked] = useState(search?.is_tracked || false);

  // Update local state when search prop changes
  useEffect(() => {
    setIsTracked(search?.is_tracked || false);
  }, [search?.is_tracked]);

  // Real-time subscription for this specific search
  useEffect(() => {
    if (!search?.id) return;

    const subscription = supabase
      .channel(`search-${search.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'searches',
          filter: `id=eq.${search.id}`,
        },
        (payload) => {
          console.log('Search updated in real-time:', payload.new);
          setIsTracked((payload.new as Tables<'searches'>).is_tracked || false);
          onToggleTracked?.();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [search?.id, onToggleTracked]);

  const toggleIsTracked = async () => {
    if (!search?.id) {
      return;
    }

    // Optimistically update UI
    const newTrackedState = !isTracked;
    setIsTracked(newTrackedState);
    onToggleTracked?.(); // Notify parent immediately for UI responsiveness

    const { data, error } = await supabase
      .from('searches')
      .update({ is_tracked: newTrackedState })
      .eq('id', search?.id)
      .select()
      .single();

    if (error) {
      // Revert on error
      setIsTracked(!newTrackedState);
      console.error('Error toggling tracking:', error);
      onToggleTracked?.(); // Revert parent
    } else if (data) {
      // Confirm state (optional, but good for consistency)
      setIsTracked(data.is_tracked || false);
    }
  };

  return (
    <Link href={`/search/${search.id}`} asChild>
      <Pressable className="m-2 flex-row items-center justify-between gap-2 rounded bg-white p-4 shadow-sm active:bg-gray-50">
        <View className="flex-1">
          <Text className="text-xl font-semibold">{search.query}</Text>
          <Text className="text-sm text-gray-500">{dayjs(search.created_at).fromNow()}</Text>
          {search.last_scraped_at && (
            <Text className="color-gray">Scraped {dayjs(search.last_scraped_at).fromNow()}</Text>
          )}
          <Text className="text-xs text-gray-400">{search.status}</Text>
        </View>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            toggleIsTracked();
          }}
          className="p-2">
          <Octicons
            name={isTracked ? 'bell-fill' : 'bell'}
            size={22}
            color={isTracked ? '#0d9488' : 'dimgray'}
          />
        </Pressable>
      </Pressable>
    </Link>
  );
}

