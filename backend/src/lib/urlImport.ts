import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const importResponseSizeLimit = 2 * 1024 * 1024;
const importTimeoutMs = 5000;

function normalizeImportUrl(sourceUrl: string) {
  const url = new URL(sourceUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported");
  }
  url.hash = "";
  return url;
}

export function isBlockedIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 || // "this" network / 0.0.0.0
    a === 10 || // private
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT 100.64.0.0/10
    (a === 169 && b === 254) || // link-local, incl. 169.254.169.254 cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 168) || // private
    (a === 198 && (b === 18 || b === 19)) || // benchmarking 198.18.0.0/15
    a >= 224 // multicast + reserved 224.0.0.0/3
  );
}

export function isBlockedIp(address: string) {
  const normalized = address.toLowerCase().trim();

  // IPv4-mapped IPv6 in dotted form, e.g. ::ffff:127.0.0.1 or ::127.0.0.1
  const dotted = /^::(?:ffff:)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(normalized);
  if (dotted) return isBlockedIpv4(dotted[1]);

  // IPv4-mapped IPv6 in hex form, e.g. ::ffff:7f00:1 (Node normalizes to this)
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(normalized);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return isBlockedIpv4(`${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`);
  }

  if (isIP(normalized) === 4) return isBlockedIpv4(normalized);

  if (isIP(normalized) === 6) {
    return (
      normalized === "::1" || // loopback
      normalized === "::" || // unspecified
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") || // unique local fc00::/7
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb") || // link-local fe80::/10
      normalized.startsWith("ff") // multicast
    );
  }

  // Not a recognizable IP literal — refuse rather than guess.
  return true;
}

async function assertFetchableUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported");
  }

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => isBlockedIp(entry.address))) {
    throw new Error("URL host resolves to a blocked private, loopback, or link-local address");
  }

  // NOTE: this validates the addresses at resolve time; the subsequent fetch()
  // re-resolves the hostname, leaving a narrow DNS-rebinding window. This feature
  // must be deployed with network-level egress controls (see docs/deployment.md).
}

async function readCappedResponse(response: Response) {
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > importResponseSizeLimit) throw new Error("URL response exceeds 2MB limit");

  const reader = response.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > importResponseSizeLimit) throw new Error("URL response exceeds 2MB limit");
    chunks.push(value);
  }

  return new TextDecoder().decode(Buffer.concat(chunks));
}

export async function fetchImportHtml(sourceUrl: string) {
  let url = normalizeImportUrl(sourceUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), importTimeoutMs);

  try {
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      await assertFetchableUrl(url);
      const response = await fetch(url, { redirect: "manual", signal: controller.signal });

      if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
        url = normalizeImportUrl(new URL(response.headers.get("location")!, url).toString());
        continue;
      }

      if (!response.ok) throw new Error(`URL fetch failed with ${response.status}`);
      return { finalUrl: url.toString(), html: await readCappedResponse(response) };
    }
  } finally {
    clearTimeout(timeout);
  }

  throw new Error("Too many redirects while importing URL");
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function extractHtmlSuggestion(html: string) {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(withoutScripts)?.[1] ?? "";
  const description =
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i.exec(withoutScripts)?.[1] ??
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i.exec(withoutScripts)?.[1] ??
    "";
  const excerpt = withoutScripts.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1000);

  return {
    suggestedTitle: decodeHtml(title).trim(),
    suggestedDescription: decodeHtml(description).trim(),
    excerpt: decodeHtml(excerpt),
  };
}
