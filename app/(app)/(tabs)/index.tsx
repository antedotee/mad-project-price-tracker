import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Stack, Link, router } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { Pressable, TextInput, View, Text, FlatList, Image, ActivityIndicator } from 'react-native';
import { Octicons } from '@expo/vector-icons';

import SearchListItem from '~/components/SearchListItem';
import { useAuth } from '~/contexts/AuthContext';
import { supabase } from '~/utils/supabase';
import { Tables } from '~/types/supabase';
import allProducts from '~/assets/products.json';

dayjs.extend(relativeTime);

// Development mode: Use local JSON data for testing
const DEV_MODE_SKIP_DB = false; // Set to false to use actual database

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
  const [history, setHistory] = useState<Tables<'searches'>[]>([]);
  const [displayedProducts, setDisplayedProducts] = useState<Product[]>([]);
  const [currentSearch, setCurrentSearch] = useState<Tables<'searches'> | null>(null);
  const [isCreatingSearch, setIsCreatingSearch] = useState(false);
  const { user } = useAuth();
  
  // Helper function to enrich product with rating from JSON if available
  const enrichProductWithRating = (product: any): Product => {
    // If product already has rating, return as is
    if (product.rating) {
      return product as Product;
    }
    
    // Try to find rating from JSON file
    const jsonProduct = allProducts.find((p: Product) => p.asin === product.asin);
    if (jsonProduct) {
      return {
        ...product,
        rating: jsonProduct.rating || null,
        num_ratings: jsonProduct.num_ratings || null,
        brand: jsonProduct.brand || null,
      } as Product;
    }
    
    return {
      ...product,
      rating: null,
      num_ratings: null,
      brand: null,
    } as Product;
  };

  // Load all products on initial mount
  useEffect(() => {
    if (DEV_MODE_SKIP_DB) {
      setDisplayedProducts(allProducts.slice(0, 50));
    } else {
      // Load all products from database (no limit to get all products)
      supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (!error && data) {
            // Convert database products to display format and enrich with ratings
            const products = data.map(p => enrichProductWithRating({
              asin: p.asin,
              name: p.name,
              image: p.image || null,
              url: p.url || null,
              final_price: p.final_price,
              currency: p.currency || 'USD',
            }));
            setDisplayedProducts(products);
            console.log(`✅ Loaded ${products.length} products from remote database`);
          } else {
            console.error('Error fetching products:', error);
            // Fallback to JSON
            setDisplayedProducts(allProducts.slice(0, 50));
          }
        });
    }
  }, []);

  const fetchHistory = useCallback(() => {
    if (DEV_MODE_SKIP_DB) {
      // In dev mode, skip database calls
      setHistory([]);
      return;
    }

    if (!user) {
      return;
    }

    if (!user.id) return;
    
    supabase
      .from('searches')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (error) {
          console.log('Error fetching history:', error.message);
          return;
        }
        setHistory(data || []);
      });
  }, [user]);

  useEffect(() => {
    if (DEV_MODE_SKIP_DB) {
      // Skip database calls in dev mode
      return;
    }
    
    if (user?.id) {
      fetchHistory();
    }
  }, [user?.id, fetchHistory]);

  // Create or find search when user types
  const createOrFindSearch = useCallback(async (query: string) => {
    if (!user || !query.trim() || DEV_MODE_SKIP_DB) {
      return;
    }

    setIsCreatingSearch(true);
    
    try {
      // Check if search already exists
      const { data: existingSearch } = await supabase
        .from('searches')
        .select('*')
        .eq('user_id', user.id)
        .eq('query', query.trim())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingSearch) {
        setCurrentSearch(existingSearch);
        // Link products to this search
        await linkProductsToSearch(existingSearch.id, query.trim());
      } else {
        // Create new search
        const { data: newSearch, error } = await supabase
          .from('searches')
          .insert({
            query: query.trim(),
            status: 'Done',
            user_id: user.id,
            is_tracked: false,
          })
          .select()
          .single();

        if (!error && newSearch) {
          setCurrentSearch(newSearch);
          // Link products to this search
          await linkProductsToSearch(newSearch.id, query.trim());
        }
      }
    } catch (error) {
      console.error('Error creating search:', error);
    } finally {
      setIsCreatingSearch(false);
    }
  }, [user]);

  // Link products to search
  const linkProductsToSearch = async (searchId: string, query: string) => {
    if (!user || DEV_MODE_SKIP_DB) return;

    // Get products matching the query
    const filtered = filterProducts(allProducts, query);
    const productAsins = filtered.map(p => p.asin).filter(Boolean);

    if (productAsins.length === 0) return;

    // Link products to search
    const links = productAsins.map(asin => ({
      asin,
      search_id: searchId,
    }));

    await supabase
      .from('product_search')
      .upsert(links, {
        onConflict: 'asin,search_id',
        ignoreDuplicates: true,
      });
  };

  // Toggle search tracking
  const toggleSearchTracking = async () => {
    if (!currentSearch || !user || DEV_MODE_SKIP_DB) return;

    const { data, error } = await supabase
      .from('searches')
      .update({ is_tracked: !currentSearch.is_tracked })
      .eq('id', currentSearch.id)
      .select()
      .single();

    if (!error && data) {
      setCurrentSearch(data);
      fetchHistory();
      // Refresh tracked products to update bell icons on products
      fetchTrackedProducts();
    }
  };

  // Track product - creates a search for a single product or tracks existing search
  const trackProduct = async (product: Product, e?: any) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    if (!user || DEV_MODE_SKIP_DB) return;

    try {
      // Optimistically update UI first for instant feedback
      const wasTracked = isProductTracked(product);
      setTrackedProductSearches(prev => {
        const newMap = new Map(prev);
        if (wasTracked) {
          newMap.delete(product.asin);
        } else {
          newMap.set(product.asin, true);
        }
        return newMap;
      });

      // Create a search query from product name (first few words)
      const productNameWords = product.name?.split(' ').slice(0, 3).join(' ') || product.asin;
      
      // Check if search already exists for this product
      const { data: existingSearch, error: searchError } = await supabase
        .from('searches')
        .select('*')
        .eq('user_id', user.id)
        .ilike('query', `%${productNameWords}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let searchToTrack = existingSearch;

      if (!existingSearch || searchError) {
        // Create new search
        const { data: newSearch, error } = await supabase
          .from('searches')
          .insert({
            query: productNameWords,
            status: 'Done',
            user_id: user.id,
            is_tracked: true, // Auto-track when created from product card
          })
          .select()
          .single();

        if (!error && newSearch) {
          searchToTrack = newSearch;
          
          // Link this product to the search
          const { error: linkError } = await supabase
            .from('product_search')
            .upsert({
              asin: product.asin,
              search_id: newSearch.id,
            }, {
              onConflict: 'asin,search_id',
              ignoreDuplicates: true,
            });
          
          if (linkError) {
            console.error('Error linking product to search:', linkError);
            // Revert optimistic update on error
            setTrackedProductSearches(prev => {
              const newMap = new Map(prev);
              newMap.delete(product.asin);
              return newMap;
            });
            return;
          }
          
          // Verify the link was created by querying it
          const { data: linkData } = await supabase
            .from('product_search')
            .select('asin')
            .eq('asin', product.asin)
            .eq('search_id', newSearch.id)
            .single();
          
          if (linkData) {
            // Manually add to tracked products map since we verified the link exists
            console.log('✅ Product link verified, updating tracked products map for:', product.asin);
            setManualUpdateInProgress(prev => {
              const newSet = new Set(prev);
              newSet.add(product.asin);
              console.log('Manual update in progress set:', Array.from(newSet));
              return newSet;
            });
            setTrackedProductSearches(prev => {
              const newMap = new Map(prev);
              newMap.set(product.asin, true);
              console.log('Updated tracked products map:', Array.from(newMap.keys()));
              return newMap;
            });
            
            // Clear the flag after a delay to allow real-time updates to work normally
            setTimeout(() => {
              setManualUpdateInProgress(prev => {
                const newSet = new Set(prev);
                newSet.delete(product.asin);
                console.log('Cleared manual update flag for:', product.asin);
                return newSet;
              });
            }, 2000);
          } else {
            console.warn('Product link not found after creation, retrying...');
            // Retry after a short delay
            setTimeout(async () => {
              const { data: retryLink } = await supabase
                .from('product_search')
                .select('asin')
                .eq('asin', product.asin)
                .eq('search_id', newSearch.id)
                .single();
              
              if (retryLink) {
                setTrackedProductSearches(prev => {
                  const newMap = new Map(prev);
                  newMap.set(product.asin, true);
                  return newMap;
                });
              }
            }, 500);
          }
        }
      } else {
        // Toggle tracking on existing search
        const { data, error } = await supabase
          .from('searches')
          .update({ is_tracked: !existingSearch.is_tracked })
          .eq('id', existingSearch.id)
          .select()
          .single();

        if (!error && data) {
          searchToTrack = data;
          
          // CRITICAL: Always ensure product is linked to this search when tracking
          // This ensures the product appears in tracked products even if link didn't exist before
          if (data.is_tracked) {
            const { error: linkError } = await supabase
              .from('product_search')
              .upsert({
                asin: product.asin,
                search_id: existingSearch.id,
              }, {
                onConflict: 'asin,search_id',
                ignoreDuplicates: true,
              });
            
            if (linkError) {
              console.error('Error linking product to search:', linkError);
              // Revert optimistic update on error
              setTrackedProductSearches(prev => {
                const newMap = new Map(prev);
                if (wasTracked) {
                  newMap.set(product.asin, true);
                } else {
                  newMap.delete(product.asin);
                }
                return newMap;
              });
              return;
            }
            
            // Verify the link was created by querying it
            const { data: linkData } = await supabase
              .from('product_search')
              .select('asin')
              .eq('asin', product.asin)
              .eq('search_id', existingSearch.id)
              .single();
            
            if (linkData) {
              // Manually add to tracked products map since we verified the link exists
              console.log('✅ Product link verified, updating tracked products map for:', product.asin);
              setManualUpdateInProgress(prev => {
                const newSet = new Set(prev);
                newSet.add(product.asin);
                console.log('Manual update in progress set:', Array.from(newSet));
                return newSet;
              });
              setTrackedProductSearches(prev => {
                const newMap = new Map(prev);
                newMap.set(product.asin, true);
                console.log('Updated tracked products map:', Array.from(newMap.keys()));
                return newMap;
              });
              
              // Clear the flag after a delay to allow real-time updates to work normally
              setTimeout(() => {
                setManualUpdateInProgress(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(product.asin);
                  console.log('Cleared manual update flag for:', product.asin);
                  return newSet;
                });
              }, 2000);
            } else {
              console.warn('Product link not found after creation, retrying...');
              // Retry after a short delay
              setTimeout(async () => {
                const { data: retryLink } = await supabase
                  .from('product_search')
                  .select('asin')
                  .eq('asin', product.asin)
                  .eq('search_id', existingSearch.id)
                  .single();
                
                if (retryLink) {
                  setTrackedProductSearches(prev => {
                    const newMap = new Map(prev);
                    newMap.set(product.asin, true);
                    return newMap;
                  });
                }
              }, 500);
            }
          } else {
            // If untracking, remove from map (fetchTrackedProducts will also handle this)
            setTrackedProductSearches(prev => {
              const newMap = new Map(prev);
              newMap.delete(product.asin);
              return newMap;
            });
          }
        } else {
          // Revert optimistic update on error
          setTrackedProductSearches(prev => {
            const newMap = new Map(prev);
            if (wasTracked) {
              newMap.set(product.asin, true);
            } else {
              newMap.delete(product.asin);
            }
            return newMap;
          });
        }
      }

      if (searchToTrack) {
        // Immediately refresh history to show the new search in recent searches
        fetchHistory();
        // Update current search if it matches
        if (currentSearch?.id === searchToTrack.id) {
          setCurrentSearch(searchToTrack);
        }
        // Refresh tracked products to ensure UI is in sync
        // Use a small delay to allow database to settle
        setTimeout(() => {
          fetchTrackedProducts(manualUpdateInProgress);
          // Also refresh history again to ensure it's up to date
          fetchHistory();
        }, 500);
      }
    } catch (error) {
      console.error('Error tracking product:', error);
      // Revert optimistic update on error
      const wasTracked = isProductTracked(product);
      setTrackedProductSearches(prev => {
        const newMap = new Map(prev);
        if (wasTracked) {
          newMap.set(product.asin, true);
        } else {
          newMap.delete(product.asin);
        }
        return newMap;
      });
    }
  };

  // Check if a product is in a tracked search
  const [trackedProductSearches, setTrackedProductSearches] = useState<Map<string, boolean>>(new Map());
  const [manualUpdateInProgress, setManualUpdateInProgress] = useState<Set<string>>(new Set());
  
  // Fetch which products are in tracked searches
  const fetchTrackedProducts = useCallback((skipProducts?: Set<string>) => {
    if (!user || DEV_MODE_SKIP_DB) return;

    console.log('🔄 fetchTrackedProducts called, skipProducts:', skipProducts ? Array.from(skipProducts) : 'none');

    // Get all tracked searches with their products
    supabase
      .from('searches')
      .select('id, is_tracked, product_search(asin)')
      .eq('user_id', user.id)
      .eq('is_tracked', true)
      .then(({ data, error }) => {
        if (!error && data) {
          setTrackedProductSearches(prev => {
            const productMap = new Map<string, boolean>();
            data.forEach(search => {
              if (search.product_search && Array.isArray(search.product_search)) {
                search.product_search.forEach((ps: any) => {
                  if (ps.asin) {
                    productMap.set(ps.asin, true);
                  }
                });
              }
            });
            
            // Preserve manual updates that are in progress
            if (skipProducts && skipProducts.size > 0) {
              console.log('🛡️ Preserving manual updates:', Array.from(skipProducts));
              skipProducts.forEach(asin => {
                if (prev.get(asin)) {
                  console.log('✅ Preserving:', asin);
                  productMap.set(asin, true);
                } else {
                  console.log('⚠️ Product not in prev map:', asin);
                }
              });
            }
            
            console.log('📊 Tracked products from DB:', Array.from(productMap.keys()));
            console.log('📊 Previous tracked products:', Array.from(prev.keys()));
            return productMap;
          });
        } else if (error) {
          console.error('❌ Error fetching tracked products:', error);
        }
      });
  }, [user]);

  useEffect(() => {
    fetchTrackedProducts();
  }, [user, fetchTrackedProducts]);

  // Also refresh when history changes (searches added/removed)
  useEffect(() => {
    if (!DEV_MODE_SKIP_DB) {
      fetchTrackedProducts();
    }
  }, [history, fetchTrackedProducts]);

  // Real-time subscription for search tracking changes
  useEffect(() => {
    if (!user || DEV_MODE_SKIP_DB) return;

    const subscription = supabase
      .channel('search-tracking-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'searches',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Search tracking changed:', payload.new);
          // Refresh tracked products when any search's is_tracked changes
          // Skip products that are being manually updated to prevent race conditions
          fetchTrackedProducts(manualUpdateInProgress);
          // Also refresh history to update the recent searches list
          fetchHistory();
          // Update current search if it's the one that changed
          if (currentSearch?.id === payload.new.id) {
            setCurrentSearch(payload.new as Tables<'searches'>);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'searches',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('New search created:', payload.new);
          // Refresh tracked products when a new tracked search is created
          // Skip products that are being manually updated to prevent race conditions
          fetchTrackedProducts(manualUpdateInProgress);
          fetchHistory();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, currentSearch, fetchTrackedProducts, fetchHistory, manualUpdateInProgress]);

  const isProductTracked = (product: Product): boolean => {
    if (DEV_MODE_SKIP_DB || !product?.asin) return false;
    return trackedProductSearches.get(product.asin) || false;
  };

  // Real-time filtering when search text changes
  useEffect(() => {
    if (!search.trim()) {
      // Show all products when search is empty
      if (DEV_MODE_SKIP_DB) {
        setDisplayedProducts(allProducts.slice(0, 50));
      } else {
        // Load all products from database (no limit)
        supabase
          .from('products')
          .select('*')
          .order('created_at', { ascending: false })
          .then(({ data }) => {
            if (data) {
              const products = data.map(p => enrichProductWithRating({
                asin: p.asin,
                name: p.name,
                image: p.image || null,
                url: p.url || null,
                final_price: p.final_price,
                currency: p.currency || 'USD',
              }));
              setDisplayedProducts(products);
            }
          });
      }
      setCurrentSearch(null);
    } else {
      // Filter products based on search query
      const filtered = filterProducts(allProducts, search.trim());
      
      // If using database, enrich filtered products with ratings
      if (!DEV_MODE_SKIP_DB) {
        const enriched = filtered.map(p => enrichProductWithRating(p));
        setDisplayedProducts(enriched);
        createOrFindSearch(search.trim());
      } else {
        setDisplayedProducts(filtered);
      }
    }
  }, [search, createOrFindSearch]);

  if (!user) {
    return null;
  }

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
        
        {/* Recent Searches */}
        {!DEV_MODE_SKIP_DB && history.length > 0 && !search.trim() && (
          <View className="mt-4">
            <Text className="mb-2 text-sm font-semibold text-gray-700">Recent Searches</Text>
            <FlatList
              horizontal
              data={history.slice(0, 5)}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setSearch(item.query);
                    setCurrentSearch(item);
                  }}
                  className="mr-2 rounded-full bg-gray-100 px-4 py-2">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm text-gray-700">{item.query}</Text>
                    {item.is_tracked && (
                      <Octicons name="bell-fill" size={14} color="#0d9488" />
                    )}
                  </View>
                </Pressable>
              )}
            />
          </View>
        )}
      </View>

      {/* Products Section */}
      <View className="mt-4 flex-1 px-6">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-lg font-bold text-gray-900">
            {search.trim() ? `Results for "${search}"` : 'All Products'}
          </Text>
          <View className="flex-row items-center gap-3">
            {search.trim() && currentSearch && !DEV_MODE_SKIP_DB && (
              <Pressable
                onPress={toggleSearchTracking}
                className="p-2">
                <Octicons
                  name={currentSearch.is_tracked ? 'bell-fill' : 'bell'}
                  size={22}
                  color={currentSearch.is_tracked ? '#0d9488' : '#6b7280'}
                />
              </Pressable>
            )}
            {isCreatingSearch && (
              <ActivityIndicator size="small" color="#0d9488" />
            )}
            <Text className="text-sm text-gray-500">
              {displayedProducts.length} products
            </Text>
          </View>
        </View>
        
        {search.trim() && currentSearch && !DEV_MODE_SKIP_DB && (
          <View className="mb-3 rounded-lg bg-teal-50 border border-teal-200 p-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-sm font-semibold text-teal-900">
                  {currentSearch.is_tracked ? '🔔 Tracking this search' : 'Tap bell to track price drops'}
                </Text>
                <Text className="text-xs text-teal-700 mt-1">
                  {currentSearch.is_tracked 
                    ? 'You\'ll get alerts when prices drop for these products'
                    : 'Enable tracking to receive price drop notifications'}
                </Text>
              </View>
            </View>
          </View>
        )}
        
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
              <View className="flex-row gap-4 rounded-lg bg-white p-4 shadow-sm">
                <Pressable 
                  onPress={() => router.push(`/product/${item.asin}`)}
                  className="flex-1 flex-row gap-4 active:opacity-70">
                  {item?.image && (
                    <Image 
                      source={{ uri: item.image }} 
                      className="h-24 w-24 rounded-md bg-gray-100 flex-shrink-0" 
                      resizeMode="contain"
                    />
                  )}
                  <View className="flex-1 justify-between">
                    <Text 
                      className="text-sm text-gray-900 mb-2" 
                      numberOfLines={3}
                      style={{ lineHeight: 20, minHeight: 60 }}>
                      {item?.name || 'Product'}
                    </Text>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-lg font-bold text-teal-600">
                        {`$${String(item?.final_price ?? 'N/A')}`}
                      </Text>
                      <View style={{ minWidth: 80, alignItems: 'flex-end' }}>
                        {item?.rating && item.rating > 0 ? (
                          <Text className="text-xs text-gray-500">
                            ⭐ {Number(item.rating).toFixed(1)} ({item.num_ratings || 0})
                          </Text>
                        ) : (
                          <Text className="text-xs text-gray-400">
                            ⭐ N/A
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                </Pressable>
                {!DEV_MODE_SKIP_DB && user && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      trackProduct(item, e);
                    }}
                    className="items-center justify-center"
                    style={{ alignSelf: 'flex-start', paddingTop: 4 }}>
                    <Octicons
                      name={isProductTracked(item) ? 'bell-fill' : 'bell'}
                      size={22}
                      color={isProductTracked(item) ? '#0d9488' : '#6b7280'}
                    />
                  </Pressable>
                )}
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}