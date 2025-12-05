#!/usr/bin/env node

/**
 * Script to sync all products from remote Supabase database to local products.json
 * 
 * Usage: 
 *   node scripts/sync-remote-to-local.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Try to load environment variables (optional)
try {
  // Try .env.local first, then .env
  require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {
  // dotenv not installed, use process.env directly
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Supabase URL and Anon Key must be set');
  console.error('   Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Path to products.json
const productsPath = path.join(__dirname, '../assets/products.json');

async function syncRemoteToLocal() {
  try {
    console.log('📥 Fetching all products from remote database...');
    console.log(`   Supabase URL: ${supabaseUrl}`);

    // Fetch all products from database (Supabase has a default limit of 1000, but we'll paginate)
    let allProducts = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error, count } = await supabase
        .from('products')
        .select('*', { count: 'exact' })
        .range(page * pageSize, (page + 1) * pageSize - 1)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        allProducts = allProducts.concat(data);
        console.log(`   Fetched page ${page + 1}: ${data.length} products (total: ${allProducts.length})`);
        
        // Check if there are more products
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    console.log(`\n✅ Fetched ${allProducts.length} products from remote database`);

    // Transform database products to match local JSON format
    const transformedProducts = allProducts.map(p => ({
      asin: p.asin,
      url: p.url || null,
      name: p.name || null,
      sponsored: 'false',
      initial_price: 0,
      final_price: p.final_price || 0,
      currency: p.currency || 'USD',
      sold: 0,
      rating: null,
      num_ratings: null,
      variations: null,
      badge: null,
      business_type: null,
      brand: null,
      delivery: null,
      keyword: null,
      image: p.image || null,
      domain: 'https://www.amazon.com/',
      bought_past_month: 0,
      page_number: null,
      rank_on_page: null,
      pages_to_search: null,
      is_prime: false,
      is_subscribe_and_save: false,
      is_coupon: false,
      sponsored_video: null,
      is_banner_product: false,
      is_amazon_fresh: false,
    }));

    // Read existing products.json to preserve ratings and other metadata
    let existingProducts = [];
    try {
      const existingData = fs.readFileSync(productsPath, 'utf8');
      existingProducts = JSON.parse(existingData);
      console.log(`\n📖 Found ${existingProducts.length} products in local JSON`);
    } catch (e) {
      console.log('⚠️  Could not read existing products.json, creating new file');
    }

    // Create a map of existing products by ASIN for metadata preservation
    const existingProductsMap = new Map();
    existingProducts.forEach(p => {
      if (p.asin) {
        existingProductsMap.set(p.asin, p);
      }
    });

    // Merge remote products with existing metadata (ratings, num_ratings, brand, etc.)
    const mergedProducts = transformedProducts.map(remoteProduct => {
      const existingProduct = existingProductsMap.get(remoteProduct.asin);
      if (existingProduct) {
        // Preserve metadata from existing product
        return {
          ...remoteProduct,
          rating: existingProduct.rating || null,
          num_ratings: existingProduct.num_ratings || null,
          brand: existingProduct.brand || null,
          keyword: existingProduct.keyword || null,
          // Update with remote data
          name: remoteProduct.name || existingProduct.name,
          image: remoteProduct.image || existingProduct.image,
          url: remoteProduct.url || existingProduct.url,
          final_price: remoteProduct.final_price || existingProduct.final_price,
          currency: remoteProduct.currency || existingProduct.currency,
        };
      }
      return remoteProduct;
    });

    // Write to products.json
    console.log(`\n💾 Writing ${mergedProducts.length} products to local products.json...`);
    fs.writeFileSync(productsPath, JSON.stringify(mergedProducts, null, 2), 'utf8');

    console.log(`\n✅ Successfully synced ${mergedProducts.length} products from remote to local!`);
    console.log(`   File saved to: ${productsPath}`);

  } catch (error) {
    console.error('❌ Error syncing products:', error.message);
    console.error(error);
    process.exit(1);
  }
}

syncRemoteToLocal();

