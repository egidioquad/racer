import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

console.log("end_game function lets go!");

const supabaseUrl = "https://pvrgwmyaxynklimiusly.supabase.co";
const supabaseKey =
    "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const headers = {
    Authorization: supabaseKey,
    ...corsHeaders,
    "Content-Type": "application/json",
};

serve((req) => {
    if (req.method === "OPTIONS") {
        // Handle CORS Preflight request
        return handleCorsPreflight();
    } else {
        return handler(req);
    }
});

export default async function handler(request: Request) {
    const requestBody = await request.json();
    const game_token = requestBody.game_token;
    const fast_lap = requestBody.lap_time;
    const end_timestamp = Date.now();
    const btcAddress = requestBody.btcAddress;

    if (typeof game_token !== "string" && Number.isFinite(fast_lap)) {
        //you can use just number
        return new Response("Invalid input", { status: 400 });
    }

    const start_timestamp = await getTimestamp(game_token);

    if (start_timestamp) {
        if (end_timestamp - start_timestamp <= 1) {
            // find a good value by testing

            fraud();
        } else {
            try {
                putScore(btcAddress, fast_lap);
            } catch {
                return new Response("Internal Server Error", { status: 500 });
            }
        }
    }
    return new Response(null, { status: 200 });
}

async function getTimestamp(game_token: string) {
    try {
        const requestUrl = `${supabaseUrl}/rest/v1/game_session?game_token=eq.${game_token}`;

        const response = await fetch(requestUrl, { headers });
        if (!response.ok) {
            console.log("cant GET timestamp");
            throw new Error("Error querying the database");
        }
        const data = await response.json();
        if (data.length > 0) {
            const timestamp = Number(data[0].timestamp); // hope this works, need some testing
            console.log("Timestamp:", timestamp);
            return timestamp;
        } else {
            console.error("there was no timestamp and is fucked up");
            return null;
        }
    } catch (err) {
        console.error(err);
        return null;
    }
}

function fraud() {}

async function postScore(btcAddress: string, fast_lap: number) {
    const jsonObject = {
        btcAddress,
        fast_lap,
    };

    try {
        const postUrl = `${supabaseUrl}/rest/v1/scores`;
        const insertResponse = await fetch(postUrl, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(jsonObject),
        });
        console.log("Posting scores..");
        if (!insertResponse.ok) {
            console.error("not posting shit");
        }
    } catch {
        console.error("Error inserting the data into the database");
        return new Response("Internal Server Error", { status: 500 });
    }
}

async function putScore(btcAddress: string, newFastLap: number) {
    const requestUrl = `${supabaseUrl}/rest/v1/scores?btcAddress=eq.${btcAddress}`;
    try {
        const response = await fetch(requestUrl, { headers }); // GET

        if (response.ok) {
            const data = await response.json();
            if (data.length > 0) {
                const putResponse = await fetch(requestUrl, {
                    method: "PUT",
                    headers: {
                        ...headers,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ fast_lap: newFastLap }),
                });

                if (putResponse.ok) {
                    console.log("Fast lap updated successfully!");
                } else {
                    console.error("Failed to update fast lap:", putResponse);
                }
            } else {
                postScore(btcAddress, newFastLap);
            }
        } else {
            console.error("Error checking btcAddress:", response);
        }
    } catch (error) {
        console.error("Error checking btcAddress:", error);
    }
}

function handleCorsPreflight() {
    // Use the exported corsHeaders object directly
    const headers = new Headers(corsHeaders);
    headers.set("Allow", "POST, GET, PUT, OPTIONS");
    return new Response(null, {
        status: 204, // No content for preflight request
        headers: headers,
    });
}
