/* ==========================================
   学校用くまタイマー - アプリケーションロジック
   ========================================== */

// Service Worker Registration & Automatic Update Listener
if ('serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('Service Worker Registered!', reg.scope);
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('New Service Worker version installed and active.');
              }
            });
          }
        });
      })
      .catch(err => console.log('Service Worker registration failed:', err));
  });
}

// State variables
let timerInterval = null;
let totalTime = 600; // default 10 mins (休み時間)
let timeLeft = totalTime;
let isRunning = false;
let currentTheme = 'default'; // 'default', 'rainbow', 'lunch'
let currentLabel = 'やすみじかん';
let isMuted = false;

// Audio Context
let audioCtx = null;

// DOM Elements (Bear Timer)
const bodyEl = document.body;
const timerTitleEl = document.getElementById('timer-title');
const timeDisplayEl = document.getElementById('time-display');
const progressBarEl = document.getElementById('progress-bar');
const bearCharacterEl = document.getElementById('bear-character');
const btnPlayPauseEl = document.getElementById('btn-play-pause');
const txtPlayPauseEl = document.getElementById('txt-play-pause');
const iconPlayEl = document.getElementById('icon-play');
const iconPauseEl = document.getElementById('icon-pause');
const btnResetEl = document.getElementById('btn-reset');
const btnVolumeEl = document.getElementById('btn-volume');
const iconSoundOnEl = document.getElementById('icon-sound-on');
const iconSoundOffEl = document.getElementById('icon-sound-off');
const selectAlarmSoundEl = document.getElementById('select-alarm-sound');
const btnFullscreenEl = document.getElementById('btn-fullscreen');

const charBtns = document.querySelectorAll('.char-btn');
const charGroups = document.querySelectorAll('.char-group');
const btnToggleEditorEl = document.getElementById('btn-toggle-editor');
const presetEditorPanelEl = document.getElementById('preset-editor-panel');
const presetEditorFormEl = document.getElementById('preset-editor-form');
const btnCustomSetEl = document.getElementById('btn-custom-set');
const adjustMinDownEl = document.getElementById('adjust-min-down');
const adjustMinUpEl = document.getElementById('adjust-min-up');
const customMinutesEl = document.getElementById('custom-minutes');

// Accessories SVG Groups
const bearRainbowHat = document.getElementById('bear-rainbow-hat');
const bearEatingTools = document.getElementById('bear-eating-tools');

// Eyes SVG Groups
const eyeNormal = document.getElementById('eye-normal');
const eyeSleep = document.getElementById('eye-sleep');
const eyePanic = document.getElementById('eye-panic');
const eyeHappy = document.getElementById('eye-happy');

// Confetti Container
const confettiContainer = document.getElementById('confetti');

// State variables for character
let activeCharacter = 'bear';

// Audio setup trigger
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

/* ==========================================
   Timer core logic (Bear Timer)
   ========================================== */

function updateDisplay() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  timeDisplayEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Update progress bar
  const dashArrayLength = 911; // 2 * PI * 145 approx
  let progress = 0;
  if (totalTime > 0) {
    progress = timeLeft / totalTime;
  }
  const offset = dashArrayLength * (1 - progress);
  progressBarEl.style.strokeDashoffset = offset;

  // Update bear expression based on remaining time and status
  updateBearExpression();
}

function updateBearExpression() {
  // Remove all state classes
  bearCharacterEl.classList.remove('state-idle', 'state-running', 'state-paused', 'state-panic', 'state-finished');
  
  // Hide all eyes
  eyeNormal.classList.add('hide');
  eyeSleep.classList.add('hide');
  eyePanic.classList.add('hide');
  eyeHappy.classList.add('hide');

  if (timeLeft === 0) {
    // Finished state
    bearCharacterEl.classList.add('state-finished');
    eyeHappy.classList.remove('hide');
  } else if (!isRunning) {
    // Paused / Idle state (Sleeping)
    bearCharacterEl.classList.add('state-paused');
    eyeSleep.classList.remove('hide');
  } else if (timeLeft <= 60) {
    // Panic state (Last 1 minute)
    bearCharacterEl.classList.add('state-panic');
    eyePanic.classList.remove('hide');
  } else {
    // Normal running state
    bearCharacterEl.classList.add('state-running');
    eyeNormal.classList.remove('hide');
  }
}

