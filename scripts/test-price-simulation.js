#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

try {
  require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

async function testSimulation() {
  try {
    console.log('🔄 Triggering price simulation...');
    const response = await fetch(`${supabaseUrl}/functions/v1/simulate-price-updates`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
    });

    const text = await response.text();
    console.log('Response status:', response.status);
    console.log('Response:', text);
    
    if (response.ok) {
      const data = JSON.parse(text);
      console.log('\n✅ Success:', JSON.stringify(data, null, 2));
    } else {
      console.error('❌ Error:', text);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testSimulation();



