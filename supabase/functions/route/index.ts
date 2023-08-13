import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
//import { corsHeaders } from "../_shared/cors.ts";

export const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, status",
    "Access-Control-Allow-Methods": "POST, GET, PUT, OPTIONS",
};

console.log("route function lets go!");
const supabaseUrl = "https://pvrgwmyaxynklimiusly.supabase.co";
/*const supabaseKey =
    "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cmd3bXlheHlua2xpbWl1c2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTAzODk5OTIsImV4cCI6MjAwNTk2NTk5Mn0.sjrh-nJAzRyp1Aunxk94cDVVzpmwX2OozZ8iD1xM8oc";
const headers = {
    Authorization: supabaseKey,
    "Content-Type": "application/json",
};*/

serve(async (req) => {
    // console.log("cors request");
    console.log("routing...");
    console.log(req);
    if (req.method === "OPTIONS") {
        // Handle CORS Preflight request
        return new Response("ok", { headers: corsHeaders });
    }
    try {
        const handleResponse = await handler(req);
        return new Response(handleResponse.body, {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: handleResponse.status,
        });
    } catch (error) {
        console.log("capping");
        return new Response(error.toString(), { status: 500 });
    }
});

export default async function handler(request: Request) {
    const requestBody = await request.json();
    const inputAddress = requestBody.inputAddress;
    const timestamp = Date.now();
    const salt = generateSALT();

    if (typeof inputAddress !== "string") {
        return new Response("Invalid input", { status: 400 });
    }

    const jsonObject = {
        inputAddress,
        timestamp,
        salt,
    };
    const jsonString = JSON.stringify(jsonObject);

    // Create a SHA-256 hash of the JSON string
    const encoder = new TextEncoder();
    const data = encoder.encode(jsonString);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const auth_token = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    const updatedJsonObject = {
        inputAddress: inputAddress,
        timestamp: new Date(timestamp).toISOString(),
        salt: salt,
        auth_token: auth_token,
    };

    const addressExist = await checkAddress(inputAddress);
    if (addressExist === true) {
        try {
            const requestUrl = `${supabaseUrl}/rest/v1/game_auth?inputAddress=eq.${inputAddress}`;
            const updateResponse = await fetch(requestUrl, {
                method: "PUT",
                headers: {
                    apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cmd3bXlheHlua2xpbWl1c2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTAzODk5OTIsImV4cCI6MjAwNTk2NTk5Mn0.sjrh-nJAzRyp1Aunxk94cDVVzpmwX2OozZ8iD1xM8oc",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(updatedJsonObject),
            });
            console.log(updateResponse);
            if (!updateResponse.ok) {
                console.error("not putting shit");
            }
        } catch {
            console.error("Error updating the data in the database");
            return new Response("Internal Server Error", { status: 500 });
        }
        console.log("shit putted fr");
    } else if (addressExist === false) {
        try {
            const insertUrl = `${supabaseUrl}/rest/v1/game_auth`;
            const insertResponse = await fetch(insertUrl, {
                method: "POST",
                headers: {
                    apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cmd3bXlheHlua2xpbWl1c2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTAzODk5OTIsImV4cCI6MjAwNTk2NTk5Mn0.sjrh-nJAzRyp1Aunxk94cDVVzpmwX2OozZ8iD1xM8oc",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(updatedJsonObject),
            });
            console.log("postREsponse: ", insertResponse);

            if (!insertResponse.ok) {
                console.error("not posting shit");
            }
        } catch {
            console.error("Error inserting the data into the database");
            return new Response("Internal Server Error", { status: 500 });
        }
    } else {
        return new Response("Address could not be checked", { status: 500 });
    }

    return new Response(auth_token, { status: 200 });
}

async function checkAddress(inputAddress: string) {
    try {
        const requestUrl = `${supabaseUrl}/rest/v1/game_auth?inputAddress=eq.${inputAddress}`;

        const response = await fetch(requestUrl, {
            headers: {
                apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cmd3bXlheHlua2xpbWl1c2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTAzODk5OTIsImV4cCI6MjAwNTk2NTk5Mn0.sjrh-nJAzRyp1Aunxk94cDVVzpmwX2OozZ8iD1xM8oc",
                "Content-Type": "application/json",
            },
        });
        console.log("get get");

        if (response.ok) {
            console.log("GET SUCCED");
            const data = await response.json();
            console.log(data);
            if (data.length === 0) {
                return false; // Address not found
            }
            return true; // Address found
        } else {
            throw new Error("Error querying the database");
        }
    } catch (err) {
        console.error(err);
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
