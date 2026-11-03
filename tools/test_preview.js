// tools/test_preview.js - CleanHome Browser Automation & Verification
// Native Node.js + Chrome DevTools Protocol (CDP) implementation.
// Zero npm dependencies, zero network calls.

const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const PROJECT_ROOT = path.dirname(__dirname);
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA_DIR = path.join(process.env.TEMP || "C:\\temp", "cleanhome-chrome-profile-" + Date.now());
const DOCS_DIR = path.join(PROJECT_ROOT, "docs");

if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

let cdpId = 1;
const pendingCallbacks = new Map();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

async function main() {
  console.log("=== CleanHome Automated Proof & Verification ===");
  console.log("1. Starting preview server on port 8080...");

  // Start python tools/preview.py
  const previewProcess = spawn("python", ["tools/preview.py"], {
    cwd: PROJECT_ROOT,
    stdio: "inherit"
  });

  // Wait for server to start responding
  let serverReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get("http://localhost:8080/index.html", res => {
          if (res.statusCode === 200) resolve();
          else reject(new Error("Status " + res.statusCode));
        });
        req.on("error", reject);
        req.setTimeout(500, () => req.destroy());
      });
      serverReady = true;
      break;
    } catch (e) {
      await sleep(200);
    }
  }

  if (!serverReady) {
    console.error("Preview server failed to start on port 8080");
    previewProcess.kill();
    process.exit(1);
  }
  console.log("  [OK] Preview server is responding at http://localhost:8080/index.html");

  console.log("2. Launching Chrome 1920x1080 headless...");
  const chromeProcess = spawn(CHROME_PATH, [
    "--remote-debugging-port=9222",
    "--headless=new",
    "--window-size=1920,1080",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${USER_DATA_DIR}`
  ], { stdio: "ignore" });

  await sleep(1500);

  let versionInfo;
  try {
    versionInfo = await fetchJson("http://127.0.0.1:9222/json/version");
    console.log("  [OK] Chrome CDP connected:", versionInfo.Browser);
  } catch (e) {
    console.error("Could not reach Chrome CDP: " + e.message);
    chromeProcess.kill();
    previewProcess.kill();
    process.exit(1);
  }

  // Get active page or create target
  const targets = await fetchJson("http://127.0.0.1:9222/json/list");
  let wsUrl = targets.length > 0 ? targets[0].webSocketDebuggerUrl : versionInfo.webSocketDebuggerUrl;

  console.log("3. Connecting WebSocket to Chrome DevTools Protocol...");
  const ws = new WebSocket(wsUrl);

  const consoleErrors = [];
  const consoleMessages = [];

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.id && pendingCallbacks.has(msg.id)) {
        const cb = pendingCallbacks.get(msg.id);
        pendingCallbacks.delete(msg.id);
        if (msg.error) cb.reject(new Error(msg.error.message));
        else cb.resolve(msg.result);
      }

      if (msg.method === "Runtime.consoleAPICalled") {
        const type = msg.params.type;
        const text = msg.params.args.map(a => a.value || JSON.stringify(a)).join(" ");
        consoleMessages.push({ type, text });
        if (type === "error") {
          consoleErrors.push(text);
        }
      }

      if (msg.method === "Runtime.exceptionThrown") {
        const desc = msg.params.exceptionDetails.exception
          ? msg.params.exceptionDetails.exception.description
          : msg.params.exceptionDetails.text;
        consoleErrors.push(desc);
      }
    } catch (e) {
      console.error("WS message parse error:", e);
    }
  };

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  console.log("  [OK] WebSocket connection established");

  function sendCDP(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = cdpId++;
      pendingCallbacks.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function sendKey(keyCode, keyName, text = "") {
    await sendCDP("Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      windowsVirtualKeyCode: keyCode,
      key: keyName,
      code: keyName,
      text: text,
      unmodifiedText: text
    });
    await sendCDP("Input.dispatchKeyEvent", {
      type: "keyUp",
      windowsVirtualKeyCode: keyCode,
      key: keyName,
      code: keyName
    });
  }

  async function takeScreenshot(outputPath) {
    const res = await sendCDP("Page.captureScreenshot", { format: "png", fromSurface: true });
    const buffer = Buffer.from(res.data, "base64");
    fs.writeFileSync(outputPath, buffer);
    console.log(`  [OK] Screenshot saved: ${path.relative(PROJECT_ROOT, outputPath)} (${buffer.length} bytes)`);
  }

  console.log("4. Configuring 1920x1080 viewport and navigating...");
  await sendCDP("Page.enable");
  await sendCDP("Runtime.enable");
  await sendCDP("Emulation.setDeviceMetricsOverride", {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false
  });

  await sendCDP("Page.navigate", { url: "http://localhost:8080/index.html" });
  await sleep(1000);

  // 1. docs/shot-home.png
  console.log("5. Capturing docs/shot-home.png...");
  await takeScreenshot(path.join(DOCS_DIR, "shot-home.png"));

  console.log("6. Executing remote key sequence: Right x10, Left x5, Down, Up, Enter, Back, Yellow, Blue...");

  // Press Right x10 (capture focus mid-move during 5th press)
  for (let i = 1; i <= 10; i++) {
    if (i === 5) {
      // Trigger Right key and take screenshot mid-move (at 60ms into the 240ms transition)
      sendKey(39, "ArrowRight");
      await sleep(60);
      console.log("  Capturing docs/shot-focus.png (focus mid-move)...");
      await takeScreenshot(path.join(DOCS_DIR, "shot-focus.png"));
      await sleep(150);
    } else {
      await sendKey(39, "ArrowRight");
      await sleep(120);
    }
  }

  // Press Left x5
  for (let i = 1; i <= 5; i++) {
    await sendKey(37, "ArrowLeft");
    await sleep(120);
  }

  // Down
  await sendKey(40, "ArrowDown");
  await sleep(250);

  // Close library if Down opened it
  await sendKey(27, "Escape");
  await sleep(250);

  // Up (to top pills)
  await sendKey(38, "ArrowUp");
  await sleep(250);

  // Enter
  await sendKey(13, "Enter");
  await sleep(250);

  // Back
  await sendKey(27, "Escape");
  await sleep(250);

  // Down back to dock
  await sendKey(40, "ArrowDown");
  await sleep(250);

  // Yellow key (App Library)
  console.log("  Testing Yellow key (App Library)...");
  await sendKey(405, "Yellow", "y");
  await sleep(400);
  console.log("  Capturing docs/shot-library.png...");
  await takeScreenshot(path.join(DOCS_DIR, "shot-library.png"));

  // Close library with Back
  await sendKey(27, "Escape");
  await sleep(300);

  // Blue key (Wallpapers)
  console.log("  Testing Blue key (Wallpapers)...");
  await sendKey(406, "Blue", "b");
  await sleep(400);
  console.log("  Capturing docs/shot-wallpapers.png...");
  await takeScreenshot(path.join(DOCS_DIR, "shot-wallpapers.png"));

  // Close wallpapers with Back
  await sendKey(27, "Escape");
  await sleep(300);

  // Check console errors
  console.log("\n7. Console Errors Verification:");
  console.log(`  Total console messages: ${consoleMessages.length}`);
  console.log(`  Total console errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.error("  ERRORS DETECTED:");
    for (const err of consoleErrors) {
      console.error("    - " + err);
    }
  } else {
    console.log("  [PASS] ZERO console errors from code!");
  }

  // Frame times benchmark at 4x CPU throttling
  console.log("\n8. Frame times at 4x CPU throttling (20 Right presses at 100 ms)...");
  await sendCDP("Emulation.setCPUThrottlingRate", { rate: 4 });

  // Inject frame measurement
  await sendCDP("Runtime.evaluate", {
    expression: `
      window.__frameDurations = [];
      window.__lastFrame = performance.now();
      window.__measuring = true;
      function recordFrame(now) {
        if (!window.__measuring) return;
        var diff = now - window.__lastFrame;
        window.__lastFrame = now;
        window.__frameDurations.push(diff);
        requestAnimationFrame(recordFrame);
      }
      requestAnimationFrame(recordFrame);
    `
  });

  for (let i = 0; i < 20; i++) {
    await sendKey(39, "ArrowRight");
    await sleep(100);
  }

  const evalResult = await sendCDP("Runtime.evaluate", {
    expression: `
      window.__measuring = false;
      JSON.stringify(window.__frameDurations.slice(2));
    `,
    returnByValue: true
  });

  await sendCDP("Emulation.setCPUThrottlingRate", { rate: 1 });

  let frameTimes = [];
  try {
    frameTimes = JSON.parse(evalResult.result.value || "[]");
  } catch (e) {
    frameTimes = [];
  }

  if (frameTimes.length > 0) {
    frameTimes.sort((a, b) => a - b);
    const sum = frameTimes.reduce((acc, f) => acc + f, 0);
    const avg = sum / frameTimes.length;
    const p95Index = Math.floor(frameTimes.length * 0.95);
    const p95 = frameTimes[p95Index];
    const over16 = frameTimes.filter(f => f > 16.7).length;
    const over33 = frameTimes.filter(f => f > 33.3).length;

    console.log(`  Recorded frames: ${frameTimes.length}`);
    console.log(`  Average frame duration: ${avg.toFixed(2)} ms (~${(1000/avg).toFixed(1)} fps)`);
    console.log(`  p95 frame duration: ${p95.toFixed(2)} ms`);
    console.log(`  Frames > 16.7 ms (under 60 fps): ${over16} (${((over16/frameTimes.length)*100).toFixed(1)}%)`);
    console.log(`  Frames > 33.3 ms (under 30 fps): ${over33} (${((over33/frameTimes.length)*100).toFixed(1)}%)`);
  }

  // Cleanup
  console.log("\n9. Cleaning up processes...");
  ws.close();
  chromeProcess.kill();
  previewProcess.kill();
  try {
    fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
  } catch (e) {}

  console.log("\n=== Automated Test & Verification Complete ===");
  if (consoleErrors.length > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Test failed with exception:", err);
  process.exit(1);
});

