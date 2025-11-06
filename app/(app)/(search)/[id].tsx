import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useLocalSearchParams, router, Stack, useSegments, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Text,
  View,
  FlatList,
  Image,
  Pressable,
  Linking,
  ActivityIndicator,
  Button,
  TextInput,
} from 'react-native';

import dummyProducts from '~/assets/search.json';
import { supabase } from '~/utils/supabase';

dayjs.extend(relativeTime);

type Product = (typeof dummyProducts)[0];
type Search = {
  id: string;
  query: string;
  created_at: string;
  status: string;
  user_id: string;
};

// Development mode: Skip database calls and use search.json data
const DEV_MODE_SKIP_DB = __DEV__;

// Function to filter products based on search query
const filterProductsByQuery = (products: Product[], query: string): Product[] => {
  console.log('🔍 filterProductsByQuery called with query:', `"${query}"`);
  
  // Query should already be cleaned before calling this function
  if (!query || !query.trim() || query.trim().length === 0) {
    console.log('🔍 Empty query, returning first 20');
    return products.slice(0, 20);
  }

  const cleanQuery = query.trim().toLowerCase();
  const searchTerms = cleanQuery.split(/\s+/).filter(term => term.length >= 2);
  
  console.log('🔍 Search terms extracted:', searchTerms);
  
  if (searchTerms.length === 0) {
    console.log('🔍 No valid search terms (length >= 2), returning first 20');
    return products.slice(0, 20);
  }
  
  const filtered = products.filter((product) => {
    const name = (product.name || '').toLowerCase();
    const keyword = (product.keyword || '').toLowerCase();
    const brand = (product.brand || '').toLowerCase();
    
    // Check if ANY search term matches in name, keyword, or brand
    return searchTerms.some((term) => {
      return name.includes(term) || keyword.includes(term) || (brand && brand.includes(term));
    });
  });
  
  const result = filtered.slice(0, 50); // Limit to 50 results
  console.log(`🔍 Filtered ${result.length} products from ${products.length} total`);
  console.log('🔍 Sample matches:', result.slice(0, 2).map(p => ({
    name: p.name.substring(0, 60),
    keyword: p.keyword
  })));
  
  return result;
};

