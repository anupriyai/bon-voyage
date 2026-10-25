"use client";

import { useEffect, useRef } from "react";

export interface GlobeRoute {
  a: [number, number];
  b: [number, number];
  aLabel: string;
  bLabel: string;
}

interface Props {
  routes: GlobeRoute[];
  /** Highlighted route. Leave undefined to cycle through them. */
  active?: number;
  onPick?: (i: number) => void;
  labels?: boolean;
  showAll?: boolean;
  plane?: boolean;
}

type Ring = [number, number, number][];
interface GlobeData {
  lon: Float32Array;
  cl: Float32Array;
  sl: Float32Array;
  coasts: Ring[];
  grat: Ring[];
}
type ArcPt = [number, number, number, number];
interface Arc {
  pts: ArcPt[];
  midLon: number;
  midLat: number;
}

const D = Math.PI / 180;
let dataPromise: Promise<GlobeData> | null = null;

function loadData(): Promise<GlobeData> {
  dataPromise ??= fetch("/globe.json")
    .then((r) => r.json())
    .then((j: { dots: string; coasts: string }) => {
      const lon: number[] = [];
      const cl: number[] = [];
      const sl: number[] = [];
      for (const row of j.dots.split(";")) {
        const [latS, lons] = row.split(":");
        const la = parseFloat(latS) * D;
        for (const v of lons.split(",")) {
          lon.push(parseFloat(v) * D);
          cl.push(Math.cos(la));
          sl.push(Math.sin(la));
        }
      }
      const coasts: Ring[] = j.coasts.split("|").map((ring) =>
        ring.split(",").map((p) => {
          const q = p.split(" ");
          const la = parseFloat(q[1]) * D;
          return [parseFloat(q[0]) * D, Math.cos(la), Math.sin(la)];
        }),
      );
      const grat: Ring[] = [];
      for (let m = -180; m < 180; m += 30) {
        const ring: Ring = [];
        for (let la = -80; la <= 80; la += 4) ring.push([m * D, Math.cos(la * D), Math.sin(la * D)]);
        grat.push(ring);
      }
      for (let p = -60; p <= 60; p += 30) {
        const ring: Ring = [];
        for (let lo = -180; lo <= 180; lo += 4) ring.push([lo * D, Math.cos(p * D), Math.sin(p * D)]);
        grat.push(ring);
      }
      return { lon: Float32Array.from(lon), cl: Float32Array.from(cl), sl: Float32Array.from(sl), coasts, grat };
    });
  return dataPromise;
}

function vec(lon: number, lat: number): [number, number, number] {
  return [Math.cos(lat * D) * Math.cos(lon * D), Math.cos(lat * D) * Math.sin(lon * D), Math.sin(lat * D)];
}

const arcCache = new Map<string, Arc>();
function arcPoints(r: GlobeRoute): Arc {
  const key = r.a.join() + r.b.join();
  const hit = arcCache.get(key);
  if (hit) return hit;
  const A = vec(r.a[0], r.a[1]);
  const B = vec(r.b[0], r.b[1]);
  const dot = Math.min(1, Math.max(-1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]));
  const w = Math.acos(dot);
  const h = Math.min(0.3, 0.06 + w * 0.22);
  const N = 72;
  const pts: ArcPt[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const s1 = w < 1e-6 ? 1 - t : Math.sin((1 - t) * w) / Math.sin(w);
    const s2 = w < 1e-6 ? t : Math.sin(t * w) / Math.sin(w);
    const x = s1 * A[0] + s2 * B[0];
    const y = s1 * A[1] + s2 * B[1];
    const z = s1 * A[2] + s2 * B[2];
    const len = Math.hypot(x, y, z);
    const lat = Math.asin(z / len);
    const lon = Math.atan2(y, x);
    pts.push([lon, Math.cos(lat), Math.sin(lat), 1 + h * Math.sin(Math.PI * t)]);
  }
  const mid = pts[N >> 1];
  const res = { pts, midLon: (mid[0] * 180) / Math.PI, midLat: (Math.atan2(mid[2], mid[1]) * 180) / Math.PI };
  arcCache.set(key, res);
  return res;
}

