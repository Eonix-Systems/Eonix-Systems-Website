/* =========================
   EONIX ECOSYSTEM DIAGRAM
   Strict Hierarchical CAN Bus Architecture
   ========================= */

document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("systemCanvas");
    if (!canvas) return;
    const overlay = document.querySelector(".diagram-overlay");
    const ctx = canvas.getContext("2d");
    let hoveredNode = null;
    let time = 0;

    // ── Sizing ────────────────────────────────────────────────
    function resize() {
        const parent = canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;
        const displayWidth = Math.max(parent.clientWidth, 1000);
        const displayHeight = 700;
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
    function S() { return canvas.width / REF_W; }
    function cx(x) { return x * canvas.width; }
    function cy(y) { return y * canvas.height; }

    // ── Layout Constants ──────────────────────────────────────
    // All Y values are normalized to REF_H=700
    const Y_TOP = 0.10;   // Desktop / MCU row
    const Y_MB = 0.30;   // Motherboard
    const Y_CAN = 0.50;   // CAN BUS backbone
    const Y_MODS = 0.72;   // Sensor / Driver stubs land here
    const Y_PWR = 0.72;   // Power Block (same row, center)
    const Y_BAT = 0.90;   // Battery

    // Sensor X positions (left third)
    const X_TEMP = 0.10;
    const X_IMU = 0.22;
    const X_DIST = 0.34;

    // Right side
    const X_DRV = 0.74;
    const X_MOT = 0.90;

    // Center
    const X_MB = 0.50;
    const X_MCU = 0.80;
    const X_PWR = 0.50;

    // Node definitions — only geometric, no routing here
    const NODES = [
        // User layer
        { id: "APP", x: X_MB, y: Y_TOP, label: ["Eonix Desktop App", "(User Interface)"], type: "visual-desktop", w: 105 },
        { id: "MCU", x: X_MCU, y: Y_TOP, label: ["User MCU", "(Arduino / Custom)"], type: "box", w: 130, h: 44 },

        // Control layer
        { id: "MB", x: X_MB, y: Y_MB, label: ["EONIX", "MOTHERBOARD"], type: "box-major", w: 170, h: 50 },

        // CAN bus — handled as a drawn line, but also a hit-target
        { id: "CAN", x: X_MB, y: Y_CAN, label: "", type: "can-hit", w: 850, h: 28 },

        // Sensors
        { id: "TEMP", x: X_TEMP, y: Y_MODS, label: ["Temperature", "Sensor"], type: "box", w: 120, h: 44 },
        { id: "IMU", x: X_IMU, y: Y_MODS, label: ["IMU", "Sensor"], type: "box", w: 100, h: 44 },
        { id: "DIST", x: X_DIST, y: Y_MODS, label: ["Distance", "LiDAR"], type: "box", w: 100, h: 44 },

        // Driver
        { id: "DRV", x: X_DRV, y: Y_MODS, label: ["Motor Driver", "Module"], type: "box", w: 120, h: 44 },

        // Power
        { id: "PWR", x: X_PWR, y: Y_PWR, label: ["EONIX POWER BLOCK", "Programmable CC/CV"], type: "box", w: 170, h: 44 },
        { id: "BAT", x: X_PWR, y: Y_BAT, label: "Battery", type: "box", w: 100, h: 40 },

        // Motor (circle)
        { id: "MOT", x: X_MOT, y: Y_MODS, label: "Motor", type: "visual-motor", w: 52 },
    ];

    const TIPS = {
        APP: "System configuration and monitoring\nAuto-detects connected modules",
        MCU: "Optional external control interface\nSPI based integration",
        MB: "Central system controller\nManages communication, modules, and power coordination",
        CAN: "Deterministic shared communication backbone\nNo address conflicts\nScalable multi-node architecture",
        TEMP: "Abstracted sensing modules\nStandardized interface\nNo protocol conflicts",
        IMU: "Abstracted sensing modules\nStandardized interface\nNo protocol conflicts",
        DIST: "Abstracted sensing modules\nStandardized interface\nNo protocol conflicts",
        DRV: "High-current driver with hardware protection\nSupports current and torque control",
        PWR: "Programmable CC/CV power\nHardware protection: OCP / SCP\nReal-time voltage and current telemetry",
        BAT: "Primary energy source",
        MOT: "High-current inductive load",
    };

    // ── Interaction ───────────────────────────────────────────
    canvas.addEventListener("mousemove", e => {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const mx = (e.clientX - rect.left) * dpr;
        const my = (e.clientY - rect.top) * dpr;
        const s = S();
        let found = null;
        for (const nd of NODES) {
            if (nd.type === "visual-motor" || nd.type === "can-hit") {
                // special hit for CAN line
                if (nd.type === "can-hit") {
                    const bx = cx(nd.x) - (nd.w * s) / 2;
                    const bw = nd.w * s;
                    const by = cy(nd.y) - (nd.h * s) / 2;
                    const bh = nd.h * s;
                    if (mx >= bx && mx <= bx + bw && my >= by && my <= by + bh) { found = nd; break; }
                }
                // motor hit circle
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
        if (found !== hoveredNode) { hoveredNode = found; renderTooltip(); }
        canvas.style.cursor = (found && TIPS[found.id]) ? "pointer" : "default";
    });
    canvas.addEventListener("mouseleave", () => { hoveredNode = null; renderTooltip(); });

    function renderTooltip() {
        overlay.innerHTML = "";
        if (!hoveredNode || !TIPS[hoveredNode.id]) return;
        const tip = document.createElement("div");
        tip.className = "diagram-tooltip";
        tip.innerHTML = TIPS[hoveredNode.id].replace(/\n/g, "<br>");
        const dpr = window.devicePixelRatio || 1;
        const s = S();
        const px = cx(hoveredNode.x) / dpr;
        const py = cy(hoveredNode.y) / dpr;
        const nw = ((hoveredNode.w || 120) * s) / dpr;
        const cw = canvas.width / dpr;
        Object.assign(tip.style, {
            position: "absolute", padding: "10px 14px", borderRadius: "6px",
            fontSize: "0.82rem", lineHeight: "1.6", whiteSpace: "nowrap",
            backgroundColor: "#080a0c", border: "1px solid rgba(0,164,255,.4)",
            color: "#00a4ff", pointerEvents: "none", zIndex: "200",
            boxShadow: "0 4px 16px rgba(0,0,0,.6)"
        });
        if (px > cw * 0.55) {
            tip.style.right = (cw - px + nw / 2 + 10) + "px";
        } else {
            tip.style.left = (px + nw / 2 + 10) + "px";
        }
        tip.style.top = (py - 24) + "px";
        overlay.appendChild(tip);
    }

    // ── Drawing helpers ───────────────────────────────────────
    function drawBox(x, y, w, h, isHover, isMajor) {
        const s = S();
        const r = 7 * s;
        const bx = x - w / 2, by = y - h / 2;
        ctx.beginPath();
        ctx.roundRect(bx, by, w, h, r);
        ctx.fillStyle = isMajor ? "#101520" : "#0a0c0e";
        ctx.fill();
        ctx.strokeStyle = isHover ? "#00a4ff"
            : isMajor ? "rgba(0,164,255,0.45)"
                : "rgba(255,255,255,0.18)";
        ctx.lineWidth = (isMajor ? 1.5 : 1) * s;
        if (isHover || isMajor) { ctx.shadowColor = "#00a4ff"; ctx.shadowBlur = isMajor ? 14 * s : 10 * s; }
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    function drawLabel(x, y, h, lines, isHover, isMajor) {
        const s = S();
        ctx.fillStyle = "#ffffff";
        ctx.font = `${Math.max(9, (isMajor ? 14 : 12) * s)}px Inter, system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        if (Array.isArray(lines)) {
            const gap = 11 * s;
            ctx.fillText(lines[0], x, y - gap * 0.5);
            ctx.fillStyle = isMajor ? "#7ec8ff" : "#aaaaaa";
            ctx.font = `${Math.max(8, (isMajor ? 11 : 10) * s)}px Inter, system-ui`;
            ctx.fillText(lines[1], x, y + gap * 0.9);
        } else {
            ctx.fillText(lines, x, y);
        }
    }

    function drawMotor(x, y, w) {
        const s = S();
        const r = w / 2;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = "#111";
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 1.5 * s;
        ctx.fill(); ctx.stroke();
        // Spinning blades
        ctx.save(); ctx.translate(x, y); ctx.rotate(time * 0.003);
        ctx.fillStyle = "#ccc";
        for (let i = 0; i < 3; i++) {
            ctx.rotate((Math.PI * 2) / 3);
            ctx.beginPath();
            ctx.rect(-3 * s, -r * 0.85, 6 * s, r * 0.7);
            ctx.fill();
        }
        ctx.restore();
        ctx.beginPath(); ctx.arc(x, y, 5 * s, 0, Math.PI * 2);
        ctx.fillStyle = "#fff"; ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = `${Math.max(8, 11 * s)}px Inter, system-ui`;
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillText("Motor", x, y + r + 6 * s);
    }

    function drawDesktop(x, y, w, label, isHover) {
        const s = S();
        const mw = w * 1.4, mh = w * 0.9; // Bigger screen so text fits nicely
        const screenTop = y - mh / 2;

        // Screen chassis
        ctx.beginPath();
        ctx.roundRect(x - mw / 2, screenTop, mw, mh, 5 * s);
        ctx.fillStyle = isHover ? "#0d1522" : "#0a0c0e";
        ctx.strokeStyle = isHover ? "#00a4ff" : "rgba(255,255,255,0.28)";
        ctx.lineWidth = 1.5 * s;
        if (isHover) { ctx.shadowColor = "#00a4ff"; ctx.shadowBlur = 12 * s; }
        ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;

        // Inner screen area (bezel inset)
        const bInset = 5 * s;
        ctx.beginPath();
        ctx.roundRect(x - mw / 2 + bInset, screenTop + bInset, mw - bInset * 2, mh - bInset * 2, 3 * s);
        ctx.fillStyle = isHover ? "rgba(0,164,255,0.08)" : "rgba(255,255,255,0.02)";
        ctx.fill();

        // Text INSIDE the screen
        ctx.fillStyle = isHover ? "#7ed4ff" : "#cdd6df";
        ctx.font = `500 ${Math.max(9, 11 * s)}px Inter, system-ui`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(label[0], x, y - 7 * s);
        ctx.fillStyle = isHover ? "rgba(0,200,255,0.7)" : "rgba(255,255,255,0.35)";
        ctx.font = `400 ${Math.max(7, 9 * s)}px Inter, system-ui`;
        ctx.fillText(label[1], x, y + 9 * s);

        // Neck
        const neckW = mw * 0.12, neckH = 6 * s;
        ctx.fillStyle = "#0a0c0e";
        ctx.strokeStyle = isHover ? "#00a4ff" : "rgba(255,255,255,0.28)";
        ctx.lineWidth = 1 * s;
        ctx.beginPath();
        ctx.rect(x - neckW / 2, y + mh / 2, neckW, neckH);
        ctx.fill(); ctx.stroke();

        // Base
        ctx.beginPath();
        ctx.roundRect(x - mw * 0.32, y + mh / 2 + neckH, mw * 0.64, 5 * s, 2 * s);
        ctx.fill(); ctx.stroke();
    }

    // Build the offset control points for one rail.
    // At corner points, both adjacent segment perpendicular offsets combine correctly
    // giving a proper miter (outer rail wider curve, inner rail tighter).
    function buildRailPts(pts, dir, gap) {
        const result = [];
        for (let i = 0; i < pts.length; i++) {
            let ox = 0, oy = 0;
            // Previous segment contribution
            if (i > 0) {
                const pdx = pts[i][0] - pts[i-1][0];
                const pdy = pts[i][1] - pts[i-1][1];
                if (Math.abs(pdx) > Math.abs(pdy)) oy += dir * gap; // horiz → Y
                else                                ox += dir * gap; // vert  → X
            }
            // Next segment contribution
            if (i < pts.length - 1) {
                const ndx = pts[i+1][0] - pts[i][0];
                const ndy = pts[i+1][1] - pts[i][1];
                if (Math.abs(ndx) > Math.abs(ndy)) oy += dir * gap; // horiz → Y
                else                                ox += dir * gap; // vert  → X
            }
            result.push([pts[i][0] + ox, pts[i][1] + oy]);
        }
        return result;
    }

    // Draw one rail as a continuous rounded path.
    function drawRail(pts, color, s, dir, gap) {
        const rpts = buildRailPts(pts, dir, gap);
        const cr = 9 * s; // corner rounding radius
        ctx.strokeStyle = color;
        ctx.lineWidth   = 1.5 * s;
        ctx.setLineDash([6 * s, 5 * s]);
        ctx.lineDashOffset = -time * 0.022 * dir;
        ctx.beginPath();
        ctx.moveTo(rpts[0][0], rpts[0][1]);
        for (let i = 1; i < rpts.length - 1; i++) {
            ctx.arcTo(rpts[i][0], rpts[i][1], rpts[i+1][0], rpts[i+1][1], cr);
        }
        ctx.lineTo(rpts[rpts.length - 1][0], rpts[rpts.length - 1][1]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Two parallel rounded rails flowing in opposite directions.
    function polyline(pts, color, dashScale, thick) {
        const s = S();
        if (dashScale) {
            const gap = 5 * s; // perpendicular separation from centre
            drawRail(pts, color, s,  1, gap);
            drawRail(pts, color, s, -1, gap);
        } else {
            // Solid power line
            ctx.beginPath();
            ctx.moveTo(pts[0][0], pts[0][1]);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
            ctx.strokeStyle = color;
            ctx.lineWidth   = (thick || 3) * s;
            ctx.setLineDash([]);
            ctx.shadowColor = "rgba(0,200,255,0.55)";
            ctx.shadowBlur  = 8 * s;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    }

    const DATA_COLOR = "rgba(255,65,65,0.88)";
    const POWER_COLOR = "rgba(0,200,255,0.9)";

    // ── Main draw loop ────────────────────────────────────────
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const s = S();

        // 1. Background
        ctx.fillStyle = "#0B0F14";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. Grid
        const gSize = 50 * s;
        ctx.strokeStyle = "rgba(255,255,255,0.035)";
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        for (let x = 0; x <= canvas.width; x += gSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
        for (let y = 0; y <= canvas.height; y += gSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }

        // 3. ── DATA CONNECTIONS (red dashed) ──────────────────
        const bbGap = 5 * s; // shared gap for backbone + stubs + MB drop────

        // APP → MB (straight vertical)
        polyline([
            [cx(X_MB), cy(Y_TOP) + 42 * s],
            [cx(X_MB), cy(Y_MB) - 25 * s]
        ], DATA_COLOR, true);

        // MCU → MB (right-angle: drop, then left)
        polyline([
            [cx(X_MCU), cy(Y_TOP) + 22 * s],
            [cx(X_MCU), cy(Y_MB)],
            [cx(X_MB) + 85 * s, cy(Y_MB)]
        ], DATA_COLOR, true);
        // SPI label
        ctx.textAlign = "center";
        ctx.fillText("SPI Interface", cx((X_MCU + X_MB) / 2 + 0.05), cy(Y_MB) - 10 * s);

        // MB → CAN (short vertical drop from MB bottom — ends AT top backbone rail)
        polyline([
            [cx(X_MB), cy(Y_MB) + 25 * s],
            [cx(X_MB), cy(Y_CAN) - bbGap]
        ], DATA_COLOR, true);

        // 4. ── CAN BUS BACKBONE ───────────────────────────────
        const canY = cy(Y_CAN);
        const canX0 = cx(0.05);
        const canX1 = cx(0.95);
        const isCH = hoveredNode && hoveredNode.id === "CAN";

        // Draw backbone as two bidirectional rails (horizontal → offset in Y)
        const bbColor = isCH ? "#ff4141" : "rgba(255,65,65,0.80)";
        if (isCH) { ctx.shadowColor = "rgba(255,65,65,0.8)"; ctx.shadowBlur = 12 * s; }
        ctx.strokeStyle = bbColor;
        ctx.lineWidth   = 1.8 * s;
        // Rail 1 — forward
        ctx.beginPath();
        ctx.moveTo(canX0, canY - bbGap);
        ctx.lineTo(canX1, canY - bbGap);
        ctx.setLineDash([8 * s, 6 * s]);
        ctx.lineDashOffset = -time * 0.022;
        ctx.stroke();
        // Rail 2 — reverse
        ctx.beginPath();
        ctx.moveTo(canX0, canY + bbGap);
        ctx.lineTo(canX1, canY + bbGap);
        ctx.lineDashOffset = time * 0.022;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;

        // UNIFIED INTERFACE Label — above top rail, blue
        ctx.fillStyle = isCH ? "#7ed4ff" : "rgba(0, 180, 255, 0.75)";
        ctx.font = `${Math.max(9, 11 * s)}px Inter, system-ui`;
        ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        ctx.fillText("UNIFIED INTERFACE — Deterministic Multi-Node Communication", cx(0.50), canY - bbGap - 8 * s);

        // 5. ── STUBS (each module → CAN) ─────────────────────
        // stubTop = bottom backbone rail → stubs T-junction cleanly
        const stubTop = canY + bbGap;
        const stubBot = cy(Y_MODS) - 22 * s;
        const sensorIds = [X_TEMP, X_IMU, X_DIST];
        sensorIds.forEach(xv => {
            polyline([[cx(xv), stubTop], [cx(xv), stubBot]], DATA_COLOR, true);
        });
        // Driver stub
        polyline([[cx(X_DRV), stubTop], [cx(X_DRV), stubBot]], DATA_COLOR, true);
        // Power stub (up from PWR — starts AT bottom backbone rail)
        polyline([[cx(X_PWR), stubTop], [cx(X_PWR), cy(Y_PWR) - 22 * s]], DATA_COLOR, true);

        // 6. ── POWER CONNECTIONS (solid blue) ─────────────────
        // Battery → PDS
        polyline([
            [cx(X_PWR), cy(Y_BAT) - 20 * s],
            [cx(X_PWR), cy(Y_PWR) + 22 * s]
        ], POWER_COLOR, false, 3);

        // PDS → Motor Driver (below CAN: horizontal route at Y = 0.84)
        const pRoute = cy(0.84);
        polyline([
            [cx(X_PWR) + 85 * s, cy(Y_PWR)],
            [cx(X_DRV), cy(Y_PWR)]
        ], POWER_COLOR, false, 3);
        // "Power" label
        ctx.fillStyle = "rgba(0,200,255,0.65)";
        ctx.font = `${Math.max(8, 10 * s)}px Inter, system-ui`;
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillText("Power", cx((X_PWR + X_DRV) / 2), cy(Y_PWR) + 7 * s);

        // Motor Driver → Motor
        polyline([
            [cx(X_DRV) + 60 * s, cy(Y_MODS)],
            [cx(X_MOT) - 26 * s, cy(Y_MODS)]
        ], POWER_COLOR, false, 3);
        ctx.fillStyle = "rgba(0,200,255,0.65)";
        ctx.font = `${Math.max(8, 10 * s)}px Inter, system-ui`;
        ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        ctx.fillText("Power + Control", cx((X_DRV + X_MOT) / 2 + 0.02), cy(Y_MODS) - 5 * s);

        // OCP label removed from canvas — lives in PWR hover tooltip now

        // 7. ── DRAW NODES (on top of lines) ───────────────────
        NODES.forEach(nd => {
            const x = cx(nd.x), y = cy(nd.y);
            const w = (nd.w || 120) * s;
            const h = (nd.h || 44) * s;
            const isH = hoveredNode === nd;

            if (nd.type === "can-hit") return;  // invisible
            if (nd.type === "visual-motor") { drawMotor(x, y, w); return; }
            if (nd.type === "visual-desktop") { drawDesktop(x, y, w, nd.label, isH); return; }

            const isMajor = nd.type === "box-major";
            drawBox(x, y, w, h, isH, isMajor);
            drawLabel(x, y, h, nd.label, isH, isMajor);
        });

        time += 16;
        requestAnimationFrame(draw);
    }
    draw();
});
