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
        ctx.beginPath();
        const t = Date.now() / 1000;
        for (let x = 0; x < W; x++) {
          const y = H / 2 + Math.sin(x / 80 + t * 1.5) * 18 + Math.sin(x / 160 + t * 0.7) * 9;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = color + "18"; ctx.lineWidth = 1.5; ctx.stroke();
        return;
      }

      const wave = analyserRef.current.getValue(), n = wave.length, sw = W / n;
      ctx.beginPath();
      for (let i = 0; i < n; i++) { const y = (wave[i] * 0.5 + 0.5) * H; i === 0 ? ctx.moveTo(i * sw, y) : ctx.lineTo(i * sw, y); }
      for (let i = n - 1; i >= 0; i--) ctx.lineTo(i * sw, H - (wave[i] * 0.5 + 0.5) * H);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, color + "05"); g.addColorStop(0.5, color + "14"); g.addColorStop(1, color + "05");
      ctx.fillStyle = g; ctx.fill();

      ctx.beginPath();
      for (let i = 0; i < n; i++) { const y = (wave[i] * 0.5 + 0.5) * H; i === 0 ? ctx.moveTo(i * sw, y) : ctx.lineTo(i * sw, y); }
      ctx.strokeStyle = color + "bb"; ctx.lineWidth = 1.5; ctx.shadowColor = color; ctx.shadowBlur = 10; ctx.stroke(); ctx.shadowBlur = 0;

      if (fftAnalyserRef.current) {
        try {
          const fft = fftAnalyserRef.current.getValue(), bw = W / fft.length;
          for (let i = 0; i < fft.length; i++) {
            const norm = Math.max(0, (fft[i] + 80) / 80);
            ctx.fillStyle = color + Math.round(norm * 0x55).toString(16).padStart(2, "0");
            ctx.fillRect(i * bw, H - norm * H * 0.13, Math.max(1, bw - 1), norm * H * 0.13);
          }
        } catch (e) {}
      }
    };

    draw();
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect(); };
  }, [isPlaying, color, canvasFade]);

  return (
    <canvas ref={canvasRef} style={{ position:"fixed", top:0, left:0, width:"100%", height:"100%", zIndex:0, pointerEvents:"none" }} />
  );
}
