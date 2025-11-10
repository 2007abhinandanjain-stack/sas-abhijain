/* script.js - Student ATM Services 4.4 Final Responsive Edition */

/* ---------- PRELOADED demo users ---------- */
const PRELOADED = [
  { name: "Aadi Jain", accountNumber: 102345, pin: "1234", balance: 15000, history: ["Initial balance ₹15,000"] },
  { name: "Archit Jain", accountNumber: 102678, pin: "4321", balance: 9250, history: ["Initial balance ₹9,250"] },
  { name: "Aarti Pathak", accountNumber: 103001, pin: "1111", balance: 20500, history: ["Initial balance ₹20,500"] },
  { name: "Jyotshna Thakur", accountNumber: 103222, pin: "2222", balance: 5800, history: ["Initial balance ₹5,800"] },
  { name: "Ritika Ram", accountNumber: 103555, pin: "3333", balance: 12700, history: ["Initial balance ₹12,700"] },
  { name: "Sohit Patel", accountNumber: 103777, pin: "4444", balance: 8450, history: ["Initial balance ₹8,450"] }
];

/* ---------- Helpers ---------- */
const $ = id => document.getElementById(id);
const show = el => { if (el) el.classList.remove('hidden'); }
const hide = el => { if (el) el.classList.add('hidden'); }

function initDataIfNeeded(){
  let users = JSON.parse(localStorage.getItem('users'));
  if (!users || !Array.isArray(users) || users.length === 0){
    localStorage.setItem('users', JSON.stringify(PRELOADED));
  }
}

/* ---------- Theme toggle (shared) ---------- */
function setupThemeToggle(btnId = 'theme-toggle'){
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const body = document.body;
  function setTheme(isLight){
    if (isLight){ body.classList.add('light-mode'); btn.textContent='🌙'; localStorage.setItem('theme','light'); }
    else { body.classList.remove('light-mode'); btn.textContent='☀️'; localStorage.setItem('theme','dark'); }
  }
  btn.addEventListener('click', ()=> {
    const isLight = body.classList.contains('light-mode');
    setTheme(!isLight);
  });
  const saved = localStorage.getItem('theme');
  setTheme(saved === 'light');
}

/* ---------- PIN visibility ---------- */
function togglePin(id, btn){
  const input = document.getElementById(id);
  if (!input) return;
  if (input.type === 'password'){ input.type = 'text'; btn.textContent = '🙈'; }
  else { input.type = 'password'; btn.textContent = '👁️'; }
}

/* ---------- Account management ---------- */
function getUsers(){ return JSON.parse(localStorage.getItem('users')) || []; }
function persistUsers(users){ localStorage.setItem('users', JSON.stringify(users)); }

function createNewAccount(name, pin, initial){
  const users = getUsers();
  let accountNumber;
  do { accountNumber = Math.floor(100000 + Math.random()*900000); }
  while (users.find(u => u.accountNumber === accountNumber));
  const user = { name, accountNumber, pin, balance: Number(initial)||0, history: [`Account created — initial ₹${initial||0}`] };
  users.push(user);
  persistUsers(users);
  return user;
}

/* ---------- Login logic with alarm ---------- */
function handleLogin(){
  const accVal = Number($('account-number').value);
  const pin = $('pin').value;
  if (!accVal || !pin){ alert('Enter account number and PIN'); return; }

  const attemptsKey = 'loginAttempts';
  let attempts = Number(sessionStorage.getItem(attemptsKey) || 0);

  const cooldownKey = 'loginCooldownUntil';
  const cooldownUntil = Number(sessionStorage.getItem(cooldownKey) || 0);
  const now = Date.now();
  if (cooldownUntil && now < cooldownUntil){
    const remaining = Math.ceil((cooldownUntil - now)/1000);
    showAlarmOverlay(remaining);
    return;
  }

  const users = getUsers();
  const user = users.find(u => u.accountNumber === accVal && u.pin === pin);
  if (!user){
    attempts += 1;
    sessionStorage.setItem(attemptsKey, attempts);
    $('msg').textContent = `Invalid credentials. Attempts: ${attempts}/3`;
    if (attempts >= 3){
      // trigger alarm
      startAlarmSequence();
      const cd = Date.now() + 30000; // 30s lock
      sessionStorage.setItem(cooldownKey, cd);
      sessionStorage.setItem(attemptsKey, 0);
      showAlarmOverlay(30);
    }
    return;
  }

  // success
  sessionStorage.setItem(attemptsKey, 0);
  sessionStorage.removeItem(cooldownKey);
  localStorage.setItem('activeAccount', user.accountNumber);
  window.open('dashboard.html', '_blank');
  $('msg').textContent = `Opening dashboard for ${user.name}...`;
}

