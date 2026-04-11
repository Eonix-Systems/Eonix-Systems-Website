/* =============================================================================
   DIAGRAM.JS — Canvas-Based System Architecture Visualizer
   =============================================================================
   This is the most complex file in the project. It renders a real-time animated
   diagram of the Eonix hardware ecosystem using the HTML5 Canvas API.

   USED ON: ecosystem.html AND product.html (both have <canvas id="systemCanvas">)

   HOW IT WORKS — HIGH LEVEL:
   1. On DOMContentLoaded, it finds the canvas and sizes it to its container
   2. It defines NODES (boxes like Motherboard, CAN Bus, Sensors) with x/y positions
   3. It defines CONNECTIONS (lines between nodes)
   4. A requestAnimationFrame loop runs 60fps, redrawing the canvas each frame
   5. Each frame, it reads window.activeDiagramStep (1–4) to know what to highlight
   6. It uses LERP (linear interpolation) to smoothly animate between states

   GLOBAL STATE VARIABLES (set by the page, read by this file):
   - window.activeDiagramStep (number 1–4): Which architecture layer is active.
     Set by IntersectionObserver in ecosystem.html inline script (scroll-driven)
     or by switchSysTab() in product.html inline script (tab-driven)
   - window.forceHoverNodeId (string | null): Node ID to force-highlight.
     Set when user hovers over .arch-key-points bullet points in ecosystem.html.

   NODE IDs (used by forceHoverNodeId and CONNECTIONS):
   "APP"  → Desktop Application box
   "MCU"  → User MCU (Arduino etc.)
   "MB"   → Eonix Motherboard (central node)
   "CAN"  → CAN Bus bar (horizontal communication backbone)
   "TEMP" → Temperature Sensor module
   "IMU"  → IMU Sensor module
   "DIST" → Distance/LiDAR module
   "DRV"  → Motor Driver module
   "MOT"  → Motor (physical load)
   "PWR"  → Power Module
   "BAT"  → Battery

   STEP HIGHLIGHTING MAP:
   Step 1 (CONTROL)       → Highlights: APP, MCU, MB
   Step 2 (COMMUNICATION) → Highlights: CAN, all connected modules
   Step 3 (POWER)         → Highlights: PWR, BAT, their connections
   Step 4 (EXECUTION)     → Highlights: TEMP, IMU, DIST, DRV, MOT

   CANVAS COORDINATE SYSTEM:
   - All x/y values are NORMALIZED (0.0 to 1.0) relative to canvas size
   - cx(x) and cy(y) convert normalized coords to actual canvas pixels
   - S() returns a scale factor for responsive text/element sizing
   ============================================================================= */

