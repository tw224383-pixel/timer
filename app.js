/* ==========================================
   学校用くまタイマー - アプリケーションロジック
   ========================================== */

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker Registered!', reg.scope))
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

// DOM Elements
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
const presetCards = document.querySelectorAll('.preset-card');
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
   Timer core logic
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
   Theme and Preset Customization
   ========================================== */

function applyPreset(card) {
  // Update active state in UI
  presetCards.forEach(c => c.classList.remove('active'));
  card.classList.add('active');

  const seconds = parseInt(card.dataset.time, 10);
  const label = card.dataset.label;
  const theme = card.dataset.theme;

  totalTime = seconds;
  currentLabel = label;
  currentTheme = theme;
  
  applyTheme(theme, label);
  resetTimer();
}

function applyTheme(theme, label) {
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
   Event Listeners and Interactive Hooks
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

// Preset Buttons
presetCards.forEach((card) => {
  card.addEventListener('click', () => {
    applyPreset(card);
  });
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
  presetCards.forEach(c => c.classList.remove('active'));
  
  totalTime = customMin * 60;
  currentLabel = 'わだしょうがっこうタイマー';
  currentTheme = 'default';
  
  applyTheme('default', 'わだしょうがっこうタイマー');
  resetTimer();
});

// Initial Setup
// Select the "やすみじかん (10分)" preset by default
const defaultPreset = document.querySelector('[data-label="やすみじかん"]');
if (defaultPreset) {
  applyPreset(defaultPreset);
} else {
  updateDisplay();
}
