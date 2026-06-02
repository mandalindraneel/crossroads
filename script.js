/* Crossroads — Copyright (c) 2026 Indraneel Mandal. All Rights Reserved. */
"use strict";

(() => {

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const NS = "http://www.w3.org/2000/svg";
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const uid = () => "s_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

let _idc = 0;
const nextId = () => "f" + (++_idc);

function el(tag, props = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k === "text") n.textContent = v;
    else if (k === "dataset") for (const [dk, dv] of Object.entries(v)) n.dataset[dk] = dv;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) n.setAttribute(k, "");
    else n.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null || c === false) return;
    n.append(c.nodeType ? c : document.createTextNode(String(c)));
  });
  return n;
}

function svgEl(tag, attrs = {}) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  return n;
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function randNormal(mean = 0, std = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + std * z;
}

function percentile(sorted, p) {
  const n = sorted.length;
  if (n === 0) return 0;
  const idx = (p / 100) * (n - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function niceNum(range, round) {
  const exp = Math.floor(Math.log10(range || 1));
  const frac = (range || 1) / Math.pow(10, exp);
  let nf;
  if (round) nf = frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10;
  else nf = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return nf * Math.pow(10, exp);
}
function niceTicks(min, max, count = 5) {
  if (min === max) max = min + 1;
  const range = niceNum(max - min, false);
  const step = niceNum(range / (count - 1), true);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = niceMin; v <= niceMax + step * 0.5; v += step) ticks.push(Math.round(v / step) * step);
  return { ticks, niceMin, niceMax, step };
}

const CURRENCIES = {
  USD: { symbol: "$", locale: "en-US" },
  EUR: { symbol: "€", locale: "de-DE" },
  GBP: { symbol: "£", locale: "en-GB" },
  CAD: { symbol: "CA$", locale: "en-CA" },
  AUD: { symbol: "A$", locale: "en-AU" },
  INR: { symbol: "₹", locale: "en-IN" },
  JPY: { symbol: "¥", locale: "ja-JP" },
};
const getCur = () => CURRENCIES[state?.settings?.currency] || CURRENCIES.USD;

function money(n, decimals = 0) {
  const c = getCur();
  if (!isFinite(n)) n = 0;
  return new Intl.NumberFormat(c.locale, {
    style: "currency", currency: state.settings.currency || "USD",
    maximumFractionDigits: decimals, minimumFractionDigits: decimals,
  }).format(n);
}
function moneySigned(n) { return (n > 0 ? "+" : "") + money(n); }
function compactMoney(n) {
  const c = getCur(), sym = c.symbol, a = Math.abs(n), sign = n < 0 ? "-" : "";
  const trim = (s) => s.replace(/\.0$/, "");
  if (a >= 1e9) return sign + sym + trim((a / 1e9).toFixed(1)) + "B";
  if (a >= 1e6) return sign + sym + trim((a / 1e6).toFixed(a >= 1e7 ? 0 : 1)) + "M";
  if (a >= 1e3) return sign + sym + trim((a / 1e3).toFixed(a >= 1e4 ? 0 : 1)) + "k";
  return sign + sym + Math.round(a);
}
const pct = (n, d = 1) => `${n.toFixed(d)}%`;

function ym(months) {
  const m = Math.round(months);
  if (m >= 1188) return "100+ yrs";
  const y = Math.floor(m / 12), r = m % 12;
  if (y === 0) return `${r} mo`;
  if (r === 0) return `${y} yr${y > 1 ? "s" : ""}`;
  return `${y}y ${r}m`;
}

function amortPayment(principal, monthlyRate, n) {
  if (n <= 0) return 0;
  if (monthlyRate === 0) return principal / n;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
}

function amortSchedule(principal, annualPct, n) {
  const r = annualPct / 100 / 12;
  const pay = amortPayment(principal, r, n);
  let bal = principal;
  const rows = [];
  for (let m = 1; m <= n; m++) {
    const interest = bal * r;
    let prin = pay - interest;
    if (prin > bal) prin = bal;
    bal -= prin;
    if (bal < 0.005) bal = 0;
    rows.push({ month: m, payment: interest + prin, interest, principal: prin, balance: bal });
    if (bal <= 0) break;
  }
  return { rows, payment: pay };
}

const BUY_CLOSING_PCT = 0.02;
const SELL_PCT = 0.06;

function computeRentVsBuy(i) {
  const horizonM = Math.round(i.horizonYears * 12);
  const r = i.rate / 100 / 12;
  const nMort = Math.round(i.termYears * 12);
  const loan0 = Math.max(0, i.homePrice - i.downPayment);
  const pmt = amortPayment(loan0, r, nMort);
  const invMo = i.investReturnPct / 100 / 12;
  const apprMo = Math.pow(1 + i.homeAppreciationPct / 100, 1 / 12) - 1;
  const rentMo = Math.pow(1 + i.rentGrowthPct / 100, 1 / 12) - 1;

  let homeValue = i.homePrice;
  let loanBal = loan0;
  let rent = i.monthlyRent;
  let buyerInvest = 0;

  let renterInvest = i.downPayment + i.homePrice * BUY_CLOSING_PCT;

  const years = [0], buyerNW = [], renterNW = [];
  buyerNW.push(homeValue * (1 - SELL_PCT) - loanBal + buyerInvest);
  renterNW.push(renterInvest);

  let fyBuyer = 0, fyRent = 0;

  for (let m = 1; m <= horizonM; m++) {
    homeValue *= 1 + apprMo;

    let mortPortion = 0;
    if (loanBal > 0 && m <= nMort) {
      const interest = loanBal * r;
      let prin = pmt - interest;
      if (prin > loanBal) prin = loanBal;
      mortPortion = interest + prin;
      loanBal -= prin;
      if (loanBal < 0.005) loanBal = 0;
    }
    const taxMo = (homeValue * i.propertyTaxPct) / 100 / 12;
    const maintMo = (homeValue * i.maintenancePct) / 100 / 12;
    const buyerCost = mortPortion + taxMo + maintMo;
    const renterCost = rent;
    if (m <= 12) { fyBuyer += buyerCost; fyRent += renterCost; }

    let buyerContrib = 0, renterContrib = 0;
    if (buyerCost > renterCost) renterContrib = buyerCost - renterCost;
    else buyerContrib = renterCost - buyerCost;

    buyerInvest = buyerInvest * (1 + invMo) + buyerContrib;
    renterInvest = renterInvest * (1 + invMo) + renterContrib;

    rent *= 1 + rentMo;

    if (m % 12 === 0) {
      years.push(m / 12);
      buyerNW.push(homeValue * (1 - SELL_PCT) - loanBal + buyerInvest);
      renterNW.push(renterInvest);
    }
  }

  let breakeven = null;
  for (let k = 0; k < years.length; k++) {
    if (buyerNW[k] >= renterNW[k]) {
      if (k === 0) breakeven = 0;
      else {
        const d0 = buyerNW[k - 1] - renterNW[k - 1];
        const d1 = buyerNW[k] - renterNW[k];
        const frac = d0 === d1 ? 0 : (0 - d0) / (d1 - d0);
        breakeven = years[k - 1] + frac * (years[k] - years[k - 1]);
      }
      break;
    }
  }

  const buyerFinal = buyerNW[buyerNW.length - 1];
  const renterFinal = renterNW[renterNW.length - 1];
  return {
    years, buyerNW, renterNW, breakeven, buyerFinal, renterFinal,
    monthlyMortgage: pmt,
    fyBuyerMonthly: fyBuyer / 12,
    fyRentMonthly: fyRent / 12,
    advantage: buyerFinal - renterFinal,
  };
}

function simulateDebt(debts, extra, strategy) {
  const work = debts.map((d) => ({ ...d, bal: Math.max(0, d.balance), paidMonth: null }));
  const budget = work.reduce((s, d) => s + d.min, 0) + extra;
  const timeline = [work.reduce((s, d) => s + d.bal, 0)];
  const order = [];
  const CAP = 1200;
  let month = 0, totalInterest = 0;

  while (work.some((d) => d.bal > 0.005) && month < CAP) {
    month++;
    for (const d of work) if (d.bal > 0.005) { const it = (d.bal * d.apr) / 100 / 12; d.bal += it; totalInterest += it; }
    let pool = budget;
    for (const d of work) if (d.bal > 0.005) { const pay = Math.min(d.min, d.bal, pool); d.bal -= pay; pool -= pay; }
    const targets = work.filter((d) => d.bal > 0.005)
      .sort((a, b) => (strategy === "avalanche" ? b.apr - a.apr : a.bal - b.bal));
    for (const d of targets) { if (pool <= 0.005) break; const pay = Math.min(d.bal, pool); d.bal -= pay; pool -= pay; }
    for (const d of work) if (d.bal <= 0.005 && d.paidMonth === null) { d.bal = 0; d.paidMonth = month; order.push(d.name); }
    timeline.push(work.reduce((s, d) => s + d.bal, 0));
  }
  return {
    months: month, totalInterest, timeline, order,
    payable: work.every((d) => d.bal <= 0.005),
    perDebt: work.map((d) => ({ name: d.name, paidMonth: d.paidMonth })),
  };
}

function computeDebt(i) {
  const debts = i.debts.filter((d) => d.balance > 0);
  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const avalanche = simulateDebt(debts, i.extra, "avalanche");
  const snowball = simulateDebt(debts, i.extra, "snowball");
  return { avalanche, snowball, debts, totalDebt, extra: i.extra, count: debts.length };
}

function offerEffective(i, k, y, WORKDAYS) {
  const base = i[k + "Base"] * Math.pow(1 + i.raisePct / 100, y - 1);
  const bonus = (base * i[k + "BonusPct"]) / 100;
  const equity = y <= i[k + "VestYears"] ? i[k + "Equity"] / i[k + "VestYears"] : 0;
  const benefits = i[k + "Benefits"];
  const commuteCost = i[k + "CommuteCost"] * 12;
  const hourly = base / 2080;
  const commuteTimeCost = (i[k + "CommuteMins"] / 60) * WORKDAYS * hourly;
  const gross = base + bonus + equity + benefits;
  const net = gross - commuteCost - commuteTimeCost;
  return net / (i[k + "Col"] / 100);
}
function computeJob(i) {
  const WORKDAYS = 260;
  const H = Math.round(i.horizonYears);
  const years = [0], cumA = [0], cumB = [0];
  let accA = 0, accB = 0, y1A = 0, y1B = 0;
  for (let y = 1; y <= H; y++) {
    const a = offerEffective(i, "a", y, WORKDAYS);
    const b = offerEffective(i, "b", y, WORKDAYS);
    accA += a; accB += b;
    years.push(y); cumA.push(accA); cumB.push(accB);
    if (y === 1) { y1A = a; y1B = b; }
  }
  return { years, cumA, cumB, year1A: y1A, year1B: y1B, totalA: accA, totalB: accB };
}

function computeLoan(i) {
  const P = Math.max(0, i.price - i.downPayment);
  const n = Math.round(i.termMonths);
  const sched = amortSchedule(P, i.apr, n);
  const totalInterest = sched.rows.reduce((s, r) => s + r.interest, 0);
  const totalPaid = i.downPayment + sched.rows.reduce((s, r) => s + r.payment, 0);
  const months = [0], balances = [P], cumInt = [0];
  let ci = 0;
  for (const r of sched.rows) { ci += r.interest; months.push(r.month); balances.push(r.balance); cumInt.push(ci); }
  return { P, payment: sched.payment, totalInterest, totalPaid, sched, months, balances, cumInt };
}

function computeRetirement(i) {
  const runs = Math.round(i.runs);
  const yrs = Math.round(i.years);
  const months = yrs * 12;
  const mMean = i.expectedReturnPct / 100 / 12;
  const mStd = i.volatilityPct / 100 / Math.sqrt(12);
  const infl = i.inflationPct / 100;

  const snaps = Array.from({ length: yrs + 1 }, () => new Float64Array(runs));
  for (let run = 0; run < runs; run++) {
    let bal = i.currentSavings;
    snaps[0][run] = bal;
    for (let m = 1; m <= months; m++) {
      bal = bal * (1 + randNormal(mMean, mStd)) + i.monthlyContribution;
      if (bal < 0) bal = 0;
      if (m % 12 === 0) snaps[m / 12][run] = bal;
    }
  }

  const years = [], p10 = [], p50 = [], p90 = [];
  const p10r = [], p50r = [], p90r = [];
  for (let y = 0; y <= yrs; y++) {
    const arr = Array.from(snaps[y]).sort((a, b) => a - b);
    const f = Math.pow(1 + infl, y);
    years.push(y);
    const a = percentile(arr, 10), b = percentile(arr, 50), c = percentile(arr, 90);
    p10.push(a); p50.push(b); p90.push(c);
    p10r.push(a / f); p50r.push(b / f); p90r.push(c / f);
  }
  const fin = Array.from(snaps[yrs]).sort((a, b) => a - b);
  const realFactor = Math.pow(1 + infl, yrs);
  let goalProb = null;
  if (i.goal > 0) goalProb = fin.filter((v) => v >= i.goal).length / runs;

  return {
    years, p10, p50, p90, p10r, p50r, p90r,
    finalP10: percentile(fin, 10), finalP50: percentile(fin, 50), finalP90: percentile(fin, 90),
    realP50: percentile(fin, 50) / realFactor,
    goalProb, runs,
    totalContributed: i.currentSavings + i.monthlyContribution * months,
  };
}

function retirementQuick(i) {
  const months = Math.round(i.years) * 12;
  const r = i.expectedReturnPct / 100 / 12;
  let bal = i.currentSavings;
  for (let m = 0; m < months; m++) bal = bal * (1 + r) + i.monthlyContribution;
  return bal;
}

function buildChart(cfg) {
  const W = 760, H = cfg.height || 360;
  const pad = { l: 64, r: 22, t: 20, b: 38 };
  const plotW = W - pad.l - pad.r, plotH = H - pad.t - pad.b;
  const xs = cfg.xValues, n = xs.length;
  const xTickFmt = cfg.xTickFormat || ((x) => `${x}`);
  const xFmt = cfg.xFormat || xTickFmt;
  const yTickFmt = cfg.yTickFormat || compactMoney;
  const yFmt = cfg.yFormat || money;

  const yData = [];
  (cfg.series || []).forEach((s) => s.values.forEach((v) => { if (isFinite(v)) yData.push(v); }));
  (cfg.bands || []).forEach((b) => { b.lower.forEach((v) => isFinite(v) && yData.push(v)); b.upper.forEach((v) => isFinite(v) && yData.push(v)); });
  (cfg.markers || []).forEach((m) => isFinite(m.y) && yData.push(m.y));
  let dMin = yData.length ? Math.min(...yData) : 0;
  let dMax = yData.length ? Math.max(...yData) : 1;
  let yMin = cfg.yMin !== undefined ? cfg.yMin : Math.min(0, dMin);
  const nt = niceTicks(yMin, dMax, 5);
  yMin = nt.niceMin; const yMax = nt.niceMax;

  const xMin = xs[0], xMax = xs[n - 1] || 1;
  const sx = (x) => pad.l + ((x - xMin) / ((xMax - xMin) || 1)) * plotW;
  const sy = (y) => pad.t + plotH - ((y - yMin) / ((yMax - yMin) || 1)) * plotH;

  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart-svg", role: "img" });
  svg.setAttribute("aria-label", cfg.ariaLabel || cfg.title || "Chart");

  nt.ticks.forEach((t) => {
    if (t < yMin - 1e-6 || t > yMax + 1e-6) return;
    const y = sy(t);
    svg.append(svgEl("line", { class: "chart-grid-line", x1: pad.l, x2: W - pad.r, y1: y, y2: y }));
    const lbl = svgEl("text", { class: "chart-tick", x: pad.l - 10, y: y + 3.5, "text-anchor": "end" });
    lbl.textContent = yTickFmt(t);
    svg.append(lbl);
  });

  const step = Math.max(1, Math.ceil((n - 1) / 6));
  const xIdx = [];
  for (let k = 0; k < n; k += step) xIdx.push(k);
  if (xIdx[xIdx.length - 1] !== n - 1) xIdx.push(n - 1);

  svg.append(svgEl("line", { class: "chart-axis-line", x1: pad.l, x2: W - pad.r, y1: sy(yMin), y2: sy(yMin) }));
  xIdx.forEach((k) => {
    const x = sx(xs[k]);
    const lbl = svgEl("text", { class: "chart-tick", x, y: H - pad.b + 18, "text-anchor": "middle" });
    lbl.textContent = xTickFmt(xs[k]);
    svg.append(lbl);
  });

  (cfg.bands || []).forEach((b) => {
    let up = "", lo = "";
    for (let k = 0; k < n; k++) up += `${k === 0 ? "M" : "L"}${sx(xs[k]).toFixed(2)} ${sy(b.upper[k]).toFixed(2)} `;
    for (let k = n - 1; k >= 0; k--) lo += `L${sx(xs[k]).toFixed(2)} ${sy(b.lower[k]).toFixed(2)} `;
    const path = svgEl("path", { class: "chart-band animate", d: up + lo + "Z", fill: b.color });
    svg.append(path);
    [b.upper, b.lower].forEach((edge) => {
      let d = "";
      for (let k = 0; k < n; k++) d += `${k === 0 ? "M" : "L"}${sx(xs[k]).toFixed(2)} ${sy(edge[k]).toFixed(2)} `;
      svg.append(svgEl("path", { class: "chart-band-edge", d, stroke: b.color }));
    });
  });

  const linePaths = [];
  (cfg.series || []).forEach((s) => {
    let d = "";
    for (let k = 0; k < n; k++) {
      const v = s.values[k];
      if (v == null || !isFinite(v)) continue;
      d += `${d === "" ? "M" : "L"}${sx(xs[k]).toFixed(2)} ${sy(v).toFixed(2)} `;
    }
    const p = svgEl("path", { class: "chart-line animate" + (s.dashed ? " dashed" : ""), d, stroke: s.color });
    svg.append(p); linePaths.push(p);
  });

  (cfg.markers || []).forEach((m) => {
    const x = sx(m.x);
    if (m.line !== false) svg.append(svgEl("line", { class: "chart-marker-line", x1: x, x2: x, y1: pad.t, y2: pad.t + plotH }));
    svg.append(svgEl("circle", { class: "chart-marker-dot", cx: x, cy: sy(m.y), r: 5, fill: m.color || "var(--primary)" }));
    if (m.label) {
      const t = svgEl("text", { class: "chart-tick", x: clamp(x, pad.l + 40, W - pad.r - 40), y: pad.t + 12, "text-anchor": "middle", fill: m.color || "var(--text-muted)" });
      t.style.fontWeight = "600";
      t.textContent = m.label;
      svg.append(t);
    }
  });

  const cursor = svgEl("line", { class: "chart-cursor", y1: pad.t, y2: pad.t + plotH });
  const dotsG = svgEl("g");
  svg.append(cursor, dotsG);

  const wrap = el("div", { class: "chart-wrap" });
  wrap.append(svg);
  const tip = el("div", { class: "chart-tooltip", role: "status" });
  wrap.append(tip);

  function showAt(idx) {
    const xv = xs[idx], px = sx(xv);
    cursor.setAttribute("x1", px); cursor.setAttribute("x2", px);
    cursor.style.opacity = 1;
    dotsG.innerHTML = "";
    let rows = "";
    (cfg.series || []).forEach((s) => {
      const v = s.values[idx];
      if (v == null || !isFinite(v)) return;
      dotsG.append(svgEl("circle", { class: "chart-marker-dot", cx: px, cy: sy(v), r: 4.5, fill: s.color }));
      rows += `<div class="tt-row"><span><i class="tt-dot" style="background:${s.color}"></i>${s.name}</span><span>${yFmt(v)}</span></div>`;
    });
    (cfg.bands || []).forEach((b) => {
      const lo = b.lower[idx], hi = b.upper[idx];
      if (lo == null) return;
      rows += `<div class="tt-row"><span><i class="tt-dot" style="background:${b.color}"></i>${b.name}</span><span>${yFmt(lo)} – ${yFmt(hi)}</span></div>`;
    });
    tip.innerHTML = `<div class="tt-x">${xFmt(xv)}</div>${rows}`;
    tip.style.left = clamp((px / W) * 100, 7, 93) + "%";
    tip.style.top = (pad.t / H) * 100 + "%";
    tip.style.opacity = 1;
  }
  function hide() { cursor.style.opacity = 0; tip.style.opacity = 0; dotsG.innerHTML = ""; }
  function onMove(e) {
    const rect = svg.getBoundingClientRect();
    let frac = ((((e.clientX - rect.left) / rect.width) * W) - pad.l) / plotW;
    frac = clamp(frac, 0, 1);
    showAt(Math.round(frac * (n - 1)));
  }
  svg.addEventListener("mousemove", onMove);
  svg.addEventListener("mouseleave", hide);
  svg.addEventListener("touchstart", (e) => { if (e.touches[0]) onMove(e.touches[0]); }, { passive: true });
  svg.addEventListener("touchmove", (e) => { if (e.touches[0]) onMove(e.touches[0]); }, { passive: true });

  if (cfg.animate !== false && !reducedMotion()) {
    requestAnimationFrame(() => {
      linePaths.forEach((p) => {
        try { const len = p.getTotalLength(); p.style.setProperty("--len", len); }
        catch (e) { p.classList.remove("animate"); }
      });
    });
  } else {
    linePaths.forEach((p) => p.classList.remove("animate"));
    $$(".chart-band", svg).forEach((b) => b.classList.remove("animate"));
  }

  const table = el("table", { class: "sr-only" });
  const thead = el("tr", {}, [el("th", { text: cfg.xLabel || "X" }),
    ...(cfg.series || []).map((s) => el("th", { text: s.name })),
    ...(cfg.bands || []).flatMap((b) => [el("th", { text: b.name + " low" }), el("th", { text: b.name + " high" })])]);
  table.append(el("thead", {}, thead));
  const tb = el("tbody");
  xIdx.forEach((k) => {
    tb.append(el("tr", {}, [el("td", { text: xFmt(xs[k]) }),
      ...(cfg.series || []).map((s) => el("td", { text: yFmt(s.values[k]) })),
      ...(cfg.bands || []).flatMap((b) => [el("td", { text: yFmt(b.lower[k]) }), el("td", { text: yFmt(b.upper[k]) })])]));
  });
  table.append(tb);
  wrap.append(table);

  return wrap;
}

function legend(items) {
  return el("div", { class: "chart-legend" }, items.map((it) =>
    el("span", { class: "legend-item" }, [
      el("span", { class: "legend-swatch" + (it.dashed ? " dashed" : ""), style: `background:${it.color};color:${it.color}` }),
      it.name,
    ])));
}

const TOAST_ICONS = {
  success: `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m4 10.5 4 4 8-9"/></svg>`,
  error: `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l8 8M14 6l-8 8"/></svg>`,
  info: `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 9v5M10 6h.01"/><circle cx="10" cy="10" r="7.5"/></svg>`,
};
function toast(title, msg = "", type = "info") {
  const region = $("#toast-region");
  const node = el("div", { class: `toast ${type}`, role: "status" }, [
    el("span", { class: "toast-ico", html: TOAST_ICONS[type] || TOAST_ICONS.info }),
    el("div", { class: "toast-body" }, [
      el("div", { class: "toast-title", text: title }),
      msg ? el("div", { class: "toast-msg", text: msg }) : null,
    ]),
  ]);
  region.append(node);
  setTimeout(() => { node.classList.add("leaving"); setTimeout(() => node.remove(), 260); }, 3800);
}

let lastFocused = null;
function openModal({ title, desc, content, actions = [], onOpen }) {
  const root = $("#modal-root");
  lastFocused = document.activeElement;
  const overlay = el("div", { class: "modal-overlay" });
  const modal = el("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": title });
  modal.append(el("h3", { text: title }));
  if (desc) modal.append(el("p", { text: desc }));
  if (content) modal.append(content);
  const actRow = el("div", { class: "modal-actions" });
  actions.forEach((a) => actRow.append(el("button", {
    class: `btn ${a.variant || "btn-secondary"}`, type: "button",
    onClick: () => { const keep = a.onClick && a.onClick(); if (keep !== true) closeModal(); },
  }, a.label)));
  modal.append(actRow);
  overlay.addEventListener("click", closeModal);
  root.append(overlay, modal);
  root.classList.add("open");
  root.setAttribute("aria-hidden", "false");

  const focusables = $$("button, input, select, textarea, [tabindex]", modal);
  (focusables[0] || modal).focus();
  modal._trap = (e) => {
    if (e.key === "Escape") { e.preventDefault(); closeModal(); }
    else if (e.key === "Tab" && focusables.length) {
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  document.addEventListener("keydown", modal._trap);
  if (onOpen) onOpen(modal);
}
function closeModal() {
  const root = $("#modal-root");
  const modal = $(".modal", root);
  if (modal && modal._trap) document.removeEventListener("keydown", modal._trap);
  root.classList.remove("open");
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = "";
  if (lastFocused && lastFocused.focus) lastFocused.focus();
}

function stepDecimals(step) { const s = String(step); return s.includes(".") ? s.split(".")[1].length : 0; }
function fmtFieldValue(field, v) {
  if (field.type === "currency") return String(Math.round(v));
  const d = stepDecimals(field.step || 1);
  return d ? String(Number(v).toFixed(d)) : String(Math.round(v));
}

function infoTip(text) {
  if (!text) return null;
  return el("button", { class: "info", type: "button", "aria-label": "More info", dataset: { tip: text }, tabindex: "0", onClick: (e) => e.preventDefault() }, "i");
}

function renderField(field, inputs, onChange) {
  const id = nextId();
  const val = inputs[field.key];
  const wrap = el("div", { class: "field" });

  const number = el("input", {
    type: "number", id, class: "num-input" + (field.prefix ? " has-prefix" : "") + (field.suffix ? " has-suffix" : ""),
    value: fmtFieldValue(field, val), min: field.min, max: field.max, step: field.step, inputmode: "decimal",
    "aria-label": field.label,
  });
  const inputWrap = el("div", { class: "input-wrap" }, [
    field.prefix ? el("span", { class: "input-prefix", text: field.prefix }) : null,
    number,
    field.suffix ? el("span", { class: "input-suffix", text: field.suffix }) : null,
  ]);

  wrap.append(el("div", { class: "field-top" }, [
    el("label", { class: "field-label", for: id }, [field.label, infoTip(field.help)]),
    inputWrap,
  ]));

  const slider = el("input", {
    type: "range", min: field.min, max: field.max, step: field.step, value: val,
    "aria-label": field.label + " slider", tabindex: "0",
  });
  wrap.append(slider);

  const setFill = () => {
    const p = ((Number(slider.value) - field.min) / (field.max - field.min)) * 100;
    slider.style.setProperty("--_fill", clamp(p, 0, 100) + "%");
  };
  setFill();

  slider.addEventListener("input", () => {
    number.value = fmtFieldValue(field, Number(slider.value));
    number.classList.remove("invalid");
    setFill();
    onChange(field.key, Number(slider.value));
  });
  number.addEventListener("input", () => {
    const v = parseFloat(number.value);
    if (isNaN(v)) { number.classList.add("invalid"); return; }
    number.classList.remove("invalid");
    const cl = clamp(v, field.min, field.max);
    slider.value = cl; setFill();
    onChange(field.key, cl);
  });
  number.addEventListener("blur", () => {
    let v = parseFloat(number.value);
    if (isNaN(v)) v = field.min;
    const cl = clamp(v, field.min, field.max);
    number.value = fmtFieldValue(field, cl); number.classList.remove("invalid");
    slider.value = cl; setFill();
  });

  return wrap;
}

function renderSchemaForm(module, inputs, onChange) {
  const frag = document.createDocumentFragment();
  const groups = {};
  module.fields.forEach((f) => { (groups[f.group] = groups[f.group] || []).push(f); });
  Object.entries(groups).forEach(([name, fields]) => {
    const g = el("div", { class: "field-group" });
    g.append(el("div", { class: "field-group-label", text: name }));
    fields.forEach((f) => g.append(renderField(f, inputs, onChange)));
    frag.append(g);
  });
  return frag;
}

function numberCell(value, opts, onInput) {
  const inp = el("input", {
    type: "number", class: "num-input" + (opts.prefix ? " has-prefix" : "") + (opts.suffix ? " has-suffix" : ""),
    value: opts.type === "currency" ? Math.round(value) : value,
    min: opts.min, max: opts.max, step: opts.step, inputmode: "decimal", "aria-label": opts.aria,
  });
  inp.addEventListener("input", () => {
    const v = parseFloat(inp.value);
    if (isNaN(v)) { inp.classList.add("invalid"); return; }
    inp.classList.remove("invalid");
    onInput(clamp(v, opts.min, opts.max));
  });
  inp.addEventListener("blur", () => { let v = parseFloat(inp.value); if (isNaN(v)) v = opts.min; inp.value = clamp(v, opts.min, opts.max); inp.classList.remove("invalid"); });
  return el("div", { class: "input-wrap" }, [
    opts.prefix ? el("span", { class: "input-prefix", text: opts.prefix }) : null,
    inp,
    opts.suffix ? el("span", { class: "input-suffix", text: opts.suffix }) : null,
  ]);
}

const CUR_SYMBOL = () => getCur().symbol;

const ICONS = {
  rentvsbuy: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9h14v-9"/><path d="M10 19v-5h4v5"/></svg>`,
  debtpayoff: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Z"/><path d="M4 7v5c0 1.7 3.6 3 8 3s8-1.3 8-3V7"/><path d="M4 12v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5"/></svg>`,
  jobcomparison: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/></svg>`,
  loan: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16.5 5.5 11A2 2 0 0 1 7.4 9.5h9.2a2 2 0 0 1 1.9 1.5L20 16.5"/><path d="M3 16.5h18v2.5h-2v-1H5v1H3z"/><circle cx="7.5" cy="16.5" r="1.4"/><circle cx="16.5" cy="16.5" r="1.4"/></svg>`,
  retirement: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5v14h16"/><path d="M7 15l3.5-4 3 2.5L20 7"/><path d="M16 7h4v4"/></svg>`,
  bulb: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.5.4.9 1 1 1.7h5.2c.1-.7.5-1.3 1-1.7A6 6 0 0 0 12 3Z"/></svg>`,
  arrow: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h9M9 4l4 4-4 4"/></svg>`,
};

function stat(label, value, { sub, tone, help, num, format } = {}) {
  const valEl = el("div", { class: "stat-value" + (tone ? " " + tone : "") });
  const node = el("div", { class: "stat" }, [
    el("div", { class: "stat-label" }, [label, infoTip(help)]),
    valEl,
    sub ? el("div", { class: "stat-sub", text: sub }) : null,
  ]);
  node._animate = (animate) => {
    if (num != null && format && animate && !reducedMotion()) {
      const dur = 540, start = performance.now(), from = 0;
      const tick = (t) => { const p = Math.min(1, (t - start) / dur), e = 1 - Math.pow(1 - p, 3); valEl.textContent = format(from + (num - from) * e); if (p < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    } else { valEl.textContent = num != null && format ? format(num) : value; }
  };
  return node;
}

const MODULES = {

  rentvsbuy: {
    id: "rentvsbuy", title: "Rent vs. Buy", accent: "var(--series-a)", icon: ICONS.rentvsbuy,
    blurb: "Should you buy a home or keep renting and invest the difference? See net worth on both paths and the year they cross.",
    fields: [
      { key: "homePrice", label: "Home price", type: "currency", min: 50000, max: 3000000, step: 5000, group: "The home", prefix: CUR_SYMBOL() },
      { key: "downPayment", label: "Down payment", type: "currency", min: 0, max: 1500000, step: 5000, group: "The home", prefix: CUR_SYMBOL() },
      { key: "rate", label: "Mortgage rate", type: "percent", min: 0, max: 12, step: 0.05, suffix: "%", group: "The home", help: "Annual interest rate on the mortgage." },
      { key: "termYears", label: "Loan term", type: "number", min: 5, max: 40, step: 1, suffix: "yrs", group: "The home" },
      { key: "homeAppreciationPct", label: "Home appreciation", type: "percent", min: -3, max: 10, step: 0.1, suffix: "%/yr", group: "The home", help: "Expected yearly change in the home's value." },
      { key: "propertyTaxPct", label: "Property tax", type: "percent", min: 0, max: 4, step: 0.05, suffix: "%/yr", group: "Ongoing costs", help: "Annual property tax as a % of home value." },
      { key: "maintenancePct", label: "Maintenance", type: "percent", min: 0, max: 5, step: 0.1, suffix: "%/yr", group: "Ongoing costs", help: "Annual upkeep & insurance as a % of home value." },
      { key: "monthlyRent", label: "Monthly rent", type: "currency", min: 200, max: 15000, step: 50, prefix: CUR_SYMBOL(), group: "Renting & investing" },
      { key: "rentGrowthPct", label: "Rent growth", type: "percent", min: 0, max: 10, step: 0.1, suffix: "%/yr", group: "Renting & investing" },
      { key: "investReturnPct", label: "Investment return", type: "percent", min: 0, max: 12, step: 0.1, suffix: "%/yr", group: "Renting & investing", help: "Return earned on money not spent on housing." },
      { key: "horizonYears", label: "Time horizon", type: "number", min: 1, max: 40, step: 1, suffix: "yrs", group: "Horizon" },
    ],
    compute: computeRentVsBuy,
    metrics(r, i) {
      const buyAhead = r.advantage >= 0;
      return [
        stat("Buy — net worth", null, { num: r.buyerFinal, format: money, tone: "tone-a", sub: `after ${i.horizonYears} years` }),
        stat("Rent — net worth", null, { num: r.renterFinal, format: money, tone: "tone-b", sub: `after ${i.horizonYears} years` }),
        stat("Breakeven", r.breakeven == null ? "Beyond horizon" : (r.breakeven < 0.08 ? "Immediate" : `Year ${r.breakeven.toFixed(1)}`),
          { sub: r.breakeven == null ? "renting stays ahead" : "buying overtakes renting" }),
        stat(buyAhead ? "Buying wins by" : "Renting wins by", null, { num: Math.abs(r.advantage), format: money, tone: buyAhead ? "tone-pos" : "tone-neg", sub: "net worth at horizon" }),
      ];
    },
    chart(r) {
      const markers = [];
      if (r.breakeven != null && r.breakeven > 0.05) {

        const k = Math.ceil(r.breakeven);
        const k0 = Math.max(0, k - 1);
        const f = r.breakeven - k0;
        const y = r.buyerNW[k0] + (r.buyerNW[Math.min(k, r.buyerNW.length - 1)] - r.buyerNW[k0]) * f;
        markers.push({ x: r.breakeven, y, label: `Breakeven · Yr ${r.breakeven.toFixed(1)}`, color: "var(--series-a)" });
      }
      return {
        xValues: r.years, xLabel: "Year",
        xTickFormat: (y) => `${y}`, xFormat: (y) => (y === 0 ? "Today" : `Year ${y}`),
        series: [
          { name: "Buy", color: "var(--series-a)", values: r.buyerNW },
          { name: "Rent + invest", color: "var(--series-b)", values: r.renterNW },
        ],
        markers,
      };
    },
    summary(r, i) {
      const buyAhead = r.advantage >= 0;
      const be = r.breakeven == null
        ? `Within your ${i.horizonYears}-year horizon, <strong>renting and investing stays ahead</strong> — buying never catches up.`
        : (r.breakeven < 0.08
          ? `Buying is ahead from <strong>day one</strong> at these assumptions.`
          : `Buying overtakes renting at roughly <strong>year ${r.breakeven.toFixed(1)}</strong>. Before that point, renting and investing the difference leaves you wealthier.`);
      const verdict = buyAhead
        ? `If you'll stay at least ${r.breakeven == null ? i.horizonYears : Math.ceil(r.breakeven)} years, buying looks like the stronger move.`
        : `If your horizon is around ${i.horizonYears} years, renting and investing looks stronger here.`;
      return `<span class="verdict">${buyAhead ? "Edge: Buying" : "Edge: Renting"}</span>
        <p>${be} By year ${i.horizonYears}, the buyer's net worth is <strong>${money(r.buyerFinal)}</strong> versus <strong>${money(r.renterFinal)}</strong> for the renter — a gap of <strong>${money(Math.abs(r.advantage))}</strong>.</p>
        <p>${verdict} This assumes a ${pct(i.investReturnPct)} investment return, ${pct(i.homeAppreciationPct)} home appreciation, ${Math.round(BUY_CLOSING_PCT * 100)}% buying costs, and a ${Math.round(SELL_PCT * 100)}% cost to sell. First-year housing runs about <strong>${money(r.fyBuyerMonthly)}/mo</strong> to own vs <strong>${money(r.fyRentMonthly)}/mo</strong> to rent.</p>`;
    },
    kpi: (r) => ({ label: "Buying advantage at horizon", value: r.advantage, format: money, betterIsLower: false }),
    cardStat(i) { const r = computeRentVsBuy(i); const a = r.advantage >= 0; return `${a ? "Buying" : "Renting"} ahead by ${compactMoney(Math.abs(r.advantage))} · ${i.horizonYears}y`; },
    smartName: (i) => `Home @ ${compactMoney(i.homePrice)}`,
  },

  debtpayoff: {
    id: "debtpayoff", title: "Debt Payoff", accent: "var(--series-c)", icon: ICONS.debtpayoff,
    blurb: "List your debts and compare the Avalanche and Snowball strategies — payoff date, total interest, and the road to zero.",
    compute: computeDebt,
    renderInputs(container, inputs, onChange) {
      container.innerHTML = "";
      const group = el("div", { class: "field-group" });
      group.append(el("div", { class: "field-group-label", text: "Your debts" }));
      const list = el("div", { class: "debt-list" });
      group.append(list);
      const addBtn = el("button", { class: "btn btn-secondary btn-sm btn-block", type: "button" },
        [el("span", { html: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>` }), "Add a debt"]);
      addBtn.addEventListener("click", () => {
        inputs.debts.push({ name: `Debt ${inputs.debts.length + 1}`, balance: 2000, apr: 12, min: 60 });
        renderDebtRows(list, inputs, onChange); onChange();
      });
      group.append(addBtn);
      container.append(group);

      const g2 = el("div", { class: "field-group" });
      g2.append(el("div", { class: "field-group-label", text: "Acceleration" }));
      g2.append(renderField(
        { key: "extra", label: "Extra monthly payment", type: "currency", min: 0, max: 5000, step: 25, prefix: CUR_SYMBOL(), help: "Paid on top of all minimums, sent to the target debt." },
        inputs, (k, v) => { inputs.extra = v; onChange(); }));
      container.append(g2);

      renderDebtRows(list, inputs, onChange);
    },
    metrics(r) {
      if (!r.payable) {
        return [
          stat("Total debt", null, { num: r.totalDebt, format: money, tone: "tone-warn" }),
          stat("Status", "Not payable", { tone: "tone-neg", sub: "payments don't cover interest" }),
          stat("Active debts", String(r.count), {}),
        ];
      }
      const saved = r.snowball.totalInterest - r.avalanche.totalInterest;
      return [
        stat("Debt-free in", ym(r.avalanche.months), { tone: "tone-a", sub: "with Avalanche" }),
        stat("Interest — Avalanche", null, { num: r.avalanche.totalInterest, format: money, tone: "tone-a" }),
        stat("Interest — Snowball", null, { num: r.snowball.totalInterest, format: money, tone: "tone-b" }),
        stat("Avalanche saves", null, { num: Math.max(0, saved), format: money, tone: "tone-pos", sub: "vs Snowball interest" }),
      ];
    },
    chart(r) {
      const len = Math.max(r.avalanche.timeline.length, r.snowball.timeline.length);
      const pad = (arr) => { const a = arr.slice(); while (a.length < len) a.push(0); return a; };
      const months = Array.from({ length: len }, (_, k) => k);
      return {
        xValues: months, xLabel: "Months",
        xTickFormat: (m) => `${m}`, xFormat: (m) => `Month ${m}`,
        yMin: 0,
        series: [
          { name: "Avalanche", color: "var(--series-a)", values: pad(r.avalanche.timeline) },
          { name: "Snowball", color: "var(--series-b)", values: pad(r.snowball.timeline), dashed: true },
        ],
      };
    },
    chartTitle: "Balance to zero",
    summary(r) {
      if (r.count === 0) return `<p>Add at least one debt to see a payoff plan.</p>`;
      if (!r.payable) return `<span class="verdict" style="background:var(--danger-soft);color:var(--danger)">Heads up</span>
        <p>With <strong>${money(r.extra)}/mo</strong> extra, the payments don't outpace the interest on <strong>${money(r.totalDebt)}</strong> of debt, so the balance never reaches zero. Try increasing the extra payment or the minimums.</p>`;
      const saved = r.snowball.totalInterest - r.avalanche.totalInterest;
      const faster = r.snowball.months - r.avalanche.months;
      return `<span class="verdict">Recommended: Avalanche</span>
        <p><strong>Avalanche</strong> (highest APR first) clears everything in <strong>${ym(r.avalanche.months)}</strong> with <strong>${money(r.avalanche.totalInterest)}</strong> of interest — about <strong>${money(Math.max(0, saved))}</strong> less than Snowball${faster > 0 ? ` and ${faster} month${faster > 1 ? "s" : ""} sooner` : ""}.</p>
        <p><strong>Snowball</strong> (smallest balance first) costs a little more but delivers quick wins as small debts vanish — useful if you need the motivation. Either way, the <strong>${money(r.extra)}/mo</strong> extra is what does the heavy lifting.</p>`;
    },
    extras(r, i, container) {
      if (r.count === 0) return;
      const strat = state.ui.debtStrategy;
      const data = strat === "snowball" ? r.snowball : r.avalanche;
      const card = el("div", { class: "card card-pad" });
      const tabs = el("div", { class: "tabs", role: "tablist" });
      ["avalanche", "snowball"].forEach((s) => {
        const t = el("button", { class: "tab", role: "tab", "aria-selected": String(s === strat), text: s[0].toUpperCase() + s.slice(1) });
        t.addEventListener("click", () => { state.ui.debtStrategy = s; rerenderFromCache(); });
        tabs.append(t);
      });
      card.append(el("div", { class: "card-h" }, [el("h3", { text: "Payoff order" }), tabs]));
      const ol = el("div", { style: "display:grid;gap:10px" });
      data.perDebt.slice().sort((a, b) => (a.paidMonth || 1e9) - (b.paidMonth || 1e9)).forEach((d, idx) => {
        ol.append(el("div", { style: "display:flex;align-items:center;gap:12px" }, [
          el("span", { class: "mono", style: "width:24px;height:24px;display:grid;place-items:center;border-radius:50%;background:var(--surface-3);font-size:12px;font-weight:600", text: String(idx + 1) }),
          el("span", { style: "flex:1;font-weight:500", text: d.name }),
          el("span", { class: "pill " + (strat === "snowball" ? "pill-b" : "pill-a"), text: d.paidMonth ? `paid in ${ym(d.paidMonth)}` : "—" }),
        ]));
      });
      card.append(ol);
      container.append(card);
    },
    kpi: (r) => ({ label: "total interest (Avalanche)", value: r.payable ? r.avalanche.totalInterest : Infinity, format: money, betterIsLower: true }),
    cardStat(i) { const r = computeDebt(i); return r.count === 0 ? "No debts yet" : (r.payable ? `Debt-free in ${ym(r.avalanche.months)}` : "Needs a bigger payment"); },
    smartName: (i) => `${i.debts.length} debts · ${compactMoney(i.debts.reduce((s, d) => s + d.balance, 0))}`,
  },

  jobcomparison: {
    id: "jobcomparison", title: "Job Offers", accent: "var(--series-b)", icon: ICONS.jobcomparison,
    blurb: "Compare two offers beyond base pay — bonus, equity, benefits, cost-of-living and commute — as effective annual value over time.",
    compute: computeJob,
    renderInputs(container, inputs, onChange) {
      container.innerHTML = "";
      const top = el("div", { class: "field-group" });
      top.append(el("div", { class: "field-group-label", text: "Comparison settings" }));
      top.append(renderField({ key: "horizonYears", label: "Horizon", type: "number", min: 1, max: 10, step: 1, suffix: "yrs", group: "" }, inputs, (k, v) => { inputs.horizonYears = v; onChange(); }));
      top.append(renderField({ key: "raisePct", label: "Annual raise", type: "percent", min: 0, max: 12, step: 0.5, suffix: "%", group: "", help: "Assumed yearly raise on base pay for both offers." }, inputs, (k, v) => { inputs.raisePct = v; onChange(); }));
      container.append(top);

      const g = el("div", { class: "field-group" });
      g.append(el("div", { class: "field-group-label", text: "The offers" }));
      g.append(el("div", { class: "offer-head" }, [
        el("div", { class: "offer-tag a", text: "Offer A" }),
        el("div", { class: "offer-tag b", text: "Offer B" }),
      ]));
      const cur = CUR_SYMBOL();
      const FIELDS = [
        { label: "Base salary", key: "Base", type: "currency", min: 0, max: 600000, step: 1000, prefix: cur },
        { label: "Annual bonus", key: "BonusPct", type: "percent", min: 0, max: 100, step: 1, suffix: "%" },
        { label: "Equity grant (total)", key: "Equity", type: "currency", min: 0, max: 2000000, step: 5000, prefix: cur, help: "Total grant value, vesting evenly over the vesting period." },
        { label: "Vesting period", key: "VestYears", type: "number", min: 1, max: 6, step: 1, suffix: "yr" },
        { label: "Benefits / yr", key: "Benefits", type: "currency", min: 0, max: 60000, step: 500, prefix: cur, help: "Annual value of health, 401k match, perks, etc." },
        { label: "Cost-of-living index", key: "Col", type: "number", min: 50, max: 260, step: 1, help: "100 = national average. Higher = more expensive city." },
        { label: "Commute cost / mo", key: "CommuteCost", type: "currency", min: 0, max: 1500, step: 10, prefix: cur },
        { label: "Commute / day", key: "CommuteMins", type: "number", min: 0, max: 200, step: 5, suffix: "min", help: "Round-trip minutes per day. Valued at your hourly rate." },
      ];
      FIELDS.forEach((f) => {
        const field = el("div", { class: "field" });
        field.append(el("div", { class: "field-label", style: "margin-bottom:2px" }, [f.label, infoTip(f.help)]));
        field.append(el("div", { class: "offer-cols" }, [
          numberCell(inputs["a" + f.key], { ...f, aria: "Offer A " + f.label }, (v) => { inputs["a" + f.key] = v; onChange(); }),
          numberCell(inputs["b" + f.key], { ...f, aria: "Offer B " + f.label }, (v) => { inputs["b" + f.key] = v; onChange(); }),
        ]));
        g.append(field);
      });
      container.append(g);
    },
    metrics(r, i) {
      const aWins = r.totalA >= r.totalB;
      return [
        stat("Offer A — yr 1 value", null, { num: r.year1A, format: money, tone: "tone-a", help: "Effective annual value, adjusted for cost of living and commute." }),
        stat("Offer B — yr 1 value", null, { num: r.year1B, format: money, tone: "tone-b" }),
        stat(`${i.horizonYears}-yr total — A`, null, { num: r.totalA, format: money, tone: "tone-a" }),
        stat(`${i.horizonYears}-yr total — B`, null, { num: r.totalB, format: money, tone: "tone-b" }),
        stat(aWins ? "Offer A leads by" : "Offer B leads by", null, { num: Math.abs(r.totalA - r.totalB), format: money, tone: "tone-pos", sub: `over ${i.horizonYears} years` }),
      ];
    },
    chart(r) {
      return {
        xValues: r.years, xLabel: "Year",
        xTickFormat: (y) => `${y}`, xFormat: (y) => (y === 0 ? "Start" : `Year ${y}`),
        series: [
          { name: "Offer A (cumulative)", color: "var(--series-a)", values: r.cumA },
          { name: "Offer B (cumulative)", color: "var(--series-b)", values: r.cumB },
        ],
      };
    },
    chartTitle: "Cumulative effective value",
    summary(r, i) {
      const aWins = r.totalA >= r.totalB;
      const gap = Math.abs(r.totalA - r.totalB);
      return `<span class="verdict">${aWins ? "Edge: Offer A" : "Edge: Offer B"}</span>
        <p>After adjusting for cost of living and commute, <strong>${aWins ? "Offer A" : "Offer B"}</strong> delivers more effective value — <strong>${money(aWins ? r.totalA : r.totalB)}</strong> vs <strong>${money(aWins ? r.totalB : r.totalA)}</strong> over ${i.horizonYears} years, a difference of <strong>${money(gap)}</strong>.</p>
        <p>Year-one effective value is <strong>${money(r.year1A)}</strong> for A and <strong>${money(r.year1B)}</strong> for B. Remember equity vesting cliffs and that a high headline salary in an expensive city can buy less than a smaller one elsewhere.</p>`;
    },
    kpi: (r) => ({ label: "value of the stronger offer", value: Math.max(r.totalA, r.totalB), format: money, betterIsLower: false }),
    cardStat(i) { const r = computeJob(i); const a = r.totalA >= r.totalB; return `${a ? "A" : "B"} leads · ${compactMoney(Math.abs(r.totalA - r.totalB))} over ${i.horizonYears}y`; },
    smartName: () => `Two offers`,
  },

  loan: {
    id: "loan", title: "Loan & Affordability", accent: "var(--warning)", icon: ICONS.loan,
    blurb: "Price, down payment, rate and term in — monthly payment, total interest and a full amortization schedule out.",
    fields: [
      { key: "price", label: "Purchase price", type: "currency", min: 1000, max: 200000, step: 500, prefix: CUR_SYMBOL(), group: "The purchase" },
      { key: "downPayment", label: "Down payment", type: "currency", min: 0, max: 100000, step: 250, prefix: CUR_SYMBOL(), group: "The purchase" },
      { key: "apr", label: "APR", type: "percent", min: 0, max: 30, step: 0.1, suffix: "%", group: "The loan", help: "Annual percentage rate on the financed amount." },
      { key: "termMonths", label: "Term", type: "number", min: 12, max: 96, step: 6, suffix: "mo", group: "The loan" },
    ],
    compute: computeLoan,
    metrics(r, i) {
      const intPctOfP = r.P > 0 ? (r.totalInterest / r.P) * 100 : 0;
      return [
        stat("Monthly payment", null, { num: r.payment, format: money, tone: "tone-a" }),
        stat("Total interest", null, { num: r.totalInterest, format: money, tone: "tone-warn", sub: `${pct(intPctOfP)} of amount financed` }),
        stat("Amount financed", null, { num: r.P, format: money }),
        stat("Total of payments", null, { num: r.totalPaid, format: money, sub: "incl. down payment" }),
      ];
    },
    chart(r) {
      return {
        xValues: r.months, xLabel: "Months",
        xTickFormat: (m) => `${m}`, xFormat: (m) => `Month ${m}`, yMin: 0,
        series: [
          { name: "Remaining balance", color: "var(--series-a)", values: r.balances },
          { name: "Interest paid (cumulative)", color: "var(--warning)", values: r.cumInt, dashed: true },
        ],
      };
    },
    chartTitle: "Payoff & interest",
    summary(r, i) {
      return `<span class="verdict">Payment plan</span>
        <p>Financing <strong>${money(r.P)}</strong> at <strong>${pct(i.apr)}</strong> over <strong>${Math.round(i.termMonths)} months</strong> works out to <strong>${money(r.payment)}/mo</strong>.</p>
        <p>You'll pay <strong>${money(r.totalInterest)}</strong> in interest — that's ${pct(r.P > 0 ? (r.totalInterest / r.P) * 100 : 0)} on top of the amount financed, for a total outlay of <strong>${money(r.totalPaid)}</strong> including the down payment. A larger down payment or shorter term cuts the interest meaningfully.</p>`;
    },
    extras(r, i, container) {
      const card = el("div", { class: "card card-pad" });
      const dl = el("button", { class: "btn btn-secondary btn-sm" }, [el("span", { html: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v8M5 7l3 3 3-3"/><path d="M3 13h10"/></svg>` }), "Download CSV"]);
      dl.addEventListener("click", () => downloadLoanCSV(r));
      card.append(el("div", { class: "card-h" }, [el("h3", { text: "Amortization schedule" }), dl]));
      const scroll = el("div", { class: "table-scroll" });
      const table = el("table", { class: "data" });
      table.append(el("thead", {}, el("tr", {}, [
        el("th", { text: "Month" }), el("th", { text: "Payment" }), el("th", { text: "Principal" }), el("th", { text: "Interest" }), el("th", { text: "Balance" }),
      ])));
      const tb = el("tbody");
      r.sched.rows.forEach((row) => tb.append(el("tr", {}, [
        el("td", { text: `#${row.month}` }),
        el("td", { text: money(row.payment, 2) }),
        el("td", { text: money(row.principal, 2) }),
        el("td", { text: money(row.interest, 2) }),
        el("td", { text: money(row.balance, 2) }),
      ])));
      table.append(tb);
      scroll.append(table);
      card.append(scroll);
      container.append(card);
    },
    kpi: (r) => ({ label: "total interest", value: r.totalInterest, format: money, betterIsLower: true }),
    cardStat(i) { const r = computeLoan(i); return `${money(r.payment)}/mo · ${money(r.totalInterest)} interest`; },
    smartName: (i) => `${compactMoney(i.price)} over ${Math.round(i.termMonths)}mo`,
  },

  retirement: {
    id: "retirement", title: "Savings & Retirement", accent: "var(--series-a)", icon: ICONS.retirement, heavy: true,
    blurb: "Project your savings with a Monte Carlo simulation — see the realistic range of outcomes, not a single fragile number.",
    fields: [
      { key: "currentSavings", label: "Current savings", type: "currency", min: 0, max: 2000000, step: 1000, prefix: CUR_SYMBOL(), group: "Today" },
      { key: "monthlyContribution", label: "Monthly contribution", type: "currency", min: 0, max: 20000, step: 50, prefix: CUR_SYMBOL(), group: "Today" },
      { key: "expectedReturnPct", label: "Expected return", type: "percent", min: 0, max: 15, step: 0.1, suffix: "%/yr", group: "Assumptions", help: "Average annual return before inflation." },
      { key: "volatilityPct", label: "Volatility", type: "percent", min: 0, max: 40, step: 0.5, suffix: "%", group: "Assumptions", help: "Annual standard deviation of returns. Stocks ≈ 15–18%." },
      { key: "inflationPct", label: "Inflation", type: "percent", min: 0, max: 10, step: 0.1, suffix: "%/yr", group: "Assumptions" },
      { key: "years", label: "Years", type: "number", min: 1, max: 50, step: 1, suffix: "yrs", group: "Horizon & goal" },
      { key: "runs", label: "Simulations", type: "number", min: 500, max: 5000, step: 500, suffix: "runs", group: "Horizon & goal", help: "More runs = smoother percentile bands." },
      { key: "goal", label: "Target (optional)", type: "currency", min: 0, max: 10000000, step: 50000, prefix: CUR_SYMBOL(), group: "Horizon & goal", help: "Probability of reaching this is shown below." },
    ],
    compute: computeRetirement,
    metrics(r, i) {
      const out = [
        stat("Median outcome", null, { num: r.finalP50, format: money, tone: "tone-a", sub: `50th percentile · ${i.years} yrs` }),
        stat("Pessimistic", null, { num: r.finalP10, format: money, tone: "tone-neg", sub: "10th percentile" }),
        stat("Optimistic", null, { num: r.finalP90, format: money, tone: "tone-pos", sub: "90th percentile" }),
        stat("In today's money", null, { num: r.realP50, format: money, tone: "tone-warn", sub: "median, inflation-adjusted" }),
      ];
      if (r.goalProb != null) out.push(stat("Chance of goal", `${Math.round(r.goalProb * 100)}%`, { tone: r.goalProb >= 0.7 ? "tone-pos" : r.goalProb >= 0.4 ? "tone-warn" : "tone-neg", sub: `reaching ${compactMoney(i.goal)}` }));
      return out;
    },
    chart(r) {
      const real = state.ui.retMode === "real";
      return {
        xValues: r.years, xLabel: "Year",
        xTickFormat: (y) => `${y}`, xFormat: (y) => (y === 0 ? "Today" : `Year ${y}`), yMin: 0,
        bands: [{ name: "10th–90th percentile", color: "var(--series-a)", lower: real ? r.p10r : r.p10, upper: real ? r.p90r : r.p90 }],
        series: [{ name: real ? "Median (today's money)" : "Median outcome", color: "var(--series-a)", values: real ? r.p50r : r.p50 }],
      };
    },
    chartTitle: "Range of outcomes",
    chartControls() {
      const tabs = el("div", { class: "tabs", role: "tablist" });
      [["nominal", "Nominal"], ["real", "Real"]].forEach(([m, label]) => {
        const t = el("button", { class: "tab", role: "tab", "aria-selected": String(state.ui.retMode === m), text: label });
        t.addEventListener("click", () => { state.ui.retMode = m; rerenderFromCache(); });
        tabs.append(t);
      });
      return tabs;
    },
    summary(r, i) {
      const goalLine = r.goalProb != null
        ? ` Across ${r.runs.toLocaleString()} runs, about <strong>${Math.round(r.goalProb * 100)}%</strong> reached your ${money(i.goal)} target.`
        : "";
      return `<span class="verdict">Likely range</span>
        <p>Running <strong>${r.runs.toLocaleString()} simulations</strong>, your most likely balance after ${i.years} years is around <strong>${money(r.finalP50)}</strong>, with outcomes typically between <strong>${money(r.finalP10)}</strong> and <strong>${money(r.finalP90)}</strong>.${goalLine}</p>
        <p>You'll have contributed <strong>${money(r.totalContributed)}</strong> of your own money along the way. After <strong>${pct(i.inflationPct)}</strong> inflation, that median balance is worth about <strong>${money(r.realP50)}</strong> in today's money — the number that reflects real buying power.</p>`;
    },
    kpi: (r) => ({ label: "median outcome", value: r.finalP50, format: money, betterIsLower: false }),
    cardStat(i) { return `Median ≈ ${compactMoney(retirementQuick(i))} in ${i.years}y`; },
    smartName: (i) => `Retire in ${i.years}y`,
  },
};
const MODULE_ORDER = ["rentvsbuy", "debtpayoff", "jobcomparison", "loan", "retirement"];

const DEFAULTS = {
  rentvsbuy: { homePrice: 450000, downPayment: 90000, rate: 6.5, termYears: 30, propertyTaxPct: 1.1, maintenancePct: 1.0, homeAppreciationPct: 3.5, monthlyRent: 2200, rentGrowthPct: 3.0, investReturnPct: 6.0, horizonYears: 10 },
  debtpayoff: { debts: [{ name: "Credit card", balance: 8200, apr: 22.9, min: 210 }, { name: "Car loan", balance: 14500, apr: 6.4, min: 330 }, { name: "Student loan", balance: 21000, apr: 5.2, min: 240 }], extra: 350 },
  jobcomparison: { aBase: 125000, aBonusPct: 10, aEquity: 120000, aVestYears: 4, aBenefits: 14000, aCol: 155, aCommuteCost: 180, aCommuteMins: 50, bBase: 138000, bBonusPct: 8, bEquity: 60000, bVestYears: 4, bBenefits: 10000, bCol: 100, bCommuteCost: 120, bCommuteMins: 35, raisePct: 3, horizonYears: 4 },
  loan: { price: 34000, downPayment: 5000, apr: 7.2, termMonths: 60 },
  retirement: { currentSavings: 28000, monthlyContribution: 650, expectedReturnPct: 7, volatilityPct: 15, inflationPct: 2.5, years: 30, runs: 1000, goal: 1000000 },
};
const clone = (o) => JSON.parse(JSON.stringify(o));
const defaultWorking = () => clone(DEFAULTS);
const defaultSettings = { theme: "system", currency: "USD" };

function seedScenarios() {
  const now = Date.now(), day = 86400000;
  return [
    { id: uid(), type: "rentvsbuy", name: "First home in Austin", createdAt: now - day * 12, inputs: { ...clone(DEFAULTS.rentvsbuy), homePrice: 525000, downPayment: 105000, monthlyRent: 2400, horizonYears: 12, homeAppreciationPct: 4 } },
    { id: uid(), type: "debtpayoff", name: "Operation Debt-Free", createdAt: now - day * 9, inputs: clone(DEFAULTS.debtpayoff) },
    { id: uid(), type: "jobcomparison", name: "BigTech vs Startup", createdAt: now - day * 6, inputs: clone(DEFAULTS.jobcomparison) },
    { id: uid(), type: "loan", name: "Used Model 3", createdAt: now - day * 3, inputs: { ...clone(DEFAULTS.loan), price: 31500, downPayment: 4000, apr: 6.9, termMonths: 60 } },
    { id: uid(), type: "retirement", name: "Coast to 60", createdAt: now - day * 1, inputs: { ...clone(DEFAULTS.retirement), currentSavings: 45000, monthlyContribution: 900, years: 28 } },
  ];
}

const STORAGE_KEY = "crossroads:v1";
let state = {
  view: "dashboard", panelModule: null, compareA: null, compareB: null,
  settings: { ...defaultSettings }, scenarios: [], working: defaultWorking(),
  ui: { retMode: "nominal", debtStrategy: "avalanche" },
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      state.settings = { ...defaultSettings, ...(p.settings || {}) };
      state.scenarios = Array.isArray(p.scenarios) ? p.scenarios : [];
      state.working = { ...defaultWorking(), ...(p.working || {}) };
      return;
    }
  } catch (e) {  }
  state.settings = { ...defaultSettings };
  state.scenarios = seedScenarios();
  state.working = defaultWorking();
  saveState();
}
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1, savedAt: Date.now(), settings: state.settings, scenarios: state.scenarios, working: state.working,
    }));
  } catch (e) {  }
}
const persistWorking = debounce(saveState, 400);

let panelResultsMount = null;
let panelCache = null;

function renderResults(module, inputs, results, mount, { animate = true, compact = false } = {}) {
  mount.innerHTML = "";

  const metrics = module.metrics(results, inputs);
  const row = el("div", { class: "stat-row" });
  metrics.forEach((m) => row.append(m));
  mount.append(row);
  requestAnimationFrame(() => metrics.forEach((m) => m._animate && m._animate(animate)));

  const cfg = module.chart(results, inputs);
  if (cfg) {
    cfg.animate = animate;
    cfg.height = compact ? 300 : 360;
    const chartCard = el("div", { class: "card card-pad" });
    const controls = !compact && module.chartControls ? module.chartControls(results, inputs) : null;
    chartCard.append(el("div", { class: "card-h" }, [
      el("h3", { text: module.chartTitle || "Projection" }),
      controls,
    ]));
    const legendItems = [
      ...(cfg.series || []).map((s) => ({ name: s.name, color: s.color, dashed: s.dashed })),
      ...(cfg.bands || []).map((b) => ({ name: b.name, color: b.color })),
    ];
    chartCard.append(legend(legendItems));
    chartCard.append(buildChart(cfg));
    mount.append(chartCard);
  }

  mount.append(el("div", { class: "summary" }, [
    el("h3", {}, [el("span", { html: ICONS.bulb }), "What this means"]),
    el("div", { html: module.summary(results, inputs) }),
  ]));

  if (!compact && module.extras) module.extras(results, inputs, mount);
}

function loadingCard(text) {
  return el("div", { class: "card card-pad" }, [
    el("div", { class: "chart-loading" }, [el("div", { class: "spinner" }), text]),
  ]);
}

let heavyTimer = null;
function computeAndRender(module, inputs, mount, { animate = true } = {}) {
  if (module.heavy) {
    mount.innerHTML = "";
    const row = el("div", { class: "stat-row" });
    for (let i = 0; i < 4; i++) row.append(el("div", { class: "stat" }, [el("div", { class: "skeleton", style: "height:12px;width:60%" }), el("div", { class: "skeleton", style: "height:26px;width:80%;margin-top:6px" })]));
    mount.append(row, loadingCard(`Running ${Math.round(inputs.runs).toLocaleString()} simulations…`));
    clearTimeout(heavyTimer);
    heavyTimer = setTimeout(() => {
      const results = module.compute(inputs);
      panelCache = { module, inputs, results };
      renderResults(module, inputs, results, mount, { animate });
    }, 30);
  } else {
    const results = module.compute(inputs);
    panelCache = { module, inputs, results };
    renderResults(module, inputs, results, mount, { animate });
  }
}

function rerenderFromCache() {
  if (panelCache && panelResultsMount) renderResults(panelCache.module, panelCache.inputs, panelCache.results, panelResultsMount, { animate: false });
}

const view = () => $("#view");

function renderDashboard() {
  const v = view();
  v.innerHTML = "";

  const hero = el("section", { class: "hero" });
  hero.append(el("div", { class: "section-eyebrow", text: "Decision simulator" }));
  hero.append(el("h1", { html: `Compare life's biggest <em>money decisions</em>, side by side.` }));
  hero.append(el("p", { text: "Rent or buy. Avalanche or snowball. This offer or that one. Crossroads models each path with real financial math so you can choose with clarity." }));
  hero.append(el("div", { class: "hero-meta" }, [
    el("span", {}, [el("span", { html: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 1.5 3 3.5v3.2c0 3 2.1 5.8 5 6.8 2.9-1 5-3.8 5-6.8V3.5L8 1.5Z"/></svg>` }), "100% private — nothing leaves this browser"]),
    el("span", { text: "·" }),
    el("span", { text: "Compound interest, amortization & Monte Carlo, computed locally" }),
  ]));
  v.append(hero);

  v.append(el("div", { class: "cards-head" }, [el("h2", { text: "Calculators" }), el("span", { class: "section-eyebrow", text: `${MODULE_ORDER.length} modules` })]));
  const grid = el("div", { class: "card-grid" });
  MODULE_ORDER.forEach((id) => {
    const m = MODULES[id];
    let cardLine = "";
    try { cardLine = m.cardStat(state.working[id]); } catch (e) { cardLine = ""; }
    const card = el("button", { class: "scenario-card", style: `--accent:${m.accent}`, "aria-label": `Open ${m.title}` });
    card.append(el("span", { class: "card-icon", html: m.icon }));
    card.append(el("div", { class: "card-title", text: m.title }));
    card.append(el("p", { class: "card-blurb", text: m.blurb }));
    card.append(el("div", { style: "display:flex;align-items:center;justify-content:space-between;gap:8px" }, [
      el("span", { class: "card-cta" }, ["Open", el("span", { html: ICONS.arrow })]),
      cardLine ? el("span", { class: "mono", style: "font-size:12px;color:var(--text-subtle)", text: cardLine }) : null,
    ]));
    card.addEventListener("click", () => openPanel(id));
    grid.append(card);
  });
  v.append(grid);

  const savedHead = el("div", { class: "cards-head", style: "margin-top:48px" }, [
    el("h2", { text: "Saved scenarios" }),
    el("div", { style: "display:flex;gap:8px" }, [
      el("button", { class: "btn btn-ghost btn-sm", onClick: exportData }, [el("span", { html: `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v8M5 7l3 3 3-3"/><path d="M3 13h10"/></svg>` }), "Export"]),
      el("button", { class: "btn btn-ghost btn-sm", onClick: () => $("#import-file").click() }, [el("span", { html: `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 10V2M5 5l3-3 3 3"/><path d="M3 13h10"/></svg>` }), "Import"]),
    ]),
  ]);
  v.append(savedHead);

  if (state.scenarios.length === 0) {
    v.append(el("div", { class: "empty" }, [
      el("div", { class: "empty-ico", html: `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h11l3 3v15H5z"/><path d="M12 11v6M9 14h6"/></svg>` }),
      el("h3", { text: "No saved scenarios yet" }),
      el("p", { text: "Open any calculator, tune the numbers, and hit Save. Your scenarios live here for quick access and side-by-side comparison." }),
    ]));
  } else {
    const sg = el("div", { class: "saved-grid" });
    state.scenarios.slice().sort((a, b) => b.createdAt - a.createdAt).forEach((sc) => sg.append(savedCard(sc)));
    v.append(sg);
  }

  v.append(el("footer", { class: "app-footer" }, [
    el("span", { text: "Crossroads · Educational estimates, not financial advice." }),
    el("span", { class: "mono", text: "Your data stays on this device." }),
  ]));
}

function savedCard(sc) {
  const m = MODULES[sc.type];
  let line = "";
  try { line = m.cardStat(sc.inputs); } catch (e) { line = ""; }
  const card = el("div", { class: "saved-card" });
  card.append(el("div", { class: "saved-top" }, [
    el("span", { class: "saved-dot", style: `background:${m.accent}` }),
    el("span", { class: "saved-type", text: m.title }),
  ]));
  card.append(el("div", { class: "saved-name", text: sc.name }));
  card.append(el("div", { class: "saved-kpi", text: line }));
  card.append(el("div", { class: "saved-actions" }, [
    el("button", { class: "btn btn-secondary btn-sm", onClick: () => openScenario(sc) }, "Open"),
    el("button", { class: "btn btn-ghost btn-sm", onClick: () => { state.compareA = sc.id; navigate("compare"); } }, "Compare"),
    el("button", { class: "btn btn-ghost btn-sm", style: "margin-left:auto", "aria-label": `Delete ${sc.name}`, onClick: () => deleteScenario(sc) },
      el("span", { html: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h10M6 4V3h4v1M5 4l.5 9h5L11 4"/></svg>` })),
  ]));
  return card;
}

function openPanel(id, prefill) {
  state.view = "panel"; state.panelModule = id;
  if (prefill) state.working[id] = clone(prefill);
  setHash(`m/${id}`);
  render();
}
function openScenario(sc) { state.working[sc.type] = clone(sc.inputs); openPanel(sc.type); }

function renderPanel() {
  const v = view();
  v.innerHTML = "";
  const m = MODULES[state.panelModule];
  const inputs = state.working[state.panelModule];

  const head = el("div", { class: "panel-head" });
  const back = el("button", { class: "btn-back", onClick: () => navigate("dashboard") },
    [el("span", { html: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3 5 8l5 5"/></svg>` }), "Dashboard"]);
  const titles = el("div", { class: "titles" }, [el("h1", { text: m.title }), el("p", { text: m.blurb })]);
  const actions = el("div", { class: "panel-actions" }, [
    el("button", { class: "btn btn-ghost", onClick: () => resetPanelInputs() }, "Reset"),
    el("button", { class: "btn btn-secondary", onClick: () => saveScenarioDialog() },
      [el("span", { html: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h8l2 2v8H3z"/><path d="M6 3v3h4M6 13v-3h4v3"/></svg>` }), "Save scenario"]),
  ]);
  head.append(el("div", { style: "display:grid;gap:10px" }, [back, titles]), actions);

  const layout = el("div", { class: "panel-grid" });
  const aside = el("aside", { class: "inputs" });
  const results = el("section", { class: "results" });
  panelResultsMount = results;

  const recompute = debounce(() => computeAndRender(m, inputs, results, { animate: false }), m.heavy ? 320 : 150);
  const onChange = (key, val) => {
    if (key !== undefined) inputs[key] = val;
    persistWorking();
    recompute();
  };

  if (m.renderInputs) m.renderInputs(aside, inputs, () => onChange());
  else aside.append(renderSchemaForm(m, inputs, onChange));

  layout.append(aside, results);
  v.append(head, layout);

  computeAndRender(m, inputs, results, { animate: true });
}

function resetPanelInputs() {
  state.working[state.panelModule] = clone(DEFAULTS[state.panelModule]);
  saveState();
  renderPanel();
  toast("Inputs reset", "Back to default values.", "info");
}

function saveScenarioDialog() {
  const m = MODULES[state.panelModule];
  const inputs = state.working[state.panelModule];
  const input = el("input", { class: "text-input", type: "text", value: m.smartName(inputs), maxlength: "48", "aria-label": "Scenario name" });
  openModal({
    title: "Save scenario",
    desc: "Give this set of numbers a name. It'll appear on your dashboard and be available to compare.",
    content: el("div", { class: "field" }, [input]),
    actions: [
      { label: "Cancel", variant: "btn-ghost" },
      { label: "Save", variant: "btn-primary", onClick: () => {
        const name = (input.value || "").trim() || m.smartName(inputs);
        state.scenarios.push({ id: uid(), type: m.id, name, createdAt: Date.now(), inputs: clone(inputs) });
        saveState();
        toast("Scenario saved", `"${name}" is on your dashboard.`, "success");
      } },
    ],
    onOpen: () => { input.focus(); input.select(); },
  });
}

function deleteScenario(sc) {
  openModal({
    title: "Delete scenario?",
    desc: `"${sc.name}" will be permanently removed. This can't be undone.`,
    actions: [
      { label: "Cancel", variant: "btn-ghost" },
      { label: "Delete", variant: "btn-danger", onClick: () => {
        state.scenarios = state.scenarios.filter((s) => s.id !== sc.id);
        if (state.compareA === sc.id) state.compareA = null;
        if (state.compareB === sc.id) state.compareB = null;
        saveState(); render();
        toast("Scenario deleted", "", "info");
      } },
    ],
  });
}

function renderCompare() {
  const v = view();
  v.innerHTML = "";
  v.append(el("div", { class: "panel-head" }, [
    el("div", { class: "titles" }, [el("h1", { text: "Compare scenarios" }), el("p", { text: "Put two saved scenarios head to head. Pick scenarios of the same type to get a direct recommendation." })]),
  ]));

  if (state.scenarios.length < 2) {
    v.append(el("div", { class: "empty" }, [
      el("div", { class: "empty-ico", html: `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v16M18 4v16"/><path d="M3 8l3-3 3 3M21 16l-3 3-3-3"/></svg>` }),
      el("h3", { text: "Save at least two scenarios" }),
      el("p", { text: "Comparison needs two saved scenarios. Open a calculator, tune it, and hit Save — then come back here." }),
      el("button", { class: "btn btn-primary", style: "margin-top:8px", onClick: () => navigate("dashboard") }, "Go to calculators"),
    ]));
    return;
  }

  const sorted = state.scenarios.slice().sort((a, b) => b.createdAt - a.createdAt);
  if (!state.compareA || !state.scenarios.find((s) => s.id === state.compareA)) state.compareA = sorted[0].id;
  if (!state.compareB || !state.scenarios.find((s) => s.id === state.compareB)) state.compareB = (sorted.find((s) => s.id !== state.compareA) || sorted[0]).id;

  const makeSelect = (which) => {
    const sel = el("select", { class: "num-input", "aria-label": which === "A" ? "First scenario" : "Second scenario" });
    const byType = {};
    state.scenarios.forEach((s) => { (byType[s.type] = byType[s.type] || []).push(s); });
    Object.keys(byType).forEach((t) => {
      const og = el("optgroup", { label: MODULES[t].title });
      byType[t].forEach((s) => {
        const opt = el("option", { value: s.id, text: s.name });
        if ((which === "A" ? state.compareA : state.compareB) === s.id) opt.setAttribute("selected", "");
        og.append(opt);
      });
      sel.append(og);
    });
    sel.addEventListener("change", () => { if (which === "A") state.compareA = sel.value; else state.compareB = sel.value; renderCompare(); });
    return sel;
  };

  v.append(el("div", { class: "compare-controls" }, [
    el("div", { class: "field" }, [el("div", { class: "field-label", style: "margin-bottom:4px", text: "Scenario A" }), makeSelect("A")]),
    el("div", { class: "compare-vs", text: "vs" }),
    el("div", { class: "field" }, [el("div", { class: "field-label", style: "margin-bottom:4px", text: "Scenario B" }), makeSelect("B")]),
  ]));

  const a = state.scenarios.find((s) => s.id === state.compareA);
  const b = state.scenarios.find((s) => s.id === state.compareB);
  if (!a || !b) return;

  const sameType = a.type === b.type;
  const headline = el("div", { class: "compare-headline" });
  if (sameType) {
    const m = MODULES[a.type];
    const ra = m.compute(a.inputs), rb = m.compute(b.inputs);
    const ka = m.kpi(ra, a.inputs), kb = m.kpi(rb, b.inputs);
    const better = ka.betterIsLower ? (ka.value <= kb.value ? "a" : "b") : (ka.value >= kb.value ? "a" : "b");
    const winner = better === "a" ? a : b;
    const wv = better === "a" ? ka.value : kb.value;
    const lv = better === "a" ? kb.value : ka.value;
    const diff = Math.abs(ka.value - kb.value);
    headline.append(el("div", { class: "section-eyebrow", text: "Recommendation" }));
    headline.append(el("div", { class: "big", html: `<strong>${winner.name}</strong> wins on ${ka.label}` }));
    headline.append(el("p", { style: "color:var(--text-muted)", html: `${ka.format(wv)} vs ${ka.format(lv)} — a difference of <strong>${ka.format(diff)}</strong> ${ka.betterIsLower ? "less" : "more"}.` }));
  } else {
    headline.append(el("div", { class: "section-eyebrow", text: "Different types" }));
    headline.append(el("div", { class: "big", text: `${MODULES[a.type].title} vs ${MODULES[b.type].title}` }));
    headline.append(el("p", { style: "color:var(--text-muted)", text: "These scenarios use different calculators, so there's no single winner — each is shown on its own below." }));
  }
  v.append(headline);

  const grid = el("div", { class: "compare-grid" });
  [a, b].forEach((sc, idx) => {
    const m = MODULES[sc.type];
    const col = el("div", { class: "compare-col" });
    col.append(el("h3", {}, [el("span", { class: "saved-dot", style: `background:${idx === 0 ? "var(--series-a)" : "var(--series-b)"}` }), sc.name]));
    const mount = el("div", { style: "display:grid;gap:16px" });
    col.append(mount);
    if (m.heavy) {
      mount.append(loadingCard("Simulating…"));
      setTimeout(() => { const r = m.compute(sc.inputs); renderResults(m, sc.inputs, r, mount, { animate: true, compact: true }); }, 30);
    } else {
      const r = m.compute(sc.inputs);
      renderResults(m, sc.inputs, r, mount, { animate: true, compact: true });
    }
    grid.append(col);
  });
  v.append(grid);
}

function renderSettings() {
  const v = view();
  v.innerHTML = "";
  v.append(el("div", { class: "panel-head" }, [
    el("div", { class: "titles" }, [el("h1", { text: "Settings" }), el("p", { text: "Preferences, backups, and data — all stored locally on this device." })]),
  ]));

  const stack = el("div", { class: "settings-stack" });

  const themeSeg = el("div", { class: "segmented", role: "group", "aria-label": "Theme" });
  [["light", "Light"], ["dark", "Dark"], ["system", "System"]].forEach(([val, label]) => {
    const b = el("button", { type: "button", "aria-pressed": String(state.settings.theme === val), text: label });
    b.addEventListener("click", () => { state.settings.theme = val; applyTheme(); saveState(); renderSettings(); syncThemeToggle(); });
    themeSeg.append(b);
  });
  stack.append(settingRow("Appearance", "Choose a light or dark theme, or follow your system setting.", themeSeg));

  const curSel = el("select", { class: "num-input", style: "width:auto", "aria-label": "Currency" });
  Object.keys(CURRENCIES).forEach((c) => { const o = el("option", { value: c, text: `${c} (${CURRENCIES[c].symbol})` }); if (state.settings.currency === c) o.setAttribute("selected", ""); curSel.append(o); });
  curSel.addEventListener("change", () => { state.settings.currency = curSel.value; saveState(); toast("Currency updated", `Now showing ${curSel.value}.`, "success"); });
  stack.append(settingRow("Currency", "The symbol and formatting used across all calculators.", curSel));

  stack.append(settingRow("Backup & restore", "Export your scenarios and settings to a JSON file, or import a previous backup. There's no cloud — this is how you move data between devices.",
    el("div", { class: "setting-actions" }, [
      el("button", { class: "btn btn-secondary", onClick: exportData }, "Export JSON"),
      el("button", { class: "btn btn-secondary", onClick: () => $("#import-file").click() }, "Import JSON"),
    ])));

  stack.append(settingRow("Reset to defaults", "Restore the original sample scenarios and clear your changes. This cannot be undone.",
    el("div", { class: "setting-actions" }, [el("button", { class: "btn btn-danger", onClick: confirmReset }, "Reset everything")])));

  let used = 0;
  try { used = new Blob([localStorage.getItem(STORAGE_KEY) || ""]).size; } catch (e) {}
  stack.append(settingRow("Storage", `${state.scenarios.length} saved scenario${state.scenarios.length === 1 ? "" : "s"} · about ${(used / 1024).toFixed(1)} KB used in this browser.`,
    el("span", { class: "privacy-badge" }, [el("span", { html: `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M8 1.5 3 3.5v3.2c0 3 2.1 5.8 5 6.8 2.9-1 5-3.8 5-6.8V3.5L8 1.5Z"/><path d="m5.8 8 1.5 1.5L10.4 6" stroke-linecap="round"/></svg>` }), el("span", { text: "Local only" })])));

  v.append(stack);
  v.append(el("footer", { class: "app-footer" }, [el("span", { text: "Crossroads · Educational estimates, not financial advice." }), el("span", { class: "mono", text: "v1.0" })]));
}
function settingRow(title, desc, control) {
  return el("div", { class: "setting-row" }, [
    el("div", { class: "meta" }, [el("h4", { text: title }), el("p", { text: desc })]),
    control,
  ]);
}

function confirmReset() {
  openModal({
    title: "Reset everything?",
    desc: "All your saved scenarios and changes will be replaced with the original samples. This can't be undone.",
    actions: [
      { label: "Cancel", variant: "btn-ghost" },
      { label: "Reset", variant: "btn-danger", onClick: () => {
        state.scenarios = seedScenarios();
        state.working = defaultWorking();
        const theme = state.settings.theme, cur = state.settings.currency;
        state.settings = { ...defaultSettings, theme, currency: cur };
        saveState(); navigate("dashboard");
        toast("Reset complete", "Sample scenarios restored.", "success");
      } },
    ],
  });
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportData() {
  const payload = { app: "Crossroads", version: 1, exportedAt: new Date().toISOString(), settings: state.settings, scenarios: state.scenarios };
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(JSON.stringify(payload, null, 2), `crossroads-backup-${date}.json`, "application/json");
  toast("Exported", "Your backup file is downloading.", "success");
}
function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const scenarios = Array.isArray(data.scenarios) ? data.scenarios.filter((s) => s && MODULES[s.type] && s.inputs) : null;
      if (!scenarios) throw new Error("No valid scenarios found");
      state.scenarios = scenarios.map((s) => ({ id: s.id || uid(), type: s.type, name: s.name || MODULES[s.type].smartName(s.inputs), createdAt: s.createdAt || Date.now(), inputs: s.inputs }));
      if (data.settings) state.settings = { ...defaultSettings, ...data.settings };
      saveState(); applyTheme(); syncThemeToggle(); navigate("dashboard");
      toast("Import complete", `${state.scenarios.length} scenario${state.scenarios.length === 1 ? "" : "s"} loaded.`, "success");
    } catch (e) {
      toast("Import failed", "That file doesn't look like a Crossroads backup.", "error");
    }
  };
  reader.onerror = () => toast("Import failed", "Could not read the file.", "error");
  reader.readAsText(file);
}
function downloadLoanCSV(r) {
  let csv = "Month,Payment,Principal,Interest,Balance\n";
  r.sched.rows.forEach((row) => { csv += `${row.month},${row.payment.toFixed(2)},${row.principal.toFixed(2)},${row.interest.toFixed(2)},${row.balance.toFixed(2)}\n`; });
  downloadBlob(csv, "crossroads-amortization.csv", "text/csv");
  toast("Schedule exported", "CSV downloading.", "success");
}

const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
function resolveTheme() { return state.settings.theme === "system" ? (systemDark() ? "dark" : "light") : state.settings.theme; }
function applyTheme() { document.documentElement.setAttribute("data-theme", resolveTheme()); }
function syncThemeToggle() {
  const t = $("#theme-toggle");
  if (t) t.setAttribute("aria-pressed", String(resolveTheme() === "dark"));
}

function setHash(h) { if (location.hash !== "#" + h) history.replaceState(null, "", "#" + h); }
function navigate(v) {
  state.view = v; state.panelModule = null;
  setHash(v);
  render();
}
function render() {
  if (state.view === "panel" && state.panelModule) renderPanel();
  else if (state.view === "compare") renderCompare();
  else if (state.view === "settings") renderSettings();
  else { state.view = "dashboard"; renderDashboard(); }
  updateNav();
  view().focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
}
function updateNav() {
  const active = state.view === "panel" ? "dashboard" : state.view;
  $$("[data-nav]").forEach((b) => {
    const on = b.dataset.nav === active;
    if (b.classList.contains("nav-btn") || b.classList.contains("tab-btn")) {
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    }
  });
}

function parseHash() {
  const h = location.hash.replace(/^#/, "");
  if (h.startsWith("m/")) { const id = h.slice(2); if (MODULES[id]) { state.view = "panel"; state.panelModule = id; return; } }
  if (["compare", "settings", "dashboard"].includes(h)) { state.view = h; return; }
  state.view = "dashboard";
}

function init() {
  loadState();
  applyTheme();

  $$("[data-nav]").forEach((b) => b.addEventListener("click", (e) => {
    e.preventDefault();
    navigate(b.dataset.nav);
  }));

  const toggle = $("#theme-toggle");
  toggle.addEventListener("click", () => {
    state.settings.theme = resolveTheme() === "dark" ? "light" : "dark";
    applyTheme(); syncThemeToggle(); saveState();
  });
  syncThemeToggle();

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (state.settings.theme === "system") { applyTheme(); syncThemeToggle(); }
  });

  $("#import-file").addEventListener("change", (e) => { const f = e.target.files[0]; if (f) importData(f); e.target.value = ""; });

  parseHash();
  window.addEventListener("hashchange", () => { const prev = state.view; parseHash(); if (state.view !== prev || state.view === "panel") render(); });

  render();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();

})();
