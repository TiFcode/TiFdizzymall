const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const screenNameEl = document.getElementById('screenName');
const inventoryCountEl = document.getElementById('inventoryCount');
const objectivesDoneEl = document.getElementById('objectivesDone');
const objectivesTotalEl = document.getElementById('objectivesTotal');
const inventoryListEl = document.getElementById('inventoryList');
const objectiveListEl = document.getElementById('objectiveList');
const nearbyListEl = document.getElementById('nearbyList');
const messageEl = document.getElementById('message');
const dialogueOverlayEl = document.getElementById('dialogueOverlay');
const dialogueSpeakerEl = document.getElementById('dialogueSpeaker');
const dialogueTextEl = document.getElementById('dialogueText');
const dialogueOptionsEl = document.getElementById('dialogueOptions');
const joystickBaseEl = document.getElementById('joystickBase');
const joystickKnobEl = document.getElementById('joystickKnob');
document.getElementById('restart').addEventListener('click', init);

const W = canvas.width;
const H = canvas.height;
const GRAVITY = 0.56;
const keys = {};
const touchState = { left: false, right: false, jump: false, take: false, give: false, talk: false };
const actionLatch = { take: false, give: false, talk: false };
const joystickState = { active: false, x: 0, y: 0, pointerId: null };

window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

for (const btn of document.querySelectorAll('[data-touch]')) {
  const action = btn.dataset.touch;
  const isDirectional = action === 'jump';
  const on = (e) => {
    e.preventDefault();
    if (isDirectional) {
      touchState[action] = true;
    } else {
      triggerAction(action);
    }
  };
  const off = (e) => {
    e.preventDefault();
    if (isDirectional) touchState[action] = false;
  };
  btn.addEventListener('touchstart', on, { passive: false });
  btn.addEventListener('touchend', off, { passive: false });
  btn.addEventListener('touchcancel', off, { passive: false });
  btn.addEventListener('mousedown', on);
  btn.addEventListener('mouseup', off);
  btn.addEventListener('mouseleave', off);
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!isDirectional) triggerAction(action);
  });
}

function setJoystickFromClient(clientX, clientY) {
  const rect = joystickBaseEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = clientX - cx;
  let dy = clientY - cy;
  const maxR = rect.width * 0.32;
  const len = Math.hypot(dx, dy) || 1;
  if (len > maxR) {
    dx = dx / len * maxR;
    dy = dy / len * maxR;
  }
  joystickState.x = dx / maxR;
  joystickState.y = dy / maxR;
  joystickKnobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

function resetJoystick() {
  joystickState.active = false;
  joystickState.x = 0;
  joystickState.y = 0;
  joystickState.pointerId = null;
  joystickKnobEl.style.transform = 'translate(-50%, -50%)';
}

joystickBaseEl.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  joystickState.active = true;
  joystickState.pointerId = e.pointerId;
  joystickBaseEl.setPointerCapture?.(e.pointerId);
  setJoystickFromClient(e.clientX, e.clientY);
});

joystickBaseEl.addEventListener('pointermove', (e) => {
  if (!joystickState.active || joystickState.pointerId !== e.pointerId) return;
  e.preventDefault();
  setJoystickFromClient(e.clientX, e.clientY);
});

const endJoystick = (e) => {
  if (joystickState.pointerId !== null && e.pointerId !== undefined && joystickState.pointerId !== e.pointerId) return;
  resetJoystick();
};

joystickBaseEl.addEventListener('pointerup', endJoystick);
joystickBaseEl.addEventListener('pointercancel', endJoystick);

const itemInfo = {
  scarf: { label: 'Red Scarf', color: '#ff5b77', icon: '🧣' },
  token: { label: 'Arcade Token', color: '#72e8ff', icon: '🪙' },
  teddy: { label: 'Tiny Teddy', color: '#c7924c', icon: '🧸' },
  apple: { label: 'Green Apple', color: '#78ff9b', icon: '🍏' },
  brochure: { label: 'Mall Brochure', color: '#ffe06e', icon: '📄' },
  flower: { label: 'Potted Flower', color: '#ff93e6', icon: '🪴' },
  sandwich: { label: 'Cheese Sandwich', color: '#ffca7a', icon: '🥪' },
  batteries: { label: 'Toy Batteries', color: '#c7cde0', icon: '🔋' },
  ribbon: { label: 'Blue Ribbon', color: '#79a8ff', icon: '🎀' },
  postcard: { label: 'Fountain Postcard', color: '#f4debb', icon: '💌' }
};

