import { isIP } from "node:net";

const operatingSystems = new Set([
  "Android",
  "ChromeOS",
  "iOS",
  "Linux",
  "macOS",
  "Other",
  "Windows",
]);
const browsers = new Set(["Chrome", "Edge", "Firefox", "Opera", "Other", "Safari"]);
const deviceTypes = new Set(["Desktop", "Phone", "Tablet"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length <= maxLength;
}

function isBoundedNumber(
  value: unknown,
  min: number,
  max: number,
  integer = false,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max &&
    (!integer || Number.isInteger(value))
  );
}

function isLoopbackIp(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;

  const octets = normalized.split(".").map(Number);
  return octets.length === 4 && octets[0] === 127;
}

function getClientIp(request: Request): {
  ip: string | null;
  source: string | null;
  isLoopback: boolean;
} {
  const candidates = [
    { source: "x-real-ip", value: request.headers.get("x-real-ip") },
    { source: "cf-connecting-ip", value: request.headers.get("cf-connecting-ip") },
    ...(
      request.headers.get("x-forwarded-for")?.split(",").map((value) => ({
        source: "x-forwarded-for",
        value,
      })) ?? []
    ),
  ]
    .map(({ source, value }) => ({ source, ip: value?.trim() ?? "" }))
    .filter(({ ip }) => ip.length > 0 && isIP(ip) !== 0);

  const selected = candidates.find(({ ip }) => !isLoopbackIp(ip)) ?? candidates[0];
  if (!selected) return { ip: null, source: null, isLoopback: false };

  return {
    ip: selected.ip,
    source: selected.source,
    isLoopback: isLoopbackIp(selected.ip),
  };
}

function isValidReport(payload: unknown): payload is Record<string, unknown> {
  if (!isRecord(payload) || payload.consent !== true) return false;
  if (
    typeof payload.os !== "string" ||
    !operatingSystems.has(payload.os) ||
    !(payload.osVersion === null || isBoundedString(payload.osVersion, 50)) ||
    typeof payload.browser !== "string" ||
    !browsers.has(payload.browser) ||
    !(payload.browserVersion === null || isBoundedString(payload.browserVersion, 50)) ||
    typeof payload.deviceType !== "string" ||
    !deviceTypes.has(payload.deviceType) ||
    !isBoundedString(payload.platform, 100) ||
    !isBoundedString(payload.language, 50) ||
    !isBoundedString(payload.timeZone, 100) ||
    !isBoundedNumber(payload.hardwareConcurrency, 0, 1024, true) ||
    !(
      payload.deviceMemory === null ||
      isBoundedNumber(payload.deviceMemory, 0, 1024)
    ) ||
    !isBoundedNumber(payload.touchPoints, 0, 100, true) ||
    typeof payload.online !== "boolean" ||
    !isRecord(payload.screen)
  ) {
    return false;
  }

  return (
    isBoundedNumber(payload.screen.width, 0, 100_000, true) &&
    isBoundedNumber(payload.screen.height, 0, 100_000, true) &&
    isBoundedNumber(payload.screen.colorDepth, 0, 128, true) &&
    isBoundedNumber(payload.screen.pixelRatio, 0, 100)
  );
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const requestHost = request.headers.get("host");

  if (!origin || !requestHost) {
    return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  }

  try {
    if (new URL(origin).host !== requestHost) {
      return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
    }
  } catch {
    return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ error: "Expected a JSON diagnostic report." }, { status: 415 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 4096) {
    return Response.json({ error: "Diagnostic report is too large." }, { status: 413 });
  }

  let payload: unknown;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > 4096) {
      return Response.json({ error: "Diagnostic report is too large." }, { status: 413 });
    }
    payload = JSON.parse(body);
  } catch {
    return Response.json({ error: "Diagnostic report is not valid JSON." }, { status: 400 });
  }

  if (!isValidReport(payload)) {
    return Response.json({ error: "A valid, consented diagnostic report is required." }, { status: 400 });
  }

  const clientIp = getClientIp(request);
  const report = {
    submittedAt: new Date().toISOString(),
    ip: clientIp.ip,
    ipSource: clientIp.source,
    ipIsLoopback: clientIp.isLoopback,
    os: payload.os,
    osVersion: payload.osVersion,
    browser: payload.browser,
    browserVersion: payload.browserVersion,
    deviceType: payload.deviceType,
    platform: payload.platform,
    language: payload.language,
    timeZone: payload.timeZone,
    screen: payload.screen,
    hardwareConcurrency: payload.hardwareConcurrency,
    deviceMemory: payload.deviceMemory,
    touchPoints: payload.touchPoints,
    online: payload.online,
  };

  console.info("diagnostic_report", JSON.stringify(report));

  return Response.json({
    received: true,
    clientIp: clientIp.ip,
    ipIsLoopback: clientIp.isLoopback,
  });
}
