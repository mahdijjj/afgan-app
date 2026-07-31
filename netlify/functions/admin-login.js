// این فانکشن ورود مدیر را سمت سرور بررسی می‌کند.
// ایمیل و رمز مدیر هرگز در کد فرانت‌اند نوشته نمی‌شوند؛ از Environment Variables
// نتلیفای خوانده می‌شوند (Site configuration → Environment variables):
//   ADMIN_EMAIL
//   ADMIN_PASSWORD

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { email, password } = JSON.parse(event.body || "{}");
    const okEmail = email === process.env.ADMIN_EMAIL;
    const okPass = password === process.env.ADMIN_PASSWORD;

    if (okEmail && okPass) {
      // یک توکن ساده (زمان + رشته تصادفی) برای نگه‌داشتن وضعیت ورود در فرانت‌اند.
      const token = Buffer.from(
        JSON.stringify({ t: Date.now(), r: Math.random().toString(36).slice(2) })
      ).toString("base64");
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
