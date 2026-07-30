// netlify/functions/data.js
//
// این تابع سرورلس، داده‌های اصلی اپ (محصولات، نرخ‌ها، سفارش‌ها، مشتری‌ها، اپراتورها و ...)
// را در Netlify Blobs ذخیره و بازیابی می‌کند — جایگزین JSONBin.
//
// GET          -> آخرین داده‌ی ذخیره‌شده را برمی‌گرداند: { record: {...} } یا { record: null }
// POST / PUT   -> بدنه‌ی JSON درخواست را به‌عنوان جدیدترین نسخه‌ی داده ذخیره می‌کند
//
// نیازمند این دو متغیر محیطی در پنل Netlify (Site configuration → Environment variables):
//   BLOBS_SITE_ID   شناسه‌ی سایت (Site ID) از Site configuration → General → Site details
//   BLOBS_TOKEN     یک Personal Access Token از User settings → Applications → New access token
// این دو مقدار مستقیم به getStore داده می‌شوند تا مشکل تشخیص خودکار محیط Blobs
// (خطای MissingBlobsEnvironmentError) که در برخی سایت‌های Netlify رخ می‌دهد، دور زده شود.

import { getStore } from "@netlify/blobs";

const STORE_NAME = "afgan-app-data";
const KEY = "state";

function getAppStore() {
  return getStore({
    name: STORE_NAME,
    siteID: process.env.BLOBS_SITE_ID,
    token: process.env.BLOBS_TOKEN,
  });
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
