# Signal diagnostics

A Next.js app for voluntary connection diagnostics. Visitors must explicitly
check the consent box before a diagnostic report is submitted.

## What a report contains

The `POST /api/diagnostics` handler validates the report and writes a structured
`diagnostic_report` entry to the server's application logs. A report contains:

- The full client IP address, read from `x-real-ip`, `cf-connecting-ip`, or
  `x-forwarded-for`. If a loopback address and a non-loopback address are both
  present, the non-loopback address is selected.
- A server-generated submission time.
- Operating-system name and version, and browser name and version, inferred
  from the browser's user-agent string.
- Device category, platform string, language, time zone, screen dimensions and
  pixel ratio, color depth, hardware concurrency, available device-memory
  estimate, touch-point count, and online status.

Browser privacy features, user-agent reduction, and unsupported APIs can hide
or limit some version and device information. Unavailable IP headers are
recorded as `null`. The app does not collect cookies, precise location, or
persistent device identifiers, and does not store reports in a database.

The server log contains personal data, including the full IP address. Restrict
access to logs and configure an appropriate retention period. The hosting
platform may separately process or retain request and access logs according to
its own configuration.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), check the consent box, and
submit a report. In local development, the server usually sees `::1` or
`127.0.0.1`; these are loopback addresses, not your public IP. A local app
cannot determine your public IP from the browser-to-server connection alone.
The page warns when that happens. Inspect the terminal running the server for
the structured `diagnostic_report` log entry.

## Production

Deploy as a Node.js Next.js app behind a trusted reverse proxy. The handler
uses `x-real-ip`, `cf-connecting-ip`, then the first valid address in
`x-forwarded-for`. Configure your proxy to set or sanitize these headers; do
not trust client-supplied forwarding headers in a deployment that does not
overwrite them. If the deployed app still logs a loopback/private proxy address,
configure the hosting platform's trusted client-IP header and verify it is
forwarded to the Next.js app. Review and limit access to hosting-provider
access and application logs.
