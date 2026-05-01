const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const screenNameEl = document.getElementById('screenName');
const inventoryCountEl = document.getElementById('inventoryCount');
const objectivesDoneEl = document.getElementById('objectivesDone');
const objectivesTotalEl = document.getElementById('objectivesTotal');
const inventoryListEl = document.getElementById('inventoryList');
const objectiveListEl = document.getElementById('objectiveList');
const messageEl = document.getElementById('message');
document.getElementById('restart').addEventListener('click', init);

const W = canvas.width;
const H = canvas.height;
const FLOOR_Y = 540;
const GRAVITY = 0.55;
const keys = {};
const touchState = { left: false, right: false, jump: false, take: false, give: false, talk: false };
const actionLatch = { take: false, give: false, talk: false };

window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

for (const btn of document.querySelectorAll('[data-touch]')) {
  const action = btn.dataset.touch;
  const on = (e) => { e.preventDefault(); touchState[action] = true; };
  const off = (e) => { e.preventDefault(); touchState[action] = false; };
  btn.addEventListener('touchstart', on, { passive: false });
  btn.addEventListener('touchend', off, { passive: false });
  btn.addEventListener('touchcancel', off, { passive: false });
  btn.addEventListener('mousedown', on);
  btn.addEventListener('mouseup', off);
  btn.addEventListener('mouseleave', off);
}

const itemInfo = {
  scarf: { label: 'Red Scarf', color: '#ff5a7a' },
  token: { label: 'Arcade Token', color: '#7be7ff' },
  teddy: { label: 'Tiny Teddy', color: '#c79a5b' },
  apple: { label: 'Green Apple', color: '#7bff9e' },
  brochure: { label: 'Mall Brochure', color: '#ffe777' },
  flower: { label: 'Potted Flower', color: '#ff9bf1' },
  sandwich: { label: 'Cheese Sandwich', color: '#ffcf71' },
  batteries: { label: 'Toy Batteries', color: '#bbbfd4' },
  ribbon: { label: 'Blue Ribbon', color: '#6fb0ff' },
  postcard: { label: 'Fountain Postcard', color: '#f4dfb8' }
};

const sceneOrder = [
  'atrium','dizzywear','games','kiddies','foodcourt',
  'directory','fountain','roofgarden','toybridge','backhall'
];

