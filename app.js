/**
 * SpeedLab — App Controller
 * All values shown in this app come from real measurements
 * (SpeedTest engine) or real device APIs. No demo/fake data.
 */

(() => {
  'use strict';

  // ═══ STATE ═══
  let running = false;
  let unitMbps = true;
  let waveT = 0;
  let waveRAF = null;
  let dlResult = 0, ulResult = 0, pingVal = 0, jitterVal = 0;
  let curDisplaySpeed = 0;
  let netInfo = null;
  let deferredInstallPrompt = null;

  const STORAGE_KEY = 'speedlab_history_v1';
  let history = [];
  try { history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) { history = []; }

  // ═══ DOM REFS ═══
  const $ = (id) => document.getElementById(id);
  const gaugeCanvas = $('gaugeCanvas');
  const waveCanvas = $('waveCanvas');

  // ═══ NAV ═══
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.screen;
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      $('screen-' + name).classList.add('active');
      btn.classList.add('active');
      if (name === 'history') renderHistory();
    });
  });

  // ═══ UNIT TOGGLE ═══
  $('unitWrap').addEventListener('click', toggleUnit);
  function toggleUnit() {
    unitMbps = !unitMbps;
    $('uThumb').classList.toggle('r', !unitMbps);
    $('uLblMbps').classList.toggle('on', unitMbps);
    $('uLblMBs').classList.toggle('on', !unitMbps);
    $('speedUnit').textContent = unitMbps ? 'MBPS' : 'MB/S';
    $('dlUnit').textContent = fmtUnit();
    $('ulUnit').textContent = fmtUnit();
    if (dlResult > 0) $('vDl').textContent = fmtSpd(dlResult);
    if (ulResult > 0) $('vUl').textContent = fmtSpd(ulResult);
    if (curDisplaySpeed > 0 && !running) $('speedNum').textContent = fmtSpd(curDisplaySpeed);
  }
  function fmtUnit() { return unitMbps ? 'Mbps' : 'MB/s'; }
  function fmtSpd(v) { return unitMbps ? v.toFixed(1) : (v / 8).toFixed(2); }

  // ═══ HAPTIC + TOAST ═══
  function haptic(label, pattern) {
    const f = $('hFlash'), l = $('hLabel');
    f.classList.add('on'); l.classList.add('on'); l.textContent = '⚡ ' + label;
    setTimeout(() => { f.classList.remove('on'); l.classList.remove('on'); }, 550);
    if (navigator.vibrate) { try { navigator.vibrate(pattern || [30]); } catch (e) {} }
  }
  let toastTimer = null;
  function toast(msg, isError = false) {
    const t = $('toast');
    t.textContent = msg;
    t.className = 'toast show' + (isError ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  // ═══ GAUGE RENDERING ═══
  function drawGauge(frac) {
    const ctx = gaugeCanvas.getContext('2d');
    const rect = gaugeCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (gaugeCanvas.width !== Math.round(rect.width * dpr)) {
      gaugeCanvas.width = Math.round(rect.width * dpr);
      gaugeCanvas.height = Math.round(rect.height * dpr);
    }
    ctx.save();
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    const cx = W / 2, cy = H * 0.93, r = W * 0.455;
    ctx.clearRect(0, 0, W, H);
    const f = Math.min(Math.max(frac, 0), 1);
    const gs = f;

    $('orb1').style.background = `radial-gradient(circle,rgba(34,211,238,${0.04 + gs * 0.16}) 0%,transparent 70%)`;
    $('speedNum').style.textShadow = `0 0 ${20 + gs * 35}px rgba(34,211,238,${0.25 + gs * 0.5})`;

    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
    ctx.lineWidth = Math.max(10, r * 0.14); ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.stroke();

    if (f > 0.002) {
      const grd = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
      grd.addColorStop(0, '#22D3EE'); grd.addColorStop(.5, '#818cf8'); grd.addColorStop(1, '#A855F7');
      ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, Math.PI + f * Math.PI);
      ctx.lineWidth = Math.max(10, r * 0.14); ctx.strokeStyle = grd; ctx.lineCap = 'round'; ctx.stroke();

      const g2 = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
      g2.addColorStop(0, `rgba(34,211,238,${0.18 + gs * 0.32})`);
      g2.addColorStop(1, `rgba(168,85,247,${0.14 + gs * 0.28})`);
      ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, Math.PI + f * Math.PI);
      ctx.lineWidth = (r * 0.2) + gs * (r * 0.12); ctx.strokeStyle = g2;
      ctx.globalAlpha = 0.4 + gs * 0.25; ctx.stroke(); ctx.globalAlpha = 1;
    }

    for (let i = 0; i <= 10; i++) {
      const a = Math.PI + (i / 10) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r + 9), cy + Math.sin(a) * (r + 9));
      ctx.lineTo(cx + Math.cos(a) * (i % 5 === 0 ? r - r * 0.17 : r - r * 0.09), cy + Math.sin(a) * (i % 5 === 0 ? r - r * 0.17 : r - r * 0.09));
      ctx.lineWidth = i % 5 === 0 ? 1.5 : .7;
      ctx.strokeStyle = i % 5 === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)';
      ctx.stroke();
    }
    ctx.font = `400 ${Math.max(8, r * 0.09)}px Inter,sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.textAlign = 'center';
    ['0', '50', '100', '150', '200'].forEach((l, i) => {
      const a = Math.PI + (i / 4) * Math.PI;
      ctx.fillText(l, cx + Math.cos(a) * (r + 20), cy + Math.sin(a) * (r + 20) + 4);
    });

    const nA = Math.PI + f * Math.PI;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(nA);
    const ng = ctx.createLinearGradient(-r + r * 0.25, 0, 0, 0);
    ng.addColorStop(0, 'transparent'); ng.addColorStop(.6, '#22D3EE'); ng.addColorStop(1, '#fff');
    ctx.shadowBlur = 8 + gs * 18; ctx.shadowColor = '#22D3EE';
    ctx.beginPath(); ctx.moveTo(-r + r * 0.2, 0); ctx.lineTo(0, 0);
    ctx.lineWidth = 2.5; ctx.strokeStyle = ng; ctx.lineCap = 'round'; ctx.stroke();
    ctx.shadowBlur = 0; ctx.restore();

    ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fillStyle = '#0F172A'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#22D3EE'; ctx.shadowBlur = 10 + gs * 14; ctx.shadowColor = '#22D3EE'; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
  drawGauge(0);
  window.addEventListener('resize', () => drawGauge(running ? curDisplaySpeed / 200 : 0));

  // ═══ WAVE RENDERING ═══
  function drawWave() {
    if (!waveCanvas.isConnected) { waveRAF = requestAnimationFrame(drawWave); return; }
    const dpr = window.devicePixelRatio || 1;
    const RW = waveCanvas.offsetWidth || 320, RH = 54;
    if (waveCanvas.width !== Math.round(RW * dpr)) {
      waveCanvas.width = Math.round(RW * dpr);
      waveCanvas.height = Math.round(RH * dpr);
    }
    const ctx = waveCanvas.getContext('2d');
    ctx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
    ctx.save(); ctx.scale(dpr, dpr);
    const amp = running ? 7 + Math.min(curDisplaySpeed, 200) / 10 : 2.5;
    const freq = running ? .054 : .027;
    const g1 = ctx.createLinearGradient(0, 0, RW, 0);
    g1.addColorStop(0, 'rgba(34,211,238,0.75)'); g1.addColorStop(.5, 'rgba(125,211,252,0.85)'); g1.addColorStop(1, 'rgba(168,85,247,0.75)');
    ctx.beginPath();
    for (let x = 0; x < RW; x++) {
      const y = RH / 2 + Math.sin(x * freq + waveT) * amp + Math.sin(x * freq * 1.8 + waveT * 1.25) * (amp * .36);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = g1; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke();
    const g2 = ctx.createLinearGradient(0, 0, RW, 0);
    g2.addColorStop(0, 'rgba(168,85,247,0.36)'); g2.addColorStop(1, 'rgba(34,211,238,0.28)');
    ctx.beginPath();
    for (let x = 0; x < RW; x++) {
      const y = RH / 2 + Math.sin(x * freq * .84 + waveT * 1.2 + 1.3) * (amp * .6) + Math.sin(x * freq * 2.1 + waveT * .88) * (amp * .2);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = g2; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
    waveT += running ? .066 : .016;
    waveRAF = requestAnimationFrame(drawWave);
  }
  drawWave();

  // ═══ NETWORK INFO (real IP / ISP) ═══
  async function loadNetworkInfo() {
    $('srvDot').className = 'sdot checking';
    $('srvName').textContent = 'সার্ভার সংযোগ পরীক্ষা হচ্ছে…';
    $('srvSub').textContent = 'অনুগ্রহ করে অপেক্ষা করুন';
    $('ispName').textContent = 'IP তথ্য সনাক্ত করা হচ্ছে…';
    $('ispIp').textContent = '—';

    try {
      netInfo = await SpeedTest.getNetworkInfo();
      $('srvDot').className = 'sdot';
      const coloNames = { DAC: 'Dhaka', SIN: 'Singapore', BOM: 'Mumbai', MAA: 'Chennai', DEL: 'Delhi', HKG: 'Hong Kong', LHR: 'London', FRA: 'Frankfurt' };
      const coloLabel = netInfo.colo ? (coloNames[netInfo.colo] || netInfo.colo) : 'Cloudflare Edge';
      $('srvName').textContent = `Cloudflare — ${coloLabel}`;
      $('srvSub').textContent = netInfo.colo ? `এজ নোড: ${netInfo.colo}` : 'সংযুক্ত';

      $('ispName').textContent = netInfo.isp || 'অজানা প্রোভাইডার';
      $('ispIp').textContent = netInfo.ip || '—';
      $('ispCountry').textContent = netInfo.city ? `${netInfo.city}` : (netInfo.country || '—');
    } catch (e) {
      $('srvDot').className = 'sdot bad';
      $('srvName').textContent = 'সংযোগ ব্যর্থ হয়েছে';
      $('srvSub').textContent = 'ইন্টারনেট সংযোগ পরীক্ষা করুন';
      $('ispName').textContent = 'তথ্য পাওয়া যায়নি';
      $('ispIp').textContent = '—';
      $('ispCountry').textContent = '—';
    }
  }
  loadNetworkInfo();
  $('srvRefresh').addEventListener('click', (e) => {
    e.stopPropagation();
    loadNetworkInfo();
    haptic('রিফ্রেশ হচ্ছে', [15]);
  });

  // ═══ SPEED TEST FLOW (REAL) ═══
  function setPhase(txt, cls = '') {
    const b = $('phaseBadge');
    b.textContent = txt;
    b.className = 'phase-badge' + (cls ? ' ' + cls : '');
  }
  function litStat(id, cls) {
    const el = $(id);
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 1500);
  }
  function setQuality(mbps) {
    const qc = mbps > 80 ? '#22D3EE' : mbps > 40 ? '#10B981' : mbps > 15 ? '#f59e0b' : mbps > 0 ? '#ef4444' : 'rgba(255,255,255,0.07)';
    const wc = $('waveCard');
    if (wc) wc.style.borderColor = qc;
  }
  function getGrade(dl) {
    if (dl > 100) return 'A+'; if (dl > 50) return 'A'; if (dl > 25) return 'B'; if (dl > 10) return 'C'; return 'D';
  }

  $('startBtn').addEventListener('click', () => {
    if (running) stopTest(); else startTest();
  });

  async function startTest() {
    if (!navigator.onLine) {
      toast('ইন্টারনেট সংযোগ পাওয়া যাচ্ছে না', true);
      haptic('সংযোগ নেই', [80]);
      return;
    }

    running = true;
    SpeedTest.resetAbort();
    dlResult = 0; ulResult = 0; pingVal = 0; jitterVal = 0; curDisplaySpeed = 0;
    $('gaugeSection').classList.remove('idle', 'done');
    $('gaugeSection').classList.add('running');
    $('sOuter').classList.add('go');
    $('btnIcon').textContent = '■';
    $('btnLbl').textContent = 'থামুন';
    $('vPing').textContent = '—'; $('vDl').textContent = '—'; $('vUl').textContent = '—';
    $('shareBtn').disabled = true;
    setQuality(0);
    haptic('পরীক্ষা শুরু', [30, 20, 30]);

    try {
      // ── PHASE 1: PING ──
      setPhase('লেটেন্সি পরিমাপ করা হচ্ছে…');
      const pingRes = await SpeedTest.measurePing(6, (rtt, i, total) => {
        if (!running) return;
        const frac = Math.min(rtt / 200, 1);
        drawGauge(frac);
        $('speedNum').textContent = Math.round(rtt);
        $('speedUnit').textContent = 'MS';
        litStat('sc-ping', 'active-ping');
        $('vPing').textContent = Math.round(rtt);
      });
      if (!running) return;
      pingVal = pingRes.ping;
      jitterVal = pingRes.jitter;
      $('vPing').textContent = pingVal;
      litStat('sc-ping', 'active-ping');

      // ── PHASE 2: DOWNLOAD ──
      setPhase('ডাউনলোড পরীক্ষা হচ্ছে…');
      let peakFiredDl = false;
      const dlRes = await SpeedTest.measureDownload({
        durationMs: 8000,
        onProgress: (mbps, bytes, elapsed) => {
          if (!running) return;
          curDisplaySpeed = mbps;
          drawGauge(Math.min(mbps / 200, 1));
          $('speedNum').textContent = fmtSpd(mbps);
          $('speedUnit').textContent = unitMbps ? 'MBPS' : 'MB/S';
          $('vDl').textContent = fmtSpd(mbps);
          litStat('sc-dl', 'active-dl');
          setQuality(mbps);
          if (!peakFiredDl && mbps > 60) { haptic('পিক স্পিড!', [18]); peakFiredDl = true; }
        }
      });
      if (!running) return;
      dlResult = dlRes.mbps;
      $('vDl').textContent = fmtSpd(dlResult);

      // ── PHASE 3: UPLOAD ──
      setPhase('আপলোড পরীক্ষা হচ্ছে…');
      let peakFiredUl = false;
      const ulRes = await SpeedTest.measureUpload({
        durationMs: 6000,
        onProgress: (mbps, bytes, elapsed) => {
          if (!running) return;
          curDisplaySpeed = mbps;
          drawGauge(Math.min(mbps / 100, 1));
          $('speedNum').textContent = fmtSpd(mbps);
          $('speedUnit').textContent = unitMbps ? 'MBPS' : 'MB/S';
          $('vUl').textContent = fmtSpd(mbps);
          litStat('sc-ul', 'active-ul');
          if (!peakFiredUl && mbps > 25) { haptic('পিক স্পিড!', [18]); peakFiredUl = true; }
        }
      });
      if (!running) return;
      ulResult = ulRes.mbps;
      $('vUl').textContent = fmtSpd(ulResult);

      finishTest();
    } catch (err) {
      if (running) {
        setPhase('পরীক্ষা ব্যর্থ হয়েছে — আবার চেষ্টা করুন', 'err');
        toast('নেটওয়ার্ক সমস্যা হয়েছে, আবার চেষ্টা করুন', true);
        haptic('ব্যর্থ', [80, 40, 80]);
        resetButton();
        running = false;
      }
    }
  }

  function finishTest() {
    running = false;
    curDisplaySpeed = dlResult;
    $('speedNum').textContent = fmtSpd(dlResult);
    $('speedUnit').textContent = unitMbps ? 'MBPS' : 'MB/S';
    setPhase('✓ পরীক্ষা সম্পন্ন', 'ok');
    drawGauge(Math.min(dlResult / 200, 1));
    $('gaugeSection').classList.remove('idle', 'running');
    $('gaugeSection').classList.add('done');
    resetButton('↺', 'আবার');
    $('shareBtn').disabled = false;
    haptic('পরীক্ষা সম্পন্ন', [50, 30, 80, 30, 50]);

    const entry = {
      isp: (netInfo && netInfo.isp) || 'অজানা',
      ip: (netInfo && netInfo.ip) || '—',
      ts: new Date().toISOString(),
      ping: pingVal,
      jitter: jitterVal,
      dl: parseFloat(dlResult.toFixed(2)),
      ul: parseFloat(ulResult.toFixed(2)),
    };
    history.unshift(entry);
    if (history.length > 100) history.pop();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch (e) {}
  }

  function stopTest() {
    running = false;
    SpeedTest.abort();
    curDisplaySpeed = 0;
    setPhase('পরীক্ষা বন্ধ করা হয়েছে', 'warn');
    $('gaugeSection').classList.remove('running', 'done');
    $('gaugeSection').classList.add('idle');
    resetButton();
    drawGauge(0);
    setQuality(0);
  }

  function resetButton(icon = '▶', label = 'শুরু') {
    $('sOuter').classList.remove('go');
    $('btnIcon').textContent = icon;
    $('btnLbl').textContent = label;
  }

  // ═══ HISTORY ═══
  function renderHistory() {
    const el = $('histList');
    const statsEl = $('histStats');
    if (!history.length) {
      statsEl.style.display = 'none';
      el.innerHTML = `<div class="hist-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        <div class="hist-empty-title">এখনো কোনো পরীক্ষা নেই</div>
        <div class="hist-empty-sub">প্রথম স্পিড টেস্ট চালান</div>
      </div>`;
      return;
    }
    statsEl.style.display = 'grid';
    const avgDl = history.reduce((s, h) => s + h.dl, 0) / history.length;
    const avgUl = history.reduce((s, h) => s + h.ul, 0) / history.length;
    $('avgDl').textContent = avgDl.toFixed(1);
    $('avgUl').textContent = avgUl.toFixed(1);
    $('totalTests').textContent = history.length;

    el.innerHTML = history.map((h, idx) => {
      const d = new Date(h.ts);
      const ts = d.toLocaleDateString('bn-BD', { day: '2-digit', month: 'short' }) + ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const g = getGrade(h.dl);
      const gc = g.startsWith('A') ? 'A' : g;
      return `<div class="hist-item">
        <button class="hist-del" data-idx="${idx}" aria-label="মুছুন">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
        <div class="hist-top">
          <div class="hist-isp">${escapeHtml(h.isp)}<span class="grade-badge grade-${gc}">${g}</span></div>
          <div class="hist-ts">${ts}</div>
        </div>
        <div class="hist-speeds">
          <div class="hist-speed dl"><div style="font-size:9px;color:var(--text3)">↓ ডাউনলোড</div><strong>${h.dl.toFixed(1)}</strong> <span style="font-size:10px;color:var(--text3)">Mbps</span></div>
          <div class="hist-speed ul"><div style="font-size:9px;color:var(--text3)">↑ আপলোড</div><strong>${h.ul.toFixed(1)}</strong> <span style="font-size:10px;color:var(--text3)">Mbps</span></div>
        </div>
        <div class="hist-meta">Ping: ${h.ping} ms · Jitter: ${h.jitter} ms · IP: ${escapeHtml(h.ip)}</div>
      </div>`;
    }).join('');

    el.querySelectorAll('.hist-del').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx, 10);
        history.splice(idx, 1);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch (e) {}
        renderHistory();
        haptic('মুছে ফেলা হয়েছে', [15]);
      });
    });
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  $('clearHistBtn').addEventListener('click', () => {
    if (!history.length) return;
    if (confirm('সমস্ত ইতিহাস মুছে ফেলতে চান?')) {
      history = [];
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      renderHistory();
      haptic('ইতিহাস মুছে ফেলা হয়েছে', [30, 20, 30]);
    }
  });

  // ═══ SHARE MODAL ═══
  $('shareBtn').addEventListener('click', openShareModal);
  function openShareModal() {
    if (dlResult <= 0) return;
    const now = new Date();
    $('scDate').textContent = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' · ' + now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    $('scDl').textContent = fmtSpd(dlResult);
    $('scUl').textContent = fmtSpd(ulResult);
    $('scUnitDl').textContent = fmtUnit();
    $('scUnitUl').textContent = fmtUnit();
    $('scPing').textContent = pingVal + ' ms';
    $('scJitter').textContent = jitterVal + ' ms';
    $('scGrade').textContent = getGrade(dlResult);
    $('scIsp').textContent = (netInfo && netInfo.isp) || 'অজানা';
    $('scIpTxt').textContent = (netInfo && netInfo.ip) || '—';
    $('shareModal').classList.add('open');
    haptic('শেয়ার মেনু', [15, 10, 15]);
  }
  $('modalCloseBtn').addEventListener('click', closeModal);
  $('shareModal').addEventListener('click', (e) => { if (e.target.id === 'shareModal') closeModal(); });
  function closeModal() { $('shareModal').classList.remove('open'); }

  $('copyBtn').addEventListener('click', async () => {
    const txt = `⚡ SpeedLab পরীক্ষার ফলাফল\n` +
      `↓ ডাউনলোড: ${fmtSpd(dlResult)} ${fmtUnit()}\n` +
      `↑ আপলোড: ${fmtSpd(ulResult)} ${fmtUnit()}\n` +
      `Ping: ${pingVal}ms · Jitter: ${jitterVal}ms\n` +
      `ISP: ${(netInfo && netInfo.isp) || 'অজানা'} · Grade: ${getGrade(dlResult)}\n` +
      `#MySpeedTest #SpeedLab`;

    const btn = $('copyBtn');
    try {
      if (navigator.share) {
        await navigator.share({ title: 'SpeedLab Result', text: txt });
        haptic('শেয়ার হয়েছে', [20]);
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(txt);
        btn.innerHTML = '✓ কপি হয়েছে!';
        btn.style.color = 'var(--green)'; btn.style.borderColor = 'rgba(16,185,129,0.4)';
        haptic('কপি হয়েছে', [20]);
        setTimeout(() => {
          btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> কপি করুন';
          btn.style.color = ''; btn.style.borderColor = '';
        }, 2200);
      }
    } catch (e) { /* user cancelled share — ignore */ }
  });

  // ═══ PWA INSTALL PROMPT ═══
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    $('installBtn').style.display = 'flex';
  });
  $('installBtn').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    if (choice.outcome === 'accepted') toast('অ্যাপ ইনস্টল করা হচ্ছে…');
    deferredInstallPrompt = null;
    $('installBtn').style.display = 'none';
  });
  window.addEventListener('appinstalled', () => {
    toast('SpeedLab সফলভাবে ইনস্টল হয়েছে!');
    haptic('ইনস্টল সম্পন্ন', [40, 20, 40]);
  });

  // ═══ ONLINE/OFFLINE AWARENESS ═══
  window.addEventListener('offline', () => {
    toast('ইন্টারনেট সংযোগ বিচ্ছিন্ন হয়েছে', true);
    if (running) stopTest();
  });
  window.addEventListener('online', () => {
    toast('ইন্টারনেট সংযোগ পুনরুদ্ধার হয়েছে');
    loadNetworkInfo();
  });

  // ═══ SERVICE WORKER REGISTRATION ═══
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {
        // Registration failure is non-fatal — app still works without offline cache
      });
    });
  }

})();
