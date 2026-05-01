const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const shopsEl = document.getElementById('shops');
const timeEl = document.getElementById('time');
const messageEl = document.getElementById('message');
document.getElementById('restart').addEventListener('click', init);

const W = canvas.width;
const H = canvas.height;
const GRAVITY = 0.55;
const keys = {};
const touchState = { left: false, right: false, jump: false };

window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

for (const btn of document.querySelectorAll('[data-touch]')) {
  const action = btn.dataset.touch;
  const on = (e) => {
    e.preventDefault();
    touchState[action] = true;
  };
  const off = (e) => {
    e.preventDefault();
    touchState[action] = false;
  };
  btn.addEventListener('touchstart', on, { passive: false });
  btn.addEventListener('touchend', off, { passive: false });
  btn.addEventListener('touchcancel', off, { passive: false });
  btn.addEventListener('mousedown', on);
  btn.addEventListener('mouseup', off);
  btn.addEventListener('mouseleave', off);
}

let state;

const platforms = [
  { x: 40, y: 560, w: 880, h: 32 },
  { x: 80, y: 390, w: 330, h: 20 },
  { x: 555, y: 390, w: 300, h: 20 },
  { x: 140, y: 215, w: 250, h: 20 },
  { x: 535, y: 215, w: 275, h: 20 },
];

const escalators = [
  { x1: 315, y1: 560, x2: 520, y2: 390 },
  { x1: 650, y1: 560, x2: 470, y2: 390 },
  { x1: 265, y1: 390, x2: 480, y2: 215 },
];

const shopDefs = [
  { name: 'DIZZYWEAR', x: 95, y: 330, color: '#ff4de1', token: '#ffd84d' },
  { name: 'GAMES', x: 585, y: 330, color: '#47a6ff', token: '#4df58b' },
  { name: 'KIDDIES', x: 155, y: 155, color: '#49ff7d', token: '#ff6c8a' },
  { name: 'FOOD', x: 575, y: 155, color: '#ffd84d', token: '#2ce6ff' },
];

function init() {
  state = {
    player: { x: 80, y: 500, w: 26, h: 34, vx: 0, vy: 0, onGround: false },
    score: 0,
    collected: 0,
    time: 90,
    gameOver: false,
    won: false,
    startedAt: performance.now(),
    lastTickSecond: 0,
    shops: shopDefs.map((s, i) => ({ ...s, picked: false, tx: s.x + 100, ty: s.y - 18, id: i })),
    directory: { x: 428, y: 505, w: 82, h: 55 },
  };
  messageEl.textContent = 'Clear the mall before time runs out.';
  updateHud();
}

function updateHud() {
  scoreEl.textContent = state.score;
  shopsEl.textContent = state.collected;
  timeEl.textContent = state.time;
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function lineDistance(px, py, x1, y1, x2, y2) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  const t = clamp(dot / lenSq, 0, 1);
  const lx = x1 + t * C;
  const ly = y1 + t * D;
  return { dist: Math.hypot(px - lx, py - ly), t, x: lx, y: ly };
}

function update(dt) {
  if (state.gameOver) return;

  const elapsed = Math.floor((performance.now() - state.startedAt) / 1000);
  if (elapsed !== state.lastTickSecond) {
    state.lastTickSecond = elapsed;
    state.time = Math.max(0, 90 - elapsed);
    if (state.time === 0) {
      state.gameOver = true;
      messageEl.textContent = 'Mall closed. Restart and try a cleaner run.';
    }
    updateHud();
  }

  const p = state.player;
  const left = keys['arrowleft'] || keys['a'] || touchState.left;
  const right = keys['arrowright'] || keys['d'] || touchState.right;
  const jump = keys['arrowup'] || keys['w'] || keys[' '] || touchState.jump;

  p.vx = (left ? -1 : 0) + (right ? 1 : 0);
  p.vx *= 3.1;

  let onEscalator = false;
  let jumpingFromEscalator = false;
  for (const esc of escalators) {
    const probe = lineDistance(p.x + p.w / 2, p.y + p.h, esc.x1, esc.y1, esc.x2, esc.y2);
    if (probe.dist < 13 && p.x + p.w / 2 > Math.min(esc.x1, esc.x2) - 6 && p.x + p.w / 2 < Math.max(esc.x1, esc.x2) + 6) {
      onEscalator = true;
      p.onGround = true;
      p.vy = 0;
      p.y = probe.y - p.h;

      if (jump) {
        p.vy = -10.5;
        p.onGround = false;
        onEscalator = false;
        jumpingFromEscalator = true;
        break;
      }

      p.x += (esc.x2 > esc.x1 ? 0.9 : -0.9);
      if (left) p.x -= 1.6;
      if (right) p.x += 1.6;
      break;
    }
  }

  if (!onEscalator) {
    if (jump && p.onGround && !jumpingFromEscalator) {
      p.vy = -10.5;
      p.onGround = false;
    }
    p.vy += GRAVITY;
    p.y += p.vy;
    p.onGround = false;

    for (const plat of platforms) {
      const feetPrev = p.y + p.h - p.vy;
      if (p.x + p.w > plat.x && p.x < plat.x + plat.w && feetPrev <= plat.y && p.y + p.h >= plat.y) {
        p.y = plat.y - p.h;
        p.vy = 0;
        p.onGround = true;
      }
    }
  }

  p.x += p.vx;
  p.x = clamp(p.x, 18, W - p.w - 18);
  if (p.y > H + 50) {
    p.x = 80; p.y = 500; p.vx = 0; p.vy = 0;
  }

  for (const shop of state.shops) {
    if (!shop.picked) {
      const token = { x: shop.tx - 10, y: shop.ty - 10, w: 20, h: 20 };
      if (rectsOverlap(p, token)) {
        shop.picked = true;
        state.collected++;
        state.score += 250;
        messageEl.textContent = `${shop.name} cleared.`;
        if (state.collected === 4) {
          messageEl.textContent = 'All shops cleared. Head for the directory!';
        }
        updateHud();
      }
    }
  }

  if (state.collected === 4 && rectsOverlap(p, state.directory)) {
    state.gameOver = true;
    state.won = true;
    state.score += state.time * 10;
    updateHud();
    messageEl.textContent = `Mall conquered. Final score: ${state.score}.`;
  }
}

