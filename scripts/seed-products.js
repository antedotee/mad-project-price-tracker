#!/usr/bin/env node

/**
 * Script to seed products from products.json into Supabase database
 * This allows you to use existing products without BrightData API
 * 
 * Usage: node scripts/seed-products.js [searchId]
 */

const fs = require('fs');
const path = require('path');

// Read products.json
const productsPath = path.join(__dirname, '../assets/products.json');
const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));

// Get searchId from command line args (optional)
const searchId = process.argv[2] || null;

// Limit to first 50 products (or adjust as needed)
const productsToSeed = products.slice(0, 50);

console.log(`📦 Preparing to seed ${productsToSeed.length} products...`);

// This script outputs the data structure
// You can use it with Supabase Edge Function or directly insert via SQL
const productsData = productsToSeed.map(p => ({
  asin: p.asin,
  name: p.name,
  image: p.image || null,
  url: p.url || null,
  final_price: p.final_price || null,
  currency: p.currency || 'USD',
}));

console.log('\n✅ Products prepared for seeding:');
console.log(JSON.stringify({
  count: productsData.length,
  sample: productsData.slice(0, 3),
  searchId: searchId || 'none (products will be inserted without search link)'
}, null, 2));

console.log('\n📝 To seed these products:');
console.log('1. Use the seed-products-from-json Edge Function');
console.log('2. Or run SQL INSERT statements');
console.log('3. Or use Supabase Dashboard to import');

// Export for use in other scripts
module.exports = { productsData, searchId };



