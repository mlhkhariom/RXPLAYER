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
        <script src="https://cdn.jsdelivr.net/npm/jwplayer@8.29.0/jwplayer.js"></script>
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

// 🎥 Generate Video Player Page with JW Player Ultra Features
async function generatePlayerPage(streamUrl) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>RXPlayer</title>
      <script src="https://cdn.jsdelivr.net/npm/jwplayer@8.29.0/jwplayer.js"></script>
      <style>
        body { text-align: center; background: #181818; color: white; }
        #player { width: 80%; height: auto; }
        select { margin: 10px; padding: 5px; }
      </style>
    </head>
    <body>
      <h1>RXPlayer</h1>
      <div id="player"></div>
      <div>
        <label for="quality">Quality: </label>
        <select id="quality"></select>
        <label for="audio">Audio: </label>
        <select id="audio"></select>
      </div>
      <script>
        let player = jwplayer("player").setup({
          file: "${streamUrl}",
          width: "100%",
          aspectratio: "16:9",
          autostart: true,
          playbackRateControls: true
        });

        player.on("ready", function() {
          let levels = player.getQualityLevels();
          let qualitySelect = document.getElementById("quality");
          levels.forEach((q, i) => {
            let option = document.createElement("option");
            option.value = i;
            option.textContent = q.label || (q.height + "p");
            qualitySelect.appendChild(option);
          });
          qualitySelect.addEventListener("change", function() {
            player.setCurrentQuality(parseInt(this.value));
          });

          let audioTracks = player.getAudioTracks();
          let audioSelect = document.getElementById("audio");
          audioTracks.forEach((a, i) => {
            let option = document.createElement("option");
            option.value = i;
            option.textContent = a.label || "Track " + (i + 1);
            audioSelect.appendChild(option);
          });
          audioSelect.addEventListener("change", function() {
            player.setCurrentAudioTrack(parseInt(this.value));
          });
        });
      </script>
    </body>
    </html>
  `;
}
