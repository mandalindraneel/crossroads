/* Crossroads — Copyright (c) 2026 Indraneel Mandal. All Rights Reserved. */
"use strict";

(() => {

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const NS = "http://www.w3.org/2000/svg";
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const uid = () => "s_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const has = (v) => typeof v === "number" && isFinite(v);
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
function svgEl(tag, attrs = {}) { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v); return n; }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

function randNormal(mean = 0, std = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
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
  USD: { symbol: "$", locale: "en-US" }, EUR: { symbol: "€", locale: "de-DE" },
  GBP: { symbol: "£", locale: "en-GB" }, CAD: { symbol: "CA$", locale: "en-CA" },
  AUD: { symbol: "A$", locale: "en-AU" }, INR: { symbol: "₹", locale: "en-IN" },
  JPY: { symbol: "¥", locale: "ja-JP" },
};
const getCur = () => CURRENCIES[state && state.settings && state.settings.currency] || CURRENCIES.USD;
const CUR_SYMBOL = () => getCur().symbol;
function money(n, decimals = 0) {
  if (!isFinite(n)) n = 0;
  const c = getCur();
  return new Intl.NumberFormat(c.locale, { style: "currency", currency: (state.settings && state.settings.currency) || "USD", maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(n);
}
function compactMoney(n) {
  const sym = getCur().symbol, a = Math.abs(n), sign = n < 0 ? "-" : "";
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
const BUY_CLOSING_PCT = 0.02, SELL_PCT = 0.06;
function computeRentVsBuy(i) {
  const horizonM = Math.round(i.horizonYears * 12);
  const r = i.rate / 100 / 12;
  const nMort = Math.round(i.termYears * 12);
  const loan0 = Math.max(0, i.homePrice - i.downPayment);
  const pmt = amortPayment(loan0, r, nMort);
  const invMo = i.investReturnPct / 100 / 12;
  const apprMo = Math.pow(1 + i.homeAppreciationPct / 100, 1 / 12) - 1;
  const rentMo = Math.pow(1 + i.rentGrowthPct / 100, 1 / 12) - 1;
  let homeValue = i.homePrice, loanBal = loan0, rent = i.monthlyRent, buyerInvest = 0;
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
        const d0 = buyerNW[k - 1] - renterNW[k - 1], d1 = buyerNW[k] - renterNW[k];
        const frac = d0 === d1 ? 0 : (0 - d0) / (d1 - d0);
        breakeven = years[k - 1] + frac * (years[k] - years[k - 1]);
      }
      break;
    }
  }
  const buyerFinal = buyerNW[buyerNW.length - 1], renterFinal = renterNW[renterNW.length - 1];
  return { years, buyerNW, renterNW, breakeven, buyerFinal, renterFinal, monthlyMortgage: pmt, fyBuyerMonthly: fyBuyer / 12, fyRentMonthly: fyRent / 12, advantage: buyerFinal - renterFinal };
}
function simulateDebt(debts, extra, strategy) {
  const work = debts.map((d) => ({ ...d, bal: Math.max(0, d.balance), paidMonth: null }));
  const budget = work.reduce((s, d) => s + d.min, 0) + extra;
  const timeline = [work.reduce((s, d) => s + d.bal, 0)];
  const order = [];
  let month = 0, totalInterest = 0;
  while (work.some((d) => d.bal > 0.005) && month < 1200) {
    month++;
    for (const d of work) if (d.bal > 0.005) { const it = (d.bal * d.apr) / 100 / 12; d.bal += it; totalInterest += it; }
    let pool = budget;
    for (const d of work) if (d.bal > 0.005) { const pay = Math.min(d.min, d.bal, pool); d.bal -= pay; pool -= pay; }
    const targets = work.filter((d) => d.bal > 0.005).sort((a, b) => (strategy === "avalanche" ? b.apr - a.apr : a.bal - b.bal));
    for (const d of targets) { if (pool <= 0.005) break; const pay = Math.min(d.bal, pool); d.bal -= pay; pool -= pay; }
    for (const d of work) if (d.bal <= 0.005 && d.paidMonth === null) { d.bal = 0; d.paidMonth = month; order.push(d.name); }
    timeline.push(work.reduce((s, d) => s + d.bal, 0));
  }
  return { months: month, totalInterest, timeline, order, payable: work.every((d) => d.bal <= 0.005), perDebt: work.map((d) => ({ name: d.name, paidMonth: d.paidMonth })) };
}
function computeDebt(i) {
  const debts = i.debts.filter((d) => d.balance > 0);
  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  return { avalanche: simulateDebt(debts, i.extra, "avalanche"), snowball: simulateDebt(debts, i.extra, "snowball"), debts, totalDebt, extra: i.extra, count: debts.length };
}
function offerEffective(i, k, y, WORKDAYS) {
  const base = i[k + "Base"] * Math.pow(1 + i.raisePct / 100, y - 1);
  const bonus = (base * i[k + "BonusPct"]) / 100;
  const equity = y <= i[k + "VestYears"] ? i[k + "Equity"] / i[k + "VestYears"] : 0;
  const commuteCost = i[k + "CommuteCost"] * 12;
  const hourly = base / 2080;
  const commuteTimeCost = (i[k + "CommuteMins"] / 60) * WORKDAYS * hourly;
  const net = base + bonus + equity + i[k + "Benefits"] - commuteCost - commuteTimeCost;
  return net / (i[k + "Col"] / 100);
}
function computeJob(i) {
  const WORKDAYS = 260, H = Math.round(i.horizonYears);
  const years = [0], cumA = [0], cumB = [0];
  let accA = 0, accB = 0, y1A = 0, y1B = 0;
  for (let y = 1; y <= H; y++) {
    const a = offerEffective(i, "a", y, WORKDAYS), b = offerEffective(i, "b", y, WORKDAYS);
    accA += a; accB += b;
    years.push(y); cumA.push(accA); cumB.push(accB);
    if (y === 1) { y1A = a; y1B = b; }
  }
  return { years, cumA, cumB, year1A: y1A, year1B: y1B, totalA: accA, totalB: accB };
}
function computeLoan(i) {
  const P = Math.max(0, i.price - i.downPayment), n = Math.round(i.termMonths);
  const sched = amortSchedule(P, i.apr, n);
  const totalInterest = sched.rows.reduce((s, r) => s + r.interest, 0);
  const totalPaid = i.downPayment + sched.rows.reduce((s, r) => s + r.payment, 0);
  const months = [0], balances = [P], cumInt = [0];
  let ci = 0;
  for (const r of sched.rows) { ci += r.interest; months.push(r.month); balances.push(r.balance); cumInt.push(ci); }
  return { P, payment: sched.payment, totalInterest, totalPaid, sched, months, balances, cumInt };
}
function computeRetirement(i) {
  const runs = Math.round(i.runs), yrs = Math.round(i.years), months = yrs * 12;
  const mMean = i.expectedReturnPct / 100 / 12, mStd = i.volatilityPct / 100 / Math.sqrt(12), infl = i.inflationPct / 100;
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
  const years = [], p10 = [], p50 = [], p90 = [], p10r = [], p50r = [], p90r = [];
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
  return { years, p10, p50, p90, p10r, p50r, p90r, finalP10: percentile(fin, 10), finalP50: percentile(fin, 50), finalP90: percentile(fin, 90), realP50: percentile(fin, 50) / realFactor, goalProb, runs, totalContributed: i.currentSavings + i.monthlyContribution * months };
}
function retirementQuick(i) {
  const months = Math.round(i.years) * 12, r = i.expectedReturnPct / 100 / 12;
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
  let dMin = yData.length ? Math.min(...yData) : 0, dMax = yData.length ? Math.max(...yData) : 1;
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
    lbl.textContent = yTickFmt(t); svg.append(lbl);
  });
  const step = Math.max(1, Math.ceil((n - 1) / 6)), xIdx = [];
  for (let k = 0; k < n; k += step) xIdx.push(k);
  if (xIdx[xIdx.length - 1] !== n - 1) xIdx.push(n - 1);
  svg.append(svgEl("line", { class: "chart-axis-line", x1: pad.l, x2: W - pad.r, y1: sy(yMin), y2: sy(yMin) }));
  xIdx.forEach((k) => {
    const lbl = svgEl("text", { class: "chart-tick", x: sx(xs[k]), y: H - pad.b + 18, "text-anchor": "middle" });
    lbl.textContent = xTickFmt(xs[k]); svg.append(lbl);
  });
  (cfg.bands || []).forEach((b) => {
    let up = "", lo = "";
    for (let k = 0; k < n; k++) up += `${k === 0 ? "M" : "L"}${sx(xs[k]).toFixed(2)} ${sy(b.upper[k]).toFixed(2)} `;
    for (let k = n - 1; k >= 0; k--) lo += `L${sx(xs[k]).toFixed(2)} ${sy(b.lower[k]).toFixed(2)} `;
    svg.append(svgEl("path", { class: "chart-band animate", d: up + lo + "Z", fill: b.color }));
    [b.upper, b.lower].forEach((edge) => {
      let d = "";
      for (let k = 0; k < n; k++) d += `${k === 0 ? "M" : "L"}${sx(xs[k]).toFixed(2)} ${sy(edge[k]).toFixed(2)} `;
      svg.append(svgEl("path", { class: "chart-band-edge", d, stroke: b.color }));
    });
  });
  const linePaths = [];
  (cfg.series || []).forEach((s) => {
    let d = "";
    for (let k = 0; k < n; k++) { const v = s.values[k]; if (v == null || !isFinite(v)) continue; d += `${d === "" ? "M" : "L"}${sx(xs[k]).toFixed(2)} ${sy(v).toFixed(2)} `; }
    const p = svgEl("path", { class: "chart-line animate" + (s.dashed ? " dashed" : ""), d, stroke: s.color });
    svg.append(p); linePaths.push(p);
  });
  (cfg.markers || []).forEach((m) => {
    const x = sx(m.x);
    if (m.line !== false) svg.append(svgEl("line", { class: "chart-marker-line", x1: x, x2: x, y1: pad.t, y2: pad.t + plotH }));
    svg.append(svgEl("circle", { class: "chart-marker-dot", cx: x, cy: sy(m.y), r: 5, fill: m.color || "var(--primary)" }));
    if (m.label) {
      const t = svgEl("text", { class: "chart-tick", x: clamp(x, pad.l + 40, W - pad.r - 40), y: pad.t + 12, "text-anchor": "middle", fill: m.color || "var(--text-muted)" });
      t.style.fontWeight = "600"; t.textContent = m.label; svg.append(t);
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
    cursor.setAttribute("x1", px); cursor.setAttribute("x2", px); cursor.style.opacity = 1;
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
  const hide = () => { cursor.style.opacity = 0; tip.style.opacity = 0; dotsG.innerHTML = ""; };
  const onMove = (e) => {
    const rect = svg.getBoundingClientRect();
    let frac = ((((e.clientX - rect.left) / rect.width) * W) - pad.l) / plotW;
    showAt(Math.round(clamp(frac, 0, 1) * (n - 1)));
  };
  svg.addEventListener("mousemove", onMove);
  svg.addEventListener("mouseleave", hide);
  svg.addEventListener("touchstart", (e) => { if (e.touches[0]) onMove(e.touches[0]); }, { passive: true });
  svg.addEventListener("touchmove", (e) => { if (e.touches[0]) onMove(e.touches[0]); }, { passive: true });
  if (cfg.animate !== false && !reducedMotion()) {
    requestAnimationFrame(() => { linePaths.forEach((p) => { try { p.style.setProperty("--len", p.getTotalLength()); } catch (e) { p.classList.remove("animate"); } }); });
  } else {
    linePaths.forEach((p) => p.classList.remove("animate"));
    $$(".chart-band", svg).forEach((b) => b.classList.remove("animate"));
  }
  const table = el("table", { class: "sr-only" });
  table.append(el("thead", {}, el("tr", {}, [el("th", { text: cfg.xLabel || "X" }), ...(cfg.series || []).map((s) => el("th", { text: s.name })), ...(cfg.bands || []).flatMap((b) => [el("th", { text: b.name + " low" }), el("th", { text: b.name + " high" })])])));
  const tb = el("tbody");
  xIdx.forEach((k) => { tb.append(el("tr", {}, [el("td", { text: xFmt(xs[k]) }), ...(cfg.series || []).map((s) => el("td", { text: yFmt(s.values[k]) })), ...(cfg.bands || []).flatMap((b) => [el("td", { text: yFmt(b.lower[k]) }), el("td", { text: yFmt(b.upper[k]) })])])); });
  table.append(tb); wrap.append(table);
  return wrap;
}
function legend(items) {
  return el("div", { class: "chart-legend" }, items.map((it) => el("span", { class: "legend-item" }, [el("span", { class: "legend-swatch" + (it.dashed ? " dashed" : ""), style: `background:${it.color};color:${it.color}` }), it.name])));
}

const TOAST_ICONS = {
  success: `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m4 10.5 4 4 8-9"/></svg>`,
  error: `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l8 8M14 6l-8 8"/></svg>`,
  info: `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 9v5M10 6h.01"/><circle cx="10" cy="10" r="7.5"/></svg>`,
};
function toast(title, msg = "", type = "info") {
  const node = el("div", { class: `toast ${type}`, role: "status" }, [
    el("span", { class: "toast-ico", html: TOAST_ICONS[type] || TOAST_ICONS.info }),
    el("div", { class: "toast-body" }, [el("div", { class: "toast-title", text: title }), msg ? el("div", { class: "toast-msg", text: msg }) : null]),
  ]);
  $("#toast-region").append(node);
  setTimeout(() => { node.classList.add("leaving"); setTimeout(() => node.remove(), 260); }, 3800);
}
let lastFocused = null;
function openModal({ title, desc, content, actions = [], onOpen }) {
  const root = $("#modal-root");
  lastFocused = document.activeElement;
  const overlay = el("div", { class: "modal-overlay" });
  const modal = el("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": title });
  if (title) modal.append(el("h3", { text: title }));
  if (desc) modal.append(el("p", { text: desc }));
  if (content) modal.append(content);
  if (actions.length) {
    const actRow = el("div", { class: "modal-actions" });
    actions.forEach((a) => actRow.append(el("button", { class: `btn ${a.variant || "btn-secondary"}`, type: "button", onClick: () => { const keep = a.onClick && a.onClick(); if (keep !== true) closeModal(); } }, a.label)));
    modal.append(actRow);
  }
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

const ICONS = {
  rentvsbuy: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9h14v-9"/><path d="M10 19v-5h4v5"/></svg>`,
  debtpayoff: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Z"/><path d="M4 7v5c0 1.7 3.6 3 8 3s8-1.3 8-3V7"/><path d="M4 12v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5"/></svg>`,
  jobcomparison: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/></svg>`,
  loan: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16.5 5.5 11A2 2 0 0 1 7.4 9.5h9.2a2 2 0 0 1 1.9 1.5L20 16.5"/><path d="M3 16.5h18v2.5h-2v-1H5v1H3z"/><circle cx="7.5" cy="16.5" r="1.4"/><circle cx="16.5" cy="16.5" r="1.4"/></svg>`,
  retirement: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5v14h16"/><path d="M7 15l3.5-4 3 2.5L20 7"/><path d="M16 7h4v4"/></svg>`,
  bulb: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.5.4.9 1 1 1.7h5.2c.1-.7.5-1.3 1-1.7A6 6 0 0 0 12 3Z"/></svg>`,
  arrow: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h9M9 4l4 4-4 4"/></svg>`,
  shield: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M8 1.5 3 3.5v3.2c0 3 2.1 5.8 5 6.8 2.9-1 5-3.8 5-6.8V3.5L8 1.5Z"/><path d="m5.8 8 1.5 1.5L10.4 6" stroke-linecap="round"/></svg>`,
  plus: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>`,
  trash: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h10M6 4V3h4v1M5 4l.5 9h5L11 4"/></svg>`,
  download: `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v8M5 7l3 3 3-3"/><path d="M3 13h10"/></svg>`,
  upload: `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 10V2M5 5l3-3 3 3"/><path d="M3 13h10"/></svg>`,
  back: `<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3 5 8l5 5"/></svg>`,
  save: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h8l2 2v8H3z"/><path d="M6 3v3h4M6 13v-3h4v3"/></svg>`,
};

function stat(label, value, opts = {}) {
  const { sub, tone, help, num, format } = opts;
  const valEl = el("div", { class: "stat-value" + (tone ? " " + tone : "") });
  const node = el("div", { class: "stat" }, [
    el("div", { class: "stat-label" }, [label, infoTip(help)]),
    valEl,
    sub ? el("div", { class: "stat-sub", text: sub }) : null,
  ]);
  node._animate = (animate) => {
    if (num != null && format && animate && !reducedMotion()) {
      const dur = 560, start = performance.now();
      const tick = (t) => { const p = Math.min(1, (t - start) / dur), e = 1 - Math.pow(1 - p, 3); valEl.textContent = format(num * e); if (p < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    } else valEl.textContent = num != null && format ? format(num) : value;
  };
  return node;
}

function stepDecimals(step) { const s = String(step); return s.includes(".") ? s.split(".")[1].length : 0; }
function fmtFieldValue(field, v) {
  if (field.type === "currency") return String(Math.round(v));
  const d = stepDecimals(field.step || 1);
  return d ? String(Number(v).toFixed(d)) : String(Math.round(v));
}
function fieldPrefix(field) { return field.prefix || (field.type === "currency" ? CUR_SYMBOL() : null); }
function infoTip(text) {
  if (!text) return null;
  return el("button", { class: "info", type: "button", "aria-label": "More info", dataset: { tip: text }, tabindex: "0", onClick: (e) => e.preventDefault() }, "i");
}
function renderField(field, inputs, onChange) {
  const id = nextId();
  const val = inputs[field.key];
  const hasVal = has(val);
  const prefix = fieldPrefix(field);
  const number = el("input", { type: "number", id, class: "num-input" + (prefix ? " has-prefix" : "") + (field.suffix ? " has-suffix" : ""), value: hasVal ? fmtFieldValue(field, val) : "", placeholder: field.placeholder || "", min: field.min, max: field.max, step: field.step, inputmode: "decimal", "aria-label": field.label });
  const inputWrap = el("div", { class: "input-wrap" }, [prefix ? el("span", { class: "input-prefix", text: prefix }) : null, number, field.suffix ? el("span", { class: "input-suffix", text: field.suffix }) : null]);
  const wrap = el("div", { class: "field" }, [el("div", { class: "field-top" }, [el("label", { class: "field-label", for: id }, [field.label, infoTip(field.help)]), inputWrap])]);
  const slider = el("input", { type: "range", min: field.min, max: field.max, step: field.step, value: hasVal ? val : field.min, class: hasVal ? "" : "untouched", "aria-label": field.label + " slider", tabindex: "0" });
  wrap.append(slider);
  const setFill = () => { const p = ((Number(slider.value) - field.min) / (field.max - field.min)) * 100; slider.style.setProperty("--_fill", clamp(p, 0, 100) + "%"); };
  setFill();
  slider.addEventListener("input", () => { number.value = fmtFieldValue(field, Number(slider.value)); number.classList.remove("invalid"); slider.classList.remove("untouched"); setFill(); onChange(field.key, Number(slider.value)); });
  number.addEventListener("input", () => {
    if (number.value.trim() === "") { number.classList.remove("invalid"); slider.value = field.min; slider.classList.add("untouched"); setFill(); onChange(field.key, null); return; }
    const v = parseFloat(number.value);
    if (isNaN(v)) { number.classList.add("invalid"); return; }
    number.classList.remove("invalid");
    const cl = clamp(v, field.min, field.max);
    slider.value = cl; slider.classList.remove("untouched"); setFill(); onChange(field.key, cl);
  });
  number.addEventListener("blur", () => {
    if (number.value.trim() === "") return;
    let v = parseFloat(number.value);
    if (isNaN(v)) { onChange(field.key, null); return; }
    const cl = clamp(v, field.min, field.max);
    number.value = fmtFieldValue(field, cl); number.classList.remove("invalid"); slider.value = cl; setFill();
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
  const prefix = opts.prefix || (opts.type === "currency" ? CUR_SYMBOL() : null);
  const inp = el("input", { type: "number", class: "num-input" + (prefix ? " has-prefix" : "") + (opts.suffix ? " has-suffix" : ""), value: has(value) ? (opts.type === "currency" ? Math.round(value) : value) : "", placeholder: opts.placeholder || "", min: opts.min, max: opts.max, step: opts.step, inputmode: "decimal", "aria-label": opts.aria });
  inp.addEventListener("input", () => {
    if (inp.value.trim() === "") { inp.classList.remove("invalid"); onInput(null); return; }
    const v = parseFloat(inp.value);
    if (isNaN(v)) { inp.classList.add("invalid"); return; }
    inp.classList.remove("invalid"); onInput(clamp(v, opts.min, opts.max));
  });
  inp.addEventListener("blur", () => { if (inp.value.trim() === "") return; let v = parseFloat(inp.value); if (isNaN(v)) { onInput(null); return; } inp.value = clamp(v, opts.min, opts.max); inp.classList.remove("invalid"); });
  return el("div", { class: "input-wrap" }, [prefix ? el("span", { class: "input-prefix", text: prefix }) : null, inp, opts.suffix ? el("span", { class: "input-suffix", text: opts.suffix }) : null]);
}
function renderDebtRows(list, inputs, onChange) {
  list.innerHTML = "";
  if (inputs.debts.length === 0) { list.append(el("div", { class: "debt-empty", text: "No debts yet — add your first one below." })); return; }
  inputs.debts.forEach((d, idx) => {
    const row = el("div", { class: "debt-row" });
    const name = el("input", { class: "text-input", type: "text", value: d.name || "", placeholder: `Debt ${idx + 1}`, maxlength: "28", "aria-label": "Debt name" });
    name.addEventListener("input", () => { d.name = name.value; persistWorking(); });
    const rm = el("button", { class: "debt-remove", type: "button", "aria-label": "Remove debt", onClick: () => { inputs.debts.splice(idx, 1); renderDebtRows(list, inputs, onChange); onChange(); } }, [el("span", { html: ICONS.trash })]);
    row.append(el("div", { class: "debt-row-top" }, [name, rm]));
    const grid = el("div", { class: "debt-row-grid" });
    const mk = (label, key, opts) => el("div", { class: "debt-mini" }, [el("div", { class: "debt-mini-label", text: label }), numberCell(d[key], { ...opts, aria: label }, (v) => { d[key] = v; onChange(); })]);
    grid.append(
      mk("Balance", "balance", { type: "currency", min: 0, max: 2000000, step: 100, placeholder: "5,000" }),
      mk("APR", "apr", { type: "percent", min: 0, max: 60, step: 0.1, suffix: "%", placeholder: "19.9" }),
      mk("Min / mo", "min", { type: "currency", min: 0, max: 20000, step: 10, placeholder: "150" }),
    );
    row.append(grid); list.append(row);
  });
}

const MODULES = {
  rentvsbuy: {
    id: "rentvsbuy", title: "Rent vs. Buy", accent: "var(--series-a)", icon: ICONS.rentvsbuy,
    blurb: "Should you buy a home or keep renting and invest the difference? See net worth on both paths and the year they cross.",
    fields: [
      { key: "homePrice", label: "Home price", type: "currency", min: 50000, max: 3000000, step: 5000, group: "The home", placeholder: "450,000" },
      { key: "downPayment", label: "Down payment", type: "currency", min: 0, max: 1500000, step: 5000, group: "The home", placeholder: "90,000" },
      { key: "rate", label: "Mortgage rate", type: "percent", min: 0, max: 12, step: 0.05, suffix: "%", group: "The home", placeholder: "6.5", help: "Annual interest rate on the mortgage." },
      { key: "termYears", label: "Loan term", type: "number", min: 5, max: 40, step: 1, suffix: "yrs", group: "The home", placeholder: "30" },
      { key: "homeAppreciationPct", label: "Home appreciation", type: "percent", min: -3, max: 10, step: 0.1, suffix: "%/yr", group: "The home", placeholder: "3.5", help: "Expected yearly change in the home's value." },
      { key: "propertyTaxPct", label: "Property tax", type: "percent", min: 0, max: 4, step: 0.05, suffix: "%/yr", group: "Ongoing costs", placeholder: "1.1", help: "Annual property tax as a % of home value." },
      { key: "maintenancePct", label: "Maintenance", type: "percent", min: 0, max: 5, step: 0.1, suffix: "%/yr", group: "Ongoing costs", placeholder: "1.0", help: "Annual upkeep & insurance as a % of home value." },
      { key: "monthlyRent", label: "Monthly rent", type: "currency", min: 200, max: 15000, step: 50, group: "Renting & investing", placeholder: "2,200" },
      { key: "rentGrowthPct", label: "Rent growth", type: "percent", min: 0, max: 10, step: 0.1, suffix: "%/yr", group: "Renting & investing", placeholder: "3.0" },
      { key: "investReturnPct", label: "Investment return", type: "percent", min: 0, max: 12, step: 0.1, suffix: "%/yr", group: "Renting & investing", placeholder: "6.0", help: "Return earned on money not spent on housing." },
      { key: "horizonYears", label: "Time horizon", type: "number", min: 1, max: 40, step: 1, suffix: "yrs", group: "Horizon", placeholder: "10" },
    ],
    compute: computeRentVsBuy,
    metrics(r, i) {
      const buyAhead = r.advantage >= 0;
      return [
        stat("Buy — net worth", null, { num: r.buyerFinal, format: money, tone: "tone-a", sub: `after ${i.horizonYears} years` }),
        stat("Rent — net worth", null, { num: r.renterFinal, format: money, tone: "tone-b", sub: `after ${i.horizonYears} years` }),
        stat("Breakeven", r.breakeven == null ? "Beyond horizon" : (r.breakeven < 0.08 ? "Immediate" : `Year ${r.breakeven.toFixed(1)}`), { sub: r.breakeven == null ? "renting stays ahead" : "buying overtakes renting" }),
        stat(buyAhead ? "Buying wins by" : "Renting wins by", null, { num: Math.abs(r.advantage), format: money, tone: buyAhead ? "tone-pos" : "tone-neg", sub: "net worth at horizon" }),
      ];
    },
    chart(r) {
      const markers = [];
      if (r.breakeven != null && r.breakeven > 0.05) {
        const k = Math.ceil(r.breakeven), k0 = Math.max(0, k - 1), f = r.breakeven - k0;
        const y = r.buyerNW[k0] + (r.buyerNW[Math.min(k, r.buyerNW.length - 1)] - r.buyerNW[k0]) * f;
        markers.push({ x: r.breakeven, y, label: `Breakeven · Yr ${r.breakeven.toFixed(1)}`, color: "var(--series-a)" });
      }
      return { xValues: r.years, xLabel: "Year", xTickFormat: (y) => `${y}`, xFormat: (y) => (y === 0 ? "Today" : `Year ${y}`), series: [{ name: "Buy", color: "var(--series-a)", values: r.buyerNW }, { name: "Rent + invest", color: "var(--series-b)", values: r.renterNW }], markers };
    },
    chartTitle: "Net worth over time",
    summary(r, i) {
      const buyAhead = r.advantage >= 0;
      const be = r.breakeven == null ? `Within your ${i.horizonYears}-year horizon, <strong>renting and investing stays ahead</strong> — buying never catches up.` : (r.breakeven < 0.08 ? `Buying is ahead from <strong>day one</strong> at these assumptions.` : `Buying overtakes renting at roughly <strong>year ${r.breakeven.toFixed(1)}</strong>. Before that point, renting and investing the difference leaves you wealthier.`);
      const verdict = buyAhead ? `If you'll stay at least ${r.breakeven == null ? i.horizonYears : Math.ceil(r.breakeven)} years, buying looks like the stronger move.` : `If your horizon is around ${i.horizonYears} years, renting and investing looks stronger here.`;
      return `<span class="verdict">${buyAhead ? "Edge: Buying" : "Edge: Renting"}</span><p>${be} By year ${i.horizonYears}, the buyer's net worth is <strong>${money(r.buyerFinal)}</strong> versus <strong>${money(r.renterFinal)}</strong> for the renter — a gap of <strong>${money(Math.abs(r.advantage))}</strong>.</p><p>${verdict} This assumes a ${pct(i.investReturnPct)} investment return, ${pct(i.homeAppreciationPct)} home appreciation, ${Math.round(BUY_CLOSING_PCT * 100)}% buying costs, and a ${Math.round(SELL_PCT * 100)}% cost to sell. First-year housing runs about <strong>${money(r.fyBuyerMonthly)}/mo</strong> to own vs <strong>${money(r.fyRentMonthly)}/mo</strong> to rent.</p>`;
    },
    kpi: (r) => ({ label: "buying advantage at horizon", value: r.advantage, format: money, betterIsLower: false }),
    cardStat(i) { const r = computeRentVsBuy(i); return `${r.advantage >= 0 ? "Buying" : "Renting"} ahead by ${compactMoney(Math.abs(r.advantage))} · ${i.horizonYears}y`; },
    smartName: (i) => `Home @ ${compactMoney(i.homePrice)}`,
  },

  debtpayoff: {
    id: "debtpayoff", title: "Debt Payoff", accent: "var(--series-c)", icon: ICONS.debtpayoff,
    blurb: "List your debts and compare the Avalanche and Snowball strategies — payoff date, total interest, and the road to zero.",
    compute: computeDebt,
    isComplete: (i) => i.debts.some((d) => has(d.balance) && d.balance > 0 && has(d.apr) && has(d.min) && d.min > 0),
    resolve: (i) => ({ debts: i.debts.filter((d) => has(d.balance) && d.balance > 0 && has(d.apr) && has(d.min) && d.min > 0).map((d) => ({ name: d.name || "Debt", balance: d.balance, apr: d.apr, min: d.min })), extra: has(i.extra) ? i.extra : 0 }),
    missing: (i) => (i.debts.some((d) => has(d.balance) && d.balance > 0 && has(d.apr) && has(d.min) && d.min > 0) ? [] : ["at least one debt with a balance, APR, and minimum payment"]),
    renderInputs(container, inputs, onChange) {
      container.innerHTML = "";
      const group = el("div", { class: "field-group" });
      group.append(el("div", { class: "field-group-label", text: "Your debts" }));
      const list = el("div", { class: "debt-list" });
      group.append(list);
      const addBtn = el("button", { class: "btn btn-secondary btn-sm btn-block", type: "button" }, [el("span", { html: ICONS.plus }), "Add a debt"]);
      addBtn.addEventListener("click", () => { inputs.debts.push({ name: "", balance: null, apr: null, min: null }); renderDebtRows(list, inputs, onChange); onChange(); });
      group.append(addBtn);
      container.append(group);
      const g2 = el("div", { class: "field-group" });
      g2.append(el("div", { class: "field-group-label", text: "Acceleration" }));
      g2.append(renderField({ key: "extra", label: "Extra monthly payment", type: "currency", min: 0, max: 5000, step: 25, placeholder: "0", help: "Paid on top of all minimums, sent to the target debt." }, inputs, (k, v) => { inputs.extra = v; onChange(); }));
      container.append(g2);
      renderDebtRows(list, inputs, onChange);
    },
    metrics(r) {
      if (!r.payable) return [stat("Total debt", null, { num: r.totalDebt, format: money, tone: "tone-warn" }), stat("Status", "Not payable", { tone: "tone-neg", sub: "payments don't cover interest" }), stat("Active debts", String(r.count), {})];
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
      return { xValues: Array.from({ length: len }, (_, k) => k), xLabel: "Months", xTickFormat: (m) => `${m}`, xFormat: (m) => `Month ${m}`, yMin: 0, series: [{ name: "Avalanche", color: "var(--series-a)", values: pad(r.avalanche.timeline) }, { name: "Snowball", color: "var(--series-b)", values: pad(r.snowball.timeline), dashed: true }] };
    },
    chartTitle: "Balance to zero",
    summary(r) {
      if (r.count === 0) return `<p>Add at least one debt to see a payoff plan.</p>`;
      if (!r.payable) return `<span class="verdict" style="background:var(--danger-soft);color:var(--danger);border-color:rgba(251,113,133,.3)">Heads up</span><p>With <strong>${money(r.extra)}/mo</strong> extra, the payments don't outpace the interest on <strong>${money(r.totalDebt)}</strong> of debt, so the balance never reaches zero. Try increasing the extra payment or the minimums.</p>`;
      const saved = r.snowball.totalInterest - r.avalanche.totalInterest, faster = r.snowball.months - r.avalanche.months;
      return `<span class="verdict">Recommended: Avalanche</span><p><strong>Avalanche</strong> (highest APR first) clears everything in <strong>${ym(r.avalanche.months)}</strong> with <strong>${money(r.avalanche.totalInterest)}</strong> of interest — about <strong>${money(Math.max(0, saved))}</strong> less than Snowball${faster > 0 ? ` and ${faster} month${faster > 1 ? "s" : ""} sooner` : ""}.</p><p><strong>Snowball</strong> (smallest balance first) costs a little more but delivers quick wins as small debts vanish — useful if you need the motivation. Either way, the <strong>${money(r.extra)}/mo</strong> extra is what does the heavy lifting.</p>`;
    },
    extras(r, i, container) {
      if (r.count === 0) return;
      const strat = state.ui.debtStrategy, data = strat === "snowball" ? r.snowball : r.avalanche;
      const card = el("div", { class: "card card-pad" });
      const tabs = el("div", { class: "tabs", role: "tablist" });
      ["avalanche", "snowball"].forEach((s) => { const t = el("button", { class: "tab", role: "tab", "aria-selected": String(s === strat), text: s[0].toUpperCase() + s.slice(1) }); t.addEventListener("click", () => { state.ui.debtStrategy = s; rerenderFromCache(); }); tabs.append(t); });
      card.append(el("div", { class: "card-h" }, [el("h3", { text: "Payoff order" }), tabs]));
      const ol = el("div", { class: "debt-list" });
      data.perDebt.slice().sort((a, b) => (a.paidMonth || 1e9) - (b.paidMonth || 1e9)).forEach((d, idx) => {
        ol.append(el("div", { class: "debt-row-top" }, [
          el("span", { class: "mono", style: "width:24px;height:24px;display:grid;place-items:center;border-radius:50%;background:var(--surface-3);font-size:12px;font-weight:600", text: String(idx + 1) }),
          el("span", { style: "flex:1;font-weight:500", text: d.name }),
          el("span", { class: "pill " + (strat === "snowball" ? "pill-b" : "pill-a"), text: d.paidMonth ? `paid in ${ym(d.paidMonth)}` : "—" }),
        ]));
      });
      card.append(ol); container.append(card);
    },
    kpi: (r) => ({ label: "total interest (Avalanche)", value: r.payable ? r.avalanche.totalInterest : Infinity, format: money, betterIsLower: true }),
    cardStat(i) { const r = computeDebt(i); return r.count === 0 ? "No debts" : (r.payable ? `Debt-free in ${ym(r.avalanche.months)}` : "Needs a bigger payment"); },
    smartName: (i) => { const n = i.debts.filter((d) => d.balance > 0).length; return `${n} debt${n === 1 ? "" : "s"} · ${compactMoney(i.debts.reduce((s, d) => s + (d.balance || 0), 0))}`; },
  },

  jobcomparison: {
    id: "jobcomparison", title: "Job Offers", accent: "var(--series-b)", icon: ICONS.jobcomparison,
    blurb: "Compare two offers beyond base pay — bonus, equity, benefits, cost-of-living and commute — as effective annual value over time.",
    compute: computeJob,
    isComplete: (i) => has(i.aBase) && has(i.bBase) && has(i.horizonYears),
    resolve: (i) => {
      const out = { ...i };
      out.raisePct = has(i.raisePct) ? i.raisePct : 0;
      out.horizonYears = has(i.horizonYears) ? i.horizonYears : 1;
      ["a", "b"].forEach((s) => {
        ["Base", "BonusPct", "Equity", "Benefits", "CommuteCost", "CommuteMins"].forEach((k) => { out[s + k] = has(i[s + k]) ? i[s + k] : 0; });
        out[s + "VestYears"] = has(i[s + "VestYears"]) ? i[s + "VestYears"] : 1;
        out[s + "Col"] = has(i[s + "Col"]) ? i[s + "Col"] : 100;
      });
      return out;
    },
    missing: (i) => { const m = []; if (!has(i.aBase)) m.push("Offer A base salary"); if (!has(i.bBase)) m.push("Offer B base salary"); if (!has(i.horizonYears)) m.push("horizon"); return m; },
    renderInputs(container, inputs, onChange) {
      container.innerHTML = "";
      const top = el("div", { class: "field-group" });
      top.append(el("div", { class: "field-group-label", text: "Comparison settings" }));
      top.append(renderField({ key: "horizonYears", label: "Horizon", type: "number", min: 1, max: 10, step: 1, suffix: "yrs", group: "", placeholder: "4" }, inputs, (k, v) => { inputs.horizonYears = v; onChange(); }));
      top.append(renderField({ key: "raisePct", label: "Annual raise", type: "percent", min: 0, max: 12, step: 0.5, suffix: "%", group: "", placeholder: "3", help: "Assumed yearly raise on base pay for both offers." }, inputs, (k, v) => { inputs.raisePct = v; onChange(); }));
      container.append(top);
      const g = el("div", { class: "field-group" });
      g.append(el("div", { class: "field-group-label", text: "The offers" }));
      g.append(el("div", { class: "offer-head" }, [el("div", { class: "offer-tag a", text: "Offer A" }), el("div", { class: "offer-tag b", text: "Offer B" })]));
      const FIELDS = [
        { label: "Base salary", key: "Base", type: "currency", min: 0, max: 600000, step: 1000, ph: ["120,000", "138,000"] },
        { label: "Annual bonus", key: "BonusPct", type: "percent", min: 0, max: 100, step: 1, suffix: "%", ph: ["10", "8"] },
        { label: "Equity grant (total)", key: "Equity", type: "currency", min: 0, max: 2000000, step: 5000, ph: ["120,000", "60,000"], help: "Total grant value, vesting evenly over the vesting period." },
        { label: "Vesting period", key: "VestYears", type: "number", min: 1, max: 6, step: 1, suffix: "yr", ph: ["4", "4"] },
        { label: "Benefits / yr", key: "Benefits", type: "currency", min: 0, max: 60000, step: 500, ph: ["14,000", "10,000"], help: "Annual value of health, retirement match, perks." },
        { label: "Cost-of-living index", key: "Col", type: "number", min: 50, max: 260, step: 1, ph: ["155", "100"], help: "100 = national average. Higher = more expensive city." },
        { label: "Commute cost / mo", key: "CommuteCost", type: "currency", min: 0, max: 1500, step: 10, ph: ["180", "120"] },
        { label: "Commute / day", key: "CommuteMins", type: "number", min: 0, max: 200, step: 5, suffix: "min", ph: ["50", "35"], help: "Round-trip minutes per day. Valued at your hourly rate." },
      ];
      FIELDS.forEach((f) => {
        const field = el("div", { class: "field" });
        field.append(el("div", { class: "field-label", style: "margin-bottom:2px" }, [f.label, infoTip(f.help)]));
        field.append(el("div", { class: "offer-cols" }, [
          numberCell(inputs["a" + f.key], { ...f, placeholder: f.ph[0], aria: "Offer A " + f.label }, (v) => { inputs["a" + f.key] = v; onChange(); }),
          numberCell(inputs["b" + f.key], { ...f, placeholder: f.ph[1], aria: "Offer B " + f.label }, (v) => { inputs["b" + f.key] = v; onChange(); }),
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
    chart(r) { return { xValues: r.years, xLabel: "Year", xTickFormat: (y) => `${y}`, xFormat: (y) => (y === 0 ? "Start" : `Year ${y}`), series: [{ name: "Offer A (cumulative)", color: "var(--series-a)", values: r.cumA }, { name: "Offer B (cumulative)", color: "var(--series-b)", values: r.cumB }] }; },
    chartTitle: "Cumulative effective value",
    summary(r, i) {
      const aWins = r.totalA >= r.totalB, gap = Math.abs(r.totalA - r.totalB);
      return `<span class="verdict">${aWins ? "Edge: Offer A" : "Edge: Offer B"}</span><p>After adjusting for cost of living and commute, <strong>${aWins ? "Offer A" : "Offer B"}</strong> delivers more effective value — <strong>${money(aWins ? r.totalA : r.totalB)}</strong> vs <strong>${money(aWins ? r.totalB : r.totalA)}</strong> over ${i.horizonYears} years, a difference of <strong>${money(gap)}</strong>.</p><p>Year-one effective value is <strong>${money(r.year1A)}</strong> for A and <strong>${money(r.year1B)}</strong> for B. Remember equity vesting cliffs, and that a high headline salary in an expensive city can buy less than a smaller one elsewhere.</p>`;
    },
    kpi: (r) => ({ label: "value of the stronger offer", value: Math.max(r.totalA, r.totalB), format: money, betterIsLower: false }),
    cardStat(i) { const r = computeJob(i); return `${r.totalA >= r.totalB ? "A" : "B"} leads · ${compactMoney(Math.abs(r.totalA - r.totalB))} / ${i.horizonYears}y`; },
    smartName: () => `Two offers`,
  },

  loan: {
    id: "loan", title: "Loan & Affordability", accent: "var(--warning)", icon: ICONS.loan,
    blurb: "Price, down payment, rate and term in — monthly payment, total interest and a full amortization schedule out.",
    fields: [
      { key: "price", label: "Purchase price", type: "currency", min: 1000, max: 500000, step: 500, group: "The purchase", placeholder: "34,000" },
      { key: "downPayment", label: "Down payment", type: "currency", min: 0, max: 200000, step: 250, group: "The purchase", placeholder: "5,000" },
      { key: "apr", label: "APR", type: "percent", min: 0, max: 30, step: 0.1, suffix: "%", group: "The loan", placeholder: "7.2", help: "Annual percentage rate on the financed amount." },
      { key: "termMonths", label: "Term", type: "number", min: 12, max: 96, step: 6, suffix: "mo", group: "The loan", placeholder: "60" },
    ],
    compute: computeLoan,
    metrics(r) {
      const intPctOfP = r.P > 0 ? (r.totalInterest / r.P) * 100 : 0;
      return [
        stat("Monthly payment", null, { num: r.payment, format: money, tone: "tone-a" }),
        stat("Total interest", null, { num: r.totalInterest, format: money, tone: "tone-warn", sub: `${pct(intPctOfP)} of amount financed` }),
        stat("Amount financed", null, { num: r.P, format: money }),
        stat("Total of payments", null, { num: r.totalPaid, format: money, sub: "incl. down payment" }),
      ];
    },
    chart(r) { return { xValues: r.months, xLabel: "Months", xTickFormat: (m) => `${m}`, xFormat: (m) => `Month ${m}`, yMin: 0, series: [{ name: "Remaining balance", color: "var(--series-a)", values: r.balances }, { name: "Interest paid (cumulative)", color: "var(--warning)", values: r.cumInt, dashed: true }] }; },
    chartTitle: "Payoff & interest",
    summary(r, i) {
      return `<span class="verdict">Payment plan</span><p>Financing <strong>${money(r.P)}</strong> at <strong>${pct(i.apr)}</strong> over <strong>${Math.round(i.termMonths)} months</strong> works out to <strong>${money(r.payment)}/mo</strong>.</p><p>You'll pay <strong>${money(r.totalInterest)}</strong> in interest — that's ${pct(r.P > 0 ? (r.totalInterest / r.P) * 100 : 0)} on top of the amount financed, for a total outlay of <strong>${money(r.totalPaid)}</strong> including the down payment. A larger down payment or shorter term cuts the interest meaningfully.</p>`;
    },
    extras(r, i, container) {
      const card = el("div", { class: "card card-pad" });
      const dl = el("button", { class: "btn btn-secondary btn-sm" }, [el("span", { html: ICONS.download }), "Download CSV"]);
      dl.addEventListener("click", () => downloadLoanCSV(r));
      card.append(el("div", { class: "card-h" }, [el("h3", { text: "Amortization schedule" }), dl]));
      const scroll = el("div", { class: "table-scroll" });
      const table = el("table", { class: "data" });
      table.append(el("thead", {}, el("tr", {}, [el("th", { text: "Month" }), el("th", { text: "Payment" }), el("th", { text: "Principal" }), el("th", { text: "Interest" }), el("th", { text: "Balance" })])));
      const tb = el("tbody");
      r.sched.rows.forEach((row) => tb.append(el("tr", {}, [el("td", { text: `#${row.month}` }), el("td", { text: money(row.payment, 2) }), el("td", { text: money(row.principal, 2) }), el("td", { text: money(row.interest, 2) }), el("td", { text: money(row.balance, 2) })])));
      table.append(tb); scroll.append(table); card.append(scroll); container.append(card);
    },
    kpi: (r) => ({ label: "total interest", value: r.totalInterest, format: money, betterIsLower: true }),
    cardStat(i) { const r = computeLoan(i); return `${money(r.payment)}/mo · ${money(r.totalInterest)} interest`; },
    smartName: (i) => `${compactMoney(i.price)} over ${Math.round(i.termMonths)}mo`,
  },

  retirement: {
    id: "retirement", title: "Savings & Retirement", accent: "var(--series-a)", icon: ICONS.retirement, heavy: true,
    blurb: "Project your savings with a Monte Carlo simulation — see the realistic range of outcomes, not a single fragile number.",
    fields: [
      { key: "currentSavings", label: "Current savings", type: "currency", min: 0, max: 2000000, step: 1000, group: "Today", placeholder: "28,000" },
      { key: "monthlyContribution", label: "Monthly contribution", type: "currency", min: 0, max: 20000, step: 50, group: "Today", placeholder: "650" },
      { key: "expectedReturnPct", label: "Expected return", type: "percent", min: 0, max: 15, step: 0.1, suffix: "%/yr", group: "Assumptions", placeholder: "7", help: "Average annual return before inflation." },
      { key: "volatilityPct", label: "Volatility", type: "percent", min: 0, max: 40, step: 0.5, suffix: "%", group: "Assumptions", placeholder: "15", help: "Annual standard deviation of returns. Stocks are roughly 15-18%." },
      { key: "inflationPct", label: "Inflation", type: "percent", min: 0, max: 10, step: 0.1, suffix: "%/yr", group: "Assumptions", placeholder: "2.5" },
      { key: "years", label: "Years", type: "number", min: 1, max: 50, step: 1, suffix: "yrs", group: "Horizon & goal", placeholder: "30" },
      { key: "runs", label: "Simulations", type: "number", min: 500, max: 5000, step: 500, suffix: "runs", group: "Horizon & goal", placeholder: "1,000", required: false, fallback: 1000, help: "More runs = smoother percentile bands. Defaults to 1,000." },
      { key: "goal", label: "Target (optional)", type: "currency", min: 0, max: 10000000, step: 50000, group: "Horizon & goal", placeholder: "1,000,000", required: false, fallback: null, help: "Probability of reaching this is shown below." },
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
      return { xValues: r.years, xLabel: "Year", xTickFormat: (y) => `${y}`, xFormat: (y) => (y === 0 ? "Today" : `Year ${y}`), yMin: 0, bands: [{ name: "10th–90th percentile", color: "var(--series-a)", lower: real ? r.p10r : r.p10, upper: real ? r.p90r : r.p90 }], series: [{ name: real ? "Median (today's money)" : "Median outcome", color: "var(--series-a)", values: real ? r.p50r : r.p50 }] };
    },
    chartTitle: "Range of outcomes",
    chartControls() {
      const tabs = el("div", { class: "tabs", role: "tablist" });
      [["nominal", "Nominal"], ["real", "Real"]].forEach(([m, label]) => { const t = el("button", { class: "tab", role: "tab", "aria-selected": String(state.ui.retMode === m), text: label }); t.addEventListener("click", () => { state.ui.retMode = m; rerenderFromCache(); }); tabs.append(t); });
      return tabs;
    },
    summary(r, i) {
      const goalLine = r.goalProb != null ? ` Across ${r.runs.toLocaleString()} runs, about <strong>${Math.round(r.goalProb * 100)}%</strong> reached your ${money(i.goal)} target.` : "";
      return `<span class="verdict">Likely range</span><p>Running <strong>${r.runs.toLocaleString()} simulations</strong>, your most likely balance after ${i.years} years is around <strong>${money(r.finalP50)}</strong>, with outcomes typically between <strong>${money(r.finalP10)}</strong> and <strong>${money(r.finalP90)}</strong>.${goalLine}</p><p>You'll have contributed <strong>${money(r.totalContributed)}</strong> of your own money along the way. After <strong>${pct(i.inflationPct)}</strong> inflation, that median balance is worth about <strong>${money(r.realP50)}</strong> in today's money — the number that reflects real buying power.</p>`;
    },
    kpi: (r) => ({ label: "median outcome", value: r.finalP50, format: money, betterIsLower: false }),
    cardStat(i) { return `Median ≈ ${compactMoney(retirementQuick(i))} in ${i.years}y`; },
    smartName: (i) => `Retire in ${i.years}y`,
  },
};
const MODULE_ORDER = ["rentvsbuy", "debtpayoff", "jobcomparison", "loan", "retirement"];

const DEFAULTS = {
  rentvsbuy: { homePrice: null, downPayment: null, rate: null, termYears: null, homeAppreciationPct: null, propertyTaxPct: null, maintenancePct: null, monthlyRent: null, rentGrowthPct: null, investReturnPct: null, horizonYears: null },
  debtpayoff: { debts: [{ name: "", balance: null, apr: null, min: null }], extra: null },
  jobcomparison: { aBase: null, aBonusPct: null, aEquity: null, aVestYears: null, aBenefits: null, aCol: null, aCommuteCost: null, aCommuteMins: null, bBase: null, bBonusPct: null, bEquity: null, bVestYears: null, bBenefits: null, bCol: null, bCommuteCost: null, bCommuteMins: null, raisePct: null, horizonYears: null },
  loan: { price: null, downPayment: null, apr: null, termMonths: null },
  retirement: { currentSavings: null, monthlyContribution: null, expectedReturnPct: null, volatilityPct: null, inflationPct: null, years: null, runs: null, goal: null },
};
const clone = (o) => JSON.parse(JSON.stringify(o));
const defaultWorking = () => clone(DEFAULTS);
const defaultSettings = { currency: "USD" };

const STORAGE_KEY = "crossroads:v2";
let state = {
  view: "dashboard", panelModule: null, compareA: null, compareB: null,
  settings: { ...defaultSettings }, scenarios: [], working: defaultWorking(),
  user: { name: null }, welcomeSeen: false,
  ui: { retMode: "nominal", debtStrategy: "avalanche" },
};
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      state.settings = { currency: (p.settings && p.settings.currency) || "USD" };
      state.scenarios = Array.isArray(p.scenarios) ? p.scenarios : [];
      state.working = { ...defaultWorking(), ...(p.working || {}) };
      state.user = { name: (p.user && p.user.name) || null };
      state.welcomeSeen = !!p.welcomeSeen;
    }
  } catch (e) {}
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, savedAt: Date.now(), settings: state.settings, scenarios: state.scenarios, working: state.working, user: state.user, welcomeSeen: state.welcomeSeen })); } catch (e) {}
}
const persistWorking = debounce(saveState, 400);

function moduleComplete(m, i) { return m.isComplete ? m.isComplete(i) : m.fields.filter((f) => f.required !== false).every((f) => has(i[f.key])); }
function resolveInputs(m, i) {
  if (m.resolve) return m.resolve(i);
  const out = { ...i };
  m.fields.forEach((f) => { if (!has(out[f.key])) out[f.key] = (f.fallback !== undefined ? f.fallback : 0); });
  return out;
}
function missingFields(m, i) { return m.missing ? m.missing(i) : m.fields.filter((f) => f.required !== false && !has(i[f.key])).map((f) => f.label); }

let panelResultsMount = null, panelCache = null, heavyTimer = null;

function renderResults(module, inputs, results, mount, { animate = true, compact = false } = {}) {
  mount.innerHTML = "";
  const metrics = module.metrics(results, inputs);
  const row = el("div", { class: "stat-row" });
  metrics.forEach((m) => row.append(m));
  mount.append(row);
  requestAnimationFrame(() => metrics.forEach((m) => m._animate && m._animate(animate)));
  const cfg = module.chart(results, inputs);
  if (cfg) {
    cfg.animate = animate; cfg.height = compact ? 300 : 360;
    const chartCard = el("div", { class: "card card-pad" });
    const controls = !compact && module.chartControls ? module.chartControls(results, inputs) : null;
    chartCard.append(el("div", { class: "card-h" }, [el("h3", { text: module.chartTitle || "Projection" }), controls]));
    chartCard.append(legend([...(cfg.series || []).map((s) => ({ name: s.name, color: s.color, dashed: s.dashed })), ...(cfg.bands || []).map((b) => ({ name: b.name, color: b.color }))]));
    chartCard.append(buildChart(cfg));
    mount.append(chartCard);
  }
  mount.append(el("div", { class: "summary" }, [el("h3", {}, [el("span", { html: ICONS.bulb }), "What this means"]), el("div", { html: module.summary(results, inputs) })]));
  if (!compact && module.extras) module.extras(results, inputs, mount);
}
function renderResultsEmpty(module, inputs, mount) {
  mount.innerHTML = "";
  const miss = missingFields(module, inputs);
  mount.append(el("div", { class: "results-empty" }, [
    el("div", { class: "empty-ico", html: module.icon }),
    el("h3", { text: "Your analysis appears here" }),
    el("p", { text: "Fill in the fields on the left and Crossroads models it live — charts, key numbers, and a plain-English read of what it means." }),
    miss.length ? el("div", { class: "re-fields", text: "Still needed: " + miss.slice(0, 6).join(" · ") + (miss.length > 6 ? " …" : "") }) : null,
  ]));
}
function loadingCard(text) { return el("div", { class: "card card-pad" }, [el("div", { class: "chart-loading" }, [el("div", { class: "spinner" }), text])]); }

function computeAndRender(module, inputs, mount, { animate = true } = {}) {
  if (!moduleComplete(module, inputs)) { renderResultsEmpty(module, inputs, mount); panelCache = null; return; }
  const resolved = resolveInputs(module, inputs);
  if (module.heavy) {
    mount.innerHTML = "";
    const row = el("div", { class: "stat-row" });
    for (let k = 0; k < 4; k++) row.append(el("div", { class: "stat" }, [el("div", { class: "skeleton", style: "height:12px;width:60%" }), el("div", { class: "skeleton", style: "height:26px;width:80%;margin-top:8px" })]));
    mount.append(row, loadingCard(`Running ${Math.round(resolved.runs).toLocaleString()} simulations…`));
    clearTimeout(heavyTimer);
    heavyTimer = setTimeout(() => { const results = module.compute(resolved); panelCache = { module, inputs: resolved, results }; renderResults(module, resolved, results, mount, { animate }); }, 30);
  } else {
    const results = module.compute(resolved);
    panelCache = { module, inputs: resolved, results };
    renderResults(module, resolved, results, mount, { animate });
  }
}
function rerenderFromCache() { if (panelCache && panelResultsMount) renderResults(panelCache.module, panelCache.inputs, panelCache.results, panelResultsMount, { animate: false }); }

const view = () => $("#view");

function greeting() {
  const now = new Date(), h = now.getHours();
  const word = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const date = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const subs = [
    "Let's turn a hard decision into a clear one.",
    "Big choices deserve real math — not a gut guess.",
    "Model it first. Decide with confidence.",
    "Clarity beats second-guessing, every time.",
    "Run the numbers. The rest gets easier.",
  ];
  return { word, date, sub: subs[Math.floor(Math.random() * subs.length)] };
}

function renderDashboard() {
  const v = view();
  v.innerHTML = "";
  const g = greeting();
  const hero = el("section", { class: "hero stagger" });
  hero.append(el("div", { class: "hero-date", text: g.date }));
  const h1 = el("h1", { class: "greeting" }, [el("span", { class: "greeting-word", text: g.word })]);
  if (state.user.name) h1.append(el("span", { class: "greeting-name", text: `, ${state.user.name}` }));
  h1.append(el("span", { class: "greeting-punc", text: "." }));
  hero.append(h1);
  hero.append(el("p", { class: "hero-sub", text: g.sub }));
  hero.append(el("span", { class: "hero-chip" }, [el("span", { html: ICONS.shield }), "100% private — your numbers never leave this browser"]));
  v.append(hero);

  v.append(el("div", { class: "cards-head" }, [el("h2", { text: "Calculators" }), el("span", { class: "section-eyebrow", text: `${MODULE_ORDER.length} modules` })]));
  const grid = el("div", { class: "card-grid" });
  MODULE_ORDER.forEach((id) => {
    const m = MODULES[id];
    const card = el("button", { class: "scenario-card", style: `--accent:${m.accent}`, "aria-label": `Open ${m.title}` });
    card.append(el("span", { class: "card-icon", html: m.icon }));
    card.append(el("div", { class: "card-title", text: m.title }));
    card.append(el("p", { class: "card-blurb", text: m.blurb }));
    card.append(el("span", { class: "card-cta" }, ["Open calculator", el("span", { html: ICONS.arrow })]));
    card.addEventListener("click", () => openPanel(id));
    grid.append(card);
  });
  v.append(grid);

  v.append(el("div", { class: "cards-head", style: "margin-top:48px" }, [
    el("h2", { text: "Saved scenarios" }),
    el("div", { style: "display:flex;gap:8px" }, [
      el("button", { class: "btn btn-ghost btn-sm", onClick: exportData }, [el("span", { html: ICONS.download }), "Export"]),
      el("button", { class: "btn btn-ghost btn-sm", onClick: () => $("#import-file").click() }, [el("span", { html: ICONS.upload }), "Import"]),
    ]),
  ]));
  if (state.scenarios.length === 0) {
    v.append(el("div", { class: "empty" }, [
      el("div", { class: "empty-ico", html: `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h11l3 3v15H5z"/><path d="M12 11v6M9 14h6"/></svg>` }),
      el("h3", { text: "No saved scenarios yet" }),
      el("p", { text: "Open any calculator above, enter your numbers, and hit Save. Your scenarios live here for quick access and side-by-side comparison." }),
    ]));
  } else {
    const sg = el("div", { class: "saved-grid" });
    state.scenarios.slice().sort((a, b) => b.createdAt - a.createdAt).forEach((sc) => sg.append(savedCard(sc)));
    v.append(sg);
  }

  v.append(el("footer", { class: "app-footer" }, [el("span", { text: "Crossroads · Educational estimates, not financial advice." }), el("span", { class: "mono", text: "Your data stays on this device." })]));
}

function savedCard(sc) {
  const m = MODULES[sc.type];
  let line = "";
  try { line = m.cardStat(resolveInputs(m, sc.inputs)); } catch (e) { line = ""; }
  const card = el("div", { class: "saved-card" });
  card.append(el("div", { class: "saved-top" }, [el("span", { class: "saved-dot", style: `background:${m.accent};color:${m.accent}` }), el("span", { class: "saved-type", text: m.title })]));
  card.append(el("div", { class: "saved-name", text: sc.name }));
  card.append(el("div", { class: "saved-kpi", text: line }));
  card.append(el("div", { class: "saved-actions" }, [
    el("button", { class: "btn btn-secondary btn-sm", onClick: () => openScenario(sc) }, "Open"),
    el("button", { class: "btn btn-ghost btn-sm", onClick: () => { state.compareA = sc.id; navigate("compare"); } }, "Compare"),
    el("button", { class: "btn btn-ghost btn-sm", style: "margin-left:auto", "aria-label": `Delete ${sc.name}`, onClick: () => deleteScenario(sc) }, el("span", { html: ICONS.trash })),
  ]));
  return card;
}

function openPanel(id) { state.view = "panel"; state.panelModule = id; setHash(`m/${id}`); render(); }
function openScenario(sc) { state.working[sc.type] = clone(sc.inputs); openPanel(sc.type); }

function renderPanel() {
  const v = view();
  v.innerHTML = "";
  const m = MODULES[state.panelModule];
  const inputs = state.working[state.panelModule];
  const head = el("div", { class: "panel-head" });
  const back = el("button", { class: "btn-back", onClick: () => navigate("dashboard") }, [el("span", { html: ICONS.back }), "Dashboard"]);
  const titles = el("div", { class: "titles" }, [el("h1", { text: m.title }), el("p", { text: m.blurb })]);
  head.append(el("div", { style: "display:grid;gap:10px" }, [back, titles]), el("div", { class: "panel-actions" }, [
    el("button", { class: "btn btn-ghost", onClick: () => resetPanelInputs() }, "Reset"),
    el("button", { class: "btn btn-secondary", onClick: () => saveScenarioDialog() }, [el("span", { html: ICONS.save }), "Save scenario"]),
  ]));
  const layout = el("div", { class: "panel-grid" });
  const aside = el("aside", { class: "inputs" });
  const results = el("section", { class: "results" });
  panelResultsMount = results;
  const recompute = debounce(() => computeAndRender(m, inputs, results, { animate: false }), m.heavy ? 320 : 150);
  const onChange = (key, val) => { if (key !== undefined) inputs[key] = val; persistWorking(); recompute(); };
  if (m.renderInputs) m.renderInputs(aside, inputs, () => onChange());
  else aside.append(renderSchemaForm(m, inputs, onChange));
  layout.append(aside, results);
  v.append(head, layout);
  computeAndRender(m, inputs, results, { animate: true });
}
function resetPanelInputs() {
  state.working[state.panelModule] = clone(DEFAULTS[state.panelModule]);
  saveState(); renderPanel();
  toast("Inputs cleared", "Start fresh whenever you like.", "info");
}
function saveScenarioDialog() {
  const m = MODULES[state.panelModule], inputs = state.working[state.panelModule];
  if (!moduleComplete(m, inputs)) { toast("Not yet", "Fill in the required fields before saving.", "error"); return; }
  const input = el("input", { class: "text-input", type: "text", value: m.smartName(resolveInputs(m, inputs)), maxlength: "48", "aria-label": "Scenario name" });
  openModal({
    title: "Save scenario", desc: "Give this set of numbers a name. It'll appear on your dashboard and be available to compare.",
    content: el("div", { class: "field" }, [input]),
    actions: [
      { label: "Cancel", variant: "btn-ghost" },
      { label: "Save", variant: "btn-primary", onClick: () => {
        const name = (input.value || "").trim() || m.smartName(resolveInputs(m, inputs));
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
    title: "Delete scenario?", desc: `"${sc.name}" will be permanently removed. This can't be undone.`,
    actions: [
      { label: "Cancel", variant: "btn-ghost" },
      { label: "Delete", variant: "btn-danger", onClick: () => { state.scenarios = state.scenarios.filter((s) => s.id !== sc.id); if (state.compareA === sc.id) state.compareA = null; if (state.compareB === sc.id) state.compareB = null; saveState(); render(); toast("Scenario deleted", "", "info"); } },
    ],
  });
}

function renderCompare() {
  const v = view();
  v.innerHTML = "";
  v.append(el("div", { class: "panel-head" }, [el("div", { class: "titles" }, [el("h1", { text: "Compare scenarios" }), el("p", { text: "Put two saved scenarios head to head. Pick scenarios of the same type for a direct recommendation." })])]));
  if (state.scenarios.length < 2) {
    v.append(el("div", { class: "empty" }, [
      el("div", { class: "empty-ico", html: `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v16M18 4v16"/><path d="M3 8l3-3 3 3M21 16l-3 3-3-3"/></svg>` }),
      el("h3", { text: "Save at least two scenarios" }),
      el("p", { text: "Comparison needs two saved scenarios. Open a calculator, enter your numbers, and hit Save — then come back here." }),
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
      byType[t].forEach((s) => { const opt = el("option", { value: s.id, text: s.name }); if ((which === "A" ? state.compareA : state.compareB) === s.id) opt.setAttribute("selected", ""); og.append(opt); });
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
  const a = state.scenarios.find((s) => s.id === state.compareA), b = state.scenarios.find((s) => s.id === state.compareB);
  if (!a || !b) return;
  const headline = el("div", { class: "compare-headline" });
  if (a.type === b.type) {
    const m = MODULES[a.type];
    const ra = m.compute(resolveInputs(m, a.inputs)), rb = m.compute(resolveInputs(m, b.inputs));
    const ka = m.kpi(ra, a.inputs), kb = m.kpi(rb, b.inputs);
    const better = ka.betterIsLower ? (ka.value <= kb.value ? "a" : "b") : (ka.value >= kb.value ? "a" : "b");
    const winner = better === "a" ? a : b, wv = better === "a" ? ka.value : kb.value, lv = better === "a" ? kb.value : ka.value;
    headline.append(el("div", { class: "section-eyebrow", text: "Recommendation" }));
    headline.append(el("div", { class: "big", html: `<strong>${winner.name}</strong> wins on ${ka.label}` }));
    headline.append(el("p", { html: `${ka.format(wv)} vs ${ka.format(lv)} — a difference of <strong>${ka.format(Math.abs(ka.value - kb.value))}</strong> ${ka.betterIsLower ? "less" : "more"}.` }));
  } else {
    headline.append(el("div", { class: "section-eyebrow", text: "Different types" }));
    headline.append(el("div", { class: "big", text: `${MODULES[a.type].title} vs ${MODULES[b.type].title}` }));
    headline.append(el("p", { text: "These scenarios use different calculators, so there's no single winner — each is shown on its own below." }));
  }
  v.append(headline);
  const grid = el("div", { class: "compare-grid" });
  [a, b].forEach((sc, idx) => {
    const m = MODULES[sc.type];
    const col = el("div", { class: "compare-col" });
    col.append(el("h3", {}, [el("span", { class: "saved-dot", style: `background:${idx === 0 ? "var(--series-a)" : "var(--series-b)"}` }), sc.name]));
    const mount = el("div", { style: "display:grid;gap:16px" });
    col.append(mount);
    const resolved = resolveInputs(m, sc.inputs);
    if (m.heavy) { mount.append(loadingCard("Simulating…")); setTimeout(() => { renderResults(m, resolved, m.compute(resolved), mount, { animate: true, compact: true }); }, 30); }
    else renderResults(m, resolved, m.compute(resolved), mount, { animate: true, compact: true });
    grid.append(col);
  });
  v.append(grid);
}

function settingRow(title, desc, control) { return el("div", { class: "setting-row" }, [el("div", { class: "meta" }, [el("h4", { text: title }), el("p", { text: desc })]), control]); }
function renderSettings() {
  const v = view();
  v.innerHTML = "";
  v.append(el("div", { class: "panel-head" }, [el("div", { class: "titles" }, [el("h1", { text: "Settings" }), el("p", { text: "Preferences, your name, and data — all stored locally on this device." })])]));
  const stack = el("div", { class: "settings-stack" });

  const nameInput = el("input", { class: "text-input", type: "text", value: state.user.name || "", placeholder: "Your name", maxlength: "32", style: "width:200px", "aria-label": "Your name" });
  nameInput.addEventListener("input", debounce(() => { state.user.name = (nameInput.value || "").trim() || null; saveState(); }, 300));
  stack.append(settingRow("Your name", "Used to personalize your greeting. Leave blank to stay anonymous.", nameInput));

  const curSel = el("select", { class: "num-input", style: "width:auto", "aria-label": "Currency" });
  Object.keys(CURRENCIES).forEach((c) => { const o = el("option", { value: c, text: `${c} (${CURRENCIES[c].symbol})` }); if (state.settings.currency === c) o.setAttribute("selected", ""); curSel.append(o); });
  curSel.addEventListener("change", () => { state.settings.currency = curSel.value; saveState(); toast("Currency updated", `Now showing ${curSel.value}.`, "success"); });
  stack.append(settingRow("Currency", "The symbol and formatting used across all calculators.", curSel));

  stack.append(settingRow("Backup & restore", "Export your scenarios and settings to a JSON file, or import a previous backup. There's no cloud — this is how you move data between devices.", el("div", { class: "setting-actions" }, [
    el("button", { class: "btn btn-secondary", onClick: exportData }, "Export JSON"),
    el("button", { class: "btn btn-secondary", onClick: () => $("#import-file").click() }, "Import JSON"),
  ])));

  stack.append(settingRow("Replay the intro", "Show the welcome screen again the next time the page loads.", el("button", { class: "btn btn-secondary", onClick: () => { state.welcomeSeen = false; saveState(); toast("Done", "The intro will show on next load.", "success"); } }, "Show welcome")));

  stack.append(settingRow("Reset everything", "Clear all saved scenarios and your inputs. This cannot be undone.", el("div", { class: "setting-actions" }, [el("button", { class: "btn btn-danger", onClick: confirmReset }, "Reset all data")])));

  let used = 0;
  try { used = new Blob([localStorage.getItem(STORAGE_KEY) || ""]).size; } catch (e) {}
  stack.append(settingRow("Storage", `${state.scenarios.length} saved scenario${state.scenarios.length === 1 ? "" : "s"} · about ${(used / 1024).toFixed(1)} KB used in this browser.`, el("span", { class: "privacy-badge" }, [el("span", { html: ICONS.shield }), el("span", { text: "Local only" })])));

  v.append(stack);
  v.append(el("footer", { class: "app-footer" }, [el("span", { text: "Crossroads · Educational estimates, not financial advice." }), el("span", { class: "mono", text: "v2.0" })]));
}
function confirmReset() {
  openModal({
    title: "Reset everything?", desc: "All your saved scenarios and inputs will be cleared. This can't be undone.",
    actions: [
      { label: "Cancel", variant: "btn-ghost" },
      { label: "Reset", variant: "btn-danger", onClick: () => { state.scenarios = []; state.working = defaultWorking(); saveState(); navigate("dashboard"); toast("Reset complete", "Everything's cleared.", "success"); } },
    ],
  });
}

function downloadBlob(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = el("a", { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportData() {
  const payload = { app: "Crossroads", version: 2, exportedAt: new Date().toISOString(), settings: state.settings, user: state.user, scenarios: state.scenarios };
  downloadBlob(JSON.stringify(payload, null, 2), `crossroads-backup-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
  toast("Exported", "Your backup file is downloading.", "success");
}
function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const scenarios = Array.isArray(data.scenarios) ? data.scenarios.filter((s) => s && MODULES[s.type] && s.inputs) : null;
      if (!scenarios) throw new Error("no scenarios");
      state.scenarios = scenarios.map((s) => ({ id: s.id || uid(), type: s.type, name: s.name || MODULES[s.type].smartName(resolveInputs(MODULES[s.type], s.inputs)), createdAt: s.createdAt || Date.now(), inputs: s.inputs }));
      if (data.settings && data.settings.currency) state.settings.currency = data.settings.currency;
      if (data.user && data.user.name) state.user.name = data.user.name;
      saveState(); navigate("dashboard");
      toast("Import complete", `${state.scenarios.length} scenario${state.scenarios.length === 1 ? "" : "s"} loaded.`, "success");
    } catch (e) { toast("Import failed", "That file doesn't look like a Crossroads backup.", "error"); }
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

let starfieldStop = null;
function startStarfield() {
  const c = $("#wl-stars");
  if (!c || !c.getContext) return;
  const ctx = c.getContext("2d");
  if (!ctx) return;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const reduce = reducedMotion();
  let w = 0, h = 0, stars = [], shooting = [], raf = 0, running = true;
  function makeStars() {
    const n = Math.max(40, Math.round((w * h) / 9000));
    stars = [];
    for (let i = 0; i < n; i++) stars.push({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.3 + 0.3, a: Math.random(), tw: (Math.random() * 0.015 + 0.004) * (Math.random() < 0.5 ? -1 : 1), vx: (Math.random() - 0.5) * 0.04, vy: (Math.random() - 0.5) * 0.04 });
  }
  function resize() { w = c.clientWidth; h = c.clientHeight; c.width = w * DPR; c.height = h * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); makeStars(); if (reduce) draw(); }
  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      if (!reduce) { s.a += s.tw; if (s.a > 1) { s.a = 1; s.tw *= -1; } if (s.a < 0.15) { s.a = 0.15; s.tw *= -1; } s.x += s.vx; s.y += s.vy; if (s.x < 0) s.x = w; if (s.x > w) s.x = 0; if (s.y < 0) s.y = h; if (s.y > h) s.y = 0; }
      ctx.globalAlpha = reduce ? 0.7 : s.a;
      ctx.fillStyle = s.r > 1.1 ? "#bdbbff" : "#ffffff";
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
    }
    if (!reduce) {
      if (Math.random() < 0.004 && shooting.length < 2) shooting.push({ x: Math.random() * w * 0.5, y: Math.random() * h * 0.4, len: 0, sp: Math.random() * 4 + 5, life: 1 });
      for (let i = shooting.length - 1; i >= 0; i--) {
        const sh = shooting[i];
        sh.x += sh.sp * 2; sh.y += sh.sp; sh.len = Math.min(150, sh.len + sh.sp * 2); sh.life -= 0.012;
        const grad = ctx.createLinearGradient(sh.x, sh.y, sh.x - sh.len, sh.y - sh.len / 2);
        grad.addColorStop(0, `rgba(190,188,255,${Math.max(0, sh.life)})`); grad.addColorStop(1, "rgba(190,188,255,0)");
        ctx.globalAlpha = 1; ctx.strokeStyle = grad; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(sh.x - sh.len, sh.y - sh.len / 2); ctx.stroke();
        if (sh.life <= 0 || sh.x > w + 50) shooting.splice(i, 1);
      }
    }
    ctx.globalAlpha = 1;
    if (running && !reduce) raf = requestAnimationFrame(draw);
  }
  resize();
  if (!reduce) draw();
  const onResize = debounce(resize, 200);
  window.addEventListener("resize", onResize);
  starfieldStop = () => { running = false; cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
}
function finishWelcome(name) {
  state.user.name = (name || "").trim() || null;
  state.welcomeSeen = true;
  saveState();
  render();
  const wl = $("#welcome");
  wl.classList.add("leaving");
  const done = () => { wl.classList.remove("show", "leaving"); if (starfieldStop) { starfieldStop(); starfieldStop = null; } };
  if (reducedMotion()) done();
  else setTimeout(done, 680);
}
function initWelcome() {
  const wl = $("#welcome");
  if (!wl) return;
  if (state.welcomeSeen) { wl.classList.remove("show"); return; }
  wl.classList.add("show");
  startStarfield();
  const nameInput = $("#wl-name");
  if (nameInput && state.user.name) nameInput.value = state.user.name;
  const enter = () => finishWelcome(nameInput ? nameInput.value : "");
  const enterBtn = $("#wl-enter"), skipBtn = $("#wl-skip");
  if (enterBtn) enterBtn.addEventListener("click", enter);
  if (skipBtn) skipBtn.addEventListener("click", () => finishWelcome(""));
  if (nameInput) { nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") enter(); }); setTimeout(() => nameInput.focus(), 400); }
  if (!reducedMotion()) {
    const sp = $("#wl-spotlight");
    if (sp) wl.addEventListener("pointermove", (e) => { sp.style.left = e.clientX + "px"; sp.style.top = e.clientY + "px"; });
  }
}

function openHelp() {
  const content = el("div");
  content.append(el("div", { class: "help-hero" }, [
    el("span", { class: "brand-mark", html: `<svg viewBox="0 0 32 32" width="34" height="34"><rect width="32" height="32" rx="9" fill="#7c79ff"/><path d="M16 26V13M16 13l-6.5-6.5M16 13l6.5-6.5" fill="none" stroke="#07080c" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="26" r="2.2" fill="#07080c"/></svg>` }),
    el("div", {}, [el("h3", { text: "How Crossroads works" }), el("p", { style: "margin-top:2px;color:var(--text-muted);font-size:var(--fs-sm)", text: "A private studio for life's biggest money decisions." })]),
  ]));
  const s1 = el("div", { class: "help-section" });
  s1.append(el("h4", { text: "What it is" }), el("p", { html: "Crossroads models five of life's most consequential money choices using real financial math — compound interest, amortization, and a Monte Carlo simulation. Every calculation runs <strong>entirely in your browser</strong>. Nothing you type is uploaded, tracked, or stored anywhere but this device." }));
  content.append(s1);
  const s2 = el("div", { class: "help-section" });
  s2.append(el("h4", { text: "The five calculators" }));
  const mods = el("div", { class: "help-mods" });
  MODULE_ORDER.forEach((id) => { const m = MODULES[id]; mods.append(el("div", { class: "help-mod", style: `--accent:${m.accent}` }, [el("span", { class: "help-mod-ico", html: m.icon }), el("div", {}, [el("div", { class: "help-mod-t", text: m.title }), el("div", { class: "help-mod-d", text: m.blurb })])])); });
  s2.append(mods); content.append(s2);
  const s3 = el("div", { class: "help-section" });
  s3.append(el("h4", { text: "How to use it" }));
  const steps = el("div", { class: "help-steps" });
  [["Pick a calculator", "Tap any card on the dashboard to open it."], ["Enter your numbers", "Type into the fields or drag the sliders. Every field starts empty — fill in what applies to you, and results update live the moment the essentials are in."], ["Read the verdict", "You get the key figures, an interactive chart, and a plain-English summary of what it all means."], ["Save & compare", "Hit Save to name a scenario. Save two of the same type, then open Compare to see them side by side with a recommendation."]].forEach(([t, d]) => { steps.append(el("div", { class: "help-step" }, [el("span", { class: "help-step-num" }), el("div", { class: "help-step-body", html: `<strong>${t}.</strong> ${d}` })])); });
  s3.append(steps); content.append(s3);
  content.append(el("div", { class: "help-note" }, [el("span", { html: ICONS.shield }), el("span", { html: "<strong>Your privacy is the whole point.</strong> Crossroads has no account, no server, and no analytics — your numbers live only in this browser. Use Export in Settings to back them up or move them to another device." })]));
  content.append(el("p", { class: "help-disclaim", text: "Crossroads provides educational estimates based on the assumptions you enter. It is not financial, investment, tax, or legal advice. For decisions that matter, consult a qualified professional." }));
  openModal({ title: null, content, actions: [{ label: "Got it", variant: "btn-primary" }] });
}

function setHash(h) { if (location.hash !== "#" + h) history.replaceState(null, "", "#" + h); }
function navigate(v) { state.view = v; state.panelModule = null; setHash(v); render(); }
function render() {
  if (state.view === "panel" && state.panelModule) renderPanel();
  else if (state.view === "compare") renderCompare();
  else if (state.view === "settings") renderSettings();
  else { state.view = "dashboard"; renderDashboard(); }
  updateNav();
  const vw = view();
  if (vw) vw.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
}
function updateNav() {
  const active = state.view === "panel" ? "dashboard" : state.view;
  $$("[data-nav]").forEach((b) => { if (b.classList.contains("nav-btn") || b.classList.contains("tab-btn")) { if (b.dataset.nav === active) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); } });
}
function parseHash() {
  const h = location.hash.replace(/^#/, "");
  if (h.startsWith("m/")) { const id = h.slice(2); if (MODULES[id]) { state.view = "panel"; state.panelModule = id; return; } }
  if (["compare", "settings", "dashboard"].includes(h)) { state.view = h; return; }
  state.view = "dashboard";
}

function init() {
  loadState();
  $$("[data-nav]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); navigate(b.dataset.nav); }));
  const help = $("#help-btn"), helpM = $("#help-btn-m");
  if (help) help.addEventListener("click", openHelp);
  if (helpM) helpM.addEventListener("click", openHelp);
  const imp = $("#import-file");
  if (imp) imp.addEventListener("change", (e) => { const f = e.target.files[0]; if (f) importData(f); e.target.value = ""; });
  parseHash();
  window.addEventListener("hashchange", () => { const prev = state.view; parseHash(); if (state.view !== prev || state.view === "panel") render(); });
  render();
  initWelcome();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();

})();
