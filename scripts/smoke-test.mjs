
#!/usr/bin/env node

/**
 * AUROTAP — PRODUCTION-SAFE SMOKE TEST
 *
 * Next.js 16 | Node.js 22+ | Vercel | Supabase
 *
 * Purpose:
 * - Verify public routes and API availability
 * - Validate HTTP status and response content
 * - Check canonical redirect destination
 * - Detect unexpected error responses
 * - Measure request latency
 * - Apply bounded retries for transient failures
 * - Return correct CI exit codes
 *
 * SAFETY:
 * - GET requests only
 * - No authentication
 * - No database writes
 * - No order creation
 * - No secret logging
 * - No automatic fixes or deployments
 *
 * Usage:
 *   npm run smoke
 *
 * Remote:
 *   BASE_URL=https://www.aurotap.in npm run smoke
 */

const DEFAULT_BASE = "http://localhost:3000";

const TIMEOUT_MS = 8000;
const RETRY_DELAY_MS = 350;
const MAX_ATTEMPTS = 2;

// Advisory performance budget, not a hard failure.
const SLOW_RESPONSE_MS = 2500;

// Limit how much response content is inspected.
const MAX_BODY_BYTES = 64 * 1024;

const RETRYABLE_STATUSES = new Set([
  429,
  502,
  503,
  504,
]);

const results = [];

/**
 * Validate the target.
 *
 * Prevent credentials in URLs.
 * Require HTTPS for remote environments.
 */
function getBaseUrl() {
  const raw =
    process.env.BASE_URL?.trim() || DEFAULT_BASE;

  let url;

  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid BASE_URL.");
  }

  if (url.username || url.password) {
    throw new Error(
      "BASE_URL must not contain credentials."
    );
  }

  if (url.search || url.hash) {
    throw new Error(
      "BASE_URL must not contain query or fragment."
    );
  }

  if (url.pathname !== "/") {
    throw new Error(
      "BASE_URL must be the site origin."
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
      "Use HTTPS for non-local smoke tests."
    );
  }

  return url.origin;
}

/**
 * Simple delay between retry attempts.
 */
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Read only a limited response prefix.
 *
 * Avoid downloading unnecessarily large
 * HTML or API responses into memory.
 */
