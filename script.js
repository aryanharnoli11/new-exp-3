// Utility to enable/disable Auto Connect and Check buttons with visual feedback
function setAutoCheckButtonsDisabled(disabled) {
  const autoConnectBtn = Array.from(document.querySelectorAll('.pill-btn')).find(btn => btn.textContent.trim() === 'Auto Connect');
  const checkBtn = Array.from(document.querySelectorAll('.pill-btn')).find(btn => btn.textContent.trim() === 'Check');
  [autoConnectBtn, checkBtn].forEach(btn => {
    if (btn) {
      btn.disabled = !!disabled;
      if (disabled) {
        btn.style.opacity = 0.75; // Less greyed out
        btn.style.cursor = 'not-allowed';
        btn.setAttribute('aria-disabled', 'true');
        btn.tabIndex = -1;
      } else {
        btn.style.opacity = 1;
        btn.style.cursor = '';
        btn.removeAttribute('aria-disabled');
        btn.tabIndex = 0;
      }
    }
  });
}
jsPlumb.ready(function () {
const WIRE_CURVINESS = 160;     // default curve
const WIRE_CURVE_SHAPE = "u";  // "u" = U-shaped wiring

// 🧠 WIRE GEOMETRY HELPERS
// ===============================
function getWireAnchorForShape(anchor) {
  if (!anchor || !Array.isArray(anchor)) return anchor;
  if (WIRE_CURVE_SHAPE !== "u") return anchor;

  const a = anchor.slice();
  a[2] = 0; // dx
  a[3] = 1; // dy (downward)
  return a;
}

function connectionKey(a, b) {
  return [a, b].sort().join("-");
}

const WIRE_CURVE_OVERRIDES = new Map([
  [connectionKey("pointA", "pointP"), 120],
  [connectionKey("pointB", "pointK"), 120],
  [connectionKey("pointB", "pointY"), 140],
  [connectionKey("pointB", "pointJ"), 160],
  [connectionKey("pointQ", "pointL"), 80],
  [connectionKey("pointG", "pointR"), 160],
  [connectionKey("pointE", "pointM"), -100],
  [connectionKey("pointF", "pointD"), 100],
  [connectionKey("pointH", "pointI"), 60],
  [connectionKey("pointI", "pointC"), -10],
  [connectionKey("pointC", "pointH"), -180]
]);

// 🎯 CURVE RESOLVER (YOU ASKED ABOUT THIS)
// ===============================
function getWireCurvinessForConnection(src, tgt) {
  const key = connectionKey(src, tgt);
  return WIRE_CURVE_OVERRIDES.get(key) ?? WIRE_CURVINESS;
}

let suppressAllAutoVoices = true;
let suppressGuideDuringAutoConnect = false;
let isAutoConnecting = false; // ✅ ADD THIS
// ================= SESSION TIMER =================
if (typeof window.sessionStart !== "number") {
  window.sessionStart = Date.now();
}



function resetSpeakButtonUI() {
  const speakBtn = document.querySelector(".speak-btn");
  if (!speakBtn) return;

  speakBtn.setAttribute("aria-pressed", "false");

  const label = speakBtn.querySelector(".speak-btn__label");
  if (label) {
    label.textContent = "Tap To Listen";
  }
}



// Stop any pending speech and reset UI
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.cancel();
}
resetSpeakButtonUI();

function pickPreferredVoice() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || !voices.length) return null;

  const englishVoices = voices.filter((voice) =>
    String(voice.lang || "").toLowerCase().startsWith("en")
  );

  const maleByGender = englishVoices.find(
    (voice) => String(voice.gender || "").toLowerCase() === "male"
  );
  if (maleByGender) return maleByGender;

  const maleNameHints = [
    /male/i,
    /ravi/i,
    /hemant/i,
    /david/i,
    /mark/i,
    /george/i,
    /daniel/i,
    /alex/i,
    /fred/i,
    /john/i,
    /james/i,
    /mike/i,
    /andrew/i,
    /tom/i,
    /steve/i,
    /roger/i
  ];
  const maleByName = englishVoices.find((voice) =>
    maleNameHints.some((hint) => hint.test(String(voice.name || "")))
  );
  if (maleByName) return maleByName;

  const enIndia = englishVoices.find((voice) =>
    String(voice.lang || "").toLowerCase().startsWith("en-in")
  );
  return enIndia || englishVoices[0] || voices[0];
}

function whenVoicesReady(callback) {
  if (!("speechSynthesis" in window)) return;

  const voices = window.speechSynthesis.getVoices();
  if (voices && voices.length) {
    callback();
    return;
  }

  const handler = () => {
    window.speechSynthesis.removeEventListener("voiceschanged", handler);
    callback();
  };
  window.speechSynthesis.addEventListener("voiceschanged", handler);
}

