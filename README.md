# ⚡ SpeedLab — Internet Speed Meter (PWA)

একটি সম্পূর্ণ ফাংশনাল, মোবাইল-ফ্রেন্ডলি ইন্টারনেট স্পিড টেস্ট Progressive Web App। **কোনো ডেমো বা সিমুলেটেড ডেটা নেই** — সব পরিমাপ Cloudflare-এর গ্লোবাল নেটওয়ার্ক থেকে আসল ফাইল ট্রান্সফার করে নেওয়া হয়।

## ✅ যা সত্যিকারের (Real) — কোনো সিমুলেশন নয়

| ফিচার | কীভাবে কাজ করে |
|---|---|
| **ডাউনলোড স্পিড** | `speed.cloudflare.com/__down` থেকে real bytes ফেচ করে, `bytes received ÷ time elapsed` দিয়ে গণনা |
| **আপলোড স্পিড** | ব্রাউজারে তৈরি random bytes `speed.cloudflare.com/__up`-এ POST করে real throughput মাপা |
| **পিং / জিটার** | একাধিক ছোট রিকোয়েস্টের real round-trip time থেকে গণনা |
| **পাবলিক IP** | Cloudflare-এর `/cdn-cgi/trace` endpoint থেকে |
| **ISP নাম, শহর, দেশ** | `ipapi.co/json/` free API থেকে |
| **History** | ডিভাইসের LocalStorage-এ real সংরক্ষিত — কোনো ডেমো এন্ট্রি প্রি-লোড করা নেই |

## ⚠️ যা সম্ভব নয় (এবং কেন)

ব্রাউজার/PWA আর্কিটেকচারের একটা মৌলিক সীমাবদ্ধতা আছে — এগুলোর জন্য OS-level permission লাগে যা শুধুমাত্র native Android/iOS অ্যাপ (Kotlin/Swift/React Native দিয়ে কম্পাইল করা .apk/.ipa) পেতে পারে:

- ❌ Android স্ট্যাটাস বার নোটিফিকেশনে লাইভ স্পিড — সরিয়ে ফেলা হয়েছে
- ❌ ব্যাকগ্রাউন্ড মনিটরিং সার্ভিস — সরিয়ে ফেলা হয়েছে
- ❌ Wi-Fi vs Mobile Data ব্যবহার ট্র্যাকিং — সরিয়ে ফেলা হয়েছে

এই অ্যাপের "তথ্য" ট্যাবে এই সীমাবদ্ধতাগুলো ব্যবহারকারীকে স্পষ্টভাবে জানানো আছে।

---

## 📁 প্রজেক্ট স্ট্রাকচার

```
speedlab/
├── index.html          ← মূল HTML (সব স্ক্রিন)
├── style.css            ← মোবাইল-ফার্স্ট স্টাইলিং
├── app.js                ← UI লজিক, history, share, PWA install
├── speedtest.js          ← রিয়েল স্পিড টেস্ট ইঞ্জিন (Cloudflare)
├── sw.js                 ← Service Worker (শুধু app shell ক্যাশ করে)
├── manifest.json         ← PWA ম্যানিফেস্ট
└── icons/
    ├── icon-192.png
    ├── icon-192-maskable.png
    ├── icon-512.png
    └── icon-512-maskable.png
```

কোনো বিল্ড স্টেপ নেই — এটি pure static HTML/CSS/JS। npm/webpack/বান্ডলার কিছুই লাগবে না।

---

## 🚀 ডেপ্লয়মেন্ট — Cloudflare Pages (সুপারিশকৃত)

### ধাপ ১: GitHub repo তৈরি করুন
```bash
cd speedlab
git init
git add .
git commit -m "Initial commit: SpeedLab PWA"
git branch -M main
git remote add origin https://github.com/<your-username>/speedlab.git
git push -u origin main
```

### ধাপ ২: Cloudflare Pages-এ কানেক্ট করুন
1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
2. আপনার `speedlab` GitHub repo সিলেক্ট করুন
3. Build settings:
   - **Framework preset:** `None`
   - **Build command:** *(খালি রাখুন)*
   - **Build output directory:** `/` (রুট ফোল্ডার)
4. **Save and Deploy** ক্লিক করুন