/* ---------- Alarm UI & previous digital siren (10s) ---------- */
let alarmAudioCtx = null;
let alarmPlaying = false;
let alarmTimeout = null;

function prepareAudioContextStarter(){
  // save a helper to create/resume audio context on user gesture
  window.__audioCtxStarter = function(){
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      ctx.close();
    } catch(e){}
    window.__audioCtxStarter = null;
  };
}
prepareAudioContextStarter();

function playSiren(durationMs = 10000){
  // previous digital alarm tone (sawtooth + LFO-ish) for durationMs
  if (alarmPlaying) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    alarmAudioCtx = new AudioContext();
    const now = alarmAudioCtx.currentTime;

    // two oscillators: sawtooth and sine for timbre
    const o1 = alarmAudioCtx.createOscillator();
    const o2 = alarmAudioCtx.createOscillator();
    const gain = alarmAudioCtx.createGain();

    o1.type = 'sawtooth';
    o2.type = 'sine';
    o2.detune.value = 60;

    // LFO to modulate pitch for whoop effect
    const lfo = alarmAudioCtx.createOscillator();
    lfo.frequency.value = 0.9; // slow sweep
    const lfoGain = alarmAudioCtx.createGain();
    lfoGain.gain.value = 180; // modulation depth in Hz

    // Connect nodes
    o1.connect(gain);
    o2.connect(gain);
    lfo.connect(lfoGain);
    lfoGain.connect(o1.frequency);
    lfoGain.connect(o2.frequency);
    gain.connect(alarmAudioCtx.destination);

    // amplitude envelope
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.7, now + 0.05);

    // base freq sweep for richness
    const fStart = 450;
    const fEnd = 1100;
    o1.frequency.setValueAtTime(fStart, now);
    o1.frequency.linearRampToValueAtTime(fEnd, now + durationMs/1000);
    o2.frequency.setValueAtTime(fStart*0.95, now);
    o2.frequency.linearRampToValueAtTime(fEnd*0.95, now + durationMs/1000);

    o1.start(now);
    o2.start(now);
    lfo.start(now);

    alarmPlaying = true;

    alarmTimeout = setTimeout(()=> {
      try {
        const t = alarmAudioCtx.currentTime;
        gain.gain.linearRampToValueAtTime(0.0001, t + 0.4);
        o1.stop(t + 0.5);
        o2.stop(t + 0.5);
        lfo.stop(t + 0.5);
      } catch(e){}
      alarmPlaying = false;
      try { alarmAudioCtx.close(); } catch(e){}
      alarmAudioCtx = null;
    }, durationMs);
  } catch (e){
    console.error('WebAudio error (siren):', e);
  }
}

function startAlarmSequence(){
  // blink and siren for 10s; login locked for 30s
  showAlarmOverlay(30);
  document.body.classList.add('alarm-active'); // triggers blink-overlay
  // play previous digital siren for 10s
  playSiren(10000);
  setTimeout(()=> {
    document.body.classList.remove('alarm-active');
  }, 10000);
}

function showAlarmOverlay(seconds){
  const overlay = $('alarm-overlay');
  if (!overlay) return;
  show(overlay);
  const timerEl = $('cooldown-timer');
  let left = seconds;
  timerEl.textContent = left;
  const loginBtn = $('login-btn');
  if (loginBtn) loginBtn.disabled = true;

  const interval = setInterval(()=>{
    left -= 1;
    timerEl.textContent = left;
    if (left <= 0){
      clearInterval(interval);
      hide(overlay);
      if (loginBtn) loginBtn.disabled = false;
      sessionStorage.removeItem('loginCooldownUntil');
    }
  }, 1000);
  sessionStorage.setItem('loginCooldownUntil', Date.now() + (seconds*1000));
}

/* ---------- Create page open ---------- */
function openCreatePage(){ window.open('create.html', '_blank'); }