window.labSpeech = window.labSpeech || {};
window.labSpeech.enabled = true;
window.labSpeech.speak = function speak(text, options = {}) {
  if (!window.labSpeech.enabled) return Promise.resolve();
  if (
    typeof window === "undefined" ||
    !("speechSynthesis" in window) ||
    typeof window.SpeechSynthesisUtterance !== "function"
  ) {
    return Promise.resolve();
  }
  if (!text) return Promise.resolve();

  const opts = options || {};
  const shouldInterrupt = opts.interrupt !== false;

  return new Promise((resolve) => {
    whenVoicesReady(() => {
      if (shouldInterrupt) window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(String(text));
      const voice = pickPreferredVoice();
      if (voice) utterance.voice = voice;

      utterance.lang = (voice && voice.lang) || "en-US";
      utterance.rate = Number.isFinite(opts.rate) ? opts.rate : 0.85;
      utterance.pitch = Number.isFinite(opts.pitch) ? opts.pitch : 0.9;
      utterance.volume = Number.isFinite(opts.volume) ? opts.volume : 1;

      utterance.onend = () => {
        if (typeof opts.onend === "function") opts.onend();
        resolve();
      };
      utterance.onerror = () => {
        if (typeof opts.onend === "function") opts.onend();
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  });
};
window.labSpeech.stop = function stop() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
};
window.labSpeech.cancel =
  window.labSpeech.cancel ||
  function cancel() {
    window.labSpeech.stop();
  };
window.labSpeech.isActive = window.labSpeech.isActive || (() => false);
window.labSpeech.say =
  window.labSpeech.say ||
  function say(text) {
    if (!text) return Promise.resolve();
    return window.labSpeech.speak(text);
  };
window.labSpeech.sayLines =
  window.labSpeech.sayLines ||
  function sayLines(lines) {
    if (!Array.isArray(lines) || !lines.length) return Promise.resolve();
    const [first] = lines;
    if (!first) return Promise.resolve();
    return window.labSpeech.speak(first);
  };

function speakSafe(text) {
  if (!text) return;
  window.labSpeech.speak(text, { interrupt: true });
}
function speakOnlyIfGuideActive(text) {
  if (
    window.isGuideActive &&
    window.isGuideActive() &&
    window.labSpeech &&
    typeof window.labSpeech.speak === "function"
  ) {
    window.labSpeech.speak(text);
  }
}



  const requiredPairs = [
  "pointA-pointP",
  "pointB-pointK",
  "pointB-pointY",
  "pointB-pointJ",
  "pointQ-pointL",
  "pointG-pointR",
  "pointE-pointM",
  "pointF-pointD",
  "pointH-pointI",
  "pointI-pointC",
  "pointC-pointH"
];



const requiredConnections = new Set(
  requiredPairs.map(p => p.split("-").sort().join("-"))
);
function connectRequiredPair(pair) {
  const [a, b] = pair.split("-");
  const epA = jsPlumb.getEndpoint(a);
  const epB = jsPlumb.getEndpoint(b);

  if (!epA || !epB) {
    console.warn("Missing endpoint for", pair);
    return;
  }

  jsPlumb.connect({
    sourceEndpoint: epA,
    targetEndpoint: epB,
    connector: ["Bezier", {
  curviness: getWireCurvinessForConnection(a, b)
}],

    paintStyle: { strokeWidth: 4 }
  });
}




  /* =====================================================
     STATE
     ===================================================== */
  let connectionsAreCorrect = false;
  let isMCBOn = false;
  let starterIsOn = false;
  let allConnectionsAnnounced = false; // 🔊 voice only once
  let totalReadingsAdded = 0;
  let fiveReadingsAnnounced = false; // 🔊 announce only once
  let firstReadingGuided = false; 
  let connectionsAreVerified = false; // ✅ NEW FLAG
  const reportReadings = [];
  let labStage = "connections";
  let readingGuidanceActive = false;
  let addToTablePromptSpoken = false;
  let waitingForAddToTable = false;   // 🔑 NEW
  let tableGuidanceActive = false;   // 🔑 NEW
  let guideEverStarted = false;




  // ===== ROTOR STATE ====
let rotorAngle = 0;
let rotorInterval = null;

// ===== READINGS =====
let currentReading = 0;
let rpmReading = 0;

// ============================
// VOLTMETER CONTROL (FINAL)
// ============================

const voltmeterNeedle = document.querySelector(".meter-needle3");

const VOLT_0_ANGLE = -3;   // 0 Volt position
const VOLT_220_ANGLE = 70;  // 220 Volt position

// Set needle to 0V (NO animation)
function setVoltmeterZero() {
  if (!voltmeterNeedle) return;

  voltmeterNeedle.style.transition = "none";
  voltmeterNeedle.style.transform =
    `translate(-50%, -92%) rotate(${VOLT_0_ANGLE}deg)`;
}

// Move needle to 220V (WITH animation)
function setVoltmeterTo220() {
  if (!voltmeterNeedle) return;

  voltmeterNeedle.style.transition = "transform 0.8s ease-in-out";
  voltmeterNeedle.style.transform =
    `translate(-50%, -92%) rotate(${VOLT_220_ANGLE}deg)`;

if (rpmDisplay) rpmDisplay.textContent = "0";

  }




  // ===== Armature rheostat (nob2) state =====
let armatureKnobUsed = false;
let isAdjustingKnob2 = false;
let knob2StartX = 0;
let knob2StartLeft = 0;

// ===== FIELD RHEOSTAT (7 STEP CONTROL) =====
const knob1 = document.querySelector(".nob1");
const fieldRheostat = document.querySelector(".rheostat-img-1");
let FIELD_POSITIONS = [];
// ===== FIELD RHEOSTAT DRAG LOGIC (ADD HERE) =====
if (knob1) {
 knob1.addEventListener("mousedown", function (e) {

  if (!fieldKnobEnabled) {
    alert("Set armature resistance first");
    return;
  }

  isDraggingFieldKnob = true;
  fieldStartX = e.clientX;

  // ✅ CRITICAL FIX — sync starting index
  fieldStepIndex = FIELD_POSITIONS.indexOf(
    parseInt(knob1.style.left)
  );

  knob1.style.cursor = "grabbing";

  document.addEventListener("mousemove", dragFieldKnob);
  document.addEventListener("mouseup", stopFieldKnobDrag);

  e.preventDefault();
});

}

function dragFieldKnob(e) {
  if (!isDraggingFieldKnob) return;

  const deltaX = e.clientX - fieldStartX;

  const stepWidth =
    (FIELD_POSITIONS[FIELD_POSITIONS.length - 1] - FIELD_POSITIONS[0]) / 7;

let stepChange = Math.floor((deltaX + stepWidth / 2) / stepWidth);
let newIndex = fieldStepIndex + stepChange;


newIndex = Math.max(0, Math.min(7, newIndex));



  knob1.style.left = FIELD_POSITIONS[newIndex] + "px";
}

function stopFieldKnobDrag() {
  if (!isDraggingFieldKnob) return;

  isDraggingFieldKnob = false;
  document.removeEventListener("mousemove", dragFieldKnob);
  document.removeEventListener("mouseup", stopFieldKnobDrag);

  fieldStepIndex = FIELD_POSITIONS.indexOf(
    parseInt(knob1.style.left)
  );
  knob1.style.cursor = "grab";
    // ===== UPDATE AMMETER ON FIELD DIVISION CHANGE =====
// ===== FIELD RHEOSTAT RESULT =====
if (fieldStepIndex >= 1 && fieldStepIndex <= 7) {

  // CURRENT
  currentReading = FIELD_AMMETER_VALUES[fieldStepIndex];
  setAmmeterCurrent(currentReading);

  // RPM
  rpmReading = FIELD_RPM_VALUES[fieldStepIndex];
  if (rpmDisplay) rpmDisplay.textContent = rpmReading;
  if (window.isGuideActive && window.isGuideActive() && !waitingForAddToTable) {
  waitingForAddToTable = true;
  tableGuidanceActive = true;

speakSafe(
  `Field resistance set. Current is ${currentReading.toFixed(2)} ampere and speed is ${rpmReading} R P M.
   Now click on add to table button to add readings in observation table.`
);

}





  // ROTOR
  startRotorRotation();

} else {
  // 🔴 FIELD AT ZERO POSITION

  // Stop rotor
  stopRotorRotation();
  rotorAngle = 0;

  const rotor = document.getElementById("gr");
  if (rotor) rotor.style.transform = "rotate(0deg)";

  // Reset RPM
  rpmReading = 0;
  if (rpmDisplay) rpmDisplay.textContent = "0";

  // Reset ammeter
  currentReading = 0;
  setAmmeterCurrent(0);
}


}
const rpmDisplay = document.getElementById("rpmDisplay");




let fieldStepIndex = 0;
let fieldKnobEnabled = false;
let isDraggingFieldKnob = false;
let fieldStartX = 0;
let fieldStartLeft = 0;


// Adjust these two values ONCE to match rod ends
const ARM_ROD_MIN_X = 20;   // left end of green coil
const ARM_ROD_MAX_X = 210;  // right end of green coil

  const mcbImg = document.getElementById("mcbToggle");
  const starterHandle = document.querySelector(".starter-handle");
  const resetBtn = document.getElementById("resetBtn");
  const knob2 = document.getElementById("nob2");
  const addTableBtn = document.getElementById("addTableBtn");
  const observationBody = document.getElementById("observationBody");
  const obsCurrentInput = document.getElementById("obsCurrent");
  const obsSpeedInput = document.getElementById("obsSpeed");
  const reportBtn = document.getElementById("reportBtn");


// ===== AMMETER CONTROL =====
const ammeterNeedle = document.querySelector(".meter-needle1");


// Ammeter angles for each field rheostat division (index 1 → 7)
const FIELD_AMMETER_VALUES = [
  null,   // index 0 (reference, not counted)
  0.48,   // division 1
  0.44,   // division 2
  0.40,   // division 3
  0.38,   // division 4
  0.32,   // division 5
  0.30,   // division 6
  0.28    // division 7
];

const FIELD_RPM_VALUES = [
  null,   // index 0 (not used)
  1100,   // division 1
  1130,   // division 2
  1153,   // division 3
  1192,    // division 4
  1222,    // division 5
  1263,    // division 6
  1312     // division 7
];
// ===== VISUAL ROTOR SPEED PER FIELD DIVISION =====
const FIELD_ROTATION_SPEED = [
  null,  // index 0 not used
  3,   // Division 1 → very slow
  5,   // Division 2
  7,   // Division 3
  9,   // Division 4
  11,   // Division 5
  15,   // Division 6
  17.0   // Division 7 → fastest
];

function startRotorRotation() {

  const rotor = document.getElementById("gr");
  if (!rotor) return;

  const speed = FIELD_ROTATION_SPEED[fieldStepIndex];
  if (!speed) return;

  stopRotorRotation();

  rotorInterval = setInterval(() => {
    rotorAngle += speed;
    rotor.style.transform = `rotate(${rotorAngle}deg)`;
  }, 1000 / 60);
}


function stopRotorRotation() {
  if (rotorInterval) {
    clearInterval(rotorInterval);
    rotorInterval = null;
  }
}

// Map current (0–0.5A) to needle angle (adjust if needed)
function setAmmeterCurrent(current) {
  if (!ammeterNeedle) return;

  // Clamp safety
  current = Math.max(0, Math.min(1, current));

  const MIN_ANGLE = -70; // 0 A
  const MAX_ANGLE = 70;  // 1 A

  const angle =
    MIN_ANGLE + (current * (MAX_ANGLE - MIN_ANGLE));

  ammeterNeedle.style.transition = "transform 0.4s ease-in-out";
  ammeterNeedle.style.transform =
    `translate(-60%, -90%) rotate(${angle}deg)`;
}





  /* =====================================================
     STARTER SEMICIRCLE CONFIG (DO NOT CHANGE)
     ===================================================== */
  const START_LEFT = 16.67;
  const END_LEFT = 68;
  const BASE_TOP = 37.04;
  const ARC_HEIGHT = 15;

  let isDragging = false;
  let dragStartX = 0;

  function updateStarterPosition(t) {
    if (!starterHandle) return;
    const left = START_LEFT + t * (END_LEFT - START_LEFT);
    const top = BASE_TOP - ARC_HEIGHT * Math.sin(t * Math.PI);
    starterHandle.style.left = left + "%";
    starterHandle.style.top = top + "%";
  }

  /* =====================================================
     INITIAL STARTER STATE
     ===================================================== */
  if (starterHandle) {
    updateStarterPosition(0);
    starterHandle.classList.add("disabled");
  }

  /* =====================================================
     STARTER DRAG LOGIC
     ===================================================== */
  if (starterHandle) {
    starterHandle.addEventListener("mousedown", function (e) {
// 🚫 Starter already ON → do nothing
  if (starterIsOn) {
    e.preventDefault();
    return;
  }
      if (!connectionsAreCorrect) {
        alert("Complete connections first");
        return;
      }
      if (!isMCBOn) {
        alert("Turn ON MCB first");
        return;
      }

      isDragging = true;
      dragStartX = e.clientX;
      starterHandle.style.cursor = "grabbing";

      document.addEventListener("mousemove", dragStarter);
      document.addEventListener("mouseup", stopDragStarter);
      e.preventDefault();
    });
  }

  function dragStarter(e) {
    if (!isDragging || !starterHandle) return;

    const deltaX = e.clientX - dragStartX;
    const parentWidth = starterHandle.parentElement.offsetWidth;

    let t = deltaX / parentWidth;
    t = Math.max(0, Math.min(1, t));

    updateStarterPosition(t);
  }

  function stopDragStarter() {
    if (!isDragging || !starterHandle) return;

    isDragging = false;
    document.removeEventListener("mousemove", dragStarter);
    document.removeEventListener("mouseup", stopDragStarter);

    const currentLeft = parseFloat(starterHandle.style.left);
    const t = (currentLeft - START_LEFT) / (END_LEFT - START_LEFT);

    if (t > 0.5) {
      updateStarterPosition(1);
      starterIsOn = true;
      labStage = "starter_on";
if (window.isGuideActive && window.isGuideActive()) {
  labSpeech.speak(
    "Starter is on. Now set the armature resistance."
  );
}

    } else {
      updateStarterPosition(0);
      starterIsOn = false;
    }

    starterHandle.style.cursor = "pointer";

    // Field knob disabled at start
if (knob1) {
  knob1.style.cursor = "not-allowed";
}

  }
/* =====================================================
   ARMATURE RHEOSTAT (nob2) SLIDER LOGIC
   ===================================================== */
if (knob2) {
  knob2.addEventListener("mousedown", function (e) {

    // Starter must be ON
    if (!starterIsOn) {
      alert("Turn ON starter first");
      return;
    }

    // Allow only once
    if (armatureKnobUsed) {
      alert("Armature resistance already set");
      return;
    }

    isAdjustingKnob2 = true;
    knob2StartX = e.clientX;
    knob2StartLeft = knob2.offsetLeft;

    knob2.style.cursor = "grabbing";

    document.addEventListener("mousemove", dragArmatureKnob);
    document.addEventListener("mouseup", stopArmatureKnob);

    e.preventDefault();
  });
}
function dragArmatureKnob(e) {
  if (!isAdjustingKnob2) return;

  const deltaX = e.clientX - knob2StartX;
  let newLeft = knob2StartLeft + deltaX;

  // Limit movement to rheostat rod
  newLeft = Math.max(ARM_ROD_MIN_X, Math.min(ARM_ROD_MAX_X, newLeft));

  knob2.style.left = newLeft + "px";
}
function calculateFieldPositions() {
  if (!knob1 || !fieldRheostat) return;

  const knobWidth = knob1.offsetWidth;

  // ✅ GREEN COIL LIMITS (adjust ONLY these if needed)
  const GREEN_START = 23;
  const GREEN_END = 230;

  const minX = GREEN_START;
  const maxX = GREEN_END - knobWidth;

  FIELD_POSITIONS = [];

  for (let i = 0; i < 8; i++) {
    const pos = minX + (i * (maxX - minX)) / 7;
    FIELD_POSITIONS.push(Math.round(pos));
  }

  knob1.style.left = FIELD_POSITIONS[0] + "px";
  knob1.style.cursor = "not-allowed";
}

function stopArmatureKnob() {

  if (!isAdjustingKnob2) return;

  isAdjustingKnob2 = false;

  document.removeEventListener("mousemove", dragArmatureKnob);
  document.removeEventListener("mouseup", stopArmatureKnob);

  armatureKnobUsed = true;
  knob2.style.cursor = "not-allowed";
  setVoltmeterTo220();
  labStage = "armature_set";
  alert("Armature resistance set");
if (window.isGuideActive && window.isGuideActive()) {
  labSpeech.speak(
    "Armature resistance set and the voltage is 220 volt. Now adjust the field resistance knob to take readings."
  );
}

  fieldKnobEnabled = true;
}


  /* =====================================================
     MCB LOGIC
     ===================================================== */
  if (mcbImg) {
    mcbImg.style.cursor = "pointer";

    mcbImg.addEventListener("click", function () {

      if (isMCBOn) {
        // ===== TURN MCB OFF =====
        isMCBOn = false;
        starterIsOn = false;
        armatureKnobUsed = false;
        mcbImg.src = "images/mcb-off.png";
        // Reset starter
        if (starterHandle) {
          updateStarterPosition(0);
          starterHandle.classList.add("disabled");
        }
        // Stop rotor
        stopRotorRotation();
        rotorAngle = 0;
        const rotor = document.getElementById("gr");
        if (rotor) rotor.style.transform = "rotate(0deg)";
        // 🔴 RESET METERS (THIS IS THE FIX)
        currentReading = 0;
        rpmReading = 0;
        setAmmeterCurrent(0);          // Ammeter → 0 A
        if (rpmDisplay) rpmDisplay.textContent = "0"; // RPM → 0
        // Reset voltmeter too (safe)
        setVoltmeterZero();
        setLabelButtonsDisabled(false); // <-- Re-enable label buttons
        setAutoCheckButtonsDisabled(false); // <-- Re-enable Auto Connect and Check buttons
        return; // 🚨 VERY IMPORTANT
      }

      // ❌ No wires at all
// ❌ No wires at all
if (!connectionsAreCorrect) {
  alert("Please complete the connections first");
  setVoltmeterZero();
  return;
}

// ❌ Wires exist but NOT verified
if (!connectionsAreVerified) {
  alert("Please click on the Check button to confirm the connections");
  setVoltmeterZero();
  return;



        stopRotorRotation();
rotorAngle = 0;

const rotor = document.getElementById("gr");
if (rotor) rotor.style.transform = "rotate(0deg)";

      }
// Reset armature rheostat
armatureKnobUsed = false;
if (knob2) {
  knob2.style.left = ARM_ROD_MIN_X + "px";
  knob2.style.cursor = "pointer";
}

      // TURN ON
      isMCBOn = true;
      mcbImg.src = "images/mcb-on.png";
      setLabelButtonsDisabled(true); // <-- Disable label buttons
      setAutoCheckButtonsDisabled(true); // <-- Disable Auto Connect and Check buttons
      // 🔊 GUIDED VOICE (ONLY IF GUIDE IS ACTIVE)
      labStage = "dc_on";
      if (window.isGuideActive && window.isGuideActive()) {
        labSpeech.speak(
          "D C supply is turned on. Now turn on the starter by moving the handle from left to right."
        );
      }
      if (starterHandle) {
        starterHandle.classList.remove("disabled");
      }
    });
  }

  /* =====================================================
     jsPlumb ENDPOINTS
     ===================================================== */
  const ringSvg =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26">
        <circle cx="13" cy="13" r="12" fill="black"/>
        <circle cx="13" cy="13" r="9" fill="#ba8d5f"/>
        <circle cx="13" cy="13" r="6" fill="black"/>
      </svg>
    `);

  const baseEndpointOptions = {
    endpoint: ["Image", { url: ringSvg, width: 26, height: 26 }],
    isSource: true,
    isTarget: true,
    maxConnections: -1,
connector: ["Bezier", { curviness: WIRE_CURVINESS }]
  };

  const container = document.querySelector(".top-row");
  if (container) jsPlumb.setContainer(container);

  // Keep endpoints/wires glued to their elements on zoom/resize
  const repaintPlumb = () => jsPlumb.repaintEverything();
  window.addEventListener("resize", repaintPlumb);

  if (container && "ResizeObserver" in window) {
    const observer = new ResizeObserver(repaintPlumb);
    observer.observe(container);
  }

  const anchors = {
    pointA: [1, 0.5, 1, 0],
    pointB: [0, 0.5, -1, 0],

    pointP: [0, 0.5, -1, 0],
    pointQ: [0, 0.5, -1, 0],
    pointR: [0, 0.5, -1, 0],

    pointI: [0, 0.5, -1, 0],
    pointJ: [0, 0.5, -1, 0],
    pointL: [0, 0.5, -1, 0],
    pointM: [0, 0.5, -1, 0],

    pointC: [0, 0.5, -1, 0],
    pointD: [0, 0.5, -1, 0],

    pointK: [0, 0.5, -1, 0],
    pointY: [0, 0.5, -1, 0],

    pointE: [0, 0.5, -1, 0],
    pointF: [0, 0.5, -1, 0],

    pointG: [0, 0.5, -1, 0],
    pointH: [0, 0.5, -1, 0]
  };

  Object.keys(anchors).forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    const isLeft = anchors[id][0] === 0;
    jsPlumb.addEndpoint(el, {
      anchor: getWireAnchorForShape(anchors[id])
,
      uuid: id
    }, {
      ...baseEndpointOptions,
      connectorStyle: {
        stroke: isLeft ? "blue" : "red",
        strokeWidth: 4
      }
    });
  });

jsPlumb.bind("connection", function (info) {

  const curviness = getWireCurvinessForConnection(
  info.sourceId,
  info.targetId
);

info.connection.setConnector(
  ["Bezier", { curviness }]
);


  const isLeft = anchors[info.sourceId]?.[0] === 0;
  info.connection.setPaintStyle({
    stroke: isLeft ? "blue" : "red",
    strokeWidth: 4
  });

  // 🚫 DO NOT EVEN SCHEDULE voice during auto connect
  if (isAutoConnecting) return;

  setTimeout(announceIfAllConnectionsDone, 100);
});

const buttonToEndpointMap = {
  "point-A": "pointA",
  "point-B": "pointB",

  "point-P": "pointP",
  "point-Q": "pointQ",
  "point-R": "pointR",

  "point-I": "pointI",
  "point-J": "pointJ",
  "point-L": "pointL",
  "point-M": "pointM",

  "point-C": "pointC",
  "point-D": "pointD",

  "point-K": "pointK",
  "point-Y": "pointY",

  "point-E": "pointE",
  "point-F": "pointF",

  "point-G": "pointG",
  "point-H": "pointH"
};
function removeConnectionsOfEndpoint(endpointUUID) {

  // Remove connections where endpoint is SOURCE
  jsPlumb.getConnections({ source: endpointUUID })
    .forEach(conn => jsPlumb.deleteConnection(conn));

  // Remove connections where endpoint is TARGET
  jsPlumb.getConnections({ target: endpointUUID })
    .forEach(conn => jsPlumb.deleteConnection(conn));

  jsPlumb.repaintEverything();
  allConnectionsAnnounced = false;

}

// --- Restrict label click when MCB is ON ---
Object.keys(buttonToEndpointMap).forEach(buttonClass => {
  const button = document.querySelector("." + buttonClass);
  if (!button) return;

  button.addEventListener("click", function (e) {
    if (isMCBOn) {
      // Ignore click if MCB is ON
      e.stopPropagation();
      return;
    }
    e.stopPropagation(); // important

    const endpointUUID = buttonToEndpointMap[buttonClass];
    removeConnectionsOfEndpoint(endpointUUID);

    // Once a wire is removed, system is no longer correct
    connectionsAreCorrect = false;
    connectionsAreVerified = false;
    starterIsOn = false;

    // If MCB was ON, turn it OFF (should not happen here, but keep for safety)
    if (isMCBOn) {
      isMCBOn = false;
      mcbImg.src = "images/mcb-off.png";
      if (starterHandle) {
        updateStarterPosition(0);
        starterHandle.classList.add("disabled");
      }
    }
  });
});

// Add visual feedback: disable label buttons when MCB is ON
function setLabelButtonsDisabled(disabled) {
  Object.keys(buttonToEndpointMap).forEach(buttonClass => {
    const button = document.querySelector("." + buttonClass);
    if (button) {
      if (disabled) {
        button.setAttribute("aria-disabled", "true");
        button.style.pointerEvents = "none";
      } else {
        button.removeAttribute("aria-disabled");
        button.style.pointerEvents = "auto";
      }
    }
  });
}

  /* =====================================================
     CHECK CONNECTIONS
     ===================================================== */
const checkBtn = Array.from(
  document.querySelectorAll(".pill-btn")
).find(btn => btn.textContent.trim() === "Check");

if (checkBtn) {
  let missingConnectionsQueue = [];
  let isGuidingMissing = false;
  checkBtn.addEventListener("click", function () {
    // Gather all missing connections
    const currentConnections = jsPlumb.getAllConnections();
    const currentSet = new Set(
      currentConnections.map(conn => [conn.sourceId, conn.targetId].sort().join("-"))
    );
    missingConnectionsQueue = [];
    for (let req of requiredConnections) {
      if (!currentSet.has(req)) missingConnectionsQueue.push(req);
    }
    // Extra/wrong connections
    for (let cur of currentSet) {
      if (!requiredConnections.has(cur)) {
        const [a, b] = cur.split("-");
        alert(`Wrong connection ❌: ${a.replace("point","")} → ${b.replace("point","")}`);
        return;
      }
    }
    // If all correct
    if (missingConnectionsQueue.length === 0) {
      connectionsAreCorrect = true;
      connectionsAreVerified = true;
      labStage = "checked";
      alert("Connections are correct ✅");
      // Voice confirmation
      if (window.isGuideActive && window.isGuideActive()) {
        labSpeech.speak("The connections are correct. Now you can turn on the D C supply.");
      }
      // Remove any highlights
      document.querySelectorAll('.endpoint-highlight').forEach(el => el.classList.remove('endpoint-highlight'));
      return;
    }
    // Sequential guidance for missing connections
    let guidingIndex = 0;
    isGuidingMissing = true;
    function guideNextMissing() {
      if (!isGuidingMissing || guidingIndex >= missingConnectionsQueue.length) return;
      const [a, b] = missingConnectionsQueue[guidingIndex].split("-");
      // Remove previous highlights
      document.querySelectorAll('.endpoint-highlight').forEach(el => el.classList.remove('endpoint-highlight'));
      // Highlight endpoints
      const elA = document.getElementById(a);
      const elB = document.getElementById(b);
      if (elA) elA.classList.add('endpoint-highlight');
      if (elB) elB.classList.add('endpoint-highlight');
      // Show default alert popup
      const msg = `Missing connection: ${a.replace("point","")} → ${b.replace("point","")}`;
      alert(msg);
      // Voice guidance
      if (window.isGuideActive && window.isGuideActive()) {
        labSpeech.speak(`Connection between ${a.replace("point","")} and ${b.replace("point","")} is missing.`);
      }
    }
    guideNextMissing();
    // Listen for connection events to check if user fixed the current missing connection
    jsPlumb.bind("connection", function checkMissingFix(info) {
      if (!isGuidingMissing) return;
      const fixedKey = [info.sourceId, info.targetId].sort().join("-");
      if (fixedKey === missingConnectionsQueue[guidingIndex]) {
        // Remove highlight and popup
        document.querySelectorAll('.endpoint-highlight').forEach(el => el.classList.remove('endpoint-highlight'));
        // No custom popup to remove
        guidingIndex++;
        // If more missing, guide next
        if (guidingIndex < missingConnectionsQueue.length) {
          guideNextMissing();
        } else {
          isGuidingMissing = false;
          // All missing connections are now completed
          if (window.isGuideActive && window.isGuideActive()) {
            labSpeech.speak("Now all the missing connections are completed, now click on the check button to confirm the connection.");
          }
        }
      }
    });
  });
}
// Add CSS for endpoint highlight only
const style = document.createElement('style');
style.innerHTML = `
.endpoint-highlight {
  animation: endpointPulse 1.2s cubic-bezier(.4,0,.2,1) infinite;
  box-shadow: 0 0 0 4px rgba(255,0,0,0.25), 0 0 12px 4px rgba(255,0,0,0.18);
  border-radius: 50% !important;
  z-index: 1000 !important;
}
@keyframes endpointPulse {
  0% { box-shadow: 0 0 0 4px rgba(255,0,0,0.25), 0 0 12px 4px rgba(255,0,0,0.18); }
  50% { box-shadow: 0 0 0 10px rgba(255,0,0,0.45), 0 0 24px 8px rgba(255,0,0,0.25); }
  100% { box-shadow: 0 0 0 4px rgba(255,0,0,0.25), 0 0 12px 4px rgba(255,0,0,0.18); }
}
`;
document.head.appendChild(style);

function validateConnections() {
  const currentConnections = jsPlumb.getAllConnections();

  const currentSet = new Set(
    currentConnections.map(conn =>
      [conn.sourceId, conn.targetId].sort().join("-")
    )
  );

  // 1️⃣ Check for missing required connections
  for (let req of requiredConnections) {
    if (!currentSet.has(req)) {
      return {
        status: "missing",
        connection: req
      };
    }
  }

  // 2️⃣ Check for extra / wrong connections
  for (let cur of currentSet) {
    if (!requiredConnections.has(cur)) {
      return {
        status: "wrong",
        connection: cur
      };
    }
  }

  // 3️⃣ All correct
  return {
    status: "correct"
  };
}


function announceIfAllConnectionsDone() {
  if (isAutoConnecting) return;          // ✅ BLOCK AUTO CONNECT
  if (allConnectionsAnnounced) return;
  if (suppressAllAutoVoices) return;


  const result = validateConnections();
  if (result.status === "correct") {
    allConnectionsAnnounced = true;
    // labSpeech.speak(
    //   "All connections are completed. Now click on the Check button to confirm the connection."
    // );
  }
}




const autoConnectBtn = Array.from(
  document.querySelectorAll(".pill-btn")
).find(btn => btn.textContent.trim() === "Auto Connect");

if (autoConnectBtn) {
  autoConnectBtn.addEventListener("click", function () {
isAutoConnecting = true; // ✅ ADD THIS LINE

    // 🔒 BLOCK ALL AUTO VOICE
 
    suppressGuideDuringAutoConnect = false;

  const guideWasActive =
  window.isGuideActive && window.isGuideActive();

// Stop current speech only
if (window.labSpeech) labSpeech.stop();

// ❌ DO NOT reset button UI if guide was active
if (!guideWasActive) {
  resetSpeakButtonUI();
}


    // Remove existing wires
    if (typeof jsPlumb.deleteEveryConnection === "function") {
      jsPlumb.deleteEveryConnection();
    } else {
      jsPlumb.getAllConnections().forEach(c => jsPlumb.deleteConnection(c));
    }

    // Create required connections
    requiredPairs.forEach(pair => connectRequiredPair(pair));

    jsPlumb.repaintEverything();
    connectionsAreCorrect = true;        // wires exist
    connectionsAreVerified = false;      // ❌ user has NOT clicked Check


setTimeout(() => {
  suppressAllAutoVoices = false;
  suppressGuideDuringAutoConnect = false;
  isAutoConnecting = false;

  allConnectionsAnnounced = false;

  // ✅ IF GUIDE WAS ACTIVE → KEEP IT ACTIVE
  if (guideWasActive && window.isGuideActive && window.isGuideActive()) {
    // UI already ON, just continue guidance naturally
    // (no restart, no reset)
  }
}, 0);


  });
}



  /* =====================================================
     OBSERVATION TABLE
     ===================================================== */
  function resetObservationTable() {
    if (observationBody) {
      observationBody.innerHTML = `
        <tr class="placeholder-row">
          <td colspan="3">No readings added yet.</td>
        </tr>
      `;
    }
    if (obsCurrentInput) obsCurrentInput.value = "";
    if (obsSpeedInput) obsSpeedInput.value = "";
  }

function addObservationRow() {
  waitingForAddToTable = false;
tableGuidanceActive = false;


  if (currentReading === 0 || rpmReading === 0) {
    alert("Set field resistance to get readings first");
    return;
  }

  // ===== DUPLICATE CHECK =====
  const rows = observationBody.querySelectorAll("tr");
  for (let row of rows) {
    const cells = row.querySelectorAll("td");
    if (cells.length === 3) {
      if (
        parseFloat(cells[1].textContent) === parseFloat(currentReading.toFixed(2)) &&
        parseInt(cells[2].textContent) === rpmReading
      ) {
        alert("This reading is already added");
        return;
      }
    }
  }

  // Remove placeholder row
  const placeholder = observationBody.querySelector(".placeholder-row");
  if (placeholder) placeholder.remove();

  const serial = observationBody.querySelectorAll("tr").length + 1;

  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${serial}</td>
    <td>${currentReading.toFixed(2)}</td>
    <td>${rpmReading}</td>
  `;
  observationBody.appendChild(row);
addGraphReading(currentReading, rpmReading);
reportReadings.push({
  current: parseFloat(currentReading.toFixed(2)),
  speed: rpmReading
});
// ✅ INCREASE COUNT
totalReadingsAdded++;
}

if (addTableBtn) {
  addTableBtn.addEventListener("click", function () {
    speechSynthesis.cancel();  // Keep this for gesture context

    const beforeCount = totalReadingsAdded;
    addObservationRow();

    if (totalReadingsAdded === beforeCount) return;

    // 🔊 Speak ONLY if guide active
    if (window.isGuideActive && window.isGuideActive()) {
      const text = totalReadingsAdded === 5
        ? "Five readings are added. Now you can plot the graph."
        : "Reading added. Now vary the field resistance to take further readings.";

      speakSafe(text);  // Use speakSafe for consistency
    }
  });
}
  
  /* =====================================================
     RESET
     ===================================================== */
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {

      // 🔴 STOP ALL SPEECH IMMEDIATELY
if (window.labSpeech) {
  labSpeech.stop();
}
speechSynthesis.cancel();
resetSpeakButtonUI();

      if (typeof jsPlumb.deleteEveryConnection === "function") {
        jsPlumb.deleteEveryConnection();
      } else {
        jsPlumb.getAllConnections().forEach(c => jsPlumb.deleteConnection(c));
      }

      jsPlumb.repaintEverything();

      connectionsAreCorrect = false;
      connectionsAreVerified = false; // ✅ ADD

      isMCBOn = false;
      starterIsOn = false;

      if (mcbImg) mcbImg.src = "images/mcb-off.png";

      if (starterHandle) {
        updateStarterPosition(0);
        starterHandle.classList.add("disabled");
      }
      // Reset armature rheostat
armatureKnobUsed = false;
if (knob2) {
  knob2.style.left = ARM_ROD_MIN_X + "px";
  knob2.style.cursor = "pointer";
}
setVoltmeterZero();
      resetObservationTable();
      totalReadingsAdded = 0;
      reportReadings.length = 0;
      fiveReadingsAnnounced = false; 
      totalReadingsAdded = 0;
      waitingForAddToTable = false;
      tableGuidanceActive = false;
      setAutoCheckButtonsDisabled(false);  // ← THIS IS THE KEY LINE
    setLabelButtonsDisabled(false);
      setAmmeterCurrent(0);
stopRotorRotation();
rotorAngle = 0;
if (rpmDisplay) rpmDisplay.textContent = "0"; // RPM → 0




const rotor = document.getElementById("gr");
if (rotor) rotor.style.transform = "rotate(0deg)";

    });
  }
