// Supabase Edge Function: scrape-complete
// Webhook endpoint called by BrightData when scraping is complete
// Saves scraped products to the database

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

console.log("scrape-complete function loaded");

Deno.serve(async (req) => {
  try {
    // Extract search_id from URL query parameter
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return new Response(
        JSON.stringify({ error: "Missing search ID in query parameter" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    console.log(`Processing scrape completion for search_id: ${id}`);

    // Parse the scraped products from BrightData
    const reqJson = await req.json();
    console.log(`Received ${reqJson.length} products from BrightData`);

    // Create Supabase client with service role for elevated permissions
    // We need service role to bypass RLS policies
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        global: {
          headers: {
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
        },
      },
    );

    const updated_at = new Date().toISOString();

    // Transform and prepare products for insertion
    const products = reqJson
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

    console.log(`Filtered to ${products.length} valid products`);

    if (products.length === 0) {
      console.warn("No valid products to insert");
      // Still update search status to Done even if no products
      await supabase
        .from("searches")
        .update({
          status: "Done",
          last_scraped_at: updated_at,
        })
        .eq("id", id);

      return new Response(
        JSON.stringify({
          message: "No valid products found, but search marked as complete",
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Upsert products (insert or update if exists)
    const { error: productsError } = await supabase
      .from("products")
      .upsert(products, {
        onConflict: "asin", // Update existing products based on asin
      });

    if (productsError) {
      console.error("Error upserting products:", productsError);
      throw productsError;
    }

    console.log(`Successfully upserted ${products.length} products`);

    // Create links between products and this search
    const productSearchLinks = products.map((p) => ({
      asin: p.asin,
      search_id: id,
    }));

    // Upsert product_search links (might create duplicates if run multiple times)
    const { error: product_searchError } = await supabase
      .from("product_search")
      .upsert(productSearchLinks, {
        onConflict: "asin,search_id", // Avoid duplicates
        ignoreDuplicates: true,
      });

    if (product_searchError) {
      console.error("Error creating product_search links:", product_searchError);
      throw product_searchError;
    }

    console.log(`Successfully linked ${productSearchLinks.length} products to search`);

    // Update search status to Done
    const { error: searchesError } = await supabase
      .from("searches")
      .update({
        status: "Done",
        last_scraped_at: updated_at,
      })
      .eq("id", id);

    if (searchesError) {
      console.error("Error updating search status:", searchesError);
      throw searchesError;
    }

    console.log(`Successfully marked search ${id} as Done`);

    const response = {
      message: "Scrape completed successfully",
      products_saved: products.length,
      search_id: id,
    };

    return new Response(JSON.stringify(response), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in scrape-complete function:", error);
    
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

/* To invoke locally for testing:

  1. Run `supabase start`

  2. Run `supabase functions serve scrape-complete --env-file supabase/.env.local`

  3. Make an HTTP request with sample data:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/scrape-complete?id=YOUR_SEARCH_ID' \
    --header 'Authorization: Bearer YOUR_ANON_KEY' \
    --header 'Content-Type: application/json' \
    --data '[
      {
        "asin": "B08N5WRWNW",
        "name": "Apple iPhone 12",
        "image": "https://example.com/image.jpg",
        "url": "https://www.amazon.com/dp/B08N5WRWNW",
        "final_price": 699.99,
        "currency": "USD"
      }
    ]'

*/

