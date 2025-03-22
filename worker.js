export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/") {
      return new Response(await generateHomePage(env), { headers: { "Content-Type": "text/html" } });
    } else if (path.startsWith("/api/add-m3u")) {
      return handleAddM3U(request, env);
    } else if (path.startsWith("/api/get-m3u")) {
      return handleGetM3U(env);
    } else if (path.startsWith("/api/m3u-parser")) {
      return fetchM3UStreams(request, env);
    } else if (path.startsWith("/play/")) {
      const streamUrl = decodeURIComponent(url.searchParams.get("stream"));
      return new Response(await generatePlayerPage(streamUrl), { headers: { "Content-Type": "text/html" } });
    } else {
      return new Response("404 Not Found", { status: 404 });
    }
  }
};

// 📌 Generate Homepage UI
async function generateHomePage(env) {
  const m3uList = await env.M3U_DATA.list();
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>RXPlayer M3U Manager</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; background: #181818; color: white; }
        h1 { color: #ff3d00; }
        input, button { padding: 10px; margin: 10px; }
        .m3u-container { width: 60%; margin: auto; text-align: left; }
        .m3u-box { background: #333; padding: 10px; margin: 10px; border-radius: 5px; }
        .stream-links { display: flex; flex-wrap: wrap; gap: 5px; }
        .stream-box { background: #555; padding: 5px 10px; border-radius: 3px; cursor: pointer; }
      </style>
    </head>
    <body>
      <h1>RXPlayer M3U Manager</h1>
      <form onsubmit="addM3U(event)">
        <input type="text" id="m3u-url" placeholder="Enter M3U URL" required>
        <button type="submit">Add M3U</button>
      </form>
      <div class="m3u-container">
        ${await generateM3UList(env)}
      </div>
      <script>
        async function addM3U(event) {
          event.preventDefault();
          let url = document.getElementById("m3u-url").value;
          await fetch("/api/add-m3u?url=" + encodeURIComponent(url), { method: "POST" });
          location.reload();
        }
      </script>
    </body>
    </html>
  `;
  return html;
}

// 📌 Generate M3U List with Stream Links
async function generateM3UList(env) {
  const m3uList = await env.M3U_DATA.list();
  let html = "";

  for (let item of m3uList.keys) {
    let streams = await fetchM3UStreams(item.name);
    html += `<div class="m3u-box">
               <h3>${item.name}</h3>
               <div class="stream-links">
                 ${streams.map(link => `<a href="/play/?stream=${encodeURIComponent(link)}" class="stream-box">${link}</a>`).join('')}
               </div>
             </div>`;
  }

  return html || "<p>No M3U data stored.</p>";
}

// 📡 Add M3U URL to KV Storage
async function handleAddM3U(request, env) {
  const url = new URL(request.url);
  const m3uUrl = url.searchParams.get("url");
  if (!m3uUrl) return new Response(JSON.stringify({ error: "No URL provided" }), { status: 400 });

  await env.M3U_DATA.put(m3uUrl, "stored");
  return new Response(JSON.stringify({ message: "M3U added successfully" }), { headers: { "Content-Type": "application/json" } });
}

// 🔍 Fetch Stored M3U Links
async function handleGetM3U(env) {
  const m3uList = await env.M3U_DATA.list();
  return new Response(JSON.stringify(m3uList.keys.map(item => item.name)), { headers: { "Content-Type": "application/json" } });
}

// 📡 Extract Stream Links from M3U
async function fetchM3UStreams(m3uUrl) {
  const response = await fetch(m3uUrl);
  const text = await response.text();
  const lines = text.split("\n");

  return lines.filter(line => line.includes(".m3u8") || line.includes(".mp4") || line.includes(".ts"))
              .map(line => line.trim());
}

// 🎥 Generate Video Player Page
async function generatePlayerPage(streamUrl) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>RXPlayer</title>
      <script src="https://cdn.jsdelivr.net/npm/shaka-player/dist/shaka-player.ui.js"></script>
      <script src="https://cdn.jwplayer.com/libraries/your_jwplayer_key.js"></script>
      <style>
        body { text-align: center; background: #181818; color: white; }
        video { width: 80%; height: auto; }
      </style>
    </head>
    <body>
      <h1>RXPlayer</h1>
      <video id="video" controls autoplay></video>
      <script>
        document.addEventListener("DOMContentLoaded", function() {
          let streamUrl = "${streamUrl}";
          if (streamUrl.includes(".m3u8") || streamUrl.includes(".mpd")) {
            let player = new shaka.Player(document.getElementById("video"));
            player.load(streamUrl);
          } else {
            jwplayer("video").setup({
              file: streamUrl,
              width: "100%",
              aspectratio: "16:9",
              autostart: true
            });
          }
        });
      </script>
    </body>
    </html>
  `;
}
