import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// import { corsHeaders } from "../_shared/cors.ts";

console.log("end_game function lets go!");
export const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, status",
    "Access-Control-Allow-Methods": "POST, GET, PUT, OPTIONS",
};

const supabaseUrl = "https://pvrgwmyaxynklimiusly.supabase.co";

serve(async (req) => {
    // console.log("cors request");
    console.log("routing...");
    console.log(req);
    if (req.method === "OPTIONS") {
        // Handle CORS Preflight request
        return new Response("ok", { headers: corsHeaders });
    }
    try {
        const { body, status } = await handler(req);
        const data = { auth_token: body, status: status };
        if (data.status === 500)
            return new Response(Error.toString(), {
                status: 500,
                headers: corsHeaders,
            });
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: corsHeaders,
        });
    } catch (error) {
        console.log("capping");
        return new Response(error.toString(), { status: 500 });
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
        if (end_timestamp - start_timestamp >= 1) {
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
    return new Response("score updated successfully", { status: 200 });
}

async function getTimestamp(game_token: string) {
    try {
        const requestUrl = `${supabaseUrl}/rest/v1/game_session?game_token=eq.${game_token}`;

        const response = await fetch(requestUrl, {
            headers: {
                apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cmd3bXlheHlua2xpbWl1c2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTAzODk5OTIsImV4cCI6MjAwNTk2NTk5Mn0.sjrh-nJAzRyp1Aunxk94cDVVzpmwX2OozZ8iD1xM8oc",
                "Content-Type": "application/json",
            },
        });
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
    } catch (Error) {
        console.error(Error);
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
            headers: {
                apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cmd3bXlheHlua2xpbWl1c2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTAzODk5OTIsImV4cCI6MjAwNTk2NTk5Mn0.sjrh-nJAzRyp1Aunxk94cDVVzpmwX2OozZ8iD1xM8oc",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(jsonObject),
        });

        if (!insertResponse.ok) {
            console.error("not posting shit");
        }
        console.log("Posting scores..");
    } catch {
        console.error("Error inserting the data into the database");
        return new Response("Internal Server Error", { status: 500 });
    }
}

async function putScore(btcAddress: string, newFastLap: number) {
    const requestUrl = `${supabaseUrl}/rest/v1/scores?btcAddress=eq.${btcAddress}`;
    try {
        const response = await fetch(requestUrl, {
            // GET
            headers: {
                apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cmd3bXlheHlua2xpbWl1c2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTAzODk5OTIsImV4cCI6MjAwNTk2NTk5Mn0.sjrh-nJAzRyp1Aunxk94cDVVzpmwX2OozZ8iD1xM8oc",
                "Content-Type": "application/json",
            },
        });
        if (response.ok) {
            const data = await response.json();
            if (data.length > 0) {
                const putResponse = await fetch(requestUrl, {
                    method: "PUT",
                    headers: {
                        apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cmd3bXlheHlua2xpbWl1c2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTAzODk5OTIsImV4cCI6MjAwNTk2NTk5Mn0.sjrh-nJAzRyp1Aunxk94cDVVzpmwX2OozZ8iD1xM8oc",
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
