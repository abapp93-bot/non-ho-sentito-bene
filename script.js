const screens = document.querySelectorAll(".screen");
const categoriesEl = document.getElementById("categories");

const state = {
  category: null,
  promptIndex: 0,
  micEnabled: true,
  readerMicEnabled: true,
  heardVoice: false,
  readerHeardVoice: false,
  audioContext: null,
  analyser: null,
  micStream: null,
  micSource: null,
  volumeLoop: null,
  noiseFloor: 0,
  progress: loadProgress()
};

const encouragements = [
  "Vedi? La voce c’è.",
  "Brava. Un’altra e diventi speaker radiofonica.",
  "Ok, questa l’hai detta. Non era nemmeno male 😌",
  "Piccolo passo, grande vittoria.",
  "Ti ho sentita. Missione compiuta.",
  "Non era una trappola. O forse sì. Però ha funzionato.",
  "Voce presente, autostima in caricamento.",
  "Questa vale doppio perché l’hai detta davvero."
];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadProgress() {
  const fallback = {
    todayDate: todayKey(),
    todayCount: 0,
    totalCount: 0,
    streak: 0,
    lastReadDate: null,
    lastCategory: null,
    readItems: {}
  };

  try {
    const saved = JSON.parse(localStorage.getItem("nhsb-progress"));
    if (!saved) return fallback;
    if (saved.todayDate !== todayKey()) {
      saved.todayDate = todayKey();
      saved.todayCount = 0;
    }
    return { ...fallback, ...saved };
  } catch {
    return fallback;
  }
}

function saveProgress() {
  localStorage.setItem("nhsb-progress", JSON.stringify(state.progress));
}

function updateStatsUI() {
  const today = document.getElementById("todayCount");
  const total = document.getElementById("totalCount");
  const streak = document.getElementById("streakCount");

  if (today) today.textContent = state.progress.todayCount;
  if (total) total.textContent = state.progress.totalCount;
  if (streak) streak.textContent = state.progress.streak;
}

function showScreen(id) {
  screens.forEach(screen => screen.classList.toggle("active", screen.id === id));
  if (id === "dashboard") renderDashboard();
}

function randomFrom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getCategoryEntries() {
  return Object.entries(SPEAKING_DATA);
}

function getCurrentPrompts() {
  return SPEAKING_DATA[state.category][1];
}

function getReadKey(category, index) {
  return `${category}-${index}`;
}

function getUnreadIndexes(category) {
  const prompts = SPEAKING_DATA[category][1];
  const unread = [];
  for (let i = 0; i < prompts.length; i++) {
    if (!state.progress.readItems[getReadKey(category, i)]) {
      unread.push(i);
    }
  }
  return unread;
}

function chooseUnreadIndex(category) {
  const unread = getUnreadIndexes(category);
  if (unread.length > 0) return randomFrom(unread);
  return Math.floor(Math.random() * SPEAKING_DATA[category][1].length);
}

function getCategoryReadInfo(category) {
  const total = SPEAKING_DATA[category][1].length;
  const unread = getUnreadIndexes(category).length;
  return { total, read: total - unread, unread };
}

function renderDashboard() {
  updateStatsUI();

  const badges = [];
  if (state.progress.totalCount >= 5) badges.push("🌱 5 frasi: voce riscaldata");
  if (state.progress.totalCount >= 20) badges.push("🌷 20 frasi: costanza sospetta");
  if (state.progress.totalCount >= 50) badges.push("🎤 50 frasi: quasi TED Talk");
  if (state.progress.streak >= 3) badges.push("🔥 3 giorni di fila");

  document.getElementById("badgeBox").textContent = badges.length
    ? badges.join(" · ")
    : "Nessun badge ancora. Ma il sito ti guarda con fiducia.";

  categoriesEl.innerHTML = "";

  getCategoryEntries().forEach(([key, [name]]) => {
    const info = getCategoryReadInfo(key);
    const card = document.createElement("button");
    card.className = "category-card";
    card.innerHTML = `<h3>${name}</h3><p>${info.read}/${info.total} letti · ${info.unread} nuovi</p>`;
    card.addEventListener("click", () => openCategory(key));
    categoriesEl.appendChild(card);
  });
}

async function openCategory(key, index = null) {
  state.category = key;
  state.progress.lastCategory = key;
  saveProgress();

  state.promptIndex = index ?? chooseUnreadIndex(key);
  renderReader();
  showScreen("reader");

  if (state.readerMicEnabled) {
    await startMicrophone("reader");
  }
}

