const runs = [
  { label: "40 Minuten Sitzen", durationMinutes: 40 },
  { label: "15 Minuten Stehen", durationMinutes: 15 },
];

const STORAGE_KEY = "alternatingTimerState";

const controlButton = document.getElementById("control-button");
const skipButton = document.getElementById("skip-button");
const runLabel = document.getElementById("run-label");
const timeRemaining = document.getElementById("time-remaining");
const addTimeButton = document.getElementById("add-time-button");
const subtractTimeButton = document.getElementById("subtract-time-button");
const completionSound = document.getElementById("completion-sound");
const exerciseCard = document.getElementById("exercise-card");
const exerciseBodyPart = document.getElementById("exercise-body-part");
const exerciseDuration = document.getElementById("exercise-duration");
const exerciseName = document.getElementById("exercise-name");
const exerciseRepetitions = document.getElementById("exercise-repetitions");
const exerciseDescription = document.getElementById("exercise-description");
const exerciseLoading = document.getElementById("exercise-loading");
const hydrationButtons = document.querySelectorAll("[data-hydration-button]");
const hydrationCountLabel = document.getElementById("hydration-count");

const ADJUSTMENT_STEP_SECONDS = 5 * 60;
const MIN_RUN_DURATION_SECONDS = 60;

const HYDRATION_STORAGE_KEY = "alternatingHydrationTracker";
const HYDRATION_ACTIVE_CLASSES = [
  "bg-indigo-400/80",
  "text-slate-900",
  "border-indigo-200",
  "shadow-indigo-500/30",
  "shadow-lg",
];
const HYDRATION_INACTIVE_CLASSES = [
  "bg-slate-900/40",
  "text-indigo-100",
  "border-indigo-200/30",
  "shadow-none",
];
const HYDRATION_VOLUME_ACTIVE_CLASSES = ["text-slate-900/90"];
const HYDRATION_VOLUME_INACTIVE_CLASSES = ["text-slate-400"];

let currentRunIndex = 0;
let remainingSeconds = runs[currentRunIndex].durationMinutes * 60;
let runAdjustmentSeconds = 0;
let timerId = null;
let isRunning = false;
let runStartedAt = null;
let exercises = [];
let lastExerciseId = null;
let hydrationState = [];

const sessionName = (index) => (index === 0 ? "Sitzphase" : "Stehphase");
const nextRunIndex = () => (currentRunIndex + 1) % runs.length;
const getCurrentDurationSeconds = () => {
  const baseSeconds = runs[currentRunIndex].durationMinutes * 60;
  return Math.max(MIN_RUN_DURATION_SECONDS, baseSeconds + runAdjustmentSeconds);
};

const formatSeconds = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
};

const resetRemainingForCurrentRun = () => {
  runAdjustmentSeconds = 0;
  remainingSeconds = getCurrentDurationSeconds();
  timeRemaining.textContent = formatSeconds(remainingSeconds);
};

const updateSkipButton = () => {
  skipButton.textContent = `Weiter zur ${sessionName(nextRunIndex())}`;
};

const persistRunState = () => {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }

    if (!isRunning || !runStartedAt) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        runIndex: currentRunIndex,
        startedAt: runStartedAt,
        adjustmentSeconds: runAdjustmentSeconds,
      })
    );
  } catch (error) {
    // Storage might be unavailable; ignore and continue.
  }
};

const updateRemainingFromStart = () => {
  const durationSeconds = getCurrentDurationSeconds();

  if (!runStartedAt) {
    remainingSeconds = durationSeconds;
  } else {
    const elapsedSeconds = Math.max(
      0,
      Math.floor((Date.now() - runStartedAt) / 1000)
    );
    remainingSeconds = Math.max(durationSeconds - elapsedSeconds, 0);
  }

  timeRemaining.textContent = formatSeconds(remainingSeconds);
};

const selectRandomExercise = () => {
  if (!exercises.length) {
    return null;
  }

  if (exercises.length === 1) {
    return exercises[0];
  }

  let candidate = exercises[Math.floor(Math.random() * exercises.length)];
  if (candidate.id === lastExerciseId) {
    candidate =
      exercises.find((exercise) => exercise.id !== lastExerciseId) || candidate;
  }
  return candidate;
};