async function readPrefix(response) {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;

  try {
    while (total < MAX_BODY_BYTES) {
      const { done, value } = await reader.read();

      if (done) break;

      const remaining = MAX_BODY_BYTES - total;
      const chunk = value.subarray(0, remaining);

      chunks.push(chunk);
      total += chunk.byteLength;

      if (total >= MAX_BODY_BYTES) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  const bytes = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(bytes);
}

/**
 * Check content type.
 */
function matchesContentType(response, expected) {
  const contentType = (
    response.headers.get("content-type") || ""
  ).toLowerCase();

  switch (expected) {
    case "json":
      return contentType.includes("application/json");

    case "html":
      return contentType.includes("text/html");

    case "xml":
      return (
        contentType.includes("xml")
      );

    case "text":
      return (
        contentType.includes("text/plain")
      );

    case "image":
      return contentType.startsWith("image/");

    default:
      return false;
  }
}

/**
 * Basic API and page validation.
 *
 * This is deliberately lightweight.
 * It does not replace API contract tests.
 */
function validateBody(body, type) {
  switch (type) {
    case "json": {
      let parsed;

      try {
        parsed = JSON.parse(body);
      } catch {
        return "Invalid JSON response";
      }

      if (
        parsed === null ||
        typeof parsed !== "object"
      ) {
        return "Unexpected JSON structure";
      }

      if (!Array.isArray(parsed)) {
        if (parsed.ok === false) {
          return "API returned ok=false";
        }

        if (parsed.success === false) {
          return "API returned success=false";
        }
      }

      return null;
    }

    case "html":
      if (!/<html[\s>]/i.test(body)) {
        return "Missing HTML document";
      }

      return null;

    case "xml":
      if (
        !/<(?:urlset|sitemapindex)\b/i.test(body)
      ) {
        return "Unexpected sitemap structure";
      }

      return null;

    case "text":
      if (
        !/(?:user-agent|sitemap)\s*:/i.test(body)
      ) {
        return "Unexpected robots.txt content";
      }

      return null;

    default:
      return null;
  }
}

/**
 * Public AuroTap endpoints.
 *
 * No protected or state-changing routes.
 */
function getChecks() {
  return [
    {
      path: "/",
      label: "Homepage",
      type: "html",
      expectedStatus: 200,
    },
    {
      path: "/api/settings",
      label: "Public settings API",
      type: "json",
      expectedStatus: 200,
    },
    {
      path: "/sitemap.xml",
      label: "SEO sitemap",
      type: "xml",
      expectedStatus: 200,
    },
    {
      path: "/robots.txt",
      label: "SEO robots.txt",
      type: "text",
      expectedStatus: 200,
    },
    {
      path:
        process.env.SMOKE_OG_IMAGE_PATH ||
        "/og-image.png",
      label: "Social sharing image",
      type: "image",
      expectedStatus: 200,
    },
    {
      path: "/dashboard",
      label: "Legacy dashboard redirect",
      type: "redirect",
      expectedLocation: "/customer/home",
    },
  ];
}

/**
 * Perform a single HTTP request.
 */
async function requestOnce(base, check) {
  const url = new URL(check.path, base);

  const started = performance.now();

  const response = await fetch(url, {
    method: "GET",
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      Accept: "*/*",
    },
  });

  const latencyMs = Math.round(
    performance.now() - started
  );

  const status = response.status;

  /**
   * Redirect verification.
   *
   * A random 3xx response is not success.
   */
  if (check.type === "redirect") {
    const allowedStatuses = new Set([
      301,
      302,
      307,
      308,
    ]);

    const location =
      response.headers.get("location");

    const destination = location
      ? new URL(location, url)
      : null;

    const correctDestination =
      destination &&
      destination.origin === url.origin &&
      destination.pathname ===
        check.expectedLocation &&
      destination.search === "";

    await response.body?.cancel().catch(() => {});

    return {
      ok:
        allowedStatuses.has(status) &&
        Boolean(correctDestination),
      status,
      latencyMs,
      reason: correctDestination
        ? null
        : "Unexpected redirect destination",
    };
  }

  if (status !== check.expectedStatus) {
    await response.body?.cancel().catch(() => {});

    return {
      ok: false,
      status,
      latencyMs,
      reason: `Expected HTTP ${check.expectedStatus}`,
    };
  }

  if (!matchesContentType(response, check.type)) {
    await response.body?.cancel().catch(() => {});

    return {
      ok: false,
      status,
      latencyMs,
      reason: "Unexpected Content-Type",
    };
  }

  /**
   * Images only need status/content-type
   * validation in this lightweight check.
   */
  if (check.type === "image") {
    await response.body?.cancel().catch(() => {});

    return {
      ok: true,
      status,
      latencyMs,
      reason: null,
    };
  }

  const body = await readPrefix(response);

  const validationError = validateBody(
    body,
    check.type
  );

  return {
    ok: !validationError,
    status,
    latencyMs,
    reason: validationError,
  };
}

/**
 * Run bounded retries.
 *
 * Retry only transient HTTP failures
 * and network/timeouts.
 *
 * Do not retry 400, 401, 403, or 404.
 */
async function runCheck(base, check) {
  let finalResult;

  for (
    let attempt = 1;
    attempt <= MAX_ATTEMPTS;
    attempt++
  ) {
    try {
      const result = await requestOnce(
        base,
        check
      );

      finalResult = {
        ...result,
        attempts: attempt,
      };

      if (result.ok) break;

      if (!RETRYABLE_STATUSES.has(result.status)) {
        break;
      }
    } catch (error) {
      finalResult = {
        ok: false,
        status: "NETWORK",
        latencyMs: 0,
        attempts: attempt,
        reason:
          error?.name === "TimeoutError"
            ? "Request timed out"
            : "Network request failed",
      };
    }

    if (attempt < MAX_ATTEMPTS) {
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  const slow =
    finalResult.latencyMs > SLOW_RESPONSE_MS;

  const state = finalResult.ok
    ? slow
      ? "SLOW"
      : "PASS"
    : "FAIL";

  const timing =
    `${finalResult.latencyMs}ms`;

  console.log(
    `${state.padEnd(4)} ` +
      `${String(finalResult.status).padEnd(7)} ` +
      `${timing.padStart(7)} ` +
      `${check.label}`
  );

  if (finalResult.reason) {
    console.log(
      `     Reason: ${finalResult.reason}`
    );
  }

  if (finalResult.attempts > 1) {
    console.log(
      `     Attempts: ${finalResult.attempts}`
    );
  }

  results.push({
    ...finalResult,
    label: check.label,
    slow,
  });
}

/**
 * Main smoke-test runner.
 */
async function main() {
  const base = getBaseUrl();

  console.log("");
  console.log("AUROTAP — DEPLOYMENT SMOKE TEST");
  console.log("--------------------------------");
  console.log(`Target: ${base}`);
  console.log(`Timeout: ${TIMEOUT_MS}ms`);
  console.log(`Max attempts: ${MAX_ATTEMPTS}`);
  console.log("");

  const checks = getChecks();

  // Run sequentially to avoid unnecessary
  // request bursts against small deployments.
  for (const check of checks) {
    await runCheck(base, check);
  }

  const failed = results.filter(
    (result) => !result.ok
  );

  const passed = results.filter(
    (result) => result.ok
  );

  const slow = results.filter(
    (result) => result.ok && result.slow
  );

  const slowest = [...results]
    .filter((result) => result.ok)
    .sort(
      (a, b) =>
        b.latencyMs - a.latencyMs
    )[0];

  console.log("");
  console.log("SMOKE TEST SUMMARY");
  console.log("--------------------------------");

  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${passed.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log(`Slow responses: ${slow.length}`);

  if (slowest) {
    console.log(
      `Slowest: ${slowest.label} ` +
      `(${slowest.latencyMs}ms)`
    );
  }

  console.log("--------------------------------");

  if (failed.length > 0) {
    console.error(
      "RESULT: FAILED — deployment needs review."
    );

    process.exitCode = 1;
    return;
  }

  console.log(
    "RESULT: PASSED — public smoke checks passed."
  );

  if (slow.length > 0) {
    console.warn(
      "Performance warning: review slow endpoints."
    );
  }

  console.log(
    "Note: Authentication, booking, payment, " +
    "and database correctness were not tested."
  );
}

main().catch((error) => {
  console.error(
    "Smoke runner failed:",
    error instanceof Error
      ? error.message
      : "Unknown error"
  );

  process.exitCode = 1;
});
