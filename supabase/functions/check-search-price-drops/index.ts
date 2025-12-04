import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const { record } = await req.json();

    if (record.status !== "Done") {
      return new Response(JSON.stringify({}), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Initialize client with service role for elevated permissions
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const getProductLastPrices = async (product: any) => {
      const { data, error } = await supabase
        .from("product_snapshot")
        .select("*")
        .eq("asin", product.asin)
        .order("created_at", { ascending: false })
        .limit(2);

      if (error) {
        console.error(`Error fetching snapshots for ${product.asin}:`, error);
      }

      return {
        ...product,
        snapshots: data || [],
      };
    };

    // Check price drops
    const { data: productSearch, error: productSearchError } = await supabase
      .from("product_search")
      .select("*, products(*)")
      .eq("search_id", record.id);

    if (productSearchError) {
      console.error("Error fetching product_search:", productSearchError);
      return new Response(
        JSON.stringify({ error: productSearchError.message }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (!productSearch || productSearch.length === 0) {
      return new Response(JSON.stringify({ message: "No products found" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const products = await Promise.all(
      productSearch.map((ps: any) => getProductLastPrices(ps.products)),
    );

    const priceDrops = products.filter(
      (product: any) =>
        product.snapshots.length === 2 &&
        product.snapshots[0].final_price < product.snapshots[1].final_price,
    );

    if (priceDrops.length > 0) {
      // Notify the user
      const message = `
        There are ${priceDrops.length} price drops in your search!

        ${
        priceDrops.map(
          (product: any) => `
          ${product.name}
          ${product.url}
          From $${product.snapshots[1].final_price} dropped to ${
            product.snapshots[0].final_price
          }
          __________
        `,
        ).join("")
      }
      `;

      console.log(message);
      
      // TODO: Add notification logic here (push notifications, email, etc.)
    }

    return new Response(
      JSON.stringify({
        message: "Price check completed",
        priceDropsCount: priceDrops.length,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in check-search-price-drops function:", error);
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

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)

  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/check-search-price-drops' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"record": {"id": "YOUR_SEARCH_ID", "status": "Done"}}'

*/

