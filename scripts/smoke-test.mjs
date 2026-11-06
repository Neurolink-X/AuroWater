#!/usr/bin/env node

/**
 * AuroTap — Fast, Safe Deployment Smoke Tests
 *
 * File: scripts/smoke-test.mjs
 *
 * Next.js 16 | Node.js 22+ | Vercel | Supabase
 *
 * FEATURES:
 * - Maximum 3 concurrent requests
 * - Configurable timeout
 * - Bounded retries
 * - HTTP status verification
 * - JSON, HTML, XML, robots.txt validation
 * - Secure redirect verification
 * - Response latency measurement
 * - Optional JSON report for CI
 * - Proper exit codes
 *
 * SAFETY:
 * - GET requests only
 * - No authentication
 * - No database writes
 * - No order creation
 * - No secret logging
 * - No automatic deployments
 *
 * USAGE:
 *   npm run smoke
 *
 * Production:
 *   BASE_URL=https://www.aurotap.in npm run smoke
 *
 * Optional configuration:
 *
 *   SMOKE_CONCURRENCY=3
 *   SMOKE_TIMEOUT_MS=8000
 *   SMOKE_RETRIES=1
 *   SMOKE_SLOW_MS=2500
 *   SMOKE_REPORT_PATH=artifacts/smoke-report.json
 *   SMOKE_OG_IMAGE_PATH=/og-image.png
 *   SMOKE_DASHBOARD_PATH=/dashboard
 *   SMOKE_DASHBOARD_TARGETS=/auth/login,/customer/home
 */

import {
  mkdir,
  writeFile,
} from "node:fs/promises";

import {
  dirname,
  resolve,
} from "node:path";

import {
  performance,
} from "node:perf_hooks";

/* ============================================================
   CONFIGURATION HELPERS
============================================================ */

function integerEnv(
  name,
  fallback,
  min,
  max
) {
  const raw = process.env[name];

  if (
    raw === undefined ||
    raw.trim() === ""
  ) {
    return fallback;
  }

  if (!/^\d+$/.test(raw.trim())) {
    throw new Error(
      `${name} must be an integer`
    );
  }

  const value = Number(raw);

  if (
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new Error(
      `${name} must be between ${min} and ${max}`
    );
  }

  return value;
}

/* ============================================================
   BASE URL VALIDATION
============================================================ */

function getBase() {
  const raw =
    process.env.BASE_URL?.trim() ||
    "http://localhost:3000";

  let url;

  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      "Invalid BASE_URL"
    );
  }

  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error(
      "BASE_URL must be an origin without credentials, path, query or fragment"
    );
  }

  const local = [
    "localhost",
    "127.0.0.1",
    "[::1]",
  ].includes(url.hostname);

  if (
    url.protocol !== "https:" &&
    !(local && url.protocol === "http:")
  ) {
    throw new Error(
      "BASE_URL requires HTTPS unless using localhost"
    );
  }

  return url.origin;
}

/* ============================================================
   SAFE ROUTE VALIDATION
============================================================ */

function safePath(raw, name) {
  if (
    typeof raw !== "string" ||
    !raw.startsWith("/") ||
    raw.startsWith("//")
  ) {
    throw new Error(
      `${name} must be a same-origin absolute path`
    );
  }

  const url = new URL(
    raw,
    "https://local.invalid"
  );

  if (
    url.origin !== "https://local.invalid" ||
    url.hash ||
    url.search
  ) {
    throw new Error(
      `${name} must not contain a query, fragment or another origin`
    );
  }

  return url.pathname;
}

/* ============================================================
   MAIN CONFIGURATION
============================================================ */

