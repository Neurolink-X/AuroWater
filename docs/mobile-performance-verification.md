# Mobile performance verification (required before merge)

Measure on a real low-end Android phone over throttled 4G and normal 4G. Compare production against this PR preview, at least five cold loads and five warm navigations each. Record median and p75.

| Journey | Record |
| --- | --- |
| Cold open / | time to first visible useful content, LCP, CLS, INP |
| Refresh / | first content, pricing API latency, any blocking skeleton |
| Home → service | click-to-content latency, route fallback duration |
| Home → booking | click-to-interactive, price validation latency |
| Customer tracking | status freshness, fetch count, response latency |
| Supplier dashboard | first orders, refresh duration, duplicate requests |
| Technician jobs | first jobs, status update latency |

Acceptance gates: no global full-page loading skeleton during normal navigation; no duplicate splash; no stale pricing accepted by checkout; no infinite spinner; no regression in CI, accessibility or order flows. Suggested performance budgets (not measured results): LCP p75 <= 2.5s, INP p75 <= 200ms, CLS <= 0.1. Capture browser Network and Performance traces before claiming speed improvements.

Do not conflate a fast loading indicator with faster server response. Profile server-side API/database latency separately and fix the slowest real bottleneck first.
