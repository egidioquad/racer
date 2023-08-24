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
    console.log(req);
    if (req.method === "OPTIONS") {
        // Handle CORS Preflight request
        return new Response("ok", { headers: corsHeaders });
    }
    try {
        const handleResponse = await handler(req);
        return new Response("ok", {
            headers: { ...corsHeaders },
            status: handleResponse.status,
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
    console.log("game token:", game_token);
    console.log("fast lape:", fast_lap);

    if (typeof game_token !== "string" && Number.isFinite(fast_lap)) {
        //you can use just number
        return new Response("Invalid input", { status: 400 });
    }

    const start_timestamp = await getTimestamp(game_token);

    if (start_timestamp) {
        const startTimestamp = new Date(start_timestamp);
        const endTimestamp = new Date(end_timestamp);

        const timeDifferenceInMillis =
            endTimestamp.getTime() - startTimestamp.getTime();
        console.log("end-start =", timeDifferenceInMillis);

        //
        const floatThing = fast_lap * 1000;
        const fast_lap_milly = parseInt(floatThing.toString());
        console.log("fast_lap in milly::", fast_lap_milly);
        console.log(
            "timediff - fast lap",
            timeDifferenceInMillis - fast_lap_milly
        );

        if (
            timeDifferenceInMillis - fast_lap_milly >= 5000 ||
            fast_lap_milly < 80000
        ) {
            // find a good value by testing
            console.log(
                "fraud activation ! ! 1 ! ! ->>",
                timeDifferenceInMillis - fast_lap_milly
            );
            // fraud();
        } else {
            try {
                handleScore(btcAddress, fast_lap);
            } catch {
                return new Response("Internal Server Error", { status: 500 });
            }
        }
    } else {
        return new Response("Timestamp could not be found. Database err:", {
            status: 500,
        });
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
        console.log(response);
        if (!response.ok) {
            throw new Error("Error querying the database");
        }
        const data = await response.json();
        console.log("data--> ", data);
        if (data.length > 0) {
            const timestamp = data[0].timestamp;
            console.log("Timestamp:", timestamp);
            return timestamp;
        } else {
            console.error("currently not finding the timestamp");
            return null;
        }
    } catch (Error) {
        console.error(Error);
        return null;
    }
}

function fraud() {
    //GET score from score table, set cheater bool to: true
    //cheaters get their future scores 10 seconds more than their now score
}

async function postScore(btcAddress: string, fast_lap: number) {
    const newFastLapMinutes = formatTime(fast_lap);
    const jsonObject = {
        btcAddress: btcAddress,
        fast_lap: newFastLapMinutes,
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

async function handleScore(btcAddress: string, newFastLap: number) {
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
                const existingScore = data[0];
                const existingFastLap = existingScore.fast_lap;
                const parsedExisting = parseFormattedTime(existingFastLap);
                if (newFastLap < parsedExisting) {
                    putScore(btcAddress, newFastLap);
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

async function putScore(btcAddress: string, newFastLap: number) {
    const requestUrl = `${supabaseUrl}/rest/v1/scores?btcAddress=eq.${btcAddress}`;
    const fast_lap = formatTime(newFastLap);
    const putResponse = await fetch(requestUrl, {
        method: "PUT",
        headers: {
            apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cmd3bXlheHlua2xpbWl1c2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTAzODk5OTIsImV4cCI6MjAwNTk2NTk5Mn0.sjrh-nJAzRyp1Aunxk94cDVVzpmwX2OozZ8iD1xM8oc",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            btcAddress: btcAddress,
            fast_lap: fast_lap,
        }),
    });

    if (putResponse.ok) {
        console.log("Fast lap updated successfully!");
    } else {
        console.error("Failed to update fast lap:", putResponse);
    }
}

function parseFormattedTime(formattedTime: string): number {
    // Split the formatted time into its components
    const timeComponents = formattedTime.split(".");
    if (timeComponents.length !== 3) {
        console.error("Invalid formatted time format");
        // Return a default value or handle the error as needed
        return 0; // You can change this default value to another appropriate value
    }

    const minutes = parseInt(timeComponents[0]);
    const seconds = parseInt(timeComponents[1]);
    const tenths = parseInt(timeComponents[2]);
    const totalTimeInSeconds = minutes * 60 + seconds + tenths / 10;

    return totalTimeInSeconds;
}

function formatTime(dt: number) {
    const minutes = Math.floor(dt / 60);
    const seconds = Math.floor(dt - minutes * 60);
    const tenths = Math.floor(10 * (dt - Math.floor(dt)));
    if (minutes > 0)
        return (
            minutes + "." + (seconds < 10 ? "0" : "") + seconds + "." + tenths
        );
    else return seconds + "." + tenths;
}