function startTimer() {
  if (isRunning) return;
  initAudio();
  isRunning = true;
  txtPlayPauseEl.textContent = 'ストップ';
  iconPlayEl.classList.add('hide');
  iconPauseEl.classList.remove('hide');

  timerInterval = setInterval(() => {
    if (timeLeft > 0) {
      timeLeft--;
      updateDisplay();
    } else {
      clearInterval(timerInterval);
      timerFinished();
    }
  }, 1000);

  updateDisplay();
}

function pauseTimer() {
  if (!isRunning) return;
  isRunning = false;
  txtPlayPauseEl.textContent = 'スタート';
  iconPlayEl.classList.remove('hide');
  iconPauseEl.classList.add('hide');
  clearInterval(timerInterval);
  updateDisplay();
}

function resetTimer() {
  pauseTimer();
  timeLeft = totalTime;
  stopConfetti();
  updateDisplay();
}

function timerFinished() {
  isRunning = false;
  txtPlayPauseEl.textContent = 'スタート';
  iconPlayEl.classList.remove('hide');
  iconPauseEl.classList.add('hide');
  updateDisplay();
  
  // Start happy confetti
  startConfetti();
  
  // Play selected sound
  playAlarm();
}

/* ==========================================
   Sound Synthesis Logic (Web Audio API)
   ========================================== */

function playAlarm() {
  if (isMuted) return;
  initAudio();
  
  const soundType = selectAlarmSoundEl.value;
  
  if (soundType === 'school-chime') {
    playSchoolChime();
  } else if (soundType === 'bell') {
    playAlarmBell();
  } else if (soundType === 'music-box') {
    playMusicBox();
  }
}

// Synthesizes a warm xylophone-like bell note
function playBellNote(frequency, startTime, duration) {
  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator(); // Overtones
  const gainNode = audioCtx.createGain();

  osc1.type = 'triangle';
  osc1.frequency.setValueAtTime(frequency, startTime);

  // Add a higher-pitched overtone to simulate a metallic bell strike
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(frequency * 2, startTime);

  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(0.4, startTime + 0.05); // quick attack
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration); // smooth decay

  osc1.connect(gainNode);
  osc2.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  osc1.start(startTime);
  osc1.stop(startTime + duration);
  osc2.start(startTime);
  osc2.stop(startTime + duration);
}

// Play School Chime (Westminster Chime)
function playSchoolChime() {
  const notes = [
    { freq: 329.63, time: 0.0 }, // E4
    { freq: 392.00, time: 0.8 }, // G4
    { freq: 349.23, time: 1.6 }, // F4
    { freq: 261.63, time: 2.4 }, // C4
    
    { freq: 261.63, time: 4.0 }, // C4
    { freq: 349.23, time: 4.8 }, // F4
    { freq: 392.00, time: 5.6 }, // G4
    { freq: 329.63, time: 6.4 }  // E4
  ];

  const now = audioCtx.currentTime;
  notes.forEach((note) => {
    playBellNote(note.freq, now + note.time, 1.5);
  });
}

// Play Alarm Bell (Ringing bell sound)
function playAlarmBell() {
  const now = audioCtx.currentTime;
  // A rapid series of alternating high notes to simulate a ringing alarm clock
  for (let i = 0; i < 15; i++) {
    const timeOffset = i * 0.15;
    const freq = i % 2 === 0 ? 880 : 987;
    playBellNote(freq, now + timeOffset, 0.18);
  }
}

// Play Music Box (A cute pentatonic melody)
function playMusicBox() {
  const melody = [
    { freq: 523.25, time: 0.0 }, // C5
    { freq: 659.25, time: 0.3 }, // E5
    { freq: 783.99, time: 0.6 }, // G5
    { freq: 1046.50, time: 0.9 }, // C6
    { freq: 783.99, time: 1.2 }, // G5
    { freq: 659.25, time: 1.5 }, // E5
    { freq: 523.25, time: 1.8 }  // C5
  ];

  const now = audioCtx.currentTime;
  melody.forEach((note) => {
    playBellNote(note.freq, now + note.time, 0.8);
  });
}