/** A dotted globe that flies the camera to the active route and animates a plane along it. */
export default function Globe({ routes, active, onPick, labels = true, showAll = true, plane = true }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const props = useRef({ routes, active, labels, showAll, plane });
  props.current = { routes, active, labels, showAll, plane };
  const hits = useRef<{ i: number; x: number; y: number }[]>([]);

  useEffect(() => {
    let reduced = false;
    try {
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {}
    let data: GlobeData | null = null;
    let alive = true;
    loadData()
      .then((d) => alive && (data = d))
      .catch(() => {});
    const view = { lon: -40, lat: 18 };
    let selfActive = 0;
    let lastActive: number | null = null;
    let switchedAt = 0;
    const cycle = window.setInterval(() => {
      if (props.current.active === undefined) selfActive = (selfActive + 1) % Math.max(1, props.current.routes.length);
    }, 6500);
    let last = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const c = canvas.current;
      if (!c) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.round(c.clientWidth * dpr);
      const H = Math.round(c.clientHeight * dpr);
      if (!W || !H) return;
      if (c.width !== W || c.height !== H) {
        c.width = W;
        c.height = H;
      }
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const P = props.current;
      const rts = P.routes;
      const ai = P.active ?? selfActive;
      if (ai !== lastActive) {
        lastActive = ai;
        switchedAt = now;
      }
      const act = rts[ai];

      if (act) {
        const m = arcPoints(act);
        const tLon = m.midLon + (reduced ? 0 : Math.sin(now / 5000) * 5);
        const tLat = Math.max(-30, Math.min(40, m.midLat)) - 6;
        const d = ((tLon - view.lon + 540) % 360) - 180;
        const k = 1 - Math.pow(0.02, dt);
        view.lon += d * k;
        view.lat += (tLat - view.lat) * k;
      } else if (!reduced) view.lon += dt * 6;

      const l0 = view.lon * D;
      const p0 = view.lat * D;
      const sp0 = Math.sin(p0);
      const cp0 = Math.cos(p0);
      const cx = W / 2;
      const cy = H / 2;
      const R = Math.min(W, H) * 0.42;
      const s = R / 270;
      const proj = (lon: number, cl: number, sl: number, alt = 1) => {
        const dl = lon - l0;
        const cd = Math.cos(dl);
        const x = cl * Math.sin(dl);
        const y = cp0 * sl - sp0 * cl * cd;
        const z = sp0 * sl + cp0 * cl * cd;
        return [cx + x * R * alt, cy - y * R * alt, z, alt * Math.hypot(x, y)] as const;
      };

      ctx.clearRect(0, 0, W, H);
      let g = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.22);
      g.addColorStop(0, "rgba(111,208,195,0.32)");
      g.addColorStop(0.45, "rgba(25,124,120,0.14)");
      g.addColorStop(1, "rgba(25,124,120,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.22, 0, Math.PI * 2);
      ctx.fill();

      g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      g.addColorStop(0, "#24566A");
      g.addColorStop(0.6, "#163646");
      g.addColorStop(1, "#0C1F29");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      const lines = (rings: Ring[], style: string, width: number) => {
        ctx.beginPath();
        for (const ring of rings) {
          let on = false;
          for (const p of ring) {
            const q = proj(p[0], p[1], p[2]);
            if (q[2] > 0) {
              if (on) ctx.lineTo(q[0], q[1]);
              else ctx.moveTo(q[0], q[1]);
              on = true;
            } else on = false;
          }
        }
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        ctx.stroke();
      };

      if (data) {
        lines(data.grat, "rgba(247,244,236,0.07)", s);
        const buckets: number[][] = [[], [], [], []];
        for (let i = 0; i < data.lon.length; i++) {
          const dl = data.lon[i] - l0;
          const cd = Math.cos(dl);
          const z = sp0 * data.sl[i] + cp0 * data.cl[i] * cd;
          if (z <= 0.02) continue;
          const x = data.cl[i] * Math.sin(dl);
          const y = cp0 * data.sl[i] - sp0 * data.cl[i] * cd;
          buckets[Math.min(3, Math.floor(z * 4))].push(cx + x * R, cy - y * R);
        }
        const alphas = [0.28, 0.5, 0.72, 0.92];
        buckets.forEach((arr, b) => {
          const sz = (1.5 + b * 0.45) * s;
          ctx.fillStyle = `rgba(111,208,195,${alphas[b]})`;
          ctx.beginPath();
          for (let i = 0; i < arr.length; i += 2) ctx.rect(arr[i] - sz / 2, arr[i + 1] - sz / 2, sz, sz);
          ctx.fill();
        });
        lines(data.coasts, "rgba(190,232,224,0.45)", 1.1 * s);
      }

      g = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.5, R * 0.2, cx, cy, R * 1.05);
      g.addColorStop(0, "rgba(255,255,255,0.07)");
      g.addColorStop(0.55, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(4,14,20,0.55)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(247,244,236,0.18)";
      ctx.lineWidth = 1.2 * s;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      const vis = (q: readonly number[]) => q[2] > 0 || q[3] > 1;
      const drawArc = (pts: ArcPt[], upto: number, style: string, width: number, dash?: number[]) => {
        ctx.beginPath();
        let on = false;
        for (let i = 0; i <= upto; i++) {
          const p = pts[i];
          const q = proj(p[0], p[1], p[2], p[3]);
          if (vis(q)) {
            if (on) ctx.lineTo(q[0], q[1]);
            else ctx.moveTo(q[0], q[1]);
            on = true;
          } else on = false;
        }
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        ctx.lineCap = "round";
        if (dash) {
          ctx.setLineDash(dash);
          ctx.lineDashOffset = -now / 35;
        }
        ctx.stroke();
        ctx.setLineDash([]);
      };
      const font = (w: number, px: number) => `${w} ${Math.round(px * s * 1.6)}px "Source Sans 3", system-ui, sans-serif`;
      const pill = (text: string, x: number, y: number, bg: string, fg: string, anchor: "left" | "right") => {
        ctx.font = font(700, 8.6);
        const tw = ctx.measureText(text).width;
        const ph = 15 * s * 1.25;
        const pw = tw + 16 * s * 1.25;
        const px = anchor === "left" ? x - pw - 10 * s : x + 10 * s;
        ctx.fillStyle = bg;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(px, y - ph / 2, pw, ph, ph / 2);
        else ctx.rect(px, y - ph / 2, pw, ph);
        ctx.fill();
        ctx.fillStyle = fg;
        ctx.textBaseline = "middle";
        ctx.fillText(text, px + 8 * s * 1.25, y + 0.5);
      };

      hits.current = [];
      rts.forEach((r, i) => {
        const A = arcPoints(r);
        const end = A.pts[A.pts.length - 1];
        const q = proj(end[0], end[1], end[2]);
        if (q[2] > 0) hits.current.push({ i, x: q[0] / dpr, y: q[1] / dpr });
        if (i === ai) return;
        if (P.showAll) drawArc(A.pts, A.pts.length - 1, "rgba(111,208,195,0.32)", 1.3 * s);
        if (q[2] > 0.05) {
          ctx.fillStyle = "#6FD0C3";
          ctx.beginPath();
          ctx.arc(q[0], q[1], 3.6 * s, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#0E222D";
          ctx.lineWidth = 1.5 * s;
          ctx.stroke();
          if (P.labels && q[2] > 0.25) {
            ctx.font = font(600, 7.6);
            ctx.fillStyle = `rgba(220,230,226,${Math.min(1, q[2] * 1.4)})`;
            ctx.textBaseline = "middle";
            ctx.fillText(r.bLabel, q[0] + 8 * s, q[1]);
          }
        }
      });

      if (act) {
        const { pts } = arcPoints(act);
        const N = pts.length - 1;
        const since = now - switchedAt;
        const prog = reduced ? 1 : Math.min(1, since / 1500);
        const upto = Math.max(1, Math.round(N * (1 - Math.pow(1 - prog, 3))));
        ctx.save();
        ctx.shadowColor = "rgba(243,174,120,0.8)";
        ctx.shadowBlur = 14 * s;
        drawArc(pts, upto, "#F3AE78", 2.8 * s);
        ctx.restore();
        drawArc(pts, upto, "rgba(255,255,255,0.8)", 1.2 * s, [2 * s, 10 * s]);

        const o = proj(pts[0][0], pts[0][1], pts[0][2]);
        const e = proj(pts[N][0], pts[N][1], pts[N][2]);
        if (o[2] > 0) {
          ctx.fillStyle = "#F7F4EC";
          ctx.beginPath();
          ctx.arc(o[0], o[1], 4.5 * s, 0, Math.PI * 2);
          ctx.fill();
          if (P.labels) pill(`From ${act.aLabel}`, o[0], o[1], "rgba(14,34,45,0.85)", "#F7F4EC", o[0] > e[0] ? "right" : "left");
        }
        if (e[2] > 0) {
          for (let k = 0; k < 2; k++) {
            const ph = (now / 1800 + k * 0.5) % 1;
            ctx.strokeStyle = `rgba(243,174,120,${(1 - ph) * 0.9})`;
            ctx.lineWidth = 2 * s;
            ctx.beginPath();
            ctx.arc(e[0], e[1], (5 + ph * 22) * s, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.fillStyle = "#F3AE78";
          ctx.beginPath();
          ctx.arc(e[0], e[1], 5.5 * s, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#0E222D";
          ctx.lineWidth = 2 * s;
          ctx.stroke();
          if (P.labels) pill(act.bLabel, e[0], e[1], "#F3AE78", "#142D3B", o[0] > e[0] ? "left" : "right");
        }

        if (prog >= 1 && P.plane) {
          const loopT = reduced ? 0.55 : ((since - 1500) / 4200) % 1;
          const f = loopT * N;
          const i0 = Math.floor(f);
          const fr = f - i0;
          const pa = pts[i0];
          const pb = pts[Math.min(N, i0 + 1)];
          const lerp = (u: number, v: number) => u + (v - u) * fr;
          const pos = proj(lerp(pa[0], pb[0]), lerp(pa[1], pb[1]), lerp(pa[2], pb[2]), lerp(pa[3], pb[3]));
          const ahead = pts[Math.min(N, i0 + 2)];
          const behind = pts[Math.max(0, i0 - 1)];
          const qa = proj(ahead[0], ahead[1], ahead[2], ahead[3]);
          const qb = proj(behind[0], behind[1], behind[2], behind[3]);
          if (vis(pos)) {
            const tail = Math.max(0, i0 - 14);
            for (let j = tail; j < i0; j++) {
              const u = pts[j];
              const v = pts[j + 1];
              const a = proj(u[0], u[1], u[2], u[3]);
              const b = proj(v[0], v[1], v[2], v[3]);
              if (!vis(a) || !vis(b)) continue;
              const w = (j - tail) / Math.max(1, i0 - tail);
              ctx.strokeStyle = `rgba(255,255,255,${w * 0.85})`;
              ctx.lineWidth = (1 + w * 3) * s;
              ctx.beginPath();
              ctx.moveTo(a[0], a[1]);
              ctx.lineTo(b[0], b[1]);
              ctx.stroke();
            }
            const ang = Math.atan2(qa[1] - qb[1], qa[0] - qb[0]);
            const sc = s * 1.15 * (0.85 + (pos[3] > 1 ? 0.4 : 0.2));
            ctx.save();
            ctx.translate(pos[0], pos[1]);
            ctx.rotate(ang);
            ctx.scale(sc, sc);
            ctx.shadowColor = "rgba(0,0,0,0.45)";
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = 3;
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            const shape = [13, 0, 9, -1.6, 2, -1.8, -3, -10, -6, -10, -3, -1.8, -9, -1.6, -11.5, -5, -13.5, -5, -12, 0, -13.5, 5, -11.5, 5, -9, 1.6, -3, 1.8, -6, 10, -3, 10, 2, 1.8, 9, 1.6];
            ctx.moveTo(shape[0], shape[1]);
            for (let k = 2; k < shape.length; k += 2) ctx.lineTo(shape[k], shape[k + 1]);
            ctx.closePath();
            ctx.fill();
            ctx.shadowColor = "transparent";
            ctx.fillStyle = "#F3AE78";
            ctx.beginPath();
            ctx.arc(-12.6, 0, 1.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.clearInterval(cycle);
    };
  }, []);

  const r = routes[active ?? 0];
  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1" }}>
      <canvas
        ref={canvas}
        role="img"
        aria-label={r ? `Globe showing a route from ${r.aLabel} to ${r.bLabel}` : "Globe"}
        onClick={(ev) => {
          if (!onPick || !canvas.current) return;
          const box = canvas.current.getBoundingClientRect();
          const x = ev.clientX - box.left;
          const y = ev.clientY - box.top;
          let best: number | null = null;
          let bd = 30;
          for (const h of hits.current) {
            const d = Math.hypot(h.x - x, h.y - y);
            if (d < bd) {
              bd = d;
              best = h.i;
            }
          }
          if (best !== null) onPick(best);
        }}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", cursor: onPick ? "pointer" : "default" }}
      />
    </div>
  );
}
