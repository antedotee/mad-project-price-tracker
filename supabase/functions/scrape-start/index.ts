// Supabase Edge Function: scrape-start
// Triggers BrightData scraping for a given search query

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

console.log("scrape-start function loaded");

/**
 * Initiates a BrightData scraping job for the given keyword
 * @param keyword - The search term to scrape from Amazon
 * @param search_id - The unique ID of the search record
 * @returns The BrightData API response including snapshot_id
 */
const startScraping = async (keyword: string, search_id: string) => {
  const BRIGHT_DATA_API_KEY = Deno.env.get("BRIGHT_DATA_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

  if (!BRIGHT_DATA_API_KEY) {
    throw new Error("BRIGHT_DATA_API_KEY is not configured");
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase configuration is missing");
  }

  // BrightData configuration
  const searchParams = new URLSearchParams({
    dataset_id: "gd_lwdb4vjm1ehb499uxs", // Amazon Product dataset
    format: "json",
    uncompressed_webhook: "true",
    limit_multiple_results: "10", // Limit to 10 results per search
    // Webhook endpoint that BrightData will call when scraping is complete
    endpoint: `${SUPABASE_URL}/functions/v1/scrape-complete?id=${search_id}`,
    // Authorization header for the webhook callback
    auth_header: `Bearer ${SUPABASE_ANON_KEY}`,
  });

  console.log(`Starting scrape for keyword: "${keyword}", search_id: ${search_id}`);

  // Trigger the BrightData scraping job
  const res = await fetch(
    `https://api.brightdata.com/datasets/v3/trigger?${searchParams.toString()}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BRIGHT_DATA_API_KEY}`,
      },
      body: JSON.stringify([
        {
          keyword,
          url: "https://www.amazon.com",
          pages_to_search: 1,
        },
      ]),
    },
  );

  if (!res.ok) {
    const errorText = await res.text();
    console.error("BrightData API error:", errorText);
    throw new Error(`BrightData API returned ${res.status}: ${errorText}`);
  }

  const resJson = await res.json();
  console.log("BrightData response:", resJson);
  
  return resJson;
};

Deno.serve(async (req) => {
  try {
    const { record } = await req.json();

    if (!record || !record.query || !record.id) {
      return new Response(
        JSON.stringify({ error: "Invalid request: missing record.query or record.id" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    console.log("Received scrape request:", record);

    // Start the scraping job on BrightData
    const newScrape = await startScraping(record.query, record.id);

    // Get authorization header from the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header is missing");
    }

    // Create Supabase client with the provided authorization
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    // Update the search record with the snapshot_id and status
    const { data, error } = await supabaseClient
      .from("searches")
      .update({ 
        snapshot_id: newScrape.snapshot_id, 
        status: "Scraping" 
      })
      .eq("id", record.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating search record:", error);
      throw error;
    }

    console.log("Successfully updated search record:", data);

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in scrape-start function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "An unknown error occurred",
        details: error.toString() 
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

  2. Run `supabase functions serve scrape-start --env-file supabase/.env.local`

  3. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/scrape-start' \
    --header 'Authorization: Bearer YOUR_ANON_KEY' \
    --header 'Content-Type: application/json' \
    --data '{"record": {"id": "YOUR_SEARCH_ID", "query": "iPhone"}}'

*/