/* ==========================================
   Visual Effects (Confetti)
   ========================================== */

let confettiInterval = null;

function startConfetti() {
  stopConfetti();
  confettiContainer.innerHTML = '';
  
  const colors = ['#FF8B94', '#FFD3B6', '#FFAAA6', '#DED2F9', '#85E3FF', '#B5E2A9'];
  
  confettiInterval = setInterval(() => {
    const piece = document.createElement('div');
    piece.classList.add('confetti-piece');
    
    // Random position and color
    piece.style.left = Math.random() * 100 + '%';
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.width = Math.random() * 10 + 6 + 'px';
    piece.style.height = piece.style.width;
    
    // Random size & rotation duration
    const duration = Math.random() * 2 + 1.5;
    piece.style.animationDuration = duration + 's';
    
    confettiContainer.appendChild(piece);
    
    // Auto cleanup piece
    setTimeout(() => piece.remove(), duration * 1000);
  }, 100);
  
  // Auto stop confetti after 12 seconds to save CPU
  setTimeout(stopConfetti, 12000);
}

function stopConfetti() {
  if (confettiInterval) {
    clearInterval(confettiInterval);
    confettiInterval = null;
  }
}

/* ==========================================
   Theme and Preset Customization (Bear Timer)
   ========================================== */

const DEFAULT_PRESETS = [
  { emoji: '🏃', label: 'やすみじかん', minutes: 10, theme: 'default' },
  { emoji: '🌈', label: 'レインボータイム', minutes: 15, theme: 'rainbow' },
  { emoji: '🍞', label: '給食終了まであと', minutes: 20, theme: 'lunch' },
  { emoji: '⏱️', label: 'ミニワーク', minutes: 5, theme: 'default' }
];

let customPresets = [];

function loadPresets() {
  const saved = localStorage.getItem('saved-presets');
  if (saved) {
    try {
      customPresets = JSON.parse(saved);
    } catch (e) {
      console.error("Error parsing saved presets", e);
      customPresets = JSON.parse(JSON.stringify(DEFAULT_PRESETS));
    }
  } else {
    customPresets = JSON.parse(JSON.stringify(DEFAULT_PRESETS));
  }
}

function renderPresets() {
  const container = document.getElementById('presets-grid-container');
  if (!container) return;
  container.innerHTML = '';
  
  customPresets.forEach((preset, index) => {
    const btn = document.createElement('button');
    btn.className = 'preset-card';
    if (preset.theme === 'rainbow') btn.classList.add('preset-rainbow');
    if (preset.theme === 'lunch') btn.classList.add('preset-lunch');
    btn.dataset.index = index;
    
    // Check if currently active
    const isActive = (totalTime === preset.minutes * 60 && currentLabel === preset.label && currentTheme === preset.theme);
    if (isActive) {
      btn.classList.add('active');
    }
    
    btn.innerHTML = `
      <span class="preset-icon">${preset.emoji}</span>
      <span class="preset-name">${preset.label}</span>
      <span class="preset-duration">${preset.minutes}ふん</span>
    `;
    
    btn.addEventListener('click', () => {
      applyPresetByIndex(index);
    });
    
    container.appendChild(btn);
  });
}

function applyPresetByIndex(index) {
  // Update active state in UI
  const cards = document.querySelectorAll('.preset-card');
  cards.forEach(c => c.classList.remove('active'));
  
  const clickedCard = document.querySelector(`.preset-card[data-index="${index}"]`);
  if (clickedCard) clickedCard.classList.add('active');

  const preset = customPresets[index];
  totalTime = preset.minutes * 60;
  currentLabel = preset.label;
  currentTheme = preset.theme;

  applyTheme(preset.theme, preset.label);
  resetTimer();
}