const renderExercise = (exercise) => {
  if (!exercise) {
    exerciseCard.classList.add("hidden");
    exerciseLoading.classList.remove("hidden");
    exerciseLoading.textContent = "Keine Übungen verfügbar.";
    return;
  }

  exerciseBodyPart.textContent = exercise.bodyPart || "";
  exerciseDuration.textContent = exercise.durationSeconds
    ? `${exercise.durationSeconds} s`
    : "";
  exerciseName.textContent = exercise.name || "";
  exerciseRepetitions.textContent = exercise.repetitions
    ? `Wiederholungen: ${exercise.repetitions}`
    : "";
  exerciseDescription.textContent = exercise.description || "";

  exerciseCard.classList.remove("hidden");
  exerciseLoading.classList.add("hidden");
};

const showExerciseForCurrentRun = () => {
  if (!exercises.length) {
    renderExercise(null);
    return;
  }

  const exercise = selectRandomExercise();
  if (exercise) {
    lastExerciseId = exercise.id;
  }
  renderExercise(exercise);
};

const setIdleState = () => {
  isRunning = false;
  clearInterval(timerId);
  timerId = null;
  runStartedAt = null;
  const { label } = runs[currentRunIndex];
  runLabel.textContent = `Als Nächstes: ${label}`;
  controlButton.textContent = `${sessionName(currentRunIndex)} starten`;
  controlButton.disabled = false;
  updateSkipButton();
  persistRunState();
};

const updateRunningState = () => {
  const { label } = runs[currentRunIndex];
  runLabel.textContent = `Aktiv: ${label}`;
  controlButton.textContent = "Laufend …";
  controlButton.disabled = true;
  updateSkipButton();
};

const startTimerInterval = (preserveStart = false) => {
  clearInterval(timerId);

  if (!preserveStart) {
    runStartedAt = Date.now();
  }

  isRunning = true;
  updateRunningState();
  updateRemainingFromStart();
  timerId = setInterval(handleCountdownTick, 1000);
  persistRunState();
};

const playCompletionSound = () => {
  if (!completionSound) {
    return;
  }

  completionSound.currentTime = 0;
  completionSound.play().catch(() => {
    // Playback might be blocked until user interacts with the page again.
  });
};

const adjustCurrentRunDuration = (deltaSeconds) => {
  const baseDurationSeconds = runs[currentRunIndex].durationMinutes * 60;
  const targetDuration = Math.max(
    MIN_RUN_DURATION_SECONDS,
    baseDurationSeconds + runAdjustmentSeconds + deltaSeconds
  );
  const nextAdjustment = targetDuration - baseDurationSeconds;

  if (nextAdjustment === runAdjustmentSeconds) {
    return;
  }

  runAdjustmentSeconds = nextAdjustment;

  if (isRunning) {
    updateRemainingFromStart();

    if (remainingSeconds <= 0) {
      clearInterval(timerId);
      timerId = null;
      playCompletionSound();
      advanceRun();
      return;
    }
  } else {
    remainingSeconds = targetDuration;
    timeRemaining.textContent = formatSeconds(remainingSeconds);
  }

  persistRunState();
};

const advanceRun = () => {
  currentRunIndex = (currentRunIndex + 1) % runs.length;
  resetRemainingForCurrentRun();
  showExerciseForCurrentRun();
  setIdleState();
};

const handleCountdownTick = () => {
  updateRemainingFromStart();

  if (remainingSeconds <= 0) {
    clearInterval(timerId);
    timerId = null;
    playCompletionSound();
    advanceRun();
  }
};

const startRun = () => {
  if (isRunning) {
    return;
  }

  startTimerInterval();
};

const skipRun = () => {
  clearInterval(timerId);
  timerId = null;
  isRunning = false;
  currentRunIndex = (currentRunIndex + 1) % runs.length;
  resetRemainingForCurrentRun();
  showExerciseForCurrentRun();
  startTimerInterval();
};

