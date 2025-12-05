#!/usr/bin/env node

/**
 * Test script to create a search, link products, enable tracking, and generate price alerts
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

try {
  require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPriceAlerts() {
  console.log('🧪 Testing Price Alert System...\n');

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (!user) {
    console.log('⚠️  No authenticated user found.');
    console.log('   Please log in to your app first, or manually set user_id in the script.');
    console.log('   For testing, you can create a search manually in the app.');
    return;
  }
  
  console.log(`✅ Using user: ${user.id}`);

  // Get some products
  const { data: products } = await supabase
    .from('products')
    .select('asin')
    .limit(10);

  if (!products || products.length === 0) {
    console.error('❌ No products found. Please seed products first.');
    return;
  }

  console.log(`✅ Found ${products.length} products`);

  // Create a test search
  const { data: search, error: searchError } = await supabase
    .from('searches')
    .insert({
      query: 'test products',
      status: 'Done',
      is_tracked: true,
      user_id: user.id,
    })
    .select()
    .single();

  if (searchError) {
    console.error('❌ Error creating search:', searchError.message);
    return;
  }

  console.log(`✅ Created search: ${search.id}`);

  // Link products to search
  const productLinks = products.map(p => ({
    asin: p.asin,
    search_id: search.id,
  }));

  const { error: linkError } = await supabase
    .from('product_search')
    .upsert(productLinks, {
      onConflict: 'asin,search_id',
      ignoreDuplicates: true,
    });

  if (linkError) {
    console.error('❌ Error linking products:', linkError.message);
    return;
  }

  console.log(`✅ Linked ${products.length} products to search`);

  // Trigger price drop check
  console.log('\n🔄 Triggering price drop check...');
  const { data: checkResult, error: checkError } = await supabase.functions.invoke('check-search-price-drops', {
    body: { record: { id: search.id, status: 'Done' } },
  });

  if (checkError) {
    console.error('❌ Error checking price drops:', checkError.message);
    return;
  }

  console.log('✅ Price check completed:', checkResult);

  // Check for alerts
  const { data: alerts } = await supabase
    .from('price_drop_alerts')
    .select('*')
    .eq('search_id', search.id)
    .order('created_at', { ascending: false });

  if (alerts && alerts.length > 0) {
    console.log(`\n🎉 Found ${alerts.length} price drop alerts!`);
    alerts.forEach(alert => {
      console.log(`\n  Product: ${alert.product_name}`);
      console.log(`  Price: $${alert.old_price} → $${alert.new_price}`);
      console.log(`  Drop: $${alert.price_drop_amount} (${alert.price_drop_percent}%)`);
    });
  } else {
    console.log('\n⚠️  No price drops detected yet.');
    console.log('   This is normal if prices haven\'t changed.');
    console.log('   Try running price simulation first: node scripts/test-price-simulation.js');
  }

  console.log('\n✅ Test complete!');
  console.log(`\nView alerts in your app at: /search/${search.id}`);
}

testPriceAlerts();