কয়েক সেকেন্ডের মধ্যে আপনার অ্যাপ লাইভ হবে: `https://speedlab.pages.dev`

### ধাপ ৩: কাস্টম ডোমেইন (ঐচ্ছিক)
Cloudflare Pages প্রজেক্টে **Custom domains** ট্যাবে গিয়ে নিজের ডোমেইন যোগ করতে পারেন — সম্পূর্ণ ফ্রি, automatic HTTPS সহ।

---

## 🌐 বিকল্প: GitHub Pages

```bash
# repo-তে gh-pages branch পুশ করুন, অথবা Settings → Pages থেকে main branch সিলেক্ট করুন
```
GitHub repo Settings → **Pages** → Source: `main` branch, `/ (root)` → Save.
URL হবে: `https://<username>.github.io/speedlab/`

> **নোট:** GitHub Pages ব্যবহার করলেও speed test logic একই থাকবে — কারণ আসল measurement browser থেকে সরাসরি Cloudflare-এর সার্ভারে হয়, GitHub Pages শুধু static ফাইল সার্ভ করে।

---

## 📱 মোবাইলে ইনস্টল করা (PWA)

### Android (Chrome)
সাইট ভিজিট করার পর হেডারে একটি ইনস্টল আইকন (⬇) দেখা যাবে, অথবা Chrome মেনু → **"Add to Home screen"**।

### iOS (Safari)
Share বাটন (□↑) → **"Add to Home Screen"**।

একবার ইনস্টল করলে এটি ঠিক native অ্যাপের মতো ফুল-স্ক্রিনে চলবে, হোম স্ক্রিনে আইকন থাকবে।

---

## 🔧 লোকাল টেস্টিং

যেকোনো static file server দিয়ে চালানো যাবে (Service Worker-এর জন্য `file://` প্রোটোকলে কাজ করবে না, একটি local server লাগবে):

```bash
# Python দিয়ে
python3 -m http.server 8080

# অথবা Node দিয়ে
npx serve .
```
তারপর ব্রাউজারে `http://localhost:8080` খুলুন।

> মোবাইল ডিভাইস থেকে টেস্ট করতে চাইলে কম্পিউটার ও ফোন একই Wi-Fi নেটওয়ার্কে থাকতে হবে এবং `http://<your-computer-ip>:8080` ব্যবহার করতে হবে। HTTPS ছাড়া কিছু কিছু ব্রাউজার ফিচার (যেমন `navigator.share`, Service Worker) কাজ নাও করতে পারে — তাই production-এ Cloudflare Pages/GitHub Pages (যেগুলো অটোমেটিক HTTPS দেয়) ব্যবহার করাই ভালো।

---

## 🛠️ কাস্টমাইজেশন

### নিজস্ব Cloudflare Worker ব্যাকএন্ড ব্যবহার করতে চাইলে
যদি public `speed.cloudflare.com` endpoint-এর বদলে নিজের Worker চান (যেমন rate-limit এড়াতে), `speedtest.js`-এর শুরুতে `CF_BASE` ভ্যারিয়েবল বদলান:

```js
const CF_BASE = 'https://your-worker.your-subdomain.workers.dev';
```

একটি ন্যূনতম Worker যা `__down` ও `__up` সাপোর্ট করে, `cloudflare-worker-example.js` ফাইলে দেওয়া আছে (ঐচ্ছিক, ব্যবহার না করলেও চলবে)।

### রং/থিম বদলানো
`style.css`-এর `:root` সেকশনে CSS ভ্যারিয়েবল বদলান:
```css
--cyan:#22D3EE;
--purple:#A855F7;
--green:#10B981;
```

---

## 📋 ব্রাউজার সাপোর্ট

| ব্রাউজার | সাপোর্ট |
|---|---|
| Chrome/Edge (Android, Desktop) | ✅ সম্পূর্ণ (PWA install সহ) |
| Safari (iOS) | ✅ সম্পূর্ণ (PWA install আংশিক — vibrate API নেই) |
| Firefox | ✅ সম্পূর্ণ (PWA install নেই, বাকি সব কাজ করে) |

---

## লাইসেন্স
ব্যক্তিগত ও বাণিজ্যিক ব্যবহারের জন্য উন্মুক্ত।
