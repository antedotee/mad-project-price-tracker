#!/usr/bin/env node

/**
 * Script to seed products from products.json directly into Supabase database
 * This bypasses the need for BrightData API
 * 
 * Usage: 
 *   node scripts/seed-products-to-db.js [limit]
 * 
 * Example:
 *   node scripts/seed-products-to-db.js 50
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
  console.error('❌ Error: Supabase URL and Anon Key must be set in .env.local');
  console.error('   Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Read products.json
const productsPath = path.join(__dirname, '../assets/products.json');
const allProducts = JSON.parse(fs.readFileSync(productsPath, 'utf8'));

// Get limit from command line or default to 50
const limit = parseInt(process.argv[2]) || 50;
const productsToSeed = allProducts
  .filter(p => p.asin && p.name && p.final_price > 0)
  .slice(0, limit);

console.log(`📦 Seeding ${productsToSeed.length} products to database...`);
console.log(`   Supabase URL: ${supabaseUrl}`);

async function seedProducts() {
  try {
    const updated_at = new Date().toISOString();

    // Transform products for insertion
    const products = productsToSeed.map(p => ({
      asin: p.asin,
      updated_at,
      name: p.name,
      image: p.image || null,
      url: p.url || null,
      final_price: p.final_price ? parseFloat(p.final_price) : null,
      currency: p.currency || 'USD',
    }));

    // Upsert products
    console.log('   Inserting products...');
    const { error: productsError } = await supabase
      .from('products')
      .upsert(products, {
        onConflict: 'asin',
      });

    if (productsError) {
      throw productsError;
    }

    console.log(`✅ Successfully inserted ${products.length} products`);

    // Create initial price snapshots
    const snapshots = products
      .filter(p => p.final_price !== null)
      .map(p => ({
        asin: p.asin,
        final_price: p.final_price,
      }));

    if (snapshots.length > 0) {
      console.log('   Creating price snapshots...');
      const { error: snapshotsError } = await supabase
        .from('product_snapshot')
        .insert(snapshots);

      if (snapshotsError) {
        console.warn('⚠️  Warning: Could not create snapshots:', snapshotsError.message);
      } else {
        console.log(`✅ Created ${snapshots.length} initial price snapshots`);
      }
    }

    console.log('\n🎉 Seeding completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Create a search and link products to it');
    console.log('2. Enable price tracking: UPDATE searches SET is_tracked = true WHERE id = \'your-search-id\'');
    console.log('3. Trigger price simulation: See NO_BRIGHTDATA_SETUP.md');

  } catch (error) {
    console.error('❌ Error seeding products:', error.message);
    process.exit(1);
  }
}

seedProducts();

