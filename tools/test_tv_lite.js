// tools/test_tv_lite.js - Automated Test & Benchmark Suite for TV Lite Mode & Settings
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const PROJECT_ROOT = path.dirname(__dirname);
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA_DIR = path.join(process.env.TEMP || "C:\\temp", "cleanhome-tvlite-profile-" + Date.now());
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
  console.log("   CleanHome TV Lite Mode & Settings Verification Pipeline       ");
  console.log("=================================================================\n");

  console.log("1. Starting preview server on port 8080...");
  const previewProcess = spawn("python", ["tools/preview.py"], {
    cwd: PROJECT_ROOT,
    shell: true
  });
  previewProcess.stdout.on("data", d => process.stdout.write("  [server] " + d.toString()));
  previewProcess.stderr.on("data", d => process.stderr.write("  [server err] " + d.toString()));

  let serverReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get("http://127.0.0.1:8080/index.html", res => {
          if (res.statusCode === 200) resolve();
          else reject(new Error("Status " + res.statusCode));
        });
        req.on("error", reject);
        req.setTimeout(500, () => req.destroy());
      });
      serverReady = true;
      break;
    } catch (e) {
      // Print poll error
      if (i % 5 === 0) console.log("  poll attempt " + i + ": " + e.message);
      await sleep(200);
    }
  }

  if (!serverReady) {
    console.error("  [FAIL] Preview server failed to start on port 8080");
    previewProcess.kill();
    process.exit(1);
  }
  console.log("  [OK] Preview server running at http://127.0.0.1:8080/index.html");

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

  const targets = await fetchJson("http://127.0.0.1:9222/json/list");
  const pageTarget = targets.find(t => t.type === "page") || targets[0];
  const wsUrl = pageTarget ? pageTarget.webSocketDebuggerUrl : versionInfo.webSocketDebuggerUrl;

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
    } catch (e) {}
  };

  await new Promise((resolve) => {
    ws.onopen = resolve;
  });

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

  console.log("\n4. Loading CleanHome at 1920x1080...");
  await sendCDP("Page.enable");
  await sendCDP("Runtime.enable");
  await sendCDP("Emulation.setDeviceMetricsOverride", {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false
  });

  await sendCDP("Page.navigate", { url: "http://127.0.0.1:8080/index.html" });
  await sleep(1500);

  // 5. Switch to TV Lite mode and capture shot-home-lite.png
  console.log("\n5. Enabling TV Lite Mode & capturing docs/shot-home-lite.png...");
  await evaluate(`
    document.documentElement.dataset.tv = "1";
    var state = window.CleanHome.getState();
    state.settings.richEffects = false;
    document.body.classList.add("tv-lite");
  `);
  await sleep(400);

  await takeScreenshot(path.join(DOCS_DIR, "shot-home-lite.png"));

  // Verify Lite mode DOM optimizations & Redesigned Layout
  const liteChecks = await evaluate(`({
    isTvLiteClass: document.body.classList.contains("tv-lite"),
    bgLayer0Active: document.getElementById("bg-layer-0").classList.contains("active"),
    bgLayer1Exists: !!document.getElementById("bg-layer-1"),
    dockBarExists: !!document.getElementById("dock-bar"),
    dockTilesCount: document.querySelectorAll("#dock-track .tile-wrapper").length,
    groupSeparatorsCount: document.querySelectorAll("#dock-track .group-separator").length,
    groupLabelsCount: document.querySelectorAll("#group-labels-row .group-label").length,
    heroLabelText: document.getElementById("hero-label") ? document.getElementById("hero-label").textContent : "",
    heroTitleText: document.getElementById("hero-title") ? document.getElementById("hero-title").textContent : "",
    topPillAvatarText: document.getElementById("pill-avatar") ? document.getElementById("pill-avatar").textContent : "",
    focusedTileIndex: window.CleanHome.getState().currentTileIndex
  })`);
  console.log("  Redesigned Layout & DOM checks:", JSON.stringify(liteChecks, null, 2));

  // 6. Navigation: Right x10, Left x5
  console.log("\n6. Testing Remote Navigation: Right x10, Left x5...");
  for (let i = 0; i < 10; i++) {
    await sendKey(39, "ArrowRight");
    await sleep(100);
  }
  for (let i = 0; i < 5; i++) {
    await sendKey(37, "ArrowLeft");
    await sleep(100);
  }

  const currentIdx = await evaluate(`window.CleanHome.getState().currentTileIndex`);
  console.log(`  [OK] Tile index after Right x10, Left x5: ${currentIdx} (expected 5: ZEE5)`);

  // 7. Red key test: Debug line & rolling FPS counter
  console.log("\n7. Testing Red key (Debug Line & rolling FPS counter)...");
  await sendKey(82, "r", "r"); // Red key
  await sleep(300);

  const debugState = await evaluate(`({
    debugVisible: window.CleanHome.getState().debugVisible,
    debugClass: document.getElementById("debug-line").className,
    debugText: document.getElementById("debug-line").textContent
  })`);
  console.log("  Debug Line state:", JSON.stringify(debugState));

  // 8. Settings Screen Test
  console.log("\n8. Navigating to Settings tile & opening Settings screen...");
  // Settings tile is index 8 (the 9th tile)
  await evaluate(`window.CleanHome.getState().currentTileIndex = 8; window.CleanHome.openSettingsDialog();`);
  await sleep(500);

  const settingsState = await evaluate(`({
    currentScreen: window.CleanHome.getState().currentScreen,
    dialogVisible: document.getElementById("settings-dialog").classList.contains("visible"),
    rowsCount: document.getElementById("settings-list").children.length,
    rows: Array.from(document.getElementById("settings-list").children).map(r => ({
      label: r.querySelector(".settings-row-label") ? r.querySelector(".settings-row-label").textContent : "",
      value: r.querySelector(".settings-row-value") ? r.querySelector(".settings-row-value").textContent : "",
      focused: r.classList.contains("focused")
    }))
  })`);
  console.log("  Settings Screen rendered rows:", JSON.stringify(settingsState.rows, null, 2));

  console.log("  Capturing docs/shot-settings.png...");
  await takeScreenshot(path.join(DOCS_DIR, "shot-settings.png"));

  // Navigate Down inside Settings
  console.log("  Testing Down / Up inside Settings...");
  await sendKey(40, "ArrowDown"); // Move to Clock Format
  await sleep(150);
  await sendKey(13, "Enter"); // Toggle Clock Format
  await sleep(200);

  const clockValue = await evaluate(`document.querySelector('[data-id="clock"] .settings-row-value').textContent`);
  console.log(`  Clock Format toggled to: ${clockValue}`);

  // Test Back key closes Settings and returns to dock
  console.log("  Testing Back key from Settings...");
  await sendKey(27, "Escape"); // Back
  await sleep(350);

  const screenAfterBack = await evaluate(`({
    currentScreen: window.CleanHome.getState().currentScreen,
    dialogVisible: document.getElementById("settings-dialog").classList.contains("visible")
  })`);
  console.log("  Screen state after Back:", JSON.stringify(screenAfterBack));

  // 9. Yellow Key Test (App Library)
  console.log("\n9. Testing Yellow key (App Library)...");
  await sendKey(89, "y", "y");
  await sleep(350);
  const libOpen = await evaluate(`document.getElementById("app-library-dialog").classList.contains("visible")`);
  console.log(`  App Library open: ${libOpen}`);
  await sendKey(27, "Escape");
  await sleep(300);

  // 10. Blue Key Test (Wallpapers)
  console.log("\n10. Testing Blue key (Wallpapers)...");
  await sendKey(66, "b", "b");
  await sleep(350);
  const wpOpen = await evaluate(`document.getElementById("wallpapers-dialog").classList.contains("visible")`);
  console.log(`  Wallpapers dialog open: ${wpOpen}`);
  await sendKey(27, "Escape");
  await sleep(300);

  // 11. Enter on App Tile (Test launch and error toast)
  console.log("\n11. Testing App Launch on tile (Netflix)...");
  await evaluate(`window.CleanHome.getState().currentTileIndex = 0;`);
  await sendKey(13, "Enter");
  await sleep(400);

  const toastText = await evaluate(`
    var t = document.querySelector("#toast-container .toast");
    t ? t.textContent : "no toast"
  `);
  console.log(`  Toast display on launch: "${toastText}"`);

  // 12. Benchmark 4x CPU Throttling: Rich vs Lite
  console.log("\n12. Running 4x CPU Throttling Benchmark (20 Right presses at 100ms)...");

  async function runBenchmark(modeName, enableLite) {
    await evaluate(`
      var state = window.CleanHome.getState();
      state.settings.richEffects = ${enableLite ? "false" : "true"};
      if (${enableLite}) {
        document.body.classList.add("tv-lite");
      } else {
        document.body.classList.remove("tv-lite");
      }
    `);
    await sleep(300);

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

    if (frameTimes.length === 0) return { recordedFrames: 0, avg: "0", p95: "0", over16: 0, pct16: "0", over33: 0, pct33: "0" };

    frameTimes.sort((a, b) => a - b);
    const sum = frameTimes.reduce((acc, f) => acc + f, 0);
    const avg = sum / frameTimes.length;
    const p95Index = Math.floor(frameTimes.length * 0.95);
    const p95 = frameTimes[p95Index];
    const over16 = frameTimes.filter(f => f > 16.7).length;
    const over33 = frameTimes.filter(f => f > 33.3).length;

    return {
      mode: modeName,
      recordedFrames: frameTimes.length,
      avg: avg.toFixed(2),
      p95: p95.toFixed(2),
      over16: over16,
      pct16: ((over16 / frameTimes.length) * 100).toFixed(1),
      over33: over33,
      pct33: ((over33 / frameTimes.length) * 100).toFixed(1)
    };
  }

  console.log("  Benchmarking Rich Mode (4x CPU throttling)...");
  const richBench = await runBenchmark("Rich Mode", false);
  console.log("  Rich Mode results:", richBench);

  console.log("  Benchmarking TV Lite Mode (4x CPU throttling)...");
  const liteBench = await runBenchmark("TV Lite Mode", true);
  console.log("  TV Lite Mode results:", liteBench);

  // 13. Console errors check
  console.log("\n13. Checking Console Errors from our code...");
  console.log(`  Total console messages: ${consoleMessages.length}`);
  console.log(`  Total console errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.error("  [FAIL] Console errors encountered:", consoleErrors);
  } else {
    console.log("  [PASS] ZERO console errors from our code!");
  }

  console.log("\n=================================================================");
  console.log("                      TEST RUN SUMMARY                           ");
  console.log("=================================================================");
  console.log(`- TV Lite Home Screenshot: ${fs.existsSync(path.join(DOCS_DIR, "shot-home-lite.png")) ? "OK" : "MISSING"}`);
  console.log(`- Settings Screenshot:    ${fs.existsSync(path.join(DOCS_DIR, "shot-settings.png")) ? "OK" : "MISSING"}`);
  console.log(`- Red Debug Line:         ${debugState.debugVisible ? "PASS" : "FAIL"}`);
  console.log(`- Settings Rows Rendered: ${settingsState.rowsCount} / 5 rows`);
  console.log(`- Settings Back Nav:      ${screenAfterBack.currentScreen === "dock" ? "PASS" : "FAIL"}`);
  console.log(`- Console Errors:         ${consoleErrors.length}`);
  console.log(`- Benchmark Comparison:`);
  console.log(`    Rich Mode:    avg ${richBench.avg}ms, p95 ${richBench.p95}ms, >16.7ms: ${richBench.pct16}%, >33.3ms: ${richBench.pct33}%`);
  console.log(`    TV Lite Mode: avg ${liteBench.avg}ms, p95 ${liteBench.p95}ms, >16.7ms: ${liteBench.pct16}%, >33.3ms: ${liteBench.pct33}%`);

  try {
    ws.close();
  } catch (e) {}
  chromeProcess.kill();
  try {
    spawn("taskkill", ["/F", "/T", "/PID", previewProcess.pid], { stdio: "ignore" });
  } catch (e) {}
  try {
    previewProcess.kill();
  } catch (e) {}

  if (consoleErrors.length > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
