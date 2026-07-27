import React, { useState, useEffect } from "react";

const ADMIN_EMAIL = "mahdisultani10@gmail.com";
const ADMIN_PASSWORD = "Mahdi35";

// ====== JSONBIN CONFIG ======
const JSONBIN_BIN_ID = "6a668a3cf5f4af5e29c50f2c";
const JSONBIN_API_KEY = "$2a$10$M4JrqWL2WXu2iu2baYsD2ujKh0p6P3WYBM2umsli.oE4d95F8ZadO";
const JSONBIN_URL = "https://api.jsonbin.io/v3/b/" + JSONBIN_BIN_ID;
const POLL_INTERVAL_MS = 20000; // how often the app re-checks jsonbin for changes made by others
// ==============================

const DEFAULT_PRODUCTS = [
  { id: "i1", category: "internet", title: "۱ گیگابایت", subtitle: "اعتبار ۳۰ روز", price: 150, currency: "TOMAN", active: true },
  { id: "i2", category: "internet", title: "۲ گیگابایت", subtitle: "اعتبار ۳۰ روز", price: 280, currency: "TOMAN", active: true },
  { id: "i3", category: "internet", title: "۵ گیگابایت", subtitle: "اعتبار ۳۰ روز", price: 600, currency: "TOMAN", active: true },
  { id: "i4", category: "internet", title: "۱۰ گیگابایت", subtitle: "اعتبار ۳۰ روز", price: 1100, currency: "TOMAN", active: true },
  { id: "c1", category: "credit", title: "۱۰۰ افغانی", subtitle: "شارژ مستقیم", price: 100, currency: "TOMAN", active: true },
  { id: "c2", category: "credit", title: "۲۰۰ افغانی", subtitle: "شارژ مستقیم", price: 200, currency: "TOMAN", active: true },
  { id: "c3", category: "credit", title: "۵۰۰ افغانی", subtitle: "شارژ مستقیم", price: 500, currency: "TOMAN", active: true },
  { id: "c4", category: "credit", title: "۱۰۰۰ افغانی", subtitle: "شارژ مستقیم", price: 1000, currency: "TOMAN", active: true },
];

const CURRENCY_LABELS = { AFN: "افغانی", TOMAN: "تومان", USD: "دالر" };
const CURRENCY_OPTIONS = ["TOMAN", "AFN", "USD"];

const DEFAULT_RATES = [
  { code: "USD", label: "دلار آمریکا", value: 70.5 },
  { code: "EUR", label: "یورو", value: 76.2 },
  { code: "AED", label: "درهم امارات", value: 19.2 },
  { code: "PKR", label: "کلدار پاکستان", value: 0.25 },
];

const STATUS_LABELS = { pending: "در انتظار", processing: "در حال انجام", completed: "تکمیل شده", cancelled: "لغو شده" };
const STATUS_ORDER = ["pending", "processing", "completed", "cancelled"];
const TYPE_LABELS = { internet: "بسته اینترنت", credit: "شارژ تماس", remittance: "حواله ارزی" };
const TYPE_ICONS = { internet: "📶", credit: "📞", remittance: "💱" };

function fmt(n) {
  return Number(n || 0).toLocaleString("fa-IR");
}
function newId(prefix) {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fa-IR") + " " + d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return "";
  }
}
function genTrackingCode() {
  return "AF" + Math.floor(100000 + Math.random() * 900000);
}

