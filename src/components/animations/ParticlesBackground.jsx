import React, { useEffect, useRef } from "react";

/**
 * Lightweight particle / mesh background.
 * Pure canvas, no deps. Reactive to mouse.
 */
export default function ParticlesBackground() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf;
    let particles = [];
    let w, h;

    const resize = () => {
      w = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      h = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    };

    const init = () => {
      const count = Math.floor((canvas.offsetWidth * canvas.offsetHeight) / 14000);
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.2 * window.devicePixelRatio,
        vy: (Math.random() - 0.5) * 0.2 * window.devicePixelRatio,
        r: (Math.random() * 1.6 + 0.4) * window.devicePixelRatio,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const mx = mouseRef.current.x * window.devicePixelRatio;
      const my = mouseRef.current.y * window.devicePixelRatio;

      // particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        const dx = p.x - mx;
        const dy = p.y - my;
        const d = Math.hypot(dx, dy);
        if (d < 140 * window.devicePixelRatio) {
          p.x += (dx / d) * 0.6;
          p.y += (dy / d) * 0.6;
        }

        ctx.beginPath();
        ctx.fillStyle = "rgba(168, 85, 247, 0.65)";
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // links
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          const max = 110 * window.devicePixelRatio;
          if (dist < max) {
            const op = 1 - dist / max;
            ctx.strokeStyle = `rgba(236, 72, 153, ${op * 0.25})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      raf = requestAnimationFrame(draw);
    };

    const onMouse = (e) => {
      const r = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onLeave = () => (mouseRef.current = { x: -9999, y: -9999 });

    resize();
    init();
    draw();

    window.addEventListener("resize", () => {
      resize();
      init();
    });
    canvas.addEventListener("mousemove", onMouse);
    canvas.addEventListener("mouseleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mousemove", onMouse);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-testid="particles-canvas"
      className="absolute inset-0 h-full w-full"
      style={{ display: "block" }}
    />
  );
}