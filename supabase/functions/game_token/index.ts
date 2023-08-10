import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

console.log("game_token function lets go!");

const supabaseUrl = "https://pvrgwmyaxynklimiusly.supabase.co";
const supabaseKey =
    "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const headers = {
    Authorization: supabaseKey,
    "Content-Type": "application/json",
    ...corsHeaders,
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
    const auth_token = requestBody.auth_token;
    const timestamp = Date.now();
    const salt = generateSALT();

    if (typeof auth_token !== "string") {
        return new Response("Invalid input", { status: 400 });
    }

    const requestUrl = `${supabaseUrl}/rest/v1/game_session?auth_token=eq.${auth_token}`;

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
        auth_token,
        timestamp,
        salt,
        game_token,
    };
    if ((await checkToken(auth_token)) === false)
        try {
            const insertUrl = `${supabaseUrl}/rest/v1/game_session`;
            const insertResponse = await fetch(insertUrl, {
                method: "POST",
                headers: headers,
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
    else {
        try {
            const updateResponse = await fetch(requestUrl, {
                method: "PUT",
                headers: headers,
                body: JSON.stringify(updatedJsonObject),
            });
            if (!updateResponse.ok) {
                console.error("not putting shit");
            }
        } catch {
            console.error("Error updating the data in the database");
            return new Response("Internal Server Error", { status: 500 });
        }
    }

    return new Response(game_token, { status: 200 });
}

async function checkToken(auth_token: string) {
    try {
        const supabaseUrl = "https://pvrgwmyaxynklimiusly.supabase.co";
        const supabaseKey =
            "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
        const requestUrl = `${supabaseUrl}/rest/v1/game_session?auth_token=eq.${auth_token}`;

        const headers = {
            Authorization: supabaseKey,
            ...corsHeaders,
        };

        const response = await fetch(requestUrl, { headers });

        if (!response.ok) {
            console.log("cant GET token");
            throw new Error("Error querying the database");
        }
        return true;
    } catch (err) {
        console.error(err);
        return false;
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

function handleCorsPreflight() {
    // Use the exported corsHeaders object directly
    const headers = new Headers(corsHeaders);
    headers.set("Allow", "POST, GET, PUT, OPTIONS");
    return new Response(null, {
        status: 204, // No content for preflight request
        headers: headers,
    });
}
