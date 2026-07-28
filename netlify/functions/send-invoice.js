// netlify/functions/send-invoice.js
//
// این تابع سرورلس، جزئیات یک سفارش را می‌گیرد و به‌صورت خودکار و کاملاً رایگان
// از طریق ربات تلگرام به چت مدیریت ارسال می‌کند.
//
// نیازمند این متغیرهای محیطی در پنل Netlify (Site settings → Environment variables):
//   TELEGRAM_BOT_TOKEN   توکن رباتی که از BotFather گرفتید
//   TELEGRAM_CHAT_ID      شناسه چت شما (Chat ID)
//
// این تابع باید از فرانت‌اند با متد POST و بدنه JSON سفارش صدا زده شود.

const TYPE_LABELS = {
  internet: "بسته اینترنت",
  credit: "شارژ تماس",
  remittance: "حواله ارزی",
};

const CURRENCY_LABELS = { AFN: "افغانی", TOMAN: "تومان", USD: "دالر" };

function fmt(n) {
  return Number(n || 0).toLocaleString("en-US");
}

function buildInvoiceText(order) {
  const lines = [
    "🧾 سفارش جدید ثبت شد",
    "نوع: " + (TYPE_LABELS[order.type] || order.type || "—"),
    "کالا/خدمت: " + (order.item || "—"),
  ];
  if (order.type === "remittance") {
    lines.push("مبلغ حواله: " + fmt(order.price) + " افغانی");
    if (order.tomanAmount) lines.push("مبلغ کسر شده از کیف پول: " + fmt(order.tomanAmount) + " تومان");
    if (order.receiverName) lines.push("گیرنده: " + order.receiverName);
    if (order.destination) lines.push("مقصد: " + order.destination);
  } else {
    lines.push("مبلغ: " + fmt(order.price) + " " + (CURRENCY_LABELS[order.currency || "TOMAN"] || ""));
  }
  lines.push("نام مشتری: " + (order.customerName || "—"));
  lines.push("شماره تماس: " + (order.phone || "—"));
  lines.push("کد پیگیری: " + (order.trackingCode || "—"));
  return lines.join("\n");
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "تنظیمات تلگرام روی سرور کامل نیست (متغیرهای محیطی خالی هستند)." }),
    };
  }

  let order;
  try {
    order = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "بدنه درخواست نامعتبر است." }) };
  }

  const invoiceText = buildInvoiceText(order);

  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: invoiceText,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: data }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, data }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
};