function renderReader() {
  const [name] = SPEAKING_DATA[state.category];
  const prompts = getCurrentPrompts();

  document.getElementById("categoryName").textContent = name;
  document.getElementById("promptText").textContent = prompts[state.promptIndex];
  document.getElementById("encouragement").textContent = "";

  state.readerHeardVoice = !state.readerMicEnabled;
  updateMarkReadButton();

  if (state.readerMicEnabled) {
    document.getElementById("readerMicStatus").textContent = "Parla ad alta voce: appena ti sento, sblocco il pulsante.";
    document.getElementById("readerVolumeBar").style.width = "0%";
  }
}

function updateMarkReadButton() {
  const button = document.getElementById("markRead");
  if (state.readerHeardVoice || !state.readerMicEnabled) {
    button.disabled = false;
    button.classList.remove("locked");
  } else {
    button.disabled = true;
    button.classList.add("locked");
  }
}

function nextPrompt() {
  const unread = getUnreadIndexes(state.category).filter(index => index !== state.promptIndex);
  if (unread.length > 0) {
    state.promptIndex = randomFrom(unread);
  } else {
    const prompts = getCurrentPrompts();
    state.promptIndex = Math.floor(Math.random() * prompts.length);
    document.getElementById("encouragement").textContent = "Hai letto tutte le frasi di questa categoria. Ora posso ripescare qualche vecchia gloria.";
  }
  renderReader();
  if (state.readerMicEnabled) startMicrophone("reader");
}

function markRead() {
  const key = getReadKey(state.category, state.promptIndex);
  state.progress.readItems[key] = true;

  state.progress.todayCount += 1;
  state.progress.totalCount += 1;

  const today = todayKey();
  if (state.progress.lastReadDate !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().slice(0, 10);
    state.progress.streak = state.progress.lastReadDate === yesterdayKey
      ? state.progress.streak + 1
      : 1;
    state.progress.lastReadDate = today;
  }

  saveProgress();
  updateStatsUI();

  const remaining = getUnreadIndexes(state.category).length;
  document.getElementById("encouragement").textContent =
    `${randomFrom(encouragements)} Oggi: ${state.progress.todayCount} · Totale: ${state.progress.totalCount} · Nuove rimaste qui: ${remaining}`;

  setTimeout(nextPrompt, 1400);
}

/**
 * Rilevamento voce migliorato.
 * Prima usava la media delle frequenze: spesso è troppo bassa.
 * Ora usa RMS sul segnale nel tempo + calibrazione rumore ambiente.
 */
async function startMicrophone(mode = "check") {
  const statusEl = mode === "reader"
    ? document.getElementById("readerMicStatus")
    : document.getElementById("micStatus");

  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("getUserMedia non supportato");
    }

    if (!state.audioContext) {
      state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (state.audioContext.state === "suspended") {
      await state.audioContext.resume();
    }

    if (!state.micStream) {
      state.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true
        }
      });

      state.micSource = state.audioContext.createMediaStreamSource(state.micStream);
      state.analyser = state.audioContext.createAnalyser();
      state.analyser.fftSize = 2048;
      state.analyser.smoothingTimeConstant = 0.15;
      state.micSource.connect(state.analyser);
    }

    if (statusEl) statusEl.textContent = "Sto ascoltando. Parla normalmente, anche solo una frase.";

    calibrateNoiseFloor();
    listenToVoice(mode);
    return true;
  } catch (error) {
    console.error(error);
    if (statusEl) {
      statusEl.textContent = "Microfono non disponibile o permesso negato. Puoi disattivare il controllo voce.";
    }
    return false;
  }
}

function getMicLevelPercent() {
  if (!state.analyser) return 0;

  const buffer = new Uint8Array(state.analyser.fftSize);
  state.analyser.getByteTimeDomainData(buffer);

  let sumSquares = 0;
  for (let i = 0; i < buffer.length; i++) {
    const value = (buffer[i] - 128) / 128;
    sumSquares += value * value;
  }

  const rms = Math.sqrt(sumSquares / buffer.length);

  // Boost intenzionale: voci normali su laptop spesso danno RMS basso.
  return Math.min(100, Math.round(rms * 420));
}

function calibrateNoiseFloor() {
  // Calibrazione semplice e continua: parte dal livello ambiente attuale.
  const level = getMicLevelPercent();
  if (!state.noiseFloor || state.noiseFloor <= 0) {
    state.noiseFloor = Math.max(2, level);
  } else {
    state.noiseFloor = Math.round((state.noiseFloor * 0.9) + (level * 0.1));
  }
}