const restoreRunFromStorage = () => {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return false;
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return false;
    }

    const parsed = JSON.parse(raw);
    const { runIndex, startedAt, adjustmentSeconds } = parsed;

    if (typeof runIndex !== "number" || typeof startedAt !== "number") {
      window.localStorage.removeItem(STORAGE_KEY);
      return false;
    }

    const storedRun = runs[runIndex];
    if (!storedRun) {
      window.localStorage.removeItem(STORAGE_KEY);
      return false;
    }

    const storedAdjustment = Number.isFinite(adjustmentSeconds)
      ? adjustmentSeconds
      : 0;
    const baseDurationSeconds = storedRun.durationMinutes * 60;
    const durationSeconds = Math.max(
      MIN_RUN_DURATION_SECONDS,
      baseDurationSeconds + storedAdjustment
    );
    const normalizedAdjustment = durationSeconds - baseDurationSeconds;
    const elapsedSeconds = Math.max(
      0,
      Math.floor((Date.now() - startedAt) / 1000)
    );

    if (elapsedSeconds >= durationSeconds) {
      currentRunIndex = (runIndex + 1) % runs.length;
      runAdjustmentSeconds = 0;
      runStartedAt = null;
      window.localStorage.removeItem(STORAGE_KEY);
      return false;
    }

    currentRunIndex = runIndex;
    runStartedAt = startedAt;
    runAdjustmentSeconds = normalizedAdjustment;
    showExerciseForCurrentRun();
    startTimerInterval(true);
    return true;
  } catch (error) {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch (_) {
      // Failed to access storage; nothing else to do.
    }
    return false;
  }
};

const embeddedExercises = {
  exercises: [
    {
      id: "neck_side_bend",
      name: "Nacken seitlich neigen",
      bodyPart: "Nacken",
      repetitions: "5 je Seite",
      durationSeconds: 30,
      description: "Kopf langsam zur Seite neigen, Schultern bleiben locker.",
    },
    {
      id: "neck_half_circle",
      name: "Nacken-Halbkreis",
      bodyPart: "Nacken",
      repetitions: "5",
      durationSeconds: 30,
      description:
        "Kopf langsam von einer Schulter zur anderen rollen, nicht nach hinten.",
    },
    {
      id: "shoulder_shrug",
      name: "Schultern hochziehen",
      bodyPart: "Schultern",
      repetitions: "10",
      durationSeconds: 20,
      description: "Schultern Richtung Ohren ziehen und locker fallen lassen.",
    },
    {
      id: "shoulder_circle",
      name: "Schulterkreisen",
      bodyPart: "Schultern",
      repetitions: "10 vor und zurück",
      durationSeconds: 30,
      description: "Große, langsame Kreise mit den Schultern.",
    },
    {
      id: "chest_open",
      name: "Brust öffnen",
      bodyPart: "Brust/Rücken",
      repetitions: "10–15 Sekunden",
      durationSeconds: 15,
      description: "Hände hinter dem Rücken verschränken und Brust öffnen.",
    },
    {
      id: "upper_back_round",
      name: "Oberer Rücken rund",
      bodyPart: "Rücken",
      repetitions: "5 Atemzüge",
      durationSeconds: 30,
      description: "Arme nach vorne strecken und Rücken rund machen.",
    },
    {
      id: "pelvic_tilt",
      name: "Becken kippen",
      bodyPart: "Wirbelsäule",
      repetitions: "10",
      durationSeconds: 30,
      description: "Becken im Stand vor- und zurückkippen.",
    },
    {
      id: "torso_rotation",
      name: "Oberkörperrotation",
      bodyPart: "Wirbelsäule",
      repetitions: "5 je Seite",
      durationSeconds: 30,
      description: "Oberkörper locker rotieren, Arme hängen lassen.",
    },
    {
      id: "hip_circle",
      name: "Hüftkreise",
      bodyPart: "Hüfte",
      repetitions: "5–10 je Richtung",
      durationSeconds: 40,
      description: "Becken langsam kreisen lassen.",
    },
    {
      id: "small_lunge",
      name: "Kleiner Ausfallschritt",
      bodyPart: "Hüfte",
      repetitions: "10 Sekunden je Seite",
      durationSeconds: 20,
      description: "Kleiner Ausfallschritt, Hüfte leicht nach vorne schieben.",
    },
    {
      id: "knee_bend",
      name: "Knie beugen und strecken",
      bodyPart: "Knie",
      repetitions: "10–15",
      durationSeconds: 30,
      description: "Knie locker beugen und wieder strecken.",
    },
    {
      id: "weight_shift",
      name: "Gewicht verlagern",
      bodyPart: "Knie/Beine",
      repetitions: "10",
      durationSeconds: 30,
      description: "Gewicht langsam von einem Bein auf das andere verlagern.",
    },
    {
      id: "ankle_raise",
      name: "Fußspitzen anheben",
      bodyPart: "Sprunggelenke",
      repetitions: "15",
      durationSeconds: 30,
      description: "Aufrechte Haltung, Fußspitzen anheben und senken.",
    },
    {
      id: "ankle_circle",
      name: "Fußgelenke kreisen",
      bodyPart: "Sprunggelenke",
      repetitions: "5 je Seite",
      durationSeconds: 30,
      description: "Fuß im Stand oder leicht angehoben kreisen.",
    },
  ],
};

