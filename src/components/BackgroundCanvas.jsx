import { useRef, useEffect } from "react";

export default function BackgroundCanvas({ analyserRef, fftAnalyserRef, isPlaying, color, T }) {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx    = canvas.getContext("2d");
    const resize = () => {
      canvas.width  = canvas.offsetWidth  * devicePixelRatio;
      canvas.height = canvas.offsetHeight * devicePixelRatio;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      const W = canvas.width, H = canvas.height;

      // clear
      ctx.clearRect(0, 0, W, H);

      if (!analyserRef.current || !isPlaying) {
        // idle: subtle drifting sine
        ctx.beginPath();
        const t = Date.now() / 1000;
        for (let x = 0; x < W; x++) {
          const y = H / 2 + Math.sin(x / 30 + t * 1.4) * H * 0.12 + Math.sin(x / 70 + t * 0.6) * H * 0.06;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = color + "33";
        ctx.lineWidth   = 1 * devicePixelRatio;
        ctx.shadowColor = color;
        ctx.shadowBlur  = 6;
        ctx.stroke();
        ctx.shadowBlur  = 0;
        return;
      }

      const wave = analyserRef.current.getValue(), n = wave.length, sw = W / n;

      // soft halo
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const y = (wave[i] * 0.5 + 0.5) * H;
        i === 0 ? ctx.moveTo(i * sw, y) : ctx.lineTo(i * sw, y);
      }
      ctx.strokeStyle = color + "22";
      ctx.lineWidth   = 5 * devicePixelRatio;
      ctx.shadowColor = color;
      ctx.shadowBlur  = 14;
      ctx.stroke();

      // crisp core
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const y = (wave[i] * 0.5 + 0.5) * H;
        i === 0 ? ctx.moveTo(i * sw, y) : ctx.lineTo(i * sw, y);
      }
      ctx.strokeStyle = color + "dd";
      ctx.lineWidth   = 1.2 * devicePixelRatio;
      ctx.shadowColor = color;
      ctx.shadowBlur  = 10;
      ctx.stroke();
      ctx.shadowBlur  = 0;
    };

    draw();
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect(); };
  }, [isPlaying, color]);

  return (
    <div style={{
      position: "fixed", bottom: 54, right: 20, zIndex: 10,
      width: 220, height: 72,
      border: `1px solid ${color}28`,
      borderRadius: 6,
      background: "rgba(8,8,12,0.72)",
      backdropFilter: "blur(8px)",
      overflow: "hidden",
      pointerEvents: "none",
    }}>
      {/* label */}
      <div style={{
        position: "absolute", top: 5, left: 8,
        fontFamily: "monospace", fontSize: 7, letterSpacing: 1.5,
        color: color + "55", pointerEvents: "none", userSelect: "none",
      }}>
        OSC
      </div>
      {/* scanline overlay */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "repeating-linear-gradient(to bottom, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
        pointerEvents: "none",
      }} />
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
}
