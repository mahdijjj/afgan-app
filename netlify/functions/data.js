// netlify/functions/data.js
//
// این تابع سرورلس، داده‌های اصلی اپ (محصولات، نرخ‌ها، سفارش‌ها، مشتری‌ها، اپراتورها و ...)
// را در Netlify Blobs ذخیره و بازیابی می‌کند — جایگزین JSONBin.
//
// GET                          -> آخرین داده‌ی ذخیره‌شده را برمی‌گرداند: { record: {...} } یا { record: null }
//                                 (بدون نیاز به ورود؛ برای نمایش محصولات به همه لازم است)
//
// POST / PUT بدون action        -> بازنویسی کامل داده (کاری که پنل مدیریت انجام می‌دهد).
//                                 فقط با یک توکن معتبر ورود مدیر پذیرفته می‌شود
//                                 (هدر Authorization: Bearer <token>).
//
// POST { action: "placeOrder" } -> ثبت سفارش توسط مشتری. توکن ادمین لازم ندارد، ولی سرور
//                                 خودش سفارش را فقط اضافه می‌کند (نه جایگزین همه‌چیز) و فقط
//                                 کیف پول همان مشتری را کم می‌کند.
//
// POST { action: "updateProfile" } -> تغییر نام/رمز توسط خود مشتری. توکن ادمین لازم ندارد،
//                                 ولی سرور قبل از اعمال تغییر، رمز فعلی مشتری را بررسی می‌کند.
//
// نیازمند این متغیرهای محیطی در پنل Netlify (Site configuration → Environment variables):
//   BLOBS_SITE_ID       شناسه‌ی سایت (Site ID) از Site configuration → General → Site details
//   BLOBS_TOKEN         یک Personal Access Token از User settings → Applications → New access token
//   ADMIN_TOKEN_SECRET  همان کلید مخفی که در netlify/functions/admin-login.js برای امضای توکن ورود استفاده می‌شود

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

function normalizeWallet(wallet) {
  if (wallet && typeof wallet === "object") return wallet;
  return { TOMAN: Number(wallet) || 0 };
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

    // ------- ثبت سفارش توسط مشتری (بدون نیاز به توکن ادمین) -------
    if (body.action === "placeOrder") {
      const { order, customerId, deductAmount } = body;
      if (!order || typeof order !== "object") {
        return { statusCode: 400, body: JSON.stringify({ error: "سفارش نامعتبر است." }) };
      }
      const amount = Number(deductAmount) || 0;
      if (amount < 0) {
        return { statusCode: 400, body: JSON.stringify({ error: "مبلغ نامعتبر است." }) };
      }

      let record;
      try {
        record = (await store.get(KEY, { type: "json" })) || {};
      } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
      }

      const customers = record.customers || [];
      let nextCustomers = customers;

      if (customerId) {
        const found = customers.find((c) => c.id === customerId);
        if (!found) {
          return { statusCode: 400, body: JSON.stringify({ error: "مشتری یافت نشد." }) };
        }
        if (amount > 0) {
          nextCustomers = customers.map((c) =>
            c.id === customerId
              ? { ...c, wallet: { ...normalizeWallet(c.wallet), TOMAN: (Number(normalizeWallet(c.wallet).TOMAN) || 0) - amount } }
              : c
          );
        }
      }

      const nextOrders = [order, ...(record.orders || [])];
      const nextRecord = { ...record, orders: nextOrders, customers: nextCustomers };

      try {
        await store.setJSON(KEY, nextRecord);
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
      }
    }

    // ------- تغییر نام/رمز توسط خود مشتری (بدون نیاز به توکن ادمین) -------
    if (body.action === "updateProfile") {
      const { customerId, currentPassword, name, newPassword } = body;
      if (!customerId || typeof currentPassword !== "string") {
        return { statusCode: 400, body: JSON.stringify({ error: "درخواست نامعتبر است." }) };
      }

      let record;
      try {
        record = (await store.get(KEY, { type: "json" })) || {};
      } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
      }

      const customers = record.customers || [];
      const found = customers.find((c) => c.id === customerId);
      if (!found || found.password !== currentPassword) {
        return { statusCode: 401, body: JSON.stringify({ error: "رمز عبور فعلی درست نیست." }) };
      }

      const nextCustomers = customers.map((c) =>
        c.id === customerId
          ? { ...c, ...(name ? { name } : {}), ...(newPassword ? { password: newPassword } : {}) }
          : c
      );
      const nextRecord = { ...record, customers: nextCustomers };

      try {
        await store.setJSON(KEY, nextRecord);
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
      }
    }

    // ------- بازنویسی کامل داده: فقط برای مدیر (نیازمند توکن معتبر) -------
    const token = getBearerToken(event);
    if (!isValidAdminToken(token)) {
      return { statusCode: 401, body: JSON.stringify({ error: "دسترسی غیرمجاز." }) };
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