/* ---------- Dashboard functions ---------- */
let currentUserCache = null;

function openDashboardFor(accountNumber){
  const users = getUsers();
  const user = users.find(u => u.accountNumber === Number(accountNumber));
  if (!user){
    alert('Account not found. Please login again from main page.');
    return;
  }
  currentUserCache = deepCopy(user);
  const dash = $('dashboard-card'); if (dash) show(dash);
  if ($('user-name')) $('user-name').textContent = currentUserCache.name;
  if ($('user-account')) $('user-account').textContent = currentUserCache.accountNumber;
  animateBalance(0, currentUserCache.balance);
  renderHistory();
}

/* logout */
function logoutFromDashboard(){ localStorage.removeItem('activeAccount'); alert('Logged out. Returning to main page.'); window.location.href = 'index.html'; }

/* animated balance */
let balanceAnim = null;
function animateBalance(from, to){
  const el = $('balance'); if (!el) return;
  if (balanceAnim) cancelAnimationFrame(balanceAnim);
  const duration = 700;
  const start = performance.now();
  function step(now){
    const t = Math.min(1, (now-start)/duration);
    const eased = t < .5 ? 2*t*t : -1 + (4 - 2*t)*t;
    const current = Math.round(from + (to - from) * eased);
    el.textContent = current.toLocaleString();
    if (t < 1) balanceAnim = requestAnimationFrame(step);
    else { el.textContent = to.toLocaleString(); balanceAnim = null; }
  }
  balanceAnim = requestAnimationFrame(step);
}

/* deposit */
function deposit(){
  if (!currentUserCache){ alert('No active user'); return; }
  const amt = Number($('amount').value);
  if (!amt || amt <= 0){ alert('Enter valid amount'); return; }
  const old = currentUserCache.balance;
  const nw = old + amt;
  currentUserCache.balance = nw;
  currentUserCache.history.unshift(`Deposited ₹${amt} — ${timestamp()}`);
  saveCurrentUser();
  animateBalance(old, nw);
  $('amount').value = '';
  toast(`₹${amt} deposited`);
}

/* withdraw */
function withdraw(){
  if (!currentUserCache){ alert('No active user'); return; }
  const amt = Number($('amount').value);
  if (!amt || amt <= 0){ alert('Enter valid amount'); return; }
  if (amt > currentUserCache.balance){ alert('Insufficient funds'); return; }
  const old = currentUserCache.balance;
  const nw = old - amt;
  currentUserCache.balance = nw;
  currentUserCache.history.unshift(`Withdrew ₹${amt} — ${timestamp()}`);
  saveCurrentUser();
  animateBalance(old, nw);
  $('amount').value = '';
  toast(`₹${amt} withdrawn`);
}

/* transfer (fixed) */
function transferMoney(){
  if (!currentUserCache){ alert('No active user'); return; }
  const toAcc = Number($('transfer-account').value);
  const amt = Number($('transfer-amount').value);
  if (!toAcc || !amt || amt <= 0){ alert('Enter valid receiver and amount'); return; }
  if (toAcc === currentUserCache.accountNumber){ alert('Cannot transfer to same account'); return; }

  const users = getUsers();
  const receiverIdx = users.findIndex(u => u.accountNumber === toAcc);
  if (receiverIdx === -1){ alert('Receiver not found'); return; }
  const receiver = users[receiverIdx];
  if (amt > currentUserCache.balance){ alert('Insufficient funds'); return; }

  const sbefore = currentUserCache.balance;
  const safter = sbefore - amt;
  const rbefore = receiver.balance;
  const rafter = rbefore + amt;

  const confirmMsg = `Confirm Transfer\n\nFrom: ${currentUserCache.name} (${currentUserCache.accountNumber})\nTo: ${receiver.name} (${receiver.accountNumber})\nAmount: ₹${amt}\n\nSender: ₹${sbefore.toLocaleString()} → ₹${safter.toLocaleString()}\nReceiver: ₹${rbefore.toLocaleString()} → ₹${rafter.toLocaleString()}\n\nProceed?`;
  if (!confirm(confirmMsg)) return;

  // update sender and receiver in users array
  currentUserCache.balance = safter;
  currentUserCache.history.unshift(`Transferred ₹${amt} to ${receiver.accountNumber} — ${timestamp()}`);
  users[ users.findIndex(u => u.accountNumber === currentUserCache.accountNumber) ] = currentUserCache;

  receiver.balance = rafter;
  receiver.history.unshift(`Received ₹${amt} from ${currentUserCache.accountNumber} — ${timestamp()}`);
  users[receiverIdx] = receiver;

  // persist and notify other tabs
  persistUsers(users);

  animateBalance(sbefore, safter);
  $('transfer-account').value = ''; $('transfer-amount').value = '';
  toast(`₹${amt} transferred to ${receiver.accountNumber}`);
}