function applyTheme(theme, label) {
  // If Step Timer view is active, skip theme modifications on body
  if (document.body.classList.contains('mode-step-timer')) return;

  // Reset themes on body
  bodyEl.classList.remove('theme-default', 'theme-rainbow', 'theme-lunch');
  bodyEl.classList.add(`theme-${theme}`);
  
  // Set header label
  if (label === 'やすみじかん' || label === 'ミニワーク') {
    timerTitleEl.textContent = `${label} タイマー`;
  } else if (label === 'わだしょうがっこうタイマー' || label === 'タイマー') {
    timerTitleEl.textContent = 'わだしょうがっこうタイマー';
  } else {
    timerTitleEl.textContent = label;
  }
  
  // Toggle accessories based on theme
  bearRainbowHat.classList.add('hide');
  bearEatingTools.classList.add('hide');
  bearCharacterEl.classList.remove('state-eating', 'state-rainbow');

  if (theme === 'rainbow') {
    bearRainbowHat.classList.remove('hide');
    bearCharacterEl.classList.add('state-rainbow');
  } else if (theme === 'lunch') {
    bearEatingTools.classList.remove('hide');
    bearCharacterEl.classList.add('state-eating');
  }
}

/* ==========================================
   Event Listeners and Interactive Hooks (Bear Timer)
   ========================================== */

// Play / Pause Button
btnPlayPauseEl.addEventListener('click', () => {
  if (isRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
});

// Reset Button
btnResetEl.addEventListener('click', resetTimer);

// Mute / Unmute Button
btnVolumeEl.addEventListener('click', () => {
  isMuted = !isMuted;
  if (isMuted) {
    iconSoundOnEl.classList.add('hide');
    iconSoundOffEl.classList.remove('hide');
  } else {
    iconSoundOnEl.classList.remove('hide');
    iconSoundOffEl.classList.add('hide');
    initAudio();
    // Play a quick test sound to confirm unmuting
    playBellNote(659.25, audioCtx.currentTime, 0.3);
  }
});

// Fullscreen Button
btnFullscreenEl.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
      .catch((err) => console.log(`Fullscreen error: ${err.message}`));
  } else {
    document.exitFullscreen();
  }
});

// Custom Timer Adjuster
let customMin = 10;

adjustMinDownEl.addEventListener('click', () => {
  if (customMin > 1) {
    customMin--;
    customMinutesEl.textContent = customMin;
  }
});

adjustMinUpEl.addEventListener('click', () => {
  if (customMin < 120) {
    customMin++;
    customMinutesEl.textContent = customMin;
  }
});

btnCustomSetEl.addEventListener('click', () => {
  // Clear preset selection
  const cards = document.querySelectorAll('.preset-card');
  cards.forEach(c => c.classList.remove('active'));
  
  totalTime = customMin * 60;
  currentLabel = 'わだしょうがっこうタイマー';
  currentTheme = 'default';
  
  applyTheme('default', 'わだしょうがっこうタイマー');
  resetTimer();
});

// Character Selector logic
function selectCharacter(charName) {
  activeCharacter = charName;
  
  // Update buttons active states
  charBtns.forEach((btn) => {
    if (btn.dataset.char === charName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Toggle character groups visibility
  charGroups.forEach((group) => {
    if (group.id === `char-${charName}`) {
      group.classList.remove('hide');
    } else {
      group.classList.add('hide');
    }
  });

  // Update theme classes on container for eye styling variables
  // Remove all active char classes
  bearCharacterEl.classList.remove('char-active-bear', 'char-active-chick', 'char-active-panda');
  bearCharacterEl.classList.add(`char-active-${charName}`);

  // Save selection
  localStorage.setItem('selected-character', charName);
  
  // Refresh display/expression
  updateDisplay();
}

// Character button click listeners
charBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const char = btn.dataset.char;
    selectCharacter(char);
  });
});

// Toggle Preset Editor
btnToggleEditorEl.addEventListener('click', () => {
  presetEditorPanelEl.classList.toggle('hidden');
  if (!presetEditorPanelEl.classList.contains('hidden')) {
    populateEditor();
  }
});

function populateEditor() {
  const rows = document.querySelectorAll('.editor-row');
  rows.forEach((row) => {
    const index = parseInt(row.dataset.index, 10);
    const preset = customPresets[index];
    if (preset) {
      row.querySelector('.edit-emoji').value = preset.emoji;
      row.querySelector('.edit-label').value = preset.label;
      row.querySelector('.edit-time').value = preset.minutes;
      row.querySelector('.edit-theme').value = preset.theme;
    }
  });
}