const scenes = {
  atrium: {
    name: 'Atrium', type: 'mall', sign: 'DIZZY MALL', palette: ['#08111d', '#11314a'], floor: 565,
    platforms: [
      { x: 40, y: 565, w: 880, h: 28 },
      { x: 90, y: 392, w: 300, h: 20 },
      { x: 565, y: 392, w: 260, h: 20 },
      { x: 145, y: 220, w: 225, h: 20 },
      { x: 560, y: 220, w: 225, h: 20 }
    ],
    escalators: [
      { x1: 315, y1: 565, x2: 520, y2: 392, dir: 1 },
      { x1: 640, y1: 565, x2: 462, y2: 392, dir: -1 },
      { x1: 255, y1: 392, x2: 468, y2: 220, dir: 1 }
    ],
    exits: [{ side: 'left', to: 'foodcourt' }, { side: 'right', to: 'directory' }],
    items: [{ id: 'brochure_atrium', key: 'brochure', x: 454, y: 531, taken: false }],
    trees: [{ x: 100, y: 550 }, { x: 832, y: 550 }],
    npcs: [
      { id: 'greeter', name: 'Greeter Pip', x: 218, y: 530, platformY: 565, color: '#ffd84d', leisure: ['Welcome to Dizzy Mall. Keep your grin polished and your shoes pointed toward mischief.', 'These escalators hum louder when the mall is thinking.'], objective: { need: 'brochure', doneText: 'Ah, the brochure! Now I can stop inventing directions.', reward: 'postcard', rewardText: 'Take this fountain postcard. It tends to open conversations.' } },
      { id: 'benchpal', name: 'Mina', x: 720, y: 530, platformY: 565, color: '#ff98cf', leisure: ['I come here to admire the architecture and ignore my errands.', 'The upper railings are excellent for dramatic pauses.'] }
    ],
    decorations: [{ type: 'directory', x: 432, y: 510 }]
  },
  dizzywear: {
    name: 'Dizzywear', type: 'shop', store: 'DIZZYWEAR', palette: ['#210d21', '#4f1b48'], floor: 565,
    platforms: [{ x: 36, y: 565, w: 888, h: 28 }, { x: 100, y: 410, w: 220, h: 18 }, { x: 640, y: 410, w: 200, h: 18 }],
    escalators: [{ x1: 325, y1: 565, x2: 525, y2: 410, dir: 1 }],
    exits: [{ side: 'left', to: 'roofgarden' }, { side: 'right', to: 'games' }],
    items: [{ id: 'scarf_shop', key: 'scarf', x: 293, y: 531, taken: false }, { id: 'ribbon_shop', key: 'ribbon', x: 712, y: 376, taken: false }],
    trees: [{ x: 860, y: 550 }],
    npcs: [{ id: 'tailor', name: 'Tailor Bibi', x: 615, y: 530, platformY: 565, color: '#ffc55f', leisure: ['Clothes should feel like a secret confidence boost.', 'A scarf improves almost any quest line.'], objective: { need: 'flower', doneText: 'Perfect. A flower for the counter. The whole shop feels brighter.', reward: 'batteries', rewardText: 'Here, take these toy batteries.' } }],
    decorations: [{ type: 'shopItems', x: 220, y: 256, kind: 'clothes' }]
  },
  games: {
    name: 'Games Arcade', type: 'shop', store: 'GAMES', palette: ['#08102a', '#1a3560'], floor: 565,
    platforms: [{ x: 36, y: 565, w: 888, h: 28 }, { x: 120, y: 402, w: 250, h: 18 }, { x: 610, y: 402, w: 230, h: 18 }],
    escalators: [{ x1: 620, y1: 565, x2: 418, y2: 402, dir: -1 }],
    exits: [{ side: 'left', to: 'dizzywear' }, { side: 'right', to: 'kiddies' }],
    items: [{ id: 'token_arcade', key: 'token', x: 248, y: 368, taken: false }],
    trees: [],
    npcs: [{ id: 'arcadekid', name: 'Vex', x: 695, y: 530, platformY: 565, color: '#79ffd9', leisure: ['That cabinet eats tokens like a tiny metallic dragon.', 'I trust blinking lights more than I trust silence.'], objective: { need: 'token', doneText: 'YES. The exact token. My glorious rematch awaits.', reward: 'sandwich', rewardText: 'Take my victory sandwich. I am too excited to chew.' } }],
    decorations: [{ type: 'shopItems', x: 220, y: 250, kind: 'games' }]
  },
  kiddies: {
    name: 'Kiddies Corner', type: 'shop', store: 'KIDDIES', palette: ['#11230f', '#2e6030'], floor: 565,
    platforms: [{ x: 36, y: 565, w: 888, h: 28 }, { x: 130, y: 410, w: 230, h: 18 }, { x: 620, y: 410, w: 220, h: 18 }],
    escalators: [{ x1: 330, y1: 565, x2: 525, y2: 410, dir: 1 }],
    exits: [{ side: 'left', to: 'games' }, { side: 'right', to: 'foodcourt' }],
    items: [{ id: 'teddy_corner', key: 'teddy', x: 251, y: 376, taken: false }],
    trees: [{ x: 838, y: 550 }],
    npcs: [{ id: 'nanny', name: 'Nanny Flo', x: 690, y: 530, platformY: 565, color: '#ffd9b0', leisure: ['The toy shelves are arranged by chaos, glitter, and courage.', 'If a teddy looks at you too knowingly, put it back slowly.'], objective: { need: 'batteries', doneText: 'Fresh batteries! The little rocket may sing again.', reward: 'apple', rewardText: 'Have this green apple before the toddlers bargain for it.' } }],
    decorations: [{ type: 'shopItems', x: 230, y: 248, kind: 'kiddies' }]
  },
  foodcourt: {
    name: 'Food Court', type: 'shop', store: 'FOOD', palette: ['#2c1608', '#68411b'], floor: 565,
    platforms: [{ x: 36, y: 565, w: 888, h: 28 }, { x: 100, y: 405, w: 245, h: 18 }, { x: 650, y: 405, w: 190, h: 18 }],
    escalators: [{ x1: 620, y1: 565, x2: 425, y2: 405, dir: -1 }],
    exits: [{ side: 'left', to: 'kiddies' }, { side: 'right', to: 'atrium' }],
    items: [{ id: 'flower_food', key: 'flower', x: 746, y: 371, taken: false }],
    trees: [{ x: 96, y: 550 }],
    npcs: [{ id: 'chef', name: 'Chef Nori', x: 425, y: 530, platformY: 565, color: '#ff966a', leisure: ['A food court is basically a carnival with trays.', 'The fries are gossiping again. I can hear the sizzling.'], objective: { need: 'apple', doneText: 'A crisp apple! Just what my balancing lunch needed.', reward: 'sandwich', rewardText: 'I made you a proper cheese sandwich in return.' } }],
    decorations: [{ type: 'shopItems', x: 225, y: 250, kind: 'food' }]
  },
  directory: {
    name: 'Grand Directory', type: 'mall', sign: 'DIRECTORY', palette: ['#10202f', '#225071'], floor: 565,
    platforms: [{ x: 36, y: 565, w: 888, h: 28 }, { x: 120, y: 396, w: 250, h: 18 }, { x: 610, y: 396, w: 220, h: 18 }],
    escalators: [{ x1: 318, y1: 565, x2: 520, y2: 396, dir: 1 }],
    exits: [{ side: 'left', to: 'atrium' }, { side: 'right', to: 'fountain' }],
    items: [],
    trees: [],
    npcs: [{ id: 'clerk', name: 'Directory Dot', x: 520, y: 361, platformY: 396, color: '#ffe37e', leisure: ['Maps are just stories for people who enjoy corners.', 'I like giving directions in a mysterious tone. It raises morale.'], objective: { need: 'postcard', doneText: 'Wonderful. Proof that the fountain still sparkles.', reward: 'flower', rewardText: 'Take this rescued potted flower.' } }],
    decorations: [{ type: 'directory', x: 435, y: 510 }, { type: 'directory', x: 180, y: 340 }]
  },
  fountain: {
    name: 'Fountain Court', type: 'mall', sign: 'FOUNTAIN', palette: ['#082232', '#0f566f'], floor: 565,
    platforms: [{ x: 36, y: 565, w: 888, h: 28 }, { x: 110, y: 396, w: 230, h: 18 }, { x: 640, y: 396, w: 180, h: 18 }],
    escalators: [{ x1: 630, y1: 565, x2: 430, y2: 396, dir: -1 }],
    exits: [{ side: 'left', to: 'directory' }, { side: 'right', to: 'roofgarden' }],
    items: [{ id: 'postcard_fountain', key: 'postcard', x: 246, y: 362, taken: false }],
    trees: [{ x: 120, y: 550 }, { x: 810, y: 550 }],
    npcs: [{ id: 'poet', name: 'Poet Rumi', x: 715, y: 530, platformY: 565, color: '#d0b2ff', leisure: ['Fountains are poetry with plumbing.', 'I have never met a coin that did not long for drama.'] }],
    decorations: [{ type: 'fountain', x: 475, y: 505 }]
  },
  roofgarden: {
    name: 'Roof Garden', type: 'garden', sign: 'ROOF GARDEN', palette: ['#12261b', '#2f6843'], floor: 565,
    platforms: [{ x: 36, y: 565, w: 888, h: 28 }, { x: 115, y: 410, w: 245, h: 18 }, { x: 610, y: 410, w: 210, h: 18 }],
    escalators: [{ x1: 318, y1: 565, x2: 520, y2: 410, dir: 1 }],
    exits: [{ side: 'left', to: 'fountain' }, { side: 'right', to: 'dizzywear' }],
    items: [{ id: 'apple_roof', key: 'apple', x: 705, y: 376, taken: false }],
    trees: [{ x: 180, y: 548 }, { x: 470, y: 548 }, { x: 770, y: 548 }],
    npcs: [{ id: 'gardener', name: 'Gardener Lio', x: 270, y: 376, platformY: 410, color: '#88ffa2', leisure: ['Trees indoors become theatrical. They know they have an audience.', 'I trim shrubs into shapes only birds appreciate.'] }],
    decorations: [{ type: 'bench', x: 520, y: 522 }]
  },
  toybridge: {
    name: 'Toy Bridge', type: 'bridge', sign: 'TOY BRIDGE', palette: ['#19142d', '#46336f'], floor: 565,
    platforms: [{ x: 36, y: 565, w: 888, h: 28 }, { x: 120, y: 392, w: 260, h: 18 }, { x: 585, y: 392, w: 240, h: 18 }],
    escalators: [{ x1: 625, y1: 565, x2: 425, y2: 392, dir: -1 }],
    exits: [{ side: 'left', to: 'backhall' }, { side: 'right', to: 'fountain' }],
    items: [],
    trees: [],
    npcs: [{ id: 'builder', name: 'Tomo', x: 515, y: 530, platformY: 565, color: '#91d7ff', leisure: ['This bridge looks serious, but secretly it enjoys applause.', 'I build small worlds from rails and optimism.'], objective: { need: 'ribbon', doneText: 'A ribbon! Perfect for the tiny parade flag.', reward: 'teddy', rewardText: 'I found this tiny teddy under a crate. It deserves a new home.' } }],
    decorations: [{ type: 'bridgeRails', x: 470, y: 320 }]
  },
  backhall: {
    name: 'Back Hall', type: 'service', sign: 'BACK HALL', palette: ['#171717', '#434343'], floor: 565,
    platforms: [{ x: 36, y: 565, w: 888, h: 28 }, { x: 120, y: 402, w: 210, h: 18 }, { x: 635, y: 402, w: 210, h: 18 }],
    escalators: [{ x1: 318, y1: 565, x2: 520, y2: 402, dir: 1 }],
    exits: [{ side: 'left', to: 'toybridge' }, { side: 'right', to: 'atrium' }],
    items: [],
    trees: [{ x: 820, y: 550 }],
    npcs: [{ id: 'porter', name: 'Porter Jax', x: 270, y: 530, platformY: 565, color: '#ffbc84', leisure: ['Behind every shiny mall is a hallway doing all the real work.', 'Crates never interrupt. That is why I trust them.'], objective: { need: 'sandwich', doneText: 'You legend. A sandwich for the long haul.', reward: 'scarf', rewardText: 'Take this red scarf from the lost-and-found trolley.' } }],
    decorations: [{ type: 'crates', x: 620, y: 505 }]
  }
};

