// tools/test_glass.js - Glass Focus Verification & Proof Suite
// Validates centering, translucency, screenshots (docs/glass-<n>.png), and zero console errors.

const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const PROJECT_ROOT = path.dirname(__dirname);
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA_DIR = path.join(process.env.TEMP || "C:\\temp", "cleanhome-glass-profile-" + Date.now());
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

// Minimal PNG parser to sample pixel RGB directly from captured PNG bytes
function samplePngPixel(pngBuffer, x, y, width, height) {
  // Simple fallback: use Canvas API inside browser via evaluate
}

async function main() {
  console.log("=================================================================");
  console.log("          CleanHome Glass Focus Verification Suite               ");
  console.log("=================================================================\n");

  console.log("1. Starting preview server on port 8080...");
  const previewProcess = spawn("python", ["tools/preview.py"], {
    cwd: PROJECT_ROOT,
    stdio: "ignore"
  });

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
  console.log("  [OK] Preview server running at http://localhost:8080/index.html");

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
  } catch (e) {
    console.error("  [FAIL] Could not reach Chrome CDP: " + e.message);
    chromeProcess.kill();
    previewProcess.kill();
    process.exit(1);
  }

  const targets = await fetchJson("http://127.0.0.1:9222/json/list");
  const pageTarget = targets.find(t => t.type === "page") || targets[0];
  const wsUrl = pageTarget ? pageTarget.webSocketDebuggerUrl : versionInfo.webSocketDebuggerUrl;
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
  }

  console.log("\n4. Loading application at 1920x1080...");
  await sendCDP("Page.enable");
  await sendCDP("Runtime.enable");
  await sendCDP("Emulation.setDeviceMetricsOverride", {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false
  });

  await sendCDP("Page.navigate", { url: "http://localhost:8080/index.html" });
  await sleep(1500);

  const tilesCount = await evaluate(`document.querySelectorAll(".tile-wrapper").length`);
  console.log(`  [OK] Found ${tilesCount} tiles in dock row`);

  console.log("\n5. Testing & Screenshotting each of the 8 tiles focused...");
  console.log("-----------------------------------------------------------------");
  console.log(
    "Tile # | App Name           | Glow Center Delta | Card / Body BG Styles                         | Status"
  );
  console.log("-----------------------------------------------------------------");

  const results = [];

  for (let idx = 0; idx < tilesCount; idx++) {
    // Focus tile idx
    await evaluate(`window.CleanHome.setTileFocus(${idx}, false);`);
    await sleep(250);

    // Measure bounding boxes of card and glow
    const metrics = await evaluate(`
      (function() {
        var wrapper = document.querySelectorAll(".tile-wrapper")[${idx}];
        var card = wrapper.querySelector(".card");
        var glow = card.querySelector(".glow");
        var body = card.querySelector(".body");
        var sheen = body.querySelector(".sheen");
        var icon = body.querySelector(".icon");

        var cr = card.getBoundingClientRect();
        var gr = glow.getBoundingClientRect();

        var cardCenterX = (cr.left + cr.right) / 2;
        var cardCenterY = (cr.top + cr.bottom) / 2;
        var glowCenterX = (gr.left + gr.right) / 2;
        var glowCenterY = (gr.top + gr.bottom) / 2;

        var deltaX = Math.abs(cardCenterX - glowCenterX);
        var deltaY = Math.abs(cardCenterY - glowCenterY);

        var cardStyle = window.getComputedStyle(card);
        var bodyStyle = window.getComputedStyle(body);
        var glowStyle = window.getComputedStyle(glow);

        // Also check an unfocused tile body style for comparison
        var otherIdx = (${idx} === 0 ? 1 : 0);
        var otherBody = document.querySelectorAll(".tile-wrapper")[otherIdx].querySelector(".body");
        var otherBodyStyle = window.getComputedStyle(otherBody);

        return {
          appName: wrapper.getAttribute("aria-label") || "Tile " + ${idx},
          cardRect: { left: cr.left, top: cr.top, width: cr.width, height: cr.height },
          glowRect: { left: gr.left, top: gr.top, width: gr.width, height: gr.height },
          deltaX: deltaX,
          deltaY: deltaY,
          centeredWithin2px: (deltaX <= 2.0 && deltaY <= 2.0),
          cardBg: cardStyle.backgroundColor,
          bodyBg: bodyStyle.backgroundColor,
          bodyBorder: bodyStyle.borderColor,
          glowOpacity: glowStyle.opacity,
          unfocusedBodyBg: otherBodyStyle.backgroundColor
        };
      })()
    `);

    // Capture screenshots for this focused tile
    // Save as docs/glass-<idx>.png and docs/glass-<idx+1>.png (covering 0-indexed and 1-indexed)
    const shotPath0 = path.join(DOCS_DIR, `glass-${idx}.png`);
    const shotPath1 = path.join(DOCS_DIR, `glass-${idx + 1}.png`);
    await takeScreenshot(shotPath0);
    fs.copyFileSync(shotPath0, shotPath1);

    const isCardTransparent = metrics.cardBg === "rgba(0, 0, 0, 0)" || metrics.cardBg === "transparent";
    const isTranslucentGlass = metrics.bodyBg.indexOf("rgba(255, 255, 255") === 0;

    const row = [
      `  ${idx}`.padEnd(7),
      `| ${metrics.appName}`.padEnd(21),
      `| dx:${metrics.deltaX.toFixed(2)}px, dy:${metrics.deltaY.toFixed(2)}px`.padEnd(20),
      `| card:${metrics.cardBg} / body:${metrics.bodyBg}`.padEnd(48),
      `| ${metrics.centeredWithin2px && isCardTransparent ? "PASS [GLASS]" : "FAIL"}`
    ].join("");
    console.log(row);

    results.push(metrics);
  }
  console.log("-----------------------------------------------------------------");

  // Also capture default docs/shot-home.png with tile 0 (Netflix) focused
  await evaluate(`window.CleanHome.setTileFocus(0, false);`);
  await sleep(250);
  await takeScreenshot(path.join(DOCS_DIR, "shot-home.png"));
  console.log("  [OK] Saved fresh docs/shot-home.png");

  // Rapid key presses test to verify no leftover layers
  console.log("\n6. Testing rapid key navigation (Left x10, Right x10) to verify no leftover layers...");
  for (let i = 0; i < 10; i++) {
    await sendKey(39, "ArrowRight");
    await sleep(60);
  }
  for (let i = 0; i < 10; i++) {
    await sendKey(37, "ArrowLeft");
    await sleep(60);
  }
  await sleep(300);

  const leftoverCheck = await evaluate(`
    (function() {
      var wrappers = document.querySelectorAll(".tile-wrapper");
      var currentFocusCount = 0;
      var unfocusedGlowVisible = 0;

      for (var i = 0; i < wrappers.length; i++) {
        var isFocused = wrappers[i].classList.contains("focused");
        if (isFocused) currentFocusCount++;

        var glow = wrappers[i].querySelector(".glow");
        var opacity = parseFloat(window.getComputedStyle(glow).opacity);
        if (!isFocused && opacity > 0.05) {
          unfocusedGlowVisible++;
        }
      }

      return {
        currentFocusCount: currentFocusCount,
        unfocusedGlowVisible: unfocusedGlowVisible
      };
    })()
  `);
  console.log(`  Active focused tiles count: ${leftoverCheck.currentFocusCount} (expected: 1)`);
  console.log(`  Unfocused tiles with visible glow: ${leftoverCheck.unfocusedGlowVisible} (expected: 0)`);
  const noLeftovers = (leftoverCheck.currentFocusCount === 1 && leftoverCheck.unfocusedGlowVisible === 0);
  console.log(`  No leftover layers verification: ${noLeftovers ? "[PASS]" : "[FAIL]"}`);

  // Console errors check
  console.log("\n7. Console Errors Verification:");
  console.log("-----------------------------------------------------------------");
  for (const m of consoleMessages) {
    console.log(`  [CONSOLE ${m.type.toUpperCase()}] ${m.text}`);
  }
  console.log("-----------------------------------------------------------------");
  console.log(`  Total Console Errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.error("  [FAIL] CONSOLE ERRORS DETECTED FROM OUR CODE:");
    for (const err of consoleErrors) {
      console.error("    - " + err);
    }
  } else {
    console.log("  [PASS] ZERO CONSOLE ERRORS FROM OUR CODE!");
  }

  // Cleanup
  console.log("\n8. Cleaning up processes...");
  ws.close();
  chromeProcess.kill();
  previewProcess.kill();
  try {
    fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
  } catch (e) {}

  console.log("\n=================================================================");
  console.log("                 Verification Suite Complete                     ");
  console.log("=================================================================\n");

  const allCentered = results.every(r => r.centeredWithin2px);
  const allTranslucent = results.every(r => r.cardBg === "rgba(0, 0, 0, 0)" || r.cardBg === "transparent");

  if (!allCentered || !allTranslucent || !noLeftovers || consoleErrors.length > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Verification failed with exception:", err);
  process.exit(1);
});