const scenes = {
  atrium: {
    name: 'Atrium', bg: ['#09131f','#10263b'], accent: '#6de7ff', store: null,
    exits: { left: 'foodcourt', right: 'directory' }, stairsUp: 'roofgarden', stairsDown: 'backhall',
    trees: [{x:130,y:510},{x:820,y:510}],
    items: [{id:'brochure_atrium', key:'brochure', x:470, y:514, taken:false}],
    npcs: [
      { id:'greeter', name:'Greeter Pip', x:250, y:500, color:'#ffd84d', leisure:[
        'Welcome to Dizzy Mall. The escalators squeak, but they never judge.',
        'If you get lost, nod confidently. That is what grown-ups do too.'
      ], objective:{ id:'brochure', need:'brochure', doneText:'Lovely. With the brochure back, I can stop pretending I know the map.', reward:'postcard', rewardText:'Take this fountain postcard. It makes every wrong turn feel intentional.' }},
      { id:'benchpal', name:'Mina on the Bench', x:700, y:500, color:'#ff96d0', leisure:[
        'I come here to listen to escalators and think dramatic thoughts.',
        'The fountain upstairs throws better sparkles when nobody is rushing.'
      ]}
    ]
  },
  dizzywear: {
    name: 'Dizzywear', bg: ['#220a20','#3d123a'], accent: '#ff72ef', store:'DIZZYWEAR',
    exits: { right: 'games' }, stairsDown:'atrium', trees:[{x:90,y:510}],
    items: [{id:'scarf_shop', key:'scarf', x:300, y:505, taken:false},{id:'ribbon_shop', key:'ribbon', x:720, y:505, taken:false}],
    npcs: [
      { id:'tailor', name:'Tailor Bibi', x:560, y:500, color:'#ffc14a', leisure:[
        'A scarf improves any adventure by at least forty percent.',
        'I hem capes for people who dramatically point at objectives.'
      ], objective:{ id:'flower', need:'flower', doneText:'Oh perfect, a flower for the counter. The whole shop smells less like boxes now.', reward:'batteries', rewardText:'Take these toy batteries. The toy bridge kid was asking for some.' }}
    ]
  },
  games: {
    name: 'Games Arcade', bg: ['#091028','#172c54'], accent:'#5fa7ff', store:'GAMES',
    exits: { left: 'dizzywear', right: 'kiddies' }, stairsDown:'atrium', trees:[],
    items: [{id:'token_arcade', key:'token', x:250, y:505, taken:false}],
    npcs: [
      { id:'arcadekid', name:'Vex the Gamer', x:650, y:500, color:'#7bffda', leisure:[
        'The blinking machine only respects people who use exact change.',
        'I once lost three afternoons inside a claw machine strategy.'
      ], objective:{ id:'token', need:'token', doneText:'YES. The arcade token! Time to become champion of a very specific cabinet.', reward:'sandwich', rewardText:'You look peckish. Here, have my victory sandwich.' }}
    ]
  },
  kiddies: {
    name: 'Kiddies Corner', bg: ['#11230f','#275425'], accent:'#71ff8d', store:'KIDDIES',
    exits: { left: 'games', right: 'foodcourt' }, stairsDown:'atrium', trees:[{x:810,y:515}],
    items: [{id:'teddy_corner', key:'teddy', x:320, y:505, taken:false}],
    npcs: [
      { id:'nanny', name:'Nanny Flo', x:650, y:500, color:'#ffd7a8', leisure:[
        'Children can detect hidden sweets with military accuracy.',
        'The toy shelves are arranged by chaos and hope.'
      ], objective:{ id:'batteries', need:'batteries', doneText:'Ah! Fresh batteries. The singing rocket can haunt the room again.', reward:'apple', rewardText:'Please take this green apple before the toddlers negotiate for it.' }}
    ]
  },
  foodcourt: {
    name: 'Food Court', bg: ['#2a1608','#5b3215'], accent:'#ffd36a', store:'FOOD',
    exits: { left: 'kiddies', right: 'atrium' }, stairsDown:'backhall', trees:[{x:120,y:512}],
    items: [{id:'flower_food', key:'flower', x:770, y:505, taken:false}],
    npcs: [
      { id:'chef', name:'Chef Nori', x:420, y:500, color:'#ff8d6b', leisure:[
        'A food court is just a ballroom where trays perform.',
        'The fries are gossiping again. I can hear the sizzling.'
      ], objective:{ id:'apple', need:'apple', doneText:'A crisp apple! Exactly what my balancing lunch needed.', reward:'sandwich', rewardText:'I made you a proper cheese sandwich in return.' }}
    ]
  },
  directory: {
    name: 'Grand Directory', bg: ['#10202f','#1f425f'], accent:'#ffe89b', store:'DIRECTORY',
    exits: { left: 'atrium', right: 'fountain' }, stairsUp:'toybridge', trees:[],
    items: [],
    npcs: [
      { id:'clerk', name:'Directory Dot', x:520, y:500, color:'#ffe37e', leisure:[
        'Maps are just stories for people who enjoy corners.',
        'I like giving directions in a mysterious tone. It raises morale.'
      ], objective:{ id:'postcard', need:'postcard', doneText:'That postcard proves the fountain still exists. Excellent record-keeping.', reward:'flower', rewardText:'Take this potted flower from lost property. It needs a new stage.' }}
    ]
  },
  fountain: {
    name: 'Fountain Court', bg: ['#082232','#0f4862'], accent:'#7defff', store:null,
    exits: { left: 'directory', right: 'roofgarden' }, stairsUp:'toybridge', trees:[{x:150,y:515},{x:790,y:515}],
    items: [{id:'postcard_fountain', key:'postcard', x:300, y:505, taken:false}],
    npcs: [
      { id:'poet', name:'Poet Rumi', x:640, y:500, color:'#cab4ff', leisure:[
        'Fountains are just poetry with plumbing.',
        'I have never met a coin that did not long for dramatic splashdown.'
      ]}
    ]
  },
  roofgarden: {
    name: 'Roof Garden', bg: ['#152d22','#2d6544'], accent:'#84ffba', store:null,
    exits: { left: 'fountain', right: 'toybridge' }, stairsDown:'atrium', trees:[{x:220,y:510},{x:500,y:510},{x:770,y:510}],
    items: [{id:'apple_roof', key:'apple', x:610, y:505, taken:false}],
    npcs: [
      { id:'gardener', name:'Gardener Lio', x:330, y:500, color:'#83ff9d', leisure:[
        'Trees indoors become very theatrical. They know people are watching.',
        'I trim hedges into shapes only birds appreciate.'
      ]}
    ]
  },
  toybridge: {
    name: 'Toy Bridge', bg: ['#1d162e','#40306a'], accent:'#94a8ff', store:null,
    exits: { left: 'roofgarden', right: 'backhall' }, stairsDown:'directory', trees:[],
    items: [],
    npcs: [
      { id:'builder', name:'Tomo the Builder', x:500, y:500, color:'#8fd7ff', leisure:[
        'I build worlds from spare rails and an unreasonable amount of optimism.',
        'The bridge looks serious, but secretly it enjoys being admired.'
      ], objective:{ id:'ribbon', need:'ribbon', doneText:'A ribbon! Perfect for the tiny parade flag I was missing.', reward:'teddy', rewardText:'I found this tiny teddy under a crate. It deserves a better story.' }}
    ]
  },
  backhall: {
    name: 'Back Hall', bg: ['#191919','#3a3a3a'], accent:'#d0d0d0', store:null,
    exits: { left: 'toybridge', right: 'atrium' }, stairsUp:'foodcourt', trees:[{x:840,y:514}],
    items: [],
    npcs: [
      { id:'porter', name:'Porter Jax', x:260, y:500, color:'#ffb980', leisure:[
        'Behind every shiny mall is a hallway doing all the real work.',
        'I like crates. They never interrupt.'
      ], objective:{ id:'sandwich', need:'sandwich', doneText:'You legend. A sandwich for the long haul.', reward:'scarf', rewardText:'Take this red scarf I found in the lost-and-found trolley.' }}
    ]
  }
};