// Voltmeter must ALWAYS start at 0V
setVoltmeterZero();
setTimeout(calculateFieldPositions, 100);
setAmmeterCurrent(0);
allConnectionsAnnounced = false;


// ===== RESET FIELD RHEOSTAT =====
fieldKnobEnabled = false;
fieldStepIndex = 0;

if (knob1) {
  knob1.style.left = FIELD_POSITIONS[0] + "px";
  knob1.style.cursor = "not-allowed";
}
stopRotorRotation();
rotorAngle = 0;

const rotor = document.getElementById("gr");
if (rotor) rotor.style.transform = "rotate(0deg)";
if (rpmDisplay) rpmDisplay.textContent = "0";


// 🔴 RESET RPM DISPLAY
rpmReading = 0;
if (rpmDisplay) rpmDisplay.textContent = "0";


// ================= REPORT GENERATOR =================
 function generateReport() {


  if (reportReadings.length < 5) {
    alert("Please take at least 5 readings to generate the report.");
    return;
  }

  const startTime = new Date(window.sessionStart);
  const endTime = new Date();
  const durationMinutes =
    Math.round(((endTime - window.sessionStart) / 60000) * 10) / 10;

  const currents = reportReadings.map(r => r.current);
  const speeds = reportReadings.map(r => r.speed);

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Virtual Lab Simulation Report</title>
<script src="https://cdn.plot.ly/plotly-3.0.1.min.js"></script>

<style>
body {
  font-family: "Segoe UI", Arial, sans-serif;
  background: #f3f6fb;
  padding: 25px;
}

.report-wrapper {
  max-width: 1050px;
  margin: auto;
  background: #ffffff;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.08);
}

.report-title {
  font-size: 28px;
  font-weight: 600;
}

.title-line {
  height: 3px;
  width: 100%;
  background: #2f6df6;
  margin: 14px 0 28px;
}

.card {
  background: #f8fbff;
  border-radius: 14px;
  padding: 22px;
  margin-bottom: 26px;
  border: 1px solid #e4ecfb;
}

.badge {
  display: inline-block;
  background: #eaf1ff;
  color: #2f6df6;
  padding: 6px 14px;
  border-radius: 999px;
  font-weight: 500;
  margin-bottom: 14px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 14px;
}

.info-box {
  background: white;
  border-radius: 12px;
  padding: 14px;
  border: 1px solid #e2e9f8;
}

h3 {
  margin-top: 0;
  font-size: 20px;
}

.section-title {
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 12px;
}

.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
}

