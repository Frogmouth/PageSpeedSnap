"use strict";

const ALL = "querySelectorAll";
const ONE = "querySelector";
let sniffAndClose = false;
let reloadTimeout = null;

let sniffstatus = {
  status: "idle",
  messagge: null,
  errorid: null,
};

//methods

const getTestId = function () {
  return location.pathname.split("/").pop();
};

const injectSniffer = function () {
  if (window.location.href.indexOf("close=1") >= 0) {
    sniffAndClose = true;
  }
  var s = document.createElement("script");
  s.src = chrome.runtime.getURL("injected.js");
  document.body.appendChild(s);
  s.onload = function () {
    s.remove();
  };
};

// Listeners
try {
  chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
      if (request.type === "PAGE-STATUS") {
        console.log("send status to popup --> ", sniffstatus);
        sendResponse(sniffstatus);
      } else {
        sendResponse({});
      }
      return true;
    },
  );
} catch (e) {
  debugger;
}

try {
  document.addEventListener("pss-sniffs", function (event) {
    if (reloadTimeout !== null) {
      console.log("PAGESPEED SNAP - SNIFFER - CLEAR REFRESH TIMEOUT");
      clearTimeout(reloadTimeout);
    }
    console.log("event - pss-sniffs = ", event);
    if (event.detail && (event.detail.mobile || event.detail.desktop)) {
      const oneDate = event.detail.mobile || event.detail.desktop;
      const sniffstate =
        event.detail.mobile && event.detail.desktop ? "completed" : "partial";
      sniffstatus = {
        status: "sending",
        message: "Sniff sending",
        state: sniffstate,
        errorid: null,
      };
      chrome.runtime.sendMessage(
        {
          type: "SNIFF",
          id: getTestId(),
          state:
            event.detail.mobile && event.detail.desktop
              ? "completed"
              : "partial",
          payload: {
            id: getTestId(),
            state:
              event.detail.mobile && event.detail.desktop
                ? "completed"
                : "partial",
            originalurl: oneDate.finalUrl,
            domain: new URL(oneDate.finalUrl).hostname,
            ...event.detail,
          },
        },
        function (response) {
          console.log(response);
          sniffstatus = response;
          if (sniffAndClose) {
            console.log("close tab");
            window.close();
          }
        },
      );
    } else {
      sniffstatus = {
        status: "error",
        message: "Sniff data not found",
        errorid: "missing-required",
      };

      chrome.runtime.sendMessage(
        {
          type: "ERROR",
          ...sniffstatus,
        },
        (response) => {
          console.log(response);
          if (sniffAndClose) {
            console.log("close tab");
            window.close();
          }
        },
      );
    }
  });
} catch (e) {
  debugger;
}

//init
if (window.location.href.indexOf("hl=en") < 0) {
  const url = new URL(window.location.href);
  url.searchParams.set("hl", "en");
  location.href = url.href;
} else {
  injectSniffer();
  if (sniffAndClose) {
    console.log(
      "PAGESPEED SNAP - SNIFFER - SET PAGE REALOAD AFTER 3 MINUTES...",
    );
    reloadTimeout = setTimeout(function () {
      console.log("PAGESPEED SNAP - SNIFFER - RELOADING THE PAGE...");
      location.reload();
    }, 180000);
  }
}
