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
  const m3uListHtml = await handleGetM3U(env);
  return `
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
      <div class="m3u-container">${m3uListHtml}</div>
      <script>
        async function addM3U(event) {
          event.preventDefault();
          let url = document.getElementById("m3u-url").value;
          let response = await fetch("/api/add-m3u?url=" + encodeURIComponent(url), { method: "POST" });
          let result = await response.json();
          alert(result.message);
          location.reload();
        }
        function playStream(url) {
          window.location.href = "/play/?stream=" + encodeURIComponent(url);
        }
      </script>
    </body>
    </html>
  `;
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
    let html = "";
    for (const item of m3uList.keys) {
      const streamsHtml = await extractM3UStreams(item.name);
      html += `<div class="m3u-box">
        <strong>${item.name}</strong>
        <div class="stream-links">${streamsHtml}</div>
      </div>`;
    }
    return html;
  } catch (error) {
    return `<p>Error: ${error.message}</p>`;
  }
}

// 🛠 Extract Streams from M3U (FIXED)
async function extractM3UStreams(m3uUrl) {
  try {
    const response = await fetch(m3uUrl);
    const text = await response.text();
    const lines = text.split("\n").filter(line => line.trim() && !line.startsWith("#"));
    return lines.map(url => `<span class="stream-box" onclick="playStream('${url}')">${url}</span>`).join("");
  } catch (error) {
    console.error("Error extracting M3U streams:", error);
    return "<p>Failed to extract streams.</p>";
  }
}

// 🎥 Generate Video Player Page with Quality & Track Selection Under Player
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
        .controls { margin-top: 10px; }
      </style>
    </head>
    <body>
      <h1>RXPlayer</h1>
      <div id="player"></div>
      <div class="controls">
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
