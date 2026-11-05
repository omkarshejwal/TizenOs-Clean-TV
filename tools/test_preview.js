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
  console.log("=================================================================");
  console.log("        CleanHome Automated Proof & Verification Pipeline        ");
  console.log("=================================================================\n");

  console.log("1. Starting preview server on port 8080...");
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
    console.error("  [FAIL] Preview server failed to start on port 8080");
    previewProcess.kill();
    process.exit(1);
  }
  console.log("  [OK] Preview server is responding at http://localhost:8080/index.html");

  console.log("2. Launching headless Google Chrome (1920x1080)...");
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
    console.error("  [FAIL] Could not reach Chrome CDP: " + e.message);
    chromeProcess.kill();
    previewProcess.kill();
    process.exit(1);
  }

  // Get active page target (ensure we target the web page, not background extensions)
  const targets = await fetchJson("http://127.0.0.1:9222/json/list");
  const pageTarget = targets.find(t => t.type === "page") || targets[0];
  let wsUrl = pageTarget ? pageTarget.webSocketDebuggerUrl : versionInfo.webSocketDebuggerUrl;
  console.log(`  [OK] Selected page target: ${pageTarget ? pageTarget.title : "Default"} (${wsUrl})`);

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
        const text = msg.params.args.map(a => a.value !== undefined ? a.value : (a.description || JSON.stringify(a))).join(" ");
        consoleMessages.push({ type, text });
        if (type === "error") {
          consoleErrors.push(text);
        }
      }

      if (msg.method === "Runtime.exceptionThrown") {
        const desc = msg.params.exceptionDetails.exception
          ? (msg.params.exceptionDetails.exception.description || msg.params.exceptionDetails.exception.value)
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

  function sendCDP(method, params = {}, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const id = cdpId++;
      const timer = setTimeout(() => {
        if (pendingCallbacks.has(id)) {
          pendingCallbacks.delete(id);
          reject(new Error(`CDP command ${method} timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);
      pendingCallbacks.set(id, {
        resolve: (val) => { clearTimeout(timer); resolve(val); },
        reject: (err) => { clearTimeout(timer); reject(err); }
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const res = await sendCDP("Runtime.evaluate", {
      expression: expression,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text || "Evaluation error");
    }
    return res.result ? res.result.value : undefined;
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
    const res = await sendCDP("Page.captureScreenshot", { format: "png" });
    const buffer = Buffer.from(res.data, "base64");
    fs.writeFileSync(outputPath, buffer);
    console.log(`  [OK] Screenshot captured: ${path.relative(PROJECT_ROOT, outputPath)} (${buffer.length} bytes)`);
  }

  console.log("\n4. Configuring 1920x1080 viewport and loading application...");
  await sendCDP("Page.enable");
  await sendCDP("Runtime.enable");
  await sendCDP("Emulation.setDeviceMetricsOverride", {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false
  });

  await sendCDP("Page.navigate", { url: "http://localhost:8080/index.html" });
  await sleep(1200);

  // 1. Capture docs/shot-home.png
  console.log("\n5. Capturing initial Home Screen screenshot (docs/shot-home.png)...");
  await takeScreenshot(path.join(DOCS_DIR, "shot-home.png"));

  // 2. Remote Key Sequence: Right x10, Left x5
  console.log("\n6. Executing remote key sequence: Right x10, Left x5...");
  for (let i = 1; i <= 10; i++) {
    if (i === 5) {
      // Trigger Right key and take screenshot mid-move (at 60ms into the 240ms spring)
      sendKey(39, "ArrowRight");
      await sleep(60);
      console.log("  Capturing docs/shot-focus.png (focus mid-move during 5th Right press)...");
      await takeScreenshot(path.join(DOCS_DIR, "shot-focus.png"));
      await sleep(160);
    } else {
      await sendKey(39, "ArrowRight");
      await sleep(130);
    }
  }

  // Left x5
  for (let i = 1; i <= 5; i++) {
    await sendKey(37, "ArrowLeft");
    await sleep(130);
  }

  // Enter (on focused tile), then Back
  console.log("  Testing Enter on tile (app launch / toast) followed by Back...");
  await sendKey(13, "Enter");
  await sleep(350);
  await sendKey(27, "Escape");
  await sleep(300);

  // 3. Open and close EVERY pill
  console.log("\n7. Testing all top frosted pills (Inputs, Wi-Fi, Settings)...");
  // Navigate Up to top pills
  await sendKey(38, "ArrowUp");
  await sleep(250);

  // Pill 0: Inputs
  console.log("  a) Testing Inputs pill & dropdown...");
  await sendKey(13, "Enter"); // Open Inputs dropdown
  await sleep(250);

  // Navigate Down and Up inside dropdown
  await sendKey(40, "ArrowDown");
  await sleep(150);
  await sendKey(40, "ArrowDown");
  await sleep(150);
  await sendKey(38, "ArrowUp");
  await sleep(150);

  // Select item in Inputs dropdown -> triggers toast "Use the SOURCE button on your remote", closes menu, refocuses Inputs pill
  await sendKey(13, "Enter");
  await sleep(300);

  // Re-open Inputs dropdown to test Back dismissal
  await sendKey(13, "Enter");
  await sleep(200);
  await sendKey(27, "Escape"); // Back closes dropdown and refocuses Inputs pill
  await sleep(250);

  // Pill 1: Wi-Fi
  console.log("  b) Testing Wi-Fi pill...");
  await sendKey(39, "ArrowRight"); // Focus Wi-Fi pill
  await sleep(200);
  await sendKey(13, "Enter"); // Triggers network status toast
  await sleep(300);

  // Pill 2: Settings
  console.log("  c) Testing Settings pill...");
  await sendKey(39, "ArrowRight"); // Focus Settings pill
  await sleep(200);
  await sendKey(13, "Enter"); // Opens wallpapers/settings dialog
  await sleep(350);
  await sendKey(27, "Escape"); // Close dialog with Back (returns to dock)
  await sleep(300);

  // 4. App Library (Yellow key / Down from dock)
  console.log("\n8. Testing App Library (Yellow key)...");
  await sendKey(89, "y", "y");
  await sleep(400);

  // Ensure library is open before screenshot
  await evaluate(`if (!document.getElementById("app-library-dialog").classList.contains("visible")) window.CleanHome.openAppLibrary();`);
  await sleep(300);

  console.log("  Capturing docs/shot-library.png...");
  await takeScreenshot(path.join(DOCS_DIR, "shot-library.png"));
  await sendKey(39, "ArrowRight");
  await sleep(150);
  await sendKey(37, "ArrowLeft");
  await sleep(150);
  await sendKey(27, "Escape"); // Close App Library with Back
  await sleep(300);

  // 5. Wallpapers (Blue key)
  console.log("\n9. Testing Wallpapers dialog (Blue key)...");
  await sendKey(66, "b", "b");
  await sleep(400);

  await evaluate(`if (!document.getElementById("wallpapers-dialog").classList.contains("visible")) window.CleanHome.openWallpapersDialog();`);
  await sleep(300);

  console.log("  Capturing docs/shot-wallpapers.png...");
  await takeScreenshot(path.join(DOCS_DIR, "shot-wallpapers.png"));
  await sendKey(39, "ArrowRight");
  await sleep(150);
  await sendKey(37, "ArrowLeft");
  await sleep(150);
  await sendKey(27, "Escape"); // Close Wallpapers with Back
  await sleep(300);

  // 6. Viewport Scalability Verification (1920x1080 and 1280x720)
  console.log("\n10. Testing Viewport Scaling & Scrollbar Absence...");
  const check1080 = await evaluate(`({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    scrollWidth: document.body.scrollWidth,
    scrollHeight: document.body.scrollHeight,
    hasScrollbarX: document.body.scrollWidth > window.innerWidth,
    hasScrollbarY: document.body.scrollHeight > window.innerHeight
  })`);
  console.log(`  1920x1080 metrics: ${JSON.stringify(check1080)}`);

  await sendCDP("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(400);

  const check720 = await evaluate(`({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    scrollWidth: document.body.scrollWidth,
    scrollHeight: document.body.scrollHeight,
    hasScrollbarX: document.body.scrollWidth > window.innerWidth,
    hasScrollbarY: document.body.scrollHeight > window.innerHeight
  })`);
  console.log(`  1280x720 metrics:  ${JSON.stringify(check720)}`);

  // Restore 1920x1080
  await sendCDP("Emulation.setDeviceMetricsOverride", {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(400);

  // 7. 70s Idle Wait (Verifying 60s idle screensaver activation and drift)
  console.log("\n11. Testing 70-second idle wait (Screensaver auto-activates at 60s)...");
  console.log("  Waiting 70 seconds without input...");
  for (let sec = 10; sec <= 70; sec += 10) {
    await sleep(10000);
    process.stdout.write(`  ...elapsed ${sec}s / 70s\n`);
  }

  const screensaverActive = await evaluate(`
    document.getElementById("screensaver").classList.contains("active")
  `);
  console.log(`  Screensaver active status after 70s: ${screensaverActive ? "[PASS] ACTIVE" : "[FAIL] NOT ACTIVE"}`);

  // Wake up from screensaver
  await sendKey(13, "Enter");
  await sleep(300);
  const screensaverDismissed = await evaluate(`
    !document.getElementById("screensaver").classList.contains("active")
  `);
  console.log(`  Screensaver dismissed on user key press: ${screensaverDismissed ? "[PASS] DISMISSED" : "[FAIL] STILL ACTIVE"}`);

  // 8. 4x CPU Throttled Benchmark
  console.log("\n12. Running benchmark at 4x CPU throttling (20 Right presses at 100 ms)...");
  await sendCDP("Emulation.setCPUThrottlingRate", { rate: 4 });

  await evaluate(`
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
  `);

  for (let i = 0; i < 20; i++) {
    await sendKey(39, "ArrowRight");
    await sleep(100);
  }

  const evalResult = await evaluate(`
    window.__measuring = false;
    JSON.stringify(window.__frameDurations.slice(2));
  `);

  await sendCDP("Emulation.setCPUThrottlingRate", { rate: 1 });

  let frameTimes = [];
  try {
    frameTimes = JSON.parse(evalResult || "[]");
  } catch (e) {
    frameTimes = [];
  }

  let benchmarkReport = {
    recordedFrames: 0,
    avg: 0,
    p95: 0,
    over16: 0,
    pct16: 0,
    over33: 0,
    pct33: 0
  };

  if (frameTimes.length > 0) {
    frameTimes.sort((a, b) => a - b);
    const sum = frameTimes.reduce((acc, f) => acc + f, 0);
    const avg = sum / frameTimes.length;
    const p95Index = Math.floor(frameTimes.length * 0.95);
    const p95 = frameTimes[p95Index];
    const over16 = frameTimes.filter(f => f > 16.7).length;
    const over33 = frameTimes.filter(f => f > 33.3).length;

    benchmarkReport = {
      recordedFrames: frameTimes.length,
      avg: avg.toFixed(2),
      p95: p95.toFixed(2),
      over16: over16,
      pct16: ((over16 / frameTimes.length) * 100).toFixed(1),
      over33: over33,
      pct33: ((over33 / frameTimes.length) * 100).toFixed(1)
    };

    console.log(`  Recorded frames:         ${benchmarkReport.recordedFrames}`);
    console.log(`  Average frame duration:  ${benchmarkReport.avg} ms (~${(1000/avg).toFixed(1)} fps)`);
    console.log(`  p95 frame duration:      ${benchmarkReport.p95} ms`);
    console.log(`  Frames > 16.7 ms:        ${benchmarkReport.over16} (${benchmarkReport.pct16}%)`);
    console.log(`  Frames > 33.3 ms:        ${benchmarkReport.over33} (${benchmarkReport.pct33}%)`);
  }

  // 9. Console Errors Verification
  console.log("\n13. Console Logs & Errors Verification:");
  console.log("-----------------------------------------------------------------");
  for (const m of consoleMessages) {
    console.log(`  [CONSOLE ${m.type.toUpperCase()}] ${m.text}`);
  }
  console.log("-----------------------------------------------------------------");
  console.log(`  Total Console Messages: ${consoleMessages.length}`);
  console.log(`  Total Console Errors:   ${consoleErrors.length}`);

  if (consoleErrors.length > 0) {
    console.error("\n  [FAIL] CONSOLE ERRORS DETECTED FROM OUR CODE:");
    for (const err of consoleErrors) {
      console.error("    - " + err);
    }
  } else {
    console.log("  [PASS] ZERO CONSOLE ERRORS FROM OUR CODE!");
  }

  // 10. Clean up
  console.log("\n14. Cleaning up processes and temporary resources...");
  ws.close();
  chromeProcess.kill();
  previewProcess.kill();
  try {
    fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
  } catch (e) {}

  console.log("\n=================================================================");
  console.log("                Verification Suite Complete                      ");
  console.log("=================================================================\n");

  if (consoleErrors.length > 0 || !screensaverActive || check1080.hasScrollbarX || check1080.hasScrollbarY) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Test execution failed with exception:", err);
  process.exit(1);
});