let state;

function init() {
  state = {
    scene: 'atrium',
    player: { x: 120, y: FLOOR_Y - 38, w: 28, h: 38, vx: 0, vy: 0, onGround: true },
    inventory: [],
    completedObjectives: {},
    messages: [],
    dialogueCooldown: 0,
    lastActionText: 'Walk around the atrium and press TALK when you meet someone.'
  };
  for (const scene of Object.values(scenes)) {
    for (const item of scene.items) item.taken = false;
    for (const npc of scene.npcs) {
      if (npc.objective) npc.objective.completed = false;
      npc.leisureIndex = 0;
    }
  }
  updateSidePanels();
  setMessage(state.lastActionText);
}

function setMessage(text) {
  state.lastActionText = text;
  messageEl.textContent = text;
}

function hasItem(key) { return state.inventory.includes(key); }
function addItem(key) { if (!hasItem(key)) state.inventory.push(key); }
function removeItem(key) { state.inventory = state.inventory.filter(k => k !== key); }

function updateSidePanels() {
  const scene = scenes[state.scene];
  screenNameEl.textContent = scene.name;
  inventoryCountEl.textContent = state.inventory.length;

  const objectives = [];
  let done = 0;
  for (const scene of Object.values(scenes)) {
    for (const npc of scene.npcs) {
      if (npc.objective) {
        const text = `${npc.name}: bring ${itemInfo[npc.objective.need].label}`;
        objectives.push({ text, done: !!npc.objective.completed });
        if (npc.objective.completed) done++;
      }
    }
  }
  objectivesDoneEl.textContent = done;
  objectivesTotalEl.textContent = objectives.length;
  objectiveListEl.innerHTML = objectives.map(o => `<li>${o.done ? '✅' : '⬜'} ${o.text}</li>`).join('');
  inventoryListEl.innerHTML = state.inventory.length
    ? state.inventory.map(k => `<li>🎒 ${itemInfo[k].label}</li>`).join('')
    : '<li>Empty pockets.</li>';
}

function getScene() { return scenes[state.scene]; }

function justPressed(name, active) {
  if (active && !actionLatch[name]) { actionLatch[name] = true; return true; }
  if (!active) actionLatch[name] = false;
  return false;
}

function dist(a, b) {
  return Math.hypot((a.x + (a.w || 0) / 2) - b.x, (a.y + (a.h || 0) / 2) - b.y);
}

function nearestNpc() {
  const p = state.player;
  let best = null;
  for (const npc of getScene().npcs) {
    const d = dist(p, { x: npc.x, y: npc.y });
    if (d < 95 && (!best || d < best.d)) best = { npc, d };
  }
  return best?.npc || null;
}

function nearestItem() {
  const p = state.player;
  let best = null;
  for (const item of getScene().items) {
    if (item.taken) continue;
    const d = dist(p, { x: item.x, y: item.y });
    if (d < 80 && (!best || d < best.d)) best = { item, d };
  }
  return best?.item || null;
}

