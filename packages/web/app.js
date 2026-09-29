(() => {
  const $ = (id) => document.getElementById(id);
  const screen = $("screen"), wrap = $("screenWrap"), status = $("status");
  const tokenInput = $("token");
  tokenInput.value = localStorage.getItem("wda_token") || "";

  let token = "", ws = null, devW = 0, devH = 0;
  const api = (p, o = {}) =>
    fetch(p, { ...o, headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", ...(o.headers || {}) } });

  const setStatus = (on, txt) => { status.className = "pill " + (on ? "on" : "off"); status.textContent = txt; };

  async function connect() {
    token = tokenInput.value.trim();
    if (!token) return alert("Isi token dulu (lihat terminal saat bridge dijalankan).");
    localStorage.setItem("wda_token", token);
    try {
      const h = await (await api("/api/health")).json();
      if (!h.ok && h.device === undefined && !h.ok) throw new Error("unauthorized");
      const info = await (await api("/api/info")).json();
      devW = info.width; devH = info.height;
      $("devinfo").textContent = `${info.model || "?"} · ${info.serial} · ${devW}×${devH}`;
      startStream();
      setStatus(true, "online");
      $("nosignal").style.display = "none";
    } catch (e) { setStatus(false, "gagal"); alert("Gagal connect: " + e.message); }
  }

  function startStream() {
    if (ws) ws.close();
    const proto = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${proto}://${location.host}/ws/screen?token=${encodeURIComponent(token)}`);
    ws.binaryType = "blob";
    ws.onmessage = (ev) => {
      const url = URL.createObjectURL(ev.data);
      const old = screen.src;
      screen.src = url;
      if (old.startsWith("blob:")) URL.revokeObjectURL(old);
    };
    ws.onclose = () => setStatus(false, "stream putus");
  }

  const toDevice = (cx, cy) => {
    const r = screen.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * devW, y: ((cy - r.top) / r.height) * devH };
  };

  let downPos = null;
  screen.addEventListener("pointerdown", (e) => { downPos = { x: e.clientX, y: e.clientY }; });
  screen.addEventListener("pointerup", async (e) => {
    if (!downPos || !token) return;
    const a = toDevice(downPos.x, downPos.y), b = toDevice(e.clientX, e.clientY);
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    downPos = null;
    if (dist < 12) await api("/api/tap", { method: "POST", body: JSON.stringify({ x: a.x, y: a.y }) });
    else await api("/api/swipe", { method: "POST", body: JSON.stringify({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, duration_ms: 300 }) });
  });

  document.addEventListener("keydown", async (e) => {
    if (!token || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const map = { Escape: "BACK", Home: "HOME", End: "APP_SWITCH" };
    if (map[e.key]) { e.preventDefault(); await api("/api/key", { method: "POST", body: JSON.stringify({ code: map[e.key] }) }); }
  });

  document.querySelectorAll("#navkeys button[data-key]").forEach((b) =>
    b.addEventListener("click", () => api("/api/key", { method: "POST", body: JSON.stringify({ code: b.dataset.key }) }))
  );

  $("connectBtn").addEventListener("click", connect);
  $("shotBtn").addEventListener("click", async () => {
    const r = await api("/api/screenshot");
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "screenshot.png"; a.click();
  });
  $("sendText").addEventListener("click", async () => {
    const t = $("textInput").value; if (!t) return;
    await api("/api/text", { method: "POST", body: JSON.stringify({ text: t }) });
    $("textInput").value = "";
  });
  $("openApp").addEventListener("click", async () => {
    const p = $("pkgInput").value.trim(); if (!p) return;
    await api("/api/open", { method: "POST", body: JSON.stringify({ package: p }) });
  });
  const runShell = async () => {
    const c = $("shellInput").value.trim(); if (!c) return;
    $("shellOut").textContent += `\n$ ${c}\n…`;
    try {
      const r = await (await api("/api/shell", { method: "POST", body: JSON.stringify({ command: c }) })).json();
      $("shellOut").textContent += (r.stdout || "") + (r.stderr ? "\n[stderr] " + r.stderr : "") + `\n(exit ${r.exitCode})\n`;
    } catch (e) { $("shellOut").textContent += `\nerror: ${e.message}\n`; }
    $("shellOut").scrollTop = 1e6;
    $("shellInput").value = "";
  };
  $("runShell").addEventListener("click", runShell);
  $("shellInput").addEventListener("keydown", (e) => { if (e.key === "Enter") runShell(); });
})();