document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("systemCanvas");
    if (!canvas) return;
    const overlay = document.querySelector(".diagram-overlay");
    const ctx = canvas.getContext("2d");
    
    let time = 0;
    
    // Smooth interpolators
    const LERP_RATE = 0.15;
    
    // Current rendered values
    const currentAlphas = {}; 
    const currentGlows = {};
    const lineAlphas = {};

    function lerp(start, end, amt) {
        return (1 - amt) * start + amt * end;
    }

    // ── Layout Constants ──────────────────────────────────────
    function resize() {
        const parent = canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;
        const displayWidth = parent.clientWidth; // Exactly fit container
        // Aspect-ratio based height so the full diagram is always visible
        const displayHeight = Math.min(640, Math.max(440, displayWidth * 0.6));
        canvas.style.width = displayWidth + "px";
        canvas.style.height = displayHeight + "px";
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    window.addEventListener("resize", resize);
    resize();

    const REF_W = 1200;
    const REF_H = 700;
    function S() { return Math.min(canvas.width / REF_W, canvas.height / REF_H * 1.5); }
    function cx(x) { return x * canvas.width; }
    function cy(y) { return y * canvas.height; }

    const Y_TOP = 0.15, Y_MB = 0.35, Y_CAN = 0.52, Y_MODS = 0.70, Y_PWR = 0.70, Y_BAT = 0.85;
    const X_TEMP = 0.10, X_IMU = 0.22, X_DIST = 0.34, X_DRV = 0.74, X_MOT = 0.90;
    const X_MB = 0.50, X_MCU = 0.80, X_PWR = 0.50;

    const NODES = [
        { id: "APP", x: X_MB, y: Y_TOP, label: ["Eonix Desktop App", "(User Interface)"], type: "visual-desktop", w: 105 },
        { id: "MCU", x: X_MCU, y: Y_TOP, label: ["User MCU", "(Arduino / Custom)"], type: "box", w: 130, h: 44 },
        { id: "MB", x: X_MB, y: Y_MB, label: ["EONIX", "MOTHERBOARD"], type: "box-major", w: 170, h: 50 },
        { id: "CAN", x: X_MB, y: Y_CAN, label: "", type: "can-hit", w: 850, h: 28 },
        { id: "TEMP", x: X_TEMP, y: Y_MODS, label: ["Temperature", "Sensor"], type: "box", w: 120, h: 44 },
        { id: "IMU", x: X_IMU, y: Y_MODS, label: ["IMU", "Sensor"], type: "box", w: 100, h: 44 },
        { id: "DIST", x: X_DIST, y: Y_MODS, label: ["Distance", "LiDAR"], type: "box", w: 100, h: 44 },
        { id: "DRV", x: X_DRV, y: Y_MODS, label: ["Motor Driver", "Module"], type: "box", w: 120, h: 44 },
        { id: "PWR", x: X_PWR, y: Y_PWR, label: ["EONIX POWER BLOCK", "Programmable CC/CV"], type: "box-major", w: 170, h: 44 },
        { id: "BAT", x: X_PWR, y: Y_BAT, label: "Battery", type: "box", w: 100, h: 40 },
        { id: "MOT", x: X_MOT, y: Y_MODS, label: "Motor", type: "visual-motor", w: 52 },
    ];

    // Initialize state objects
    NODES.forEach(n => { currentAlphas[n.id] = 1.0; currentGlows[n.id] = 0; });
    ["DATA_MB_APP", "DATA_MB_MCU", "DATA_MB_CAN", "CAN_BUS", "CAN_STUB", "PWR_BAT", "PWR_DRV", "PWR_MOT"].forEach(id => lineAlphas[id] = 1.0);

    const TIPS = {
        MB: "Central controller coordinating all modules and managing system communication.",
        PWR: "Programmable CC/CV power with hardware-level protection and telemetry.",
        TEMP: "Abstracted sensing module.",
        IMU: "Abstracted sensing module.",
        DIST: "Abstracted sensing module.",
        DRV: "High-current driver with fault protection.",
        CAN: "Deterministic multi-node communication backbone.",
        APP: "User Interface Configuration.",
        MCU: "External MCU integration over SPI.",
        BAT: "System Power Source.",
        MOT: "High-current physical load.",
    };

    // ── Interaction: Tooltips ONLY (Highlight driven by scroll steps mostly) ──────
    let localHoverNode = null;
    canvas.addEventListener("mousemove", e => {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        // Transform-safe mapping (accounts for CSS scaling)
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;
        
        const s = S();
        let found = null;
        for (const nd of NODES) {
            if (nd.type === "visual-motor" || nd.type === "can-hit") {
                if (nd.type === "can-hit") {
                    const bx = cx(nd.x) - (nd.w * s) / 2;
                    const bw = nd.w * s;
                    const by = cy(nd.y) - (nd.h * s) / 2;
                    const bh = nd.h * s;
                    if (mx >= bx && mx <= bx + bw && my >= by && my <= by + bh) { found = nd; break; }
                }
                if (nd.type === "visual-motor") {
                    const r = (nd.w / 2) * s;
                    if (Math.hypot(mx - cx(nd.x), my - cy(nd.y)) < r + 5) { found = nd; break; }
                }
                continue;
            }
            const nw = (nd.w || 120) * s;
            const nh = (nd.h || 44) * s;
            if (Math.abs(mx - cx(nd.x)) < nw / 2 + 4 && Math.abs(my - cy(nd.y)) < nh / 2 + 4) {
                found = nd; break;
            }
        }
        if (found !== localHoverNode) { localHoverNode = found; renderTooltip(); }
        canvas.style.cursor = (found && TIPS[found.id]) ? "pointer" : "default";
    });
    canvas.addEventListener("mouseleave", () => { localHoverNode = null; renderTooltip(); });

    function renderTooltip() {
        overlay.innerHTML = "";
        if (!localHoverNode || !TIPS[localHoverNode.id]) return;
        const tip = document.createElement("div");
        tip.className = "diagram-tooltip";
        tip.innerHTML = TIPS[localHoverNode.id];
        const dpr = window.devicePixelRatio || 1;
        const s = S();
        const px = cx(localHoverNode.x) / dpr;
        const py = cy(localHoverNode.y) / dpr;
        const nw = ((localHoverNode.w || 120) * s) / dpr;
        const cw = canvas.width / dpr;
        Object.assign(tip.style, {
            position: "absolute", padding: "12px 16px", borderRadius: "8px",
            fontSize: "0.9rem", lineHeight: "1.6", whiteSpace: "nowrap",
            backgroundColor: "#ffffff", border: "1px solid rgba(56,182,255,0.35)",
            color: "#111111", pointerEvents: "none", zIndex: "200",
            boxShadow: "0 4px 20px rgba(0,0,0,0.1)"
        });
        if (px > cw * 0.55) { tip.style.right = (cw - px + nw / 2 + 10) + "px"; } 
        else { tip.style.left = (px + nw / 2 + 10) + "px"; }
        tip.style.top = (py - 24) + "px";
        overlay.appendChild(tip);
    }

    // ── STATE ENGINE: Calculate Targets Based on Step ────────────────────────
    function getTargetStates() {
        const step = window.activeDiagramStep || 0;
        const forced = window.forceHoverNodeId || (localHoverNode ? localHoverNode.id : null);
        
        let tAlpha = {}; NODES.forEach(n => tAlpha[n.id] = 0.2);
        let tLine = {}; Object.keys(lineAlphas).forEach(k => tLine[k] = 0.2);
        let tGlow = {}; NODES.forEach(n => tGlow[n.id] = 0);
        
        let activeNodes = [];
        let activeLines = [];
        
        if (forced) {
            // Unrelated fade heavily, forced brightens
            activeNodes.push(forced);
            tGlow[forced] = 20; // Massive glow on manual hover
            if (forced === "MB") activeLines.push("DATA_MB_APP", "DATA_MB_MCU", "DATA_MB_CAN");
            if (forced === "CAN") activeLines.push("CAN_BUS", "DATA_MB_CAN", "CAN_STUB");
            if (forced === "PWR" || forced === "BAT") activeLines.push("PWR_BAT", "PWR_DRV", "PWR_MOT");
            if (forced === "DRV" || forced === "MOT") activeLines.push("PWR_DRV", "PWR_MOT", "CAN_STUB");
        } else if (step === 0) {
            NODES.forEach(n => activeNodes.push(n.id));
            Object.keys(lineAlphas).forEach(k => activeLines.push(k));
        } else if (step === 1) { // CONTROL
            activeNodes.push("MB", "APP", "MCU");
            activeLines.push("DATA_MB_APP", "DATA_MB_MCU");
            tGlow["MB"] = 25; // Motherboard glows strongly!
        } else if (step === 2) { // COMMUNICATION
            activeNodes.push("CAN", "MB", "TEMP", "IMU", "DIST", "DRV", "PWR");
            activeLines.push("CAN_BUS", "DATA_MB_CAN", "CAN_STUB");
            tGlow["CAN"] = 18;
            tGlow["MB"] = 8;
        } else if (step === 3) { // POWER
            activeNodes.push("PWR", "BAT", "DRV", "MOT");
            activeLines.push("PWR_BAT", "PWR_DRV", "PWR_MOT");
            tGlow["PWR"] = 25; // Power block glows blue!
            tGlow["BAT"] = 10;
        } else if (step === 4) { // EXECUTION
            activeNodes.push("DRV", "MOT", "TEMP", "IMU", "DIST");
            activeLines.push("PWR_MOT", "CAN_STUB");
            tGlow["MOT"] = 15;
            tGlow["DRV"] = 15;
            tGlow["TEMP"] = tGlow["IMU"] = tGlow["DIST"] = 5;
        }

        activeNodes.forEach(id => tAlpha[id] = 1.0);
        activeLines.forEach(id => tLine[id] = 1.0);

        return { tAlpha, tGlow, tLine, step };
    }

    // ── Drawing primitives ───────────────────────────────────────
    function drawBox(x, y, w, h, ndId, isMajor) {
        const s = S();
        const r = 8 * s;
        ctx.globalAlpha = currentAlphas[ndId];
        const g = currentGlows[ndId] * s;
        
        ctx.beginPath();
        ctx.roundRect(x - w / 2, y - h / 2, w, h, r);
        ctx.fillStyle = isMajor ? "#EEF6FF" : "#F4F4F4";
        if (g > 5) ctx.fillStyle = isMajor ? "#D8EEFF" : "#E8E8E8"; // Brighten bg when glowing
        ctx.fill();
        
        ctx.strokeStyle = g > 5 ? "#38b6ff" : isMajor ? "rgba(56,182,255,0.6)" : "rgba(0,0,0,0.12)";
        ctx.lineWidth = (isMajor || g > 5 ? 2 : 1) * s;
        
        if (g > 0) { ctx.shadowColor = "#38b6ff"; ctx.shadowBlur = g * 0.6; }
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
    }

    function drawLabel(x, y, lines, ndId, isMajor) {
        const s = S();
        ctx.globalAlpha = currentAlphas[ndId];
        const g = currentGlows[ndId] * s;
        
        ctx.fillStyle = "#111111";
        ctx.font = `${Math.max(9, (isMajor ? 14 : 11) * s)}px 'Plus Jakarta Sans', system-ui`;
        if (g > 10) { ctx.shadowColor = "#38b6ff"; ctx.shadowBlur = 3 * s; }
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        if (Array.isArray(lines)) {
            const gap = 12 * s;
            ctx.fillText(lines[0], x, y - gap * 0.5);
            ctx.fillStyle = isMajor ? "#38b6ff" : "#555555";
            if (g > 5 && !isMajor) ctx.fillStyle = "#222222";
            ctx.font = `${Math.max(8, (isMajor ? 11 : 9) * s)}px 'Plus Jakarta Sans', system-ui`;
            ctx.shadowBlur = 0;
            ctx.fillText(lines[1], x, y + gap * 0.9);
        } else {
            ctx.fillText(lines, x, y);
        }
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
    }

    function drawMotor(x, y, w, ndId, step) {
        const s = S();
        const r = w / 2;
        ctx.globalAlpha = currentAlphas[ndId];
        const g = currentGlows[ndId] * s;
        
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = g > 5 ? "#D8EEFF" : "#E8E8E8";
        ctx.strokeStyle = g > 5 ? "#38b6ff" : "rgba(0,0,0,0.18)";
        ctx.lineWidth = (g > 5 ? 2 : 1.5) * s;
        if (g > 0) { ctx.shadowColor = "#38b6ff"; ctx.shadowBlur = g * 0.6; }
        ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
        
        // Spinning blades (spin faster if active step is EXECUTION (4))
        const speed = (step === 4 || g > 5) ? 0.008 : 0.001;
        ctx.save(); ctx.translate(x, y); ctx.rotate(time * speed);
        ctx.fillStyle = g > 5 ? "#38b6ff" : "#888888";
        for (let i = 0; i < 3; i++) {
            ctx.rotate((Math.PI * 2) / 3);
            ctx.beginPath();
            ctx.rect(-3 * s, -r * 0.85, 6 * s, r * 0.7);
            ctx.fill();
        }
        ctx.restore();
        
        ctx.beginPath(); ctx.arc(x, y, 5 * s, 0, Math.PI * 2);
        ctx.fillStyle = "#333333"; ctx.fill();
        
        ctx.fillStyle = "#222222";
        ctx.font = `${Math.max(8, 11 * s)}px 'Plus Jakarta Sans', system-ui`;
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillText("Motor", x, y + r + 6 * s);
        ctx.globalAlpha = 1.0;
    }

    function drawDesktop(x, y, w, label, ndId) {
        const s = S();
        const mw = w * 1.4, mh = w * 0.9;
        const screenTop = y - mh / 2;
        ctx.globalAlpha = currentAlphas[ndId];
        const g = currentGlows[ndId] * s;
        
        ctx.beginPath();
        ctx.roundRect(x - mw / 2, screenTop, mw, mh, 5 * s);
        ctx.fillStyle = g > 5 ? "#D8EEFF" : "#F0F0F0";
        ctx.strokeStyle = g > 5 ? "#38b6ff" : "rgba(0,0,0,0.15)";
        ctx.lineWidth = 1.5 * s;
        if (g > 0) { ctx.shadowColor = "#38b6ff"; ctx.shadowBlur = g * 0.6; }
        ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;

        const bInset = 5 * s;
        ctx.beginPath();
        ctx.roundRect(x - mw / 2 + bInset, screenTop + bInset, mw - bInset * 2, mh - bInset * 2, 3 * s);
        ctx.fillStyle = g > 5 ? "rgba(56,182,255,0.12)" : "rgba(0,0,0,0.04)";
        ctx.fill();

        ctx.fillStyle = g > 5 ? "#38b6ff" : "#333333";
        ctx.font = `500 ${Math.max(9, 11 * s)}px 'Plus Jakarta Sans', system-ui`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(label[0], x, y - 7 * s);
        ctx.fillStyle = g > 5 ? "rgba(56,182,255,0.9)" : "#777777";
        ctx.font = `400 ${Math.max(7, 9 * s)}px 'Plus Jakarta Sans', system-ui`;
        ctx.fillText(label[1], x, y + 9 * s);

        const neckW = mw * 0.12, neckH = 6 * s;
        ctx.fillStyle = "#E0E0E0";
        ctx.strokeStyle = g > 5 ? "#38b6ff" : "rgba(0,0,0,0.15)";
        ctx.lineWidth = 1 * s;
        ctx.beginPath(); ctx.rect(x - neckW / 2, y + mh / 2, neckW, neckH); ctx.fill(); ctx.stroke();

        ctx.beginPath(); ctx.roundRect(x - mw * 0.32, y + mh / 2 + neckH, mw * 0.64, 5 * s, 2 * s);
        ctx.fill(); ctx.stroke();
        ctx.globalAlpha = 1.0;
    }

    function buildRailPts(pts, dir, gap) {
        const result = [];
        for (let i = 0; i < pts.length; i++) {
            let ox = 0, oy = 0;
            if (i > 0) {
                const pdx = pts[i][0] - pts[i-1][0]; const pdy = pts[i][1] - pts[i-1][1];
                if (Math.abs(pdx) > Math.abs(pdy)) oy += dir * gap; else ox += dir * gap;
            }
            if (i < pts.length - 1) {
                const ndx = pts[i+1][0] - pts[i][0]; const ndy = pts[i+1][1] - pts[i][1];
                if (Math.abs(ndx) > Math.abs(ndy)) oy += dir * gap; else ox += dir * gap;
            }
            result.push([pts[i][0] + ox, pts[i][1] + oy]);
        }
        return result;
    }

    function drawRail(rawPts, color, s, dir, gap, curAlpha, timeSpeed) {
        if (rawPts.length < 2) return;
        const rpts = buildRailPts(rawPts, dir, gap);
        ctx.globalAlpha = curAlpha;
        ctx.strokeStyle = color;
        ctx.lineWidth   = 1.5 * s;
        ctx.setLineDash([6 * s, 5 * s]);
        ctx.lineDashOffset = -time * timeSpeed * dir;
        
        ctx.beginPath();
        ctx.moveTo(rpts[0][0], rpts[0][1]);
        for (let i = 1; i < rpts.length; i++) ctx.lineTo(rpts[i][0], rpts[i][1]);
        
        if (curAlpha > 0.5) { ctx.shadowColor = color; ctx.shadowBlur = 8 * s * curAlpha; }
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.setLineDash([]);
        ctx.globalAlpha = 1.0;
    }

    function polyline(pts, color, dashScale, thick, lineAlphaId, isPower, activeStep) {
        const s = S();
        const alpha = lineAlphas[lineAlphaId] || 0.2;
        let timeSpeed = 0.022;
        if (activeStep === 2 && dashScale) timeSpeed = 0.035; // Comms: fast lines
        if (activeStep === 3 && isPower) timeSpeed = 0.03;  // Power: pulsing energy

        if (dashScale) {
            const gap = 5 * s;
            drawRail(pts, color, s,  1, gap, alpha, timeSpeed);
            drawRail(pts, color, s, -1, gap, alpha, timeSpeed);
        } else {
            if (pts.length < 2) return;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.moveTo(pts[0][0], pts[0][1]);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
            ctx.strokeStyle = color;
            ctx.lineWidth   = (thick || 3) * s;
            
            if (alpha > 0.5 && isPower) {
                ctx.setLineDash([15 * s, 10 * s]);
                ctx.lineDashOffset = -time * timeSpeed;
                ctx.shadowColor = "rgba(56,182,255,0.4)";
                ctx.shadowBlur  = 8 * s * alpha;
            }
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1.0;
        }
    }

    const DATA_COLOR = "rgba(200,30,30,0.85)";
    const POWER_COLOR = "rgba(56,182,255,0.9)";

    function renderLoop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // White background to match light-mode site theme
        ctx.fillStyle = "#FAFAFA";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Logical update: Lerp targets
        const { tAlpha, tGlow, tLine, step } = getTargetStates();
        Object.keys(currentAlphas).forEach(k => currentAlphas[k] = lerp(currentAlphas[k], tAlpha[k]||0.2, LERP_RATE));
        Object.keys(currentGlows).forEach(k => currentGlows[k] = lerp(currentGlows[k], tGlow[k]||0, LERP_RATE));
        Object.keys(lineAlphas).forEach(k => lineAlphas[k] = lerp(lineAlphas[k], tLine[k]||0.2, LERP_RATE));

        const s = S();
        const bbGap = 5 * s; 

        // ── 1. DATA CONNECTIONS ──────────────────
        polyline([[cx(X_MB), cy(Y_MB) - 25 * s], [cx(X_MB), cy(Y_TOP) + 42 * s]], DATA_COLOR, true, 1, "DATA_MB_APP", false, step);
        polyline([[cx(X_MB) + 85 * s, cy(Y_MB)], [cx(X_MCU), cy(Y_MB)], [cx(X_MCU), cy(Y_TOP) + 22 * s]], DATA_COLOR, true, 1, "DATA_MB_MCU", false, step);
        polyline([[cx(X_MB), cy(Y_MB) + 25 * s], [cx(X_MB), cy(Y_CAN) - bbGap]], DATA_COLOR, true, 1, "DATA_MB_CAN", false, step);

        // ── 2. CAN BUS BACKBONE ──────────────────
        const canY = cy(Y_CAN);
        const canAlpha = lineAlphas["CAN_BUS"];
        ctx.globalAlpha = canAlpha;
        const bbColor = canAlpha > 0.8 ? "#DC2626" : "rgba(220,38,38,0.5)";
        if (canAlpha > 0.5) { ctx.shadowColor = "rgba(220,38,38,0.4)"; ctx.shadowBlur = 8 * s * canAlpha; }
        ctx.strokeStyle = bbColor;
        ctx.lineWidth   = 1.8 * s;
        ctx.setLineDash([8 * s, 6 * s]);
        const speedMultiplier = (step === 2) ? 0.04 : 0.022; // Faster when active step 2
        
        ctx.beginPath(); ctx.moveTo(cx(0.05), canY - bbGap); ctx.lineTo(cx(0.95), canY - bbGap);
        ctx.lineDashOffset = -time * speedMultiplier; ctx.stroke();
        
        ctx.beginPath(); ctx.moveTo(cx(0.05), canY + bbGap); ctx.lineTo(cx(0.95), canY + bbGap);
        ctx.lineDashOffset = time * speedMultiplier; ctx.stroke();
        
        ctx.setLineDash([]); ctx.shadowBlur = 0;
        ctx.fillStyle = canAlpha > 0.8 ? "#38b6ff" : "rgba(56,182,255,0.5)";
        ctx.font = `${Math.max(9, 11 * s)}px 'Plus Jakarta Sans', system-ui`;
        ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        ctx.fillText("UNIFIED INTERFACE — Deterministic Multi-Node Communication", cx(0.50), canY - bbGap - 8 * s);
        ctx.globalAlpha = 1.0;

        // ── 3. CAN STUBS ─────────────────────────
        const stubTop = canY + bbGap, stubBot = cy(Y_MODS) - 22 * s;
        polyline([[cx(X_TEMP), stubTop], [cx(X_TEMP), stubBot]], DATA_COLOR, true, 1, "CAN_STUB", false, step);
        polyline([[cx(X_IMU), stubTop], [cx(X_IMU), stubBot]], DATA_COLOR, true, 1, "CAN_STUB", false, step);
        polyline([[cx(X_DIST), stubTop], [cx(X_DIST), stubBot]], DATA_COLOR, true, 1, "CAN_STUB", false, step);
        polyline([[cx(X_DRV), stubTop], [cx(X_DRV), stubBot]], DATA_COLOR, true, 1, "CAN_STUB", false, step);
        polyline([[cx(X_PWR), stubTop], [cx(X_PWR), cy(Y_PWR) - 22 * s]], DATA_COLOR, true, 1, "CAN_STUB", false, step);

        // ── 4. POWER CONNECTIONS ─────────────────
        polyline([[cx(X_PWR), cy(Y_PWR) + 22 * s], [cx(X_PWR), cy(Y_BAT) - 20 * s]], POWER_COLOR, false, 3, "PWR_BAT", true, step);
        polyline([[cx(X_PWR) + 85 * s, cy(Y_PWR)], [cx(X_DRV), cy(Y_PWR)]], POWER_COLOR, false, 3, "PWR_DRV", true, step);
        polyline([[cx(X_DRV) + 60 * s, cy(Y_MODS)], [cx(X_MOT) - 26 * s, cy(Y_MODS)]], POWER_COLOR, false, 3, "PWR_MOT", true, step);

        // Labels for Power
        const pAlpha = lineAlphas["PWR_DRV"];
        ctx.globalAlpha = pAlpha;
        ctx.fillStyle = `rgba(56,182,255,${0.5 + pAlpha*0.4})`;
        ctx.font = `${Math.max(8, 10 * s)}px 'Plus Jakarta Sans', system-ui`;
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillText("Power Rail", cx((X_PWR + X_DRV) / 2), cy(Y_PWR) + 7 * s);
        ctx.textBaseline = "bottom";
        ctx.fillText("Power + Control", cx((X_DRV + X_MOT) / 2 + 0.02), cy(Y_MODS) - 5 * s);
        ctx.globalAlpha = 1.0;

        // ── 5. DRAW NODES ────────────────────────
        NODES.forEach(nd => {
            const x = cx(nd.x), y = cy(nd.y);
            const w = (nd.w || 120) * s, h = (nd.h || 44) * s;
            const isMajor = nd.type === "box-major";
            if (nd.type === "can-hit") return;
            if (nd.type === "visual-motor") drawMotor(x, y, w, nd.id, step);
            else if (nd.type === "visual-desktop") drawDesktop(x, y, w, nd.label, nd.id);
            else { drawBox(x, y, w, h, nd.id, isMajor); drawLabel(x, y, nd.label, nd.id, isMajor); }
        });

        time += 16;
        requestAnimationFrame(renderLoop);
    }
    
    renderLoop();
});
