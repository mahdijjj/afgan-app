// netlify/functions/data.js
//
// این تابع سرورلس، داده‌های اصلی اپ (محصولات، نرخ‌ها، سفارش‌ها، مشتری‌ها، اپراتورها و ...)
// را در Netlify Blobs ذخیره و بازیابی می‌کند — جایگزین JSONBin.
//
// GET          -> آخرین داده‌ی ذخیره‌شده را برمی‌گرداند: { record: {...} } یا { record: null }
// POST / PUT   -> بدنه‌ی JSON درخواست را به‌عنوان جدیدترین نسخه‌ی داده ذخیره می‌کند
//
// نیاز به هیچ متغیر محیطی یا کلید API‌ای ندارد؛ Netlify خودش دسترسی Blobs را برای
// فانکشن‌های همان سایت فراهم می‌کند. فقط باید پکیج @netlify/blobs در package.json باشد.

import { getStore } from "@netlify/blobs";

const STORE_NAME = "afgan-app-data";
const KEY = "state";

export const handler = async (event) => {
  const store = getStore(STORE_NAME);

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
