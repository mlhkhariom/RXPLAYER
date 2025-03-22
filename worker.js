export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (path === "/") {
        return new Response(await generateHomePage(env), { headers: { "Content-Type": "text/html" } });
      } else if (path.startsWith("/api/add-m3u")) {
        return await handleAddM3U(request, env);
      } else if (path.startsWith("/api/get-m3u")) {
        return await handleGetM3U(env);
      } else if (path.startsWith("/play/")) {
        const streamUrl = decodeURIComponent(url.searchParams.get("stream"));
        return new Response(await generatePlayerPage(streamUrl), { headers: { "Content-Type": "text/html" } });
      } else {
        return new Response("404 Not Found", { status: 404 });
      }
    } catch (error) {
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  }
};

// 📌 Generate Homepage UI
async function generateHomePage(env) {
  try {
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
            let response = await fetch("/api/add-m3u?url=" + encodeURIComponent(url), { method: "POST" });
            let result = await response.json();
            alert(result.message);
            location.reload();
          }
        </script>
      </body>
      </html>
    `;
    return html;
  } catch (error) {
    return `<h1>Error Loading Page</h1><p>${error.message}</p>`;
  }
}

// 📡 Add M3U URL to KV Storage
async function handleAddM3U(request, env) {
  try {
    const url = new URL(request.url);
    const m3uUrl = url.searchParams.get("url");
    if (!m3uUrl) throw new Error("No URL provided");

    await env.M3U_DATA.put(m3uUrl, "stored");
    return new Response(JSON.stringify({ message: "M3U added successfully" }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ message: `Error: ${error.message}` }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
}

// 🔍 Fetch Stored M3U Links
async function handleGetM3U(env) {
  try {
    const m3uList = await env.M3U_DATA.list();
    return new Response(JSON.stringify(m3uList.keys.map(item => item.name)), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

// 🎥 Generate Video Player Page with Multi-Quality & Multi-Audio Support
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
      <div>
        <label for="quality">Quality: </label>
        <select id="quality"></select>
        <label for="audio">Audio: </label>
        <select id="audio"></select>
      </div>
      <script>
        document.addEventListener("DOMContentLoaded", function() {
          let videoElement = document.getElementById("video");
          let streamUrl = "${streamUrl}";

          if (streamUrl.includes(".m3u8") || streamUrl.includes(".mpd")) {
            let player = new shaka.Player(videoElement);
            player.load(streamUrl).then(() => {
              let qualities = player.getVariantTracks();
              let audioTracks = player.getAudioTracks();

              let qualitySelect = document.getElementById("quality");
              qualities.forEach(q => {
                let option = document.createElement("option");
                option.value = q.id;
                option.textContent = q.height + "p";
                qualitySelect.appendChild(option);
              });
              qualitySelect.addEventListener("change", () => {
                player.selectVariantTrack(qualities.find(q => q.id == qualitySelect.value), true);
              });

              let audioSelect = document.getElementById("audio");
              audioTracks.forEach(a => {
                let option = document.createElement("option");
                option.value = a.id;
                option.textContent = a.language;
                audioSelect.appendChild(option);
              });
              audioSelect.addEventListener("change", () => {
                player.selectAudioTrack(audioTracks.find(a => a.id == audioSelect.value));
              });
            }).catch(error => console.error("Error loading stream:", error));
          } else {
            jwplayer(videoElement).setup({
              file: streamUrl,
              width: "100%",
              aspectratio: "16:9",
              autostart: true
            }).on("error", function(event) {
              console.error("JW Player Error:", event);
            });
          }
        });
      </script>
    </body>
    </html>
  `;
}