function drawStar(x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i;
    ctx.moveTo(Math.cos(a) * (r * 0.35), Math.sin(a) * (r * 0.35));
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.stroke();
  ctx.restore();
}

function drawEscalator(e) {
  ctx.strokeStyle = '#9ceeff';
  ctx.lineWidth = 18;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(e.x1, e.y1);
  ctx.lineTo(e.x2, e.y2);
  ctx.stroke();

  ctx.strokeStyle = '#29495f';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const x = e.x1 + (e.x2 - e.x1) * t;
    const y = e.y1 + (e.y2 - e.y1) * t;
    ctx.beginPath();
    ctx.moveTo(x - 10, y + 8);
    ctx.lineTo(x + 10, y - 8);
    ctx.stroke();
  }
}

function drawPlayer() {
  const p = state.player;
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.ellipse(p.x + p.w / 2, p.y + p.h / 2, 13, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#111';
  ctx.fillRect(p.x + 8, p.y + 11, 3, 3);
  ctx.fillRect(p.x + 15, p.y + 11, 3, 3);
  ctx.fillRect(p.x + 11, p.y + 18, 6, 2);

  ctx.fillStyle = '#ff3056';
  ctx.fillRect(p.x - 5, p.y + 14, 7, 7);
  ctx.fillRect(p.x + p.w - 2, p.y + 14, 7, 7);
  ctx.fillRect(p.x + 3, p.y + p.h - 4, 8, 5);
  ctx.fillRect(p.x + 15, p.y + p.h - 4, 8, 5);
}

function drawShop(shop) {
  ctx.fillStyle = '#0f1722';
  ctx.fillRect(shop.x, shop.y, 150, 42);
  ctx.strokeStyle = shop.color;
  ctx.lineWidth = 3;
  ctx.strokeRect(shop.x, shop.y, 150, 42);
  ctx.fillStyle = shop.color;
  ctx.font = 'bold 18px monospace';
  ctx.fillText(shop.name, shop.x + 12, shop.y + 27);

  if (!shop.picked) {
    ctx.fillStyle = shop.token;
    ctx.beginPath();
    ctx.arc(shop.tx, shop.ty, 10, 0, Math.PI * 2);
    ctx.fill();
    drawStar(shop.tx, shop.ty, 13, '#fff');
  }
}

function drawDirectory() {
  const d = state.directory;
  ctx.fillStyle = '#f8f3c8';
  ctx.fillRect(d.x, d.y, d.w, d.h);
  ctx.strokeStyle = '#222';
  ctx.strokeRect(d.x, d.y, d.w, d.h);
  ctx.fillStyle = '#222';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('DIRECTORY', d.x + 8, d.y + 18);
  ctx.font = '10px monospace';
  ctx.fillText('YOU ARE HERE', d.x + 8, d.y + 36);
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#ff3056';
  ctx.font = 'bold 76px sans-serif';
  ctx.fillText('DIZZY', 295, 86);
  ctx.fillStyle = '#2ce6ff';
  ctx.fillText('MALL', 580, 86);
  drawStar(265, 70, 20, '#ff3056');
  drawStar(900, 70, 20, '#ff3056');

  ctx.fillStyle = '#fff';
  ctx.font = '16px monospace';
  ctx.fillText('WRITTEN BY THE OLIVER TWINS', 308, 118);

  ctx.strokeStyle = '#d6fdff';
  ctx.lineWidth = 4;
  ctx.strokeRect(30, 145, 900, 430);
  ctx.strokeRect(60, 175, 840, 370);

  platforms.forEach(plat => {
    ctx.fillStyle = '#dedede';
    ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
    ctx.fillStyle = '#78d3da';
    ctx.fillRect(plat.x, plat.y + plat.h - 6, plat.w, 6);
  });

  escalators.forEach(drawEscalator);
  state.shops.forEach(drawShop);

  // Mall sign
  ctx.fillStyle = '#f7d84d';
  ctx.fillRect(362, 172, 220, 35);
  ctx.fillStyle = '#111';
  ctx.font = 'bold 26px monospace';
  ctx.fillText('DIZZY MALL', 385, 197);

  // shrubs
  for (let i = 0; i < 6; i++) {
    const x = 85 + i * 145;
    ctx.fillStyle = '#27bb48';
    ctx.beginPath();
    ctx.arc(x, 540, 14, 0, Math.PI * 2);
    ctx.arc(x + 12, 546, 14, 0, Math.PI * 2);
    ctx.arc(x + 24, 540, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  drawDirectory();
  drawPlayer();

  if (state.gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = state.won ? '#4df58b' : '#ffd84d';
    ctx.font = 'bold 52px monospace';
    ctx.fillText(state.won ? 'MALL CLEARED' : 'GAME OVER', 280, 280);
    ctx.fillStyle = '#fff';
    ctx.font = '20px monospace';
    ctx.fillText('Press Restart to play again', 320, 325);
  }
}

let last = 0;
function loop(ts) {
  const dt = (ts - last) / 16.67;
  last = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

init();
requestAnimationFrame(loop);
