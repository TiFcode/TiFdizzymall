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
const jumpButtonEl = document.getElementById('jumpButton');
document.getElementById('restart').addEventListener('click', init);

const W = canvas.width;
const H = canvas.height;
const GRAVITY = 0.56;
const keys = {};
const touchState = { left: false, right: false, jump: false, take: false, give: false, talk: false };
const actionLatch = { take: false, give: false, talk: false };
const joystickState = { active: false, x: 0, y: 0, pointerId: null };
const dialogueControlLatch = { up: false, down: false, select: false };

window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

for (const btn of document.querySelectorAll('[data-touch]')) {
  const action = btn.dataset.touch;
  const isDirectional = action === 'jump';
  const on = (e) => {
    e.preventDefault();
    if (isDirectional) {
      touchState[action] = true;
    } else if (action === 'dialogue-up') {
      moveDialogueSelection(-1);
    } else if (action === 'dialogue-down') {
      moveDialogueSelection(1);
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

canvas.addEventListener('pointerdown', (e) => {
  if (!state?.dialogue) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (W / rect.width);
  const y = (e.clientY - rect.top) * (H / rect.height);
  handleDialogueOptionTap(x, y);
});

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

const dialogueFlavour = {
  greeter: {
    gossip: 'The mall doors gossip before anyone else does. They told me today would be lively.',
    place: 'This atrium is the mall pretending to be a palace. I respect the ambition.'
  },
  mina: {
    gossip: 'People pretend to shop, but really they come here to overhear destiny.',
    place: 'The upper walkways make every conversation feel more dramatic. Good architecture understands theatre.'
  },
  tailor: {
    gossip: 'Hemlines rise and fall, but panic before a fitting room mirror is eternal.',
    place: 'A proper clothing shop should feel like a stage with prices attached.'
  },
  vex: {
    gossip: 'Arcade gossip is mostly high scores, broken promises, and someone blaming the controls.',
    place: 'This corner hums like it wants to become a tiny neon kingdom.'
  },
  nanny: {
    gossip: 'Children spread rumours faster than adults, but with better sound effects.',
    place: 'The kiddie zone is cheerful chaos with railings. That is good design.'
  },
  chef: {
    gossip: 'Food court gossip arrives seasoned and usually slightly exaggerated.',
    place: 'A food court is a cathedral for chips, trays, and difficult choices.'
  },
  directory: {
    gossip: 'Everyone asks for directions, but half of them are really asking for reassurance.',
    place: 'This directory zone exists to stop panic from becoming cardio.'
  },
  poet: {
    gossip: 'Fountain gossip always sounds wiser because the water edits the pauses.',
    place: 'This fountain corner is where echoes come to practice being philosophical.'
  },
  gardener: {
    gossip: 'Plants keep gossip elegantly. They simply grow in the direction of scandal.',
    place: 'The roof garden feels like the mall remembering it once admired the sky.'
  },
  builder: {
    gossip: 'Bridge gossip is all structure, no fluff. Very efficient.',
    place: 'Toy Bridge is held together by bolts, optimism, and a suspicious amount of colour.'
  },
  porter: {
    gossip: 'Back hall gossip travels by trolley and always knows who skipped the heavy lifting.',
    place: 'The service hall is the part of the mall that actually keeps the show alive.'
  }
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
    upperExits: [{ side: 'left', to: 'roofgarden', yMin: 330 }, { side: 'right', to: 'toybridge', yMin: 330 }],
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
    upperExits: [{ side: 'right', to: 'games', yMin: 360 }],
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
    upperExits: [{ side: 'left', to: 'dizzywear', yMin: 352 }, { side: 'right', to: 'kiddies', yMin: 352 }],
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
    upperExits: [{ side: 'left', to: 'games', yMin: 352 }, { side: 'right', to: 'foodcourt', yMin: 352 }],
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
    upperExits: [{ side: 'left', to: 'kiddies', yMin: 352 }, { side: 'right', to: 'atrium', yMin: 352 }],
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
    upperExits: [{ side: 'left', to: 'atrium', yMin: 344 }, { side: 'right', to: 'fountain', yMin: 344 }],
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
    upperExits: [{ side: 'left', to: 'directory', yMin: 344 }, { side: 'right', to: 'roofgarden', yMin: 344 }],
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
    upperExits: [{ side: 'left', to: 'atrium', yMin: 360 }, { side: 'right', to: 'dizzywear', yMin: 360 }],
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
    upperExits: [{ side: 'left', to: 'atrium', yMin: 344 }, { side: 'right', to: 'fountain', yMin: 344 }],
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
    upperExits: [{ side: 'left', to: 'toybridge', yMin: 352 }, { side: 'right', to: 'atrium', yMin: 352 }],
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
    player: { x: 82, y: 488, w: 38, h: 50, vx: 0, vy: 0, onGround: false },
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
  syncJumpButtonMode();
  setMessage(state.actionText);
}

function setMessage(text) { state.actionText = text; messageEl.textContent = text; }
function syncJumpButtonMode() {
  if (!jumpButtonEl) return;
  if (state?.dialogue) {
    jumpButtonEl.textContent = '✨ SELECT';
    jumpButtonEl.classList.add('touch-btn-select');
  } else {
    jumpButtonEl.textContent = '🦘 JUMP';
    jumpButtonEl.classList.remove('touch-btn-select');
  }
}
function setDialogue(speaker, text, options = []) {
  state.dialogue = { speaker, text, options, selectedIndex: 0 };
  syncJumpButtonMode();
  setMessage(`${speaker}: ${text}`);
}
function closeDialogue() {
  state.dialogue = null;
  state.activeNpcId = null;
  syncJumpButtonMode();
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
  const flavour = dialogueFlavour[npc.id] || {
    gossip: 'Every corridor has gossip if you listen harder than the cleaning machines.',
    place: 'This place is doing its best to look glamorous while surviving practical reality.'
  };
  const opts = [
    { label: 'Ask for gossip', action: () => setDialogue(npc.name, flavour.gossip, buildRootOptions(npc)) },
    { label: 'Ask what this place is like', action: () => setDialogue(npc.name, flavour.place, buildRootOptions(npc)) },
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
  dialogueOverlayEl.classList.add('hidden');
  dialogueOptionsEl.innerHTML = '';
}

function handleDialogueOptionTap(x, y) {
  if (!state.dialogue) return false;
  const boxX = 34, boxY = H - 188, boxW = W - 68;
  if (x < boxX || x > boxX + boxW || y < boxY || y > boxY + 154) return false;
  const options = state.dialogue.options || [];
  let oy = boxY + 78;
  for (let i = 0; i < options.length; i++) {
    if (y >= oy && y <= oy + 24) {
      state.dialogue.selectedIndex = i;
      options[i].action();
      updatePanels();
      return true;
    }
    oy += 32;
  }
  return true;
}

function moveDialogueSelection(delta) {
  if (!state.dialogue || !(state.dialogue.options || []).length) return;
  const len = state.dialogue.options.length;
  state.dialogue.selectedIndex = (state.dialogue.selectedIndex + delta + len) % len;
}

function activateDialogueSelection() {
  if (!state.dialogue || !(state.dialogue.options || []).length) return false;
  const index = state.dialogue.selectedIndex || 0;
  const option = state.dialogue.options[index];
  if (!option) return false;
  option.action();
  updatePanels();
  return true;
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
  const p = state.player;
  const elevated = (scene().upperExits || []).find(e => e.side === direction && p.y <= e.yMin);
  const exit = elevated || scene().exits.find(e => e.side === direction);
  if (!exit) return;
  state.scene = exit.to;
  p.x = direction === 'left' ? W - 64 : 38;
  p.y = elevated ? 330 : 490;
  p.vy = 0;
  p.vx = 0;
  p.onGround = false;
  updatePanels();
  setMessage(`You arrive in ${scene().name}${elevated ? ' on the upper level' : ''}.`);
}

function update() {
  const p = state.player;
  const dialogueActive = !!state.dialogue;
  const left = keys['arrowleft'] || keys['a'] || joystickState.x < -0.12;
  const right = keys['arrowright'] || keys['d'] || joystickState.x > 0.12;
  const jump = keys['arrowup'] || keys['w'] || keys[' '] || touchState.jump;
  const talkBtn = keys['t'];
  const takeBtn = keys['e'];
  const giveBtn = keys['g'];
  const navUp = keys['arrowup'] || keys['w'] || joystickState.y < -0.45;
  const navDown = keys['arrowdown'] || keys['s'] || joystickState.y > 0.45;
  const selectBtn = keys[' '] || keys['enter'] || touchState.jump;

  if (dialogueActive) {
    p.vx = 0;
    if (navUp && !dialogueControlLatch.up) {
      dialogueControlLatch.up = true;
      moveDialogueSelection(-1);
    }
    if (!navUp) dialogueControlLatch.up = false;

    if (navDown && !dialogueControlLatch.down) {
      dialogueControlLatch.down = true;
      moveDialogueSelection(1);
    }
    if (!navDown) dialogueControlLatch.down = false;

    if (selectBtn && !dialogueControlLatch.select) {
      dialogueControlLatch.select = true;
      activateDialogueSelection();
    }
    if (!selectBtn) dialogueControlLatch.select = false;

    updatePanels();
    return;
  }

  dialogueControlLatch.up = false;
  dialogueControlLatch.down = false;
  dialogueControlLatch.select = false;

  const analogX = Math.abs(joystickState.x) > 0.12 ? joystickState.x : 0;
  const digitalX = ((left ? -1 : 0) + (right ? 1 : 0));
  const moveX = analogX !== 0 ? analogX : digitalX;
  p.vx = moveX * 3.9;

  let onEscalator = false;
  let jumpedFromEscalator = false;
  const feetPrevBeforeMove = p.y + p.h;
  for (const esc of scene().escalators) {
    const probe = lineDistance(p.x + p.w / 2, p.y + p.h, esc.x1, esc.y1, esc.x2, esc.y2);
    const withinX = p.x + p.w / 2 > Math.min(esc.x1, esc.x2) - 10 && p.x + p.w / 2 < Math.max(esc.x1, esc.x2) + 10;
    const wasAboveEscalator = feetPrevBeforeMove < probe.y - 6;
    const canBoardEscalator = p.vy >= 0 && (!p.onGround || wasAboveEscalator);
    if (probe.dist < 16 && withinX && (canBoardEscalator || onEscalator)) {
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

function drawDitherOverlay(alpha = 0.14) {
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  for (let y = 0; y < H; y += 8) {
    for (let x = (y / 8) % 2 === 0 ? 0 : 4; x < W; x += 8) ctx.fillRect(x, y, 3, 3);
  }
  ctx.fillStyle = `rgba(0,0,0,${alpha * 0.95})`;
  for (let y = 4; y < H; y += 8) {
    for (let x = (y / 8) % 2 === 0 ? 4 : 0; x < W; x += 8) ctx.fillRect(x, y, 3, 3);
  }
  ctx.restore();
}

function drawGradientPanel(x, y, w, h, top, bottom, border = '#86f1ff') {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = border;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
}

function drawPixelCells(x, y, cell, rows, palette) {
  for (let ry = 0; ry < rows.length; ry++) {
    const row = rows[ry];
    for (let rx = 0; rx < row.length; rx++) {
      const code = row[rx];
      if (!code || code === '.') continue;
      ctx.fillStyle = palette[code] || code;
      ctx.fillRect(x + rx * cell, y + ry * cell, cell, cell);
    }
  }
}

function drawWindowSprite(x, y, accent) {
  drawPixelCells(x, y, 4, [
    '..........',
    '.bbbbbbbb.',
    '.bwwwwwwb.',
    '.bw' + 'aaaaaa' + 'wb.',
    '.bw' + 'aaaaaa' + 'wb.',
    '.bwwwwwwb.',
    '.bssssssb.',
    '.bbbbbbbb.',
  ], { b: '#dff7ff', w: '#91d8ff', a: accent, s: '#f8f3c8' });
}

function drawItemSprite(item) {
  const x = item.x - 18;
  const y = item.y - 18;
  const sprites = {
    scarf: { rows: ['..rrr....','..rrrr...','.rrpppr..','rrpppppr.','.rrpppr..','..rrr....','...rr....','..rr.....'], palette: { r: '#ff506d', p: '#ffd2dc' } },
    token: { rows: ['..yyyy...','.yoooooy.','yoYYYYoy.','yoYYYYoy.','.yoooooy.','..yyyy...'], palette: { y: '#ffe26f', o: '#c89622', Y: '#fff7c2' } },
    teddy: { rows: ['.bb..bb..','bbbbbbbb.','bbttttbb.','.bttttb..','.bttttb..','..bttb...','.b....b..'], palette: { b: '#9a6a34', t: '#dcb07a' } },
    apple: { rows: ['...gg....','..gggg...','.ggGGgg..','.gGGGGg..','.gGGGGg..','..gggg...','...bb....'], palette: { g: '#4edb6b', G: '#a8ff70', b: '#7a4b22' } },
    brochure: { rows: ['.wwwww...','.wbbbw...','.wbfbw...','.wbbbw...','.wwwww...'], palette: { w: '#f3efd8', b: '#5c7ac8', f: '#86f1ff' } },
    flower: { rows: ['...pp....','..pPPp...','.pPPPPp..','...gg....','..gggg...','...tt....'], palette: { p: '#ff76ce', P: '#ffd0f3', g: '#4ecf74', t: '#aa713d' } },
    sandwich: { rows: ['.yyyyyy..','yccccccy.','yggggggy.','.yyyyyy..'], palette: { y: '#f1c46b', c: '#f4e5bb', g: '#62d77c' } },
    batteries: { rows: ['.ssssss..','sbbwwbs.','sbbwwbs.','.ssssss..'], palette: { s: '#d5dceb', b: '#4f6fb4', w: '#f5fbff' } },
    ribbon: { rows: ['.bb..bb..','..bbbb...','.bbYYbb..','..bbbb...','...bb....'], palette: { b: '#5b8fff', Y: '#cfe0ff' } },
    postcard: { rows: ['.wwwwww..','.wyyyyw..','.wybbbw..','.wwwwww..'], palette: { w: '#f1e5c5', y: '#ffe27a', b: '#69b7ff' } },
  };
  const sprite = sprites[item.key];
  if (!sprite) return;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x - 2, y - 2, 40, 40);
  drawPixelCells(x, y, 4, sprite.rows, sprite.palette);
}

function drawCharacterSprite(cx, groundY, colors, scale = 3) {
  const rows = [
    '....ww....',
    '...wwww...',
    '..wffffw..',
    '..wfeefw..',
    '..wffffw..',
    '...wmmw...',
    '..jjjjjj..',
    '..jccccj..',
    '.jjccccjj.',
    '.jjccccjj.',
    '..jccccj..',
    '..jjjjjj..',
    '..s.sss...',
    '.ss.s.ss..',
    '.bb....bb.',
  ];
  const x = Math.round(cx - (rows[0].length * scale) / 2);
  const y = Math.round(groundY - rows.length * scale);
  const palette = {
    w: '#ffffff',
    f: '#f7d7b4',
    e: '#151515',
    m: '#d65b7c',
    j: colors.body,
    c: colors.clothes,
    s: colors.shoes,
    b: colors.outline,
  };
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(x + 4, groundY + 2, 22, 4);
  drawPixelCells(x, y, scale, rows, palette);
}

function drawEscalator(e) {
  ctx.strokeStyle = '#d7f7ff';
  ctx.lineWidth = 24;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke();
  ctx.strokeStyle = '#6eb9d8';
  ctx.lineWidth = 12;
  ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke();
  ctx.strokeStyle = '#28495d';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const x = e.x1 + (e.x2 - e.x1) * t;
    const y = e.y1 + (e.y2 - e.y1) * t;
    ctx.beginPath(); ctx.moveTo(x - 14, y + 11); ctx.lineTo(x + 14, y - 11); ctx.stroke();
  }
}

function drawTree(t) {
  drawPixelCells(t.x - 8, t.y - 58, 4, [
    '....gg....',
    '...gGGg...',
    '..gGGGGg..',
    '.gGGGGGGg.',
    '..gGGGGg..',
    '....tt....',
    '....tt....',
    '..pppppp..'
  ], { g: '#29bd53', G: '#7df58f', t: '#66421f', p: '#c49d66' });
}

function drawBigDitherRect(x, y, w, h, a = 0.18) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  for (let yy = y; yy < y + h; yy += 8) {
    for (let xx = ((yy - y) / 8) % 2 === 0 ? x : x + 4; xx < x + w; xx += 8) {
      ctx.fillRect(xx, yy, 3, 3);
    }
  }
  ctx.fillStyle = `rgba(0,0,0,${a * 0.9})`;
  for (let yy = y + 4; yy < y + h; yy += 8) {
    for (let xx = ((yy - y) / 8) % 2 === 0 ? x + 4 : x; xx < x + w; xx += 8) {
      ctx.fillRect(xx, yy, 3, 3);
    }
  }
  ctx.restore();
}

function drawBackdropBands(sc) {
  const bands = [
    { y: 96, h: 54, color: 'rgba(255,255,255,0.10)' },
    { y: 150, h: 72, color: 'rgba(255,255,255,0.06)' },
    { y: 222, h: 94, color: 'rgba(0,0,0,0.10)' },
    { y: 316, h: 126, color: 'rgba(255,255,255,0.04)' },
  ];
  for (const band of bands) {
    ctx.fillStyle = band.color;
    ctx.fillRect(0, band.y, W, band.h);
    drawBigDitherRect(0, band.y, W, band.h, 0.13);
  }
}

function drawShopFront(sc) {
  drawGradientPanel(180, 145, 600, 135, 'rgba(38,53,71,0.96)', 'rgba(13,19,26,0.98)', sc.type === 'shop' ? '#8cecff' : '#ffd95b');
  drawBigDitherRect(180, 145, 600, 135, 0.1);
  ctx.strokeStyle = sc.type === 'shop' ? sc.platforms.length % 2 ? '#ff70df' : '#85ecff' : '#ffd95b';
  ctx.lineWidth = 4;
  ctx.strokeRect(180, 145, 600, 135);
  ctx.fillStyle = sc.type === 'shop' ? '#fff' : '#ffd95b';
  ctx.font = 'bold 38px monospace';
  ctx.fillText(sc.store || sc.sign, 260, 228);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(198, 160, 564, 18);

  for (let i = 0; i < 4; i++) {
    const x = 215 + i * 135;
    drawGradientPanel(x, 285, 92, 115, '#263444', '#131d28', '#d5f7ff');
    drawBigDitherRect(x, 285, 92, 115, 0.08);
    ctx.strokeStyle = '#fff'; ctx.strokeRect(x, 285, 92, 115);
    drawWindowSprite(x + 24, 306, ['#ff7398','#ffe06e','#7be5ff','#7dff97'][i % 4]);
    ctx.fillStyle = '#fff'; ctx.fillRect(x + 18, 364, 56, 14);
  }
}

function drawPlatform(plat) {
  const g = ctx.createLinearGradient(plat.x, plat.y, plat.x, plat.y + plat.h);
  g.addColorStop(0, '#f3f3f3');
  g.addColorStop(1, '#bdbdbd');
  ctx.fillStyle = g;
  ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
  ctx.fillStyle = '#78d3da';
  ctx.fillRect(plat.x, plat.y + plat.h - 6, plat.w, 6);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (let x = plat.x; x < plat.x + plat.w; x += 12) ctx.fillRect(x, plat.y + 3, 6, 1);
  drawBigDitherRect(plat.x, plat.y, plat.w, plat.h - 6, 0.07);
}

function drawItem(item) {
  drawItemSprite(item);
}

function drawNpc(npc) {
  drawCharacterSprite(npc.x, npc.platformY + 22, {
    body: npc.color,
    clothes: '#f7f1da',
    shoes: '#56361e',
    outline: '#101418'
  }, 3);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(npc.name, npc.x - 44, npc.platformY - 56);
  if (npc.objective && !npc.objective.completed) drawStar(npc.x + 32, npc.platformY - 40, 12, '#ffe95b');
}

function drawPlayer() {
  const p = state.player;
  drawCharacterSprite(p.x + p.w / 2, p.y + p.h, {
    body: '#ff355f',
    clothes: '#ffffff',
    shoes: '#2e7fd9',
    outline: '#151515'
  }, 3);
}

function drawDecor(sc) {
  for (const d of sc.decorations || []) {
    if (d.type === 'directory') {
      drawPixelCells(d.x, d.y, 4, [
        'yyyyyyyyyyyyyyyyyyyy',
        'ybbbbbbbbbbbbbbbbby',
        'ybwwwwwwwwwwwwwwwby',
        'ybwrrrwwwyywwrrrwby',
        'ybwwwwwwwwwwwwwwwby',
        'ybbbbbbbbbbbbbbbbby',
        'yyyyyyyyyyyyyyyyyyyy'
      ], { y: '#f7efc8', b: '#222222', w: '#f5fbff', r: '#ff5f88' });
    }
    if (d.type === 'fountain') {
      drawPixelCells(d.x - 44, d.y - 28, 4, [
        '......wwww......',
        '.....wWWWWw.....',
        '......wwww......',
        '....ssssssss....',
        '..ssSSSSSSSSss..',
        '...ssssssssss...',
      ], { w: '#dffcff', W: '#ffffff', s: '#9eefff', S: '#65d9ff' });
    }
    if (d.type === 'bench') {
      drawPixelCells(d.x, d.y - 24, 4, [
        'bbbbbbbbbbbbbbbbbbbbb',
        'bbhhhhhhhhhhhhhhhhhbb',
        '...h............h....',
        '...h............h....'
      ], { b: '#55331d', h: '#8c6134' });
    }
    if (d.type === 'crates') {
      for (let i = 0; i < 3; i++) {
        const x = d.x + i * 34;
        drawPixelCells(x, d.y - (i % 2) * 18, 3, [
          'oooooooooo',
          'oxxxxxxxxo',
          'oxooooooxo',
          'oxooooooxo',
          'oxxxxxxxxo',
          'oooooooooo'
        ], { o: '#caa06a', x: '#7d5a31' });
      }
    }
    if (d.type === 'bridgeRails') {
      drawPixelCells(d.x - 200, d.y, 4, [
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        'b................................................b',
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
      ], { b: '#b9d2ff' });
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
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(240, 92, 470, 6);
}

function drawHints() {
  const npc = nearestNpc();
  const item = nearestItem();
  drawGradientPanel(18, 18, 760, 52, 'rgba(26,40,56,0.92)', 'rgba(9,14,20,0.92)', '#7edfff');
  drawBigDitherRect(18, 18, 760, 52, 0.08);
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

function wrapCanvasText(text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

function drawDialogueBox() {
  if (!state.dialogue) return;
  const x = 34, y = H - 188, w = W - 68, h = 154;
  drawGradientPanel(x, y, w, h, '#1b2836', '#0e141b', '#86f1ff');
  drawBigDitherRect(x, y, w, h, 0.08);
  ctx.fillStyle = '#ffd84d';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(state.dialogue.speaker, x + 14, y + 24);
  ctx.fillStyle = '#eef7ff';
  ctx.font = '15px monospace';
  wrapCanvasText(state.dialogue.text, x + 14, y + 48, w - 28, 18);

  let oy = y + 78;
  for (let i = 0; i < (state.dialogue.options || []).length; i++) {
    const option = state.dialogue.options[i];
    const selected = i === (state.dialogue.selectedIndex || 0);
    drawGradientPanel(x + 12, oy, w - 24, 24, selected ? '#44759f' : '#26425b', selected ? '#284b67' : '#18344b', selected ? '#ffd84d' : '#5ec7ff');
    ctx.fillStyle = selected ? '#fff7c2' : '#ffffff';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(option.label, x + 20, oy + 16);
    oy += 32;
  }
}

function draw() {
  const sc = scene();
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, sc.palette[0]); grad.addColorStop(1, sc.palette[1]);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  drawBackdropBands(sc);
  drawDitherOverlay(0.12);

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
  drawDialogueBox();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

init();
requestAnimationFrame(loop);