// Preset Editor Form Submit
presetEditorFormEl.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const rows = document.querySelectorAll('.editor-row');
  const newPresets = [];
  
  rows.forEach((row) => {
    const emoji = row.querySelector('.edit-emoji').value.trim() || '⏱️';
    const label = row.querySelector('.edit-label').value.trim();
    const minutes = parseInt(row.querySelector('.edit-time').value, 10) || 5;
    const theme = row.querySelector('.edit-theme').value;
    
    newPresets.push({
      emoji: emoji,
      label: label,
      minutes: minutes,
      theme: theme
    });
  });
  
  customPresets = newPresets;
  localStorage.setItem('saved-presets', JSON.stringify(customPresets));
  
  // Re-render presets
  renderPresets();
  
  // Close editor panel
  presetEditorPanelEl.classList.add('hidden');
  
  // Play a pleasant feedback note
  initAudio();
  playBellNote(783.99, audioCtx.currentTime, 0.4);
});

// Force Reset Button Logic (Clears LocalStorage, SW registration, and Caches)
const btnForceResetEl = document.getElementById('btn-force-reset');
if (btnForceResetEl) {
  btnForceResetEl.addEventListener('click', async () => {
    const confirmReset = confirm("設定とキャッシュをすべてクリアして、アプリを最新状態に初期化しますか？");
    if (!confirmReset) return;
    
    try {
      // 1. Clear LocalStorage
      localStorage.clear();
      
      // 2. Unregister Service Workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
          await registration.unregister();
        }
      }
      
      // 3. Clear Cache Storage
      if ('caches' in window) {
        const keys = await caches.keys();
        for (let key of keys) {
          await caches.delete(key);
        }
      }
    } catch (err) {
      console.error("Error during force reset:", err);
    }
    
    // 4. Force reload from server
    window.location.reload(true);
  });
}

// Bear Timer Initial Setup Hook
function initBearTimer() {
  loadPresets();
  renderPresets();

  // Select the first preset by default
  applyPresetByIndex(0);

  // Load saved character selection
  const savedChar = localStorage.getItem('selected-character') || 'bear';
  selectCharacter(savedChar);
}


/* ========================================================
   自習用ステップタイマー - ロジック
   ======================================================== */

// Default steps updated: 「計算ドリル」「漢字ドリル」「読書」
let steps = [
  { emoji: '🧮', label: '計算ドリル', minutes: 10, theme: 'default' },
  { emoji: '✍️', label: '漢字ドリル', minutes: 10, theme: 'default' },
  { emoji: '📖', label: '読書', minutes: 10, theme: 'default' }
];
let currentStepIndex = 0;
let stepTimeLeft = 0;
let stepIsRunning = false;
let stepTimerInterval = null;

// View Switching Listeners
const btnSwitchToStepEl = document.getElementById('btn-switch-to-step');
const btnSwitchToBearEl = document.getElementById('btn-switch-to-bear');

btnSwitchToStepEl.addEventListener('click', () => {
  // Pause bear timer if active
  pauseTimer();
  document.body.classList.add('mode-step-timer');
  document.body.classList.remove('theme-default', 'theme-rainbow', 'theme-lunch');
  document.getElementById('timer-container-wrapper').classList.add('view-step-timer');
  btnSwitchToStepEl.classList.add('hide');
  btnSwitchToBearEl.classList.remove('hide');
  loadStepSetup();
});

btnSwitchToBearEl.addEventListener('click', () => {
  // Pause step timer if active
  pauseStepTimer();
  document.body.classList.remove('mode-step-timer');
  document.getElementById('timer-container-wrapper').classList.remove('view-step-timer');
  btnSwitchToBearEl.classList.add('hide');
  btnSwitchToStepEl.classList.remove('hide');
  // restore bear theme
  applyTheme(currentTheme, currentLabel);
});

