#!/usr/bin/env node

/**
 * Calls the seed-products-from-json Edge Function
 */

const fs = require('fs');
const path = require('path');

// Load env
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Supabase URL and Anon Key must be set');
  process.exit(1);
}

// Read products
const productsPath = path.join(__dirname, '../assets/products.json');
const allProducts = JSON.parse(fs.readFileSync(productsPath, 'utf8'));

const limit = parseInt(process.argv[2]) || 50;
const productsToSeed = allProducts
  .filter(p => p.asin && p.name && p.final_price > 0)
  .slice(0, limit)
  .map(p => ({
    asin: p.asin,
    name: p.name,
    final_price: p.final_price,
    currency: p.currency || 'USD',
    image: p.image || null,
    url: p.url || null,
  }));

console.log(`📦 Preparing to seed ${productsToSeed.length} products via Edge Function...`);

async function callSeedFunction() {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/seed-products-from-json`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ products: productsToSeed }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(JSON.stringify(data));
    }

    console.log('✅ Success:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

callSeedFunction();