export default function SearchResultScreen() {
  const params = useLocalSearchParams();
  const segments = useSegments();
  const pathname = usePathname();
  const id = params.id;
  const [search, setSearch] = useState<Search | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Extract query from URL
  const extractQueryFromId = (idString: string): string => {
    if (!idString || idString === 'search') {
      return '';
    }
    
    // Check if it matches the pattern query-<encoded query>
    if (idString.startsWith('query-')) {
      const encodedQuery = idString.substring(6); // Remove "query-" prefix
      try {
        const decoded = decodeURIComponent(encodedQuery);
        return decoded.trim();
      } catch (e) {
        return encodedQuery.trim();
      }
    }
    
    return idString.trim();
  };

  useEffect(() => {
    // Debug: Log all params and route info
    console.log('🔍 All params:', JSON.stringify(params, null, 2));
    console.log('🔍 ID value:', id);
    console.log('🔍 ID type:', typeof id);
    console.log('🔍 ID is array:', Array.isArray(id));
    console.log('🔍 Segments:', segments);
    console.log('🔍 Pathname:', pathname);
    if (typeof window !== 'undefined' && window.location) {
      console.log('🔍 Browser URL:', window.location.href);
      console.log('🔍 Browser pathname:', window.location.pathname);
      console.log('🔍 Browser search:', window.location.search);
    }
    
    // In dev mode, skip database calls and use search.json data
    if (DEV_MODE_SKIP_DB) {
      // CRITICAL: Check browser URL FIRST before trying params
      // This is a workaround for Expo Router not passing dynamic route params correctly
      let idFromUrl = '';
      if (typeof window !== 'undefined' && window.location) {
        const urlPath = window.location.pathname;
        console.log('🔍 Checking browser URL pathname:', urlPath);
        const urlParts = urlPath.split('/').filter(p => p.length > 0);
        console.log('🔍 URL parts:', urlParts);
        const searchIndex = urlParts.indexOf('search');
        if (searchIndex !== -1 && urlParts[searchIndex + 1] && urlParts[searchIndex + 1] !== 'search') {
          idFromUrl = urlParts[searchIndex + 1];
          console.log('🔍 Found ID in URL:', idFromUrl);
        }
      }
      // Handle different ways id might be passed
      let idString = '';
      
      // PRIORITY 1: Use ID from browser URL (most reliable)
      if (idFromUrl && idFromUrl !== 'search') {
        idString = idFromUrl;
        console.log('✅ Using ID from browser URL:', idString);
      }
      // PRIORITY 2: Try params
      else if (Array.isArray(id)) {
        idString = id[0] || '';
      } else if (id && id !== 'search') {
        idString = id.toString();
      } else if (params.id && params.id !== 'search') {
        idString = Array.isArray(params.id) ? params.id[0] : params.id.toString();
      }
      
      // If still no ID, try to extract from pathname
      if (!idString && pathname) {
        console.log('🔍 Trying to extract ID from pathname:', pathname);
        const pathParts = pathname.split('/').filter(p => p.length > 0);
        console.log('🔍 Path parts:', pathParts);
        const searchIndex = pathParts.indexOf('search');
        if (searchIndex !== -1 && pathParts[searchIndex + 1]) {
          idString = pathParts[searchIndex + 1];
          console.log('🔍 Extracted ID from pathname:', idString);
        }
      }
      
      // Last resort: try to get from window.location (web only)
      if (!idString && typeof window !== 'undefined' && window.location) {
        const urlPath = window.location.pathname;
        console.log('🔍 Trying to extract ID from window.location:', urlPath);
        const urlParts = urlPath.split('/').filter(p => p.length > 0);
        const urlSearchIndex = urlParts.indexOf('search');
        if (urlSearchIndex !== -1 && urlParts[urlSearchIndex + 1]) {
          idString = urlParts[urlSearchIndex + 1];
          console.log('🔍 Extracted ID from window.location:', idString);
        }
      }
      
      // If still no ID, try segments
      if (!idString && segments.length > 0) {
        console.log('🔍 Trying to extract ID from segments');
        // Look for segments that might contain the ID
        // Segments format: ['(app)', '(search)', '[id]'] or ['(app)', '(search)', 'query-toddler']
        const searchSegmentIndex = segments.findIndex(s => s.includes('search'));
        if (searchSegmentIndex !== -1 && segments[searchSegmentIndex + 1]) {
          const potentialId = segments[searchSegmentIndex + 1];
          // If it's not '[id]', it might be the actual ID
          if (potentialId !== '[id]' && !potentialId.startsWith('(')) {
            idString = potentialId;
            console.log('🔍 Extracted ID from segments:', idString);
          }
        }
      }
      
      console.log('🔍 Final processed ID string:', `"${idString}"`);
      
      // CRITICAL WORKAROUND: If ID is empty, "search", or missing, check localStorage
      // This handles the case where Expo Router navigation isn't working correctly
      if (!idString || idString === 'search' || idString === '' || idString === '[id]') {
        console.warn('⚠️ No valid ID found, checking localStorage workaround');
        console.log('🔍 Current idString:', `"${idString}"`);
        
        // Try to get from localStorage first (most reliable workaround)
        let workaroundQuery = '';
        if (typeof window !== 'undefined' && window.localStorage) {
          console.log('🔍 Checking localStorage...');
          workaroundQuery = window.localStorage.getItem('lastSearchQuery') || '';
          console.log('🔍 localStorage value:', `"${workaroundQuery}"`);
          if (workaroundQuery) {
            console.log('✅ Found query in localStorage:', workaroundQuery);
            // Clear it after use
            window.localStorage.removeItem('lastSearchQuery');
          } else {
            console.warn('⚠️ localStorage is empty or key not found');
            // Check all localStorage keys for debugging
            console.log('🔍 All localStorage keys:', Object.keys(window.localStorage));
          }
        } else {
          console.warn('⚠️ window.localStorage not available');
        }
        
        // If we have a query from localStorage, use it
        if (workaroundQuery && workaroundQuery.trim().length > 0) {
          console.log('🔍 Using workaround query from localStorage:', workaroundQuery);
          const encodedQuery = encodeURIComponent(workaroundQuery.trim());
          idString = `query-${encodedQuery}`;
          console.log('🔍 Set ID string to:', idString);
          // Continue with normal flow below
        } else {
          console.warn('⚠️ No query found in localStorage, showing first 20 products');
          console.warn('⚠️ Make sure you searched from the home page to store the query');
          setProducts(dummyProducts.slice(0, 20));
          setIsLoading(false);
          return;
        }
      }
      
      // Create a mock search object if we have an id
      if (idString && idString !== 'search' && idString.length > 0 && idString !== '[id]') {
        const query = extractQueryFromId(idString);
        
        console.log('🔍 ID received:', idString);
        console.log('🔍 Query extracted:', `"${query}"`);
        console.log('🔍 Query length:', query.length);
        console.log('🔍 Total products available:', dummyProducts.length);
        
        // Set search query in the input field
        setSearchQuery(query);
        
        setSearch({
          id: idString,
          query: query,
          created_at: new Date().toISOString(),
          status: 'completed',
          user_id: 'dev-user-id',
        });
        
        // CRITICAL: Always filter when we have a non-empty query
        if (query && query.trim().length > 0) {
          console.log('🔍 Filtering products with query:', query);
          const filteredProducts = filterProductsByQuery(dummyProducts, query);
          console.log(`✅ Filtered ${filteredProducts.length} products from ${dummyProducts.length} total`);
          
          // Verify the filter actually worked
          if (filteredProducts.length === dummyProducts.length) {
            console.error('❌ ERROR: Filter returned ALL products! Query was:', query);
            // Force a strict filter
            const strictFiltered = dummyProducts.filter(p => {
              const name = (p.name || '').toLowerCase();
              const keyword = (p.keyword || '').toLowerCase();
              const searchTerm = query.toLowerCase().trim();
              return name.includes(searchTerm) || keyword.includes(searchTerm);
            });
            console.log('🔍 Strict filter result:', strictFiltered.length);
            setProducts(strictFiltered.slice(0, 50));
          } else {
            console.log('✅ Filter working correctly, setting products');
            setProducts(filteredProducts);
          }
        } else {
          console.warn('⚠️ Empty query detected, showing first 20');
          setProducts(dummyProducts.slice(0, 20));
        }
      } else {
        // If no id, show first 20 products
        console.log('⚠️ No valid ID, showing first 20 products');
        console.log('⚠️ ID string was:', `"${idString}"`);
        setProducts(dummyProducts.slice(0, 20));
      }
      setIsLoading(false);
      return;
    }

    // Real database calls (only if not in dev mode)
    if (id && id !== 'search') {
      setIsLoading(true);
      supabase
        .from('searches')
        .select('*')
        .eq('id', id)
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.log('Error fetching search:', error.message);
            setIsLoading(false);
            return;
          }
          setSearch(data);
          setIsLoading(false);
        });

      supabase
        .from('product_search')
        .select('*, products(*)')
        .eq('search_id', id)
        .then(({ data, error }) => {
          if (error) {
            console.log('Error fetching products:', error.message);
            // Keep default products on error
            return;
          }
          if (data && data.length > 0) {
            const dbProducts = data.map((d) => d.products).filter(Boolean);
            if (dbProducts.length > 0) {
              setProducts(dbProducts);
            }
          }
        });
    } else {
      // If no valid id, show dummy products
      setProducts(dummyProducts.slice(0, 20));
      setIsLoading(false);
    }
  }, [id]);

  const startScraping = async () => {
    const { data, error } = await supabase.functions.invoke('scrape-start', {
      body: JSON.stringify({ record: search }),
    });
    console.log(data, error);
  };

  if (isLoading && !DEV_MODE_SKIP_DB) {
    return <ActivityIndicator />;
  }

  const handleNewSearch = () => {
    if (!searchQuery.trim()) return;
    
    // In dev mode, navigate with the new query
    if (DEV_MODE_SKIP_DB) {
      const encodedQuery = encodeURIComponent(searchQuery.trim());
      const mockId = `query-${encodedQuery}`;
      router.push(`/search/${mockId}`);
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title: search?.query || 'Search Results' }} />
      
      {/* Search Bar */}
      <View className="flex-row gap-3 border-b border-gray-200 bg-white p-3">
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search for a product"
          onSubmitEditing={handleNewSearch}
          returnKeyType="search"
          className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2"
        />
        <Pressable onPress={handleNewSearch} className="rounded-lg bg-teal-600 px-4 py-2">
          <Text className="font-semibold text-white">Search</Text>
        </Pressable>
      </View>

      {search && (
        <View className="m-2 gap-2 rounded-lg bg-white p-3 shadow-sm">
          <Text className="text-xl font-semibold">{search.query}</Text>
          <Text className="text-gray-600">{dayjs(search.created_at).fromNow()}</Text>
          <Text className="text-gray-600">Status: {search.status}</Text>
          {!DEV_MODE_SKIP_DB && (
            <Button title="Start scraping" onPress={startScraping} />
          )}
        </View>
      )}
      

      {products.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-lg font-semibold text-gray-700">No products found</Text>
          <Text className="mt-2 text-center text-gray-500">
            {search
              ? `No products match your search for "${search.query}"`
              : 'Try searching for a product'}
          </Text>
        </View>
      ) : (
        <View className="mb-2 px-2">
          <Text className="text-sm text-gray-600">
            Found {products.length} product{products.length !== 1 ? 's' : ''}
            {search && ` for "${search.query}"`}
          </Text>
        </View>
      )}

      <FlatList
        data={products}
        contentContainerClassName="gap-2 p-2"
        keyExtractor={(item) => item?.asin || String(Math.random())}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => item?.url && Linking.openURL(item.url)}
            className="flex-row gap-2 bg-white p-3">
            {item?.image && (
              <Image source={{ uri: item.image }} className="h-20 w-20" />
            )}
            <Text className="flex-1" numberOfLines={4}>
              {item?.name || 'Product'}
            </Text>
            <Text>$ {item?.final_price || 'N/A'}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}