// Supabase Edge Function: seed-products-from-json
// Seeds products from the local products.json file into the database
// This allows you to use existing products without BrightData API

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

console.log("seed-products-from-json function loaded");

Deno.serve(async (req) => {
  try {
    const { products, searchId } = await req.json();

    if (!products || !Array.isArray(products)) {
      return new Response(
        JSON.stringify({ error: "Invalid request: products array required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Create Supabase client with service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const updated_at = new Date().toISOString();

    // Transform products for insertion
    const productsToInsert = products
      .filter((p: any) => p.asin && p.name) // Only include products with asin and name
      .map((p: any) => ({
        asin: p.asin,
        updated_at,
        name: p.name,
        image: p.image || null,
        url: p.url || null,
        final_price: p.final_price ? parseFloat(p.final_price) : null,
        currency: p.currency || "USD",
      }));

    console.log(`Preparing to insert ${productsToInsert.length} products`);

    // Upsert products
    const { error: productsError } = await supabase
      .from("products")
      .upsert(productsToInsert, {
        onConflict: "asin",
      });

    if (productsError) {
      console.error("Error upserting products:", productsError);
      throw productsError;
    }

    console.log(`Successfully upserted ${productsToInsert.length} products`);

    // Create product snapshots for initial price tracking
    const productSnapshots = productsToInsert
      .filter((p: any) => p.final_price !== null)
      .map((p: any) => ({
        asin: p.asin,
        final_price: p.final_price,
      }));

    if (productSnapshots.length > 0) {
      const { error: snapshotsError } = await supabase
        .from("product_snapshot")
        .insert(productSnapshots);

      if (snapshotsError) {
        console.error("Error inserting snapshots:", snapshotsError);
        // Don't throw - snapshot errors shouldn't fail the entire operation
      } else {
        console.log(`Successfully created ${productSnapshots.length} initial price snapshots`);
      }
    }

    // Link products to search if searchId provided
    if (searchId) {
      const productSearchLinks = productsToInsert.map((p: any) => ({
        asin: p.asin,
        search_id: searchId,
      }));

      const { error: productSearchError } = await supabase
        .from("product_search")
        .upsert(productSearchLinks, {
          onConflict: "asin,search_id",
          ignoreDuplicates: true,
        });

      if (productSearchError) {
        console.error("Error creating product_search links:", productSearchError);
        // Don't throw - linking errors shouldn't fail the operation
      } else {
        console.log(`Successfully linked ${productSearchLinks.length} products to search`);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Products seeded successfully",
        productsInserted: productsToInsert.length,
        snapshotsCreated: productSnapshots.length,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in seed-products-from-json function:", error);
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

  2. Run `supabase functions serve seed-products-from-json --env-file supabase/.env.local`

  3. Make an HTTP request with products from your JSON file:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/seed-products-from-json' \
    --header 'Authorization: Bearer YOUR_ANON_KEY' \
    --header 'Content-Type: application/json' \
    --data '{
      "products": [
        {
          "asin": "B084H9P6NN",
          "name": "Saints Row IV - Nintendo Switch",
          "final_price": 25.94,
          "currency": "USD",
          "image": "https://example.com/image.jpg",
          "url": "https://www.amazon.com/dp/B084H9P6NN"
        }
      ],
      "searchId": "optional-search-id"
    }'

*/