/* history */
function showHistory(){ hide($('dashboard-card')); show($('history-card')); renderHistory(); }
function closeHistory(){ show($('dashboard-card')); hide($('history-card')); }
function renderHistory(){
  const list = $('history-list'); list.innerHTML = '';
  if (!currentUserCache || !currentUserCache.history || currentUserCache.history.length === 0){
    list.innerHTML = '<div class="history-item">No transactions yet.</div>'; return;
  }
  currentUserCache.history.forEach(h => {
    const d = document.createElement('div'); d.className = 'history-item'; d.textContent = h; list.appendChild(d);
  });
}

/* download history */
function downloadHistory(){
  if (!currentUserCache) return;
  const header = `Transaction History for ${currentUserCache.name} (A/C ${currentUserCache.accountNumber})\nGenerated: ${new Date().toLocaleString()}\n\n`;
  const text = header + currentUserCache.history.join('\n') + `\n\nCurrent Balance: ₹${currentUserCache.balance}`;
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `StudentATM_${currentUserCache.accountNumber}_history.txt`; a.click();
}

/* toast */
function toast(msg){
  const t = document.createElement('div'); t.textContent = msg;
  Object.assign(t.style, { position:'fixed',left:'50%',transform:'translateX(-50%)',bottom:'24px',padding:'10px 16px',background:'linear-gradient(90deg,#2f80ed,#00ffd0)',color:'#002',borderRadius:'10px',zIndex:80,boxShadow:'0 8px 30px rgba(0,0,0,.4)' });
  document.body.appendChild(t); setTimeout(()=> t.style.opacity = '0.0', 1600); setTimeout(()=> t.remove(), 2200);
}

/* save current user */
function saveCurrentUser(){
  if (!currentUserCache) return;
  const users = getUsers();
  const idx = users.findIndex(u => u.accountNumber === currentUserCache.accountNumber);
  if (idx >= 0) users[idx] = currentUserCache;
  persistUsers(users);
}

/* helpers */
function getUsers(){ return JSON.parse(localStorage.getItem('users')) || []; }
function persistUsers(users){ localStorage.setItem('users', JSON.stringify(users)); }
function timestamp(){ return new Date().toLocaleString(); }
function deepCopy(obj){ return JSON.parse(JSON.stringify(obj)); }

/* restore login state (index) */
function restoreLoginState(){
  const active = localStorage.getItem('activeAccount');
  if (active){
    const msgEl = $('msg'); if (msgEl) msgEl.textContent = `Tip: Dashboard for account ${active} may already be open in another tab.`;
  }
}

/* page auto-init: dashboard auto-open if activeAccount set */
(function pageAutoInit(){
  if (typeof window === 'undefined') return;
  if (document.getElementById('dashboard-card')){
    const active = localStorage.getItem('activeAccount');
    if (active) openDashboardFor(Number(active));
    window.addEventListener('storage', (e) => {
      if (e.key === 'users'){
        const activeNow = localStorage.getItem('activeAccount');
        if (activeNow) openDashboardFor(Number(activeNow));
      }
    });
  }
})();

/* expose helpers for html */
window.initDataIfNeeded = initDataIfNeeded;
window.setupThemeToggle = setupThemeToggle;
window.togglePin = togglePin;
window.createNewAccount = createNewAccount;
window.handleLogin = handleLogin;
window.openCreatePage = openCreatePage;
window.openDashboardFor = openDashboardFor;
window.logoutFromDashboard = logoutFromDashboard;
window.deposit = deposit;
window.withdraw = withdraw;
window.transferMoney = transferMoney;
window.showHistory = showHistory;
window.closeHistory = closeHistory;
window.downloadHistory = downloadHistory;
