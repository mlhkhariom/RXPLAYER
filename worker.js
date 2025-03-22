export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/") {
      return new Response(await generateHomePage(), { headers: { "Content-Type": "text/html" } });
    } else if (path.startsWith("/play/")) {
      const streamId = path.split("/")[2];
      return new Response(await generatePlayerPage(streamId), { headers: { "Content-Type": "text/html" } });
    } else if (path.startsWith("/api/stream")) {
      return fetchStreamFile(url.searchParams.get("url"));
    } else if (path.startsWith("/api/m3u-parser")) {
      return fetchM3UStreams(url.searchParams.get("m3u"));
    } else {
      return new Response("404 Not Found", { status: 404 });
    }
  }
};

// 🎬 Generate HTML Home Page
async function generateHomePage() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>RXPlayer Streaming</title>
      <style> body { font-family: Arial, sans-serif; text-align: center; }</style>
    </head>
    <body>
      <h1>Welcome to RXPlayer</h1>
      <p>Stream any video with DRM, multi-audio, and subtitles.</p>
      <a href="/play/sample-video">Watch a Demo</a>
    </body>
    </html>
  `;
}

// 🎥 Generate Player Page
async function generatePlayerPage(streamId) {
  const videoSrc = `https://your-stream-url.com/${streamId}.m3u8`;
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>RXPlayer</title>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.3.4/shaka-player.compiled.min.js"></script>
      <script>
        async function initPlayer() {
          const video = document.getElementById('video');
          const player = new shaka.Player(video);

          player.configure({ drm: {
            "com.widevine.alpha": "https://your-widevine-server.com",
            "com.microsoft.playready": "https://your-playready-server.com"
          }});

          try {
            await player.load("${videoSrc}");
            console.log("Streaming started!");
          } catch (error) {
            console.error("Playback error:", error);
          }
        }

        document.addEventListener('DOMContentLoaded', initPlayer);
      </script>
    </head>
    <body>
      <h1>Now Playing</h1>
      <video id="video" controls width="800"></video>
    </body>
    </html>
  `;
}

// 📡 Fetch Stream File
async function fetchStreamFile(streamUrl) {
  if (!streamUrl) return new Response(JSON.stringify({ error: "No URL provided" }), { status: 400 });

  const response = await fetch(streamUrl);
  return new Response(response.body, { headers: { "Content-Type": "application/vnd.apple.mpegurl" } });
}

// 🔍 Extract Streams from M3U Playlist
async function fetchM3UStreams(m3uUrl) {
  if (!m3uUrl) return new Response(JSON.stringify({ error: "No M3U URL provided" }), { status: 400 });

  const response = await fetch(m3uUrl);
  const text = await response.text();
  const lines = text.split("\n");

  const streams = lines
    .filter(line => line.includes(".m3u8") || line.includes(".mp4") || line.includes(".ts"))
    .map(line => line.trim());

  return new Response(JSON.stringify({ streams }), { headers: { "Content-Type": "application/json" } });
}
