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

    // --- لاگ موقت برای عیب‌یابی ---
    // این خط‌ها هیچ رمزی رو کامل چاپ نمی‌کنن، فقط طول رشته‌ها و اینکه env ست شده یا نه.
    // بعد از حل مشکل حتماً حذفشون کن.
    console.log("DEBUG: env ADMIN_EMAIL set?", Boolean(process.env.ADMIN_EMAIL));
    console.log("DEBUG: env ADMIN_PASSWORD set?", Boolean(process.env.ADMIN_PASSWORD));
    console.log("DEBUG: received email length:", (email || "").length);
    console.log("DEBUG: received password length:", (password || "").length);
    console.log("DEBUG: env password length:", (process.env.ADMIN_PASSWORD || "").length);
    console.log(
      "DEBUG: email match?",
      email === process.env.ADMIN_EMAIL,
      "| password match?",
      password === process.env.ADMIN_PASSWORD
    );
    // --- پایان لاگ موقت ---

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
    console.log("DEBUG: error", e.message);
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false }),
    };
  }
};
