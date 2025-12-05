// Supabase Edge Function: simulate-price-updates
// Simulates price changes for existing products without needing BrightData API
// This creates price snapshots to enable price tracking and alerts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

console.log("simulate-price-updates function loaded");

/**
 * Simulates realistic price changes for products
 * Prices fluctuate randomly within ±15% of original price
 */
const simulatePriceChange = (originalPrice: number): number => {
  // Random change between -15% and +15%
  const changePercent = (Math.random() * 30 - 15) / 100;
  const newPrice = originalPrice * (1 + changePercent);
  
  // Round to 2 decimal places
  return Math.round(newPrice * 100) / 100;
};

Deno.serve(async (req) => {
  try {
    // Create Supabase client with service role for elevated permissions
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Get all products that have a price
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("asin, final_price, name")
      .not("final_price", "is", null)
      .limit(100); // Process up to 100 products at a time

    if (productsError) {
      console.error("Error fetching products:", productsError);
      throw productsError;
    }

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ message: "No products with prices found" }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    console.log(`Processing ${products.length} products for price simulation`);

    // Create price snapshots for each product
    const snapshots = products.map((product) => {
      const originalPrice = product.final_price as number;
      const newPrice = simulatePriceChange(originalPrice);
      
      return {
        asin: product.asin,
        final_price: newPrice,
      };
    });

    // Insert snapshots
    const { error: snapshotsError } = await supabase
      .from("product_snapshot")
      .insert(snapshots);

    if (snapshotsError) {
      console.error("Error inserting snapshots:", snapshotsError);
      throw snapshotsError;
    }

    // Update product prices to latest snapshot
    for (const snapshot of snapshots) {
      await supabase
        .from("products")
        .update({ 
          final_price: snapshot.final_price,
          updated_at: new Date().toISOString()
        })
        .eq("asin", snapshot.asin);
    }

    console.log(`Successfully created ${snapshots.length} price snapshots`);

    // Check for price drops in tracked searches
    const { data: trackedSearches } = await supabase
      .from("searches")
      .select("id")
      .eq("is_tracked", true)
      .eq("status", "Done");

    if (trackedSearches && trackedSearches.length > 0) {
      console.log(`Checking price drops for ${trackedSearches.length} tracked searches`);
      
      // Trigger price drop checks for each tracked search
      // Use Promise.allSettled to run all checks in parallel
      const checkPromises = trackedSearches.map(async (search) => {
        try {
          const response = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/check-search-price-drops`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
              },
              body: JSON.stringify({ record: { id: search.id, status: "Done" } }),
            }
          );
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Error checking price drops for search ${search.id}:`, errorText);
          } else {
            const result = await response.json();
            console.log(`Price drop check completed for search ${search.id}:`, result);
          }
        } catch (error) {
          console.error(`Error checking price drops for search ${search.id}:`, error);
        }
      });

      await Promise.allSettled(checkPromises);
    }

    return new Response(
      JSON.stringify({
        message: "Price simulation completed",
        productsProcessed: products.length,
        snapshotsCreated: snapshots.length,
        trackedSearchesChecked: trackedSearches?.length || 0,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in simulate-price-updates function:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "An unknown error occurred",
        details: error.toString(),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});

/* To invoke locally:

  1. Run `supabase start`

  2. Run `supabase functions serve simulate-price-updates --env-file supabase/.env.local`

  3. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/simulate-price-updates' \
    --header 'Authorization: Bearer YOUR_ANON_KEY' \
    --header 'Content-Type: application/json'

*/