let state;

function init() {
  state = {
    scene: 'atrium',
    player: { x: 82, y: 500, w: 26, h: 34, vx: 0, vy: 0, onGround: false },
    inventory: [],
    actionText: 'The mall feels alive again. Explore and keep the platforming energy.',
    dialogue: null,
    activeNpcId: null,
  };
  for (const scene of Object.values(scenes)) {
    for (const item of scene.items) item.taken = false;
    for (const npc of scene.npcs) {
      npc.leisureIndex = 0;
      if (npc.objective) npc.objective.completed = false;
    }
  }
  updatePanels();
  setMessage(state.actionText);
}

function setMessage(text) { state.actionText = text; messageEl.textContent = text; }
function setDialogue(speaker, text, options = []) {
  state.dialogue = { speaker, text, options };
  renderDialogue();
  setMessage(`${speaker}: ${text}`);
}
function closeDialogue() {
  state.dialogue = null;
  state.activeNpcId = null;
  renderDialogue();
}
function hasItem(key) { return state.inventory.includes(key); }
function addItem(key) { if (!hasItem(key)) state.inventory.push(key); }
function removeItem(key) { state.inventory = state.inventory.filter(i => i !== key); }
function scene() { return scenes[state.scene]; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function updatePanels() {
  screenNameEl.textContent = scene().name;
  inventoryCountEl.textContent = state.inventory.length;
  inventoryListEl.innerHTML = state.inventory.length ? state.inventory.map(k => `<li>${itemInfo[k].icon} ${itemInfo[k].label}</li>`).join('') : '<li>Empty pockets.</li>';
  const objectives = [];
  let done = 0;
  for (const sc of Object.values(scenes)) {
    for (const npc of sc.npcs) {
      if (!npc.objective) continue;
      if (npc.objective.completed) done++;
      objectives.push({ done: npc.objective.completed, text: `${npc.name}: bring ${itemInfo[npc.objective.need].label}` });
    }
  }
  objectivesDoneEl.textContent = done;
  objectivesTotalEl.textContent = objectives.length;
  objectiveListEl.innerHTML = objectives.map(o => `<li>${o.done ? '✅' : '⬜'} ${o.text}</li>`).join('');

  const nearby = [];
  const npc = nearestNpc();
  const item = nearestItem();
  if (npc) {
    nearby.push(`💬 ${npc.name}`);
    if (npc.objective && !npc.objective.completed) nearby.push(`Needs: ${itemInfo[npc.objective.need].label}`);
    if (npc.objective && !npc.objective.completed && hasItem(npc.objective.need)) nearby.push(`You can GIVE now`);
  }
  if (item) nearby.push(`🤏 ${itemInfo[item.key].label}`);
  nearbyListEl.innerHTML = nearby.length ? nearby.map(x => `<li>${x}</li>`).join('') : '<li>Walk up to someone or something interesting.</li>';
}

function rectOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function lineDistance(px, py, x1, y1, x2, y2) {
  const A = px - x1, B = py - y1, C = x2 - x1, D = y2 - y1;
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  const t = clamp(dot / lenSq, 0, 1);
  const lx = x1 + t * C, ly = y1 + t * D;
  return { dist: Math.hypot(px - lx, py - ly), t, x: lx, y: ly };
}

function nearestNpc() {
  const p = state.player;
  let best = null;
  for (const npc of scene().npcs) {
    const d = Math.hypot((p.x + p.w / 2) - npc.x, (p.y + p.h) - npc.platformY);
    if (d < 82 && (!best || d < best.d)) best = { npc, d };
  }
  return best?.npc || null;
}

function getNpcDialogue(npc) {
  const leisure = npc.leisure[npc.leisureIndex++ % npc.leisure.length];
  const options = [
    { label: '1. Ask what they are doing here', action: () => setDialogue(npc.name, leisure, buildRootOptions(npc)) },
  ];
  if (npc.objective && !npc.objective.completed) {
    options.push({ label: `2. Ask about the favour`, action: () => setDialogue(npc.name, `I need ${itemInfo[npc.objective.need].label}. Bring it here and I will trade fairly.`, buildRootOptions(npc)) });
  }
  if (npc.objective && !npc.objective.completed && hasItem(npc.objective.need)) {
    options.push({ label: `3. Give ${itemInfo[npc.objective.need].label}`, action: () => give() });
  }
  options.push({ label: '0. Leave politely', action: () => closeDialogue() });
  return { text: leisure, options };
}

function buildRootOptions(npc) {
  const opts = [
    { label: 'Ask for gossip', action: () => setDialogue(npc.name, `${npc.name === 'Mina' ? 'People pretend to shop, but really they come here to overhear destiny.' : 'Every corridor has gossip if you listen harder than the cleaning machines.'}`, buildRootOptions(npc)) },
    { label: 'Ask what this place is like', action: () => setDialogue(npc.name, npc.leisure[npc.leisureIndex++ % npc.leisure.length], buildRootOptions(npc)) },
  ];
  if (npc.objective && !npc.objective.completed) {
    opts.unshift({ label: `Ask about needed item`, action: () => setDialogue(npc.name, `Bring me ${itemInfo[npc.objective.need].label}. I am not being dramatic; I genuinely need it.`, buildRootOptions(npc)) });
  }
  if (npc.objective && !npc.objective.completed && hasItem(npc.objective.need)) {
    opts.unshift({ label: `Give ${itemInfo[npc.objective.need].label}`, action: () => give() });
  }
  opts.push({ label: 'Leave', action: () => closeDialogue() });
  return opts;
}

function renderDialogue() {
  if (!state.dialogue) {
    dialogueOverlayEl.classList.add('hidden');
    dialogueOptionsEl.innerHTML = '';
    return;
  }
  dialogueOverlayEl.classList.remove('hidden');
  dialogueSpeakerEl.textContent = state.dialogue.speaker;
  dialogueTextEl.textContent = state.dialogue.text;
  dialogueOptionsEl.innerHTML = '';
  for (const option of state.dialogue.options || []) {
    const btn = document.createElement('button');
    btn.className = 'dialogue-option';
    btn.textContent = option.label;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      option.action();
      renderDialogue();
      updatePanels();
    });
    dialogueOptionsEl.appendChild(btn);
  }
}

