#!/usr/bin/env node

/**
 * Script to check how many products are in the remote database
 */

const { createClient } = require('@supabase/supabase-js');

// Try to load environment variables
try {
  require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });
  require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
} catch (e) {}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Supabase credentials not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProducts() {
  try {
    // Get total count
    const { count, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw countError;
    }

    console.log(`\n📊 Total products in database: ${count}`);

    // Get all products with details
    const { data, error } = await supabase
      .from('products')
      .select('asin, name, final_price, image, url')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    console.log(`\n📦 Products fetched: ${data?.length || 0}`);
    
    if (data && data.length > 0) {
      console.log('\n📋 Product list:');
      data.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.asin} - ${p.name?.substring(0, 50) || 'N/A'} - $${p.final_price || 'N/A'}`);
      });
    }

    // Check for products with missing data
    const productsWithMissingData = data?.filter(p => !p.name || !p.asin || p.final_price === null) || [];
    if (productsWithMissingData.length > 0) {
      console.log(`\n⚠️  Products with missing data: ${productsWithMissingData.length}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkProducts();

