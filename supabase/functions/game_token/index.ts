import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// import { corsHeaders } from "../_shared/cors.ts";

console.log("game_token function lets go!");

export const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, status",
    "Access-Control-Allow-Methods": "POST, GET, PUT, OPTIONS",
};

const supabaseUrl = "https://pvrgwmyaxynklimiusly.supabase.co";

serve(async (req) => {
    // console.log("cors request");
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
    const auth_token = requestBody.auth_token;
    const timestamp = Date.now();
    const salt = generateSALT();

    if (typeof auth_token !== "string") {
        return new Response("Invalid input", { status: 400 });
    }

    const jsonObject = {
        auth_token,
        timestamp,
        salt,
    };
    const jsonString = JSON.stringify(jsonObject);

    // Create a SHA-256 hash of the JSON string
    const encoder = new TextEncoder();
    const data = encoder.encode(jsonString);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const game_token = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    const updatedJsonObject = {
        auth_token: auth_token,
        timestamp: new Date(timestamp).toISOString(),
        salt: salt,
        game_token: game_token,
    };

    const requestUrl = `${supabaseUrl}/rest/v1/game_session?auth_token=eq.${auth_token}`;
    const tokenExists = await checkToken(auth_token);

    if (tokenExists === false)
        try {
            const insertUrl = `${supabaseUrl}/rest/v1/game_session`;
            const insertResponse = await fetch(insertUrl, {
                method: "POST",
                headers: {
                    apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cmd3bXlheHlua2xpbWl1c2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTAzODk5OTIsImV4cCI6MjAwNTk2NTk5Mn0.sjrh-nJAzRyp1Aunxk94cDVVzpmwX2OozZ8iD1xM8oc",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(updatedJsonObject),
            });
            console.log("posted up");
            if (!insertResponse.ok) {
                console.error("not posting shit");
            }
        } catch {
            console.error("Error inserting the data into the database");
            return new Response("Internal Server Error", { status: 500 });
        }
    else if (tokenExists === true) {
        try {
            const updateResponse = await fetch(requestUrl, {
                method: "PUT",
                headers: {
                    apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cmd3bXlheHlua2xpbWl1c2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTAzODk5OTIsImV4cCI6MjAwNTk2NTk5Mn0.sjrh-nJAzRyp1Aunxk94cDVVzpmwX2OozZ8iD1xM8oc",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(updatedJsonObject),
            });
            if (!updateResponse.ok) {
                console.error("not putting shit");
            }
        } catch {
            console.error("Error updating the data in the database");
            return new Response("Internal Server Error", { status: 500 });
        }
    } else {
        return new Response("Address could not be checked", { status: 500 });
    }

    return new Response(game_token, { status: 200 });
}

async function checkToken(auth_token: string) {
    try {
        const requestUrl = `${supabaseUrl}/rest/v1/game_session?auth_token=eq.${auth_token}`;

        const response = await fetch(requestUrl, {
            headers: {
                apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cmd3bXlheHlua2xpbWl1c2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTAzODk5OTIsImV4cCI6MjAwNTk2NTk5Mn0.sjrh-nJAzRyp1Aunxk94cDVVzpmwX2OozZ8iD1xM8oc",
                "Content-Type": "application/json",
            },
        });

        if (response.ok) {
            const data = await response.json();
            console.log(data);
            if (data.length === 0) {
                return false; // Address not found
            }
            return true; // Address found
        } else {
            throw new Error("Error querying the database");
        }
    } catch (Error) {
        console.error(Error);
        return null; // Request failed
    }
}

function generateSALT() {
    const randomBytes = new Uint8Array(16);
    window.crypto.getRandomValues(randomBytes);
    // Convert the Uint8Array to a string or use it directly as bytes
    const salt = Array.from(randomBytes)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    return salt;
}