function config() {
  const base = getBase();

  const concurrency = integerEnv(
    "SMOKE_CONCURRENCY",
    3,
    1,
    3
  );

  const timeoutMs = integerEnv(
    "SMOKE_TIMEOUT_MS",
    8000,
    1000,
    30000
  );

  const retries = integerEnv(
    "SMOKE_RETRIES",
    1,
    0,
    2
  );

  const slowMs = integerEnv(
    "SMOKE_SLOW_MS",
    2500,
    100,
    30000
  );

  const dashboardTargets = (
    process.env.SMOKE_DASHBOARD_TARGETS ||
    "/auth/login,/customer/home"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) =>
      safePath(
        value,
        "SMOKE_DASHBOARD_TARGETS"
      )
    );

  if (dashboardTargets.length === 0) {
    throw new Error(
      "At least one dashboard redirect target is required"
    );
  }

  return {
    base,
    concurrency,
    timeoutMs,
    retries,
    slowMs,

    reportPath:
      process.env.SMOKE_REPORT_PATH?.trim() ||
      null,

    checks: [
      {
        path: "/",
        label: "Homepage",
        type: "html",
      },

      {
        path: "/api/settings",
        label: "Public settings",
        type: "json",
      },

      {
        path: "/sitemap.xml",
        label: "Sitemap",
        type: "sitemap",
      },

      {
        path: "/robots.txt",
        label: "Robots",
        type: "robots",
      },

      {
        path: safePath(
          process.env.SMOKE_OG_IMAGE_PATH ||
            "/og-image.png",
          "SMOKE_OG_IMAGE_PATH"
        ),
        label: "Social image",
        type: "image",
      },

      {
        path: safePath(
          process.env.SMOKE_DASHBOARD_PATH ||
            "/dashboard",
          "SMOKE_DASHBOARD_PATH"
        ),

        label: "Legacy dashboard",
        type: "redirect",
        dashboardTargets,
      },
    ],
  };
}

/* ============================================================
   RETRY CONFIGURATION
============================================================ */

const transientStatuses = new Set([
  408,
  429,
  500,
  502,
  503,
  504,
]);

function sleep(ms) {
  return new Promise((done) => {
    setTimeout(done, ms);
  });
}

/* ============================================================
   MEMORY-SAFE RESPONSE READING
============================================================ */

/**
 * Read a limited response prefix.
 *
 * Avoid loading very large responses
 * into memory.
 *
 * Never print response bodies or secrets.
 */

async function readPrefix(
  response,
  maxBytes = 65536
) {
  if (!response.body) {
    return "";
  }

  const reader =
    response.body.getReader();

  const decoder =
    new TextDecoder();

  let text = "";
  let bytes = 0;

  try {
    while (bytes < maxBytes) {
      const {
        done,
        value,
      } = await reader.read();

      if (done) {
        break;
      }

      const chunk = value.subarray(
        0,
        maxBytes - bytes
      );

      bytes += chunk.length;

      text += decoder.decode(
        chunk,
        {
          stream: true,
        }
      );

      if (bytes >= maxBytes) {
        break;
      }
    }

    text += decoder.decode();
  } finally {
    await reader.cancel().catch(() => {});
  }

  return text;
}

/* ============================================================
   RESPONSE VALIDATION
============================================================ */

