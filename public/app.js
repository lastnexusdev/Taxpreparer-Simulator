const SAVE_KEY = 'tax-empire-arcade-v2';
const offices = ['Tiny Desk', 'Strip Mall', 'Storefront', 'Downtown Firm', 'National Chain'];
const docs = ['W-2', '1099', 'Crypto CSV', 'Sch C', 'Mileage', '1098'];
const staffTypes = [
  { name: 'Junior', cost: 3800, stress: -6, skill: 2 },
  { name: 'EA', cost: 6200, stress: -8, skill: 4 },
  { name: 'CPA', cost: 8400, stress: -10, skill: 6 }
];
const events = [
  'Angry client goes viral',
  'IRS backlog wave',
  'Data breach scare',
  'TikTok influencer referral',
  'Tax law changed overnight',
  'Competitor opened across the street'
];

const hud = document.getElementById('hud');
const ticker = document.getElementById('ticker');
const panelDialog = document.getElementById('panelDialog');
const panelContent = document.getElementById('panelContent');
const auditDialog = document.getElementById('auditDialog');

const auditGrid = document.getElementById('auditGrid');
const auditTimer = document.getElementById('auditTimer');
const auditScore = document.getElementById('auditScore');
const startAuditBtn = document.getElementById('startAuditBtn');
const closeAuditBtn = document.getElementById('closeAuditBtn');

let auditInterval;
let targetDoc = '';

let state = load() || null;

document.querySelectorAll('.mode').forEach((btn) => {
  btn.addEventListener('click', () => {
    state = freshState(btn.dataset.mode);
    log(`Started ${state.mode.toUpperCase()} mode.`);
    save();
    render();
  });
});

document.getElementById('inboxStation').addEventListener('click', openClientInbox);
document.getElementById('prepStation').addEventListener('click', openPrepDesk);
document.getElementById('irsStation').addEventListener('click', openIRSDesk);
document.getElementById('staffStation').addEventListener('click', openStaffBoard);
document.getElementById('upgradeStation').addEventListener('click', openUpgradeBoard);
document.getElementById('coffeeStation').addEventListener('click', coffeeBreak);
startAuditBtn.addEventListener('click', launchAuditMiniGame);
closeAuditBtn.addEventListener('click', () => {
  stopAudit();
  auditDialog.close();
});

