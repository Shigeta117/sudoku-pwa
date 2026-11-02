/**
 * Coins and sparks on one full-screen canvas. The animation loop runs only while
 * particles are alive, so an idle board costs nothing.
 */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
  coin: boolean;
  spin: number;
}

const MAX_PARTICLES = 400;
const GRAVITY = 0.32;

export function createParticles(canvas: HTMLCanvasElement) {
  const g = canvas.getContext('2d');
  let particles: Particle[] = [];
  let frame = 0;
  let rainbow = false;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    g?.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);

  function drawCoin(p: Particle, alpha: number) {
    if (!g) return;
    const squash = Math.abs(Math.cos(p.spin));
    g.save();
    g.translate(p.x, p.y);
    g.scale(Math.max(squash, 0.15), 1);
    const grad = g.createRadialGradient(-p.size * 0.3, -p.size * 0.3, 1, 0, 0, p.size);
    grad.addColorStop(0, `rgba(255,250,210,${alpha})`);
    grad.addColorStop(0.5, `rgba(255,196,40,${alpha})`);
    grad.addColorStop(1, `rgba(180,110,0,${alpha})`);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, 0, p.size, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = `rgba(120,70,0,${alpha * 0.8})`;
    g.lineWidth = 1.2;
    g.stroke();
    g.restore();
  }

  function drawSpark(p: Particle, alpha: number) {
    if (!g) return;
    const light = rainbow ? 60 : 65;
    g.strokeStyle = `hsla(${p.hue},100%,${light}%,${alpha})`;
    g.lineWidth = p.size * 0.5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(p.x, p.y);
    g.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2);
    g.stroke();
  }

  function tick() {
    if (!g) return;
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.globalCompositeOperation = 'lighter';
    particles = particles.filter((p) => p.life > 0);
    for (const p of particles) {
      p.vy += p.coin ? GRAVITY : GRAVITY * 0.35;
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.spin += 0.25;
      p.life -= 1;
      const alpha = Math.min(1, p.life / (p.maxLife * 0.35));
      if (p.coin) {
        g.globalCompositeOperation = 'source-over';
        drawCoin(p, alpha);
        g.globalCompositeOperation = 'lighter';
      } else {
        drawSpark(p, alpha);
      }
    }
    frame = particles.length > 0 ? requestAnimationFrame(tick) : 0;
  }

  function add(list: Particle[]) {
    particles = [...particles, ...list].slice(-MAX_PARTICLES);
    if (!frame) frame = requestAnimationFrame(tick);
  }

  function spark(x: number, y: number, speed: number, hue: number): Particle {
    const angle = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.8);
    const life = 30 + Math.random() * 25;
    return { x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v - 2, life, maxLife: life, size: 2 + Math.random() * 3, hue, coin: false, spin: 0 };
  }

  function coin(x: number, y: number, vx: number, vy: number): Particle {
    const life = 70 + Math.random() * 40;
    return { x, y, vx, vy, life, maxLife: life, size: 6 + Math.random() * 5, hue: 45, coin: true, spin: Math.random() * 6 };
  }

  return {
    setRainbow(on: boolean) {
      rainbow = on;
    },
    /** Sparks plus a few coins from a point (a placed digit) */
    burst(x: number, y: number, size: number) {
      const list: Particle[] = [];
      for (let i = 0; i < size; i++) {
        const hue = rainbow ? Math.random() * 360 : 35 + Math.random() * 25;
        list.push(spark(x, y, 5 + size * 0.12, hue));
      }
      for (let i = 0; i < Math.ceil(size / 8); i++) {
        list.push(coin(x, y, (Math.random() - 0.5) * 6, -5 - Math.random() * 5));
      }
      add(list);
    },
    /** Coins shooting up from the bottom edge (jackpot) */
    fountain(count: number) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const list: Particle[] = [];
      for (let i = 0; i < count; i++) {
        list.push(coin(w * (0.15 + Math.random() * 0.7), h + 10, (Math.random() - 0.5) * 7, -14 - Math.random() * 9));
      }
      add(list);
    },
    destroy() {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      particles = [];
    },
  };
}