function useTalk() {
  const npc = nearestNpc();
  if (!npc) return setMessage('Nobody close enough for a proper chat.');
  if (npc.objective && !npc.objective.completed) {
    const need = itemInfo[npc.objective.need].label;
    const leisure = npc.leisure[npc.leisureIndex++ % npc.leisure.length];
    setMessage(`${npc.name}: ${leisure} Also... if you bring me ${need}, I might have something useful for you.`);
  } else {
    const leisure = npc.leisure[npc.leisureIndex++ % npc.leisure.length];
    setMessage(`${npc.name}: ${leisure}`);
  }
}

function useTake() {
  const item = nearestItem();
  if (!item) return setMessage('Nothing here to take right now.');
  item.taken = true;
  addItem(item.key);
  updateSidePanels();
  setMessage(`You picked up ${itemInfo[item.key].label}.`);
}

function useGive() {
  const npc = nearestNpc();
  if (!npc) return setMessage('There is nobody nearby to give something to.');
  if (!npc.objective || npc.objective.completed) return setMessage(`${npc.name} smiles, but does not need anything right now.`);
  const need = npc.objective.need;
  if (!hasItem(need)) return setMessage(`${npc.name} still needs ${itemInfo[need].label}.`);
  removeItem(need);
  npc.objective.completed = true;
  addItem(npc.objective.reward);
  updateSidePanels();
  setMessage(`${npc.name}: ${npc.objective.doneText} ${npc.objective.rewardText}`);
}

function sceneTransition(dir) {
  const scene = getScene();
  if (dir === 'left' && scene.exits.left) {
    state.scene = scene.exits.left;
    state.player.x = W - 70;
  } else if (dir === 'right' && scene.exits.right) {
    state.scene = scene.exits.right;
    state.player.x = 40;
  }
  state.player.y = FLOOR_Y - state.player.h;
  state.player.vx = 0;
  state.player.vy = 0;
  updateSidePanels();
  setMessage(`You enter ${getScene().name}.`);
}

function stairTransition(type) {
  const scene = getScene();
  const dest = type === 'up' ? scene.stairsUp : scene.stairsDown;
  if (!dest) return;
  state.scene = dest;
  state.player.x = type === 'up' ? 760 : 180;
  state.player.y = FLOOR_Y - state.player.h;
  state.player.vx = 0;
  state.player.vy = 0;
  updateSidePanels();
  setMessage(`You take the stairs ${type} to ${getScene().name}.`);
}

function update() {
  const p = state.player;
  const left = keys['arrowleft'] || keys['a'] || touchState.left;
  const right = keys['arrowright'] || keys['d'] || touchState.right;
  const jump = keys['arrowup'] || keys['w'] || keys[' '] || touchState.jump;
  const talk = keys['t'] || touchState.talk;
  const take = keys['e'] || touchState.take;
  const give = keys['g'] || touchState.give;

  p.vx = (left ? -3.2 : 0) + (right ? 3.2 : 0);
  if (jump && p.onGround) {
    p.vy = -10.8;
    p.onGround = false;
  }

  p.vy += GRAVITY;
  p.x += p.vx;
  p.y += p.vy;

  const stairsUpZone = { x: 760, y: 500, w: 110, h: 40 };
  const stairsDownZone = { x: 90, y: 500, w: 110, h: 40 };

  if (p.y >= FLOOR_Y - p.h) {
    p.y = FLOOR_Y - p.h;
    p.vy = 0;
    p.onGround = true;
  }

  if (p.x < -20) sceneTransition('left');
  if (p.x > W + 20) sceneTransition('right');

  if (jump && p.onGround) {
    if (rectOverlap(p, stairsUpZone) && getScene().stairsUp) stairTransition('up');
    if (rectOverlap(p, stairsDownZone) && getScene().stairsDown) stairTransition('down');
  }

  if (justPressed('talk', !!talk)) useTalk();
  if (justPressed('take', !!take)) useTake();
  if (justPressed('give', !!give)) useGive();
}

function rectOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function drawBackground(scene) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, scene.bg[0]);
  g.addColorStop(1, scene.bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 12; i++) ctx.fillRect(i * 80, 145, 50, 8);

  ctx.fillStyle = '#d7d7d7';
  ctx.fillRect(0, FLOOR_Y, W, 100);
  ctx.fillStyle = scene.accent;
  ctx.fillRect(0, FLOOR_Y + 74, W, 8);

  if (scene.store) {
    ctx.fillStyle = '#101418';
    ctx.fillRect(220, 175, 520, 120);
    ctx.strokeStyle = scene.accent;
    ctx.lineWidth = 4;
    ctx.strokeRect(220, 175, 520, 120);
    ctx.fillStyle = scene.accent;
    ctx.font = 'bold 42px monospace';
    ctx.fillText(scene.store, 300, 245);

    for (let i = 0; i < 4; i++) {
      const x = 250 + i * 120;
      ctx.fillStyle = '#1f2731';
      ctx.fillRect(x, 300, 80, 110);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(x, 300, 80, 110);
      ctx.fillStyle = ['#ff7aa2','#ffe16d','#7de8ff','#84ffae'][i % 4];
      ctx.fillRect(x + 14, 330, 50, 40);
      ctx.fillStyle = '#fff';
      ctx.fillRect(x + 20, 380, 38, 10);
    }
  }

  drawStairs(80, scene.stairsDown ? 'STAIRS ↓' : '');
  drawStairs(750, scene.stairsUp ? 'STAIRS ↑' : '', true);

  for (const tree of scene.trees) drawTree(tree.x, tree.y);
}

function drawStairs(x, label, mirrored = false) {
  ctx.fillStyle = '#7e8ea0';
  for (let i = 0; i < 5; i++) {
    const stepX = mirrored ? x - i * 16 : x + i * 16;
    const stepY = 520 - i * 10;
    ctx.fillRect(stepX, stepY, 50, 10);
  }
  if (label) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(label, mirrored ? x - 40 : x + 8, 458);
  }
}

function drawTree(x, y) {
  ctx.fillStyle = '#6b4520';
  ctx.fillRect(x + 12, y - 30, 10, 32);
  ctx.fillStyle = '#2abd55';
  ctx.beginPath(); ctx.arc(x + 18, y - 42, 28, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 2, y - 22, 20, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 34, y - 18, 18, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c79a63';
  ctx.fillRect(x, y, 40, 12);
}

function drawNpc(npc) {
  ctx.fillStyle = npc.color;
  ctx.beginPath();
  ctx.arc(npc.x, npc.y - 20, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(npc.x - 10, npc.y - 4, 20, 26);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(npc.name, npc.x - 38, npc.y - 40);
  if (npc.objective && !npc.objective.completed) {
    ctx.fillStyle = '#ffe16d';
    ctx.fillText('!', npc.x + 20, npc.y - 25);
  }
}

function drawItem(item) {
  const info = itemInfo[item.key];
  ctx.fillStyle = info.color;
  ctx.beginPath();
  ctx.roundRect(item.x - 14, item.y - 16, 28, 20, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '12px monospace';
  ctx.fillText(info.label, item.x - 36, item.y - 24);
}

function drawPlayer() {
  const p = state.player;
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.ellipse(p.x + p.w / 2, p.y + p.h / 2, 14, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.fillRect(p.x + 8, p.y + 12, 3, 3);
  ctx.fillRect(p.x + 16, p.y + 12, 3, 3);
  ctx.fillRect(p.x + 10, p.y + 20, 8, 2);
  ctx.fillStyle = '#ff3056';
  ctx.fillRect(p.x - 5, p.y + 16, 8, 8);
  ctx.fillRect(p.x + p.w - 3, p.y + 16, 8, 8);
  ctx.fillRect(p.x + 4, p.y + p.h - 4, 8, 6);
  ctx.fillRect(p.x + 16, p.y + p.h - 4, 8, 6);
}

function drawHints() {
  const npc = nearestNpc();
  const item = nearestItem();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(20, 20, 580, 48);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px monospace';
  const parts = [];
  if (npc) parts.push(`💬 TALK with ${npc.name}`);
  if (item) parts.push(`🤏 TAKE ${itemInfo[item.key].label}`);
  if (npc && npc.objective && !npc.objective.completed && hasItem(npc.objective.need)) parts.push(`🎁 GIVE ${itemInfo[npc.objective.need].label}`);
  if (!parts.length) parts.push('Explore, jump on the stairs, and chat with the mall crowd.');
  ctx.fillText(parts.join('  •  '), 34, 50);
}

function draw() {
  const scene = getScene();
  drawBackground(scene);
  for (const item of scene.items) if (!item.taken) drawItem(item);
  scene.npcs.forEach(drawNpc);
  drawPlayer();
  drawHints();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

init();
requestAnimationFrame(loop);