function nearestItem() {
  const p = state.player;
  let best = null;
  for (const item of scene().items) {
    if (item.taken) continue;
    const d = Math.hypot((p.x + p.w / 2) - item.x, (p.y + p.h) - item.y);
    if (d < 74 && (!best || d < best.d)) best = { item, d };
  }
  return best?.item || null;
}

function justPressed(name, active) {
  if (active && !actionLatch[name]) { actionLatch[name] = true; return true; }
  if (!active) actionLatch[name] = false;
  return false;
}

function talk() {
  const npc = nearestNpc();
  if (!npc) {
    closeDialogue();
    return setMessage('Nobody close enough for a proper Dizzy-style natter.');
  }
  state.activeNpcId = npc.id;
  const convo = getNpcDialogue(npc);
  setDialogue(npc.name, convo.text, convo.options);
}

function take() {
  const item = nearestItem();
  if (!item) return setMessage('There is nothing here you can sensibly pocket.');
  item.taken = true;
  addItem(item.key);
  updatePanels();
  closeDialogue();
  setMessage(`You took ${itemInfo[item.key].label}. ${itemInfo[item.key].icon}`);
}

function give() {
  const npc = nearestNpc();
  if (!npc) return setMessage('No one nearby wants a handoff.');
  if (!npc.objective || npc.objective.completed) return setMessage(`${npc.name} has no quest item in mind right now.`);
  if (!hasItem(npc.objective.need)) return setMessage(`${npc.name} still needs ${itemInfo[npc.objective.need].label}.`);
  removeItem(npc.objective.need);
  npc.objective.completed = true;
  addItem(npc.objective.reward);
  updatePanels();
  setDialogue(npc.name, `${npc.objective.doneText} ${npc.objective.rewardText}`, [{ label: 'Continue', action: () => closeDialogue() }]);
}

