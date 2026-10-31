const websiteText = document.querySelector("#website");
const startButton = document.querySelector("#startButton");
const durationSelect = document.querySelector("#duration");

// Check whether Focus Mode is already active
async function updateButton() {
  try {
    const { session } = await chrome.storage.local.get("session");

    if (session?.isActive && session.endsAt > Date.now()) {
      startButton.textContent = "Stop Focus";
    } else {
      startButton.textContent = "Start Focus";
    }
  } catch (error) {
    console.error("Could not check Focus Mode status:", error);
    startButton.textContent = "Start Focus";
  }
}

// Detect the website currently open
async function detectWebsite() {
  try {
    const tabs = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });

    const tab = tabs[0];

    if (!tab || !tab.id) {
      websiteText.textContent = "Something went wrong...";
      return;
    }

    const currentTab = await chrome.tabs.get(tab.id);

    if (!currentTab.url) {
      websiteText.textContent = "Study website: Unavailable...";
      return;
    }

    const url = new URL(currentTab.url);

    if (url.protocol === "http:" || url.protocol === "https:") {
      websiteText.textContent = `Target: ${url.host}`;
    } else {
      websiteText.textContent = "Please open a website to continue.";
    }
  } catch (error) {
    websiteText.textContent = "Something went wrong...";
    console.error(error);
  }
}

// Run these whenever the popup opens
detectWebsite();
updateButton();

// Handle Start Focus and Stop Focus clicks
startButton.addEventListener("click", async () => {
  startButton.disabled = true;

  try {
    const { session: savedSession } = await chrome.storage.local.get("session");

    // If a session is active, stop it
    if (savedSession?.isActive && savedSession.endsAt > Date.now()) {
      const response = await chrome.runtime.sendMessage({
        type: "STOP_FOCUS",
      });

      if (!response?.ok) {
        throw new Error(response?.error || "Could not stop Focus Mode.");
      }

      startButton.textContent = "Start Focus";
      websiteText.textContent = "Focus Mode is off.";
      return;
    }

    // Get the current tab
    const tabs = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });

    const tab = tabs[0];

    if (!tab || !tab.id) {
      websiteText.textContent = "Something went wrong...";
      return;
    }

    const currentTab = await chrome.tabs.get(tab.id);

    if (!currentTab.url) {
      websiteText.textContent = "Study website: Unavailable...";
      return;
    }

    const url = new URL(currentTab.url);

    // Only allow starting on normal websites
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      websiteText.textContent = "Please open a website to continue.";
      return;
    }

    // Prepare the focus session
    const duration = Number(durationSelect.value);
    const now = Date.now();

    const session = {
      studyWebsite: url.hostname.replace(/^www\./, ""),
      durationMinutes: duration,
      startedAt: now,
      endsAt: now + duration * 60 * 1000,
      isActive: true,
    };

    // Ask background.js to install the blocking rules and save the session
    const response = await chrome.runtime.sendMessage({
      type: "START_FOCUS",
      session: session,
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Could not start Focus Mode.");
    }

    startButton.textContent = "Stop Focus";
    websiteText.textContent = `Target: ${url.host}`;
  } catch (error) {
    console.error("FocusShield error:", error);
    websiteText.textContent = "Something went wrong. Check the console.";
    await updateButton();
  } finally {
    startButton.disabled = false;
  }
});
