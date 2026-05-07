// Calendesk Subscription Renewal Feature
window.CalendeskRenewalFeature = (function () {
  // Private variables
  let initialized = false;
  let observer = null;
  let lastInitializedUrl = "";
  let stylesInjected = false;

  // Public API
  const publicAPI = {
    init: function () {
      // Check if URL changed to handle navigation
      const currentUrl = window.location.href;
      const needsReinitialization = currentUrl !== lastInitializedUrl;

      if (initialized && !needsReinitialization) return;

      // If already initialized but URL changed, reset and reinitialize
      if (initialized && needsReinitialization) {
        resetState();
      }

      // Update last initialized URL
      lastInitializedUrl = currentUrl;

      // Try immediate initialization
      if (document.readyState !== "loading") {
        tryInitialize();
      }

      // Standard DOM ready listeners
      document.addEventListener("DOMContentLoaded", tryInitialize);
      window.addEventListener("load", tryInitialize);

      // Set up MutationObserver to watch for navigation changes
      setupMutationObserver();
    },

    // Method to force reinitialization
    reinitialize: function () {
      resetState();
      this.init();
    },
  };

  function resetState() {
    initialized = false;

    // Clean up any existing observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    // Remove existing renewal containers to prevent duplicates
    const existingContainers = document.querySelectorAll(".renew-wrapper");
    existingContainers.forEach((wrapper) => {
      const container = wrapper.closest(".container");
      if (container) {
        container.remove();
      } else {
        wrapper.remove();
      }
    });
  }

  function tryInitialize() {
    // Only run on subscriptions page
    if (window.location.pathname !== "/subscriptions") {
      return;
    }

    if (initialized) return;

    // Check if renewal section already exists to prevent duplicates
    if (document.querySelector(".renew-wrapper")) {
      initialized = true;
      return;
    }

    // Check if we have the required token
    const token = localStorage.getItem("accessToken");
    if (!token) {
      return;
    }

    initializeRenewalFeature(token);
  }

  function setupMutationObserver() {
    if (!window.MutationObserver) {
      return;
    }

    observer = new MutationObserver(function () {
      // Check if we navigated to subscriptions page
      if (window.location.pathname === "/subscriptions" && !initialized) {
        tryInitialize();
      }
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  async function initializeRenewalFeature(token) {
    if (initialized) return;

    try {
      // Inject styles only once
      if (!stylesInjected) {
        injectStyles();
        stylesInjected = true;
      }

      // Fetch all subscriptions
      const resp = await fetch(
        "https://api.calendesk.com/api/v2/user/subscriptions?page=1&limit=100",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Tenant": "slawomir-mentzen-rvs",
            Accept: "application/json",
          },
        },
      );

      if (!resp.ok) {
        return;
      }

      const { data } = await resp.json();

      // Renewal mapping groups:
      // - If user has ANY canceled subscription in the group -> show renew for targetId
      // - If user has ANY active subscription in the group -> do NOT show renew for targetId
      const renewalGroups = [
        // Pakiety: Nowy Mentzen+
        { ids: [233, 269, 432], targetId: 432 },
        { ids: [235, 434], targetId: 434 },
        { ids: [234, 433], targetId: 433 },
        { ids: [241, 436], targetId: 436 },
        { ids: [242, 437], targetId: 437 },
        { ids: [240, 270, 435], targetId: 435 },
        // Pakiety: Mentzen+ IT
        { ids: [86, 190], targetId: 190 },
        { ids: [90, 191], targetId: 191 },
        { ids: [88, 197], targetId: 197 },
        { ids: [87, 196], targetId: 196 },
        { ids: [89, 194], targetId: 194 },
        { ids: [91, 195], targetId: 195 },
        { ids: [158, 198], targetId: 198 },
        { ids: [159, 199], targetId: 199 },
      ];

      // Allowed IDs set (derived from mapping groups)
      const allowedIds = new Set();
      renewalGroups.forEach((group) => {
        group.ids.forEach((id) => allowedIds.add(id));
      });

      // Normalize & filter to only allowed subscriptions
      const subs = data
        .map((s) => ({
          ...s,
          subscription_id: Number(s.subscription_id),
          status: String(s.status || "").toLowerCase(),
        }))
        .filter((s) => allowedIds.has(s.subscription_id));

      // Build status/name flags by subscription_id
      const idFlags = new Map();
      subs.forEach((s) => {
        const id = s.subscription_id;
        let flags = idFlags.get(id);
        if (!flags) {
          flags = { hasActive: false, hasCanceled: false, name: null };
          idFlags.set(id, flags);
        }

        if (s.status === "active") flags.hasActive = true;
        if (s.status === "canceled") flags.hasCanceled = true;
        if (
          s.subscription &&
          typeof s.subscription.name === "string" &&
          s.subscription.name.trim()
        ) {
          flags.name = s.subscription.name;
        }
      });

      // Decide which target subscriptions to show for renewal
      const renewEntries = [];
      renewalGroups.forEach((group) => {
        const hasCanceledInGroup = group.ids.some((id) => {
          const flags = idFlags.get(id);
          return flags ? flags.hasCanceled : false;
        });

        const hasActiveInGroup = group.ids.some((id) => {
          const flags = idFlags.get(id);
          return flags ? flags.hasActive : false;
        });

        if (hasCanceledInGroup && !hasActiveInGroup) {
          // Try to find a name from any ID in the group (prefer target first)
          let groupName = null;
          const targetFlags = idFlags.get(group.targetId);
          if (targetFlags && targetFlags.name) {
            groupName = targetFlags.name;
          } else {
            // Fallback: use name from any other ID in the group
            for (const id of group.ids) {
              const flags = idFlags.get(id);
              if (flags && flags.name) {
                groupName = flags.name;
                break;
              }
            }
          }
          const label = groupName
            ? `⟳ Odnów "${groupName}"`
            : `⟳ Odnów subskrypcję (${group.targetId})`;
          renewEntries.push({ targetId: group.targetId, label });
        }
      });

      if (renewEntries.length === 0) {
        initialized = true;
        return; // nothing to show
      }

      // Build and insert the renewal UI
      buildRenewalUI(renewEntries);

      initialized = true;
    } catch (err) {
      // Silent fail in production
    }
  }

  function injectStyles() {
    const style = document.createElement("style");
    style.id = "calendesk-renewal-styles";
    style.textContent = `
      .renew-wrapper {
        background: #fff;
        padding: 1rem;
        padding-bottom: 0;
        max-width: 1200px;
      }
      .renew-buttons-container {
        display: grid;
        gap: 0.75rem;
        margin-top: 0.75rem;
        justify-content: left;
      }
      .renew-buttons-container a {
        display: block;
        padding: 0.6rem 1rem;
        background: #007BFF;
        color: #fff;
        text-align: center;
        text-decoration: none;
        border-radius: 4px;
        font-size: 0.9rem;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        transition: background 0.2s ease, transform 0.1s ease;
        width: 100%;
        box-sizing: border-box;
      }
      .renew-buttons-container a:hover {
        background: #0056b3;
        transform: translateY(-1px);
      }
    `;

    // Remove existing styles to prevent duplicates
    const existingStyles = document.getElementById("calendesk-renewal-styles");
    if (existingStyles) {
      existingStyles.remove();
    }

    document.head.appendChild(style);
  }

  function buildRenewalUI(renewList) {
    // Check if renewal UI already exists
    if (document.querySelector(".renew-wrapper")) {
      return;
    }

    // Build container > wrapper > grid
    const container = document.createElement("div");
    container.className = "container";

    const wrapper = document.createElement("div");
    wrapper.className = "renew-wrapper";

    const title = document.createElement("div");
    title.className = "text-h4";
    title.textContent = "Odnów subskrypcje";
    wrapper.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "renew-buttons-container";

    renewList.forEach((item) => {
      const a = document.createElement("a");
      a.href = `https://subskrypcje.mentzen.pl/subscription/${item.targetId}`;
      a.textContent = item.label;
      grid.appendChild(a);
    });

    wrapper.appendChild(grid);
    container.appendChild(wrapper);

    // Insert into DOM
    const navbar = document.querySelector(".navbar1");
    if (navbar) {
      navbar.insertAdjacentElement("afterend", container);
    } else {
      document.body.prepend(container);
    }
  }

  // Set up navigation detection
  function setupNavigationListeners() {
    let navigationTimeout;

    function handleNavigation() {
      clearTimeout(navigationTimeout);
      navigationTimeout = setTimeout(() => {
        publicAPI.reinitialize();
      }, 300);
    }

    // Monitor History API
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function () {
      originalPushState.apply(this, arguments);
      handleNavigation();
    };

    window.history.replaceState = function () {
      originalReplaceState.apply(this, arguments);
      handleNavigation();
    };

    // Handle back/forward navigation
    window.addEventListener("popstate", handleNavigation);

    // For hash-based routing
    window.addEventListener("hashchange", handleNavigation);
  }

  // Initialize navigation listeners
  setupNavigationListeners();

  return publicAPI;
})();

// Auto-initialize
window.CalendeskRenewalFeature.init();

// Helper function for debugging
window.checkRenewalFeature = function () {
  if (window.location.pathname === "/subscriptions") {
    const renewalWrapper = document.querySelector(".renew-wrapper");
    if (!renewalWrapper) {
      console.warn("Renewal feature not found, reinitializing...");
      window.CalendeskRenewalFeature.reinitialize();
      return false;
    }
    console.log("Renewal feature is working correctly");
    return true;
  } else {
    console.log("Not on subscriptions page");
    return true;
  }
};
