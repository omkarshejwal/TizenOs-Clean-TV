// tools/test_launcher_unit.js - Verify launcher.js launch failure and launchAppControl fallback logic
const assert = require("assert");

// Setup DOM mock
global.window = {};
global.document = {
  createElement: (tag) => {
    return {
      tagName: tag.toUpperCase(),
      className: "",
      textContent: "",
      classList: { add: () => {}, remove: () => {} }
    };
  },
  getElementById: (id) => {
    return {
      innerHTML: "",
      appendChild: () => {},
      removeChild: () => {},
      contains: () => true,
      classList: { add: () => {}, remove: () => {} }
    };
  }
};

require("../js/launcher.js");

console.log("1. Testing launcher without Tizen (Desktop Preview Mode)...");
window.CleanHome.launchApp({ name: "Netflix", appId: "org.netflix.tv" });
let info = window.CleanHome.getLastLaunchInfo();
console.log("   Last launch info:", info);
assert.strictEqual(info.status, "MOCK_SUCCESS");
assert.strictEqual(info.appId, "org.netflix.tv");

console.log("2. Testing launcher with Tizen launch failure + launchAppControl success...");
let launchCalled = false;
let controlCalled = false;

global.tizen = {
  ApplicationControl: function(op) { this.op = op; },
  application: {
    launch: (appId, onSuccess, onError) => {
      launchCalled = true;
      setTimeout(() => {
        onError({ name: "NotFoundError", message: "Application not installed" });
      }, 10);
    },
    launchAppControl: (ctrl, appId, onSuccess, onError) => {
      controlCalled = true;
      setTimeout(() => {
        onSuccess();
      }, 10);
    }
  }
};

window.CleanHome.launchApp({ name: "YouTube", appId: "com.google.youtube.tv" });

setTimeout(() => {
  assert.strictEqual(launchCalled, true);
  assert.strictEqual(controlCalled, true);
  info = window.CleanHome.getLastLaunchInfo();
  console.log("   Last launch info after launchAppControl:", info);
  assert.strictEqual(info.status, "SUCCESS");
  assert.strictEqual(info.method, "launchAppControl");

  console.log("3. Testing launcher with both Tizen launch AND launchAppControl failure...");
  global.tizen.application.launchAppControl = (ctrl, appId, onSuccess, onError) => {
    setTimeout(() => {
      onError({ name: "SecurityError", message: "Permission denied" });
    }, 10);
  };

  window.CleanHome.launchApp({ name: "Prime Video", appId: "amazon.amazonvideo.amazonvideo" });

  setTimeout(() => {
    info = window.CleanHome.getLastLaunchInfo();
    console.log("   Last launch info after complete failure:", info);
    assert.strictEqual(info.status, "FAILED");
    assert.strictEqual(info.appName, "Prime Video");
    assert.ok(info.error.includes("NotFoundError") || info.error.includes("SecurityError"));

    console.log("   [PASS] All launcher fallback and error tracking unit tests passed successfully!");
  }, 50);
}, 50);