function validate(
  response,
  check,
  body,
  requestUrl
) {
  const contentType = (
    response.headers.get(
      "content-type"
    ) || ""
  ).toLowerCase();

  const status = response.status;

  /* ----------------------------------------------------------
     REDIRECT VALIDATION
  ---------------------------------------------------------- */

  if (check.type === "redirect") {
    const allowedStatuses = [
      301,
      302,
      303,
      307,
      308,
    ];

    if (
      !allowedStatuses.includes(status)
    ) {
      return (
        `Expected dashboard redirect, ` +
        `got HTTP ${status}`
      );
    }

    const location =
      response.headers.get(
        "location"
      );

    if (!location) {
      return "Redirect missing Location header";
    }

    let destination;

    try {
      destination = new URL(
        location,
        requestUrl
      );
    } catch {
      return "Invalid redirect destination";
    }

    const validOrigin =
      destination.origin ===
      requestUrl.origin;

    const validPath =
      check.dashboardTargets.includes(
        destination.pathname
      );

    const noQuery =
      !destination.search;

    const noFragment =
      !destination.hash;

    if (
      !validOrigin ||
      !validPath ||
      !noQuery ||
      !noFragment
    ) {
      return (
        "Redirect destination is not " +
        "an approved same-origin path"
      );
    }

    return null;
  }

  /* ----------------------------------------------------------
     STATUS VALIDATION
  ---------------------------------------------------------- */

  if (status !== 200) {
    return (
      `Expected HTTP 200, got ${status}`
    );
  }

  /* ----------------------------------------------------------
     IMAGE VALIDATION
  ---------------------------------------------------------- */

  if (check.type === "image") {
    return contentType.startsWith(
      "image/"
    )
      ? null
      : "Expected image Content-Type";
  }

  /* ----------------------------------------------------------
     JSON VALIDATION
  ---------------------------------------------------------- */

  if (check.type === "json") {
    const validType =
      contentType.includes(
        "application/json"
      ) ||
      contentType.includes("+json");

    if (!validType) {
      return "Expected JSON Content-Type";
    }

    try {
      const parsed =
        JSON.parse(body);

      if (
        parsed === null ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        return "Expected JSON object";
      }

      if (
        parsed.ok === false ||
        parsed.success === false
      ) {
        return "API reported failure";
      }
    } catch {
      return (
        "Malformed or oversized JSON response"
      );
    }

    return null;
  }

  /* ----------------------------------------------------------
     HTML VALIDATION
  ---------------------------------------------------------- */

  if (check.type === "html") {
    if (
      !contentType.includes(
        "text/html"
      )
    ) {
      return "Expected HTML Content-Type";
    }

    return /<html\b/i.test(body)
      ? null
      : "Missing HTML document element";
  }

  /* ----------------------------------------------------------
     SITEMAP VALIDATION
  ---------------------------------------------------------- */

  if (check.type === "sitemap") {
    if (
      !contentType.includes("xml")
    ) {
      return "Expected XML Content-Type";
    }

    const sitemapPattern =
      /<(?:\w+:)?(?:urlset|sitemapindex)\b/i;

    return sitemapPattern.test(body)
      ? null
      : "Missing sitemap root element";
  }

  /* ----------------------------------------------------------
     ROBOTS.TXT VALIDATION
  ---------------------------------------------------------- */

  if (check.type === "robots") {
    if (
      !contentType.includes(
        "text/plain"
      )
    ) {
      return "Expected text/plain Content-Type";
    }

    const robotsPattern =
      /^\s*(?:#.*\n\s*)*(?:user-agent|sitemap)\s*:/im;

    return robotsPattern.test(body)
      ? null
      : "Missing robots directives";
  }

  return "Unknown check type";
}

/* ============================================================
   SINGLE REQUEST EXECUTION
============================================================ */

async function tryOnce(
  base,
  check,
  timeoutMs
) {
  const requestUrl =
    new URL(check.path, base);

  const started =
    performance.now();

  const response = await fetch(
    requestUrl,
    {
      method: "GET",

      redirect: "manual",

      cache: "no-store",

      signal:
        AbortSignal.timeout(
          timeoutMs
        ),

      headers: {
        Accept:
          check.type === "json"
            ? "application/json"
            : "*/*",
      },
    }
  );

  const status =
    response.status;

  const needsBody =
    ![
      "image",
      "redirect",
    ].includes(check.type) &&
    status === 200;

  const body = needsBody
    ? await readPrefix(response)
    : "";

  if (!needsBody) {
    await response.body
      ?.cancel()
      .catch(() => {});
  }

  const latencyMs = Math.round(
    performance.now() - started
  );

  const reason = validate(
    response,
    check,
    body,
    requestUrl
  );

  return {
    ok: reason === null,
    status,
    latencyMs,
    reason,
  };
}

/* ============================================================
   BOUNDED RETRY EXECUTION
============================================================ */

async function checkOne(
  cfg,
  check
) {
  const started =
    performance.now();

  let last = {
    ok: false,
    status: null,
    latencyMs: 0,
    reason: "Not checked",
  };

  let attempts = 0;

  for (
    let index = 0;
    index <= cfg.retries;
    index++
  ) {
    attempts = index + 1;

    try {
      last = await tryOnce(
        cfg.base,
        check,
        cfg.timeoutMs
      );

      if (
        last.ok ||
        !transientStatuses.has(
          last.status
        )
      ) {
        break;
      }
    } catch (error) {
      last = {
        ok: false,
        status: null,
        latencyMs: 0,

        reason:
          error?.name ===
            "TimeoutError" ||
          error?.name ===
            "AbortError"
            ? "Request timeout"
            : "Network request failed",
      };
    }

    if (
      index < cfg.retries
    ) {
      await sleep(
        250 * (index + 1)
      );
    }
  }

  return {
    path: check.path,
    label: check.label,

    ok: last.ok,
    status: last.status,
    attempts,

    latencyMs:
      last.latencyMs,

    elapsedMs: Math.round(
      performance.now() - started
    ),

    slow:
      last.ok &&
      last.latencyMs >
        cfg.slowMs,

    reason: last.reason,
  };
}

/* ============================================================
   CONCURRENCY-LIMITED WORKER POOL
============================================================ */

/**
 * Run up to 3 requests concurrently.
 *
 * Benefits:
 * - Faster than sequential tests
 * - Avoids excessive request bursts
 * - Stable result ordering
 * - Bounded resource usage
 */

async function runPool(cfg) {
  const output = new Array(
    cfg.checks.length
  );

  let nextIndex = 0;

  async function worker() {
    while (
      nextIndex <
      cfg.checks.length
    ) {
      const index =
        nextIndex++;

      output[index] =
        await checkOne(
          cfg,
          cfg.checks[index]
        );
    }
  }

  const workers =
    Array.from(
      {
        length: Math.min(
          cfg.concurrency,
          cfg.checks.length
        ),
      },
      () => worker()
    );

  await Promise.all(workers);

  return output;
}

/* ============================================================
   MAIN SMOKE TEST RUNNER
============================================================ */

async function main() {
  const cfg = config();

  console.log("");
  console.log(
    "AUROTAP — DEPLOYMENT SMOKE TEST"
  );
  console.log(
    "--------------------------------"
  );

  console.log(
    `Target: ${cfg.base}`
  );

  console.log(
    `Concurrency: ${cfg.concurrency}`
  );

  console.log(
    `Timeout: ${cfg.timeoutMs}ms`
  );

  console.log(
    `Retries: ${cfg.retries}`
  );

  console.log("");

  const started =
    performance.now();

  const checks =
    await runPool(cfg);

  /* ----------------------------------------------------------
     PRINT RESULTS
  ---------------------------------------------------------- */

  for (const result of checks) {
    const state =
      !result.ok
        ? "FAIL"
        : result.slow
          ? "SLOW"
          : "PASS";

    console.log(
      `${state.padEnd(4)} ` +
      `${String(
        result.status ?? "NET"
      ).padEnd(3)} ` +
      `${String(
        result.latencyMs
      ).padStart(5)}ms ` +
      `${result.label} ` +
      `(${result.attempts} attempt(s))` +
      (
        result.reason
          ? ` — ${result.reason}`
          : ""
      )
    );
  }

  /* ----------------------------------------------------------
     CALCULATE SUMMARY
  ---------------------------------------------------------- */

  const failed = checks.filter(
    (check) => !check.ok
  ).length;

  const slow = checks.filter(
    (check) => check.slow
  ).length;

  const durationMs =
    Math.round(
      performance.now() - started
    );

  const latencies = checks
    .filter(
      (check) => check.ok
    )
    .map(
      (check) => check.latencyMs
    )
    .sort(
      (a, b) => a - b
    );

  const highestLatencyMs =
    latencies.at(-1) ?? null;

  const report = {
    schemaVersion: 1,

    testedAt:
      new Date().toISOString(),

    baseUrl: cfg.base,

    total: checks.length,

    passed:
      checks.length - failed,

    failed,
    slow,

    durationMs,
    highestLatencyMs,

    checks,
  };

  console.log("");
  console.log(
    "SMOKE TEST SUMMARY"
  );

  console.log(
    "--------------------------------"
  );

  console.log(
    `Passed: ${report.passed}/${report.total}`
  );

  console.log(
    `Failed: ${failed}`
  );

  console.log(
    `Slow: ${slow}`
  );

  console.log(
    `Total execution: ${durationMs}ms`
  );

  if (
    highestLatencyMs !== null
  ) {
    console.log(
      `Highest endpoint latency: ${highestLatencyMs}ms`
    );
  }

  console.log(
    "--------------------------------"
  );

  /* ----------------------------------------------------------
     OPTIONAL JSON REPORT
  ---------------------------------------------------------- */

  if (cfg.reportPath) {
    const path = resolve(
      cfg.reportPath
    );

    await mkdir(
      dirname(path),
      {
        recursive: true,
      }
    );

    await writeFile(
      path,

      JSON.stringify(
        report,
        null,
        2
      ) + "\n",

      {
        encoding: "utf8",
        mode: 0o600,
      }
    );

    console.log(
      "JSON report saved."
    );
  }

  /* ----------------------------------------------------------
     CI EXIT STATUS
  ---------------------------------------------------------- */

  if (failed > 0) {
    console.error(
      "RESULT: FAILED"
    );

    process.exitCode = 1;
    return;
  }

  console.log(
    "RESULT: PASSED"
  );

  if (slow > 0) {
    console.warn(
      "Performance warnings detected."
    );
  }

  console.log(
    "Public smoke checks passed."
  );

  console.log(
    "Authentication, booking, payment and database correctness were not tested."
  );
}

/* ============================================================
   TOP-LEVEL ERROR HANDLING
============================================================ */

main().catch((error) => {
  console.error(
    "Smoke test setup or reporting failed:",
    error instanceof Error
      ? error.message
      : "Unknown error"
  );

  process.exitCode = 1;
});
