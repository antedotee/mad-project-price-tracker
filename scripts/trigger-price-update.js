#!/usr/bin/env node

/**
 * Script to manually trigger price updates for testing real-time functionality
 * Usage: node scripts/trigger-price-update.js
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Try to load environment variables (same pattern as other scripts)
try {
  // Try .env.local first, then .env
  require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {
  // dotenv not installed or file not found, use process.env directly
  console.warn('⚠️  Could not load .env.local, using process.env');
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Supabase URL and Anon Key must be set in .env.local');
  console.error('   Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function triggerPriceUpdate() {
  try {
    console.log('🔄 Triggering price update simulation...');
    console.log(`   Supabase URL: ${supabaseUrl}`);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/simulate-price-updates`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Price update triggered successfully!');
    console.log('   Result:', JSON.stringify(result, null, 2));
    
    // Wait a moment and check for new snapshots
    console.log('\n⏳ Waiting 2 seconds for snapshots to be created...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check recent snapshots
    const { data: snapshots, error: snapshotError } = await supabase
      .from('product_snapshot')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (!snapshotError && snapshots && snapshots.length > 0) {
      console.log('\n📊 Recent price snapshots:');
      snapshots.forEach((snapshot, index) => {
        console.log(`   ${index + 1}. ASIN: ${snapshot.asin}, Price: $${snapshot.final_price}, Time: ${new Date(snapshot.created_at).toLocaleString()}`);
      });
    } else {
      console.log('\n⚠️  No snapshots found (this might be normal if no products exist)');
    }
    
    console.log('\n💡 Tip: Open a product detail page to see real-time updates!');
    console.log('   The price history should update automatically via real-time subscriptions.');
    
  } catch (error) {
    console.error('❌ Error triggering price update:', error.message);
    process.exit(1);
  }
}

triggerPriceUpdate();

