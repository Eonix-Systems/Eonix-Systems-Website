/* =============================================================================
   DIAGRAM.JS — Professional System Architecture Visualizer v2
   =============================================================================
   Colors:
     Data / CAN  → #38b6ff (site accent blue)
     Power       → #F59E0B (amber)

   Animation:
     Signal packets — small dots travel along active connection paths.

   Layout (normalized 0-1 coords):
     Row 1  Y=0.13  [App]           [MCU]
     Row 2  Y=0.31  [──── Motherboard ────]
     Row 3  Y=0.51  [═══════ CAN BUS ═══════════════]
     Row 4  Y=0.73  [TEMP][IMU][DIST]  [PWR]  [DRV][MOT]
     Row 5  Y=0.88                     [BAT]

   API:
     window.activeDiagramStep  (1–4)   set by ecoSelectStep() in ecosystem.html
     window.forceHoverNodeId   (str)   set by layer card hover
   ============================================================================= */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('systemCanvas');
  if (!canvas) return;
  const overlay = document.querySelector('.diagram-overlay');
  const ctx = canvas.getContext('2d');

  /* ─── Color constants ─────────────────────────────────── */
  const C = {
    bg:           '#FAFAFA',
    nodeFill:     '#FFFFFF',
    nodeBorder:   'rgba(0,0,0,0.1)',
    majorFill:    '#F0F7FF',
    majorBorder:  'rgba(56,182,255,0.45)',
    powerFill:    'rgba(245,158,11,0.07)',
    powerBorder:  'rgba(245,158,11,0.45)',
    text:         '#111111',
    textSub:      '#666666',
    textBlue:     '#38b6ff',
    data:         '#38b6ff',
    power:        '#F59E0B',
    dimAlpha:     0.1,
  };

  /* ─── State ───────────────────────────────────────────── */
  let time = 0;
  const LERP = 0.11;
  const alphas = {};
  const glows  = {};
  const lAlpha = {};

  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ─── Canvas sizing ───────────────────────────────────── */
  function resize() {
    const par = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const w   = par.clientWidth;
    const h   = Math.min(700, Math.max(460, w * 0.58));
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(resize);
  window.addEventListener('load', resize);

  const REF_W = 1200, REF_H = 700;
  function S()   { return Math.min(canvas.width / REF_W, canvas.height / REF_H * 1.4); }
  function cx(x) { return x * canvas.width; }
  function cy(y) { return y * canvas.height; }

  /* ─── Layout ──────────────────────────────────────────── */
  const Y_TOP = 0.13, Y_MB = 0.31, Y_CAN = 0.51, Y_MOD = 0.73, Y_BAT = 0.88;
  const X_APP = 0.30, X_MCU = 0.72, X_MB  = 0.50;
  const X_TEMP = 0.08, X_IMU = 0.20, X_DIST = 0.32;
  const X_PWR  = 0.52, X_DRV = 0.70, X_MOT  = 0.87;

  const NODES = [
    { id:'APP',  x:X_APP,  y:Y_TOP, label:'Eonix App',        sub:'Desktop Interface',  type:'std',   w:118, h:44 },
    { id:'MCU',  x:X_MCU,  y:Y_TOP, label:'User MCU',         sub:'Arduino / Custom',   type:'std',   w:118, h:44 },
    { id:'MB',   x:X_MB,   y:Y_MB,  label:'EONIX MOTHERBOARD',sub:'Central Controller', type:'major', w:210, h:54 },
    { id:'TEMP', x:X_TEMP, y:Y_MOD, label:'Temp',             sub:'Sensor',             type:'std',   w: 92, h:40 },
    { id:'IMU',  x:X_IMU,  y:Y_MOD, label:'IMU',              sub:'Sensor',             type:'std',   w: 82, h:40 },
    { id:'DIST', x:X_DIST, y:Y_MOD, label:'LiDAR',            sub:'Sensor',             type:'std',   w: 82, h:40 },
    { id:'PWR',  x:X_PWR,  y:Y_MOD, label:'POWER BLOCK',      sub:'CC/CV + OCP/SCP',    type:'power', w:138, h:46 },
    { id:'DRV',  x:X_DRV,  y:Y_MOD, label:'Motor Driver',     sub:'High-Current',       type:'std',   w:112, h:40 },
    { id:'MOT',  x:X_MOT,  y:Y_MOD, label:'Motor',            sub:'Load',               type:'std',   w: 76, h:40 },
    { id:'BAT',  x:X_PWR,  y:Y_BAT, label:'Battery',          sub:'Power Source',       type:'std',   w: 96, h:40 },
    { id:'CAN',  x:0.50,   y:Y_CAN, label:'',                 sub:'',                   type:'bus',   w:900, h:28 },
  ];

  const LINE_IDS = ['APP_MB','MCU_MB','MB_CAN','STUBS','PWR_BAT','PWR_DRV','DRV_MOT'];
  NODES.forEach(n => { alphas[n.id] = 1.0; glows[n.id] = 0; });
  LINE_IDS.forEach(k => { lAlpha[k] = 1.0; });

  /* ─── Tooltips ────────────────────────────────────────── */
  const TIPS = {
    MB:   'Central controller — coordinates all modules, manages state and routing.',
    PWR:  'Programmable CC/CV power with hardware OCP, SCP, and real-time telemetry.',
    TEMP: 'Structured temperature output over CAN. No raw ADC wiring required.',
    IMU:  'Inertial data delivered as structured CAN frames.',
    DIST: 'LiDAR/distance data with hardware abstraction layer.',
    DRV:  'High-current motor driver with fault protection and CAN control interface.',
    CAN:  'Deterministic multi-node backbone — 800 kbps, arbitration-free.',
    APP:  'Desktop interface for configuration, telemetry, and system diagnostics.',
    MCU:  'External MCU integration via SPI bridge on the motherboard.',
    BAT:  'System power source — actively monitored and protected by Power Block.',
    MOT:  'Physical load driven and monitored through the Motor Driver module.',
  };

  let hoverNode = null;

  canvas.addEventListener('mousemove', e => {
    const r  = canvas.getBoundingClientRect();
    const sx = canvas.width  / r.width;
    const sy = canvas.height / r.height;
    const mx = (e.clientX - r.left) * sx;
    const my = (e.clientY - r.top)  * sy;
    const s  = S();
    let found = null;
    for (const nd of NODES) {
      if (nd.type === 'bus') continue;
      const nw = nd.w * s, nh = nd.h * s;
      if (Math.abs(mx - cx(nd.x)) < nw / 2 + 5 && Math.abs(my - cy(nd.y)) < nh / 2 + 5) {
        found = nd; break;
      }
    }
    if (found !== hoverNode) { hoverNode = found; showTooltip(); }
    canvas.style.cursor = (found && TIPS[found.id]) ? 'pointer' : 'default';
  });
  canvas.addEventListener('mouseleave', () => { hoverNode = null; showTooltip(); });

  function showTooltip() {
    overlay.innerHTML = '';
    const active = hoverNode || (window.forceHoverNodeId
      ? NODES.find(n => n.id === window.forceHoverNodeId) : null);
    if (!active || !TIPS[active.id]) return;
    const tip = document.createElement('div');
    tip.textContent = TIPS[active.id];
    const dpr = window.devicePixelRatio || 1;
    const s   = S();
    const px  = cx(active.x) / dpr;
    const py  = cy(active.y) / dpr;
    const nw  = (active.w * s) / dpr;
    const cw  = canvas.width / dpr;
    Object.assign(tip.style, {
      position: 'absolute', padding: '10px 14px', borderRadius: '6px',
      fontSize: '0.82rem', lineHeight: '1.6', maxWidth: '230px',
      background: '#fff', border: '1px solid rgba(56,182,255,0.3)',
      color: '#111', pointerEvents: 'none', zIndex: '200',
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    });
    if (px > cw * 0.6) tip.style.right = (cw - px + nw / 2 + 12) + 'px';
    else                tip.style.left  = (px + nw / 2 + 12) + 'px';
    tip.style.top = (py - 22) + 'px';
    overlay.appendChild(tip);
  }

  /* ─── State engine ────────────────────────────────────── */
  function getTargets() {
    const step   = window.activeDiagramStep || 0;
    const forced = window.forceHoverNodeId || (hoverNode ? hoverNode.id : null);

    const tA = {}; NODES.forEach(n => { tA[n.id] = C.dimAlpha; });
    const tG = {}; NODES.forEach(n => { tG[n.id] = 0; });
    const tL = {}; LINE_IDS.forEach(k => { tL[k] = C.dimAlpha; });

    const on  = ids  => ids.forEach(id => { tA[id] = 1.0; });
    const glo = (id, v) => { tG[id] = v; };
    const ln  = ids  => ids.forEach(k  => { tL[k]  = 1.0; });

    if (forced) {
      on([forced]); glo(forced, 1.0);
      if (forced === 'MB')            { on(['APP','MCU','CAN']); ln(['APP_MB','MCU_MB','MB_CAN']); }
      if (forced === 'APP')           { on(['MB']);              ln(['APP_MB']); }
      if (forced === 'MCU')           { on(['MB']);              ln(['MCU_MB']); }
      if (forced === 'CAN')           { on(['MB','TEMP','IMU','DIST','PWR','DRV']); ln(['MB_CAN','STUBS']); glo('CAN', 0.9); }
      if (forced === 'PWR' || forced === 'BAT') { on(['BAT']); ln(['PWR_BAT']); glo('PWR',0.8); }
      if (forced === 'DRV' || forced === 'MOT') { on(['MOT','PWR']); ln(['DRV_MOT','PWR_DRV']); }
      if (['TEMP','IMU','DIST'].includes(forced)) { on(['CAN','MB']); ln(['STUBS','MB_CAN']); }
    } else if (step === 0 || !step) {
      NODES.forEach(n => { tA[n.id] = 1.0; });
      LINE_IDS.forEach(k => { tL[k] = 1.0; });
    } else if (step === 1) {            /* CONTROL */
      on(['MB','APP','MCU']); ln(['APP_MB','MCU_MB']);
      glo('MB', 1.0);
    } else if (step === 2) {            /* COMMUNICATION */
      on(['CAN','MB','TEMP','IMU','DIST','DRV','PWR']); ln(['MB_CAN','STUBS']);
      glo('CAN', 1.0); glo('MB', 0.4);
    } else if (step === 3) {            /* POWER */
      on(['PWR','BAT','DRV','MOT']); ln(['PWR_BAT','PWR_DRV','DRV_MOT']);
      glo('PWR', 1.0); glo('BAT', 0.5); glo('DRV', 0.4);
    } else if (step === 4) {            /* EXECUTION */
      on(['TEMP','IMU','DIST','DRV','MOT','CAN']); ln(['STUBS','DRV_MOT','MB_CAN']);
      glo('MOT', 1.0); glo('DRV', 0.8);
      glo('TEMP', 0.5); glo('IMU', 0.5); glo('DIST', 0.5);
    }

    return { tA, tG, tL, step };
  }

  /* ─── Signal packets ──────────────────────────────────── */
  const packets = [];

  function pathPoint(pts, t) {
    let total = 0;
    const segs = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const dx = pts[i+1][0] - pts[i][0], dy = pts[i+1][1] - pts[i][1];
      const l  = Math.sqrt(dx*dx + dy*dy);
      segs.push(l); total += l;
    }
    if (!total) return null;
    let d = t * total;
    for (let i = 0; i < segs.length; i++) {
      if (d <= segs[i]) {
        const f = d / segs[i];
        return { x: pts[i][0] + (pts[i+1][0]-pts[i][0])*f,
                 y: pts[i][1] + (pts[i+1][1]-pts[i][1])*f };
      }
      d -= segs[i];
    }
    return { x: pts[pts.length-1][0], y: pts[pts.length-1][1] };
  }

  function spawnPackets() {
    const s = S();

    function maybeSpawn(lineName, path, color, speed, rate) {
      if ((lAlpha[lineName] || 0) > 0.4 && Math.random() < (rate || 0.022)) {
        packets.push({ t: 0, path, color, speed: speed || 0.007 });
      }
    }

    // APP → MB (down then right)
    maybeSpawn('APP_MB',
      [[cx(X_APP), cy(Y_TOP)+22*s], [cx(X_APP), cy(Y_MB)], [cx(X_MB)-105*s, cy(Y_MB)]],
      C.data, 0.007);

    // MCU → MB (down then left)
    maybeSpawn('MCU_MB',
      [[cx(X_MCU), cy(Y_TOP)+22*s], [cx(X_MCU), cy(Y_MB)], [cx(X_MB)+105*s, cy(Y_MB)]],
      C.data, 0.007);

    // MB → CAN (down)
    maybeSpawn('MB_CAN',
      [[cx(X_MB), cy(Y_MB)+27*s], [cx(X_MB), cy(Y_CAN)-14*s]],
      C.data, 0.009, 0.03);

    // CAN stubs → modules
    [X_TEMP, X_IMU, X_DIST, X_PWR, X_DRV].forEach(xn => {
      maybeSpawn('STUBS',
        [[cx(xn), cy(Y_CAN)+14*s], [cx(xn), cy(Y_MOD)-20*s]],
        C.data, 0.010, 0.018);
    });

    // Power: PWR → BAT
    maybeSpawn('PWR_BAT',
      [[cx(X_PWR), cy(Y_MOD)+23*s], [cx(X_PWR), cy(Y_BAT)-20*s]],
      C.power, 0.008);

    // Power: PWR → DRV
    maybeSpawn('PWR_DRV',
      [[cx(X_PWR)+69*s, cy(Y_MOD)], [cx(X_DRV)-56*s, cy(Y_MOD)]],
      C.power, 0.009);

    // Power: DRV → MOT
    maybeSpawn('DRV_MOT',
      [[cx(X_DRV)+56*s, cy(Y_MOD)], [cx(X_MOT)-38*s, cy(Y_MOD)]],
      C.power, 0.010);
  }

  function tickAndDrawPackets() {
    spawnPackets();
    const s = S();
    for (let i = packets.length - 1; i >= 0; i--) {
      packets[i].t += packets[i].speed;
      if (packets[i].t >= 1.0) { packets.splice(i, 1); continue; }
      const pos = pathPoint(packets[i].path, packets[i].t);
      if (!pos) continue;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 2.8 * s, 0, Math.PI * 2);
      ctx.fillStyle   = packets[i].color;
      ctx.shadowColor = packets[i].color;
      ctx.shadowBlur  = 10 * s;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  /* ─── Drawing: connection line ────────────────────────── */
  function line(pts, color, a, thick) {
    if (pts.length < 2 || a < 0.02) return;
    const s = S();
    ctx.globalAlpha = a;
    ctx.strokeStyle = color;
    ctx.lineWidth   = (thick || 1.5) * s;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }

  /* small filled dot at a connection point */
  function dot(x, y, color, a) {
    if (a < 0.05) return;
    const s = S();
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(x, y, 3.5 * s, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }

  /* ─── Drawing: connections ────────────────────────────── */
  function drawConnections() {
    const s = S();

    const aAPP = lAlpha['APP_MB']  || 0;
    const aMCU = lAlpha['MCU_MB']  || 0;
    const aCAN = lAlpha['MB_CAN']  || 0;
    const aST  = lAlpha['STUBS']   || 0;
    const aPB  = lAlpha['PWR_BAT'] || 0;
    const aPD  = lAlpha['PWR_DRV'] || 0;
    const aDM  = lAlpha['DRV_MOT'] || 0;

    /* APP → MB */
    line([[cx(X_APP), cy(Y_TOP)+22*s], [cx(X_APP), cy(Y_MB)], [cx(X_MB)-105*s, cy(Y_MB)]], C.data, aAPP);
    dot(cx(X_APP), cy(Y_MB), C.data, aAPP);
    dot(cx(X_MB)-105*s, cy(Y_MB), C.data, aAPP);

    /* MCU → MB */
    line([[cx(X_MCU), cy(Y_TOP)+22*s], [cx(X_MCU), cy(Y_MB)], [cx(X_MB)+105*s, cy(Y_MB)]], C.data, aMCU);
    dot(cx(X_MCU), cy(Y_MB), C.data, aMCU);
    dot(cx(X_MB)+105*s, cy(Y_MB), C.data, aMCU);

    /* MB → CAN */
    line([[cx(X_MB), cy(Y_MB)+27*s], [cx(X_MB), cy(Y_CAN)-14*s]], C.data, aCAN, 2);
    dot(cx(X_MB), cy(Y_CAN)-14*s, C.data, aCAN);

    /* CAN stubs ↓ to each module */
    [X_TEMP, X_IMU, X_DIST, X_PWR, X_DRV].forEach(xn => {
      line([[cx(xn), cy(Y_CAN)+14*s], [cx(xn), cy(Y_MOD)-20*s]], C.data, aST);
      dot(cx(xn), cy(Y_CAN)+14*s, C.data, aST * 0.7);
    });

    /* Power: PWR → BAT */
    line([[cx(X_PWR), cy(Y_MOD)+23*s], [cx(X_PWR), cy(Y_BAT)-20*s]], C.power, aPB, 2.5);
    dot(cx(X_PWR), cy(Y_BAT)-20*s, C.power, aPB);

    /* Power: PWR → DRV */
    line([[cx(X_PWR)+69*s, cy(Y_MOD)], [cx(X_DRV)-56*s, cy(Y_MOD)]], C.power, aPD, 2.5);
    dot(cx(X_DRV)-56*s, cy(Y_MOD), C.power, aPD);

    /* Power: DRV → MOT */
    line([[cx(X_DRV)+56*s, cy(Y_MOD)], [cx(X_MOT)-38*s, cy(Y_MOD)]], C.power, aDM, 2.5);
    dot(cx(X_MOT)-38*s, cy(Y_MOD), C.power, aDM);
  }

  /* ─── Drawing: CAN bus rail ───────────────────────────── */
  function drawBus() {
    const s    = S();
    const a    = Math.max(lAlpha['MB_CAN']||0, lAlpha['STUBS']||0, alphas['CAN']||0);
    const glow = glows['CAN'] || 0;
    const x    = cx(0.50), y = cy(Y_CAN);
    const bw   = 900 * s, bh = 28 * s;

    ctx.globalAlpha = Math.max(a, 0.1);
    if (glow > 0.3) { ctx.shadowColor = C.data; ctx.shadowBlur = 14 * s * glow; }

    ctx.beginPath();
    ctx.roundRect(x - bw/2, y - bh/2, bw, bh, bh/2);
    ctx.fillStyle   = `rgba(56,182,255,${0.05 + glow * 0.1})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(56,182,255,${0.25 + glow * 0.45})`;
    ctx.lineWidth   = 1.5 * s;
    ctx.stroke();
    ctx.shadowBlur  = 0;

    ctx.fillStyle    = `rgba(56,182,255,${0.45 + glow * 0.5})`;
    ctx.font         = `600 ${Math.max(8, 10 * s)}px 'JetBrains Mono', monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CAN BUS  ·  800 kbps  ·  DETERMINISTIC  ·  ARBITRATION-FREE', x, y);
    ctx.globalAlpha = 1.0;
  }

  /* ─── Drawing: single node ────────────────────────────── */
  function drawNode(nd) {
    const s  = S();
    const x  = cx(nd.x), y = cy(nd.y);
    const nw = nd.w * s,  nh = nd.h * s;
    const a  = alphas[nd.id];
    const g  = glows[nd.id];
    const isMajor = nd.type === 'major';
    const isPower = nd.type === 'power';
    const r   = 7 * s;

    ctx.globalAlpha = a;

    /* glow */
    if (g > 0.15) {
      ctx.shadowColor = isPower ? C.power : C.data;
      ctx.shadowBlur  = 22 * s * g;
    }

    /* fill */
    ctx.beginPath(); ctx.roundRect(x - nw/2, y - nh/2, nw, nh, r);
    ctx.fillStyle = isMajor ? C.majorFill : (isPower ? C.powerFill : C.nodeFill);
    ctx.fill();

    /* border */
    ctx.strokeStyle = isMajor ? C.majorBorder
                    : isPower ? (g > 0.2 ? C.power  : C.powerBorder)
                    :           (g > 0.2 ? C.data   : C.nodeBorder);
    ctx.lineWidth   = (isMajor || isPower ? 1.5 : 1) * s;
    ctx.stroke();
    ctx.shadowBlur = 0;

    /* corner brackets on major / power nodes */
    if (isMajor || isPower) {
      const bc  = isPower ? C.power : C.data;
      const cL  = 9 * s;
      const bA  = a * (0.4 + g * 0.6);
      ctx.strokeStyle = bc;
      ctx.lineWidth   = 1.5 * s;
      ctx.globalAlpha = bA;
      const corners = [
        [x-nw/2, y-nh/2, 1, 1], [x+nw/2, y-nh/2, -1, 1],
        [x-nw/2, y+nh/2, 1,-1], [x+nw/2, y+nh/2, -1,-1],
      ];
      corners.forEach(([bx, by, dx, dy]) => {
        ctx.beginPath();
        ctx.moveTo(bx, by + dy*cL); ctx.lineTo(bx, by); ctx.lineTo(bx + dx*cL, by);
        ctx.stroke();
      });
      ctx.globalAlpha = a;
    }

    /* labels */
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    if (isMajor) {
      ctx.fillStyle = g > 0.3 ? C.textBlue : '#1a1a1a';
      ctx.font      = `700 ${Math.max(10, 13 * s)}px 'JetBrains Mono', monospace`;
      ctx.fillText(nd.label, x, y - 8 * s);
      ctx.fillStyle = C.textSub;
      ctx.font      = `400 ${Math.max(8, 9 * s)}px 'Plus Jakarta Sans', sans-serif`;
      ctx.fillText(nd.sub, x, y + 9 * s);
    } else if (isPower) {
      ctx.fillStyle = g > 0.3 ? C.power : '#333';
      ctx.font      = `700 ${Math.max(9, 11 * s)}px 'JetBrains Mono', monospace`;
      ctx.fillText(nd.label, x, y - 8 * s);
      ctx.fillStyle = C.textSub;
      ctx.font      = `400 ${Math.max(7, 9 * s)}px 'Plus Jakarta Sans', sans-serif`;
      ctx.fillText(nd.sub, x, y + 8 * s);
    } else {
      ctx.fillStyle = '#111';
      ctx.font      = `600 ${Math.max(9, 11 * s)}px 'Plus Jakarta Sans', sans-serif`;
      ctx.fillText(nd.label, x, y - 6 * s);
      ctx.fillStyle = C.textSub;
      ctx.font      = `400 ${Math.max(7, 9 * s)}px 'JetBrains Mono', monospace`;
      ctx.fillText(nd.sub, x, y + 7 * s);
    }

    ctx.globalAlpha = 1.0;
  }

  /* ─── Drawing: layer labels ───────────────────────────── */
  function drawLayerLabel(txt, y) {
    const s = S();
    ctx.globalAlpha  = 0.28;
    ctx.fillStyle    = '#888';
    ctx.font         = `400 ${Math.max(7, 9 * s)}px 'JetBrains Mono', monospace`;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, cx(0.015), cy(y));
    ctx.globalAlpha  = 1.0;
  }

  /* ─── Drawing: legend ─────────────────────────────────── */
  function drawLegend() {
    const s  = S();
    const lx = cx(0.985), ly = cy(0.05);
    const items = [
      { color: C.data,  label: 'Data / CAN' },
      { color: C.power, label: 'Power' },
    ];
    ctx.textBaseline = 'middle';
    ctx.font = `400 ${Math.max(7, 9 * s)}px 'JetBrains Mono', monospace`;
    items.forEach(({ color, label }, i) => {
      const iy = ly + i * 18 * s;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle   = color;
      ctx.beginPath(); ctx.arc(lx - 8*s - (ctx.measureText(label).width + 18*s)*0.5, iy, 4*s, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle   = '#555';
      ctx.textAlign   = 'right';
      ctx.fillText(label, lx, iy);
      ctx.globalAlpha = 1.0;
    });
  }

  /* ─── Dot grid background ─────────────────────────────── */
  function drawGrid() {
    const s   = S();
    const gap = 44 * s;
    ctx.fillStyle = 'rgba(0,0,0,0.055)';
    for (let gx = gap / 2; gx < canvas.width; gx += gap) {
      for (let gy = gap / 2; gy < canvas.height; gy += gap) {
        ctx.beginPath();
        ctx.arc(gx, gy, 0.9 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /* ─── Main loop ───────────────────────────────────────── */
  function renderLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid();

    /* lerp state */
    const { tA, tG, tL } = getTargets();
    NODES.forEach(n => {
      alphas[n.id] = lerp(alphas[n.id], tA[n.id], LERP);
      glows[n.id]  = lerp(glows[n.id],  tG[n.id], LERP);
    });
    LINE_IDS.forEach(k => {
      lAlpha[k] = lerp(lAlpha[k], tL[k], LERP);
    });

    /* layer labels */
    drawLayerLabel('01 // CONTROL',      0.13);
    drawLayerLabel('02 // COORDINATION', 0.31);
    drawLayerLabel('03 // CAN BUS',      0.51);
    drawLayerLabel('04 // MODULES',      0.73);

    /* connections (below nodes) */
    drawConnections();

    /* CAN bus */
    drawBus();

    /* nodes */
    NODES.forEach(nd => { if (nd.type !== 'bus') drawNode(nd); });

    /* signal packets (on top) */
    tickAndDrawPackets();

    /* legend */
    drawLegend();

    time += 16;
    requestAnimationFrame(renderLoop);
  }

  renderLoop();
});