function freshState(mode) {
  const sandbox = mode === 'sandbox';
  return {
    mode,
    day: 1,
    month: 1,
    cash: sandbox ? 400000 : 18000,
    rep: 55,
    stress: 20,
    auditRisk: mode === 'hardcore' ? 24 : 12,
    staff: [],
    office: sandbox ? 2 : 0,
    queue: 2,
    notices: 0,
    streak: 0,
    log: ['You boot up your neon tax office.'],
    currentClient: null
  };
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function save() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function clamp() {
  state.rep = Math.max(0, Math.min(100, state.rep));
  state.stress = Math.max(0, Math.min(100, state.stress));
  state.auditRisk = Math.max(0, Math.min(100, state.auditRisk));
}

function log(msg) {
  if (!state) return;
  state.log.unshift(`D${state.day}: ${msg}`);
  state.log = state.log.slice(0, 22);
}

function randomClient() {
  const personalities = [
    '"Can I deduct my dog?" guy',
    'Crypto gremlin w/ 4,000 txns',
    '3-year unfiled rideshare driver',
    'Landlord with mystery receipts',
    'Small biz owner who lost documents'
  ];
  return {
    name: personalities[Math.floor(Math.random() * personalities.length)],
    complexity: 1 + Math.floor(Math.random() * 5),
    docsMissing: Math.random() < 0.4,
    pay: 300 + Math.floor(Math.random() * 900)
  };
}

function openClientInbox() {
  if (!state) return;
  const found = 1 + Math.floor(Math.random() * 3);
  state.queue += found;
  state.rep += 1;
  if (Math.random() < 0.2) {
    const ev = events[Math.floor(Math.random() * events.length)];
    applyEvent(ev);
  }
  log(`Inbox pinged: +${found} clients waiting.`);
  save();
  render();
}

function openPrepDesk() {
  if (!state) return;
  if (!state.currentClient) {
    if (state.queue <= 0) {
      showPanel('<h2>🧾 Prep Desk</h2><p>No clients waiting. Hit Client Inbox first.</p>');
      return;
    }
    state.currentClient = randomClient();
    state.queue -= 1;
  }

  const c = state.currentClient;
  showPanel(`
    <h2>🧾 Prep Desk</h2>
    <p><strong>${c.name}</strong></p>
    <p>Complexity: ${c.complexity} | Missing docs: ${c.docsMissing ? 'Yes 😵' : 'No ✅'}</p>
    <div class="actions">
      <button id="safeBtn">Play Safe</button>
      <button id="balancedBtn">Balanced</button>
      <button id="chaosBtn">Max Refund Chaos</button>
    </div>
  `);

  document.getElementById('safeBtn').onclick = () => resolveClient('safe');
  document.getElementById('balancedBtn').onclick = () => resolveClient('balanced');
  document.getElementById('chaosBtn').onclick = () => resolveClient('chaos');
}

function resolveClient(style) {
  const c = state.currentClient;
  if (!c) return;
  const teamSkill = state.staff.reduce((a, s) => a + s.skill, 0);
  const baseStress = c.complexity * 4 - teamSkill / 2;

  const profile = {
    safe: { payMult: 0.95, risk: -4, rep: 2 },
    balanced: { payMult: 1, risk: 2, rep: 1 },
    chaos: { payMult: 1.35, risk: 10, rep: -1 }
  }[style];

  const income = Math.round(c.pay * profile.payMult) + state.office * 40;
  state.cash += income;
  state.auditRisk += profile.risk + c.complexity;
  state.rep += profile.rep;
  state.stress += Math.max(1, baseStress);
  state.streak += 1;

  if (c.docsMissing && Math.random() < 0.45) {
    state.notices += 1;
    state.rep -= 4;
    log('Missing docs triggered IRS notice.');
  }

  if (style === 'chaos' && Math.random() < 0.35) {
    state.notices += 1;
    log('Aggressive filing flagged red by IRS AI.');
  }

  log(`Filed ${c.name} as ${style.toUpperCase()} for +$${income}.`);
  state.currentClient = null;
  rollDay();
  panelDialog.close();
  save();
  render();
}

function openIRSDesk() {
  if (!state) return;
  showPanel(`
    <h2>🏛️ IRS Mail</h2>
    <p>Pending notices: <strong>${state.notices}</strong></p>
    <div class="actions">
      <button id="respondBtn">Respond to Notice</button>
      <button id="auditBtn">Play Audit Mini-Game</button>
    </div>
  `);

  document.getElementById('respondBtn').onclick = () => {
    if (state.notices <= 0) {
      log('No notices today. Miracle.');
    } else {
      state.notices -= 1;
      state.cash -= 800;
      state.rep += 2;
      state.stress += 3;
      log('Handled IRS notice: cost -$800, reputation +2.');
    }
    save();
    render();
    panelDialog.close();
  };

  document.getElementById('auditBtn').onclick = () => {
    panelDialog.close();
    auditDialog.showModal();
  };
}

function openStaffBoard() {
  if (!state) return;
  const rows = staffTypes
    .map(
      (s, i) => `<button data-staff="${i}">Hire ${s.name} ($${s.cost}/mo)</button>`
    )
    .join('');

  showPanel(`
    <h2>👥 Staff Board</h2>
    <p>Current team: ${state.staff.map((s) => s.name).join(', ') || 'Solo grinder'}</p>
    <div class="actions">${rows}</div>
  `);

  panelContent.querySelectorAll('[data-staff]').forEach((btn) => {
    btn.onclick = () => {
      const pick = staffTypes[Number(btn.dataset.staff)];
      if (state.cash < pick.cost / 2) {
        log(`Couldn't hire ${pick.name} (cash too low).`);
      } else {
        state.cash -= Math.round(pick.cost / 2);
        state.staff.push(pick);
        state.stress += pick.stress;
        log(`Hired ${pick.name}. Office speed improved.`);
      }
      save();
      render();
      panelDialog.close();
    };
  });
}

function openUpgradeBoard() {
  if (!state) return;
  const next = offices[state.office + 1] || 'MAX';
  const cost = 14000 + state.office * 12000;

  showPanel(`
    <h2>🏢 Office Upgrades</h2>
    <p>Current: <strong>${offices[state.office]}</strong></p>
    <p>Next: <strong>${next}</strong></p>
    <button id="upBtn">Upgrade ($${cost})</button>
  `);

  document.getElementById('upBtn').onclick = () => {
    if (state.office >= offices.length - 1) {
      log('Already at national franchise tier.');
    } else if (state.cash < cost) {
      log(`Need $${cost} for next office jump.`);
    } else {
      state.cash -= cost;
      state.office += 1;
      state.rep += 5;
      log(`Office upgraded to ${offices[state.office]}!`);
    }
    save();
    render();
    panelDialog.close();
  };
}

function coffeeBreak() {
  if (!state) return;
  state.stress -= 9;
  state.cash -= 25;
  if (Math.random() < 0.15) {
    state.stress += 6;
    log('Coffee machine exploded. Stress +6.');
  } else {
    log('Coffee buff activated. Stress down.');
  }
  clamp();
  save();
  render();
}

function applyEvent(name) {
  if (name.includes('viral')) {
    state.rep -= 5;
    state.queue += 1;
  } else if (name.includes('backlog')) {
    state.stress += 6;
    state.rep -= 2;
  } else if (name.includes('breach')) {
    state.cash -= 3000;
    state.rep -= 7;
  } else if (name.includes('influencer')) {
    state.queue += 5;
    state.rep += 4;
  } else if (name.includes('law')) {
    state.stress += 8;
  } else {
    state.rep -= 2;
  }
  log(`Event: ${name}`);
}

function rollDay() {
  state.day += 1;
  if (state.day % 30 === 0) {
    state.month += 1;
    const payroll = state.staff.reduce((sum, s) => sum + s.cost, 0);
    state.cash -= payroll + 2400 + state.office * 1800;
    log(`Monthly burn paid: -$${payroll + 2400 + state.office * 1800}.`);
  }

  if (Math.random() < state.auditRisk / 220) {
    state.notices += 1;
    log('IRS auto-flag generated a new notice.');
  }

  if (state.stress > 82 && state.staff.length > 0 && Math.random() < 0.24) {
    const who = state.staff.splice(Math.floor(Math.random() * state.staff.length), 1)[0];
    log(`${who.name} quit in panic mode.`);
  }

  if (state.cash < -8000 || state.rep <= 0 || state.stress >= 100) {
    log('💥 Firm collapse! Pick a mode to restart.');
    localStorage.removeItem(SAVE_KEY);
    state = null;
    render();
    return;
  }

  clamp();
}

function launchAuditMiniGame() {
  if (!state) return;
  let time = 12;
  let score = 0;
  auditTimer.textContent = String(time);
  auditScore.textContent = String(score);

  drawAuditGrid();
  pickTarget();

  stopAudit();
  auditInterval = setInterval(() => {
    time -= 1;
    auditTimer.textContent = String(time);
    if (time <= 0) {
      stopAudit();
      state.notices = Math.max(0, state.notices - 1);
      state.rep += score >= 6 ? 4 : 1;
      state.cash += score >= 6 ? 900 : -500;
      state.stress += score >= 6 ? -4 : 3;
      log(score >= 6 ? 'Audit defended successfully! Big win.' : 'Audit survived, but costly.');
      clamp();
      save();
      render();
    }
  }, 1000);

  auditGrid.querySelectorAll('.doc').forEach((btn) => {
    btn.onclick = () => {
      if (btn.dataset.doc === targetDoc) {
        score += 1;
        auditScore.textContent = String(score);
        pickTarget();
      } else {
        score = Math.max(0, score - 1);
        auditScore.textContent = String(score);
      }
    };
  });
}

function drawAuditGrid() {
  auditGrid.innerHTML = docs
    .map((d) => `<button class="doc" data-doc="${d}">${d}</button>`)
    .join('');
}

function pickTarget() {
  targetDoc = docs[Math.floor(Math.random() * docs.length)];
  auditDialog.querySelector('p').textContent = `Find: ${targetDoc}`;
  auditGrid.querySelectorAll('.doc').forEach((b) => b.classList.toggle('target', b.dataset.doc === targetDoc));
}

function stopAudit() {
  if (auditInterval) clearInterval(auditInterval);
}

function showPanel(html) {
  panelContent.innerHTML = html;
  panelDialog.showModal();
}

function render() {
  if (!state) {
    hud.innerHTML = '<div class="card"><strong>Select a mode to start your tax empire.</strong></div>';
    ticker.innerHTML = '<li>Tip: Hardcore mode is brutal.</li>';
    return;
  }

  hud.innerHTML = [
    meterCard('💰 Cash', `$${Math.round(state.cash)}`, 100, Math.min(100, Math.max(0, (state.cash + 10000) / 3000))),
    meterCard('⭐ Reputation', `${state.rep}%`, 100, state.rep),
    meterCard('🔥 Stress', `${state.stress}%`, 100, state.stress),
    meterCard('🚨 Audit Risk', `${state.auditRisk}%`, 100, state.auditRisk),
    `<div class="card"><div>🏢 Office</div><strong>${offices[state.office]}</strong></div>`,
    `<div class="card"><div>📬 Queue / Notices</div><strong>${state.queue} / ${state.notices}</strong></div>`
  ].join('');

  ticker.innerHTML = state.log.map((entry) => `<li>${entry}</li>`).join('');
}

function meterCard(name, value, max, now) {
  return `
    <div class="card">
      <div>${name}</div>
      <strong>${value}</strong>
      <meter min="0" max="${max}" value="${Math.max(0, now)}"></meter>
    </div>
  `;
}

render();