// Resize + compress an uploaded receipt image in the browser before storing it,
// so it stays small enough to fit comfortably inside the shared jsonbin record.
function compressImageFile(file, maxWidth = 700, quality = 0.55) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("image load failed"));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function AfganApp() {
  const [page, setPage] = useState("home");
  const [products, setProducts] = useState(null);
  const [rates, setRates] = useState(null);
  const [orders, setOrders] = useState(null);
  const [cardInfo, setCardInfo] = useState(null);
  const [lastOrder, setLastOrder] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminTab, setAdminTab] = useState("dashboard");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    init();
  }, []);

  // Periodically re-check jsonbin so changes made by the admin (or other customers)
  // show up for everyone without needing a manual refresh.
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(JSONBIN_URL + "/latest", { headers: { "X-Master-Key": JSONBIN_API_KEY } });
        const data = await res.json();
        const record = data && data.record;
        if (record) {
          setProducts((prev) => (JSON.stringify(prev) !== JSON.stringify(record.products) ? record.products : prev));
          setRates((prev) => (JSON.stringify(prev) !== JSON.stringify(record.rates) ? record.rates : prev));
          setOrders((prev) => (JSON.stringify(prev) !== JSON.stringify(record.orders) ? record.orders : prev));
          setCardInfo((prev) => (JSON.stringify(prev) !== JSON.stringify(record.cardInfo) ? record.cardInfo : prev));
        }
      } catch (e) {
        // network hiccup - just try again next interval
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  async function init() {
    let record = null;
    try {
      const res = await fetch(JSONBIN_URL + "/latest", { headers: { "X-Master-Key": JSONBIN_API_KEY } });
      const data = await res.json();
      record = data && data.record;
    } catch (e) {}

    let products = (record && record.products) || [];
    let rates = (record && record.rates) || [];
    let orders = (record && record.orders) || [];
    let cardInfo = (record && record.cardInfo) || { number: "", holder: "", phone: "", whatsapp: "" };
    let needsSeed = false;

    if (!products.length) {
      products = DEFAULT_PRODUCTS;
      needsSeed = true;
    }
    if (!rates.length) {
      rates = DEFAULT_RATES;
      needsSeed = true;
    }
    if (!record || !record.cardInfo) {
      needsSeed = true;
    }

    if (needsSeed) {
      try {
        await fetch(JSONBIN_URL, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "X-Master-Key": JSONBIN_API_KEY },
          body: JSON.stringify({ products, rates, orders, cardInfo }),
        });
      } catch (e) {}
    }

    setProducts(products);
    setRates(rates);
    setOrders(orders);
    setCardInfo(cardInfo);
    setLoaded(true);
  }

  async function persist(nextState) {
    try {
      await fetch(JSONBIN_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Master-Key": JSONBIN_API_KEY },
        body: JSON.stringify(nextState),
      });
    } catch (e) {}
  }

  async function saveProducts(next) {
    setProducts(next);
    persist({ products: next, rates, orders, cardInfo });
  }
  async function saveRates(next) {
    setRates(next);
    persist({ products, rates: next, orders, cardInfo });
  }
  async function saveOrders(next) {
    setOrders(next);
    persist({ products, rates, orders: next, cardInfo });
  }
  async function saveCardInfo(next) {
    setCardInfo(next);
    persist({ products, rates, orders, cardInfo: next });
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  function placeOrder(order) {
    const full = { id: newId("ord"), trackingCode: genTrackingCode(), date: new Date().toISOString(), status: "pending", ...order };
    saveOrders([full, ...(orders || [])]);
    return full;
  }

  if (!loaded) {
    return (
      <div className="afgan-root" dir="rtl">
        <Style />
        <div className="loading-screen">
          <div className="logo-mark">A</div>
          <div>در حال بارگذاری AFGAN...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="afgan-root" dir="rtl" lang="fa">
      <Style />
      <Header onAdmin={() => setPage(isAdmin ? "admin" : "adminLogin")} />
      <main className="afgan-main">
        {page === "home" && <Home rates={rates} cardInfo={cardInfo} setPage={setPage} />}
        {page === "internet" && (
          <ProductList
            title="بسته اینترنت"
            icon="📶"
            products={products.filter((p) => p.category === "internet" && p.active)}
            onOrder={(item, form) => {
              const full = placeOrder({ type: "internet", item: item.title, price: item.price, currency: item.currency || "TOMAN", customerName: form.name, phone: form.phone });
              setLastOrder(full);
              setPage("confirm");
            }}
            onBack={() => setPage("home")}
          />
        )}
        {page === "credit" && (
          <ProductList
            title="شارژ تماس"
            icon="📞"
            products={products.filter((p) => p.category === "credit" && p.active)}
            onOrder={(item, form) => {
              const full = placeOrder({ type: "credit", item: item.title, price: item.price, currency: item.currency || "TOMAN", customerName: form.name, phone: form.phone });
              setLastOrder(full);
              setPage("confirm");
            }}
            onBack={() => setPage("home")}
          />
        )}
        {page === "remittance" && (
          <RemittanceForm
            onSubmit={(form) => {
              const full = placeOrder({
                type: "remittance",
                item: "حواله ارزی",
                price: Number(form.amount) || 0,
                currency: "AFN",
                customerName: form.senderName,
                phone: form.phone,
                receiverName: form.receiverName,
                destination: form.destination,
                notes: form.notes,
              });
              setLastOrder(full);
              setPage("confirm");
            }}
            onBack={() => setPage("home")}
          />
        )}
        {page === "confirm" && lastOrder && <OrderConfirmation order={lastOrder} onDone={() => setPage("home")} />}
        {page === "orders" && <MyOrders orders={orders} onBack={() => setPage("home")} />}
        {page === "adminLogin" && (
          <AdminLogin
            onLogin={(email, pw) => {
              if (email === ADMIN_EMAIL && pw === ADMIN_PASSWORD) {
                setIsAdmin(true);
                setPage("admin");
              } else {
                showToast("ایمیل یا رمز عبور اشتباه است");
              }
            }}
            onBack={() => setPage("home")}
          />
        )}
        {page === "admin" && isAdmin && (
          <AdminPanel
            products={products}
            rates={rates}
            orders={orders}
            cardInfo={cardInfo}
            tab={adminTab}
            setTab={setAdminTab}
            saveProducts={saveProducts}
            saveRates={saveRates}
            saveOrders={saveOrders}
            saveCardInfo={saveCardInfo}
            onLogout={() => {
              setIsAdmin(false);
              setPage("home");
            }}
            showToast={showToast}
          />
        )}
      </main>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Header({ onAdmin }) {
  return (
    <header className="afgan-header">
      <button className="gear-btn" onClick={onAdmin} aria-label="مدیریت">
        ⚙
      </button>
      <div className="brand">
        <div className="logo-mark">A</div>
        <div className="brand-text">
          <div className="brand-name">AFGAN</div>
          <div className="brand-tag">خدمات ارزی و مخابراتی</div>
        </div>
      </div>
    </header>
  );
}

function PageHeader({ title, icon, onBack }) {
  return (
    <div className="page-header">
      <button className="back-btn" onClick={onBack}>
        بازگشت ←
      </button>
      <div className="page-title">
        {icon ? <span className="page-icon">{icon}</span> : null}
        {title}
      </div>
    </div>
  );
}

function Home({ rates, cardInfo, setPage }) {
  return (
    <div className="fade-in">
      <RateBoard rates={rates} />
      <div className="card-grid">
        <ServiceCard icon="📶" title="بسته اینترنت" desc="خرید بسته‌های اینترنت با بهترین قیمت" onClick={() => setPage("internet")} />
        <ServiceCard icon="📞" title="شارژ تماس" desc="شارژ آنی تلفن همراه شما" onClick={() => setPage("credit")} />
        <ServiceCard icon="💱" title="حواله ارزی" desc="ارسال حواله به سراسر جهان" onClick={() => setPage("remittance")} />
        <ServiceCard icon="📋" title="لیست سفارش" desc="پیگیری سفارش‌های ثبت شده" onClick={() => setPage("orders")} />
      </div>
      {cardInfo && cardInfo.number && <PaymentCard cardInfo={cardInfo} />}
      {cardInfo && cardInfo.whatsapp && <WhatsAppButton number={cardInfo.whatsapp} />}
    </div>
  );
}

function PaymentCard({ cardInfo }) {
  return (
    <div className="payment-card">
      <div className="payment-card-label">شماره کارت جهت واریز</div>
      <div className="payment-card-number">{cardInfo.number}</div>
      <div className="payment-card-holder">{cardInfo.holder}</div>
      {cardInfo.phone && <div className="payment-card-phone">📞 {cardInfo.phone}</div>}
    </div>
  );
}

function WhatsAppButton({ number }) {
  const clean = String(number).replace(/[^0-9+]/g, "");
  return (
    <a className="whatsapp-btn" href={"https://wa.me/" + clean.replace("+", "")} target="_blank" rel="noreferrer">
      <span className="whatsapp-icon">💬</span>
      ارتباط با ما در واتساپ
    </a>
  );
}

function OrderConfirmation({ order, onDone }) {
  return (
    <div className="fade-in confirm-screen">
      <div className="confirm-check">✅</div>
      <div className="confirm-title">سفارش شما ثبت شد</div>
      <div className="confirm-code-label">کد پیگیری سفارش</div>
      <div className="confirm-code">{order.trackingCode}</div>
      <div className="confirm-note">
        لطفاً بعد از واریزی و ارسال فیش، کد پیگیری سفارش را حتماً همراه فیش ارسال کنید. ممنون
      </div>
      <button className="btn-primary full" onClick={onDone}>
        بازگشت به صفحه اصلی
      </button>
    </div>
  );
}

function RateBoard({ rates }) {
  return (
    <div className="rate-board">
      <div className="rate-board-title">
        <span>نرخ امروز ارز</span>
        <span className="rate-board-unit">به افغانی</span>
      </div>
      <div className="rate-strip">
        {rates.map((r) => (
          <div className="rate-chip" key={r.code}>
            <div className="rate-code">{r.code}</div>
            <div className="rate-value">{fmt(r.value)}</div>
            <div className="rate-label">{r.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ServiceCard({ icon, title, desc, onClick }) {
  return (
    <button className="service-card" onClick={onClick}>
      <div className="service-icon">{icon}</div>
      <div className="service-title">{title}</div>
      <div className="service-desc">{desc}</div>
    </button>
  );
}

function ReceiptUploader({ receipt, setReceipt }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setErr("");
    setBusy(true);
    try {
      const dataUrl = await compressImageFile(file);
      setReceipt(dataUrl);
    } catch (e2) {
      setErr("بارگذاری عکس ناموفق بود، دوباره امتحان کنید");
    }
    setBusy(false);
  }

  return (
    <div className="receipt-uploader">
      <div className="receipt-label">فیش واریزی (اختیاری)</div>
      {!receipt && (
        <label className="receipt-btn">
          {busy ? "در حال پردازش..." : "📎 انتخاب عکس فیش"}
          <input type="file" accept="image/*" onChange={handleFile} hidden disabled={busy} />
        </label>
      )}
      {receipt && (
        <div className="receipt-preview">
          <img src={receipt} alt="فیش واریزی" />
          <button type="button" className="btn-ghost small" onClick={() => setReceipt(null)}>
            حذف عکس
          </button>
        </div>
      )}
      {err && <div className="form-error">{err}</div>}
    </div>
  );
}

function ProductList({ title, icon, products, onOrder, onBack }) {
  const [selected, setSelected] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError("لطفاً نام و شماره تماس را وارد کنید");
      return;
    }
    onOrder(selected, { name, phone, receipt });
  }

  return (
    <div className="fade-in">
      <PageHeader title={title} icon={icon} onBack={onBack} />
      {!selected && (
        <div className="product-list">
          {products.length === 0 && <div className="empty-state">در حال حاضر بسته‌ای فعال نیست.</div>}
          {products.map((p) => (
            <div className="product-row" key={p.id}>
              <div className="product-info">
                <div className="product-title">{p.title}</div>
                <div className="product-subtitle">{p.subtitle}</div>
              </div>
              <div className="product-actions">
                <div className="product-price">{fmt(p.price)} {CURRENCY_LABELS[p.currency || "TOMAN"]}</div>
                <button
                  className="btn-primary small"
                  onClick={() => {
                    setSelected(p);
                    setError("");
                  }}
                >
                  ثبت سفارش
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {selected && (
        <form className="order-form" onSubmit={submit}>
          <div className="order-form-summary">
            سفارش: <b>{selected.title}</b> — {fmt(selected.price)} {CURRENCY_LABELS[selected.currency || "TOMAN"]}
          </div>
          <label>
            نام مشتری
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام کامل" />
          </label>
          <label>
            شماره موبایل
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX" type="tel" />
          </label>
          <ReceiptUploader receipt={receipt} setReceipt={setReceipt} />
          {error && <div className="form-error">{error}</div>}
          <div className="form-btn-row">
            <button type="button" className="btn-ghost" onClick={() => setSelected(null)}>
              انصراف
            </button>
            <button type="submit" className="btn-primary">
              تایید سفارش
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function RemittanceForm({ onSubmit, onBack }) {
  const [form, setForm] = useState({ senderName: "", phone: "", amount: "", receiverName: "", destination: "", notes: "" });
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState("");

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function submit(e) {
    e.preventDefault();
    if (!form.senderName.trim() || !form.phone.trim() || !form.amount || !form.receiverName.trim() || !form.destination.trim()) {
      setError("لطفاً همه فیلدهای ضروری را تکمیل کنید");
      return;
    }
    onSubmit({ ...form, receipt });
  }

  return (
    <div className="fade-in">
      <PageHeader title="حواله ارزی" icon="💱" onBack={onBack} />
      <form className="order-form" onSubmit={submit}>
        <label>
          نام فرستنده
          <input value={form.senderName} onChange={(e) => set("senderName", e.target.value)} placeholder="نام فرستنده" />
        </label>
        <label>
          شماره تماس
          <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="07XXXXXXXX" type="tel" />
        </label>
        <label>
          مبلغ
          <input value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="مبلغ به افغانی" type="number" />
        </label>
        <label>
          نام گیرنده
          <input value={form.receiverName} onChange={(e) => set("receiverName", e.target.value)} placeholder="نام گیرنده" />
        </label>
        <label>
          مقصد
          <input value={form.destination} onChange={(e) => set("destination", e.target.value)} placeholder="شهر / کشور مقصد" />
        </label>
        <label>
          توضیحات
          <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="توضیحات اضافی (اختیاری)" rows={3} />
        </label>
        {error && <div className="form-error">{error}</div>}
        <div className="form-btn-row">
          <button type="submit" className="btn-primary full">
            ثبت حواله
          </button>
        </div>
      </form>
    </div>
  );
}

function MyOrders({ orders, onBack }) {
  const [phone, setPhone] = useState("");
  const [searched, setSearched] = useState(false);
  const results = orders.filter((o) => o.phone && phone && o.phone.includes(phone.trim()));

  return (
    <div className="fade-in">
      <PageHeader title="لیست سفارش" icon="📋" onBack={onBack} />
      <div className="search-row">
        <input placeholder="شماره موبایل خود را وارد کنید" value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" />
        <button className="btn-primary small" onClick={() => setSearched(true)}>
          جستجو
        </button>
      </div>
      {searched && results.length === 0 && <div className="empty-state">سفارشی با این شماره یافت نشد.</div>}
      <div className="order-list">
        {results.map((o) => (
          <div className="order-card" key={o.id}>
            <div className="order-card-top">
              <span>
                {TYPE_ICONS[o.type]} {TYPE_LABELS[o.type]}
              </span>
              <span className={"status-badge status-" + o.status}>{STATUS_LABELS[o.status]}</span>
            </div>
            <div className="order-card-body">
              <div>{o.item}</div>
              <div className="order-card-price">{fmt(o.price)} {CURRENCY_LABELS[o.currency || "TOMAN"]}</div>
            </div>
            <div className="order-card-track">کد پیگیری: <b>{o.trackingCode}</b></div>
            <div className="order-card-date">{fmtDate(o.date)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminLogin({ onLogin, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div className="fade-in">
      <PageHeader title="ورود مدیریت" icon="🔐" onBack={onBack} />
      <form
        className="order-form"
        onSubmit={(e) => {
          e.preventDefault();
          onLogin(email, password);
        }}
      >
        <label>
          ایمیل
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ایمیل مدیریت" type="email" />
        </label>
        <label>
          رمز عبور
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="رمز عبور" type="password" />
        </label>
        <div className="form-btn-row">
          <button type="submit" className="btn-primary full">
            ورود
          </button>
        </div>
      </form>
    </div>
  );
}

function AdminPanel({ products, rates, orders, cardInfo, tab, setTab, saveProducts, saveRates, saveOrders, saveCardInfo, onLogout, showToast }) {
  return (
    <div className="fade-in">
      <div className="page-header">
        <button className="back-btn" onClick={onLogout}>
          خروج ←
        </button>
        <div className="page-title">پنل مدیریت</div>
      </div>
      <div className="admin-tabs">
        {[
          ["dashboard", "داشبورد"],
          ["products", "محصولات"],
          ["orders", "سفارش‌ها"],
          ["rates", "نرخ ارز"],
          ["card", "کارت / واتساپ"],
        ].map(([key, label]) => (
          <button key={key} className={"admin-tab" + (tab === key ? " active" : "")} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      {tab === "dashboard" && <Dashboard orders={orders} products={products} />}
      {tab === "products" && <ProductsManager products={products} saveProducts={saveProducts} showToast={showToast} />}
      {tab === "orders" && <OrdersManager orders={orders} saveOrders={saveOrders} />}
      {tab === "rates" && <RatesManager rates={rates} saveRates={saveRates} showToast={showToast} />}
      {tab === "card" && <CardManager cardInfo={cardInfo} saveCardInfo={saveCardInfo} showToast={showToast} />}
    </div>
  );
}

function CardManager({ cardInfo, saveCardInfo, showToast }) {
  const [draft, setDraft] = useState({
    number: (cardInfo && cardInfo.number) || "",
    holder: (cardInfo && cardInfo.holder) || "",
    phone: (cardInfo && cardInfo.phone) || "",
    whatsapp: (cardInfo && cardInfo.whatsapp) || "",
  });

  function save() {
    saveCardInfo(draft);
    showToast("اطلاعات ذخیره شد");
  }

  return (
    <div className="admin-section">
      <div className="admin-section-title">
        <span>💳 شماره کارت</span>
      </div>
      <div className="order-form">
        <label>
          شماره کارت
          <input value={draft.number} onChange={(e) => setDraft((d) => ({ ...d, number: e.target.value }))} placeholder="مثال: 6037-XXXX-XXXX-XXXX" />
        </label>
        <label>
          نام صاحب حساب
          <input value={draft.holder} onChange={(e) => setDraft((d) => ({ ...d, holder: e.target.value }))} placeholder="نام و نام خانوادگی" />
        </label>
        <label>
          شماره تماس
          <input value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} placeholder="07XXXXXXXX" type="tel" />
        </label>
        <label>
          شماره واتساپ (با کد کشور، بدون + یا صفر اول)
          <input value={draft.whatsapp} onChange={(e) => setDraft((d) => ({ ...d, whatsapp: e.target.value }))} placeholder="مثال: 93701234567" type="tel" />
        </label>
        <button className="btn-primary full" onClick={save}>
          ذخیره
        </button>
      </div>
    </div>
  );
}

function Dashboard({ orders, products }) {
  const total = orders.length;
  const pending = orders.filter((o) => o.status === "pending").length;
  const completed = orders.filter((o) => o.status === "completed").length;
  const revenue = orders.filter((o) => o.status === "completed").reduce((s, o) => s + Number(o.price || 0), 0);
  const activeProducts = products.filter((p) => p.active).length;

  return (
    <div className="stat-grid">
      <div className="stat-card">
        <div className="stat-value">{fmt(total)}</div>
        <div className="stat-label">کل سفارش‌ها</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{fmt(pending)}</div>
        <div className="stat-label">در انتظار</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{fmt(completed)}</div>
        <div className="stat-label">تکمیل شده</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{fmt(revenue)}</div>
        <div className="stat-label">درآمد تکمیل‌شده (واحدهای مختلط)</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{fmt(activeProducts)}</div>
        <div className="stat-label">محصولات فعال</div>
      </div>
    </div>
  );
}

function ProductsManager({ products, saveProducts, showToast }) {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({});
  const [adding, setAdding] = useState(null); // 'internet' | 'credit' | null
  const [newProd, setNewProd] = useState({ title: "", subtitle: "", price: "", currency: "TOMAN" });

  function startEdit(p) {
    setEditing(p.id);
    setDraft({ title: p.title, subtitle: p.subtitle, price: p.price, currency: p.currency || "TOMAN" });
  }
  function saveEdit(p) {
    const next = products.map((x) =>
      x.id === p.id ? { ...x, title: draft.title, subtitle: draft.subtitle, price: Number(draft.price) || 0, currency: draft.currency || "TOMAN" } : x
    );
    saveProducts(next);
    setEditing(null);
    showToast("محصول به‌روزرسانی شد");
  }
  function toggleActive(p) {
    saveProducts(products.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)));
  }
  function remove(p) {
    saveProducts(products.filter((x) => x.id !== p.id));
    showToast("محصول حذف شد");
  }
  function addProduct(category) {
    if (!newProd.title.trim() || !newProd.price) {
      showToast("عنوان و قیمت را وارد کنید");
      return;
    }
    const item = {
      id: newId(category),
      category,
      title: newProd.title,
      subtitle: newProd.subtitle,
      price: Number(newProd.price) || 0,
      currency: newProd.currency || "TOMAN",
      active: true,
    };
    saveProducts([...products, item]);
    setNewProd({ title: "", subtitle: "", price: "", currency: "TOMAN" });
    setAdding(null);
    showToast("محصول اضافه شد");
  }

  function Section({ category, label }) {
    const list = products.filter((p) => p.category === category);
    return (
      <div className="admin-section">
        <div className="admin-section-title">
          <span>{label}</span>
          <button className="btn-ghost small" onClick={() => setAdding(adding === category ? null : category)}>
            {adding === category ? "بستن" : "+ افزودن محصول"}
          </button>
        </div>
        {adding === category && (
          <div className="add-form">
            <input placeholder="عنوان" value={newProd.title} onChange={(e) => setNewProd((n) => ({ ...n, title: e.target.value }))} />
            <input placeholder="زیرعنوان" value={newProd.subtitle} onChange={(e) => setNewProd((n) => ({ ...n, subtitle: e.target.value }))} />
            <input placeholder="قیمت" type="number" value={newProd.price} onChange={(e) => setNewProd((n) => ({ ...n, price: e.target.value }))} />
            <select value={newProd.currency} onChange={(e) => setNewProd((n) => ({ ...n, currency: e.target.value }))}>
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {CURRENCY_LABELS[c]}
                </option>
              ))}
            </select>
            <button className="btn-primary small" onClick={() => addProduct(category)}>
              ذخیره
            </button>
          </div>
        )}
        {list.map((p) => (
          <div className="admin-product-row" key={p.id}>
            {editing === p.id ? (
              <div className="add-form">
                <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
                <input value={draft.subtitle} onChange={(e) => setDraft((d) => ({ ...d, subtitle: e.target.value }))} />
                <input type="number" value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))} />
                <select value={draft.currency} onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value }))}>
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {CURRENCY_LABELS[c]}
                    </option>
                  ))}
                </select>
                <button className="btn-primary small" onClick={() => saveEdit(p)}>
                  ذخیره
                </button>
                <button className="btn-ghost small" onClick={() => setEditing(null)}>
                  انصراف
                </button>
              </div>
            ) : (
              <>
                <div className="product-info">
                  <div className="product-title">
                    {p.title} {!p.active && <span className="inactive-tag">غیرفعال</span>}
                  </div>
                  <div className="product-subtitle">{p.subtitle}</div>
                </div>
                <div className="product-actions">
                  <div className="product-price">
                    {fmt(p.price)} {CURRENCY_LABELS[p.currency || "TOMAN"]}
                  </div>
                  <button className="btn-ghost small" onClick={() => startEdit(p)}>
                    ویرایش
                  </button>
                  <button className="btn-ghost small" onClick={() => toggleActive(p)}>
                    {p.active ? "غیرفعال کردن" : "فعال کردن"}
                  </button>
                  <button className="btn-danger small" onClick={() => remove(p)}>
                    حذف
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <Section category="internet" label="📶 بسته‌های اینترنت" />
      <Section category="credit" label="📞 شارژ تماس" />
    </div>
  );
}

function OrdersManager({ orders, saveOrders }) {
  const [expanded, setExpanded] = useState(null);
  function setStatus(o, status) {
    saveOrders(orders.map((x) => (x.id === o.id ? { ...x, status } : x)));
  }
  return (
    <div className="admin-section">
      {orders.length === 0 && <div className="empty-state">هنوز سفارشی ثبت نشده است.</div>}
      {orders.map((o) => (
        <div className="admin-order-row" key={o.id}>
          <div className="admin-order-top" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
            <span>
              {TYPE_ICONS[o.type]} {o.customerName || "—"}
            </span>
            <span className="order-card-price">{fmt(o.price)} {CURRENCY_LABELS[o.currency || "TOMAN"]}</span>
          </div>
          <div className="admin-order-meta">
            <span>{o.phone}</span>
            <span>{o.item}</span>
            <span>کد: {o.trackingCode}</span>
            <span>{fmtDate(o.date)}</span>
          </div>
          {expanded === o.id && o.type === "remittance" && (
            <div className="admin-order-detail">
              <div>گیرنده: {o.receiverName}</div>
              <div>مقصد: {o.destination}</div>
              {o.notes && <div>توضیحات: {o.notes}</div>}
            </div>
          )}
          <div className="status-row">
            {STATUS_ORDER.map((s) => (
              <button key={s} className={"status-pill" + (o.status === s ? " active status-" + s : "")} onClick={() => setStatus(o, s)}>
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RatesManager({ rates, saveRates, showToast }) {
  const [drafts, setDrafts] = useState(() => Object.fromEntries(rates.map((r) => [r.code, r.value])));
  const [newRate, setNewRate] = useState({ code: "", label: "", value: "" });

  function save(code) {
    saveRates(rates.map((r) => (r.code === code ? { ...r, value: Number(drafts[code]) || 0 } : r)));
    showToast("نرخ به‌روزرسانی شد");
  }
  function addRate() {
    if (!newRate.code.trim() || !newRate.label.trim() || !newRate.value) {
      showToast("همه فیلدهای ارز جدید را تکمیل کنید");
      return;
    }
    saveRates([...rates, { code: newRate.code.toUpperCase(), label: newRate.label, value: Number(newRate.value) || 0 }]);
    setNewRate({ code: "", label: "", value: "" });
    showToast("ارز جدید اضافه شد");
  }

  return (
    <div className="admin-section">
      {rates.map((r) => (
        <div className="rate-row" key={r.code}>
          <div className="rate-row-label">
            <b>{r.code}</b> {r.label}
          </div>
          <input
            type="number"
            value={drafts[r.code]}
            onChange={(e) => setDrafts((d) => ({ ...d, [r.code]: e.target.value }))}
          />
          <button className="btn-primary small" onClick={() => save(r.code)}>
            ذخیره
          </button>
        </div>
      ))}
      <div className="add-form">
        <input placeholder="کد ارز (USD)" value={newRate.code} onChange={(e) => setNewRate((n) => ({ ...n, code: e.target.value }))} />
        <input placeholder="نام ارز" value={newRate.label} onChange={(e) => setNewRate((n) => ({ ...n, label: e.target.value }))} />
        <input placeholder="نرخ" type="number" value={newRate.value} onChange={(e) => setNewRate((n) => ({ ...n, value: e.target.value }))} />
        <button className="btn-primary small" onClick={addRate}>
          افزودن ارز
        </button>
      </div>
    </div>
  );
}

function Style() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800&display=swap');

      .afgan-root {
        --bg: #F6F3EC;
        --surface: #FFFFFF;
        --ink: #1F2620;
        --ink-soft: #5B6660;
        --primary: #0E4D44;
        --primary-dark: #0A362F;
        --accent: #C9973A;
        --accent-soft: #F1E0B4;
        --success: #3C8A63;
        --danger: #B5482C;
        --board-bg: #12241F;
        --board-digit: #E7B65C;
        font-family: 'Vazirmatn', Tahoma, sans-serif;
        background: var(--bg);
        color: var(--ink);
        min-height: 100vh;
        max-width: 480px;
        margin: 0 auto;
        box-shadow: 0 0 40px rgba(0,0,0,0.06);
        display: flex;
        flex-direction: column;
      }
      * { box-sizing: border-box; }
      .loading-screen {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        height: 100vh; gap: 14px; color: var(--primary); font-weight: 600;
      }
      .afgan-header {
        background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
        padding: 20px 18px 24px;
        border-radius: 0 0 28px 28px;
        position: relative;
        color: #fff;
      }
      .brand { display: flex; align-items: center; gap: 12px; }
      .logo-mark {
        width: 44px; height: 44px; border-radius: 14px;
        background: linear-gradient(135deg, var(--accent), #a97a24);
        color: #1F2620; font-weight: 800; font-size: 20px;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 4px 10px rgba(0,0,0,0.25);
      }
      .brand-name { font-size: 22px; font-weight: 800; letter-spacing: 1px; }
      .brand-tag { font-size: 12px; opacity: 0.85; margin-top: 2px; }
      .gear-btn {
        position: absolute; left: 16px; top: 18px;
        background: rgba(255,255,255,0.14); border: none; color: #fff;
        width: 36px; height: 36px; border-radius: 50%; font-size: 16px; cursor: pointer;
      }
      .afgan-main { padding: 16px; flex: 1; }
      .fade-in { animation: fadeIn 0.25s ease; }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

      .rate-board {
        background: var(--board-bg);
        border-radius: 20px;
        padding: 14px 16px 16px;
        margin: -34px 0 18px;
        box-shadow: 0 10px 24px rgba(10,54,47,0.25);
      }
      .rate-board-title { display: flex; justify-content: space-between; color: var(--accent-soft); font-size: 13px; margin-bottom: 10px; font-weight: 600; }
      .rate-board-unit { opacity: 0.7; font-weight: 400; }
      .rate-strip { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 2px; }
      .rate-chip {
        min-width: 82px; background: rgba(255,255,255,0.05); border: 1px solid rgba(231,182,92,0.25);
        border-radius: 12px; padding: 8px 10px; text-align: center; flex-shrink: 0;
      }
      .rate-code { color: var(--accent-soft); font-size: 11px; font-weight: 700; letter-spacing: 1px; }
      .rate-value { color: var(--board-digit); font-size: 17px; font-weight: 800; font-variant-numeric: tabular-nums; margin: 2px 0; }
      .rate-label { color: #9fb0aa; font-size: 10px; }

      .card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .service-card {
        background: var(--surface); border: none; border-radius: 20px; padding: 18px 14px;
        box-shadow: 0 6px 18px rgba(14,77,68,0.08); text-align: right; cursor: pointer;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      .service-card:hover { transform: translateY(-3px); box-shadow: 0 10px 22px rgba(14,77,68,0.15); }
      .service-icon { font-size: 26px; margin-bottom: 8px; }
      .service-title { font-weight: 700; font-size: 15px; margin-bottom: 4px; }
      .service-desc { font-size: 12px; color: var(--ink-soft); line-height: 1.5; }

      .page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
      .back-btn { background: none; border: none; color: var(--primary); font-weight: 600; font-size: 14px; cursor: pointer; }
      .page-title { font-size: 18px; font-weight: 800; display: flex; align-items: center; gap: 6px; }

      .product-list { display: flex; flex-direction: column; gap: 10px; }
      .product-row, .admin-product-row {
        background: var(--surface); border-radius: 16px; padding: 14px 16px;
        display: flex; justify-content: space-between; align-items: center;
        box-shadow: 0 4px 14px rgba(14,77,68,0.06);
      }
      .product-title { font-weight: 700; font-size: 14px; }
      .product-subtitle { font-size: 12px; color: var(--ink-soft); margin-top: 2px; }
      .product-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
      .product-price { font-weight: 800; color: var(--primary); font-size: 14px; }
      .inactive-tag { font-size: 10px; color: var(--danger); border: 1px solid var(--danger); border-radius: 6px; padding: 1px 6px; margin-right: 6px; }

      .btn-primary {
        background: var(--primary); color: #fff; border: none; border-radius: 12px;
        padding: 10px 16px; font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit;
      }
      .btn-primary.small { padding: 7px 12px; font-size: 12px; }
      .btn-primary.full { width: 100%; padding: 13px; font-size: 15px; border-radius: 14px; }
      .btn-ghost { background: none; border: 1px solid #d8d3c4; color: var(--ink-soft); border-radius: 12px; padding: 9px 14px; font-weight: 600; font-size: 13px; cursor: pointer; font-family: inherit; }
      .btn-ghost.small { padding: 6px 10px; font-size: 12px; }
      .btn-danger { background: none; border: 1px solid var(--danger); color: var(--danger); border-radius: 12px; padding: 6px 10px; font-size: 12px; cursor: pointer; font-family: inherit; }

      .order-form { background: var(--surface); border-radius: 20px; padding: 18px; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 6px 18px rgba(14,77,68,0.08); }
      .order-form label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: var(--ink-soft); }
      .order-form input, .order-form textarea {
        font-family: inherit; padding: 11px 12px; border-radius: 12px; border: 1px solid #e2ddce; font-size: 14px; color: var(--ink); background: #FBFAF6;
      }
      .order-form input:focus, .order-form textarea:focus { outline: 2px solid var(--primary); border-color: transparent; }
      .order-form-summary { background: var(--accent-soft); border-radius: 12px; padding: 10px 12px; font-size: 13px; }
      .form-error { color: var(--danger); font-size: 12px; }
      .form-btn-row { display: flex; gap: 10px; }
      .hint-text { font-size: 11px; color: var(--ink-soft); text-align: center; }

      .search-row { display: flex; gap: 8px; margin-bottom: 14px; }
      .search-row input { flex: 1; padding: 11px 12px; border-radius: 12px; border: 1px solid #e2ddce; font-family: inherit; }
      .order-list { display: flex; flex-direction: column; gap: 10px; }
      .order-card { background: var(--surface); border-radius: 16px; padding: 14px; box-shadow: 0 4px 14px rgba(14,77,68,0.06); }
      .order-card-top { display: flex; justify-content: space-between; font-weight: 700; font-size: 13px; margin-bottom: 6px; }
      .order-card-body { display: flex; justify-content: space-between; font-size: 13px; }
      .order-card-price { font-weight: 800; color: var(--primary); }
      .order-card-date { font-size: 11px; color: var(--ink-soft); margin-top: 6px; }
      .empty-state { text-align: center; color: var(--ink-soft); font-size: 13px; padding: 24px 0; }

      .status-badge { font-size: 11px; padding: 3px 9px; border-radius: 8px; font-weight: 700; }
      .status-pending { background: #FBE9CF; color: #9A6A1F; }
      .status-processing { background: #DCEAF5; color: #2A5F86; }
      .status-completed { background: #DCEFE3; color: var(--success); }
      .status-cancelled { background: #F5DCD5; color: var(--danger); }

      .admin-tabs { display: flex; gap: 6px; margin-bottom: 16px; overflow-x: auto; }
      .admin-tab { background: var(--surface); border: none; border-radius: 12px; padding: 9px 14px; font-size: 12px; font-weight: 700; color: var(--ink-soft); cursor: pointer; font-family: inherit; flex-shrink: 0; }
      .admin-tab.active { background: var(--primary); color: #fff; }

      .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .stat-card { background: var(--surface); border-radius: 16px; padding: 16px; text-align: center; box-shadow: 0 4px 14px rgba(14,77,68,0.06); }
      .stat-value { font-size: 20px; font-weight: 800; color: var(--primary); }
      .stat-label { font-size: 12px; color: var(--ink-soft); margin-top: 4px; }

      .admin-section { margin-bottom: 22px; }
      .admin-section-title { display: flex; justify-content: space-between; align-items: center; font-weight: 700; margin-bottom: 10px; font-size: 14px; }
      .add-form { display: flex; flex-wrap: wrap; gap: 8px; background: #FBFAF6; border-radius: 12px; padding: 10px; margin-bottom: 10px; }
      .add-form input { flex: 1; min-width: 90px; padding: 8px 10px; border-radius: 10px; border: 1px solid #e2ddce; font-family: inherit; font-size: 13px; }

      .admin-order-row { background: var(--surface); border-radius: 16px; padding: 12px 14px; margin-bottom: 10px; box-shadow: 0 4px 14px rgba(14,77,68,0.06); }
      .admin-order-top { display: flex; justify-content: space-between; font-weight: 700; font-size: 13px; cursor: pointer; }
      .admin-order-meta { display: flex; gap: 10px; flex-wrap: wrap; font-size: 11px; color: var(--ink-soft); margin: 6px 0; }
      .admin-order-detail { background: #FBFAF6; border-radius: 10px; padding: 8px 10px; font-size: 12px; margin-bottom: 8px; }
      .status-row { display: flex; gap: 6px; flex-wrap: wrap; }
      .status-pill { border: 1px solid #e2ddce; background: none; border-radius: 10px; padding: 5px 10px; font-size: 11px; cursor: pointer; font-family: inherit; color: var(--ink-soft); }
      .status-pill.active.status-pending { background: #FBE9CF; color: #9A6A1F; border-color: transparent; }
      .status-pill.active.status-processing { background: #DCEAF5; color: #2A5F86; border-color: transparent; }
      .status-pill.active.status-completed { background: #DCEFE3; color: var(--success); border-color: transparent; }
      .status-pill.active.status-cancelled { background: #F5DCD5; color: var(--danger); border-color: transparent; }

      .rate-row { display: flex; align-items: center; gap: 10px; background: var(--surface); border-radius: 14px; padding: 10px 12px; margin-bottom: 8px; box-shadow: 0 4px 14px rgba(14,77,68,0.06); }
      .rate-row-label { flex: 1; font-size: 13px; }
      .rate-row input { width: 90px; padding: 8px 10px; border-radius: 10px; border: 1px solid #e2ddce; font-family: inherit; }

      .order-card-track { font-size: 11px; color: var(--primary); font-weight: 700; margin-top: 4px; }

      .confirm-screen { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: 30px 10px; }
      .confirm-check { font-size: 48px; }
      .confirm-title { font-size: 18px; font-weight: 800; }
      .confirm-code-label { font-size: 12px; color: var(--ink-soft); margin-top: 10px; }
      .confirm-code {
        font-size: 26px; font-weight: 800; letter-spacing: 2px; color: var(--primary);
        background: var(--accent-soft); border-radius: 12px; padding: 8px 20px; font-variant-numeric: tabular-nums;
      }
      .confirm-note { font-size: 13px; color: var(--ink-soft); line-height: 1.8; background: #FBFAF6; border-radius: 14px; padding: 14px; margin: 6px 0 14px; }

      .payment-card {
        margin-top: 18px;
        background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 70%);
        border-radius: 22px;
        padding: 20px 22px;
        color: #fff;
        box-shadow: 0 10px 24px rgba(14,77,68,0.25);
        position: relative;
        overflow: hidden;
      }
      .payment-card::after {
        content: ""; position: absolute; left: -30px; bottom: -30px; width: 120px; height: 120px;
        border-radius: 50%; background: rgba(201,151,58,0.18);
      }
      .payment-card-label { font-size: 12px; opacity: 0.75; margin-bottom: 8px; }
      .payment-card-number { font-size: 20px; font-weight: 800; letter-spacing: 2px; font-variant-numeric: tabular-nums; margin-bottom: 8px; }
      .payment-card-holder { font-size: 13px; opacity: 0.9; }
      .payment-card-phone { font-size: 12px; opacity: 0.8; margin-top: 4px; }

      .whatsapp-btn {
        display: flex; align-items: center; justify-content: center; gap: 8px;
        margin-top: 12px; background: #22c55e; color: #fff; text-decoration: none;
        border-radius: 16px; padding: 13px; font-weight: 700; font-size: 14px;
        box-shadow: 0 6px 16px rgba(34,197,94,0.3);
      }
      .whatsapp-icon { font-size: 18px; }

      .toast {
        position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
        background: var(--primary-dark); color: #fff; padding: 12px 20px; border-radius: 14px;
        font-size: 13px; box-shadow: 0 8px 20px rgba(0,0,0,0.25); z-index: 50; max-width: 90%; text-align: center;
      }
    `}</style>
  );
}