const updateHydrationUI = () => {
  if (
    !hydrationButtons.length ||
    !hydrationCountLabel ||
    !hydrationState.length
  ) {
    return;
  }

  const consumed = hydrationState.filter(Boolean).length;
  hydrationCountLabel.textContent = `${consumed} / ${hydrationState.length} getrunken`;

  hydrationButtons.forEach((button, index) => {
    const isActive = Boolean(hydrationState[index]);
    button.setAttribute("aria-pressed", String(isActive));

    if (isActive) {
      button.classList.add(...HYDRATION_ACTIVE_CLASSES);
      button.classList.remove(...HYDRATION_INACTIVE_CLASSES);
    } else {
      button.classList.add(...HYDRATION_INACTIVE_CLASSES);
      button.classList.remove(...HYDRATION_ACTIVE_CLASSES);
    }

    const volumeLabel = button.querySelector(".hydration-volume");
    if (volumeLabel) {
      if (isActive) {
        volumeLabel.classList.add(...HYDRATION_VOLUME_ACTIVE_CLASSES);
        volumeLabel.classList.remove(...HYDRATION_VOLUME_INACTIVE_CLASSES);
      } else {
        volumeLabel.classList.add(...HYDRATION_VOLUME_INACTIVE_CLASSES);
        volumeLabel.classList.remove(...HYDRATION_VOLUME_ACTIVE_CLASSES);
      }
    }
  });
};

const persistHydrationState = () => {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }

    window.localStorage.setItem(
      HYDRATION_STORAGE_KEY,
      JSON.stringify(hydrationState)
    );
  } catch (_) {
    // Storage unavailable; ignore.
  }
};

const restoreHydrationState = () => {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return false;
    }

    const raw = window.localStorage.getItem(HYDRATION_STORAGE_KEY);
    if (!raw) {
      return false;
    }

    const parsed = JSON.parse(raw);
    const isValidArray =
      Array.isArray(parsed) &&
      parsed.length === hydrationState.length &&
      parsed.every((value) => typeof value === "boolean");

    if (!isValidArray) {
      window.localStorage.removeItem(HYDRATION_STORAGE_KEY);
      return false;
    }

    hydrationState = parsed.slice();
    updateHydrationUI();
    return true;
  } catch (_) {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(HYDRATION_STORAGE_KEY);
      }
    } catch (error) {
      // Nothing else to do.
    }
    return false;
  }
};

const toggleHydrationAt = (index) => {
  if (index < 0 || index >= hydrationState.length) {
    return;
  }

  hydrationState[index] = !hydrationState[index];
  updateHydrationUI();
  persistHydrationState();
};

const setupHydrationButtons = () => {
  if (!hydrationButtons.length || !hydrationCountLabel) {
    return;
  }

  hydrationState = Array.from({ length: hydrationButtons.length }, () => false);

  if (!restoreHydrationState()) {
    updateHydrationUI();
  }

  hydrationButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.hydrationIndex);
      if (Number.isNaN(index)) {
        return;
      }
      toggleHydrationAt(index);
    });
  });
};

exercises = Array.isArray(embeddedExercises.exercises)
  ? embeddedExercises.exercises
  : [];

setupHydrationButtons();

if (addTimeButton) {
  addTimeButton.addEventListener("click", () =>
    adjustCurrentRunDuration(ADJUSTMENT_STEP_SECONDS)
  );
}

if (subtractTimeButton) {
  subtractTimeButton.addEventListener("click", () =>
    adjustCurrentRunDuration(-ADJUSTMENT_STEP_SECONDS)
  );
}

controlButton.addEventListener("click", startRun);
skipButton.addEventListener("click", skipRun);

const restored = restoreRunFromStorage();

if (!restored) {
  if (!exercises.length) {
    renderExercise(null);
  } else {
    showExerciseForCurrentRun();
  }

  resetRemainingForCurrentRun();
  setIdleState();
}
