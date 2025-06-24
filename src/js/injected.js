console.log("PAGESPEED SNAP - SNIFFER");
window.mobileConsistencyVersion = null;
window.desktopConsistencyVersion = null;
//  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- METHODS

const debounce = function (func, timeout = 3000) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
};

const getSniffVersion = function (data) {
  return `${data.fetchTime}-${encodeURIComponent(data.finalUrl)}`;
};

//  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- DOM SNIFFER

const SELECTORS = {
  TABS: '[role="tabpanel"]',
  URL: "input[name=url]",
  DATE: ".lh-report-icon--date",
  VITALS_GENERAL: 'img[src*="cwv_"]',
  VITALS_METIRCS: (metric) => `[href*="${metric}"]`,
  PERFORMANCE_GENERAL: ".lh-exp-gauge__percentage",
  PERFORMANCE_METRICS: ".lh-metric",
  DIAGNOSTCICS: ".lh-audit-group--diagnostics .lh-audit",
  ORIGINBUTTON: "button + button",
};

const SECONDARY_SELECTORS = {
  PERFORMANCE_LABEL: ".lh-metric__title",
  PERFORMANCE_VALUE: ".lh-metric__value",
  DIAGNOSTCICS_LABEL: ".lh-audit__display-text",
  DIAGNOSTCICS_LABEL: ".lh-audit__title",
  PARTIALCLASS_PASS: "--pass",
  PARTIALCLASS_FAIL: "--fail",
  PARTIALCLASS_AVERAGE: "--average",
};

const DOMsniffer = function () {
  const ONE = "querySelector";
  const ALL = "querySelectorAll";
  const PANELS = document.querySelectorAll(SELECTORS.TABS);

  const vitalsTrashold = {
    lcp: [2.5, 4],
    inp: [200, 500],
    cls: [0.1, 0.25],
    fcp: [1.8, 3],
    ttfb: [0.8, 1.8],
  };

  let result = {};

  PANELS.forEach((pan) => {
    const labelPanName = pan.getAttribute("aria-labelledby");
    const panName = labelPanName.indexOf("mobile") >= 0 ? "mobile" : "desktop";

    const originButton = pan[ALL](SELECTORS.ORIGINBUTTON)?.[0];

    //grab vitals
    result[panName] = {
      general:
        pan[ONE](SELECTORS.VITALS_GENERAL).nextElementSibling[ONE]("span")
          ?.innerText || null,
      origin: originButton ? originButton.classList?.length === 2 : null,
      metrics: {},
    };

    if (result[panName].origin) {
      if (!originButton.previousElementSibling?.disabled) {
        // eslint-disable-next-line prettier/prettier
        throw new Error(`PAGESPEED SNAP - SNIFFER - [ERROR] please slect "This URL" instead of "Origin" on  ${panName.toUpperCase()} vitals tab`);
      } else {
        console.log(
          `PAGESPEED SNAP - SNIFFER - [WARN] ${panName.toUpperCase()} USE "ORIGIN" `,
        );
      }
    }

    Object.keys(vitalsTrashold).forEach(function (metric) {
      const $vitalTitle = pan[ONE](SELECTORS.VITALS_METIRCS(metric));
      const $vitalValue = $vitalTitle?.parentElement.nextElementSibling;
      const cleanedText = $vitalValue?.innerText.split("Page")[0] || null;
      const value = parseFloat(cleanedText);

      result[panName].metrics[metric] = {
        id: metric,
        label: $vitalTitle?.innerText.split(" (")[0] || null,
        display: cleanedText,
        value: value || null,
        assessment: !value
          ? null
          : value <= vitalsTrashold[metric][0]
            ? "good"
            : value <= vitalsTrashold[metric][1]
              ? "average"
              : "bad",
        percentages:
          $vitalValue?.children?.[$vitalValue.children.length - 1]?.innerText
            .match(/\d+%/g)
            ?.map((p) => ({ displayValue: p, value: parseInt(p) })) || [],
      };
    });
  });

  return result;
};

//  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- SAVE DATA