ul {
  margin: 8px 0;
  padding-left: 20px;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 16px;
}

th {
  background: linear-gradient(90deg, #2f6df6, #1f57d8);
  color: white;
  padding: 14px;
}

td {
  padding: 12px;
  border-bottom: 1px solid #e6ecfa;
  text-align: center;
}

tr:nth-child(even) td {
  background: #fbfdff;
}

.graph-box {
  height: 360px;
}

.print-btn {
  background: #2f6df6;
  color: white;
  border: none;
  padding: 10px 26px;
  font-size: 14px;
  border-radius: 22px;
  cursor: pointer;
}
</style>
</head>

<body>

<div class="report-wrapper">

  <div class="report-title">Virtual Lab Simulation Report</div>
  <div class="title-line"></div>

  <!-- EXPERIMENT INFO -->
  <div class="card">
    <div class="badge">DC Machines Lab</div>

    <p><b>Experiment Title:</b> Speed Control of DC Shunt Motor</p>
    <p><b>Date:</b> ${new Date().toLocaleDateString()}</p>

    <div class="info-grid">
      <div class="info-box"><b>Start Time</b><br>${startTime.toLocaleTimeString()}</div>
      <div class="info-box"><b>End Time</b><br>${endTime.toLocaleTimeString()}</div>
      <div class="info-box"><b>Total Time Spent</b><br>${durationMinutes} minutes</div>
    </div>
  </div>

  <!-- SUMMARY -->
  <div class="card">
    <div class="section-title">Summary</div>

    <p><b>Aim</b></p>
    <p>
      The aim was to study the speed control of DC Motor by field resistance control and to plot the graph between the field current and motor speed by varing the field resistance.
    </p>

    <p><b>Simulation Summary</b></p>
    <p style="text-align: justify">
      The connections were completed as per the instructions and verified. 
      The DC supply was then enabled, the starter was operated, the armature resistance was set, and the field resistance was varied.
       The corresponding field current and speed readings were recorded, and a graph was generated.
    </p>

    <div class="two-col">
      <div>
        <p><b>Components</b></p>
        <ul>
        <li>DC Power Supply</li>
        <li>Starter</li>
        <li>Field Rheostat</li>
        <li>Armature Rheostat</li>
        <li>DC Shunt Motor</li>
        <li>DC Voltmeter</li>
        <li>DC Ammeter</li>
        <li>RPM Indicator</li>
        </ul>
      </div>

      <div>
        <p><b>Key Parameters</b></p>
        <ul>
          <li>Voltage Range: 0 - 410 V DC</li>
          <li>Ammeter Range: 0 – 1 A</li>
          <li>Speed Range: 0 – 1500 RPM</li>
        </ul>
      </div>
    </div>
  </div>

  <!-- OBSERVATION TABLE -->
  <div class="card">
    <div class="section-title"  style="text-align:center">Observation Table</div>

    <table>
      <tr>
        <th>S.No.</th>
        <th>Field Current (A)</th>
        <th>Speed (RPM)</th>
      </tr>
      ${reportReadings.map((r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${r.current}</td>
          <td>${r.speed}</td>
        </tr>
      `).join("")}
    </table>
  </div>

  <!-- GRAPH -->
  <div class="card">
    <div class="section-title" style="text-align:center">Graph</div>
    <div id="graph" class="graph-box"></div>
  </div>

  <button class="print-btn" onclick="window.print()">PRINT</button>

</div>

<script>
Plotly.newPlot("graph", [{
  x: ${JSON.stringify(currents)},
  y: ${JSON.stringify(speeds)},
  type: "scatter",
  mode: "lines+markers",
  line: { color: "#2f6df6", width: 3 }
}], {
  title: "Speed vs Field Current",
  xaxis: { title: "Field Current (A)" },
  yaxis: { title: "Speed (RPM)" },
  margin: { t: 50 }
});
</script>

</body>
</html>
`;

  const w = window.open("", "_blank");
  w.document.open();
  w.document.write(html);
  w.document.close();

  if (window.labSpeech && typeof window.labSpeech.speak === "function") {
    window.labSpeech.speak(
      "Report is ready. You can print it and reset the experiment when you are done."
    );
  }
}





// ================= REPORT BUTTON =================
if (reportBtn) {
  reportBtn.addEventListener("click", generateReport);
}


/* ===============================
   GRAPH LOGIC (PLOTLY BASED)
================================ */


(function initGraphLogic() {
  const MIN_GRAPH_POINTS = 5;

  // Containers
  const graphBars = document.getElementById("graphBars");
  const graphPlot = document.getElementById("graphPlot");
  const graphSection = document.querySelector(".graph-section");
  const graphCount = document.getElementById("graphCount");
  if (graphCount) {
    graphCount.style.display = "none";
  }
  // Buttons (detected by text)
  const graphBtn = Array.from(document.querySelectorAll(".pill-btn"))
    .find(btn => btn.textContent.trim() === "Graph");
  const reportBtn = document.getElementById("reportBtn");
  const resetBtn = document.getElementById("resetBtn");

  /* -------- DATA SOURCE -------- */
  const readingsRecorded = [];

  // --- Helper: Set button disabled state with visual feedback ---
  function setButtonDisabled(btn, disabled) {
    if (!btn) return;
    btn.disabled = !!disabled;
    if (disabled) {
      btn.style.opacity = 0.75; // Match greyness of Auto Connect button
      btn.style.cursor = 'not-allowed';
      btn.setAttribute('aria-disabled', 'true');
      btn.tabIndex = -1;
    } else {
      btn.style.opacity = 1;
      btn.style.cursor = '';
      btn.removeAttribute('aria-disabled');
      btn.tabIndex = 0;
    }
  }

  // --- Disable both buttons by default on load ---
  setButtonDisabled(graphBtn, true);
  setButtonDisabled(reportBtn, true);

  /* -------- ENABLE / DISABLE GRAPH & REPORT BUTTONS -------- */
  function updateGraphControls() {
    const count = readingsRecorded.length;
    if (graphCount) {
      graphCount.textContent = `${count} / ${MIN_GRAPH_POINTS} readings`;
    }
    // Enable Graph if enough readings, else disable
    setButtonDisabled(graphBtn, count < MIN_GRAPH_POINTS);
    // Report always disabled until graph is generated
    setButtonDisabled(reportBtn, true);
  }

  // --- Enable Report button after graph is generated ---
  function enableReportAfterGraph() {
    setButtonDisabled(reportBtn, false);
  }



  /* -------- LOAD PLOTLY DYNAMICALLY -------- */
  function ensurePlotlyLoaded() {
    if (window.Plotly) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.plot.ly/plotly-3.0.1.min.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /* -------- DRAW GRAPH -------- */
 function renderGraph() {
    if (readingsRecorded.length < MIN_GRAPH_POINTS) {
      alert(`Please take at least ${MIN_GRAPH_POINTS} readings.`);
      return;
    }

    const currents = readingsRecorded.map(r => r.current);
    const rpms = readingsRecorded.map(r => r.voltage);

    ensurePlotlyLoaded().then(() => {
      const trace = {
        x: currents,
        y: rpms,
        type: "scatter",
        mode: "lines+markers",
        marker: { size: 8, color: "#1b6fb8" },
        line: { width: 3, color: "#1b6fb8" }
      };
      const layout = {
        title: { text: "<b>Speed(RPM) vs Field Current(A)</b>" },
        margin: { l: 70, r: 20, t: 40, b: 60 },
        xaxis: {
          title: { text: "<b> Field Current(A)</b>" },
          zeroline: false
        },
        yaxis: {
          title: { text: "<b>Speed (RPM)</b>" },
          zeroline: false
        },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)"
      };
      if (graphBars) graphBars.style.display = "none";
      if (graphPlot) graphPlot.style.display = "block";
      Plotly.newPlot(graphPlot, [trace], layout, {
        displaylogo: false,
        responsive: true
      });
      if (graphSection) {
        graphSection.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
      // Enable Report button after graph is generated
      enableReportAfterGraph();
    }).catch(() => {
      alert("Failed to load graph library.");
    });
  }


  /* -------- PUBLIC HOOK (CALLED FROM TABLE) -------- */
  window.addGraphReading = function (current, voltage) {
    readingsRecorded.push({ current, voltage });
    updateGraphControls();
  };

  /* -------- RESET GRAPH -------- */
  function resetGraph() {
    readingsRecorded.length = 0;
    if (graphBars) graphBars.style.display = "block";
    if (graphPlot) {
      graphPlot.innerHTML = "";
      graphPlot.style.display = "none";
    }
    updateGraphControls();
    setButtonDisabled(reportBtn, true); // Always disable report on reset
    if (graphCount) {
      graphCount.style.display = "none";
      graphCount.textContent = `0 / ${MIN_GRAPH_POINTS} readings`;
    }
  }

  /* -------- BUTTON EVENTS -------- */
if (graphBtn) {
  graphBtn.addEventListener("click", function () {

    const count = readingsRecorded.length;
    const remaining = MIN_GRAPH_POINTS - count;

    // Show counter visually only
    if (graphCount) {
      graphCount.style.display = "inline-block";
      graphCount.textContent = `${count} / ${MIN_GRAPH_POINTS} readings`;
    }

    // ❌ Not enough readings → NO VOICE
    if (count < MIN_GRAPH_POINTS) {
      alert(
        `You have taken ${count} reading${count !== 1 ? "s" : ""}.\n` +
        `${remaining} more reading${remaining !== 1 ? "s" : ""} required to plot the graph.`
      );
      return;
    }

    // ✅ Plot graph
    renderGraph();

    // 🔊 Speak ONLY if guide is active
    speakOnlyIfGuideActive(
      "Graph is plotted. Now you can generate the report by clicking the Report button."
    );
  });
}




  if (resetBtn) {
    resetBtn.addEventListener("click", resetGraph);
  }


/* =====================================================
   ENDPOINT HIGHLIGHT HELPERS (ADD HERE)
===================================================== */
function clearEndpointHighlight() {
  document
    .querySelectorAll(".endpoint-highlight")
    .forEach(el => el.classList.remove("endpoint-highlight"));
}

function highlightEndpoints(fromId, toId) {
  clearEndpointHighlight();

  const fromEl = document.getElementById(fromId);
  const toEl = document.getElementById(toId);

  if (fromEl) fromEl.classList.add("endpoint-highlight");
  if (toEl) toEl.classList.add("endpoint-highlight");
}


/* =====================================================
   VOICE GUIDED CONNECTIONS (WORKING, CLEAN)
===================================================== */
(function () {

  // ---------- SAFELY WAIT FOR VOICES ----------
  function waitForVoices(callback) {
    const voices = speechSynthesis.getVoices();
    if (voices.length) {
      callback();
    } else {
      speechSynthesis.addEventListener(
        "voiceschanged",
        function handler() {
          speechSynthesis.removeEventListener("voiceschanged", handler);
          callback();
        }
      );
    }
  }

  const speakBtn = document.querySelector(".speak-btn");
  if (!speakBtn || !window.labSpeech) return;

  let guideActive = false;
  window.isGuideActive = () => guideActive;

  let currentStep = 0;

  // MUST MATCH requiredPairs ORDER
  const steps = [
    { from: "pointA", to: "pointP", text: "Connect point A to point P." },
    { from: "pointB", to: "pointK", text: "Connect point B to point K." },
    { from: "pointB", to: "pointY", text: "Connect point B to point Y." },
    { from: "pointB", to: "pointJ", text: "Connect point B to point J." },
    { from: "pointQ", to: "pointL", text: "Connect point Q to point L." },
    { from: "pointG", to: "pointR", text: "Connect point G to point R." },
    { from: "pointE", to: "pointM", text: "Connect point E to point M." },
    { from: "pointF", to: "pointD", text: "Connect point F to point D." },
    { from: "pointH", to: "pointI", text: "Connect point H to point I." },
    { from: "pointI", to: "pointC", text: "Connect point I to point C." },
    { from: "pointC", to: "pointH", text: "Connect point C to point H." }
  ];

  function speakCurrentStep() {
  if (!guideActive) return;

  const step = steps[currentStep];

  // 🔵 HIGHLIGHT CURRENT ENDPOINTS
  highlightEndpoints(step.from, step.to);

  labSpeech.speak(step.text);
}


function getFirstIncompleteStepIndex() {
  const currentConnections = jsPlumb.getAllConnections();

  const connectedSet = new Set(
    currentConnections.map(c =>
      [c.sourceId, c.targetId].sort().join("-")
    )
  );

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const key = [step.from, step.to].sort().join("-");

    if (!connectedSet.has(key)) {
      return i; // 🔴 first missing step
    }
  }

  return steps.length; // ✅ all steps completed
}

function activateGuideUI() {
  guideActive = true;
  speakBtn.classList.add("guiding");
  speakBtn.setAttribute("aria-pressed", "true");
  speakBtn.querySelector(".speak-btn__label").textContent = "Guiding...";
}


function startGuide() {
  guideEverStarted = true;

  if (suppressGuideDuringAutoConnect) return;

  let resumeStep = null;

  switch (labStage) {
    case "connections":
      resumeStep = getFirstIncompleteStepIndex();
      break;

    case "checked":
      activateGuideUI();
      labSpeech.speak(
        "Connections are already verified. Now turn on the D C supply."
      );
      return;

    case "dc_on":
      activateGuideUI();
      labSpeech.speak(
        "D C supply is already on. Now turn on the starter by moving the handle from left to right."
      );
      return;

    case "starter_on":
      activateGuideUI();
      labSpeech.speak(
        "Starter is already on. Now set the armature resistance."
      );
      return;

    case "armature_set":
      activateGuideUI();
      labSpeech.speak(
        "Armature resistance is already set. Now adjust the field resistance to take readings."
      );
      return;

    default:
      resumeStep = getFirstIncompleteStepIndex();
  }

  const firstIncomplete = resumeStep;

  // ✅ ALL CONNECTIONS DONE
  if (firstIncomplete >= steps.length) {
    activateGuideUI();
    labSpeech.speak(
      "All connections are completed. Now click on the Check button to confirm the connection."
    );
    return;
  }

  // 🔵 NORMAL CONNECTION GUIDANCE
  activateGuideUI();
  currentStep = firstIncomplete;

  waitForVoices(() => {
    const intro = new SpeechSynthesisUtterance(
      "Lets connect the components."
    );
    intro.rate = 0.9;

    const voices = speechSynthesis.getVoices();
    intro.voice =
      voices.find(v => v.lang.startsWith("en-IN")) ||
      voices.find(v => v.lang.startsWith("en")) ||
      voices[0];

    intro.onend = () => {
      if (guideActive) speakCurrentStep();
    };

    speechSynthesis.cancel();
    speechSynthesis.speak(intro);
  });



  // 🔵 NORMAL GUIDED MODE
  guideActive = true;
  currentStep = firstIncomplete;

  speakBtn.setAttribute("aria-pressed", "true");
  speakBtn.querySelector(".speak-btn__label").textContent = "Guiding...";

  waitForVoices(() => {
    const intro = new SpeechSynthesisUtterance(
      "Lets connect the components."
    );
    intro.rate = 0.9;

    const voices = speechSynthesis.getVoices();
    intro.voice =
      voices.find(v => v.lang.startsWith("en-IN")) ||
      voices.find(v => v.lang.startsWith("en")) ||
      voices[0];

    intro.onend = () => {
      if (guideActive) speakCurrentStep();
    };

    speechSynthesis.cancel();
    speechSynthesis.speak(intro);
  });
}


function stopGuide({ resetUI = false } = {}) {
  if (!guideActive && !resetUI) return; // 🔒 prevent double-stop

  guideActive = false;
  currentStep = 0;
 clearEndpointHighlight();
  speechSynthesis.cancel();

  if (resetUI) {
    resetSpeakButtonUI();
  }
}



speakBtn.addEventListener("click", () => {
  if (guideActive) {
    // ⏹ MANUAL STOP
    stopGuide({ resetUI: true });
  } else {
    // ▶️ MANUAL START
    startGuide();
  }
});



jsPlumb.bind("connection", function (info) {
  if (!guideActive) return;
  if (suppressGuideDuringAutoConnect) return;

  const step = steps[currentStep];

  const madeIds = [info.sourceId, info.targetId];
  const made = madeIds.slice().sort().join("-");
  const expected = [step.from, step.to].sort().join("-");

  // ❌ WRONG CONNECTION
  if (made !== expected) {
    const wrongA = info.sourceId.replace("point", "");
    const wrongB = info.targetId.replace("point", "");

    const correctA = step.from.replace("point", "");
    const correctB = step.to.replace("point", "");

    labSpeech.speak(
      `Wrong connection. You connected ${wrongA} to ${wrongB}. ` +
      `Please connect ${correctA} to ${correctB}.`
    );

    return; // ⛔ DO NOT ADVANCE
  }

  // ✅ CORRECT CONNECTION
  // ✅ CORRECT CONNECTION
  clearEndpointHighlight();

currentStep++;

// 🎉 ALL CONNECTIONS COMPLETED
if (currentStep >= steps.length) {
  labSpeech.speak(
    "Now all the connections are completed. Please click on the Check button to confirm the connections."
  );

  // 🔒 DO NOT stop guide — user controls it
  return;
}
// 🔵 Continue guiding
speakCurrentStep();

});
/* =====================================================
   COMPONENT POPUP (ONBOARDING – SAFE INTEGRATION)
   ===================================================== */
(function initComponentsPopup() {
  const modal = document.getElementById("componentsModal");
  if (!modal) return;

  const closeEls = modal.querySelectorAll("[data-components-close]");
  const skipBtn = modal.querySelector("[data-components-skip]");
  const audioBtn = modal.querySelector("[data-components-audio]");
  const audioLabel = modal.querySelector("[data-components-audio-label]");
  const frame = modal.querySelector("iframe");
  const openBtns = document.querySelectorAll("[data-open-components]");

  /* ---------- STORAGE ---------- */
  const SKIP_KEY = "vl_components_skipped";
  const AUDIO_KEY = "vl_components_audio_played";

  let storage;
  try {
    storage = window.sessionStorage;
  } catch {
    storage = null;
  }

  let audioStorage;
  try {
    audioStorage = window.sessionStorage || window.localStorage;
  } catch {
    audioStorage = null;
  }

  const hasSkipped = () => {
    try {
      return storage && storage.getItem(SKIP_KEY) === "1";
    } catch {
      return false;
    }
  };

  const markSkipped = () => {
    try {
      storage && storage.setItem(SKIP_KEY, "1");
    } catch {}
  };

  const hasPlayedAudio = () => {
    try {
      return audioStorage && audioStorage.getItem(AUDIO_KEY) === "1";
    } catch {
      return false;
    }
  };

  const markAudioPlayed = () => {
    try {
      audioStorage && audioStorage.setItem(AUDIO_KEY, "1");
    } catch {}
  };

  /* ---------- AUDIO STATE ---------- */
  let frameReady = false;
  let autoPlayPending = !hasPlayedAudio();
  let autoPlayRequested = false;
  let autoPlayRetryArmed = false;

  function post(type) {
    if (!frame || !frame.contentWindow) return;
    frame.contentWindow.postMessage({ type }, "*");
  }

  function updateAudioUI({ playing = false, disabled = false, label } = {}) {
    if (!audioBtn) return;
    audioBtn.disabled = disabled;
    audioBtn.setAttribute("aria-pressed", playing ? "true" : "false");
    if (audioLabel) {
      audioLabel.textContent =
        label || (playing ? "Pause Audio" : "Play Audio");
    }
  }

  function tryAutoPlay() {
    if (!autoPlayPending || !frameReady || autoPlayRequested) return;
    post("component-audio-play");
    autoPlayRequested = true;
  }

  function armRetry() {
    if (autoPlayRetryArmed || !autoPlayPending) return;
    autoPlayRetryArmed = true;

    const retry = () => {
      autoPlayRetryArmed = false;
      if (!frameReady) return;
      post("component-audio-play");
      autoPlayRequested = true;
    };

    document.addEventListener("pointerdown", retry, { once: true });
    document.addEventListener("keydown", retry, { once: true });
  }

  /* ---------- OPEN / CLOSE ---------- */
  function open({ force = false } = {}) {
    if (!force && hasSkipped()) return;

    modal.classList.remove("hidden");
    document.body.classList.add("is-modal-open");

    post("component-audio-request");
    tryAutoPlay();
  }

  function close({ skip = false } = {}) {
    modal.classList.add("hidden");
    document.body.classList.remove("is-modal-open");

    post("component-audio-stop");

    if (skip) markSkipped();
  }

  /* ---------- EVENTS ---------- */
  closeEls.forEach(el => el.addEventListener("click", () => close()));
  skipBtn && skipBtn.addEventListener("click", () => close({ skip: true }));

  openBtns.forEach(btn =>
    btn.addEventListener("click", e => {
      e.preventDefault();
      open({ force: true });
    })
  );

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" &&  !modal.classList.contains("hidden")) {
      close();
    }
  });

  /* ---------- AUDIO BUTTON ---------- */
  audioBtn &&
    audioBtn.addEventListener("click", () => {
      post("component-audio-toggle");
    });

  /* ---------- IFRAME ---------- */
  frame &&
    frame.addEventListener("load", () => {
      frameReady = true;
      post("component-audio-request");
      tryAutoPlay();
    });

  /* ---------- MESSAGE HANDLING ---------- */
  window.addEventListener("message", e => {
    if (!frame || e.source !== frame.contentWindow) return;

    const data = e.data || {};

    if (data.type === "component-audio-state") {
      updateAudioUI(data.state || data);

      if (autoPlayPending && data.playing) {
        autoPlayPending = false;
        markAudioPlayed();
      }
    }

    if (data.type === "component-audio-blocked") {
      autoPlayRequested = false;
      armRetry();
      updateAudioUI({
        playing: false,
        label: "Tap to enable audio"
      });
    }
  });

  /* ---------- AUTO OPEN ---------- */
  window.addEventListener("load", () => {
    setTimeout(() => open(), 250);
  });
})();
})();
})();
});