function triggerAction(action) {
  if (action === 'talk') talk();
  if (action === 'take') take();
  if (action === 'give') give();
}

function moveScene(direction) {
  const exit = scene().exits.find(e => e.side === direction);
  if (!exit) return;
  state.scene = exit.to;
  const p = state.player;
  p.x = direction === 'left' ? W - 64 : 38;
  p.y = 490;
  p.vy = 0;
  p.vx = 0;
  updatePanels();
  setMessage(`You arrive in ${scene().name}.`);
}

function update() {
  const p = state.player;
  const left = keys['arrowleft'] || keys['a'] || joystickState.x < -0.2;
  const right = keys['arrowright'] || keys['d'] || joystickState.x > 0.2;
  const jump = keys['arrowup'] || keys['w'] || keys[' '] || touchState.jump;
  const talkBtn = keys['t'];
  const takeBtn = keys['e'];
  const giveBtn = keys['g'];

  p.vx = ((left ? -1 : 0) + (right ? 1 : 0)) * 3.15;

  let onEscalator = false;
  let jumpedFromEscalator = false;
  for (const esc of scene().escalators) {
    const probe = lineDistance(p.x + p.w / 2, p.y + p.h, esc.x1, esc.y1, esc.x2, esc.y2);
    if (probe.dist < 13 && p.x + p.w / 2 > Math.min(esc.x1, esc.x2) - 10 && p.x + p.w / 2 < Math.max(esc.x1, esc.x2) + 10) {
      onEscalator = true;
      p.onGround = true;
      p.vy = 0;
      p.y = probe.y - p.h;
      if (jump) {
        p.vy = -10.4;
        p.onGround = false;
        onEscalator = false;
        jumpedFromEscalator = true;
        break;
      }
      p.x += esc.dir * 0.9;
      if (left) p.x -= 1.5;
      if (right) p.x += 1.5;
      break;
    }
  }

  if (!onEscalator) {
    if (jump && p.onGround && !jumpedFromEscalator) {
      p.vy = -10.4;
      p.onGround = false;
    }
    p.vy += GRAVITY;
    p.y += p.vy;
    p.onGround = false;

    for (const plat of scene().platforms) {
      const prevFeet = p.y + p.h - p.vy;
      if (p.x + p.w > plat.x && p.x < plat.x + plat.w && prevFeet <= plat.y && p.y + p.h >= plat.y) {
        p.y = plat.y - p.h;
        p.vy = 0;
        p.onGround = true;
      }
    }
  }

  p.x += p.vx;
  if (p.y > H + 60) {
    p.x = 70; p.y = 490; p.vx = 0; p.vy = 0;
  }
  if (p.x < -30) moveScene('left');
  if (p.x > W + 30) moveScene('right');

  if (justPressed('talk', !!talkBtn)) talk();
  if (justPressed('take', !!takeBtn)) take();
  if (justPressed('give', !!giveBtn)) give();

  updatePanels();
}

