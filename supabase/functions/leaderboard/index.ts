import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

export const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, status",
    "Access-Control-Allow-Methods": "POST, GET, PUT, OPTIONS",
};

const supabaseUrl = "https://pvrgwmyaxynklimiusly.supabase.co";

serve(async (req) => {
    if (req.method === "OPTIONS") {
        // Handle CORS Preflight request
        return new Response("ok", { headers: corsHeaders });
    }
    try {
        const response = await fetch(
            //		`${supabaseUrl}/rest/v1/scores?select=btcAddress,fast_lap&order=fast_lap.desc&limit=3`,

            `${supabaseUrl}/rest/v1/scores`,
            {
                headers: {
                    apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cmd3bXlheHlua2xpbWl1c2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTAzODk5OTIsImV4cCI6MjAwNTk2NTk5Mn0.sjrh-nJAzRyp1Aunxk94cDVVzpmwX2OozZ8iD1xM8oc",
                },
            }
        );
        if (!response.ok) {
            console.log("response_not_ok");
            throw new Error(
                `Error fetching top scores: ${response.statusText}`
            );
        }
        const data: { btcAddress: string; fast_lap: string }[] =
            await response.json();
        console.log("data: ", data);

        data.sort((a, b) => a.fast_lap.localeCompare(b.fast_lap));

        const top10 = data.slice(0, 10); // Get the top 10 elements

        console.log("sorted data:", data);
        return new Response(JSON.stringify(top10), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error) {
        console.log("capping");
        return new Response(error.toString(), { status: 500 });
    }
});
