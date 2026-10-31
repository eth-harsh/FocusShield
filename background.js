const ALLOW_RULE_ID = 1;
const BLOCK_HTTP_RULE_ID = 2;
const BLOCK_HTTPS_RULE_ID = 3;

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received:", message);

  if (message.type === "START_FOCUS") {
    startFocusRules(message.session.studyWebsite)
      .then(() => chrome.storage.local.set({ session: message.session }))
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        console.error("Could not start Focus Mode:", error);
        sendResponse({ ok: false, error: error.message });
      });

    return true;
  }

  if (message.type === "STOP_FOCUS") {
    stopFocusRules()
      .then(() => chrome.storage.local.remove("session"))
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        console.error("Could not stop Focus Mode:", error);
        sendResponse({ ok: false, error: error.message });
      });

    return true;
  }
});

// Install rules to allow the study site and block other websites
async function startFocusRules(studyWebsite) {
  console.log("Study website:", studyWebsite);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [ALLOW_RULE_ID, BLOCK_HTTP_RULE_ID, BLOCK_HTTPS_RULE_ID],

    addRules: [
      {
        id: ALLOW_RULE_ID,
        priority: 100,
        action: { type: "allow" },
        condition: {
          requestDomains: [studyWebsite],
          resourceTypes: ["main_frame"],
        },
      },
      {
        id: BLOCK_HTTP_RULE_ID,
        priority: 1,
        action: { type: "block" },
        condition: {
          regexFilter: "^http://",
          resourceTypes: ["main_frame"],
        },
      },
      {
        id: BLOCK_HTTPS_RULE_ID,
        priority: 1,
        action: { type: "block" },
        condition: {
          regexFilter: "^https://",
          resourceTypes: ["main_frame"],
        },
      },
    ],
  });

  console.log("Focus rules installed!");
}

// Remove rules when Focus Mode stops
async function stopFocusRules() {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [ALLOW_RULE_ID, BLOCK_HTTP_RULE_ID, BLOCK_HTTPS_RULE_ID],
  });

  console.log("Focus rules removed!");
}
function isStudyUrl(urlString, studyWebsite) {
  try {
    const u = new URL(urlString);
    if (u.protocol !== "http:" && u.protocol !== "https:") return true;
    return (
      u.hostname === studyWebsite || u.hostname.endsWith("." + studyWebsite)
    );
  } catch {
    return true;
  }
}

async function enforceTab(tabId, urlString) {
  const { session } = await chrome.storage.local.get("session");
  if (!session?.isActive || session.endsAt <= Date.now()) return;

  if (!isStudyUrl(urlString, session.studyWebsite)) {
    chrome.tabs.update(tabId, { url: "about:blank" });
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url || tab.url;
  if (url && (changeInfo.url || changeInfo.status === "loading")) {
    enforceTab(tabId, url);
  }
});
