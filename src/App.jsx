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
  { code: "USD", label: "دلار آمریکا", value: 60000 },
  { code: "EUR", label: "یورو", value: 65000 },
  { code: "AED", label: "درهم امارات", value: 16300 },
  { code: "PKR", label: "کلدار پاکستان", value: 210 },
  { code: "AFN", label: "افغانی (نرخ حواله)", value: 0.345 },
];

// تنظیمات قیمت‌گذاری بخش شارژ تماس: روش «دستی» یعنی مدیر قیمت هر محصول را خودش وارد می‌کند،
// و روش «خودکار» یعنی با تعیین یک نرخ توسط مدیر، قیمت از روی عدد فیلد عنوان محاسبه می‌شود.
const DEFAULT_CREDIT_SETTINGS = { mode: "manual", rate: 0 };

// مبلغ افغانی حواله را با نرخ روز افغانی به تومان تبدیل می‌کند و رقم اعشار را حذف می‌کند.
function afnToToman(amountAfn, afnRateValue) {
  const rate = Number(afnRateValue) || 0;
  if (rate <= 0) return 0;
  return Math.floor((Number(amountAfn) || 0) / rate * 1000);
}

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
// ارقام فارسی/عربی را به ارقام انگلیسی تبدیل می‌کند تا بتوان از متن فیلد عنوان عدد استخراج کرد.
function faToEnDigits(str) {
  const faDigits = "۰۱۲۳۴۵۶۷۸۹";
  const arDigits = "٠١٢٣٤٥٦٧٨٩";
  return String(str || "").replace(/[۰-۹٠-٩]/g, (d) => {
    const i = faDigits.indexOf(d);
    if (i > -1) return String(i);
    const j = arDigits.indexOf(d);
    if (j > -1) return String(j);
    return d;
  });
}
// اولین عدد موجود در فیلد عنوان (مثلاً از «۱۰۰ افغانی» عدد ۱۰۰) را استخراج می‌کند.
function extractNumber(str) {
  const normalized = faToEnDigits(str);
  const match = normalized.match(/[\d]+(\.[\d]+)?/);
  return match ? parseFloat(match[0]) : null;
}
// در حالت قیمت‌گذاری خودکار شارژ تماس: عدد فیلد عنوان تقسیم بر نرخ تعیین‌شده مدیر، ضربدر ۱۰۰۰.
// نتیجه به عدد صحیح (بدون اعشار) کوتاه می‌شود؛ فقط رقم‌های قبل از نقطه اعشار در نظر گرفته می‌شوند.
function computeAutoCreditPrice(title, rate) {
  const num = extractNumber(title);
  const r = Number(rate) || 0;
  if (num === null || r <= 0) return null;
  return Math.trunc((num / r) * 1000);
}
// شماره واتساپ را برای لینک wa.me نرمال می‌کند: کاراکترهای غیرعددی، صفر بین‌المللی (00)
// و صفر ابتدای فرمت داخلی را حذف و در صورت نبود کد کشور، کد افغانستان (93) را اضافه می‌کند.
function normalizeWhatsApp(number) {
  let digits = String(number || "").replace(/[^0-9]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = "93" + digits.slice(1);
  return digits;
}

// جزئیات سفارش را به فانکشن نتلیفای (netlify/functions/send-invoice.js) می‌فرستد
// تا آن فانکشن پیام را با نام کاربری و تمام جزئیات سفارش به تلگرام مدیر ارسال کند.
// شکست این درخواست نباید مانع ثبت سفارش برای مشتری شود، پس فقط در کنسول لاگ می‌شود.
async function sendOrderToTelegram(order) {
  try {
    const res = await fetch("/.netlify/functions/send-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("send-invoice failed:", res.status, errText);
    }
  } catch (e) {
    console.error("send-invoice request error:", e);
  }
}

export default function AfganApp() {
  const [page, setPage] = useState("home");
  const [products, setProducts] = useState(null);
  const [rates, setRates] = useState(null);
  const [creditSettings, setCreditSettings] = useState(null);
  const [orders, setOrders] = useState(null);
  const [cardInfo, setCardInfo] = useState(null);
  const [customers, setCustomers] = useState(null);
  const [operators, setOperators] = useState(null);
  const [currentCustomer, setCurrentCustomer] = useState(null);
  const [lastOrder, setLastOrder] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminTab, setAdminTab] = useState("dashboard");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    init();
  }, []);

  // Restore a logged-in customer's session (if any) once customers are loaded,
  // so they stay logged in across page reloads until they explicitly log out.
  useEffect(() => {
    if (loaded && customers && !currentCustomer) {
      try {
        const savedId = localStorage.getItem("afgan_customer_id");
        if (savedId) {
          const found = customers.find((c) => c.id === savedId);
          if (found) setCurrentCustomer(found);
        }
      } catch (e) {}
    }
  }, [loaded, customers]);

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
          setCreditSettings((prev) => (JSON.stringify(prev) !== JSON.stringify(record.creditSettings) ? record.creditSettings : prev));
          setOrders((prev) => (JSON.stringify(prev) !== JSON.stringify(record.orders) ? record.orders : prev));
          setCardInfo((prev) => (JSON.stringify(prev) !== JSON.stringify(record.cardInfo) ? record.cardInfo : prev));
          setCustomers((prev) => (JSON.stringify(prev) !== JSON.stringify(record.customers) ? record.customers : prev));
          setOperators((prev) => (JSON.stringify(prev) !== JSON.stringify(record.operators) ? record.operators : prev));
        }
      } catch (e) {
        // network hiccup - just try again next interval
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  async function init() {
    let record = null;
    let fetchOk = false;
    try {
      const res = await fetch(JSONBIN_URL + "/latest", { headers: { "X-Master-Key": JSONBIN_API_KEY } });
      if (res.ok) {
        const data = await res.json();
        record = data && data.record;
        fetchOk = true;
      }
    } catch (e) {}

    let products = (record && record.products) || [];
    let rates = (record && record.rates) || [];
    let creditSettings = (record && record.creditSettings) || null;
    let orders = (record && record.orders) || [];
    let cardInfo = (record && record.cardInfo) || { number: "", holder: "", phone: "", whatsapp: "" };
    let customers = (record && record.customers) || [];
    let operators = (record && record.operators) || [];
    let needsSeed = false;

    // فقط وقتی خواندن از JSONBin واقعاً موفق بوده (fetchOk) اجازه داریم seed/overwrite کنیم.
    // اگر درخواست شکست بخورد یا JSONBin محدودیت تعداد درخواست (rate limit) اعمال کند،
    // نباید داده‌های واقعی موجود روی سرور را با مقادیر پیش‌فرض خالی جایگزین کنیم؛
    // در آن حالت فقط برای نمایش موقت از پیش‌فرض‌ها استفاده می‌کنیم، بدون نوشتن روی سرور.
    if (fetchOk) {
      if (!products.length) {
        products = DEFAULT_PRODUCTS;
        needsSeed = true;
      }
      if (!rates.length) {
        rates = DEFAULT_RATES;
        needsSeed = true;
      }
      if (!creditSettings) {
        creditSettings = DEFAULT_CREDIT_SETTINGS;
        needsSeed = true;
      }
      if (!record || !record.cardInfo) {
        needsSeed = true;
      }
      if (!record || !record.customers) {
        needsSeed = true;
      }
      if (!record || !record.operators) {
        needsSeed = true;
      }
    } else {
      if (!products.length) products = DEFAULT_PRODUCTS;
      if (!rates.length) rates = DEFAULT_RATES;
      if (!creditSettings) creditSettings = DEFAULT_CREDIT_SETTINGS;
    }

    if (needsSeed) {
      try {
        await fetch(JSONBIN_URL, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "X-Master-Key": JSONBIN_API_KEY },
          body: JSON.stringify({ products, rates, creditSettings, orders, cardInfo, customers, operators }),
        });
      } catch (e) {}
    }

    setProducts(products);
    setRates(rates);
    setCreditSettings(creditSettings);
    setOrders(orders);
    setCardInfo(cardInfo);
    setCustomers(customers);
    setOperators(operators);
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
    persist({ products: next, rates, creditSettings, orders, cardInfo, customers, operators });
  }
  async function saveRates(next) {
    setRates(next);
    persist({ products, rates: next, creditSettings, orders, cardInfo, customers, operators });
  }
  async function saveCreditSettings(next) {
    setCreditSettings(next);
    persist({ products, rates, creditSettings: next, orders, cardInfo, customers, operators });
  }
  async function saveOrders(next) {
    setOrders(next);
    persist({ products, rates, creditSettings, orders: next, cardInfo, customers, operators });
  }
  async function saveCardInfo(next) {
    setCardInfo(next);
    persist({ products, rates, creditSettings, orders, cardInfo: next, customers, operators });
  }
  async function saveCustomers(next) {
    setCustomers(next);
    persist({ products, rates, creditSettings, orders, cardInfo, customers: next, operators });
  }
  async function saveOperators(next) {
    setOperators(next);
    persist({ products, rates, creditSettings, orders, cardInfo, customers, operators: next });
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  // ثبت سفارش و کسر کیف پول را در یک عملیات واحد و یک درخواست ذخیره‌سازی انجام می‌دهد
  // تا دو درخواست جداگانه با هم رقابت نکنند و باعث گم‌شدن سفارش یا کسر نشدن کیف پول نشوند.
  function placeOrderAndDeduct(order, deductAmount) {
    const full = {
      id: newId("ord"),
      trackingCode: genTrackingCode(),
      date: new Date().toISOString(),
      status: "pending",
      walletDeduction: deductAmount || 0, // مبلغی که از کیف پول کسر شد - برای بازگشت خودکار در صورت لغو سفارش لازم است
      refunded: false,
      ...order,
    };
    const newOrders = [full, ...(orders || [])];
    let newCustomers = customers;
    if (currentCustomer && deductAmount) {
      newCustomers = (customers || []).map((c) =>
        c.id === currentCustomer.id ? { ...c, wallet: (c.wallet || 0) - deductAmount } : c
      );
      setCurrentCustomer((prev) => (prev ? { ...prev, wallet: (prev.wallet || 0) - deductAmount } : prev));
    }
    setOrders(newOrders);
    setCustomers(newCustomers);
    persist({ products, rates, creditSettings, orders: newOrders, cardInfo, customers: newCustomers, operators });
    sendOrderToTelegram(full);
    return full;
  }

  // تغییر وضعیت سفارش توسط مدیر. اگر وضعیت به «لغو شده» تغییر کند و سفارش قبلاً
  // بازگشت داده نشده باشد، مبلغ کسر شده از کیف پول به‌طور خودکار به حساب مشتری برمی‌گردد.
  function updateOrderStatus(order, status) {
    const shouldRefund = status === "cancelled" && !order.refunded && (order.walletDeduction || 0) > 0 && order.customerId;
    const newOrders = (orders || []).map((x) =>
      x.id === order.id ? { ...x, status, refunded: x.refunded || shouldRefund } : x
    );
    let newCustomers = customers;
    if (shouldRefund) {
      newCustomers = (customers || []).map((c) =>
        c.id === order.customerId ? { ...c, wallet: (c.wallet || 0) + order.walletDeduction } : c
      );
      if (currentCustomer && currentCustomer.id === order.customerId) {
        setCurrentCustomer((prev) => (prev ? { ...prev, wallet: (prev.wallet || 0) + order.walletDeduction } : prev));
      }
      showToast("سفارش لغو شد و مبلغ " + fmt(order.walletDeduction) + " تومان به کیف پول مشتری بازگشت داده شد");
    }
    setOrders(newOrders);
    setCustomers(newCustomers);
    persist({ products, rates, creditSettings, orders: newOrders, cardInfo, customers: newCustomers, operators });
  }

  function requireLogin() {
    showToast("برای ثبت سفارش ابتدا باید وارد حساب کاربری خود شوید");
    setPage("customerLogin");
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
      <Header onAdmin={() => setPage(isAdmin ? "admin" : "adminLogin")} onCustomer={() => setPage(currentCustomer ? "customerProfile" : "customerLogin")} />
      <main className="afgan-main">
        {page === "home" && <Home rates={rates} cardInfo={cardInfo} currentCustomer={currentCustomer} setPage={setPage} />}
        {page === "internet" && (
          <CategoryShop
            title="بسته اینترنت"
            icon="📶"
            category="internet"
            operators={operators || []}
            products={products.filter((p) => p.category === "internet" && p.active)}
            isLoggedIn={!!currentCustomer}
            onRequireLogin={requireLogin}
            onOrder={(item, form) => {
              if (currentCustomer && (currentCustomer.wallet || 0) < item.price) {
                showToast("موجودی شما کافی نیست");
                return;
              }
              const opInternet = (operators || []).find((op) => op.id === item.operatorId);
              const full = placeOrderAndDeduct(
                {
                  type: "internet",
                  item: item.title,
                  subtitle: item.subtitle || "",
                  operatorName: opInternet ? opInternet.name : "",
                  price: item.price,
                  currency: item.currency || "TOMAN",
                  customerName: currentCustomer ? currentCustomer.name : "",
                  customerUsername: currentCustomer ? currentCustomer.username : "",
                  phone: form.phone,
                  customerId: currentCustomer ? currentCustomer.id : undefined,
                },
                currentCustomer ? item.price : 0
              );
              setLastOrder(full);
              setPage("confirm");
            }}
            onBack={() => setPage("home")}
          />
        )}
        {page === "credit" && (
          <CategoryShop
            title="شارژ تماس"
            icon="📞"
            category="credit"
            operators={operators || []}
            products={products.filter((p) => p.category === "credit" && p.active)}
            isLoggedIn={!!currentCustomer}
            onRequireLogin={requireLogin}
            onOrder={(item, form) => {
              if (currentCustomer && (currentCustomer.wallet || 0) < item.price) {
                showToast("موجودی شما کافی نیست");
                return;
              }
              const opCredit = (operators || []).find((op) => op.id === item.operatorId);
              const full = placeOrderAndDeduct(
                {
                  type: "credit",
                  item: item.title,
                  subtitle: item.subtitle || "",
                  operatorName: opCredit ? opCredit.name : "",
                  price: item.price,
                  currency: item.currency || "TOMAN",
                  customerName: currentCustomer ? currentCustomer.name : "",
                  customerUsername: currentCustomer ? currentCustomer.username : "",
                  phone: form.phone,
                  customerId: currentCustomer ? currentCustomer.id : undefined,
                },
                currentCustomer ? item.price : 0
              );
              setLastOrder(full);
              setPage("confirm");
            }}
            onBack={() => setPage("home")}
          />
        )}
        {page === "remittance" && (
          <RemittanceForm
            isLoggedIn={!!currentCustomer}
            onRequireLogin={requireLogin}
            afnRate={((rates || []).find((r) => r.code === "AFN") || {}).value}
            onSubmit={(form) => {
              const amountAfn = Number(form.amount) || 0;
              const afnRateValue = ((rates || []).find((r) => r.code === "AFN") || {}).value;
              const tomanAmount = afnToToman(amountAfn, afnRateValue);
              if (!tomanAmount) {
                showToast("نرخ روز افغانی هنوز توسط مدیریت ثبت نشده است");
                return;
              }
              if (currentCustomer && (currentCustomer.wallet || 0) < tomanAmount) {
                showToast("موجودی شما کافی نیست");
                return;
              }
              const full = placeOrderAndDeduct(
                {
                  type: "remittance",
                  item: "حواله ارزی",
                  price: amountAfn,
                  currency: "AFN",
                  tomanAmount,
                  afnRateUsed: Number(afnRateValue) || 0,
                  customerName: form.senderName,
                  customerUsername: currentCustomer ? currentCustomer.username : "",
                  phone: form.phone,
                  receiverName: form.receiverName,
                  destination: form.destination,
                  notes: form.notes,
                  customerId: currentCustomer ? currentCustomer.id : undefined,
                },
                currentCustomer ? tomanAmount : 0
              );
              setLastOrder(full);
              setPage("confirm");
            }}
            onBack={() => setPage("home")}
          />
        )}
        {page === "confirm" && lastOrder && <OrderConfirmation order={lastOrder} onDone={() => setPage("home")} />}
        {page === "orders" && <MyOrders orders={orders} currentCustomer={currentCustomer} onBack={() => setPage("home")} />}
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
        {page === "customerLogin" && (
          <CustomerLogin
            customers={customers}
            onLogin={(customer) => {
              setCurrentCustomer(customer);
              try {
                localStorage.setItem("afgan_customer_id", customer.id);
              } catch (e) {}
              setPage("home");
            }}
            onBack={() => setPage("home")}
            showToast={showToast}
          />
        )}
        {page === "customerProfile" && currentCustomer && (
          <CustomerProfile
            customer={currentCustomer}
            customers={customers}
            saveCustomers={saveCustomers}
            setCurrentCustomer={setCurrentCustomer}
            onLogout={() => {
              setCurrentCustomer(null);
              try {
                localStorage.removeItem("afgan_customer_id");
              } catch (e) {}
              setPage("home");
            }}
            onBack={() => setPage("home")}
            showToast={showToast}
          />
        )}
        {page === "admin" && isAdmin && (
          <AdminPanel
            products={products}
            rates={rates}
            creditSettings={creditSettings}
            orders={orders}
            cardInfo={cardInfo}
            customers={customers}
            operators={operators}
            tab={adminTab}
            setTab={setAdminTab}
            saveProducts={saveProducts}
            saveRates={saveRates}
            saveCreditSettings={saveCreditSettings}
            saveOrders={saveOrders}
            updateOrderStatus={updateOrderStatus}
            saveCardInfo={saveCardInfo}
            saveCustomers={saveCustomers}
            saveOperators={saveOperators}
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

function Header({ onAdmin, onCustomer }) {
  return (
    <header className="afgan-header">
      <button className="gear-btn" onClick={onAdmin} aria-label="مدیریت">
        ⚙
      </button>
      <button className="customer-btn" onClick={onCustomer} aria-label="ورود مشتری">
        👤
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

function Home({ rates, cardInfo, currentCustomer, setPage }) {
  return (
    <div className="fade-in">
      <RateBoard rates={rates} />
      {currentCustomer && (
        <div className="wallet-card" style={{ marginBottom: 18 }}>
          <div className="wallet-label">موجودی کیف پول شما</div>
          <div className="wallet-amount">{fmt(currentCustomer.wallet || 0)} تومان</div>
        </div>
      )}
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
  const clean = normalizeWhatsApp(number);
  return (
    <a className="whatsapp-btn" href={"https://wa.me/" + clean} target="_blank" rel="noreferrer">
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
        <span className="rate-board-unit">به تومان</span>
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

function ProductList({ title, icon, products, isLoggedIn, onRequireLogin, onOrder, onBack }) {
  const [selected, setSelected] = useState(null);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!phone.trim()) {
      setError("لطفاً شماره تماس را وارد کنید");
      return;
    }
    onOrder(selected, { phone });
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
                    if (!isLoggedIn) {
                      onRequireLogin();
                      return;
                    }
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
            شماره موبایل
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX" type="tel" />
          </label>
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

function CategoryShop({ title, icon, category, operators, products, isLoggedIn, onRequireLogin, onOrder, onBack }) {
  const [selectedOp, setSelectedOp] = useState(null);
  const catOperators = (operators || []).filter((o) => o.category === category);

  // No operators defined yet for this category - fall back to the flat product list.
  if (catOperators.length === 0) {
    return (
      <ProductList
        title={title}
        icon={icon}
        products={products}
        isLoggedIn={isLoggedIn}
        onRequireLogin={onRequireLogin}
        onOrder={onOrder}
        onBack={onBack}
      />
    );
  }

  if (!selectedOp) {
    return (
      <div className="fade-in">
        <PageHeader title={title} icon={icon} onBack={onBack} />
        <div className="card-grid">
          {catOperators.map((op) => (
            <button key={op.id} className="service-card" onClick={() => setSelectedOp(op)}>
              <div className="service-icon">📡</div>
              <div className="service-title">{op.name}</div>
              <div className="service-desc">مشاهده بسته‌های {op.name}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <ProductList
      title={selectedOp.name}
      icon={icon}
      products={products.filter((p) => p.operatorId === selectedOp.id)}
      isLoggedIn={isLoggedIn}
      onRequireLogin={onRequireLogin}
      onOrder={onOrder}
      onBack={() => setSelectedOp(null)}
    />
  );
}


function RemittanceForm({ isLoggedIn, onRequireLogin, onSubmit, onBack, afnRate }) {
  const [form, setForm] = useState({ senderName: "", phone: "", amount: "", receiverName: "", destination: "", notes: "" });
  const [error, setError] = useState("");
  const tomanPreview = afnToToman(form.amount, afnRate);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function submit(e) {
    e.preventDefault();
    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }
    if (!form.senderName.trim() || !form.phone.trim() || !form.amount || !form.receiverName.trim() || !form.destination.trim()) {
      setError("لطفاً همه فیلدهای ضروری را تکمیل کنید");
      return;
    }
    onSubmit(form);
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
        {form.amount && (
          <div className="order-form-summary">
            {tomanPreview
              ? <>معادل تقریبی: <b>{fmt(tomanPreview)}</b> تومان از کیف پول شما کسر می‌شود</>
              : "نرخ روز افغانی هنوز ثبت نشده — لطفاً با پشتیبانی تماس بگیرید"}
          </div>
        )}
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

function OrderCard({ o }) {
  return (
    <div className="order-card" key={o.id}>
      <div className="order-card-top">
        <span>
          {TYPE_ICONS[o.type]} {TYPE_LABELS[o.type]}
        </span>
        <span className={"status-badge status-" + o.status}>{STATUS_LABELS[o.status]}</span>
      </div>
      <div className="order-card-body">
        <div>
          {o.item}
          {o.operatorName ? " (" + o.operatorName + ")" : ""}
        </div>
        <div className="order-card-price">
          {fmt(o.price)} {CURRENCY_LABELS[o.currency || "TOMAN"]}
        </div>
      </div>
      {o.subtitle && <div className="order-card-track">{o.subtitle}</div>}
      {o.type === "remittance" && (
        <div className="order-card-track">
          گیرنده: {o.receiverName} — مقصد: {o.destination}
        </div>
      )}
      {o.type === "remittance" && !!o.tomanAmount && (
        <div className="order-card-track">مبلغ کسر شده از کیف پول: {fmt(o.tomanAmount)} تومان</div>
      )}
      <div className="order-card-track">
        کد پیگیری: <b>{o.trackingCode}</b>
      </div>
      <div className="order-card-date">{fmtDate(o.date)}</div>
    </div>
  );
}

function MyOrders({ orders, currentCustomer, onBack }) {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);

  if (currentCustomer) {
    const myOrders = orders.filter((o) => o.customerId === currentCustomer.id);
    return (
      <div className="fade-in">
        <PageHeader title="لیست سفارش" icon="📋" onBack={onBack} />
        {myOrders.length === 0 && <div className="empty-state">هنوز سفارشی ثبت نکرده‌اید.</div>}
        <div className="order-list">
          {myOrders.map((o) => (
            <OrderCard o={o} key={o.id} />
          ))}
        </div>
      </div>
    );
  }

  const q = query.trim();
  const results = orders.filter((o) => {
    if (!q) return false;
    const matchPhone = o.phone && o.phone.trim() === q;
    const matchCode = o.trackingCode && o.trackingCode.toLowerCase() === q.toLowerCase();
    return matchPhone || matchCode;
  });

  return (
    <div className="fade-in">
      <PageHeader title="لیست سفارش" icon="📋" onBack={onBack} />
      <div className="search-label">شماره موبایلی که با آن سفارش دادید یا کد پیگیری را وارد کنید</div>
      <div className="search-row">
        <input placeholder="شماره موبایل" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="btn-primary small" onClick={() => setSearched(true)}>
          جستجو
        </button>
      </div>
      {searched && results.length === 0 && <div className="empty-state">سفارشی با این مشخصات یافت نشد.</div>}
      <div className="order-list">
        {results.map((o) => (
          <OrderCard o={o} key={o.id} />
        ))}
      </div>
    </div>
  );
}

function AdminLogin({ onLogin, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function submit(e) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    // small delay just for the loading animation; the real check happens in onLogin
    setTimeout(() => {
      setLoading(false);
      onLogin(email, password);
    }, 650);
  }

  return (
    <div className="fade-in">
      <PageHeader title="ورود مدیریت" icon="🔐" onBack={onBack} />
      <div className="admin-login-wrap">
        <div className="admin-login-card">
          <div className="admin-login-badge">
            <span className="admin-login-badge-ring" />
            <span className="admin-login-badge-icon">🛡️</span>
          </div>
          <div className="admin-login-title">پنل مدیریت</div>
          <div className="admin-login-sub">برای ادامه، وارد حساب مدیریتی شوید</div>

          <form className="admin-login-form" onSubmit={submit}>
            <label className="admin-field">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=" "
                type="email"
                autoComplete="username"
                required
              />
              <span className="admin-field-label">ایمیل مدیریت</span>
            </label>
            <label className="admin-field">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder=" "
                type="password"
                autoComplete="current-password"
                required
              />
              <span className="admin-field-label">رمز عبور</span>
            </label>

            <button
              type="submit"
              className={`btn-primary full admin-login-btn${loading ? " loading" : ""}`}
              disabled={loading}
            >
              <span className="admin-login-btn-txt">ورود به سامانه</span>
              <span className="admin-login-btn-loader">
                <span className="admin-spin" /> در حال بررسی…
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function CustomerLogin({ customers, onLogin, onBack, showToast }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isOn, setIsOn] = useState(false);
  const [pulling, setPulling] = useState(false);

  function pullCord() {
    if (pulling) return;
    setPulling(true);
    setTimeout(() => setIsOn((v) => !v), 90);
    setTimeout(() => setPulling(false), 220);
  }

  function submit(e) {
    e.preventDefault();
    if (!isOn) {
      pullCord();
      return;
    }
    const found = (customers || []).find((c) => c.username === username.trim() && c.password === password);
    if (found) {
      onLogin(found);
    } else {
      showToast("نام کاربری یا رمز عبور اشتباه است");
    }
  }

  return (
    <div className="fade-in">
      <PageHeader title="ورود مشتری" icon="👤" onBack={onBack} />

      <div className="lamp-login">
        <div className={`lamp-scene${isOn ? " on" : ""}`}>
          <div className="lamp-glow" />
          <div className="lamp-shade" />
          <div
            className={`lamp-cord${pulling ? " pulling" : ""}`}
            onClick={pullCord}
            onTouchStart={(e) => {
              e.preventDefault();
              pullCord();
            }}
            role="button"
            aria-label={isOn ? "خاموش کردن لامپ" : "روشن کردن لامپ"}
          >
            <div className="lamp-string" />
            <div className="lamp-knob" />
          </div>
          <div className="lamp-pole" />
          <div className="lamp-base" />
        </div>
        <div className="lamp-hint">
          {isOn ? "نخ رو دوباره بکش تا خاموش بشه" : "برای ورود، نخ کنار لامپ رو بکش"}
        </div>
      </div>

      <form className={`order-form lamp-fields${isOn ? " on" : ""}`} onSubmit={submit} style={{ marginTop: 10 }}>
        <label className="field-group">
          نام کاربری
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="نام کاربری" tabIndex={isOn ? 0 : -1} />
        </label>
        <label className="field-group">
          رمز عبور
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="رمز عبور" type="password" tabIndex={isOn ? 0 : -1} />
        </label>
        <div className="form-btn-row lamp-submit-row">
          <button type="submit" className="btn-primary full">
            ورود
          </button>
        </div>
        <div className="hint-text">اگه هنوز نام کاربری و رمز عبور نگرفتی، از مدیر بخواه برات بسازه.</div>
      </form>
    </div>
  );
}

function CustomerProfile({ customer, customers, saveCustomers, setCurrentCustomer, onLogout, onBack, showToast }) {
  const [name, setName] = useState(customer.name || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  function saveName() {
    if (!name.trim()) {
      showToast("نام نمی‌تواند خالی باشد");
      return;
    }
    const next = customers.map((c) => (c.id === customer.id ? { ...c, name } : c));
    saveCustomers(next);
    setCurrentCustomer({ ...customer, name });
    showToast("نام به‌روزرسانی شد");
  }

  function savePassword() {
    if (!newPassword || newPassword.length < 4) {
      showToast("رمز عبور باید حداقل ۴ کاراکتر باشد");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("رمز عبور و تکرار آن یکسان نیستند");
      return;
    }
    const next = customers.map((c) => (c.id === customer.id ? { ...c, password: newPassword } : c));
    saveCustomers(next);
    setCurrentCustomer({ ...customer, password: newPassword });
    setNewPassword("");
    setConfirmPassword("");
    showToast("رمز عبور تغییر یافت");
  }

  return (
    <div className="fade-in">
      <PageHeader title="حساب من" icon="👤" onBack={onBack} />

      <div className="order-form" style={{ marginTop: 14 }}>
        <label>
          نام کاربری
          <input value={customer.username} disabled />
        </label>
        <label>
          نام نمایشی
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام شما" />
        </label>
        <button type="button" className="btn-primary full" onClick={saveName}>
          ذخیره نام
        </button>
      </div>

      <div className="order-form" style={{ marginTop: 14 }}>
        <label>
          رمز عبور جدید
          <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" placeholder="رمز عبور جدید" />
        </label>
        <label>
          تکرار رمز عبور جدید
          <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" placeholder="تکرار رمز عبور" />
        </label>
        <button type="button" className="btn-primary full" onClick={savePassword}>
          تغییر رمز عبور
        </button>
      </div>

      <button type="button" className="btn-ghost full" style={{ marginTop: 14 }} onClick={onLogout}>
        خروج از حساب
      </button>
    </div>
  );
}


function AdminPanel({ products, rates, creditSettings, orders, cardInfo, customers, operators, tab, setTab, saveProducts, saveRates, saveCreditSettings, saveOrders, updateOrderStatus, saveCardInfo, saveCustomers, saveOperators, onLogout, showToast }) {
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
          ["customers", "مشتریان"],
        ].map(([key, label]) => (
          <button key={key} className={"admin-tab" + (tab === key ? " active" : "")} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      {tab === "dashboard" && <Dashboard orders={orders} products={products} />}
      {tab === "products" && (
        <ProductsManager
          products={products}
          operators={operators}
          saveProducts={saveProducts}
          saveOperators={saveOperators}
          creditSettings={creditSettings}
          saveCreditSettings={saveCreditSettings}
          showToast={showToast}
        />
      )}
      {tab === "orders" && (
        <OrdersManager orders={orders} customers={customers} saveOrders={saveOrders} updateOrderStatus={updateOrderStatus} />
      )}
      {tab === "rates" && <RatesManager rates={rates} saveRates={saveRates} showToast={showToast} />}
      {tab === "card" && <CardManager cardInfo={cardInfo} saveCardInfo={saveCardInfo} showToast={showToast} />}
      {tab === "customers" && <CustomersManager customers={customers} saveCustomers={saveCustomers} showToast={showToast} />}
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

function CustomersManager({ customers, saveCustomers, showToast }) {
  const [newCust, setNewCust] = useState({ username: "", password: "", name: "", wallet: "" });
  const [editingWallet, setEditingWallet] = useState(null);
  const [walletDraft, setWalletDraft] = useState("");

  function addCustomer() {
    if (!newCust.username.trim() || !newCust.password.trim()) {
      showToast("نام کاربری و رمز عبور را وارد کنید");
      return;
    }
    if ((customers || []).some((c) => c.username === newCust.username.trim())) {
      showToast("این نام کاربری قبلاً استفاده شده");
      return;
    }
    const item = {
      id: newId("cust"),
      username: newCust.username.trim(),
      password: newCust.password,
      name: newCust.name.trim() || newCust.username.trim(),
      wallet: Number(newCust.wallet) || 0,
      createdAt: new Date().toISOString(),
    };
    saveCustomers([...(customers || []), item]);
    setNewCust({ username: "", password: "", name: "", wallet: "" });
    showToast("مشتری ثبت شد");
  }

  function removeCustomer(c) {
    saveCustomers(customers.filter((x) => x.id !== c.id));
    showToast("مشتری حذف شد");
  }

  function startWalletEdit(c) {
    setEditingWallet(c.id);
    setWalletDraft(String(c.wallet || 0));
  }
  function saveWallet(c) {
    saveCustomers(customers.map((x) => (x.id === c.id ? { ...x, wallet: Number(walletDraft) || 0 } : x)));
    setEditingWallet(null);
    showToast("کیف پول به‌روزرسانی شد");
  }

  return (
    <div className="admin-section">
      <div className="admin-section-title">
        <span>👤 ثبت مشتری جدید</span>
      </div>
      <div className="add-form">
        <input placeholder="نام کاربری" value={newCust.username} onChange={(e) => setNewCust((n) => ({ ...n, username: e.target.value }))} />
        <input placeholder="رمز عبور" value={newCust.password} onChange={(e) => setNewCust((n) => ({ ...n, password: e.target.value }))} />
        <input placeholder="نام نمایشی (اختیاری)" value={newCust.name} onChange={(e) => setNewCust((n) => ({ ...n, name: e.target.value }))} />
        <input placeholder="موجودی اولیه" type="number" value={newCust.wallet} onChange={(e) => setNewCust((n) => ({ ...n, wallet: e.target.value }))} />
        <button className="btn-primary small" onClick={addCustomer}>
          ثبت مشتری
        </button>
      </div>

      <div className="admin-section-title" style={{ marginTop: 18 }}>
        <span>لیست مشتریان ثبت‌شده ({(customers || []).length})</span>
      </div>
      {(!customers || customers.length === 0) && <div className="empty-state">هنوز مشتری‌ای ثبت نشده است.</div>}
      {(customers || []).map((c) => (
        <div className="admin-product-row" key={c.id}>
          <div className="product-info">
            <div className="product-title">{c.name}</div>
            <div className="product-subtitle">نام کاربری: {c.username}</div>
          </div>
          <div className="product-actions">
            {editingWallet === c.id ? (
              <>
                <input
                  type="number"
                  value={walletDraft}
                  onChange={(e) => setWalletDraft(e.target.value)}
                  style={{ width: 90, padding: "8px 10px", borderRadius: 10, border: "1px solid #e2ddce" }}
                />
                <button className="btn-primary small" onClick={() => saveWallet(c)}>
                  ذخیره
                </button>
              </>
            ) : (
              <>
                <div className="product-price">{fmt(c.wallet || 0)} تومان</div>
                <button className="btn-ghost small" onClick={() => startWalletEdit(c)}>
                  ویرایش کیف پول
                </button>
              </>
            )}
            <button className="btn-danger small" onClick={() => removeCustomer(c)}>
              حذف
            </button>
          </div>
        </div>
      ))}
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

function ProductsManager({ products, operators, saveProducts, saveOperators, creditSettings, saveCreditSettings, showToast }) {
  return (
    <div>
      <CategorySection
        category="internet"
        label="📶 بسته‌های اینترنت"
        products={products}
        operators={operators}
        saveProducts={saveProducts}
        saveOperators={saveOperators}
        showToast={showToast}
      />
      <CategorySection
        category="credit"
        label="📞 شارژ تماس"
        products={products}
        operators={operators}
        saveProducts={saveProducts}
        saveOperators={saveOperators}
        creditSettings={creditSettings}
        saveCreditSettings={saveCreditSettings}
        showToast={showToast}
      />
    </div>
  );
}

// تنظیمات روش قیمت‌گذاری بخش شارژ تماس: انتخاب دستی/خودکار و تعیین نرخ برای روش خودکار.
function CreditPricingSettings({ creditSettings, saveCreditSettings, products, saveProducts, showToast }) {
  const current = creditSettings || DEFAULT_CREDIT_SETTINGS;
  const [rateDraft, setRateDraft] = useState(current.rate || "");

  useEffect(() => {
    setRateDraft(current.rate || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.rate]);

  function setMode(mode) {
    saveCreditSettings({ ...current, mode });
    showToast(mode === "auto" ? "روش قیمت‌گذاری خودکار فعال شد" : "روش قیمت‌گذاری دستی فعال شد");
  }

  // با تعیین نرخ جدید، علاوه بر ذخیره‌ی نرخ، قیمت تمام محصولات موجود «شارژ تماس» نیز
  // بر اساس عدد فیلد عنوان هرکدام و نرخ تازه، دوباره محاسبه و به‌روزرسانی می‌شود.
  function saveRate() {
    const rate = Number(rateDraft) || 0;
    if (rate <= 0) {
      showToast("نرخ معتبر وارد کنید");
      return;
    }
    saveCreditSettings({ ...current, rate });
    if (products && saveProducts) {
      const updated = products.map((p) => {
        if (p.category !== "credit") return p;
        const computed = computeAutoCreditPrice(p.title, rate);
        return computed !== null ? { ...p, price: computed } : p;
      });
      saveProducts(updated);
    }
    showToast("نرخ ذخیره شد و قیمت‌های قبلی به‌روزرسانی شدند");
  }

  return (
    <div className="operator-block">
      <div className="operator-block-header">
        <span>⚙️ تعیین نرخ و روش قیمت‌گذاری</span>
      </div>
      <div className="operator-block-body">
        <div className="status-row" style={{ marginBottom: 10 }}>
          <button className={"status-pill" + (current.mode === "manual" ? " active status-completed" : "")} onClick={() => setMode("manual")}>
            قیمت‌گذاری دستی
          </button>
          <button className={"status-pill" + (current.mode === "auto" ? " active status-completed" : "")} onClick={() => setMode("auto")}>
            قیمت‌گذاری خودکار
          </button>
        </div>
        {current.mode === "auto" && (
          <div className="add-form">
            <input
              placeholder="نرخ (مثلاً نرخ تبدیل)"
              type="number"
              value={rateDraft}
              onChange={(e) => setRateDraft(e.target.value)}
            />
            <button className="btn-primary small" onClick={saveRate}>
              ذخیره نرخ
            </button>
          </div>
        )}
        {current.mode === "auto" && (
          <div className="hint-text" style={{ textAlign: "right" }}>
            در این روش، عدد فیلد عنوان هنگام افزودن یا ویرایش محصول بر نرخ تعیین‌شده ({fmt(current.rate)}) تقسیم و سپس در ۱۰۰۰ ضرب می‌شود و نتیجه به‌طور خودکار در فیلد قیمت قرار می‌گیرد.
          </div>
        )}
      </div>
    </div>
  );
}

function CategorySection({ category, label, products, operators, saveProducts, saveOperators, creditSettings, saveCreditSettings, showToast }) {
  const [newOpName, setNewOpName] = useState("");
  const catOperators = (operators || []).filter((o) => o.category === category);
  const ungrouped = products.filter((p) => p.category === category && !p.operatorId);

  function addOperator() {
    if (!newOpName.trim()) {
      showToast("نام اپراتور را وارد کنید");
      return;
    }
    const item = { id: newId("op"), category, name: newOpName.trim() };
    saveOperators([...(operators || []), item]);
    setNewOpName("");
    showToast("اپراتور اضافه شد");
  }

  function removeOperator(op) {
    saveOperators((operators || []).filter((o) => o.id !== op.id));
    // detach this operator's products instead of deleting them, so nothing is lost
    saveProducts(products.map((p) => (p.operatorId === op.id ? { ...p, operatorId: null } : p)));
    showToast("اپراتور حذف شد");
  }

  return (
    <div className="admin-section">
      <div className="admin-section-title">
        <span>{label}</span>
      </div>
      {category === "credit" && (
        <CreditPricingSettings
          creditSettings={creditSettings}
          saveCreditSettings={saveCreditSettings}
          products={products}
          saveProducts={saveProducts}
          showToast={showToast}
        />
      )}
      <div className="add-form">
        <input placeholder="نام اپراتور جدید (مثلاً روشان)" value={newOpName} onChange={(e) => setNewOpName(e.target.value)} />
        <button className="btn-primary small" onClick={addOperator}>
          + افزودن اپراتور
        </button>
      </div>
      {catOperators.map((op) => (
        <OperatorProducts
          key={op.id}
          operator={op}
          category={category}
          products={products}
          saveProducts={saveProducts}
          creditSettings={creditSettings}
          onRemoveOperator={() => removeOperator(op)}
          showToast={showToast}
        />
      ))}
      {ungrouped.length > 0 && (
        <OperatorProducts operator={null} category={category} products={products} saveProducts={saveProducts} creditSettings={creditSettings} showToast={showToast} />
      )}
    </div>
  );
}

function OperatorProducts({ operator, category, products, saveProducts, creditSettings, onRemoveOperator, showToast }) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({});
  const [adding, setAdding] = useState(false);
  const [newProd, setNewProd] = useState({ title: "", subtitle: "", price: "", currency: "TOMAN" });

  // قیمت‌گذاری خودکار فقط برای دسته «شارژ تماس» و وقتی مدیر نرخ را تعیین و روش خودکار را فعال کرده باشد اعمال می‌شود.
  const autoPricing = category === "credit" && creditSettings && creditSettings.mode === "auto" && Number(creditSettings.rate) > 0;

  const list = products.filter((p) => p.category === category && (operator ? p.operatorId === operator.id : !p.operatorId));

  function startEdit(p) {
    setEditing(p.id);
    setDraft({ title: p.title, subtitle: p.subtitle, price: p.price, currency: p.currency || "TOMAN" });
  }
  function saveEdit(p) {
    saveProducts(
      products.map((x) =>
        x.id === p.id ? { ...x, title: draft.title, subtitle: draft.subtitle, price: Number(draft.price) || 0, currency: draft.currency || "TOMAN" } : x
      )
    );
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
  function addProduct() {
    if (!newProd.title.trim() || !newProd.price) {
      showToast("عنوان و قیمت را وارد کنید");
      return;
    }
    const item = {
      id: newId(category),
      category,
      operatorId: operator ? operator.id : null,
      title: newProd.title,
      subtitle: newProd.subtitle,
      price: Number(newProd.price) || 0,
      currency: newProd.currency || "TOMAN",
      active: true,
    };
    saveProducts([...products, item]);
    setNewProd({ title: "", subtitle: "", price: "", currency: "TOMAN" });
    setAdding(false);
    showToast("محصول اضافه شد");
  }
  // در روش قیمت‌گذاری خودکار، با تغییر عنوان، عدد آن بر نرخ تعیین‌شده تقسیم و در فیلد قیمت (فرم افزودن) قرار می‌گیرد.
  function handleNewTitleChange(title) {
    setNewProd((n) => {
      const next = { ...n, title };
      if (autoPricing) {
        const computed = computeAutoCreditPrice(title, creditSettings.rate);
        if (computed !== null) next.price = String(computed);
      }
      return next;
    });
  }
  // همان محاسبه، هنگام ویرایش عنوان یک محصول موجود.
  function handleDraftTitleChange(title) {
    setDraft((d) => {
      const next = { ...d, title };
      if (autoPricing) {
        const computed = computeAutoCreditPrice(title, creditSettings.rate);
        if (computed !== null) next.price = String(computed);
      }
      return next;
    });
  }

  return (
    <div className="operator-block">
      <div className="operator-block-header" onClick={() => setOpen(!open)}>
        <span>{operator ? "📡 " + operator.name : "سایر محصولات (بدون اپراتور)"}</span>
        <span>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div className="operator-block-body">
          <div className="admin-section-title">
            <button
              className="btn-ghost small"
              onClick={(e) => {
                e.stopPropagation();
                setAdding(!adding);
              }}
            >
              {adding ? "بستن" : "+ افزودن محصول"}
            </button>
            {operator && (
              <button
                className="btn-danger small"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveOperator();
                }}
              >
                حذف اپراتور
              </button>
            )}
          </div>
          {adding && (
            <div className="add-form">
              <input placeholder="عنوان" value={newProd.title} onChange={(e) => handleNewTitleChange(e.target.value)} />
              <input placeholder="زیرعنوان" value={newProd.subtitle} onChange={(e) => setNewProd((n) => ({ ...n, subtitle: e.target.value }))} />
              <input
                placeholder="قیمت"
                type="number"
                value={newProd.price}
                readOnly={autoPricing}
                title={autoPricing ? "در روش خودکار، قیمت از روی عنوان محاسبه می‌شود" : undefined}
                onChange={(e) => !autoPricing && setNewProd((n) => ({ ...n, price: e.target.value }))}
              />
              <select value={newProd.currency} onChange={(e) => setNewProd((n) => ({ ...n, currency: e.target.value }))}>
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {CURRENCY_LABELS[c]}
                  </option>
                ))}
              </select>
              <button className="btn-primary small" onClick={addProduct}>
                ذخیره
              </button>
            </div>
          )}
          {list.length === 0 && <div className="empty-state">محصولی ثبت نشده است.</div>}
          {list.map((p) => (
            <div className="admin-product-row" key={p.id}>
              {editing === p.id ? (
                <div className="add-form">
                  <input value={draft.title} onChange={(e) => handleDraftTitleChange(e.target.value)} />
                  <input value={draft.subtitle} onChange={(e) => setDraft((d) => ({ ...d, subtitle: e.target.value }))} />
                  <input
                    type="number"
                    value={draft.price}
                    readOnly={autoPricing}
                    title={autoPricing ? "در روش خودکار، قیمت از روی عنوان محاسبه می‌شود" : undefined}
                    onChange={(e) => !autoPricing && setDraft((d) => ({ ...d, price: e.target.value }))}
                  />
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
      )}
    </div>
  );
}

function OrdersManager({ orders, customers, saveOrders, updateOrderStatus }) {
  const [expanded, setExpanded] = useState(null);
  function setStatus(o, status) {
    // لغو سفارش از این تابع عبور می‌کند تا در صورت لغو، مبلغ کسر شده به کیف پول مشتری بازگردد.
    updateOrderStatus(o, status);
  }
  function removeOrder(o) {
    saveOrders(orders.filter((x) => x.id !== o.id));
  }
  function customerFor(o) {
    return (customers || []).find((c) => c.id === o.customerId);
  }
  return (
    <div className="admin-section">
      {orders.length === 0 && <div className="empty-state">هنوز سفارشی ثبت نشده است.</div>}
      {orders.map((o) => {
        const cust = customerFor(o);
        return (
          <div className="admin-order-row" key={o.id}>
            <div className="admin-order-top" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
              <span>
                {TYPE_ICONS[o.type]} {o.customerName || "—"}
                {o.customerUsername ? " (@" + o.customerUsername + ")" : ""}
              </span>
              <span className="order-card-price">
                {fmt(o.price)} {CURRENCY_LABELS[o.currency || "TOMAN"]}
              </span>
            </div>
            <div className="admin-order-meta">
              <span>{o.phone}</span>
              <span>{TYPE_LABELS[o.type]}</span>
              <span>کد: {o.trackingCode}</span>
              <span>{fmtDate(o.date)}</span>
            </div>
            {expanded === o.id && (
              <div className="admin-order-detail">
                <div>کاربر: {cust ? (cust.name || "—") + " (@" + cust.username + ")" : o.customerId ? "کاربر یافت نشد" : "مهمان"}</div>
                <div>کالا / سرویس: {o.item}</div>
                {o.subtitle && <div>توضیحات بسته: {o.subtitle}</div>}
                {o.operatorName && <div>اپراتور: {o.operatorName}</div>}
                {o.type === "remittance" && (
                  <>
                    <div>گیرنده: {o.receiverName}</div>
                    <div>مقصد: {o.destination}</div>
                    {!!o.tomanAmount && <div>مبلغ کسر شده از کیف پول: {fmt(o.tomanAmount)} تومان (نرخ: {o.afnRateUsed})</div>}
                    {o.notes && <div>توضیحات: {o.notes}</div>}
                  </>
                )}
                {o.type !== "remittance" && !!o.walletDeduction && (
                  <div>مبلغ کسر شده از کیف پول: {fmt(o.walletDeduction)} تومان</div>
                )}
                {o.refunded && <div>✅ مبلغ این سفارش به کیف پول مشتری بازگشت داده شده است</div>}
              </div>
            )}
            <div className="status-row">
              {STATUS_ORDER.map((s) => (
                <button key={s} className={"status-pill" + (o.status === s ? " active status-" + s : "")} onClick={() => setStatus(o, s)}>
                  {STATUS_LABELS[s]}
                </button>
              ))}
              <button className="btn-danger small" onClick={() => removeOrder(o)}>
                حذف سفارش
              </button>
            </div>
          </div>
        );
      })}
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
  function removeRate(code) {
    saveRates(rates.filter((r) => r.code !== code));
    showToast("ارز حذف شد");
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
          <button className="btn-danger small" onClick={() => removeRate(r.code)}>
            حذف
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
      .customer-btn {
        position: absolute; left: 60px; top: 18px;
        background: rgba(255,255,255,0.14); border: none; color: #fff;
        width: 36px; height: 36px; border-radius: 50%; font-size: 16px; cursor: pointer;
      }
      .wallet-card {
        background: linear-gradient(135deg, var(--accent) 0%, #a97a24 100%);
        border-radius: 20px; padding: 20px; text-align: center; color: #1F2620;
        box-shadow: 0 8px 20px rgba(201,151,58,0.3);
      }
      .wallet-label { font-size: 12px; opacity: 0.75; margin-bottom: 6px; }
      .wallet-amount { font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; }
      .btn-ghost.full { width: 100%; padding: 13px; font-size: 14px; border-radius: 14px; text-align: center; }
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

      .search-label { font-size: 12px; color: var(--ink-soft); margin-bottom: 8px; line-height: 1.6; }
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
      .operator-block { background: #FBFAF6; border-radius: 14px; padding: 10px 12px; margin-bottom: 12px; border: 1px solid #eee5d0; }
      .operator-block-header { display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 13px; cursor: pointer; padding: 4px 0; }
      .operator-block-body { margin-top: 8px; }
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

      /* ===== Animated admin login ===== */
      .admin-login-wrap { display: flex; justify-content: center; padding: 6px 0 4px; }
      .admin-login-card {
        position: relative; width: 100%; max-width: 360px;
        background: var(--surface); border-radius: 22px; padding: 32px 22px 26px;
        box-shadow: 0 10px 28px rgba(14,77,68,0.12); text-align: center; overflow: hidden;
        animation: adminCardIn .5s cubic-bezier(.16,1,.3,1) both;
      }
      .admin-login-card::before {
        content: ""; position: absolute; inset: 0; border-radius: 22px; padding: 1.5px;
        background: conic-gradient(from 0deg, var(--accent), var(--primary), transparent 35%, transparent 65%, var(--accent));
        -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
        -webkit-mask-composite: xor; mask-composite: exclude;
        animation: adminBorderSpin 6s linear infinite; pointer-events: none;
      }
      @keyframes adminBorderSpin { to { transform: rotate(360deg); } }
      @keyframes adminCardIn { from { opacity: 0; transform: translateY(18px) scale(.97); } to { opacity: 1; transform: none; } }

      .admin-login-badge { position: relative; width: 62px; height: 62px; margin: 0 auto 14px; display: flex; align-items: center; justify-content: center; }
      .admin-login-badge-icon { font-size: 26px; position: relative; z-index: 2; }
      .admin-login-badge-ring {
        position: absolute; inset: 0; border-radius: 50%;
        background: radial-gradient(circle, var(--accent-soft) 0%, transparent 70%);
        animation: adminPulse 2.2s ease-in-out infinite;
      }
      @keyframes adminPulse { 0%, 100% { transform: scale(.88); opacity: .55; } 50% { transform: scale(1.15); opacity: 1; } }

      .admin-login-title { font-size: 18px; font-weight: 800; color: var(--primary); margin-bottom: 4px; }
      .admin-login-sub { font-size: 12px; color: var(--ink-soft); margin-bottom: 24px; }

      .admin-login-form { display: flex; flex-direction: column; gap: 16px; text-align: right; }
      .admin-field { position: relative; display: block; }
      .admin-field input {
        width: 100%; font-family: inherit; padding: 17px 12px 9px; border-radius: 12px;
        border: 1px solid #e2ddce; font-size: 14px; color: var(--ink); background: #FBFAF6;
        transition: border-color .2s, box-shadow .2s;
      }
      .admin-field input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(14,77,68,0.10); }
      .admin-field-label {
        position: absolute; top: 15px; right: 12px; font-size: 13px; color: var(--ink-soft);
        pointer-events: none; transition: all .18s ease; background: transparent;
      }
      .admin-field input:focus + .admin-field-label,
      .admin-field input:not(:placeholder-shown) + .admin-field-label {
        top: 5px; font-size: 10.5px; color: var(--primary); font-weight: 700;
      }

      .admin-login-btn { position: relative; margin-top: 6px; }
      .admin-login-btn:disabled { opacity: .85; cursor: default; }
      .admin-login-btn-loader { display: none; align-items: center; justify-content: center; gap: 8px; }
      .admin-login-btn.loading .admin-login-btn-txt { display: none; }
      .admin-login-btn.loading .admin-login-btn-loader { display: flex; }
      .admin-spin {
        width: 14px; height: 14px; border-radius: 50%;
        border: 2px solid rgba(255,255,255,.35); border-top-color: #fff;
        animation: adminSpin .7s linear infinite;
      }
      @keyframes adminSpin { to { transform: rotate(360deg); } }

      /* ===== Lamp pull-cord login ===== */
      .lamp-login { display: flex; flex-direction: column; align-items: center; padding: 6px 0 4px; }
      .lamp-scene { position: relative; height: 148px; display: flex; flex-direction: column; align-items: center; }
      .lamp-glow {
        position: absolute; top: -34px; width: 260px; height: 260px; border-radius: 50%;
        background: radial-gradient(circle, var(--accent-soft) 0%, rgba(201,151,58,0.18) 45%, transparent 72%);
        opacity: 0; transition: opacity .6s ease; pointer-events: none; filter: blur(1px);
      }
      .lamp-scene.on .lamp-glow { opacity: 1; }
      .lamp-shade {
        width: 104px; height: 52px; border-radius: 104px 104px 6px 6px;
        background: linear-gradient(180deg, #cfc9b8, #a9a290);
        transition: background .5s ease, box-shadow .5s ease; position: relative; z-index: 2;
      }
      .lamp-scene.on .lamp-shade {
        background: linear-gradient(180deg, #ffe9ae, var(--accent));
        box-shadow: 0 10px 36px 4px rgba(201,151,58,0.55);
      }
      .lamp-pole { width: 7px; height: 62px; background: var(--primary-dark); z-index: 1; }
      .lamp-base { width: 64px; height: 9px; border-radius: 4px; background: var(--primary-dark); z-index: 1; }
      .lamp-cord {
        position: absolute; top: 50px; right: 28%; width: 16px; height: 54px; z-index: 4;
        cursor: grab; display: flex; justify-content: center;
      }
      .lamp-cord:active { cursor: grabbing; }
      .lamp-cord .lamp-string { width: 2px; height: 36px; background: #9c9686; transition: height .18s ease; }
      .lamp-cord .lamp-knob {
        position: absolute; bottom: -6px; width: 9px; height: 9px; border-radius: 50%;
        background: var(--accent); transition: bottom .18s ease;
      }
      .lamp-cord.pulling .lamp-string { height: 54px; }
      .lamp-cord.pulling .lamp-knob { bottom: -24px; }
      .lamp-hint { font-size: 11px; color: var(--ink-soft); margin-top: 2px; }

      .lamp-fields .field-group {
        max-height: 0; opacity: 0; overflow: hidden; transform: translateY(6px);
        transition: max-height .5s ease, opacity .5s ease, transform .5s ease, margin .5s ease;
      }
      .lamp-fields.on .field-group { max-height: 90px; opacity: 1; transform: translateY(0); margin-bottom: 14px; }
      .lamp-fields .field-group:nth-of-type(1) { transition-delay: .12s; }
      .lamp-fields .field-group:nth-of-type(2) { transition-delay: .26s; }
      .lamp-fields .lamp-submit-row {
        max-height: 0; opacity: 0; overflow: hidden;
        transition: max-height .45s ease .4s, opacity .45s ease .4s;
      }
      .lamp-fields.on .lamp-submit-row { max-height: 60px; opacity: 1; }
    `}</style>
  );
}
