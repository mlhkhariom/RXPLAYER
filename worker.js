export default {
    async fetch(request, env) {
        try {
            const url = new URL(request.url);
            const path = url.pathname;

            if (path === "/") {
                return new Response(await generateHomePage(env), { headers: { "Content-Type": "text/html" } });
            } else if (path.startsWith("/play/")) {
                const id = path.split("/")[2];
                return new Response(await generatePlayerPage(id, env), { headers: { "Content-Type": "text/html" } });
            } else if (path === "/api/m3u") {
                return handleM3URequest(request, env);
            } else if (path === "/api/update-m3u") {
                return updateM3UStorage(request, env);
            } else {
                return new Response("Not Found", { status: 404 });
            }
        } catch (error) {
            return new Response(`Error: ${error.message}`, { status: 500 });
        }
    }
};

// Serve Homepage with M3U List
async function generateHomePage(env) {
    const m3uData = await env.KV_NAMESPACE.get("m3u_list") || "No M3U data available.";
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <title>Ultra Video Player</title>
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

// Generate Video Player Page
async function generatePlayerPage(id, env) {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <title>Now Playing</title>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/video.js/7.20.3/video.min.js"></script>
        </head>
        <body>
            <video id="video-player" class="video-js" controls preload="auto">
                <source src="https://example.com/stream/${id}.m3u8" type="application/x-mpegURL">
            </video>
            <script>
                var player = videojs("video-player", {
                    fluid: true,
                    responsive: true
                });
            </script>
        </body>
        </html>
    `;
}

// Handle M3U Requests
async function handleM3URequest(request, env) {
    const m3uData = await env.KV_NAMESPACE.get("m3u_list");
    return new Response(m3uData || "No M3U data stored.", { headers: { "Content-Type": "text/plain" } });
}

// Update M3U Storage from API
async function updateM3UStorage(request, env) {
    try {
        const response = await fetch("https://your-m3u-api.com/playlist.m3u");
        const m3uText = await response.text();
        await env.KV_NAMESPACE.put("m3u_list", m3uText);
        return new Response("M3U List Updated Successfully!", { status: 200 });
    } catch (error) {
        return new Response(`Error Fetching M3U: ${error.message}`, { status: 500 });
    }
}