function drawStar(x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 4 * i;
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
  ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke();
  ctx.strokeStyle = '#28495d';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const x = e.x1 + (e.x2 - e.x1) * t;
    const y = e.y1 + (e.y2 - e.y1) * t;
    ctx.beginPath(); ctx.moveTo(x - 10, y + 8); ctx.lineTo(x + 10, y - 8); ctx.stroke();
  }
}

function drawTree(t) {
  ctx.fillStyle = '#66421f';
  ctx.fillRect(t.x + 10, t.y - 28, 9, 28);
  ctx.fillStyle = '#29bd53';
  for (const [dx,dy,r] of [[14,-42,24],[0,-20,18],[28,-18,18]]) {
    ctx.beginPath(); ctx.arc(t.x + dx, t.y + dy, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#c49d66';
  ctx.fillRect(t.x - 4, t.y, 40, 10);
}

function drawShopFront(sc) {
  ctx.fillStyle = '#12171d';
  ctx.fillRect(180, 145, 600, 135);
  ctx.strokeStyle = sc.type === 'shop' ? sc.platforms.length % 2 ? '#ff70df' : '#85ecff' : '#ffd95b';
  ctx.lineWidth = 4;
  ctx.strokeRect(180, 145, 600, 135);
  ctx.fillStyle = sc.type === 'shop' ? '#fff' : '#ffd95b';
  ctx.font = 'bold 38px monospace';
  ctx.fillText(sc.store || sc.sign, 260, 228);

  for (let i = 0; i < 4; i++) {
    const x = 215 + i * 135;
    ctx.fillStyle = '#1d2632'; ctx.fillRect(x, 285, 92, 115);
    ctx.strokeStyle = '#fff'; ctx.strokeRect(x, 285, 92, 115);
    ctx.fillStyle = ['#ff7398','#ffe06e','#7be5ff','#7dff97'][i % 4];
    ctx.fillRect(x + 18, 318, 56, 34);
    ctx.fillStyle = '#fff'; ctx.fillRect(x + 22, 364, 48, 12);
  }
}

function drawPlatform(plat) {
  ctx.fillStyle = '#dedede';
  ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
  ctx.fillStyle = '#78d3da';
  ctx.fillRect(plat.x, plat.y + plat.h - 6, plat.w, 6);
}

function drawItem(item) {
  const info = itemInfo[item.key];
  ctx.fillStyle = info.color;
  ctx.beginPath();
  ctx.roundRect(item.x - 11, item.y - 11, 22, 22, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '12px monospace';
  ctx.fillText(info.icon, item.x - 6, item.y + 6);
}

function drawNpc(npc) {
  ctx.fillStyle = npc.color;
  ctx.beginPath();
  ctx.arc(npc.x, npc.platformY - 18, 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(npc.x - 10, npc.platformY - 2, 20, 22);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(npc.name, npc.x - 34, npc.platformY - 36);
  if (npc.objective && !npc.objective.completed) drawStar(npc.x + 24, npc.platformY - 26, 10, '#ffe95b');
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

function drawDecor(sc) {
  for (const d of sc.decorations || []) {
    if (d.type === 'directory') {
      ctx.fillStyle = '#f7efc8'; ctx.fillRect(d.x, d.y, 78, 52); ctx.strokeStyle = '#222'; ctx.strokeRect(d.x, d.y, 78, 52);
      ctx.fillStyle = '#222'; ctx.font = 'bold 10px monospace'; ctx.fillText('DIRECTORY', d.x + 6, d.y + 18); ctx.font = '9px monospace'; ctx.fillText('YOU ARE HERE', d.x + 7, d.y + 34);
    }
    if (d.type === 'fountain') {
      ctx.fillStyle = '#9eefff'; ctx.beginPath(); ctx.ellipse(d.x, d.y + 24, 70, 18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#dffcff'; ctx.fillRect(d.x - 10, d.y - 8, 20, 38); ctx.fillRect(d.x - 34, d.y + 18, 68, 10);
      for (let i = 0; i < 5; i++) { ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(d.x, d.y + 18); ctx.lineTo(d.x - 22 + i * 11, d.y - 20 - (i % 2) * 10); ctx.stroke(); }
    }
    if (d.type === 'bench') {
      ctx.fillStyle = '#8c6134'; ctx.fillRect(d.x, d.y, 84, 10); ctx.fillRect(d.x + 8, d.y - 18, 10, 28); ctx.fillRect(d.x + 64, d.y - 18, 10, 28);
    }
    if (d.type === 'crates') {
      for (let i = 0; i < 3; i++) { const x = d.x + i * 34; ctx.fillStyle = '#7d5a31'; ctx.fillRect(x, d.y - (i % 2) * 18, 30, 30); ctx.strokeStyle = '#caa06a'; ctx.strokeRect(x, d.y - (i % 2) * 18, 30, 30); }
    }
    if (d.type === 'bridgeRails') {
      ctx.strokeStyle = '#b9d2ff'; ctx.lineWidth = 4; ctx.strokeRect(d.x - 200, d.y, 400, 30);
    }
  }
}

function drawSceneTitle(sc) {
  ctx.fillStyle = '#ff3056';
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText('DIZZY', 300, 86);
  ctx.fillStyle = '#2ce6ff';
  ctx.fillText('MALL', 584, 86);
  drawStar(266, 70, 18, '#ff3056');
  drawStar(901, 70, 18, '#ff3056');
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';
  ctx.fillText(sc.name.toUpperCase(), 410, 118);
}

function drawHints() {
  const npc = nearestNpc();
  const item = nearestItem();
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(18, 18, 760, 52);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px monospace';
  const hints = [];
  if (npc) hints.push(`💬 TALK ${npc.name}`);
  if (item) hints.push(`🤏 TAKE ${itemInfo[item.key].label}`);
  if (npc?.objective && !npc.objective.completed) hints.push(`Needs ${itemInfo[npc.objective.need].label}`);
  if (npc?.objective && !npc.objective.completed && hasItem(npc.objective.need)) hints.push(`🎁 GIVE ${itemInfo[npc.objective.need].label}`);
  if (!hints.length) hints.push('Explore the platforms, ride the escalators, and poke around the shops.');
  ctx.fillText(hints.join('   •   '), 32, 50);
}

function draw() {
  const sc = scene();
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, sc.palette[0]); grad.addColorStop(1, sc.palette[1]);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

  drawSceneTitle(sc);
  drawShopFront(sc);
  sc.platforms.forEach(drawPlatform);
  sc.escalators.forEach(drawEscalator);
  sc.trees.forEach(drawTree);
  drawDecor(sc);
  for (const item of sc.items) if (!item.taken) drawItem(item);
  sc.npcs.forEach(drawNpc);
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
