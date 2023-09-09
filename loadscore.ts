import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

export const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type, status",
	"Access-Control-Allow-Methods": "POST, GET, PUT, OPTIONS",
};



serve(async (req) => {
	if (req.method === "OPTIONS") {
		// Handle CORS Preflight request
		return new Response("ok", { headers: corsHeaders });
	}
	try {
		const btcAddress = req.btcAddress;
		const requestUrl = `https://pvrgwmyaxynklimiusly.supabase.co/rest/v1/scores?btcAddress=eq.${btcAddress}`;

		const response = await fetch(requestUrl,
			{
				headers: {
					apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cmd3bXlheHlua2xpbWl1c2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTAzODk5OTIsImV4cCI6MjAwNTk2NTk5Mn0.sjrh-nJAzRyp1Aunxk94cDVVzpmwX2OozZ8iD1xM8oc",
				},
			}
		);
		if (response.ok) {
			const responseData = await response.json();
			if (responseData.length > 0) {
				const existingScore = responseData[0];
				const existingFastLap = existingScore.fast_lap;
				return new Response(JSON.stringify(existingFastLap), {
					headers: { ...corsHeaders, "Content-Type": "application/json" },
					status: 200,
				});
			}
		} else {
			console.error("Error checking btcAddress:", response);
		}
	} catch (error) {
		console.log("capping");
		return new Response(error.toString(), { status: 500 });
	}
});