const sniffer = function () {
  let currentMobileConsistencyVersion = null;
  let mobileNewVersion = false;
  let currentDesktopConsistencyVersion = null;
  let desktopNewVersion = false;

  if (window.__LIGHTHOUSE_MOBILE_JSON__) {
    currentMobileConsistencyVersion = getSniffVersion(
      window.__LIGHTHOUSE_MOBILE_JSON__,
    );
    mobileNewVersion =
      currentMobileConsistencyVersion !== window.mobileConsistencyVersion;
  } else {
    console.log("PAGESPEED SNAP - SNIFFER - MOBILE missing metrics");
    return false;
  }
  if (window.__LIGHTHOUSE_DESKTOP_JSON__) {
    currentDesktopConsistencyVersion = getSniffVersion(
      window.__LIGHTHOUSE_DESKTOP_JSON__,
    );
    desktopNewVersion =
      currentDesktopConsistencyVersion !== window.desktopConsistencyVersion;
  } else {
    console.log("PAGESPEED SNAP - SNIFFER - DESKTOP missing metrics");
    return false;
  }

  if (desktopNewVersion || mobileNewVersion) {
    let perfMobile = {};
    let perfDesktop = {};

    if (desktopNewVersion) {
      perfDesktop =
        (window.__LIGHTHOUSE_DESKTOP_JSON__ && {
          ...window.__LIGHTHOUSE_DESKTOP_JSON__,
        }) ||
        {};
      console.log(
        "PAGESPEED SNAP - SNIFFER - sent new DESKTOP version: ",
        window.desktopConsistencyVersion,
        " --> ",
        currentDesktopConsistencyVersion,
      );
      window.desktopConsistencyVersion = currentDesktopConsistencyVersion;
    }

    if (mobileNewVersion) {
      perfMobile =
        (window.__LIGHTHOUSE_MOBILE_JSON__ && {
          ...window.__LIGHTHOUSE_MOBILE_JSON__,
        }) ||
        {};
      console.log(
        "PAGESPEED SNAP - SNIFFER - sent new MOBILE version: ",
        window.mobileConsistencyVersion,
        " --> ",
        currentMobileConsistencyVersion,
      );
      window.mobileConsistencyVersion = currentMobileConsistencyVersion;
    }

    let mobileVitals = {};
    let desktopVitals = {};

    try {
      console.log("PAGESPEED SNAP - SNIFFER - DOM sniff...");
      const vitalsResult = DOMsniffer();
      mobileVitals.vitals = { ...vitalsResult.mobile };
      desktopVitals.vitals = { ...vitalsResult.desktop };
    } catch (e) {
      console.log(e);
    }

    console.log("PAGESPEED SNAP - SNIFFER - EVENT sending...");

    let event = new CustomEvent("pss-sniffs", {
      bubbles: true,
      cancelable: true,
      detail: {
        snifferVersions: {
          vitals: "1.0.0",
          performance: "1.0.0",
        },
        mobileSnifferVersion: currentMobileConsistencyVersion,
        desktopSnifferVersion: currentDesktopConsistencyVersion,
        desktop: { ...perfDesktop, ...desktopVitals },
        mobile: { ...perfMobile, ...mobileVitals },
      },
    });

    document.dispatchEvent(event);
  }
};

const updateData = debounce(function () {
  console.log("PAGESPEED SNAP - SNIFFER - SNIFFIG...");
  sniffer();
});

//  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- WINDOW VARIABLES SNIFFER

if (window.__LIGHTHOUSE_MOBILE_JSON__)
  window.__LIGHTHOUSE_MOBILE_JSON__temp = {
    ...window.__LIGHTHOUSE_MOBILE_JSON__,
  };
if (window.__LIGHTHOUSE_DESKTOP_JSON__)
  window.__LIGHTHOUSE_DESKTOP_JSON__temp = {
    ...window.__LIGHTHOUSE_DESKTOP_JSON__,
  };

Object.defineProperties(window, {
  __LIGHTHOUSE_MOBILE_JSON__: {
    set: function (val) {
      this.__LIGHTHOUSE_MOBILE_JSON__temp = val;
      console.log("PAGESPEED SNAP - SNIFFER - MOBILE metric updates");
      setTimeout(updateData, 0);
    },
    get: function () {
      return this.__LIGHTHOUSE_MOBILE_JSON__temp;
    },
  },
});

Object.defineProperties(window, {
  __LIGHTHOUSE_DESKTOP_JSON__: {
    set: function (val) {
      this.__LIGHTHOUSE_DESKTOP_JSON__temp = val;
      console.log("PAGESPEED SNAP - SNIFFER - DESKTOP metric updates");
      setTimeout(updateData, 0);
    },
    get: function () {
      return this.__LIGHTHOUSE_DESKTOP_JSON__temp;
    },
  },
});

if (window.__LIGHTHOUSE_MOBILE_JSON__temp)
  window.__LIGHTHOUSE_MOBILE_JSON__ = {
    ...window.__LIGHTHOUSE_MOBILE_JSON__temp,
  };
if (window.__LIGHTHOUSE_DESKTOP_JSON__temp)
  window.__LIGHTHOUSE_DESKTOP_JSON__ = {
    ...window.__LIGHTHOUSE_DESKTOP_JSON__temp,
  };