function getSensitivityThreshold(mode) {
  const sliderValue = Number(document.getElementById("sensitivity").value || 45);

  // Slider alto = più difficile. Ma limitiamo per evitare soglie impossibili.
  const sliderThreshold = Math.max(4, Math.min(32, Math.round(sliderValue / 3)));

  // Serve superare sia una soglia minima sia il rumore di fondo.
  const noiseThreshold = state.noiseFloor + (mode === "reader" ? 5 : 6);

  return Math.max(sliderThreshold, noiseThreshold);
}

function unlockVoiceCheck() {
  state.heardVoice = true;
  document.getElementById("micStatus").textContent = "Ok, questa volta ti credo. Ti ho sentita.";
  const continueButton = document.getElementById("voiceContinue");
  continueButton.disabled = false;
  continueButton.classList.remove("locked");
}

function unlockReaderVoice() {
  state.readerHeardVoice = true;
  document.getElementById("readerMicStatus").textContent = "Ti ho sentita. Ora puoi confermare.";
  updateMarkReadButton();
}

function listenToVoice(mode) {
  cancelAnimationFrame(state.volumeLoop);

  let voiceFrames = 0;

  function tick() {
    const level = getMicLevelPercent();
    const threshold = getSensitivityThreshold(mode);
    const displayPercent = Math.min(100, Math.round((level / Math.max(threshold, 1)) * 65));

    if (mode === "check") {
      document.getElementById("volumeBar").style.width = `${Math.min(100, level * 3)}%`;
      document.getElementById("volumeLabel").textContent = `${level}%`;

      if (level >= threshold) {
        voiceFrames += 1;
      } else {
        voiceFrames = Math.max(0, voiceFrames - 1);
      }

      // Bastano pochi frame consecutivi: così non serve urlare.
      if (!state.heardVoice && voiceFrames >= 3) {
        unlockVoiceCheck();
      }
    }

    if (mode === "reader") {
      document.getElementById("readerVolumeBar").style.width = `${Math.min(100, level * 3)}%`;

      if (level >= threshold) {
        voiceFrames += 1;
      } else {
        voiceFrames = Math.max(0, voiceFrames - 1);
      }

      if (!state.readerHeardVoice && voiceFrames >= 3) {
        unlockReaderVoice();
      }
    }

    state.volumeLoop = requestAnimationFrame(tick);
  }

  tick();
}

document.querySelectorAll("[data-go]").forEach(button => {
  button.addEventListener("click", () => showScreen(button.dataset.go));
});

document.getElementById("sensitivity").addEventListener("input", event => {
  document.getElementById("sensitivityLabel").textContent = `${event.target.value}%`;
  state.noiseFloor = 0;
});

document.getElementById("startMic").addEventListener("click", async () => {
  state.heardVoice = false;
  const continueButton = document.getElementById("voiceContinue");
  continueButton.disabled = true;
  continueButton.classList.add("locked");

  const ok = await startMicrophone("check");
  if (ok) document.getElementById("micStatus").textContent = "Sto ascoltando. Parla normalmente, non serve urlare.";
});

document.getElementById("voiceContinue").addEventListener("click", () => {
  showScreen("dashboard");
});

document.getElementById("skipMic").addEventListener("click", () => {
  state.micEnabled = false;
  document.getElementById("voiceContinue").disabled = false;
  document.getElementById("voiceContinue").classList.remove("locked");
  document.getElementById("micStatus").textContent = "Controllo voce disattivato. Per stavolta.";
});

document.getElementById("randomPick").addEventListener("click", () => {
  const [key] = randomFrom(getCategoryEntries());
  openCategory(key);
});

document.getElementById("continueLast").addEventListener("click", () => {
  openCategory(state.progress.lastCategory || "curiosita");
});

document.getElementById("backToCategories").addEventListener("click", () => {
  showScreen("dashboard");
});

document.getElementById("nextPrompt").addEventListener("click", nextPrompt);
document.getElementById("markRead").addEventListener("click", markRead);

document.getElementById("readerMicToggle").addEventListener("click", async () => {
  state.readerMicEnabled = !state.readerMicEnabled;
  document.getElementById("readerMicToggle").textContent = state.readerMicEnabled ? "Voce: attiva" : "Voce: disattiva";
  document.getElementById("readerVoiceBox").style.display = state.readerMicEnabled ? "block" : "none";

  if (state.readerMicEnabled) {
    state.readerHeardVoice = false;
    updateMarkReadButton();
    await startMicrophone("reader");
  } else {
    state.readerHeardVoice = true;
    updateMarkReadButton();
  }
});

document.getElementById("resetToday").addEventListener("click", () => {
  state.progress.todayCount = 0;
  saveProgress();
  renderDashboard();
});

renderDashboard();
