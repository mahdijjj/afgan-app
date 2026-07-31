// این فانکشن ورود مدیر را سمت سرور بررسی می‌کند.
// ایمیل و رمز مدیر هرگز در کد فرانت‌اند نوشته نمی‌شوند؛ از Environment Variables
// نتلیفای خوانده می‌شوند (Site configuration → Environment variables):
//   ADMIN_EMAIL
//   ADMIN_PASSWORD
//   ADMIN_TOKEN_SECRET   یک رشته‌ی تصادفی طولانی که فقط سرور می‌داند؛ برای امضای توکن ورود استفاده می‌شود.

import crypto from "crypto";

// یک توکن امضاشده می‌سازد: payload (زمان انقضا + یک مقدار تصادفی) + امضای HMAC آن.
// چون امضا با یک secret که فقط سرور می‌داند ساخته می‌شود، هیچ‌کس بدون دانستن آن secret
// نمی‌تواند یک توکن معتبر جعل کند؛ برخلاف قبل که توکن فقط یک base64 ساده و بی‌معنی بود.
function createToken() {
  const payload = {
    exp: Date.now() + 1000 * 60 * 60 * 12, // اعتبار: ۱۲ ساعت
    r: crypto.randomBytes(8).toString("hex"),
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", process.env.ADMIN_TOKEN_SECRET || "")
    .update(payloadStr)
    .digest("base64url");
  return `${payloadStr}.${sig}`;
}

export const handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { email, password } = JSON.parse(event.body || "{}");

    const okEmail = email === process.env.ADMIN_EMAIL;
    const okPass = password === process.env.ADMIN_PASSWORD;

    if (okEmail && okPass) {
      const token = createToken();
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true, token }),
      };
    }

    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false }),
    };
  } catch (e) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false }),
    };
  }
};
