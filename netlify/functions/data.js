// netlify/functions/data.js
//
// این تابع سرورلس، داده‌های اصلی اپ (محصولات، نرخ‌ها، سفارش‌ها، مشتری‌ها، اپراتورها و ...)
// را در Netlify Blobs ذخیره و بازیابی می‌کند — جایگزین JSONBin.
//
// GET          -> آخرین داده‌ی ذخیره‌شده را برمی‌گرداند: { record: {...} } یا { record: null }
//                 (بدون نیاز به ورود؛ برای نمایش محصولات به همه‌ی بازدیدکننده‌ها لازم است)
// POST / PUT   -> بدنه‌ی JSON درخواست را به‌عنوان جدیدترین نسخه‌ی داده ذخیره می‌کند
//                 (فقط با یک توکن معتبر ورود مدیر — در هدر Authorization: Bearer <token>)
//
// نیازمند این متغیرهای محیطی در پنل Netlify (Site configuration → Environment variables):
//   BLOBS_SITE_ID       شناسه‌ی سایت (Site ID) از Site configuration → General → Site details
//   BLOBS_TOKEN         یک Personal Access Token از User settings → Applications → New access token
//   ADMIN_TOKEN_SECRET  همان کلید مخفی که در netlify/functions/admin-login.js برای امضای توکن ورود استفاده می‌شود
// این مقادیر مستقیم به getStore داده می‌شوند تا مشکل تشخیص خودکار محیط Blobs
// (خطای MissingBlobsEnvironmentError) که در برخی سایت‌های Netlify رخ می‌دهد، دور زده شود.

import { getStore } from "@netlify/blobs";
import crypto from "crypto";

const STORE_NAME = "afgan-app-data";
const KEY = "state";

function getAppStore() {
  return getStore({
    name: STORE_NAME,
    siteID: process.env.BLOBS_SITE_ID,
    token: process.env.BLOBS_TOKEN,
  });
}

// توکنی که در admin-login.js ساخته می‌شود را بررسی می‌کند: امضای HMAC آن باید با
// ADMIN_TOKEN_SECRET سرور مطابقت داشته باشد و همچنین منقضی نشده باشد.
function isValidAdminToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return false;
  const [payloadStr, sig] = token.split(".");
  if (!payloadStr || !sig) return false;

  const expectedSig = crypto
    .createHmac("sha256", process.env.ADMIN_TOKEN_SECRET || "")
    .update(payloadStr)
    .digest("base64url");

  // مقایسه‌ی امن در برابر حملات زمان‌سنجی (timing attack)
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

  try {
    const payload = JSON.parse(Buffer.from(payloadStr, "base64url").toString());
    if (!payload.exp || Date.now() > payload.exp) return false;
  } catch (e) {
    return false;
  }

  return true;
}

function getBearerToken(event) {
  const header = (event.headers && (event.headers.authorization || event.headers.Authorization)) || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

export const handler = async (event) => {
  if (!process.env.BLOBS_SITE_ID || !process.env.BLOBS_TOKEN) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "متغیرهای BLOBS_SITE_ID و BLOBS_TOKEN روی سرور تنظیم نشده‌اند." }),
    };
  }

  const store = getAppStore();

  if (event.httpMethod === "GET") {
    try {
      const record = await store.get(KEY, { type: "json" });
      return { statusCode: 200, body: JSON.stringify({ record: record || null }) };
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
    }
  }

  if (event.httpMethod === "POST" || event.httpMethod === "PUT") {
    // فقط درخواست‌هایی که یک توکن معتبر ورود مدیر دارند اجازه‌ی نوشتن دارند.
    const token = getBearerToken(event);
    if (!isValidAdminToken(token)) {
      return { statusCode: 401, body: JSON.stringify({ error: "دسترسی غیرمجاز." }) };
    }

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch (e) {
      return { statusCode: 400, body: JSON.stringify({ error: "بدنه درخواست نامعتبر است." }) };
    }
    try {
      await store.setJSON(KEY, body);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
    }
  }

  return { statusCode: 405, body: "Method Not Allowed" };
};