// Load setup list from localStorage
function loadStepSetup() {
  const saved = localStorage.getItem('saved-step-timer-steps');
  if (saved) {
    try {
      steps = JSON.parse(saved);
    } catch (e) {
      console.error("Error loading steps", e);
    }
  }
  renderSetupRows();
  
  // Show setup, hide running elements
  document.getElementById('step-settings-panel').classList.remove('hide');
  document.getElementById('step-running-panel').classList.add('hide');
  document.getElementById('step-flow-panel').classList.add('hide');
}

function renderSetupRows() {
  const container = document.getElementById('step-rows-container');
  container.innerHTML = '';
  
  steps.forEach((step, idx) => {
    const row = document.createElement('div');
    row.className = 'step-setup-row';
    row.dataset.index = idx;
    
    row.innerHTML = `
      <span class="step-num">${idx + 1}</span>
      <input type="text" class="input-step-label" placeholder="やること" value="${step.label}" required>
      <input type="number" class="input-step-time" placeholder="時間" value="${step.minutes}" min="1" max="120" required>
      <button class="btn-delete-row" type="button">🗑️</button>
    `;
    
    // Delete button listener
    row.querySelector('.btn-delete-row').addEventListener('click', () => {
      deleteStepRow(idx);
    });
    
    container.appendChild(row);
  });
}

function deleteStepRow(index) {
  syncStepsFromUI();
  steps.splice(index, 1);
  renderSetupRows();
}

function syncStepsFromUI() {
  const rows = document.querySelectorAll('.step-setup-row');
  steps = [];
  rows.forEach((row) => {
    const label = row.querySelector('.input-step-label').value.trim() || '自主学習';
    const minutes = parseInt(row.querySelector('.input-step-time').value, 10) || 10;
    steps.push({ emoji: '⏱️', label, minutes, theme: 'default' });
  });
}

// Add Step Row button
document.getElementById('btn-add-step-row').addEventListener('click', () => {
  syncStepsFromUI();
  steps.push({ emoji: '⏱️', label: '', minutes: 10, theme: 'default' });
  renderSetupRows();
});

// Form submit listener (Start timer)
document.getElementById('step-setup-form').addEventListener('submit', (e) => {
  e.preventDefault();
  syncStepsFromUI();
  
  if (steps.length === 0) {
    alert('ステップを1つ以上追加してください！');
    return;
  }
  
  // Save configuration to localStorage
  localStorage.setItem('saved-step-timer-steps', JSON.stringify(steps));
  
  // Show running view, hide settings view
  document.getElementById('step-settings-panel').classList.add('hide');
  document.getElementById('step-running-panel').classList.remove('hide');
  document.getElementById('step-flow-panel').classList.remove('hide');
  
  startStepRunningPhase();
});

function startStepRunningPhase() {
  currentStepIndex = 0;
  stepTimeLeft = steps[currentStepIndex].minutes * 60;
  stepIsRunning = false;
  
  // Reset play button icon/text
  document.getElementById('btn-step-play-pause').innerHTML = `
    <svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
    <span>スタート</span>
  `;
  document.getElementById('step-giant-card').classList.remove('all-finished');
  
  updateStepDisplay();
}

function updateStepDisplay() {
  renderStepFlowList();
  
  if (currentStepIndex >= steps.length) {
    // All steps finished!
    document.getElementById('current-step-label').textContent = 'しゅうりょう！';
    document.getElementById('step-time-display').textContent = 'おわり';
    document.getElementById('step-giant-card').classList.add('all-finished');
    const totalTimeEl = document.getElementById('step-total-time-display');
    if (totalTimeEl) totalTimeEl.textContent = '全体ののこり 00:00';
    document.getElementById('btn-step-play-pause').innerHTML = `
      <svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      <span>スタート</span>
    `;
    return;
  }
  
  const step = steps[currentStepIndex];
  document.getElementById('current-step-label').textContent = step.label;
  
  const mins = Math.floor(stepTimeLeft / 60);
  const secs = stepTimeLeft % 60;
  document.getElementById('step-time-display').textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  
  // Calculate total remaining time
  let totalSecondsLeft = stepTimeLeft;
  for (let i = currentStepIndex + 1; i < steps.length; i++) {
    totalSecondsLeft += steps[i].minutes * 60;
  }
  
  const totalMins = Math.floor(totalSecondsLeft / 60);
  const totalSecs = totalSecondsLeft % 60;
  const totalTimeEl = document.getElementById('step-total-time-display');
  if (totalTimeEl) {
    totalTimeEl.textContent = `全体ののこり ${String(totalMins).padStart(2, '0')}:${String(totalSecs).padStart(2, '0')}`;
  }
}

