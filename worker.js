export default {
    async fetch(request, env) {
        try {
            const url = new URL(request.url);
            const path = url.pathname;

            if (!env.KV_NAMESPACE) {
                return new Response("Error: KV Namespace is not defined", { status: 500 });
            }

            if (path === "/") {
                return new Response(await generateHomePage(env), { headers: { "Content-Type": "text/html" } });
            } else if (path === "/api/m3u") {
                return handleM3URequest(env);
            } else if (path === "/api/update-m3u") {
                return updateM3UStorage(env);
            } else {
                return new Response("Not Found", { status: 404 });
            }
        } catch (error) {
            return new Response(`Error: ${error.message}`, { status: 500 });
        }
    }
};

// Fetch & Display M3U Playlists
async function generateHomePage(env) {
    const m3uData = await env.KV_NAMESPACE.get("m3u_list") || "No M3U data available.";
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <title>M3U Player</title>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/video.js/7.20.3/video.min.js"></script>
        </head>
        <body>
            <h1>Available M3U Playlists</h1>
            <pre>${m3uData}</pre>
            <button onclick="fetch('/api/update-m3u', { method: 'POST' })">Refresh M3U</button>
        </body>
        </html>
    `;
}

// Fetch M3U Data from KV
async function handleM3URequest(env) {
    try {
        const m3uData = await env.KV_NAMESPACE.get("m3u_list");
        return new Response(m3uData || "No M3U data stored.", { headers: { "Content-Type": "text/plain" } });
    } catch (error) {
        return new Response(`KV Error: ${error.message}`, { status: 500 });
    }
}

// Fetch & Store M3U Data in KV
async function updateM3UStorage(env) {
    try {
        const response = await fetch("https://your-m3u-api.com/playlist.m3u");
        const m3uText = await response.text();
        await env.KV_NAMESPACE.put("m3u_list", m3uText);
        return new Response("M3U List Updated Successfully!", { status: 200 });
    } catch (error) {
        return new Response(`M3U Fetch Error: ${error.message}`, { status: 500 });
    }
}
