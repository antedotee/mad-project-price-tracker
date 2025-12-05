#!/usr/bin/env node

/**
 * Verifies the setup is working correctly
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

async function verifySetup() {
  console.log('🔍 Verifying setup...\n');

  // Check products
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('asin, name, final_price')
    .limit(5);

  if (productsError) {
    console.error('❌ Error fetching products:', productsError.message);
    return;
  }

  console.log(`✅ Products in database: ${products?.length || 0} (showing first 5)`);
  products?.forEach(p => {
    console.log(`   - ${p.name.substring(0, 50)}... ($${p.final_price})`);
  });

  // Check snapshots
  const { data: snapshots, error: snapshotsError } = await supabase
    .from('product_snapshot')
    .select('asin, final_price, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (snapshotsError) {
    console.error('❌ Error fetching snapshots:', snapshotsError.message);
    return;
  }

  console.log(`\n✅ Price snapshots: ${snapshots?.length || 0} (showing latest 5)`);
  snapshots?.forEach(s => {
    const date = new Date(s.created_at).toLocaleString();
    console.log(`   - ASIN: ${s.asin}, Price: $${s.final_price}, Date: ${date}`);
  });

  // Count total snapshots
  const { count: totalSnapshots } = await supabase
    .from('product_snapshot')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📊 Total snapshots in database: ${totalSnapshots || 0}`);

  // Check if we have multiple snapshots per product (price history)
  const { data: productSnapshots } = await supabase
    .from('product_snapshot')
    .select('asin')
    .limit(100);

  if (productSnapshots) {
    const snapshotCounts = {};
    productSnapshots.forEach(s => {
      snapshotCounts[s.asin] = (snapshotCounts[s.asin] || 0) + 1;
    });
    
    const productsWithMultipleSnapshots = Object.values(snapshotCounts).filter(count => count > 1).length;
    console.log(`📈 Products with price history (multiple snapshots): ${productsWithMultipleSnapshots}`);
  }

  console.log('\n🎉 Setup verification complete!');
  console.log('\nNext steps:');
  console.log('1. Create a search in your app');
  console.log('2. Link products to the search');
  console.log('3. Enable tracking: Set is_tracked = true on the search');
  console.log('4. Run price simulation again to see price changes');
  console.log('5. Check price alerts when prices drop');
}

verifySetup();



