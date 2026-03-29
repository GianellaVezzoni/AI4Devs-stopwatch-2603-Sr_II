const stopwatchModeBtn = document.getElementById("stopwatchModeBtn");
const countdownModeBtn = document.getElementById("countdownModeBtn");
const timerLabel = document.getElementById("timerLabel");
const timerStatus = document.getElementById("timerStatus");
const display = document.getElementById("display");
const startPauseBtn = document.getElementById("startPauseBtn");
const resetBtn = document.getElementById("resetBtn");
const lapBtn = document.getElementById("lapBtn");
const lapsPanel = document.getElementById("lapsPanel");
const lapsList = document.getElementById("lapsList");
const lapsEmpty = document.getElementById("lapsEmpty");
const countdownSettings = document.getElementById("countdownSettings");
const minutesInput = document.getElementById("minutesInput");
const secondsInput = document.getElementById("secondsInput");
const presetButtons = document.querySelectorAll(".preset-btn");
const progressTrack = document.getElementById("progressTrack");
const progressBar = document.getElementById("progressBar");
const message = document.getElementById("message");

const state = {
  mode: "stopwatch",
  stopwatchElapsed: 0,
  stopwatchStartTime: 0,
  stopwatchRunning: false,
  countdownDuration: 60000,
  countdownRemaining: 60000,
  countdownEndTime: 0,
  countdownRunning: false,
  countdownFinished: false,
  laps: [],
  rafId: null,
};

function pad(value, size = 2) {
  return String(value).padStart(size, "0");
}

function formatStopwatch(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}<small>.${pad(centiseconds)}</small>`;
}

function formatCountdown(ms) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.ceil(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${pad(minutes)}:${pad(seconds)}`;
}

function setStatus(text, type = "idle") {
  timerStatus.classList.remove("running", "finished");
  if (type === "running") timerStatus.classList.add("running");
  if (type === "finished") timerStatus.classList.add("finished");
  timerStatus.innerHTML = `<span class="status-dot"></span>${text}`;
}

function clampCountdownInputs() {
  let minutes = Number(minutesInput.value);
  let seconds = Number(secondsInput.value);

  if (!Number.isFinite(minutes) || minutes < 0) minutes = 0;
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  if (minutes > 999) minutes = 999;
  if (seconds > 59) seconds = 59;

  minutesInput.value = minutes;
  secondsInput.value = seconds;

  return { minutes, seconds };
}

function updateCountdownFromInputs() {
  const { minutes, seconds } = clampCountdownInputs();
  const duration = (minutes * 60 + seconds) * 1000;

  state.countdownDuration = duration;
  state.countdownRemaining = duration;
  state.countdownFinished = false;

  updateUI();
}

function switchMode(mode) {
  state.mode = mode;

  const isStopwatch = mode === "stopwatch";

  stopwatchModeBtn.classList.toggle("active", isStopwatch);
  countdownModeBtn.classList.toggle("active", !isStopwatch);

  stopwatchModeBtn.setAttribute("aria-selected", String(isStopwatch));
  countdownModeBtn.setAttribute("aria-selected", String(!isStopwatch));

  countdownSettings.hidden = isStopwatch;
  lapsPanel.hidden = !isStopwatch;
  lapBtn.disabled = !isStopwatch;

  if (isStopwatch) {
    timerLabel.textContent = "Stopwatch mode";
    progressTrack.hidden = true;
    message.hidden = true;
  } else {
    timerLabel.textContent = "Countdown mode";
    progressTrack.hidden = false;
  }

  updateUI();
}

function startCurrentMode() {
  if (state.mode === "stopwatch") {
    if (state.stopwatchRunning) return;

    state.stopwatchRunning = true;
    state.stopwatchStartTime = performance.now() - state.stopwatchElapsed;
    runLoop();
  } else {
    if (state.countdownRunning) return;
    if (state.countdownRemaining <= 0) {
      updateCountdownFromInputs();
    }
    if (state.countdownDuration <= 0) {
      message.hidden = false;
      message.textContent = "Set a valid countdown first.";
      return;
    }

    state.countdownRunning = true;
    state.countdownFinished = false;
    state.countdownEndTime = performance.now() + state.countdownRemaining;
    message.hidden = true;
    runLoop();
  }

  updateUI();
}

function pauseCurrentMode() {
  if (state.mode === "stopwatch") {
    if (!state.stopwatchRunning) return;
    state.stopwatchElapsed = performance.now() - state.stopwatchStartTime;
    state.stopwatchRunning = false;
  } else {
    if (!state.countdownRunning) return;
    state.countdownRemaining = Math.max(
      0,
      state.countdownEndTime - performance.now(),
    );
    state.countdownRunning = false;
  }

  stopLoopIfIdle();
  updateUI();
}

function toggleStartPause() {
  const isRunning =
    state.mode === "stopwatch"
      ? state.stopwatchRunning
      : state.countdownRunning;

  if (isRunning) {
    pauseCurrentMode();
  } else {
    startCurrentMode();
  }
}

