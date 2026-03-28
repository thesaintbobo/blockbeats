import { useRef, useEffect } from "react";

export default function BackgroundCanvas({ analyserRef, fftAnalyserRef, isPlaying, color, canvasFade }) {
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
      ctx.fillStyle = canvasFade;
      ctx.fillRect(0, 0, W, H);

      if (!analyserRef.current || !isPlaying) {
        // idle: subtle drifting sine
        ctx.beginPath();
        const t = Date.now() / 1000;
        for (let x = 0; x < W; x++) {
          const y = H / 2 + Math.sin(x / 80 + t * 1.5) * 14 + Math.sin(x / 200 + t * 0.6) * 6;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = color + "22";
        ctx.lineWidth = 1.5 * devicePixelRatio;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
        return;
      }

      const wave = analyserRef.current.getValue(), n = wave.length, sw = W / n;

      // ── sharp oscilloscope line ──────────────────────────────────────────────
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const y = (wave[i] * 0.5 + 0.5) * H;
        i === 0 ? ctx.moveTo(i * sw, y) : ctx.lineTo(i * sw, y);
      }
      // outer soft halo
      ctx.strokeStyle = color + "33";
      ctx.lineWidth   = 6 * devicePixelRatio;
      ctx.shadowColor = color;
      ctx.shadowBlur  = 28;
      ctx.stroke();
      // crisp bright core line
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const y = (wave[i] * 0.5 + 0.5) * H;
        i === 0 ? ctx.moveTo(i * sw, y) : ctx.lineTo(i * sw, y);
      }
      ctx.strokeStyle = color + "ee";
      ctx.lineWidth   = 1.5 * devicePixelRatio;
      ctx.shadowColor = color;
      ctx.shadowBlur  = 18;
      ctx.stroke();
      ctx.shadowBlur  = 0;

      // ── FFT bars along bottom ────────────────────────────────────────────────
      if (fftAnalyserRef.current) {
        try {
          const fft = fftAnalyserRef.current.getValue(), bw = W / fft.length;
          for (let i = 0; i < fft.length; i++) {
            const norm = Math.max(0, (fft[i] + 80) / 80);
            const barH = norm * H * 0.10;
            ctx.fillStyle = color + Math.round(norm * 0x44).toString(16).padStart(2, "0");
            ctx.fillRect(i * bw, H - barH, Math.max(1, bw - 1), barH);
          }
        } catch (e) {}
      }
    };

    draw();
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect(); };
  }, [isPlaying, color, canvasFade]);

  return (
    <canvas ref={canvasRef} style={{
      position: "fixed", top: 0, left: 0,
      width: "100%", height: "100%",
      zIndex: 4, pointerEvents: "none",
      mixBlendMode: "screen",
    }} />
  );
}