function renderStepFlowList() {
  const container = document.getElementById('step-flow-container');
  if (!container) return;
  container.innerHTML = '';
  
  steps.forEach((step, idx) => {
    const item = document.createElement('div');
    item.className = 'flow-item';
    
    if (idx < currentStepIndex) {
      item.classList.add('done');
      item.innerHTML = `
        <div class="flow-left">
          <span class="flow-idx">✓</span>
          <span class="flow-task-name">${step.label}</span>
        </div>
        <span class="flow-badge">✅ おわり</span>
      `;
    } else if (idx === currentStepIndex) {
      item.classList.add('active');
      item.innerHTML = `
        <div class="flow-left">
          <span class="flow-idx">▶</span>
          <span class="flow-task-name">${step.label}</span>
        </div>
        <span class="flow-badge">${step.minutes}分</span>
      `;
    } else {
      item.classList.add('pending');
      item.innerHTML = `
        <div class="flow-left">
          <span class="flow-idx">${idx + 1}</span>
          <span class="flow-task-name">${step.label}</span>
        </div>
        <span class="flow-badge">${step.minutes}分</span>
      `;
    }
    
    container.appendChild(item);
  });
}

// Step Timer play/pause trigger
document.getElementById('btn-step-play-pause').addEventListener('click', () => {
  initAudio();
  
  if (currentStepIndex >= steps.length) {
    // Restart from beginning if finished
    startStepRunningPhase();
    return;
  }
  
  if (stepIsRunning) {
    pauseStepTimer();
  } else {
    startStepTimer();
  }
});

function startStepTimer() {
  if (stepIsRunning) return;
  stepIsRunning = true;
  
  document.getElementById('btn-step-play-pause').innerHTML = `
    <svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
    <span>ストップ</span>
  `;
  
  stepTimerInterval = setInterval(() => {
    if (stepTimeLeft > 0) {
      stepTimeLeft--;
      updateStepDisplay();
    } else {
      // Current step finished!
      playAlarm(); // Play chime notification
      currentStepIndex++;
      
      if (currentStepIndex < steps.length) {
        // Setup next step
        stepTimeLeft = steps[currentStepIndex].minutes * 60;
        updateStepDisplay();
      } else {
        // All steps complete!
        clearInterval(stepTimerInterval);
        stepIsRunning = false;
        updateStepDisplay();
        startConfetti();
        playMusicBox(); // Play final celebration music
      }
    }
  }, 1000);
}

function pauseStepTimer() {
  stepIsRunning = false;
  document.getElementById('btn-step-play-pause').innerHTML = `
    <svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
    <span>再開</span>
  `;
  clearInterval(stepTimerInterval);
}

// Back to Setup / Reset
document.getElementById('btn-step-reset').addEventListener('click', () => {
  pauseStepTimer();
  document.getElementById('step-settings-panel').classList.remove('hide');
  document.getElementById('step-running-panel').classList.add('hide');
  document.getElementById('step-flow-panel').classList.add('hide');
});

// Step Timer Fullscreen Button Handler
const btnStepFullscreenEl = document.getElementById('btn-step-fullscreen');
if (btnStepFullscreenEl) {
  btnStepFullscreenEl.addEventListener('click', () => {
    const panel = document.getElementById('timer-container-wrapper');
    if (!document.fullscreenElement) {
      panel.requestFullscreen()
        .then(() => {
          btnStepFullscreenEl.querySelector('span').textContent = '全画面を解除';
        })
        .catch((err) => console.log(`Fullscreen error: ${err.message}`));
    } else {
      document.exitFullscreen();
    }
  });

  // Listen for fullscreen change event to update button label
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      btnStepFullscreenEl.querySelector('span').textContent = '全画面にする';
    }
  });
}

/* ==========================================
   INITIAL RUNTIME BOOTSTRAP
   ========================================== */
initBearTimer();