function resetCurrentMode() {
  if (state.mode === "stopwatch") {
    state.stopwatchElapsed = 0;
    state.stopwatchStartTime = 0;
    state.stopwatchRunning = false;
    state.laps = [];
    renderLaps();
  } else {
    state.countdownRunning = false;
    state.countdownFinished = false;
    message.hidden = true;
    updateCountdownFromInputs();
  }

  stopLoopIfIdle();
  updateUI();
}

function addLap() {
  if (state.mode !== "stopwatch") return;
  if (!state.stopwatchRunning && state.stopwatchElapsed === 0) return;

  const currentTime = state.stopwatchRunning
    ? performance.now() - state.stopwatchStartTime
    : state.stopwatchElapsed;

  state.laps.unshift(currentTime);
  renderLaps();
}

function renderLaps() {
  lapsList.innerHTML = "";

  if (state.laps.length === 0) {
    lapsEmpty.hidden = false;
    return;
  }

  lapsEmpty.hidden = true;

  state.laps.forEach((lapTime, index) => {
    const item = document.createElement("li");
    item.innerHTML = `<strong>Lap ${state.laps.length - index}</strong><span>${stripHTML(
      formatStopwatch(lapTime),
    )}</span>`;
    lapsList.appendChild(item);
  });
}

function stripHTML(html) {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || "";
}

function updateProgress() {
  if (state.mode !== "countdown") return;

  const duration = state.countdownDuration;
  const remaining = state.countdownRemaining;

  if (duration <= 0) {
    progressBar.style.width = "0%";
    return;
  }

  const completedRatio = ((duration - remaining) / duration) * 100;
  progressBar.style.width = `${Math.min(100, Math.max(0, completedRatio))}%`;
}

function updateUI() {
  if (state.mode === "stopwatch") {
    const elapsed = state.stopwatchRunning
      ? performance.now() - state.stopwatchStartTime
      : state.stopwatchElapsed;

    display.innerHTML = formatStopwatch(elapsed);
    startPauseBtn.textContent = state.stopwatchRunning ? "Pause" : "Start";
    setStatus(
      state.stopwatchRunning ? "Running" : elapsed > 0 ? "Paused" : "Idle",
      state.stopwatchRunning ? "running" : "idle",
    );
  } else {
    display.textContent = formatCountdown(state.countdownRemaining);
    startPauseBtn.textContent = state.countdownRunning ? "Pause" : "Start";

    if (state.countdownFinished) {
      setStatus("Time's up", "finished");
      message.hidden = false;
      message.textContent = "Time's up.";
    } else if (state.countdownRunning) {
      setStatus("Running", "running");
      message.hidden = true;
    } else if (state.countdownRemaining < state.countdownDuration) {
      setStatus("Paused", "idle");
      message.hidden = true;
    } else {
      setStatus("Ready", "idle");
      message.hidden = true;
    }

    updateProgress();
  }
}

function onFrame() {
  if (state.stopwatchRunning) {
    display.innerHTML = formatStopwatch(
      performance.now() - state.stopwatchStartTime,
    );
  }

  if (state.countdownRunning) {
    state.countdownRemaining = Math.max(
      0,
      state.countdownEndTime - performance.now(),
    );

    if (state.countdownRemaining <= 0) {
      state.countdownRemaining = 0;
      state.countdownRunning = false;
      state.countdownFinished = true;
      stopLoopIfIdle();
      updateUI();
      return;
    }

    if (state.mode === "countdown") {
      display.textContent = formatCountdown(state.countdownRemaining);
      updateProgress();
    }
  }

  if (state.rafId !== null) {
    state.rafId = requestAnimationFrame(onFrame);
  }
}

function runLoop() {
  if (state.rafId !== null) return;
  state.rafId = requestAnimationFrame(onFrame);
}

function stopLoopIfIdle() {
  const hasActiveTimer = state.stopwatchRunning || state.countdownRunning;
  if (hasActiveTimer) return;

  if (state.rafId !== null) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }
}

stopwatchModeBtn.addEventListener("click", () => switchMode("stopwatch"));
countdownModeBtn.addEventListener("click", () => switchMode("countdown"));

startPauseBtn.addEventListener("click", toggleStartPause);
resetBtn.addEventListener("click", resetCurrentMode);
lapBtn.addEventListener("click", addLap);

minutesInput.addEventListener("input", () => {
  if (!state.countdownRunning) updateCountdownFromInputs();
});

secondsInput.addEventListener("input", () => {
  if (!state.countdownRunning) updateCountdownFromInputs();
});

presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const minutes = Number(button.dataset.minutes || 0);
    minutesInput.value = minutes;
    secondsInput.value = 0;

    if (!state.countdownRunning) {
      updateCountdownFromInputs();
    }
  });
});

document.addEventListener("keydown", (event) => {
  const tag = document.activeElement?.tagName;
  const isTyping = tag === "INPUT" || tag === "TEXTAREA";

  if (event.code === "Space" && !isTyping) {
    event.preventDefault();
    toggleStartPause();
  }

  if ((event.key === "r" || event.key === "R") && !isTyping) {
    resetCurrentMode();
  }
});

renderLaps();
updateCountdownFromInputs();
switchMode("stopwatch");
