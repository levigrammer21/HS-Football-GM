
"use strict";
const BUILD_VERSION = "v0.0.38-alpha";
const BUILD_DATE = "2026-06-12";

function reportFatalError(error) {
  const message = error && error.stack ? error.stack : String(error);
  console.error(error);
  const banner = document.getElementById("errorBanner");
  const text = document.getElementById("errorText");
  if (banner && text) {
    text.textContent = message;
    banner.classList.remove("hidden");
  } else {
    alert("HS Football GM error: " + message);
  }
}

window.addEventListener("error", event => reportFatalError(event.error || event.message));
window.addEventListener("unhandledrejection", event => reportFatalError(event.reason || "Unhandled promise rejection"));

/* ----------------------------- Firebase setup ---------------------------- */

const firebaseConfig = {
  apiKey: "AIzaSyBaoJBBCvvGL3SS4geVO8jhTL47inuzank",
  authDomain: "hs-football-gm.firebaseapp.com",
  projectId: "hs-football-gm",
  storageBucket: "hs-football-gm.firebasestorage.app",
  messagingSenderId: "472368284803",
  appId: "1:472368284803:web:b0cabd6331c90661f147b6"
};


let firebaseApp = null;
let db = null;
let auth = null;
let googleProvider = null;
let firebaseReady = null;
let firebaseFns = {};

async function ensureFirebase() {
  if (firebaseReady) return firebaseReady;

  firebaseReady = (async () => {
    const appMod = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
    const firestoreMod = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
    const authMod = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");

    firebaseApp = appMod.initializeApp(firebaseConfig);
    db = firestoreMod.getFirestore(firebaseApp);
    auth = authMod.getAuth(firebaseApp);
    googleProvider = new authMod.GoogleAuthProvider();

    firebaseFns = {
      doc: firestoreMod.doc,
      getDoc: firestoreMod.getDoc,
      setDoc: firestoreMod.setDoc,
      serverTimestamp: firestoreMod.serverTimestamp,
      signInWithPopup: authMod.signInWithPopup,
      signInAnonymously: authMod.signInAnonymously,
      onAuthStateChanged: authMod.onAuthStateChanged
    };

    firebaseFns.onAuthStateChanged(auth, user => {
      currentUser = user;
      if (game) {
        showApp();
        render();
      }
    });

    return true;
  })();

  return firebaseReady;
}
/* ------------------------------- Constants ------------------------------- */

const STORAGE_KEY = "hsfg_readable_v1";

const DISTRICTS = {
  "2A-II-1": [
    "Bethel",
    "Blackwell",
    "Cascia Hall",
    "Chisholm",
    "Crooked Oak",
    "Dewey",
    "Kiefer",
    "Perry"
  ],
  "2A-II-2": [
    "Anadarko",
    "Casady",
    "Chandler",
    "Crossings Christian",
    "Dickson",
    "Lindsay",
    "Little Axe",
    "Washington"
  ],
  "2A-II-3": [
    "Adair",
    "Chelsea",
    "Chouteau-Mazie",
    "Kansas",
    "Keys Parkhill",
    "KIPP Tulsa",
    "Salina",
    "Wyandotte"
  ],
  "2A-II-4": [
    "Atoka",
    "Beggs",
    "Hartshorne",
    "Holdenville",
    "Kellyville",
    "Morris",
    "Stroud",
    "Wilburton"
  ]
};

const MASCOTS = {
  Stroud: "Tigers",
  Chandler: "Lions",
  Bristow: "Pirates",
  Prague: "Red Devils",
  Cushing: "Tigers",
  Depew: "Hornets",
  Davenport: "Bulldogs",
  Bethel: "Wildcats",
  Blackwell: "Maroons",
  "Cascia Hall": "Commandos",
  Chisholm: "Longhorns",
  "Crooked Oak": "Ruf-Nex",
  Dewey: "Bulldoggers",
  Kiefer: "Trojans",
  Perry: "Maroons",
  Anadarko: "Warriors",
  Casady: "Cyclones",
  "Crossings Christian": "Knights",
  Dickson: "Comets",
  Lindsay: "Leopards",
  "Little Axe": "Indians",
  Washington: "Warriors",
  Adair: "Warriors",
  Chelsea: "Dragons",
  "Chouteau-Mazie": "Wildcats",
  Kansas: "Comets",
  "Keys Parkhill": "Cougars",
  "KIPP Tulsa": "University Prep",
  Salina: "Wildcats",
  Wyandotte: "Bears",
  Atoka: "Wampus Cats",
  Beggs: "Demons",
  Hartshorne: "Miners",
  Holdenville: "Wolverines",
  Kellyville: "Ponies",
  Morris: "Eagles",
  Wilburton: "Diggers"
};

const RIVALS = ["Chandler", "Prague", "Bristow", "Cushing"];
const EXTRA_TEAMS = ["Bristow", "Cushing"];

const OFFENSE_POSITIONS = ["QB", "RB", "FB", "WR1", "WR2", "WR3", "TE", "LT", "LG", "C", "RG", "RT"];
const DEFENSE_POSITIONS = ["LE", "DT1", "DT2", "RE", "OLB1", "MLB", "OLB2", "CB1", "CB2", "FS", "SS"];
const SPECIAL_POSITIONS = ["K", "P", "KR", "PR"];
const ALL_POSITIONS = [...OFFENSE_POSITIONS, ...DEFENSE_POSITIONS, ...SPECIAL_POSITIONS];

const OFFENSES = ["Spread", "Air Raid", "Pro Style", "Option", "Wing-T", "Power-I", "Flexbone", "Wishbone"];
const DEFENSES = ["4-3", "3-4", "4-4", "3-3-5", "5-2", "Nickel", "Bear"];

const SCHEME_PROFILES = {
  "Spread": { runPass: "45% run / 55% pass", critical: ["QB", "WR", "WR", "RB", "LT"], text: "Spread football is about space. A smart QB, explosive receivers, and a back who can punish light boxes make this offense dangerous. Bad corners get exposed fast." },
  "Air Raid": { runPass: "25% run / 75% pass", critical: ["QB", "WR", "WR", "WR", "LT"], text: "The Air Raid lives through the quarterback and receivers. If your WR room is special and the opponent cannot cover, this can get ugly. A weak QB makes it fall apart." },
  "Pro Style": { runPass: "50% run / 50% pass", critical: ["QB", "RB", "TE", "WR", "OL"], text: "Pro Style asks for balance. It rewards complete players and punishes one-dimensional rosters. A good TE matters more here than in most systems." },
  "Option": { runPass: "80% run / 20% pass", critical: ["QB", "RB", "FB", "OL", "OL"], text: "The Option wants a tough QB, disciplined backs, and linemen who can move. Arm talent is nice, but mesh timing, ball handling, and decision-making carry the system." },
  "Wing-T": { runPass: "85% run / 15% pass", critical: ["FB", "RB", "RB", "LG", "RG"], text: "The Wing-T is misdirection, toughness, and timing. Fullback is the engine. Wingbacks need quickness. Guards must pull. Wide receivers are mostly blockers and decoys." },
  "Power-I": { runPass: "70% run / 30% pass", critical: ["RB", "FB", "OL", "OL", "TE"], text: "Power-I is a fistfight. Get downhill, lean on the fullback, and make the opponent tackle for four quarters. Great receivers are wasted unless the run game forces coverage mistakes." },
  "Flexbone": { runPass: "88% run / 12% pass", critical: ["QB", "FB", "RB", "RB", "OL"], text: "Flexbone is option football turned all the way up. It needs a fearless QB, a bruising fullback, quick slots, and offensive linemen who can reach and cut angles." },
  "Wishbone": { runPass: "82% run / 18% pass", critical: ["QB", "FB", "RB", "RB", "OL"], text: "Wishbone pounds the ball with three backs and asks the QB to make clean decisions. It is not pretty, but with the right kids it drains the clock and breaks wills." }
};

const SCHEME_DEPTH_REQUIREMENTS = {
  "Spread": {
    offense: ["QB", "RB", "WR1", "WR2", "WR3", "TE", "LT", "LG", "C", "RG", "RT"],
    backups: ["QB", "RB", "WR1", "WR2", "WR3", "TE", "LT", "LG", "C", "RG", "RT"]
  },
  "Air Raid": {
    offense: ["QB", "RB", "WR1", "WR2", "WR3", "TE", "LT", "LG", "C", "RG", "RT"],
    backups: ["QB", "RB", "WR1", "WR2", "WR3", "TE", "LT", "LG", "C", "RG", "RT"]
  },
  "Pro Style": {
    offense: ["QB", "RB", "FB", "WR1", "WR2", "TE", "LT", "LG", "C", "RG", "RT"],
    backups: ["QB", "RB", "FB", "WR1", "WR2", "TE", "LT", "LG", "C", "RG", "RT"]
  },
  "Option": {
    offense: ["QB", "RB", "FB", "WR1", "WR2", "TE", "LT", "LG", "C", "RG", "RT"],
    backups: ["QB", "RB", "FB", "WR1", "WR2", "TE", "LT", "LG", "C", "RG", "RT"]
  },
  "Wing-T": {
    offense: ["QB", "FB", "RB", "WR1", "WR2", "TE", "LT", "LG", "C", "RG", "RT"],
    backups: ["QB", "FB", "RB", "WR1", "WR2", "TE", "LT", "LG", "C", "RG", "RT"]
  },
  "Power-I": {
    offense: ["QB", "RB", "FB", "WR1", "WR2", "TE", "LT", "LG", "C", "RG", "RT"],
    backups: ["QB", "RB", "FB", "WR1", "WR2", "TE", "LT", "LG", "C", "RG", "RT"]
  },
  "Flexbone": {
    offense: ["QB", "FB", "RB", "WR1", "WR2", "TE", "LT", "LG", "C", "RG", "RT"],
    backups: ["QB", "FB", "RB", "WR1", "WR2", "TE", "LT", "LG", "C", "RG", "RT"]
  },
  "Wishbone": {
    offense: ["QB", "FB", "RB", "WR1", "WR2", "TE", "LT", "LG", "C", "RG", "RT"],
    backups: ["QB", "FB", "RB", "WR1", "WR2", "TE", "LT", "LG", "C", "RG", "RT"]
  }
};

const DEFENSE_PROFILES = {
  "4-3": { critical: ["DL", "DL", "LB", "LB", "S"], text: "Balanced and dependable. Needs linebackers who can clean up and defensive linemen who do not get moved." },
  "3-4": { critical: ["DL", "LB", "LB", "LB", "CB"], text: "Linebackers are the stars. Great if you have tough, flexible kids who can blitz, scrape, and cover." },
  "4-4": { critical: ["DL", "LB", "LB", "S", "CB"], text: "Built for small-school run defense. It can smother ground teams, but weak corners can get picked on." },
  "3-3-5": { critical: ["S", "S", "CB", "LB", "DL"], text: "Speed and confusion. Great against spread teams if your safeties and corners can tackle." },
  "5-2": { critical: ["DL", "DL", "DL", "LB", "LB"], text: "Old-school wall of bodies. Strong versus power run, vulnerable if the opponent spreads you out." },
  "Nickel": { critical: ["CB", "CB", "S", "S", "LB"], text: "Coverage first. Good against passing teams, but you better have enough toughness in the box." },
  "Bear": { critical: ["DL", "DL", "LB", "LB", "S"], text: "Aggressive and nasty. Creates chaos up front, but can give up big plays if the back end misses fits." }
};


const PLAYER_STATS = [
  "speed",
  "acceleration",
  "strength",
  "agility",
  "stamina",
  "armStrength",
  "throwAccuracy",
  "catching",
  "ballCarrying",
  "blocking",
  "tackling",
  "coverage",
  "vision",
  "pursuit",
  "kickPower",
  "kickAccuracy"
];

const STAT_LABELS = {
  speed: "Speed",
  acceleration: "Accel",
  strength: "Strength",
  agility: "Agility",
  stamina: "Stamina",
  armStrength: "Arm Str",
  throwAccuracy: "Throw Acc",
  catching: "Catching",
  ballCarrying: "Carry",
  blocking: "Blocking",
  tackling: "Tackling",
  coverage: "Coverage",
  vision: "Vision",
  pursuit: "Pursuit",
  kickPower: "Kick Pwr",
  kickAccuracy: "Kick Acc"
};

const FIRST_NAMES = [
  "Aaron", "Abel", "Ace", "Adam", "Aiden", "Alan", "Alex", "Amir", "Andre", "Andrew",
  "Anthony", "Archer", "Ashton", "Austin", "Axel", "Barrett", "Beau", "Beckett", "Ben",
  "Bennett", "Blake", "Bo", "Braden", "Brady", "Braxton", "Brayden", "Brennan", "Brett",
  "Brock", "Brody", "Brooks", "Bryce", "Bryson", "Cade", "Caden", "Caleb", "Calvin",
  "Cameron", "Camden", "Carter", "Carson", "Cash", "Chance", "Chandler", "Chase", "Chris",
  "Clay", "Clayton", "Cody", "Cohen", "Cole", "Colson", "Colt", "Colton", "Connor", "Cooper",
  "Corbin", "Corey", "Cruz", "Dalton", "Damon", "Daniel", "Dante", "Darius", "Dash", "David",
  "Dawson", "Deacon", "Declan", "Derek", "Devin", "Diego", "Dillon", "Drew", "Dylan", "Easton",
  "Eddie", "Eli", "Elias", "Elijah", "Elliot", "Ellis", "Emmett", "Eric", "Ethan", "Evan",
  "Everett", "Ezekiel", "Finn", "Fisher", "Ford", "Gabe", "Garrett", "Gavin", "George", "Grant",
  "Grayson", "Greyson", "Griffin", "Gunner", "Hank", "Harrison", "Hayden", "Hector", "Henry",
  "Holden", "Hudson", "Hunter", "Isaac", "Isaiah", "Ivan", "Jack", "Jackson", "Jacob", "Jaden",
  "Jake", "James", "Jamison", "Jase", "Jason", "Jasper", "Jaxon", "Jaxson", "Jay", "Jayce",
  "Jayden", "Jeremiah", "Jesse", "Jett", "Joel", "John", "Jonah", "Jordan", "Jose", "Josh",
  "Josiah", "Jude", "Julian", "Kai", "Kale", "Karter", "Kayden", "Kendrick", "Kevin", "King",
  "Kobe", "Kolton", "Kyler", "Landon", "Lane", "Larry", "Leo", "Levi", "Liam", "Lincoln",
  "Logan", "Lorenzo", "Luke", "Maddox", "Malik", "Marcus", "Mario", "Mason", "Mateo", "Matthew",
  "Maverick", "Max", "Micah", "Michael", "Miles", "Milo", "Nash", "Nathan", "Nolan", "Noah",
  "Omar", "Oscar", "Owen", "Parker", "Paxton", "Pedro", "Peyton", "Phoenix", "Porter", "Preston",
  "Rafael", "Reid", "Rhett", "Riley", "River", "Robert", "Roman", "Rowan", "Ryder", "Sam",
  "Sawyer", "Sean", "Sebastian", "Seth", "Silas", "Spencer", "Tate", "Terrance", "Theo", "Thomas",
  "Titus", "Tony", "Trace", "Travis", "Trey", "Trenton", "Trevor", "Tucker", "Tyler", "Tyson",
  "Victor", "Walker", "Warren", "Weston", "Will", "Wyatt", "Xavier", "Zach", "Zane"
];

const LAST_NAMES = [
  "Adams", "Allen", "Anderson", "Armstrong", "Austin", "Bailey", "Baker", "Barnes", "Bell",
  "Bennett", "Bishop", "Black", "Blair", "Boyd", "Bradley", "Brooks", "Brown", "Bryant",
  "Butler", "Campbell", "Carter", "Castillo", "Chavez", "Clark", "Coleman", "Collins", "Cook",
  "Cooper", "Cox", "Cruz", "Davis", "Diaz", "Dixon", "Douglas", "Edwards", "Ellis", "Evans",
  "Fisher", "Flores", "Ford", "Foster", "Garcia", "Gibson", "Gomez", "Graham", "Gray", "Green",
  "Griffin", "Hall", "Hamilton", "Harris", "Harrison", "Hayes", "Henderson", "Hernandez", "Hill",
  "Holmes", "Howard", "Hughes", "Jackson", "James", "Jenkins", "Johnson", "Jones", "Kelly",
  "Kennedy", "King", "Knight", "Lee", "Lewis", "Long", "Lopez", "Martin", "Martinez", "Mason",
  "Matthews", "McCoy", "Medina", "Miller", "Mitchell", "Moore", "Morgan", "Morris", "Murphy",
  "Nelson", "Nguyen", "Nichols", "Olson", "Parker", "Patterson", "Perez", "Perry", "Peterson",
  "Phillips", "Powell", "Price", "Ramirez", "Reed", "Reyes", "Reynolds", "Richardson", "Rivera",
  "Roberts", "Robinson", "Rodriguez", "Rogers", "Ross", "Russell", "Sanchez", "Sanders", "Scott",
  "Simmons", "Smith", "Spencer", "Stewart", "Sullivan", "Taylor", "Thomas", "Thompson", "Torres",
  "Turner", "Walker", "Wallace", "Ward", "Washington", "Watson", "White", "Williams", "Wilson",
  "Wood", "Woods", "Wright", "Young"
];


function bindClick(id, handler) {
  const node = document.getElementById(id);
  if (!node || typeof handler !== "function") return;
  node.addEventListener("click", handler);
}

/* --------------------------------- State -------------------------------- */

let currentUser = null;
let game = null;
let currentView = "dashboard";
let rosterSort = { key: "name", dir: 1 };
let soundEnabled = true;
const usedNames = new Set();

/* --------------------------------- Utils -------------------------------- */

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function choice(items) {
  return items[rand(0, items.length - 1)];
}

function shuffle(items) {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i--) {
    const j = rand(0, i);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function id(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function average(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function sum(values) {
  return values.reduce((a, b) => a + b, 0);
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function bell(mean = 50, sd = 15, min = 1, max = 99) {
  let u = 0;
  let v = 0;

  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();

  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.round(clamp(mean + z * sd, min, max));
}

function formatHeight(inches) {
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

function gradeValue(grade) {
  return { FR: 1, SO: 2, JR: 3, SR: 4 }[grade] || 0;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toast(message) {
  const toastBox = document.getElementById("toast");
  const node = document.createElement("div");
  node.textContent = message;
  toastBox.appendChild(node);
  setTimeout(() => node.remove(), 3500);
}

function playSound(type = "click") {
  if (!soundEnabled) return;

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContext();
    const osc = context.createOscillator();
    const gain = context.createGain();

    osc.connect(gain);
    gain.connect(context.destination);

    osc.type = type === "big" ? "sawtooth" : "square";
    osc.frequency.value = type === "injury" ? 92 : type === "big" ? 180 : 130;

    gain.gain.setValueAtTime(0.035, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + (type === "big" ? 0.35 : 0.14));

    osc.start();
    osc.stop(context.currentTime + (type === "big" ? 0.35 : 0.14));
  } catch {
    // Sound is optional.
  }
}

/* ------------------------------- Game data ------------------------------- */

function emptyStats() {
  return {
    games: 0,
    passYards: 0,
    passTD: 0,
    intThrown: 0,
    rushYards: 0,
    rushTD: 0,
    catches: 0,
    recYards: 0,
    recTD: 0,
    tackles: 0,
    sacks: 0,
    interceptions: 0,
    fgMade: 0,
    fgAtt: 0,
    xpMade: 0
  };
}

function createTeams() {
  const teams = [];

  for (const [district, names] of Object.entries(DISTRICTS)) {
    for (const name of names) {
      teams.push(createTeam(name, district));
    }
  }

  for (const name of EXTRA_TEAMS) {
    if (!teams.some(team => team.name === name)) teams.push(createTeam(name, "Rival"));
  }

  const stroud = teams.find(team => team.name === "Stroud");
  stroud.id = "team_stroud";
  stroud.power = 43;
  stroud.offense = "Wing-T";
  stroud.defense = "4-4";

  return teams;
}

function createTeam(name, district) {
  const power = bell(55, 18, 18, 92);

  return {
    id: `team_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    name,
    mascot: MASCOTS[name] || "Tigers",
    district,
    power,
    offense: choice(OFFENSES),
    defense: choice(DEFENSES),
    record: {
      wins: 0,
      losses: 0,
      districtWins: 0,
      districtLosses: 0,
      pf: 0,
      pa: 0
    },
    offenseRating: power,
    defenseRating: power,
    history: []
  };
}

function uniqueName() {
  let name = `${choice(FIRST_NAMES)} ${choice(LAST_NAMES)}`;
  let attempts = 0;

  while (usedNames.has(name) && attempts < 50) {
    name = `${choice(FIRST_NAMES)} ${choice(LAST_NAMES)}`;
    attempts += 1;
  }

  usedNames.add(name);
  return name;
}

function physicalBuild(grade = "FR") {
  const heightBase = { FR: 68.5, SO: 69.4, JR: 70.2, SR: 70.8 }[grade] || 69;
  const height = clamp(Math.round(bell(heightBase, 2.6, 62, 78)), 62, 78);

  const bodyType = choice(["thin", "average", "average", "average", "sturdy", "big"]);
  let weight;

  if (grade === "FR") {
    if (height <= 64) weight = rand(118, 155);
    else if (height < 68) weight = rand(122, 170);
    else if (height < 72) weight = rand(132, 190);
    else if (height < 75) weight = rand(145, 210);
    else weight = rand(160, 225);
  } else if (grade === "SO") {
    if (height <= 64) weight = rand(122, 165);
    else if (height < 68) weight = rand(130, 185);
    else if (height < 72) weight = rand(140, 210);
    else if (height < 75) weight = rand(155, 235);
    else weight = rand(170, 255);
  } else if (grade === "JR") {
    if (height <= 64) weight = rand(128, 180);
    else if (height < 68) weight = rand(138, 200);
    else if (height < 72) weight = rand(150, 230);
    else if (height < 75) weight = rand(165, 265);
    else weight = rand(180, 290);
  } else {
    if (height <= 64) weight = rand(130, 190);
    else if (height < 68) weight = rand(145, 215);
    else if (height < 72) weight = rand(160, 250);
    else if (height < 75) weight = rand(175, 285);
    else weight = rand(190, 315);
  }

  if (bodyType === "thin") weight -= rand(8, 24);
  if (bodyType === "sturdy") weight += rand(8, 20);
  if (bodyType === "big") weight += rand(15, grade === "FR" ? 32 : 48);

  // True freak freshmen can happen, but they should feel rare.
  if (grade === "FR" && Math.random() < 0.035) {
    weight += rand(25, 55);
  }

  return {
    height,
    weight: clamp(weight, 112, grade === "FR" ? 265 : 330)
  };
}

function athleticCaps(height, weight) {
  let speedMean = 66;
  speedMean -= Math.max(0, weight - 205) * 0.18;
  speedMean -= Math.max(0, 67 - height) * 1.8;
  speedMean += Math.max(0, height - 72) * 0.25;

  let speedMax = 99;
  speedMax -= Math.max(0, weight - 230) * 0.35;
  speedMax -= Math.max(0, 66 - height) * 4;

  if (weight < 160) speedMax += 4;
  if (weight > 250 && Math.random() > 0.035) speedMax = Math.min(speedMax, 72);
  if (weight > 275 && Math.random() > 0.015) speedMax = Math.min(speedMax, 62);

  let strengthMean = 42;
  strengthMean += Math.max(0, weight - 155) * 0.18;
  strengthMean += Math.max(0, height - 69) * 1.0;

  let strengthMax = 62;
  strengthMax += Math.max(0, weight - 160) * 0.25;
  strengthMax += Math.max(0, height - 70) * 1.5;

  if (weight < 145) strengthMax = Math.min(strengthMax, 68);
  if (height >= 73 && weight <= 150) strengthMax = Math.min(strengthMax, 65);

  return {
    speedMean,
    speedMin: clamp(25 + Math.max(0, 160 - weight) * 0.04, 15, 65),
    speedMax: clamp(speedMax, 35, 99),
    strengthMean,
    strengthMax: clamp(strengthMax, 45, 99)
  };
}

function createPlayer(grade = "FR") {
  const build = physicalBuild(grade);
  const caps = athleticCaps(build.height, build.weight);
  const ageBoost = { FR: 0, SO: 5, JR: 9, SR: 13 }[grade] || 0;

  const stats = {};
  stats.speed = clamp(bell(caps.speedMean + ageBoost * 0.6, 15, caps.speedMin, caps.speedMax), 1, 99);
  stats.acceleration = clamp(bell(stats.speed, 10, Math.max(15, stats.speed - 25), Math.min(99, stats.speed + 18)), 1, 99);
  stats.strength = clamp(bell(caps.strengthMean + ageBoost * 0.8, 14, 15, caps.strengthMax), 1, 99);
  stats.agility = clamp(bell(62 - Math.max(0, build.weight - 210) * 0.15 + ageBoost * 0.5, 15, 15, Math.min(99, caps.speedMax + 8)), 1, 99);
  stats.stamina = bell(52 + ageBoost, 16, 15, 95);
  stats.armStrength = bell(44 + ageBoost + (build.height - 69) * 1.2, 16, 10, 96);
  stats.throwAccuracy = bell(40 + ageBoost, 15, 8, 94);
  stats.catching = bell(44 + ageBoost, 15, 8, 95);
  stats.ballCarrying = bell(44 + ageBoost, 15, 8, 95);
  stats.blocking = clamp(bell(38 + ageBoost + (build.weight - 170) * 0.14, 15, 8, 96), 1, 99);
  stats.tackling = clamp(bell(42 + ageBoost + (build.weight - 170) * 0.08, 15, 8, 96), 1, 99);
  stats.coverage = bell(42 + ageBoost, 15, 8, 95);
  stats.vision = bell(42 + ageBoost, 15, 8, 95);
  stats.pursuit = clamp(bell((stats.speed + stats.tackling) / 2, 13, 8, 96), 1, 99);
  stats.kickPower = bell(38 + ageBoost, 18, 5, 96);
  stats.kickAccuracy = bell(36 + ageBoost, 18, 5, 96);

  const player = {
    id: id("p"),
    name: uniqueName(),
    grade,
    height: build.height,
    weight: build.weight,
    stats,
    hidden: {
      gamer: Math.random() < (0.20 + ((game?.prestige ?? 25) / 500)),
      clutch: Math.random() < (0.10 + ((game?.prestige ?? 25) / 900)),
      footballIQ: bell(53, 18, 1, 99),
      workEthic: bell(56, 19, 1, 99),
      genetics: bell(56, 19, 1, 99)
    },
    knowledge: {
      gamer: { known: 0, min: 0, max: 100 },
      clutch: { known: 0, min: 0, max: 100 },
      footballIQ: { known: 0, min: 0, max: 100 },
      workEthic: { known: 0, min: 0, max: 100 },
      genetics: { known: 0, min: 0, max: 100 }
    },
    offensePosition: null,
    defensePosition: null,
    specialPosition: null,
    seasonStats: emptyStats(),
    careerStats: emptyStats(),
    notes: [],
    awards: []
  };

  const recommended = recommendPositions(player);
  player.offensePosition = firstMatching(recommended, ["QB", "RB", "FB", "WR", "TE", "OL"]) || "WR";
  player.defensePosition = firstMatching(recommended, ["DL", "LB", "CB", "S"]) || "LB";
  player.specialPosition = firstMatching(recommended, ["K"]) || "";

  player.notes.push(
    `Walked into the program at ${formatHeight(player.height)} and ${player.weight} lbs. Staff has ideas, but nothing is locked in yet.`
  );

  revealTrait(player, "workEthic", rand(3, 10));
  revealTrait(player, "genetics", rand(3, 8));

  return player;
}

function firstMatching(list, allowed) {
  return list.find(item => allowed.includes(item));
}

function createRoster() {
  const roster = [];

  for (const grade of ["FR", "SO", "JR", "SR"]) {
    const classSize = rand(4, 12);
    for (let i = 0; i < classSize; i++) {
      roster.push(createPlayer(grade));
    }
  }

  return roster;
}

function createFreshmanClass() {
  const count = rand(4, 12);
  return Array.from({ length: count }, () => createPlayer("FR"));
}

/* -------------------------- Position and ratings -------------------------- */

function normalizePosition(position) {
  if (["WR1", "WR2", "WR3"].includes(position)) return "WR";
  if (["LT", "LG", "C", "RG", "RT"].includes(position)) return "OL";
  if (["LE", "RE", "DT1", "DT2"].includes(position)) return "DL";
  if (["OLB1", "MLB", "OLB2"].includes(position)) return "LB";
  if (["CB1", "CB2"].includes(position)) return "CB";
  if (["FS", "SS"].includes(position)) return "S";
  return position;
}

function positionFit(player, position, quarter = 1) {
  const stats = player.stats;
  const normalized = normalizePosition(position);
  const weighted = pairs => {
    const numerator = pairs.reduce((total, [key, weight]) => total + (stats[key] || 0) * weight, 0);
    const denominator = pairs.reduce((total, [, weight]) => total + weight, 0);
    return numerator / denominator;
  };

  let score = 50;

  if (normalized === "QB") {
    score = weighted([["armStrength", 2], ["throwAccuracy", 3], ["vision", 2], ["agility", 1], ["ballCarrying", 1]]);
    score += player.hidden.footballIQ * 0.1;
  } else if (normalized === "RB") {
    score = weighted([["speed", 2], ["acceleration", 2], ["agility", 2], ["ballCarrying", 3], ["vision", 1], ["strength", 1]]);
  } else if (normalized === "FB") {
    score = weighted([["strength", 2], ["blocking", 3], ["ballCarrying", 1], ["tackling", 1]]);
    score += Math.min(player.weight, 235) * 0.045;
  } else if (normalized === "WR") {
    score = weighted([["speed", 3], ["acceleration", 2], ["agility", 2], ["catching", 3], ["vision", 1]]);
  } else if (normalized === "TE") {
    score = weighted([["catching", 2], ["blocking", 3], ["strength", 2], ["speed", 1]]);
    score += Math.min(player.weight, 245) * 0.035;
  } else if (normalized === "OL") {
    score = weighted([["strength", 3], ["blocking", 4], ["stamina", 1]]);
    score += Math.min(player.weight, 310) * 0.06;
  } else if (normalized === "DL") {
    score = weighted([["strength", 3], ["tackling", 2], ["pursuit", 1], ["stamina", 1]]);
    score += Math.min(player.weight, 290) * 0.055;
  } else if (normalized === "LB") {
    score = weighted([["tackling", 3], ["pursuit", 3], ["strength", 1], ["speed", 1], ["vision", 1]]);
    score += player.hidden.footballIQ * 0.07;
  } else if (normalized === "CB") {
    score = weighted([["speed", 3], ["acceleration", 2], ["agility", 2], ["coverage", 3], ["tackling", 1]]);
  } else if (normalized === "S") {
    score = weighted([["speed", 2], ["coverage", 2], ["tackling", 2], ["pursuit", 2], ["vision", 2]]);
    score += player.hidden.footballIQ * 0.08;
  } else if (["K", "P"].includes(normalized)) {
    score = weighted([["kickPower", 3], ["kickAccuracy", 3]]);
  } else if (["KR", "PR"].includes(normalized)) {
    score = weighted([["speed", 3], ["acceleration", 2], ["agility", 2], ["ballCarrying", 2], ["vision", 1]]);
  }

  if (player.hidden.gamer) score += 4;

  const isTwoWay = Boolean(player.offensePosition && player.defensePosition);
  let quarterModifier = isTwoWay ? 1 - Math.max(0, quarter - 1) * 0.02 : 1;

  if (isTwoWay && player.hidden.gamer) {
    quarterModifier += 0.01 * (quarter - 1);
  }

  if (isTwoWay && player.hidden.gamer && player.hidden.clutch && quarter === 4) {
    quarterModifier = Math.max(quarterModifier, 1);
  }

  return clamp(score * quarterModifier, 1, 99);
}

function letterGrade(value) {
  if (value >= 94) return "A+";
  if (value >= 88) return "A";
  if (value >= 84) return "A-";
  if (value >= 80) return "B+";
  if (value >= 74) return "B";
  if (value >= 70) return "B-";
  if (value >= 66) return "C+";
  if (value >= 60) return "C";
  if (value >= 55) return "C-";
  if (value >= 50) return "D+";
  if (value >= 44) return "D";
  return "F";
}


function positionPillClass(value) {
  if (value >= 84) return "elite";
  if (value >= 70) return "good";
  if (value >= 55) return "mid";
  return "bad";
}

function gradeClass(value) {
  if (value >= 74) return "good";
  if (value <= 50) return "bad";
  return "gold";
}

function recommendPositions(player) {
  return ["QB", "RB", "FB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K"]
    .map(position => [position, positionFit(player, position)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([position]) => position);
}

function revealTrait(player, trait, amount) {
  const knowledge = player.knowledge[trait];
  knowledge.known = clamp(knowledge.known + amount, 0, 98);

  let actual;
  if (trait === "gamer") actual = player.hidden.gamer ? rand(75, 96) : rand(5, 58);
  else if (trait === "clutch") actual = player.hidden.clutch ? rand(76, 98) : rand(2, 59);
  else actual = player.hidden[trait];

  const width = Math.max(4, 100 - knowledge.known);
  knowledge.min = clamp(Math.round(actual - width / 2 - rand(0, 4)), 0, 100);
  knowledge.max = clamp(Math.round(actual + width / 2 + rand(0, 4)), 0, 100);
}

/* ------------------------------- Depth chart ------------------------------ */

function emptyDepthChart() {
  const depth = {
    offense: {},
    defense: {},
    special: {}
  };

  for (const position of OFFENSE_POSITIONS) depth.offense[position] = [null, null];
  for (const position of DEFENSE_POSITIONS) depth.defense[position] = [null, null];
  for (const position of SPECIAL_POSITIONS) depth.special[position] = [null, null];

  return depth;
}

function staffGuessDepthChart() {
  const depth = emptyDepthChart();
  const roster = [...game.players];

  fillSideWithStaffGuesses(depth.offense, OFFENSE_POSITIONS, roster, "offense");
  fillSideWithStaffGuesses(depth.defense, DEFENSE_POSITIONS, roster, "defense");
  fillSideWithStaffGuesses(depth.special, SPECIAL_POSITIONS, roster, "special");

  return depth;
}

function fillSideWithStaffGuesses(sideDepth, positions, roster, side) {
  const used = new Set();

  for (const position of positions) {
    for (let slot = 0; slot < 2; slot++) {
      const available = roster.filter(player => !used.has(player.id));
      if (!available.length) continue;

      const slightlyImperfect = available
        .map(player => ({
          player,
          score: positionFit(player, position) + rand(-12, 8)
        }))
        .sort((a, b) => b.score - a.score);

      const picked = slightlyImperfect[0].player;
      sideDepth[position][slot] = picked.id;
      used.add(picked.id);

      if (side === "offense") picked.offensePosition = normalizePosition(position);
      if (side === "defense") picked.defensePosition = normalizePosition(position);
      if (side === "special") picked.specialPosition = position;
    }
  }
}

function setDepthPlayer(side, position, slot, playerId) {
  const depthSide = game.depth[side];

  for (const [otherPosition, slots] of Object.entries(depthSide)) {
    for (let i = 0; i < slots.length; i++) {
      if (!(otherPosition === position && i === slot) && slots[i] === playerId) {
        slots[i] = null;
      }
    }
  }

  depthSide[position][slot] = playerId || null;

  const player = getPlayer(playerId);
  if (player) {
    if (side === "offense") player.offensePosition = normalizePosition(position);
    if (side === "defense") player.defensePosition = normalizePosition(position);
    if (side === "special") player.specialPosition = position;
  }

  recalculateTeamRatings();
}

function startersForSide(side) {
  const sideDepth = game.depth[side];
  return Object.fromEntries(
    Object.entries(sideDepth).map(([position, slots]) => [position, slots[0]])
  );
}

/* ------------------------------ Game creation ----------------------------- */

function createNewDynastyIntro() {
  usedNames.clear();

  game = {
    version: 1,
    coachName: "",
    year: 2027,
    week: 0,
    phase: "intro",
    teams: createTeams(),
    players: createRoster(),
    settings: {
      offense: "Wing-T",
      defense: "4-4",
      teamFocus: "Position Drills"
    },
    depth: emptyDepthChart(),
    schedule: [],
    playoffBracket: [],
    playoffRound: 0,
    paper: null,
    rankings: [],
    leaders: {},
    records: {
      season: {},
      career: {}
    },
    awards: [],
    history: [
      {
        year: 2026,
        wins: 2,
        losses: 8,
        districtWins: 1,
        districtLosses: 5,
        pf: 139,
        pa: 321,
        offense: "Mixed",
        defense: "4-4",
        stateChampion: false
      }
    ],
    news: [],
    prestige: 25,
    rivalries: createRivalries()
  };

  showApp();
  showIntroNewspaper();
}

function startFirstSeason() {
  const input = document.getElementById("coachNameInput");
  game.coachName = input?.value?.trim() || "Coach";

  game.phase = "regular";
  game.week = 1;
  game.depth = emptyDepthChart();
  game.schedule = createSchedule();
  recalculateTeamRatings();
  game.rankings = rankTeams();
  game.leaders = stateLeaders();
  game.paper = incomingFreshmanPaper();

  saveLocal();
  closeModal();

  currentView = "newspaper";
  render();

  toast(`Welcome to Stroud, Coach ${game.coachName}.`);
}

function incomingFreshmanPaper() {
  const freshmen = game.players.filter(player => player.grade === "FR").slice(0, 12);

  return {
    week: 0,
    headline: `Coach ${game.coachName} Takes Over Tigers`,
    body: "After a 2-8 season, Stroud has turned the page. The new coach inherits a roster with questions everywhere and a freshman class that could shape the next four years.",
    topPerformers: freshmen.map(player => ({
      name: player.name,
      label: `Incoming FR • ${formatHeight(player.height)} ${player.weight} lbs`,
      value: recommendPositions(player).join("/")
    })),
    around: [],
    rankings: rankTeams().slice(0, 10),
    leaders: stateLeaders(),
    rare: [
      {
        name: "Coach's Binder",
        note: "The current depth chart is a remaining empty spots. Open player cards, move kids around, or leave it for later."
      }
    ],
    injuries: [],
    gameStats: null
  };
}

function createSchedule() {
  const games = [];
  let week = 1;

  for (const rival of RIVALS) {
    const opponent = teamByName(rival);
    if (!opponent) continue;
    games.push(createGame(week, "team_stroud", opponent.id, false));
    week += 1;
  }

  const districtOpponents = shuffle(DISTRICTS["2A-II-4"].filter(name => name !== "Stroud")).slice(0, 6);
  for (const opponentName of districtOpponents) {
    const opponent = teamByName(opponentName);
    if (!opponent) continue;
    games.push(createGame(week, "team_stroud", opponent.id, true));
    week += 1;
  }

  for (let backgroundWeek = 1; backgroundWeek <= 10; backgroundWeek++) {
    for (const names of Object.values(DISTRICTS)) {
      const teams = shuffle(names.map(teamByName).filter(Boolean));
      for (let i = 0; i < teams.length - 1; i += 2) {
        if (teams[i].id === "team_stroud" || teams[i + 1].id === "team_stroud") continue;
        games.push(createGame(backgroundWeek, teams[i].id, teams[i + 1].id, teams[i].district === teams[i + 1].district));
      }
    }
  }

  return games;
}

function createGame(week, homeId, awayId, district = false) {
  return {
    id: id("g"),
    year: game.year,
    week,
    homeId,
    awayId,
    district,
    played: false,
    homeScore: null,
    awayScore: null,
    stats: null,
    injuries: [],
    log: [],
    playoff: false,
    label: null
  };
}

/* ----------------------------- Sim and stats ------------------------------ */


function syncStroudTeamSchemes() {
  const stroud = getTeam("team_stroud");
  if (!stroud || !game || !game.settings) return;
  stroud.offense = game.settings.offense || stroud.offense || "Pro Style";
  stroud.defense = game.settings.defense || stroud.defense || "4-4";
}

function getTeam(teamId) {
  return game.teams.find(team => team.id === teamId);
}

function teamByName(name) {
  return game.teams.find(team => team.name === name);
}

function getPlayer(playerId) {
  if (playerId === "" || playerId === null || playerId === undefined) return null;
  return game.players.find(player => String(player.id) === String(playerId)) || null;
}

function recalculateTeamRatings() {
  const stroud = getTeam("team_stroud");

  const offenseStarters = startersForSide("offense");
  const defenseStarters = startersForSide("defense");

  const offenseRating = average(
    OFFENSE_POSITIONS.map(position => {
      const player = getPlayer(offenseStarters[position]);
      return player ? positionFit(player, position) : 25;
    })
  );

  const defenseRating = average(
    DEFENSE_POSITIONS.map(position => {
      const player = getPlayer(defenseStarters[position]);
      return player ? positionFit(player, position) : 25;
    })
  );

  stroud.offenseRating = round1(clamp(offenseRating, 10, 99));
  stroud.defenseRating = round1(clamp(defenseRating, 10, 99));
  stroud.power = round1((stroud.offenseRating + stroud.defenseRating) / 2);

  for (const team of game.teams) {
    if (team.id === "team_stroud") continue;
    team.offenseRating = clamp(team.power + rand(-5, 5), 10, 99);
    team.defenseRating = clamp(team.power + rand(-5, 5), 10, 99);
  }
}



function requiredOffensePositions() {
  return SCHEME_DEPTH_REQUIREMENTS[game.settings.offense]?.offense || OFFENSE_POSITIONS;
}

function requiredBackupOffensePositions() {
  return SCHEME_DEPTH_REQUIREMENTS[game.settings.offense]?.backups || OFFENSE_POSITIONS;
}

function formatStatKey(key) {
  const labels = {
    passYards: "Pass Yds",
    passTD: "Pass TD",
    rushYards: "Rush Yds",
    rushTD: "Rush TD",
    recYards: "Rec Yds",
    recTD: "Rec TD",
    catches: "Rec",
    tackles: "Tackles",
    sacks: "Sacks",
    interceptions: "INT"
  };
  return labels[key] || key;
}

function validateDepthChartForGame() {
  const missing = [];
  for (const position of requiredOffensePositions()) {
    if (!game.depth.offense[position][0]) missing.push(`Offense ${position} starter`);
  }
  for (const position of requiredBackupOffensePositions()) {
    if (!game.depth.offense[position][1]) missing.push(`Offense ${position} backup`);
  }
  for (const position of DEFENSE_POSITIONS) {
    if (!game.depth.defense[position][0]) missing.push(`Defense ${position} starter`);
    if (!game.depth.defense[position][1]) missing.push(`Defense ${position} backup`);
  }
  for (const position of SPECIAL_POSITIONS) {
    if (!game.depth.special[position][0]) missing.push(`Special Teams ${position} starter`);
    if (!game.depth.special[position][1]) missing.push(`Special Teams ${position} backup`);
  }
  return missing;
}
function showDepthChartWarning(missing) {
  setModal("Depth Chart Not Ready", "You need starters and backups before kickoff.", `
    <div class="card">
      <h3>Game cannot start yet</h3>
      <p class="muted">Every starting position and backup spot must be filled before you can advance into a game. Injuries can happen during games, so backups matter.</p>
      <ul>${missing.slice(0, 18).map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      ${missing.length > 18 ? `<p class="muted">...and ${missing.length - 18} more.</p>` : ""}
      <button id="goDepthFromWarningBtn">Go to Depth Chart</button>
    </div>
  `);
  showModal();
  document.getElementById("goDepthFromWarningBtn").addEventListener("click", () => {
    closeModal();
    currentView = "depth";
    render();
  });
}
function currentWeekHasStroudGame() {
  if (game.phase === "regular") {
    return game.schedule.some(item => item.week === game.week && !item.played && (item.homeId === "team_stroud" || item.awayId === "team_stroud"));
  }
  if (game.phase === "playoffs") {
    return game.playoffBracket.some(item => !item.played && (item.homeId === "team_stroud" || item.awayId === "team_stroud"));
  }
  return false;
}
function confirmNewDynasty() {
  if (!game || window.confirm("Start a new dynasty? Export or cloud save first if you want to keep this one.")) {
    createNewDynastyIntro();
  }
}



function playerDepthRoles(playerId) {
  const roles = [];
  if (!game?.depth || !playerId) return roles;
  for (const [side, positions] of Object.entries(game.depth)) {
    for (const [position, slots] of Object.entries(positions)) {
      if (slots[0] === playerId) roles.push({ type: "Starter", side, position });
      if (slots[1] === playerId) roles.push({ type: "Backup", side, position });
    }
  }
  return roles;
}
function rolePositionOnly(playerId, side) {
  const roles = playerDepthRoles(playerId).filter(role => role.side === side);
  if (!roles.length) return "JV";
  return roles.map(role => role.position).join("/");
}
function roleFullText(playerId, side) {
  const roles = playerDepthRoles(playerId).filter(role => role.side === side);
  if (!roles.length) return "JV";
  return roles.map(role => `${role.type} ${role.position}`).join(" / ");
}
function playerVarsityStatus(playerId) {
  const roles = playerDepthRoles(playerId);
  if (!roles.length) return "JV";
  return roles.map(role => `${role.type} ${role.position}`).join(" / ");
}
function playerSimpleStatus(playerId) {
  const roles = playerDepthRoles(playerId);
  if (!roles.length) return "JV";
  if (roles.some(role => role.type === "Starter")) return "STARTER";
  return "BACKUP";
}
function playerStatusClass(playerId) {
  const status = playerSimpleStatus(playerId);
  if (status === "STARTER") return "starter";
  if (status === "BACKUP") return "backup";
  return "jv";
}
function playerStatusPill(playerId) {
  const status = playerSimpleStatus(playerId);
  return `<span class="status-pill ${playerStatusClass(playerId)}">${status}</span>`;
}
function varsityCounts() {
  const varsityIds = new Set();
  if (!game?.depth) return { varsity: 0, jv: game?.players?.length || 0 };
  for (const side of Object.values(game.depth)) {
    for (const slots of Object.values(side)) {
      if (slots[0]) varsityIds.add(slots[0]);
      if (slots[1]) varsityIds.add(slots[1]);
    }
  }
  return { varsity: varsityIds.size, jv: Math.max(0, game.players.length - varsityIds.size) };
}
function rosterRoleForSide(playerId, side) { return roleFullText(playerId, side); }
function roleTextForDropdown(playerId, side) {
  const roles = playerDepthRoles(playerId).filter(role => role.side === side);
  if (!roles.length) return "JV";
  return roles.map(role => `${role.type === "Starter" ? "●" : "○"} ${role.position}`).join("/");
}

function depthDropdownRoles(player) {
  return `${roleTextForDropdown(player.id, "offense")}, ${roleTextForDropdown(player.id, "defense")}`;
}

function selectRoleBadgeHtml(role) {
  if (!role) return `<span class="select-role-badge jv">JV</span>`;
  const className = role.type === "Starter" ? "starter" : "backup";
  return `<span class="select-role-badge ${className}">${role.position}</span>`;
}

function selectRoleBadgesForSide(playerId, side) {
  const roles = playerDepthRoles(playerId).filter(role => role.side === side);
  if (!roles.length) return selectRoleBadgeHtml(null);
  return roles.map(selectRoleBadgeHtml).join("");
}

function playerSelectDisplayName(player) {
  return `${player.name} • ${player.grade} • ${formatHeight(player.height)} ${player.weight}`;
}


function positionLabelForDropdown(player, position) {
  return `${player.name} • ${player.grade} • ${formatHeight(player.height)} ${player.weight} • ${depthDropdownRoles(player)} • Here: ${letterGrade(positionFit(player, position))}`;
}

function playerCurrentRoleText(player) {
  if (!player) return "";
  return playerVarsityStatus(player.id);
}
function currentAssignedGradeText(player) {
  if (!player) return "";
  const grades = [];
  if (player.offensePosition) grades.push(`Off ${player.offensePosition}: ${letterGrade(positionFit(player, player.offensePosition))}`);
  if (player.defensePosition) grades.push(`Def ${player.defensePosition}: ${letterGrade(positionFit(player, player.defensePosition))}`);
  if (player.specialPosition) grades.push(`ST ${player.specialPosition}: ${letterGrade(positionFit(player, player.specialPosition))}`);
  return grades.join(" • ");
}
function depthOptionLabel(player, position) {
  return positionLabelForDropdown(player, position);
}


let watchedGameEvents = [];
let watchTimer = null;
let watchIndex = 0;
let pendingWatchedAdvance = false;
let suppressAdvancePopups = false;
let pendingWatchPaper = null;


function currentStroudScheduledGame() {
  if (!game) return null;
  const games = game.phase === "playoffs" ? (game.playoffBracket || []) : (game.schedule || []);
  return games.find(g => !g.played && (g.homeId === "team_stroud" || g.awayId === "team_stroud")) || null;
}

function simulateGameForWatch(scheduledGame) {
  if (!scheduledGame) return null;
  simulateGame(scheduledGame);
  return scheduledGame;
}

function canWatchThisWeek() {
  return !!currentStroudScheduledGame();
}


function lastFinishedStroudGame() {
  const games = [...(game.schedule || []), ...(game.playoffBracket || [])]
    .filter(g => g && g.played && (g.homeId === "team_stroud" || g.awayId === "team_stroud"));
  return games[games.length - 1] || null;
}

function latestNewspaper() {
  return (game.newspapers || [])[0] || null;
}

function buildSafeWatchEvents(finishedGame) {
  if (finishedGame?.watchEvents?.length) return finishedGame.watchEvents;


  const home = getTeam(finishedGame.homeId) || { name: "Home" };
  const away = getTeam(finishedGame.awayId) || { name: "Away" };
  const homeFinal = Number(finishedGame.homeScore || 0);
  const awayFinal = Number(finishedGame.awayScore || 0);
  const homeStats = finishedGame.stats?.home || {};
  const awayStats = finishedGame.stats?.away || {};

  const events = [];
  let homeScore = 0;
  let awayScore = 0;
  let possession = finishedGame.homeId || "team_stroud";
  let yard = 25;

  function push(q, clock, title, text, big = false) {
    const possTeam = getTeam(possession) || { name: "Team" };
    events.push({
      homeId: finishedGame.homeId,
      awayId: finishedGame.awayId,
      homeScore,
      awayScore,
      quarter: `Q${q}`,
      clock,
      downText: `${possTeam.name} ball • ${yardLabel(yard)}`,
      fieldPct: clamp(yard, 2, 98),
      title,
      text,
      big
    });
  }

  const scores = [];
  function queueScores(side, points) {
    let left = points;
    while (left >= 7) {
      scores.push({ side, points: 7, label: "Touchdown!" });
      left -= 7;
    }
    if (left >= 3) scores.push({ side, points: 3, label: "Field Goal" });
    else if (left > 0) scores.push({ side, points: left, label: "Score" });
  }

  queueScores("home", homeFinal);
  queueScores("away", awayFinal);

  push(1, "12:00", "Kickoff", `${home.name} and ${away.name} are underway.`);

  let scoreIndex = 0;
  for (let q = 1; q <= 4; q++) {
    for (let d = 0; d < 3; d++) {
      const clock = `${String(rand(1, 11)).padStart(2, "0")}:${String(rand(0, 59)).padStart(2, "0")}`;
      const shouldScore = scoreIndex < scores.length && (scoreIndex / Math.max(1, scores.length)) <= ((q - 1) * 3 + d + 1) / 12;

      if (shouldScore) {
        const score = scores[scoreIndex++];
        possession = score.side === "home" ? finishedGame.homeId : finishedGame.awayId;
        if (score.side === "home") homeScore += score.points;
        else awayScore += score.points;
        yard = score.points >= 7 ? rand(85, 99) : rand(65, 82);
        push(q, clock, score.label, `${(getTeam(possession) || { name: "Team" }).name} puts points on the board.`, true);
      } else {
        const stats = possession === finishedGame.homeId ? homeStats : awayStats;
        const total = Number(stats.totalYards || 0);
        const gain = clamp(Math.round(total / 18 + rand(-6, 13)), -3, 35);
        yard = possession === finishedGame.homeId ? clamp(yard + gain, 1, 99) : clamp(yard - gain, 1, 99);
        if (gain >= 20) push(q, clock, "Big Gain", `${(getTeam(possession) || { name: "Team" }).name} flips the field.`, true);
        else if (gain >= 7) push(q, clock, "First Down", `${(getTeam(possession) || { name: "Team" }).name} moves the chains.`);
        else push(q, clock, "Drive Stalls", `${(getTeam(possession) || { name: "Team" }).name} punts it away.`);
      }

      possession = possession === finishedGame.homeId ? finishedGame.awayId : finishedGame.homeId;
    }
  }

  while (scoreIndex < scores.length) {
    const score = scores[scoreIndex++];
    possession = score.side === "home" ? finishedGame.homeId : finishedGame.awayId;
    if (score.side === "home") homeScore += score.points;
    else awayScore += score.points;
    yard = score.points >= 7 ? rand(85, 99) : rand(65, 82);
    push(4, "0:45", score.label, `${(getTeam(possession) || { name: "Team" }).name} adds late points.`, true);
  }

  homeScore = homeFinal;
  awayScore = awayFinal;
  push(4, "0:00", "Final Whistle", `Final: ${home.name} ${homeFinal}, ${away.name} ${awayFinal}.`, true);

  return events;
}

function watchGame() {
  const scheduledGame = currentStroudScheduledGame();
  if (!scheduledGame) {
    toast("No Stroud game to watch this week.");
    return;
  }

  const missing = validateDepthChartForGame();
  if (missing.length) {
    showDepthChartWarning(missing);
    return;
  }

  try {
    simulateGameForWatch(scheduledGame);
    if (game.phase === "regular") {
      game.week += 1;
      if (game.week > 10) startPlayoffs();
    } else if (game.phase === "playoffs") {
      advancePlayoffBracketAfterGame?.(scheduledGame);
    }

    makeWeeklyPaper();
    recalculateTeamRatings();
    saveLocalSilent();

    pendingWatchPaper = latestNewspaper();
    watchedGameEvents = scheduledGame.watchEvents?.length ? scheduledGame.watchEvents : buildSafeWatchEvents(scheduledGame);
    watchIndex = 0;
    openWatchGameOverlay();
    renderWatchFrame();
    clearInterval(watchTimer);
    watchTimer = setInterval(playNextWatchEvent, 850);
    render();
  } catch (error) {
    console.error(error);
    toast(`Watch game failed: ${error.message}`);
  }
}


function closeWatchGameOverlay() {
  clearInterval(watchTimer);
  watchTimer = null;
  document.getElementById("watchGameOverlay")?.classList.add("hidden");
}

function skipWatchedGame() {
  clearInterval(watchTimer);
  watchTimer = null;
  finishWatchedGame();
}

function finishWatchedGame() {
  clearInterval(watchTimer);
  watchTimer = null;
  closeWatchGameOverlay();
  render();

  if (pendingWatchPaper) {
    openPaper(pendingWatchPaper.id);
    pendingWatchPaper = null;
  } else {
    toast("Game completed.");
  }
}


function openWatchGameOverlay() {
  const panel = document.getElementById("watchGamePanel");
  panel.innerHTML = `
    <div class="watch-head">
      <div>
        <div class="watch-title">Friday Night Live</div>
        <div class="muted small">Drive-by-drive game viewer</div>
      </div>
      <div class="watch-controls">
        <button id="watchSkipBtn" class="secondary">Skip to Final</button>
        <button id="watchCloseBtn" class="secondary">Close</button>
      </div>
    </div>
    <div class="watch-body" id="watchBody"></div>
  `;
  document.getElementById("watchGameOverlay").classList.remove("hidden");
  document.getElementById("watchSkipBtn").addEventListener("click", skipWatchedGame);
  document.getElementById("watchCloseBtn").addEventListener("click", closeWatchGameOverlay);
}

function playNextWatchEvent() {
  if (watchIndex < watchedGameEvents.length - 1) {
    watchIndex++;
    renderWatchFrame();
  } else {
    clearInterval(watchTimer);
    watchTimer = null;
    renderWatchFrame(true);
  }
}

function renderWatchFrame(done = false) {
  const body = document.getElementById("watchBody");
  if (!body) return;

  const event = watchedGameEvents[watchIndex] || watchedGameEvents[0];
  const visible = watchedGameEvents.slice(Math.max(0, watchIndex - 10), watchIndex + 1).reverse();
  const homeTeam = getTeam(event.homeId) || { name: 'Home' };
  const awayTeam = getTeam(event.awayId) || { name: 'Away' };

  body.innerHTML = `
    <div class="watch-scoreboard">
      <div class="watch-team">${escapeHtml(homeTeam.name)}<br><span class="watch-score">${event.homeScore}</span></div>
      <div class="watch-clock">
        <strong>${escapeHtml(event.quarter)}</strong><br>
        ${escapeHtml(event.clock)}<br>
        ${escapeHtml(event.downText)}
      </div>
      <div class="watch-team away">${escapeHtml(awayTeam.name)}<br><span class="watch-score">${event.awayScore}</span></div>
    </div>

    <div class="watch-field">
      <div class="watch-yard-labels"><span>0</span><span>20</span><span>40</span><span>50</span><span>40</span><span>20</span><span>0</span></div>
      <div class="watch-ball" style="left:${event.fieldPct}%"></div>
    </div>

    <div class="watch-drive">
      <div class="watch-card">
        <div class="watch-play-main ${event.big ? "watch-big" : ""}">${escapeHtml(event.title)}</div>
        <div class="watch-play-sub">${escapeHtml(event.text)}</div>
        ${done ? `
          <div class="watch-final-actions">
            <button id="finishWatchBtn" class="gold">Continue to Final</button>
            <button id="viewCurrentPaperBtn" class="secondary">Skip Paper</button>
          </div>
        ` : ""}
      </div>
      <div class="watch-card watch-log">
        ${visible.map(item => `
          <div class="watch-log-line">
            <strong>${escapeHtml(item.quarter)} ${escapeHtml(item.clock)}</strong><br>
            ${item.big ? "<span class='watch-big'>★ </span>" : ""}${escapeHtml(item.title)}
          </div>
        `).join("")}
      </div>
    </div>
  `;

  document.getElementById("finishWatchBtn")?.addEventListener("click", finishWatchedGame);
  document.getElementById("viewCurrentPaperBtn")?.addEventListener("click", closeWatchGameOverlay);
}


function findMostRecentStroudGame(previousPhase, previousWeek) {
  const allGames = [
    ...(game.schedule || []),
    ...(game.playoffBracket || [])
  ];

  const stroudGames = allGames.filter(item =>
    item.played &&
    (item.homeId === "team_stroud" || item.awayId === "team_stroud")
  );

  if (!stroudGames.length) return null;

  const exact = stroudGames.find(item => item.week === previousWeek && (item.phase === previousPhase || !item.phase));
  if (exact) return exact;

  return stroudGames[stroudGames.length - 1];
}

function buildWatchedGameEventsFromResult(scheduledGame) {
  const home = getTeam(scheduledGame.homeId);
  const away = getTeam(scheduledGame.awayId);
  const homeFinal = Number(scheduledGame.homeScore || 0);
  const awayFinal = Number(scheduledGame.awayScore || 0);
  const homeStats = scheduledGame.stats?.home || { passYards: 0, rushYards: 0, turnovers: 0 };
  const awayStats = scheduledGame.stats?.away || { passYards: 0, rushYards: 0, turnovers: 0 };

  const events = [];
  let homeScore = 0;
  let awayScore = 0;
  let yard = 25;
  let possession = scheduledGame.homeId;
  const totalPoints = homeFinal + awayFinal;
  const scoringEvents = [];

  function addScoringEvents(teamSide, finalScore) {
    let remaining = finalScore;
    while (remaining >= 7) {
      scoringEvents.push({ side: teamSide, points: 7, title: "Touchdown!" });
      remaining -= 7;
    }
    if (remaining >= 3) scoringEvents.push({ side: teamSide, points: 3, title: "Field Goal" });
    else if (remaining > 0) scoringEvents.push({ side: teamSide, points: remaining, title: "Score" });
  }

  addScoringEvents("home", homeFinal);
  addScoringEvents("away", awayFinal);
  scoringEvents.sort(() => Math.random() - 0.5);

  function eventPush(q, clock, title, text, big = false) {
    events.push({
      homeId: scheduledGame.homeId,
      awayId: scheduledGame.awayId,
      homeScore,
      awayScore,
      quarter: `Q${q}`,
      clock,
      downText: `${getTeam(possession)?.name || "Team"} ball • ${yardLabel(yard)}`,
      fieldPct: clamp(yard, 2, 98),
      title,
      text,
      big
    });
  }

  eventPush(1, "12:00", "Kickoff", `${home.name} and ${away.name} are underway under the lights.`);

  let scoringIndex = 0;
  for (let q = 1; q <= 4; q++) {
    for (let drive = 0; drive < 4; drive++) {
      const clock = `${String(rand(1, 11)).padStart(2, "0")}:${String(rand(0, 59)).padStart(2, "0")}`;
      const isHomePoss = possession === scheduledGame.homeId;
      const stats = isHomePoss ? homeStats : awayStats;
      const team = isHomePoss ? home : away;
      const yards = Math.max(0, Number(stats.passYards || 0) + Number(stats.rushYards || 0));
      const playText = possession === "team_stroud" ? stroudPlayName() : opponentPlayName(team);

      const shouldScore = scoringIndex < scoringEvents.length && Math.random() < 0.38;
      if (shouldScore) {
        const score = scoringEvents[scoringIndex++];
        possession = score.side === "home" ? scheduledGame.homeId : scheduledGame.awayId;
        if (score.side === "home") homeScore += score.points;
        else awayScore += score.points;
        yard = score.points === 3 ? rand(65, 82) : rand(88, 99);
        eventPush(q, clock, score.title, `${getTeam(possession).name} finishes the drive for ${score.points} points.`, true);
      } else {
        const gain = clamp(Math.round(yards / 9 + rand(-8, 14)), -4, 42);
        yard = isHomePoss ? clamp(yard + gain, 1, 99) : clamp(yard - gain, 1, 99);
        if (gain >= 25) eventPush(q, clock, "Big Gain", `${playText} breaks loose for ${gain} yards.`, true);
        else if (gain >= 8) eventPush(q, clock, "First Down", `${playText} keeps the chains moving.`);
        else eventPush(q, clock, "Drive Stalls", `${team.name} punts it away.`);
      }

      possession = possession === scheduledGame.homeId ? scheduledGame.awayId : scheduledGame.homeId;
    }
  }

  while (scoringIndex < scoringEvents.length) {
    const score = scoringEvents[scoringIndex++];
    possession = score.side === "home" ? scheduledGame.homeId : scheduledGame.awayId;
    if (score.side === "home") homeScore += score.points;
    else awayScore += score.points;
    yard = score.points === 3 ? rand(65, 82) : rand(88, 99);
    eventPush(4, "0:30", score.title, `${getTeam(possession).name} adds late points.`, true);
  }

  homeScore = homeFinal;
  awayScore = awayFinal;
  eventPush(4, "0:00", "Final Whistle", `Final: ${home.name} ${homeFinal}, ${away.name} ${awayFinal}.`, true);

  return events;
}

function buildWatchedGameEvents() {
  const scheduledGame = getCurrentStroudGameForWatch();
  const home = getTeam(scheduledGame.homeId);
  const away = getTeam(scheduledGame.awayId);
  const stroudIsHome = scheduledGame.homeId === "team_stroud";
  const stroud = getTeam("team_stroud");
  const opponent = stroudIsHome ? away : home;

  const stroudEdge = (stroud.power - opponent.power) / 18;
  const events = [];
  let homeScore = 0;
  let awayScore = 0;
  let yard = 25;
  let possession = Math.random() < 0.5 ? scheduledGame.homeId : scheduledGame.awayId;

  function pushEvent(q, clock, title, text, big = false) {
    events.push({
      homeId: scheduledGame.homeId,
      awayId: scheduledGame.awayId,
      homeScore,
      awayScore,
      quarter: `Q${q}`,
      clock,
      downText: `${getTeam(possession).name} ball • ${yardLabel(yard)}`,
      fieldPct: clamp(yard, 2, 98),
      title,
      text,
      big
    });
  }

  pushEvent(1, "12:00", "Kickoff", `${home.name} and ${away.name} are underway under the lights.`);

  for (let q = 1; q <= 4; q++) {
    for (let drive = 0; drive < 4; drive++) {
      const clock = `${String(rand(1, 11)).padStart(2, "0")}:${String(rand(0, 59)).padStart(2, "0")}`;
      const offenseIsStroud = possession === "team_stroud";
      const edge = offenseIsStroud ? stroudEdge : -stroudEdge;
      const driveQuality = rand(-18, 18) + edge * 10;
      const startYard = rand(18, 36);
      yard = possession === scheduledGame.homeId ? startYard : 100 - startYard;

      const playName = offenseIsStroud ? stroudPlayName() : opponentPlayName(opponent);
      const gained = clamp(Math.round(25 + driveQuality + rand(-12, 28)), -5, 76);
      const turnover = Math.random() < (driveQuality < -8 ? 0.18 : 0.08);
      const scoreChance = gained > 52 || driveQuality > 20 || Math.random() < 0.16 + edge * 0.05;

      if (turnover) {
        const defender = choice(DEFENSE_POSITIONS.map(pos => getPlayer(game.depth.defense[pos]?.[0])).filter(Boolean));
        pushEvent(q, clock, "Turnover!", offenseIsStroud
          ? `${opponent.name} forces a takeaway and flips the field.`
          : `${defender?.name || "The Tigers defense"} comes up with a huge takeaway.`, true);
        possession = possession === scheduledGame.homeId ? scheduledGame.awayId : scheduledGame.homeId;
        continue;
      }

      yard = possession === scheduledGame.homeId ? clamp(yard + gained, 1, 99) : clamp(yard - gained, 1, 99);

      if (scoreChance) {
        const td = Math.random() < 0.78;
        const points = td ? 7 : 3;
        if (possession === scheduledGame.homeId) homeScore += points;
        else awayScore += points;
        pushEvent(q, clock, td ? "Touchdown!" : "Field Goal", `${playName} finishes the drive for ${points} points.`, true);
      } else if (gained > 28) {
        pushEvent(q, clock, "Big Gain", `${playName} breaks loose for ${gained} yards and changes field position.`, true);
      } else if (gained > 8) {
        pushEvent(q, clock, "First Down", `${playName} keeps the chains moving.`);
      } else {
        pushEvent(q, clock, "Drive Stalls", `${getTeam(possession).name} cannot finish the drive and punts it away.`);
      }

      possession = possession === scheduledGame.homeId ? scheduledGame.awayId : scheduledGame.homeId;
    }
  }

  pushEvent(4, "0:00", "Final Whistle", "The last seconds run off. Time to check the final report.", true);
  return events;
}

function getCurrentStroudGameForWatch() {
  if (game.phase === "regular") {
    return game.schedule.find(item => item.week === game.week && !item.played && (item.homeId === "team_stroud" || item.awayId === "team_stroud"));
  }
  return game.playoffBracket.find(item => !item.played && (item.homeId === "team_stroud" || item.awayId === "team_stroud"));
}

function yardLabel(yard) {
  if (yard === 50) return "midfield";
  if (yard < 50) return `own ${yard}`;
  return `opp ${100 - yard}`;
}

function stroudPlayName() {
  const offense = game.settings.offense;
  const qb = getPlayer(game.depth.offense.QB?.[0]);
  const rb = getPlayer(game.depth.offense.RB?.[0]);
  const fb = getPlayer(game.depth.offense.FB?.[0]);
  const wr = choice(["WR1", "WR2", "WR3", "TE"].map(pos => getPlayer(game.depth.offense[pos]?.[0])).filter(Boolean));
  if (["Wing-T", "Power-I", "Wishbone", "Flexbone", "Option"].includes(offense)) {
    return choice([
      `${fb?.name || "The fullback"} pounds inside`,
      `${rb?.name || "The tailback"} hits the edge`,
      `${qb?.name || "The quarterback"} sells the fake and keeps it`
    ]);
  }
  return choice([
    `${qb?.name || "The quarterback"} finds ${wr?.name || "a receiver"}`,
    `${rb?.name || "The back"} slips through the second level`,
    `${wr?.name || "A receiver"} wins outside`
  ]);
}

function opponentPlayName(opponent) {
  return choice([
    `${opponent.name} attacks the edge`,
    `${opponent.name} hits a quick pass`,
    `${opponent.name} leans on the run game`,
    `${opponent.name} catches Stroud in a bad angle`
  ]);
}


function checkOffseasonAfterAdvance() {
  if (game.phase !== "playoffs") return;

  const stroudAlive = (game.playoffBracket || []).some(g =>
    !g.played && (g.homeId === "team_stroud" || g.awayId === "team_stroud")
  );
  const anyUnplayed = (game.playoffBracket || []).some(g => !g.played);

  if (!stroudAlive || !anyUnplayed) {
    enterOffseason(stroudAlive ? "Stroud finished the state tournament." : "Stroud's playoff run ended. The state tournament has been completed.");
  }
}

function advanceWeek() {
  if (!game) {
    createNewDynastyIntro();
    return;
  }

  playSound("click");
  closeModal();

  if (game.phase === "intro") {
    showIntroNewspaper();
    return;
  }

  if ((game.phase === "regular" || game.phase === "playoffs") && currentWeekHasStroudGame()) {
    const missing = validateDepthChartForGame();
    if (missing.length) {
      showDepthChartWarning(missing);
      return;
    }
  }

  if (game.phase === "regular") {
    runRegularWeek();
    if (game.week > 10) seedPlayoffs();
  } else if (game.phase === "playoffs") {
    runPlayoffRound();
  } else {
    startNextSeason();
  }

  saveLocal();
  render();
  if (!suppressAdvancePopups) showFinalResultThenPaper();
  checkOffseasonAfterAdvance();
}

function runRegularWeek() {
  recalculateTeamRatings();

  const week = game.week;
  const games = game.schedule.filter(item => item.week === week && !item.played);

  for (const scheduledGame of games) {
    simulateGame(scheduledGame);
  }

  weeklyPractice();

  game.rankings = rankTeams();
  game.leaders = stateLeaders();
  game.paper = makeWeeklyPaper(week, games);

  updateRecords();
  game.week += 1;
}


function p2Avg(values, fallback = 50) {
  const clean = values.map(v => Number(v)).filter(v => Number.isFinite(v));
  if (!clean.length) return fallback;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function statOf(player, key, fallback = 50) {
  if (!player) return fallback;
  const aliases = {
    carry: ["carry", "ballCarrying"],
    ballCarrying: ["ballCarrying", "carry"],
    accel: ["accel", "acceleration"],
    acceleration: ["acceleration", "accel"]
  }[key] || [key];

  for (const alias of aliases) {
    const value = Number(player.stats?.[alias]);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
}

function activeSchemeForTeam(team) {
  return team.id === "team_stroud" ? game.settings.offense : team.offense;
}

function schemeRunRate(scheme) {
  const profile = SCHEME_PROFILES[scheme] || SCHEME_PROFILES["Pro Style"];
  const match = profile.runPass.match(/(\d+)% run/);
  return clamp(Number(match?.[1] || 50) / 100, 0.12, 0.90);
}

function getDepthPlayer(depth, side, pos, slot = 0) {
  return getPlayer(depth?.[side]?.[pos]?.[slot]);
}

function pbpOffenseRoster(team, activeDepth) {
  if (team.id !== "team_stroud") return null;

  return {
    QB: getDepthPlayer(activeDepth, "offense", "QB"),
    RB: getDepthPlayer(activeDepth, "offense", "RB"),
    FB: getDepthPlayer(activeDepth, "offense", "FB"),
    WR1: getDepthPlayer(activeDepth, "offense", "WR1"),
    WR2: getDepthPlayer(activeDepth, "offense", "WR2"),
    WR3: getDepthPlayer(activeDepth, "offense", "WR3"),
    TE: getDepthPlayer(activeDepth, "offense", "TE"),
    LT: getDepthPlayer(activeDepth, "offense", "LT"),
    LG: getDepthPlayer(activeDepth, "offense", "LG"),
    C: getDepthPlayer(activeDepth, "offense", "C"),
    RG: getDepthPlayer(activeDepth, "offense", "RG"),
    RT: getDepthPlayer(activeDepth, "offense", "RT")
  };
}

function pbpDefenseRoster(team, activeDepth) {
  if (team.id !== "team_stroud") return null;
  const out = {};
  for (const pos of DEFENSE_POSITIONS) out[pos] = getDepthPlayer(activeDepth, "defense", pos);
  return out;
}

function pbpLineGrade(roster) {
  if (!roster) return 50;
  return p2Avg(["LT", "LG", "C", "RG", "RT"].map(pos => {
    const p = roster[pos];
    return p2Avg([statOf(p, "blocking"), statOf(p, "strength"), statOf(p, "agility")], 45);
  }), 50);
}

function pbpRunTalent(team, scheme, roster) {
  if (team.id !== "team_stroud") return team.offenseRating || team.power || 50;

  const qb = roster.QB;
  const rb = roster.RB;
  const fb = roster.FB;
  const line = pbpLineGrade(roster);
  const qbRun = p2Avg([statOf(qb, "speed"), statOf(qb, "agility"), statOf(qb, "carry"), statOf(qb, "vision")]);
  const rbRun = p2Avg([statOf(rb, "speed"), statOf(rb, "agility"), statOf(rb, "carry"), statOf(rb, "vision")]);
  const fbRun = p2Avg([statOf(fb, "strength"), statOf(fb, "carry"), statOf(fb, "blocking"), statOf(fb, "vision")]);

  if (["Option", "Flexbone"].includes(scheme)) return qbRun * .34 + rbRun * .24 + fbRun * .14 + line * .28;
  if (scheme === "Wing-T") return fbRun * .30 + rbRun * .26 + qbRun * .10 + line * .34;
  if (["Power-I", "Wishbone"].includes(scheme)) return rbRun * .31 + fbRun * .23 + qbRun * .08 + line * .38;
  return rbRun * .34 + qbRun * .08 + line * .36 + 8;
}

function pbpPassTalent(team, scheme, roster) {
  if (team.id !== "team_stroud") return team.offenseRating || team.power || 50;

  const qb = roster.QB;
  const receivers = [roster.WR1, roster.WR2, roster.WR3, roster.TE, roster.RB].filter(Boolean);
  const qbPass = p2Avg([statOf(qb, "armStrength"), statOf(qb, "throwAccuracy"), statOf(qb, "vision")]);
  const rec = p2Avg(receivers.map(p => p2Avg([statOf(p, "speed"), statOf(p, "catching"), statOf(p, "agility")], 45)), 45);
  return qbPass * .50 + rec * .32 + pbpLineGrade(roster) * .18;
}

function pbpDefTalent(team, activeDepth) {
  if (team.id !== "team_stroud") return team.defenseRating || team.power || 50;

  const defense = pbpDefenseRoster(team, activeDepth);
  return p2Avg(Object.values(defense).filter(Boolean).map(p =>
    p2Avg([statOf(p, "tackling"), statOf(p, "pursuit"), statOf(p, "strength"), statOf(p, "speed")], 45)
  ), 50);
}

function pbpRunnerWeights(scheme, roster) {
  if (!roster) return [];
  const weights = {
    "Air Raid": { QB: 0.05, RB: 0.82, FB: 0.02, WR1: 0.05, WR2: 0.04, WR3: 0.02 },
    "Spread": { QB: 0.12, RB: 0.72, FB: 0.02, WR1: 0.06, WR2: 0.05, WR3: 0.03 },
    "Pro Style": { QB: 0.06, RB: 0.76, FB: 0.10, WR1: 0.03, WR2: 0.03, TE: 0.02 },
    "Option": { QB: 0.36, RB: 0.34, FB: 0.22, WR1: 0.04, WR2: 0.04 },
    "Wing-T": { QB: 0.10, RB: 0.36, FB: 0.38, WR1: 0.08, WR2: 0.08 },
    "Power-I": { QB: 0.04, RB: 0.58, FB: 0.32, TE: 0.03, WR1: 0.03 },
    "Flexbone": { QB: 0.34, RB: 0.30, FB: 0.30, WR1: 0.03, WR2: 0.03 },
    "Wishbone": { QB: 0.22, RB: 0.38, FB: 0.34, WR1: 0.03, WR2: 0.03 }
  }[scheme] || { QB: .08, RB: .75, FB: .08, WR1: .04, WR2: .03, TE: .02 };

  return Object.entries(weights)
    .map(([pos, weight]) => ({ id: roster[pos]?.id, player: roster[pos], pos, weight }))
    .filter(item => item.player && item.weight > 0);
}

function pbpReceiverWeights(scheme, roster) {
  if (!roster) return [];
  const weights = {
    "Air Raid": { WR1: 0.28, WR2: 0.25, WR3: 0.22, TE: 0.12, RB: 0.13 },
    "Spread": { WR1: 0.25, WR2: 0.22, WR3: 0.18, TE: 0.15, RB: 0.20 },
    "Pro Style": { WR1: 0.25, WR2: 0.20, TE: 0.24, RB: 0.18, FB: 0.04, WR3: 0.09 },
    "Option": { WR1: 0.35, WR2: 0.25, TE: 0.20, RB: 0.12, FB: 0.08 },
    "Wing-T": { WR1: 0.30, WR2: 0.24, TE: 0.24, RB: 0.12, FB: 0.10 },
    "Power-I": { WR1: 0.25, WR2: 0.20, TE: 0.26, RB: 0.14, FB: 0.15 },
    "Flexbone": { WR1: 0.32, WR2: 0.24, TE: 0.20, RB: 0.14, FB: 0.10 },
    "Wishbone": { WR1: 0.30, WR2: 0.22, TE: 0.22, RB: 0.14, FB: 0.12 }
  }[scheme] || { WR1: .26, WR2: .22, WR3: .16, TE: .18, RB: .18 };

  return Object.entries(weights)
    .map(([pos, weight]) => ({ id: roster[pos]?.id, player: roster[pos], pos, weight }))
    .filter(item => item.player && item.weight > 0);
}

function pickWeightedObject(items) {
  const clean = items.filter(item => item && Number(item.weight) > 0);
  if (!clean.length) return null;
  const total = clean.reduce((sum, item) => sum + Number(item.weight), 0);
  let roll = Math.random() * total;
  for (const item of clean) {
    roll -= Number(item.weight);
    if (roll <= 0) return item;
  }
  return clean[clean.length - 1];
}

function pbpAddLine(lines, player, stats) {
  if (!player) return;
  if (!lines[player.id]) lines[player.id] = { player: player.name, grade: player.grade, stats: {} };
  for (const [key, value] of Object.entries(stats)) {
    const v = Math.round(Number(value) || 0);
    if (v) lines[player.id].stats[key] = (lines[player.id].stats[key] || 0) + v;
  }
}

function pbpAddSeasonStats(player, stats) {
  if (!player) return;
  addStats(player, stats);
}

function pbpClock(q, playIndex) {
  const playsPerQ = 28;
  const remaining = clamp(12 * 60 - Math.round((playIndex % playsPerQ) * (12 * 60 / playsPerQ)), 0, 12 * 60);
  return `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
}

function pbpYardLabel(yard, offenseSide) {
  const y = offenseSide === "home" ? yard : 100 - yard;
  if (y === 50) return "midfield";
  if (y < 50) return `own ${y}`;
  return `opp ${100 - y}`;
}

function pbpUpdateTopLevelStats(scheduledGame) {
  for (const side of ["home", "away"]) {
    const s = scheduledGame.stats[side];
    s.passYards = Math.round(s.passYards || 0);
    s.rushYards = Math.round(s.rushYards || 0);
    s.totalYards = s.passYards + s.rushYards;
    s.turnovers = Math.round(s.turnovers || 0);
    s.passTD = Math.round(s.passTD || 0);
    s.rushTD = Math.round(s.rushTD || 0);
  }
}

function pbpFinalizeStroudStats(scheduledGame, playerLines) {
  scheduledGame.playerStats = Object.values(playerLines)
    .filter(line => Object.keys(line.stats || {}).length)
    .sort((a, b) => {
      const av = (a.stats.passYards || 0) + (a.stats.rushYards || 0) + (a.stats.recYards || 0) + (a.stats.tackles || 0) * 4;
      const bv = (b.stats.passYards || 0) + (b.stats.rushYards || 0) + (b.stats.recYards || 0) + (b.stats.tackles || 0) * 4;
      return bv - av;
    })
    .slice(0, 20);

  const stroudSide = scheduledGame.homeId === "team_stroud" ? "home" : "away";
  const playerPass = scheduledGame.playerStats.reduce((sum, line) => sum + (line.stats.passYards || 0), 0);
  const playerRush = scheduledGame.playerStats.reduce((sum, line) => sum + (line.stats.rushYards || 0), 0);
  scheduledGame.stats[stroudSide].passYards = playerPass;
  scheduledGame.stats[stroudSide].rushYards = playerRush;
  scheduledGame.stats[stroudSide].totalYards = playerPass + playerRush;
}

function pbpPlayDescription(play) {
  if (play.kind === "run") return `${play.playerName} runs for ${play.yards} yards.`;
  if (play.kind === "pass") return `${play.qbName} hits ${play.playerName} for ${play.yards} yards.`;
  if (play.kind === "incomplete") return `${play.qbName} throws incomplete.`;
  if (play.kind === "sack") return `${play.qbName} is sacked for ${Math.abs(play.yards)}.`;
  if (play.kind === "interception") return `${play.qbName} is intercepted.`;
  if (play.kind === "fumble") return `${play.playerName} loses the football.`;
  return play.text || "Play.";
}

function pbpMakeWatchEvent(scheduledGame, state, title, text, big = false) {
  return {
    homeId: scheduledGame.homeId,
    awayId: scheduledGame.awayId,
    homeScore: state.homeScore,
    awayScore: state.awayScore,
    quarter: `Q${state.quarter}`,
    clock: pbpClock(state.quarter, state.playIndex),
    downText: `${state.down} & ${state.distance} • ${pbpYardLabel(state.yard, state.offenseSide)}`,
    fieldPct: clamp(state.yard, 2, 98),
    title,
    text,
    big
  };
}





function scaleStroudPlayerLinesToTeam(scheduledGame, playerLines, statKey, target) {
  const lines = Object.values(playerLines || {});
  const current = lines.reduce((sum, line) => sum + Number(line.stats?.[statKey] || 0), 0);
  if (!current || current <= target) return;

  const ratio = target / current;
  for (const line of lines) {
    if (line.stats && line.stats[statKey]) line.stats[statKey] = Math.round(line.stats[statKey] * ratio);
  }

  const player = null;
}

function enforceGameStatRealism(scheduledGame, playerLines) {
  const home = getTeam(scheduledGame.homeId) || {};
  const away = getTeam(scheduledGame.awayId) || {};
  const gap = Math.abs(Number(home.power || 50) - Number(away.power || 50));
  const maxTotal = gap > 28 ? 620 : gap > 18 ? 560 : 500;

  for (const side of ["home", "away"]) {
    const s = scheduledGame.stats?.[side];
    if (!s) continue;
    const total = Number(s.passYards || 0) + Number(s.rushYards || 0);
    if (total <= maxTotal) {
      s.totalYards = total;
      continue;
    }

    const ratio = maxTotal / total;
    s.passYards = Math.round(Number(s.passYards || 0) * ratio);
    s.rushYards = Math.round(Number(s.rushYards || 0) * ratio);
    s.totalYards = s.passYards + s.rushYards;
  }

  const stroudSide = scheduledGame.homeId === "team_stroud" ? "home" : scheduledGame.awayId === "team_stroud" ? "away" : null;
  if (stroudSide && playerLines) {
    const s = scheduledGame.stats[stroudSide];
    scaleStroudPlayerLinesToTeam(scheduledGame, playerLines, "passYards", s.passYards);
    scaleStroudPlayerLinesToTeam(scheduledGame, playerLines, "rushYards", s.rushYards);
    scaleStroudPlayerLinesToTeam(scheduledGame, playerLines, "recYards", s.passYards);
  }
}


function simulateGame(scheduledGame) {
  if (typeof syncStroudTeamSchemes === 'function') syncStroudTeamSchemes();

  const home = getTeam(scheduledGame.homeId);
  const away = getTeam(scheduledGame.awayId);
  if (!home || !away) return;

  const activeDepth = JSON.parse(JSON.stringify(game.depth || emptyDepthChart()));
  const homeScheme = activeSchemeForTeam(home);
  const awayScheme = activeSchemeForTeam(away);
  const homeRoster = pbpOffenseRoster(home, activeDepth);
  const awayRoster = pbpOffenseRoster(away, activeDepth);

  const playerLines = {};
  const watchEvents = [];
  scheduledGame.log = [];
  scheduledGame.injuries = scheduledGame.injuries || [];
  scheduledGame.stats = {
    home: { scheme: homeScheme, passYards: 0, rushYards: 0, totalYards: 0, turnovers: 0, passTD: 0, rushTD: 0 },
    away: { scheme: awayScheme, passYards: 0, rushYards: 0, totalYards: 0, turnovers: 0, passTD: 0, rushTD: 0 }
  };

  const state = {
    homeScore: 0,
    awayScore: 0,
    quarter: 1,
    playIndex: 0,
    offenseSide: "home",
    defenseSide: "away",
    down: 1,
    distance: 10,
    yard: 25
  };

  function teamForSide(side) {
    return side === "home" ? home : away;
  }

  function rosterForSide(side) {
    return side === "home" ? homeRoster : awayRoster;
  }

  function score(side, points, type) {
    if (side === "home") state.homeScore += points;
    else state.awayScore += points;

    if (type === "passTD") scheduledGame.stats[side].passTD += 1;
    if (type === "rushTD") scheduledGame.stats[side].rushTD += 1;
  }

  function addWatch(title, text, big = false) {
    watchEvents.push(pbpMakeWatchEvent(scheduledGame, state, title, text, big));
  }

  addWatch("Kickoff", `${home.name} and ${away.name} are underway under the lights.`);

  let possessionSide = "home";
  let driveCount = 0;
  const maxDrives = 22;

  while (driveCount < maxDrives) {
    driveCount += 1;
    state.offenseSide = possessionSide;
    state.defenseSide = possessionSide === "home" ? "away" : "home";
    state.down = 1;
    state.distance = 10;
    state.yard = possessionSide === "home" ? rand(22, 35) : rand(65, 78);

    const offense = teamForSide(state.offenseSide);
    const defense = teamForSide(state.defenseSide);
    const offenseRoster = rosterForSide(state.offenseSide);
    const scheme = activeSchemeForTeam(offense);
    const runRate = schemeRunRate(scheme);
    const runTalent = pbpRunTalent(offense, scheme, offenseRoster);
    const passTalent = pbpPassTalent(offense, scheme, offenseRoster);
    const defTalent = pbpDefTalent(defense, activeDepth);
    const advantage = ((runTalent + passTalent) / 2) - defTalent + (state.offenseSide === "home" ? 1.5 : 0);

    for (let playInDrive = 0; playInDrive < 10; playInDrive++) {
      state.playIndex += 1;
      state.quarter = clamp(Math.floor((state.playIndex - 1) / 32) + 1, 1, 4);

      if (state.quarter > 4) break;

      if (state.playIndex % 32 === 1 && state.playIndex > 1) {
        processQuarterInjuries(scheduledGame, state.quarter, activeDepth);
      }

      const sideStats = scheduledGame.stats[state.offenseSide];
      const isRun = Math.random() < runRate;
      const turnoverRoll = Math.random();
      let yards = 0;
      let title = "Play";
      let text = "";
      let big = false;
      let firstDownOrScore = false;

      if (isRun) {
        const runners = pbpRunnerWeights(scheme, offenseRoster);
        const runnerObj = offense.id === "team_stroud"
          ? pickWeightedObject(runners)
          : null;
        const runner = runnerObj?.player || null;
        const runnerName = runner?.name || choice(["the tailback", "the quarterback", "the fullback"]);

        const talent = offense.id === "team_stroud"
          ? p2Avg([statOf(runner, "speed"), statOf(runner, "agility"), statOf(runner, "carry"), statOf(runner, "vision"), pbpLineGrade(offenseRoster)], runTalent)
          : runTalent;

        const ypcBase = 3.55 + (talent - defTalent) * 0.042 + advantage * 0.014;
        yards = Math.round(clamp(bell(ypcBase, 3.9, -4, 28), -6, 55));

        if (Math.random() < 0.018 + Math.max(0, defTalent - talent) / 900) {
          sideStats.turnovers += 1;
          if (Math.random() < 0.18) {
            score(state.defenseSide, 7, "defTD");
            addWatch("Defensive Touchdown!", `${defense.name} scoops it and scores.`, true);
          }
          if (runner) {
            pbpAddSeasonStats(runner, { games: 1 });
            pbpAddLine(playerLines, runner, {});
          }
          addWatch("Fumble!", `${offense.name} coughs it up after a run.`, true);
          break;
        }

        sideStats.rushYards += yards;
        if (runner) {
          pbpAddSeasonStats(runner, { games: 1, rushYards: yards });
          pbpAddLine(playerLines, runner, { rushYards: yards });
        }

        title = yards >= 20 ? "Big Run" : yards >= state.distance ? "First Down Run" : "Run";
        text = `${runnerName} runs for ${yards} yards.`;
        big = yards >= 20;
      } else {
        const qb = offenseRoster?.QB || null;
        const qbName = qb?.name || "the quarterback";
        const receivers = pbpReceiverWeights(scheme, offenseRoster);
        const receiverObj = offense.id === "team_stroud" ? pickWeightedObject(receivers) : null;
        const receiver = receiverObj?.player || null;
        const receiverName = receiver?.name || choice(["a receiver", "the tight end", "the back"]);

        const qbTalent = offense.id === "team_stroud"
          ? p2Avg([statOf(qb, "armStrength"), statOf(qb, "throwAccuracy"), statOf(qb, "vision")], passTalent)
          : passTalent;
        const recTalent = receiver ? p2Avg([statOf(receiver, "catching"), statOf(receiver, "speed"), statOf(receiver, "agility")], 50) : passTalent;
        const throwTalent = p2Avg([qbTalent, recTalent, pbpLineGrade(offenseRoster)], passTalent);
        const completeChance = clamp(0.52 + (throwTalent - defTalent) / 210, 0.32, 0.74);

        if (turnoverRoll < 0.025 + Math.max(0, defTalent - throwTalent) / 700) {
          sideStats.turnovers += 1;
          if (Math.random() < 0.16) {
            score(state.defenseSide, 7, "defTD");
            addWatch("Pick Six!", `${defense.name} takes it back the other way.`, true);
          }
          if (qb) pbpAddSeasonStats(qb, { games: 1, intThrown: 1 });
          addWatch("Interception!", `${qbName} is picked off.`, true);
          break;
        }

        if (Math.random() > completeChance) {
          title = "Incomplete";
          text = `${qbName} throws incomplete.`;
          yards = 0;
        } else {
          yards = Math.round(clamp(bell(7.4 + (throwTalent - defTalent) * 0.052, 6.4, -2, 38), -4, 62));
          sideStats.passYards += Math.max(0, yards);

          if (qb) {
            pbpAddSeasonStats(qb, { games: 1, passYards: Math.max(0, yards) });
            pbpAddLine(playerLines, qb, { passYards: Math.max(0, yards) });
          }
          if (receiver && yards > 0) {
            pbpAddSeasonStats(receiver, { games: 1, catches: 1, recYards: yards });
            pbpAddLine(playerLines, receiver, { catches: 1, recYards: yards });
          }

          title = yards >= 20 ? "Big Pass" : yards >= state.distance ? "First Down Pass" : "Completion";
          text = `${qbName} hits ${receiverName} for ${yards} yards.`;
          big = yards >= 20;
        }
      }

      const newYard = state.offenseSide === "home" ? state.yard + yards : state.yard - yards;
      const scoredTD = state.offenseSide === "home" ? newYard >= 100 : newYard <= 0;

      if (scoredTD) {
        const tdType = isRun ? "rushTD" : "passTD";
        score(state.offenseSide, 7, tdType);
        if (isRun) {
          const runner = offense.id === "team_stroud" ? pickWeightedObject(pbpRunnerWeights(scheme, offenseRoster))?.player : null;
          // Do not double-count yards here; only add TD if player line exists from play.
          if (runner) {
            pbpAddSeasonStats(runner, { rushTD: 1 });
            pbpAddLine(playerLines, runner, { rushTD: 1 });
          }
        } else {
          const qb = offenseRoster?.QB || null;
          if (qb) {
            pbpAddSeasonStats(qb, { passTD: 1 });
            pbpAddLine(playerLines, qb, { passTD: 1 });
          }
        }
        addWatch("Touchdown!", `${offense.name} finds the end zone.`, true);
        firstDownOrScore = true;
        break;
      }

      state.yard = clamp(newYard, 1, 99);
      state.distance -= yards;

      if (state.distance <= 0) {
        state.down = 1;
        state.distance = 10;
        firstDownOrScore = true;
      } else {
        state.down += 1;
      }

      addWatch(title, text, big);

      if (state.down > 4) {
        if (state.offenseSide === "home" ? state.yard >= 72 : state.yard <= 28) {
          const fgGood = Math.random() < clamp(0.58 + advantage / 120, 0.30, 0.78);
          if (fgGood) {
            score(state.offenseSide, 3, "fg");
            addWatch("Field Goal", `${offense.name} adds three.`, true);
          } else {
            addWatch("Missed Field Goal", `${offense.name} comes up empty.`, false);
          }
        } else {
          addWatch("Punt", `${offense.name} punts it away.`, false);
        }
        break;
      }
    }

    possessionSide = possessionSide === "home" ? "away" : "home";
  }

  // Prevent ties.
  if (state.homeScore === state.awayScore) {
    const winner = (home.power + rand(-10, 10)) >= (away.power + rand(-10, 10)) ? "home" : "away";
    score(winner, 3, "fg");
    state.offenseSide = winner;
    state.yard = winner === "home" ? 78 : 22;
    state.down = 4;
    state.distance = 4;
    state.quarter = 4;
    addWatch("Late Field Goal", `${teamForSide(winner).name} wins it late.`, true);
  }

  scheduledGame.homeScore = state.homeScore;
  scheduledGame.awayScore = state.awayScore;
  scheduledGame.played = true;
  scheduledGame.watchEvents = watchEvents;
  scheduledGame.playLog = watchEvents.map(event => ({
    quarter: event.quarter,
    clock: event.clock,
    title: event.title,
    text: event.text,
    homeScore: event.homeScore,
    awayScore: event.awayScore
  }));

  pbpUpdateTopLevelStats(scheduledGame);
  enforceGameStatRealism(scheduledGame, playerLines);

  // Defensive Stroud stats from opponent plays. Not perfect yet, but grounded to play volume.
  if (scheduledGame.homeId === "team_stroud" || scheduledGame.awayId === "team_stroud") {
    const stroudDefenseSide = scheduledGame.homeId === "team_stroud" ? "home" : "away";
    const opponentStats = scheduledGame.stats[stroudDefenseSide === "home" ? "away" : "home"];
    const defensivePlays = clamp(Math.round(((opponentStats.rushYards + opponentStats.passYards) / 7) + 30 + opponentStats.turnovers * 3), 28, 70);
    const defenders = DEFENSE_POSITIONS.map(pos => getDepthPlayer(activeDepth, "defense", pos)).filter(Boolean);
    const tackleWeights = defenders.map(player => ({
      id: player.id,
      player,
      weight: p2Avg([statOf(player, "tackling"), statOf(player, "pursuit"), statOf(player, "speed")], 50)
    }));
    const tackleShares = boundedShares(defensivePlays, tackleWeights, 13);
    for (const [id, tackles] of Object.entries(tackleShares)) {
      const defender = getPlayer(id);
      if (!defender || tackles <= 0) continue;
      const sacks = Math.random() < 0.12 && tackles >= 3 ? 1 : 0;
      const interceptions = Math.random() < 0.08 && tackles >= 2 ? 1 : 0;
      pbpAddSeasonStats(defender, { games: 1, tackles, sacks, interceptions });
      pbpAddLine(playerLines, defender, { tackles, sacks, interceptions });
    }

    pbpFinalizeStroudStats(scheduledGame, playerLines);
    enforceGameStatRealism(scheduledGame, playerLines);
    pbpFinalizeStroudStats(scheduledGame, playerLines);
    updateRivalryRecord(scheduledGame);
    adjustPrestigeForGame(scheduledGame);

    const starters = new Set([
      ...Object.values(activeDepth.offense).map(slots => slots[0]),
      ...Object.values(activeDepth.defense).map(slots => slots[0])
    ].filter(Boolean));
    for (const playerId of starters) {
      const player = getPlayer(playerId);
      revealTrait(player, "gamer", rand(4, 9));
      revealTrait(player, "footballIQ", rand(2, 6));
      if (Math.abs(state.homeScore - state.awayScore) <= 14 || scheduledGame.playoff) revealTrait(player, "clutch", rand(4, 10));
    }
  }

  applyTeamResult(home, away, state.homeScore, state.awayScore, scheduledGame.district);
}

function simulateScore(home, away) {
  const homeField = 2.2;
  const powerGap = home.power - away.power + homeField;

  let homeBase = 23 + (home.offenseRating - away.defenseRating) * 0.38 + powerGap * 0.18;
  let awayBase = 22 + (away.offenseRating - home.defenseRating) * 0.38 - powerGap * 0.18;

  if (Math.abs(powerGap) > 28) {
    if (powerGap > 0) {
      homeBase += 11;
      awayBase -= 8;
    } else {
      awayBase += 11;
      homeBase -= 8;
    }
  }

  let homeScore = Math.round(clamp(homeBase + bell(0, 7, -18, 18), 0, 70));
  let awayScore = Math.round(clamp(awayBase + bell(0, 7, -18, 18), 0, 70));

  if (Math.abs(powerGap) > 35) {
    if (powerGap > 0) {
      homeScore = clamp(rand(42, 63) + Math.round((powerGap - 35) * 0.25), 35, 76);
      awayScore = clamp(rand(0, 14) - Math.round((powerGap - 35) * 0.08), 0, 21);
    } else {
      awayScore = clamp(rand(42, 63) + Math.round((-powerGap - 35) * 0.25), 35, 76);
      homeScore = clamp(rand(0, 14) - Math.round((-powerGap - 35) * 0.08), 0, 21);
    }
  }

  if (homeScore === awayScore) {
    if (Math.random() < 0.5) homeScore += rand(1, 7);
    else awayScore += rand(1, 7);
  }

  return [homeScore, awayScore];
}


function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function playerStatValue(player, key) {
  return safeNumber(player?.stats?.[key], 50);
}

function playerFitValue(player, position) {
  if (!player) return 35;
  try {
    return safeNumber(positionFit(player, position), 45);
  } catch {
    return 45;
  }
}

function depthStarter(side, position) {
  return getPlayer(game?.depth?.[side]?.[position]?.[0]);
}

function boundedShares(total, weightedIds, maxEach = 999) {
  const clean = weightedIds
    .filter(item => item.id !== undefined && item.id !== null && item.id !== "" && safeNumber(item.weight) > 0)
    .map(item => ({ id: item.id, weight: safeNumber(item.weight) }));

  const out = {};
  total = Math.max(0, Math.round(safeNumber(total)));

  if (!clean.length || total <= 0) return out;

  const weightTotal = clean.reduce((sum, item) => sum + item.weight, 0);
  let assigned = 0;

  clean.forEach((item, index) => {
    const amount = index === clean.length - 1
      ? Math.max(0, total - assigned)
      : Math.min(maxEach, Math.floor(total * item.weight / weightTotal));
    out[item.id] = amount;
    assigned += amount;
  });

  let guard = 0;
  while (assigned < total && guard < 5000) {
    guard++;
    const item = clean[guard % clean.length];
    if ((out[item.id] || 0) < maxEach) {
      out[item.id] = (out[item.id] || 0) + 1;
      assigned++;
    } else if (clean.every(entry => (out[entry.id] || 0) >= maxEach)) {
      break;
    }
  }

  return out;
}

function chooseWeighted(entries) {
  const clean = entries.filter(item => item.id !== undefined && item.id !== null && safeNumber(item.weight) > 0);
  if (!clean.length) return null;
  const total = clean.reduce((sum, item) => sum + safeNumber(item.weight), 0);
  let roll = Math.random() * total;
  for (const item of clean) {
    roll -= safeNumber(item.weight);
    if (roll <= 0) return item.id;
  }
  return clean[clean.length - 1].id;
}

function sumValues(obj) {
  return Object.values(obj || {}).reduce((sum, value) => sum + Math.round(safeNumber(value)), 0);
}

function calcStroudOffenseYards(opponentTeam, homeAwayBias = 0) {
  const scheme = game.settings.offense;
  const profile = SCHEME_PROFILES[scheme] || SCHEME_PROFILES["Pro Style"];
  const qb = depthStarter("offense", "QB");
  const rb = depthStarter("offense", "RB");
  const fb = depthStarter("offense", "FB");
  const wr1 = depthStarter("offense", "WR1");
  const wr2 = depthStarter("offense", "WR2");
  const wr3 = depthStarter("offense", "WR3");
  const te = depthStarter("offense", "TE");

  const linePositions = ["LT", "LG", "C", "RG", "RT"];
  const lineGrade = avg(linePositions.map(pos => playerFitValue(depthStarter("offense", pos), pos)));
  const qbRun = (playerStatValue(qb, "speed") + playerStatValue(qb, "agility") + playerStatValue(qb, "carry") + playerStatValue(qb, "vision")) / 4;
  const qbPass = (playerStatValue(qb, "armStrength") + playerStatValue(qb, "throwAccuracy") + playerStatValue(qb, "vision")) / 3;
  const rbRun = (playerStatValue(rb, "speed") + playerStatValue(rb, "agility") + playerStatValue(rb, "carry") + playerStatValue(rb, "vision")) / 4;
  const fbRun = (playerStatValue(fb, "strength") + playerStatValue(fb, "carry") + playerStatValue(fb, "blocking") + playerStatValue(fb, "vision")) / 4;
  const passCatch = avg([wr1, wr2, wr3, te].filter(Boolean).map(p => (playerStatValue(p, "catching") + playerStatValue(p, "speed") + playerStatValue(p, "agility")) / 3), 48);

  const opponentDefense = safeNumber(opponentTeam.defenseRating || opponentTeam.power, 50);

  let runTalent;
  if (["Option", "Flexbone"].includes(scheme)) {
    runTalent = qbRun * 0.33 + rbRun * 0.25 + fbRun * 0.15 + lineGrade * 0.27;
  } else if (scheme === "Wing-T") {
    runTalent = fbRun * 0.28 + rbRun * 0.26 + qbRun * 0.12 + lineGrade * 0.34;
  } else if (scheme === "Power-I" || scheme === "Wishbone") {
    runTalent = rbRun * 0.30 + fbRun * 0.24 + qbRun * 0.10 + lineGrade * 0.36;
  } else {
    runTalent = rbRun * 0.31 + qbRun * 0.08 + lineGrade * 0.31 + passCatch * 0.10;
  }

  const passTalent = qbPass * 0.48 + passCatch * 0.32 + lineGrade * 0.20;
  const runAdv = runTalent - opponentDefense + homeAwayBias;
  const passAdv = passTalent - opponentDefense + homeAwayBias;

  const runShare = safeNumber(profile.run, 0.55);
  const totalPlays = clamp(Math.round(49 + runAdv * 0.08 + rand(-5, 6)), 38, 68);
  const rushAttempts = clamp(Math.round(totalPlays * runShare + rand(-3, 3)), 10, 58);
  const passAttempts = Math.max(4, totalPlays - rushAttempts);

  const ypc = clamp(3.15 + runAdv * 0.055 + rand(-55, 75) / 100, 1.4, 7.6);
  const ypa = clamp(5.2 + passAdv * 0.06 + rand(-70, 90) / 100, 2.5, 10.8);

  let rushYards = Math.round(rushAttempts * ypc);
  let passYards = Math.round(passAttempts * ypa);

  // High school realism guardrails. Great games can happen, but keep normal weeks sane.
  rushYards = clamp(rushYards, 0, 330);
  passYards = clamp(passYards, 0, 330);

  const totalYards = rushYards + passYards;
  const scoreEstimate = clamp(Math.round(totalYards / 15 + (runAdv + passAdv) / 12 + rand(-4, 5)), 0, 56);
  const turnovers = clamp(Math.round(1.4 - (qbPass + qbRun - 100) / 80 + rand(-1, 2)), 0, 5);

  return {
    scheme,
    passYards,
    rushYards,
    totalYards,
    passTD: clamp(Math.round(passYards / 95 + rand(-1, 1)), 0, 5),
    rushTD: clamp(Math.round(rushYards / 85 + rand(-1, 1)), 0, 6),
    turnovers,
    scoreEstimate
  };
}

function simulateBoxScore(team, opponent, points) {
  const profile = SCHEME_PROFILES[team.offense] || SCHEME_PROFILES["Pro Style"];
  const passNumber = Number(profile.runPass.match(/(\d+)% pass/)?.[1] || 50);
  const passRate = clamp(passNumber / 100 + rand(-5, 5) / 100, 0.1, 0.82);
  const matchup = schemeMatchupRating(team, opponent);

  // High school totals should usually live in the 180-420 range.
  // 500+ should be a rare monster night, not a normal Wing-T result.
  const totalYards = clamp(
    165 + points * 4.25 + matchup * 3.6 + bell(0, 34, -80, 95),
    45,
    520
  );

  let passing = Math.round(totalYards * passRate + bell(0, 17, -45, 45));
  let rushing = Math.round(totalYards - passing);

  passing = clamp(passing, 0, 380);
  rushing = clamp(rushing, 0, 360);

  // Rare state-record type outburst.
  if (Math.random() < 0.012 && points >= 45 && passRate < 0.45) {
    rushing = clamp(rushing + rand(45, 95), 0, 450);
  }

  const passTD = clamp(Math.round(points * passRate / 7 + rand(-1, 1)), 0, 6);
  const rushTD = clamp(Math.floor(points / 7) - passTD, 0, 7);

  return {
    passYards: passing,
    rushYards: rushing,
    totalYards: passing + rushing,
    passTD,
    rushTD,
    turnovers: rand(0, team.offenseRating < 45 ? 4 : 2),
    scheme: team.offense,
    runPass: profile.runPass,
    matchup: round1(matchup)
  };
}

function schemeMatchupRating(team, opponent) {
  if (team.id !== "team_stroud") return (team.offenseRating - opponent.defenseRating) / 5;

  const offense = startersForSide("offense");
  const scheme = game.settings.offense;

  function grade(position) {
    const player = getPlayer(offense[position]);
    return player ? positionFit(player, position) : 25;
  }

  function avgPos(positions) {
    return average(positions.map(grade));
  }

  let attack = average(OFFENSE_POSITIONS.map(grade));

  if (scheme === "Air Raid") attack = grade("QB") * 0.34 + avgPos(["WR1", "WR2", "WR3"]) * 0.42 + grade("LT") * 0.12 + grade("RB") * 0.12;
  else if (scheme === "Spread") attack = grade("QB") * 0.28 + avgPos(["WR1", "WR2", "WR3"]) * 0.32 + grade("RB") * 0.2 + avgPos(["LT", "LG", "C", "RG", "RT"]) * 0.2;
  else if (scheme === "Wing-T") attack = grade("FB") * 0.3 + avgPos(["RB", "TE"]) * 0.18 + avgPos(["LG", "RG", "C"]) * 0.34 + grade("QB") * 0.12 + avgPos(["WR1", "WR2"]) * 0.06;
  else if (scheme === "Power-I") attack = grade("RB") * 0.28 + grade("FB") * 0.2 + avgPos(["LT", "LG", "C", "RG", "RT"]) * 0.34 + grade("TE") * 0.12 + grade("QB") * 0.06;
  else if (["Option", "Flexbone", "Wishbone"].includes(scheme)) attack = grade("QB") * 0.28 + grade("FB") * 0.22 + grade("RB") * 0.22 + avgPos(["LT", "LG", "C", "RG", "RT"]) * 0.28;
  else if (scheme === "Pro Style") attack = grade("QB") * 0.24 + grade("RB") * 0.22 + grade("TE") * 0.16 + avgPos(["WR1", "WR2"]) * 0.18 + avgPos(["LT", "LG", "C", "RG", "RT"]) * 0.2;

  return (attack - opponent.defenseRating) / 6;
}

function processQuarterInjuries(scheduledGame, quarter, activeDepth) {
  if (Math.random() >= 0.5) return;

  const stroudGame = scheduledGame.homeId === "team_stroud" || scheduledGame.awayId === "team_stroud";
  const injuryHitsStroud = stroudGame && Math.random() < 0.5;

  if (!injuryHitsStroud) {
    const injuredTeam = getTeam(Math.random() < 0.5 ? scheduledGame.homeId : scheduledGame.awayId);
    scheduledGame.injuries.push({
      team: injuredTeam.name,
      player: `${choice(FIRST_NAMES)} ${choice(LAST_NAMES)}`,
      quarter,
      position: choice(["RB", "WR", "LB", "OL", "DB"]),
      backup: "backup"
    });
    return;
  }

  const activeStarters = [
    ...Object.values(participation[0].offense).map(slots => slots[0]),
    ...Object.values(participation[0].defense).map(slots => slots[0])
  ].filter(Boolean);

  if (!activeStarters.length) return;

  const injuredId = choice(activeStarters);
  const injured = getPlayer(injuredId);
  if (!injured) return;

  const replacement = findReplacement(activeDepth, injuredId);
  if (!replacement) return;

  activeDepth[replacement.side][replacement.position][0] = replacement.backupId;

  const backup = getPlayer(replacement.backupId);
  scheduledGame.injuries.push({
    team: "Stroud",
    player: injured.name,
    quarter,
    position: replacement.position,
    backup: backup?.name || "backup"
  });

  scheduledGame.log.push(
    `Q${quarter}: ${injured.name} left the game. ${backup?.name || "A backup"} finished at ${replacement.position}.`
  );

  playSound("injury");
}

function findReplacement(activeDepth, injuredId) {
  for (const side of ["offense", "defense", "special"]) {
    for (const [position, slots] of Object.entries(activeDepth[side])) {
      if (slots[0] === injuredId && slots[1]) {
        return {
          side,
          position,
          backupId: slots[1]
        };
      }
    }
  }

  return null;
}

function applyTeamResult(home, away, homeScore, awayScore, district) {
  home.record.pf += homeScore;
  home.record.pa += awayScore;
  away.record.pf += awayScore;
  away.record.pa += homeScore;

  if (homeScore > awayScore) {
    home.record.wins += 1;
    away.record.losses += 1;
    if (district) {
      home.record.districtWins += 1;
      away.record.districtLosses += 1;
    }
  } else {
    away.record.wins += 1;
    home.record.losses += 1;
    if (district) {
      away.record.districtWins += 1;
      home.record.districtLosses += 1;
    }
  }
}


function playerQuarterShares(participation) {
  const shares = {};
  for (const depth of participation) {
    const activeIds = [
      ...Object.values(depth.offense).map(slots => slots[0]),
      ...Object.values(depth.defense).map(slots => slots[0]),
      ...Object.values(depth.special).map(slots => slots[0])
    ].filter(Boolean);
    for (const playerId of activeIds) shares[playerId] = (shares[playerId] || 0) + 0.25;
  }
  return shares;
}
function scaledStat(value, share) {
  return Math.round(value * (share || 0));
}
function addGameStatLine(lines, player, stats) {
  if (!player) return;
  lines.push({ player: player.name, grade: player.grade, stats });
}



function distributeInteger(total, weights, maxEach = Infinity) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  let remaining = Math.max(0, Math.round(total));
  const output = {};

  for (const [id] of entries) output[id] = 0;
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0) || 1;

  for (const [id, weight] of entries) {
    const value = Math.min(maxEach, Math.floor(total * (weight / totalWeight)));
    output[id] = value;
    remaining -= value;
  }

  let guard = 0;
  while (remaining > 0 && guard < 10000) {
    guard += 1;
    const [id] = entries[rand(0, entries.length - 1)];
    if (output[id] < maxEach) {
      output[id] += 1;
      remaining -= 1;
    } else if (entries.every(([otherId]) => output[otherId] >= maxEach)) {
      break;
    }
  }

  return output;
}

function offensivePlayerIdsFromDepth(depth) {
  return {
    qb: depth.offense.QB?.[0],
    rb: depth.offense.RB?.[0],
    fb: depth.offense.FB?.[0],
    wr1: depth.offense.WR1?.[0],
    wr2: depth.offense.WR2?.[0],
    wr3: depth.offense.WR3?.[0],
    te: depth.offense.TE?.[0]
  };
}

function addLineIfMeaningful(lines, player, stats) {
  if (!player) return;
  const clean = {};
  for (const [key, value] of Object.entries(stats)) {
    const n = Math.round(Number(value) || 0);
    if (n !== 0) clean[key] = n;
  }
  if (Object.keys(clean).length) addGameStatLine(lines, player, clean);
}


function addToMap(map, key, value) {
  if (!key) return;
  map[key] = (map[key] || 0) + Math.round(value || 0);
}

function boundedShares(total, weightedIds, maxEach = 999) {
  const entries = weightedIds.filter(item => item.id && item.weight > 0);
  const output = {};
  if (!entries.length || total <= 0) return output;

  const weightTotal = entries.reduce((sum, item) => sum + item.weight, 0);
  let remaining = Math.round(total);

  for (const item of entries) {
    const amount = Math.min(maxEach, Math.floor(total * item.weight / weightTotal));
    output[item.id] = amount;
    remaining -= amount;
  }

  let guard = 0;
  while (remaining > 0 && guard < 2000) {
    guard++;
    const item = choice(entries);
    if ((output[item.id] || 0) < maxEach) {
      output[item.id] = (output[item.id] || 0) + 1;
      remaining--;
    } else if (entries.every(entry => (output[entry.id] || 0) >= maxEach)) {
      break;
    }
  }

  return output;
}

function sumValues(obj) {
  return Object.values(obj || {}).reduce((sum, value) => sum + Math.round(value || 0), 0);
}

function chooseWeighted(entries) {
  const clean = entries.filter(item => item.id && item.weight > 0);
  if (!clean.length) return null;
  const total = clean.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of clean) {
    roll -= item.weight;
    if (roll <= 0) return item.id;
  }
  return clean[clean.length - 1].id;
}

function rushingSharesForScheme() {
  const scheme = game.settings.offense;
  if (scheme === "Wing-T") return { qb: 0.08, rb: 0.28, fb: 0.34, wr: 0.10, other: 0.20 };
  if (["Flexbone", "Wishbone", "Option"].includes(scheme)) return { qb: 0.24, rb: 0.26, fb: 0.25, wr: 0.06, other: 0.19 };
  if (scheme === "Power-I") return { qb: 0.03, rb: 0.52, fb: 0.22, wr: 0.02, other: 0.21 };
  if (scheme === "Air Raid") return { qb: 0.06, rb: 0.68, fb: 0.02, wr: 0.04, other: 0.20 };
  if (scheme === "Spread") return { qb: 0.16, rb: 0.60, fb: 0.02, wr: 0.05, other: 0.17 };
  return { qb: 0.08, rb: 0.56, fb: 0.12, wr: 0.04, other: 0.20 };
}


function offensiveStarterByRole(role) {
  const aliases = {
    QB: ["QB"],
    RB: ["RB", "TB", "HB"],
    FB: ["FB"],
    WR1: ["WR1", "WR", "X"],
    WR2: ["WR2", "Z"],
    WR3: ["WR3", "SLOT"],
    TE: ["TE"]
  }[role] || [role];

  for (const pos of aliases) {
    const player = depthStarter("offense", pos);
    if (player) return player;
  }

  // Fallback: find a player currently assigned an offense depth role normalized to this role.
  const roles = [];
  for (const [position, slots] of Object.entries(game.depth?.offense || {})) {
    const normalized = normalizePosition(position);
    if (normalized === normalizePosition(role) || aliases.includes(position)) {
      slots.forEach(id => {
        const player = getPlayer(id);
        if (player) roles.push(player);
      });
    }
  }
  return roles[0] || null;
}

function forceRushingProductionIfMissing(teamStats) {
  if (!teamStats) return;
  const scheme = game.settings?.offense || "Pro Style";
  const runHeavy = ["Option", "Flexbone", "Wing-T", "Wishbone", "Power-I"].includes(scheme);
  if (!runHeavy || safeNumber(teamStats.rushYards) > 0) return;

  const qb = offensiveStarterByRole("QB");
  const rb = offensiveStarterByRole("RB");
  const fb = offensiveStarterByRole("FB");
  const linePositions = ["LT", "LG", "C", "RG", "RT"];
  const lineGrade = avg(linePositions.map(pos => playerFitValue(depthStarter("offense", pos), pos)), 50);
  const runnerGrade = avg([qb, rb, fb].filter(Boolean).map(p => (
    playerStatValue(p, "speed") +
    playerStatValue(p, "agility") +
    playerStatValue(p, "carry") +
    playerStatValue(p, "vision") +
    playerStatValue(p, "strength") * 0.35
  ) / 4.35), 50);

  teamStats.rushYards = clamp(Math.round(145 + (runnerGrade - 50) * 2.1 + (lineGrade - 50) * 1.4 + rand(-45, 70)), 45, 335);
  teamStats.passYards = clamp(Math.round(safeNumber(teamStats.passYards)), 0, 260);
  teamStats.totalYards = teamStats.rushYards + teamStats.passYards;
  teamStats.rushTD = Math.max(safeNumber(teamStats.rushTD), clamp(Math.round(teamStats.rushYards / 115 + rand(-1, 1)), 0, 5));
}

function applyStroudStats(scheduledGame, participation) {
  const stroudIsHome = scheduledGame.homeId === "team_stroud";
  const sideKey = stroudIsHome ? "home" : "away";
  const teamStats = scheduledGame.stats[sideKey];
  const opponentScore = stroudIsHome ? scheduledGame.awayScore : scheduledGame.homeScore;
  const myScore = stroudIsHome ? scheduledGame.homeScore : scheduledGame.awayScore;

  const firstDepth = participation[0];
  const offense = firstDepth.offense;
  const defense = firstDepth.defense;
  const quarterShare = playerQuarterShares(participation);
  forceRushingProductionIfMissing(teamStats);

  const gameLines = [];

  const qb = offensiveStarterByRole('QB');
  const rb = offensiveStarterByRole('RB');
  const fb = offensiveStarterByRole('FB');
  const wr1 = offensiveStarterByRole('WR1');
  const wr2 = offensiveStarterByRole('WR2');
  const wr3 = offensiveStarterByRole('WR3');
  const te = offensiveStarterByRole('TE');
  const receivers = [wr1, wr2, wr3, te, rb, fb].filter(Boolean);
  const defenders = DEFENSE_POSITIONS.map(pos => getPlayer(defense[pos]?.[0])).filter(Boolean);

  const lineStats = {};

  function addPlayerLine(player, stats) {
    if (!player) return;
    if (!lineStats[player.id]) lineStats[player.id] = { player: player.name, grade: player.grade, stats: {} };
    for (const [key, value] of Object.entries(stats)) {
      const cleanValue = Math.round(value || 0);
      if (cleanValue !== 0) {
        lineStats[player.id].stats[key] = (lineStats[player.id].stats[key] || 0) + cleanValue;
      }
    }
  }

  // QB passing is exactly team passing. No more mismatch.
  if (qb) {
    const passYards = Math.round(teamStats.passYards);
    const passTD = Math.round(teamStats.passTD);
    addStats(qb, {
      games: 1,
      passYards,
      passTD,
      intThrown: teamStats.turnovers ? rand(0, Math.min(2, teamStats.turnovers)) : 0
    });
    addPlayerLine(qb, { passYards, passTD });
  }

  // Rushing distribution sums exactly to team rushing.
  const shares = rushingSharesForScheme();
  const rushWeights = [
    { id: rb?.id, weight: shares.rb || 0 },
    { id: fb?.id, weight: shares.fb || 0 },
    { id: qb?.id, weight: shares.qb || 0 },
    { id: wr1?.id, weight: (shares.wr || 0) / 2 },
    { id: wr2?.id, weight: (shares.wr || 0) / 2 }
  ];
  let rushYardsById = boundedShares(teamStats.rushYards, rushWeights, 260);
  if (teamStats.rushYards > 0 && sumValues(rushYardsById) === 0) {
    const fallbackRunner = rb || fb || qb;
    if (fallbackRunner) rushYardsById[fallbackRunner.id] = Math.round(teamStats.rushYards);
  }
  const rushTdById = {};
  for (let i = 0; i < teamStats.rushTD; i++) {
    const scorerId = chooseWeighted(rushWeights.filter(item => (rushYardsById[item.id] || 0) >= 1));
    if (scorerId) rushTdById[scorerId] = (rushTdById[scorerId] || 0) + 1;
  }

  for (const [playerId, yards] of Object.entries(rushYardsById)) {
    const player = getPlayer(Number(playerId));
    if (!player) continue;
    const rushTD = rushTdById[playerId] || 0;
    addStats(player, { games: 1, rushYards: yards, rushTD });
    addPlayerLine(player, { rushYards: yards, rushTD });
  }

  // Receiving distribution sums exactly to team passing. Receiving TDs go to players with yards.
  const recWeights = [
    { id: wr1?.id, weight: ["Air Raid", "Spread"].includes(game.settings.offense) ? 1.35 : 0.75 },
    { id: wr2?.id, weight: ["Air Raid", "Spread"].includes(game.settings.offense) ? 1.1 : 0.55 },
    { id: wr3?.id, weight: ["Air Raid", "Spread"].includes(game.settings.offense) ? 0.85 : 0.2 },
    { id: te?.id, weight: ["Pro Style", "Spread"].includes(game.settings.offense) ? 0.75 : 0.3 },
    { id: rb?.id, weight: ["Air Raid", "Spread", "Pro Style"].includes(game.settings.offense) ? 0.35 : 0.08 },
    { id: fb?.id, weight: ["Wing-T", "Power-I"].includes(game.settings.offense) ? 0.08 : 0.02 }
  ];
  const recYardsById = boundedShares(teamStats.passYards, recWeights, 180);
  const recTdById = {};
  for (let i = 0; i < teamStats.passTD; i++) {
    const scorerId = chooseWeighted(recWeights.filter(item => (recYardsById[item.id] || 0) >= 1));
    if (scorerId) recTdById[scorerId] = (recTdById[scorerId] || 0) + 1;
  }

  for (const [playerId, yards] of Object.entries(recYardsById)) {
    const player = getPlayer(Number(playerId));
    if (!player || yards <= 0) continue;
    const catches = Math.max(1, Math.min(12, Math.round(yards / rand(9, 18))));
    const recTD = recTdById[playerId] || 0;
    addStats(player, { games: 1, catches, recYards: yards, recTD });
    addPlayerLine(player, { catches, recYards: yards, recTD });
  }

  // Defensive stats from game flow, not copied from season totals.
  const defensivePlays = clamp(42 + Math.round(opponentScore * 0.35) + rand(-6, 8), 32, 72);
  const tackleWeights = defenders.map(defender => {
    const roleBoost =
      defender.defensePosition === "LB" ? 1.35 :
      defender.defensePosition === "S" ? 1.15 :
      defender.defensePosition === "DL" ? 0.95 :
      0.72;
    const talentBoost = ((defender.stats.tackling || 50) + (defender.stats.pursuit || 50)) / 115;
    return { id: defender.id, weight: roleBoost + talentBoost };
  });
  const tacklesById = boundedShares(defensivePlays, tackleWeights, 15);

  for (const [playerId, tackles] of Object.entries(tacklesById)) {
    const defender = getPlayer(Number(playerId));
    if (!defender || tackles <= 0) continue;
    const sacks = Math.random() < 0.10 && ["DL", "LB"].includes(defender.defensePosition) ? 1 : 0;
    const interceptions = Math.random() < 0.06 && ["CB", "S", "LB"].includes(defender.defensePosition) ? 1 : 0;
    addStats(defender, { games: 1, tackles, sacks, interceptions });
    addPlayerLine(defender, { tackles, sacks, interceptions });
  }

  scheduledGame.playerStats = Object.values(lineStats)
    .filter(line => Object.keys(line.stats).length)
    .slice(0, 18);

  // Rebuild the team box from player totals so the paper always matches.
  const playerPass = sumValues(Object.fromEntries(Object.values(lineStats).map(line => [line.player, line.stats.passYards || 0])));
  const playerRush = sumValues(Object.fromEntries(Object.values(lineStats).map(line => [line.player, line.stats.rushYards || 0])));
  teamStats.passYards = playerPass;
  teamStats.rushYards = playerRush;
  teamStats.totalYards = playerPass + playerRush;

  const spotlight = pickSpotlight(myScore, opponentScore);
  if (spotlight) {
    const note = spotlightNote(spotlight, myScore, opponentScore);
    spotlight.notes.unshift(note);
    scheduledGame.log.push(note);
  }

  const starters = new Set([
    ...Object.values(firstDepth.offense).map(slots => slots[0]),
    ...Object.values(firstDepth.defense).map(slots => slots[0])
  ].filter(Boolean));

  for (const playerId of starters) {
    const player = getPlayer(playerId);
    revealTrait(player, "gamer", rand(4, 9));
    revealTrait(player, "footballIQ", rand(2, 6));
    if (Math.abs(myScore - opponentScore) <= 14 || scheduledGame.playoff) {
      revealTrait(player, "clutch", rand(4, 10));
    }
  }
}

function addStats(player, delta) {
  for (const [key, value] of Object.entries(delta)) {
    player.seasonStats[key] = (player.seasonStats[key] || 0) + value;
    player.careerStats[key] = (player.careerStats[key] || 0) + value;
  }
}

function pickSpotlight(myScore, opponentScore) {
  const starters = [
    ...Object.values(game.depth.offense).map(slots => slots[0]),
    ...Object.values(game.depth.defense).map(slots => slots[0])
  ].map(getPlayer).filter(Boolean);

  if (!starters.length) return null;

  const weighted = starters.map(player => ({
    player,
    weight:
      4 +
      (player.hidden.gamer ? 8 : 0) +
      (player.hidden.clutch && Math.abs(myScore - opponentScore) <= 10 ? 8 : 0) +
      player.hidden.footballIQ / 35
  }));

  let roll = Math.random() * sum(weighted.map(item => item.weight));
  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return item.player;
  }

  return choice(starters);
}

function spotlightNote(player, myScore, opponentScore) {
  if (player.hidden.gamer && Math.random() < 0.6) {
    return `${player.name} looked different under the lights and played above what the practice week suggested.`;
  }

  if (player.hidden.clutch && Math.abs(myScore - opponentScore) <= 14) {
    return `${player.name} came through in a pressure moment late. Coach ${game.coachName || ""} will remember that one.`;
  }

  if (player.hidden.footballIQ > 74) {
    return `${player.name} handled adjustments cleanly and rarely looked fooled.`;
  }

  return `${player.name} gave Stroud useful film and steady snaps.`;
}

function weeklyPractice() {
  for (const player of game.players) {
    const workEthic = player.hidden.workEthic / 100;
    const genetics = player.hidden.genetics / 100;
    const gain = (workEthic * 0.55 + genetics * 0.35) * Math.random() * 1.4;

    let targets = PLAYER_STATS;
    if (game.settings.teamFocus === "Weight Room") targets = ["strength", "blocking", "tackling"];
    if (game.settings.teamFocus === "Conditioning") targets = ["stamina", "speed", "acceleration"];
    if (game.settings.teamFocus === "Film Study") targets = ["vision", "coverage", "throwAccuracy", "pursuit"];
    if (game.settings.teamFocus === "Scrimmage") targets = ["ballCarrying", "catching", "tackling", "coverage", "agility"];

    for (const stat of shuffle(targets).slice(0, 4)) {
      const ceiling = 57 + player.hidden.genetics * 0.36 + player.hidden.workEthic * 0.18;
      if (player.stats[stat] < ceiling) {
        player.stats[stat] = round1(clamp(player.stats[stat] + gain, 1, 99));
      }
    }

    if (game.settings.teamFocus === "Film Study") revealTrait(player, "footballIQ", rand(4, 9));
    if (game.settings.teamFocus === "Scrimmage") {
      revealTrait(player, "gamer", rand(3, 7));
      revealTrait(player, "clutch", rand(2, 5));
    }
  }

  recalculateTeamRatings();
}

/* ----------------------------- Newspaper etc ----------------------------- */


function weeklyTopPerformers(stroudGame) {
  const lines = stroudGame?.playerStats || [];
  const best = (key, label) => {
    const line = [...lines].sort((a, b) => Number(b.stats?.[key] || 0) - Number(a.stats?.[key] || 0))[0];
    if (!line || !Number(line.stats?.[key] || 0)) return { label, name: "No Tiger", value: 0 };
    return { label, name: line.player, value: Number(line.stats[key] || 0) };
  };
  return [
    best("passYards", "Passing"),
    best("rushYards", "Rushing"),
    best("recYards", "Receiving"),
    best("tackles", "Tackles")
  ];
}

function makeWeeklyPaper(week, games) {
  const stroudGame = findStroudGame(games) || game.schedule?.find(item => item.week === week && item.played && (item.homeId === "team_stroud" || item.awayId === "team_stroud")) || game.playoffBracket?.find(item => item.played && (item.homeId === "team_stroud" || item.awayId === "team_stroud"));
  const around = games.filter(item => item !== stroudGame).slice(0, 8);

  let headline = `Week ${week} Around Class 2A-II`;
  let body = "The district picture shifted as another Friday night went final.";
  let gameStats = null;
  let injuries = [];
  let rivalry = null;
  let playerStats = [];

  if (stroudGame) {
    const home = getTeam(stroudGame.homeId);
    const away = getTeam(stroudGame.awayId);
    const won = (stroudGame.homeId === "team_stroud" && stroudGame.homeScore > stroudGame.awayScore)
      || (stroudGame.awayId === "team_stroud" && stroudGame.awayScore > stroudGame.homeScore);
    const margin = Math.abs(stroudGame.homeScore - stroudGame.awayScore);

    if (won && margin >= 28) headline = "Tigers Roll on Friday Night";
    else if (won && margin <= 7) headline = "Tigers Survive Late Scare";
    else if (won) headline = "Tigers Take Care of Business";
    else if (margin <= 7) headline = "Tigers Fall in Heartbreaker";
    else headline = "Tigers Come Up Short";

    body = `${home.name} ${stroudGame.homeScore}, ${away.name} ${stroudGame.awayScore}. `;
    if (won && margin >= 35) body += "Stroud controlled the line of scrimmage and turned it into a runaway.";
    else if (won && margin <= 7) body += "The Tigers needed late execution to escape.";
    else if (won) body += "Stroud leaned on its system and stacked another result.";
    else body += "The Tigers struggled to keep pace once the game slipped away.";

    gameStats = stroudGame.stats;
    injuries = stroudGame.injuries || [];
    playerStats = stroudGame.playerStats || [];

    const opponent = stroudGame.homeId === "team_stroud" ? away : home;
    if (RIVALS.includes(opponent.name)) {
      const rivalryRecord = game.rivalries?.[opponent.name];
      rivalry = rivalryRecord ? {
        opponent: opponent.name,
        mascot: opponent.mascot,
        trophy: rivalryRecord.trophy,
        stroudWins: rivalryRecord.stroudWins,
        opponentWins: rivalryRecord.opponentWins,
        streak: `${rivalryRecord.currentStreakTeam} +${rivalryRecord.currentStreak}`
      } : null;
      headline = `${rivalryRecord?.trophy || "Rivalry Game"}: ${headline}`;
    }
  }

  let rare = game.players
    .flatMap(player => player.notes.slice(0, 1).map(note => ({ name: player.name, note })))
    .filter(item => /lights|pressure|clutch|Friday|adjustments/i.test(item.note))
    .slice(0, 3);

  const flavorPlayer = choice(game.players);
  if (rare.length < 3 && flavorPlayer) {
    const context = flavorPlayer.hidden.gamer ? "gamer" : flavorPlayer.hidden.clutch ? "clutch" : flavorPlayer.hidden.workEthic > 70 ? "work" : "win";
    rare.push({ name: flavorPlayer.name, note: expandedFlavorLine(context, flavorPlayer) });
  }

  return {
    week,
    headline,
    body,
    topPerformers: teamLeaders().slice(0, 4),
    around: around.map(item => ({
      home: getTeam(item.homeId).name,
      away: getTeam(item.awayId).name,
      homeScore: item.homeScore,
      awayScore: item.awayScore,
      district: item.district
    })),
    rankings: rankTeams().slice(0, 10),
    leaders: stateLeaders(),
    rare,
    gameStats,
    injuries,
    rivalry,
    playerStats
  };
}


function showFinalResultThenPaper() {
  const last = latestStroudGame();
  if (!last) {
    showNewspaperPopup();
    return;
  }

  const home = getTeam(last.homeId);
  const away = getTeam(last.awayId);
  const opponent = last.homeId === "team_stroud" ? away : home;
  const stroudWon = (last.homeId === "team_stroud" && last.homeScore > last.awayScore)
    || (last.awayId === "team_stroud" && last.awayScore > last.homeScore);

  setModal(
    "Final",
    stroudWon ? "Tigers win" : "Tigers fall",
    `
      <div class="result-final">
        <h2>${escapeHtml(home.name)} ${last.homeScore}<br>${escapeHtml(away.name)} ${last.awayScore}</h2>
        <p class="muted">${escapeHtml(stroudResultText(last))}</p>
        <p>${escapeHtml(stroudWon ? expandedFlavorLine(RIVALS.includes(opponent.name) ? "rivalry" : "win") : expandedFlavorLine("loss"))}</p>
        <button id="viewPaperAfterFinalBtn" class="gold">View Friday Night Paper</button>
      </div>
    `
  );

  showModal();

  document.getElementById("viewPaperAfterFinalBtn").addEventListener("click", () => {
    setModal("Friday Night Paper", `Week ${game.paper?.week ?? ""} recap`, newspaperHtml());
  });
}

function showNewspaperPopup() {
  if (!game.paper) return;
  setModal("Friday Night Paper", `Week ${game.paper.week} recap`, newspaperHtml());
  showModal();

  if (/STATE|Roll|Survive|Advance/i.test(game.paper.headline)) {
    playSound("big");
  }
}

function newspaperHtml() {
  const paper = game.paper;
  if (!paper) return "<p>No paper yet.</p>";

  return `
    <div class="news-paper">
      <h3>Friday Night Football</h3>
      <div class="news-grid">
        <div>
          <h4>${escapeHtml(paper.headline)}</h4>
          <p>${escapeHtml(paper.body)}</p>

          ${paper.rivalry ? `
            <h4>Rivalry Watch</h4>
            <div class="story">
              <strong>${escapeHtml(paper.rivalry.trophy)}</strong><br>
              Stroud ${paper.rivalry.stroudWins} • ${escapeHtml(paper.rivalry.opponent)} ${paper.rivalry.opponentWins}<br>
              Current streak: ${escapeHtml(paper.rivalry.streak)}
            </div>
          ` : ""}

          <h4>Game Stats</h4>
          ${paper.gameStats ? gameStatsTable(paper.gameStats) : "<p>No Stroud game stats yet.</p>"}
          ${paper.playerStats?.length ? individualGameStatsTable(paper.playerStats) : ""}

          <h4>Top Tigers</h4>
          ${paper.topPerformers.length ? paper.topPerformers.map(performer => `
            <div class="story">
              <strong>${escapeHtml(performer.name)}</strong><br />
              ${escapeHtml(performer.label)}: ${escapeHtml(performer.value)}
            </div>
          `).join("") : "<p>No Stroud stats yet.</p>"}

          <h4>Injuries</h4>
          ${paper.injuries.length ? paper.injuries.map(injury => `
            <div class="story">
              ${escapeHtml(injury.team)}: ${escapeHtml(injury.player)} left in Q${injury.quarter}
              ${injury.backup ? `(${escapeHtml(injury.backup)} finished at ${escapeHtml(injury.position)})` : ""}
            </div>
          `).join("") : "<p>No reported injuries.</p>"}

          <h4>Coach Notes</h4>
          ${paper.rare.length ? paper.rare.map(item => `
            <div class="story"><strong>${escapeHtml(item.name)}</strong>: ${escapeHtml(item.note)}</div>
          `).join("") : "<p>Nothing rare surfaced this week.</p>"}
        </div>

        <div>
          <h4>Around The State</h4>
          ${paper.around.length ? paper.around.map(item => `
            <div class="story">
              <strong>${escapeHtml(item.home)} ${item.homeScore}, ${escapeHtml(item.away)} ${item.awayScore}</strong><br />
              ${item.district ? "District game" : "Non-district/playoff"}
            </div>
          `).join("") : "<p>No other finals.</p>"}

          <h4>Top 10</h4>
          ${paper.rankings.map(team => `
            <div class="split">
              <strong>#${team.rank} ${escapeHtml(team.name)}</strong>
              <span>${team.record}</span>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

function gameStatsTable(stats) {
  return `
    <table style="color:#241a10">
      <thead>
        <tr><th>Team</th><th>Scheme</th><th>Pass</th><th>Rush</th><th>Total</th><th>TO</th></tr>
      </thead>
      <tbody>
        <tr><td>Home</td><td>${escapeHtml(stats.home.scheme || "")}<br><small>${escapeHtml(stats.home.runPass || "")}</small></td><td>${stats.home.passYards}</td><td>${stats.home.rushYards}</td><td>${stats.home.totalYards}</td><td>${stats.home.turnovers}</td></tr>
        <tr><td>Away</td><td>${escapeHtml(stats.away.scheme || "")}<br><small>${escapeHtml(stats.away.runPass || "")}</small></td><td>${stats.away.passYards}</td><td>${stats.away.rushYards}</td><td>${stats.away.totalYards}</td><td>${stats.away.turnovers}</td></tr>
      </tbody>
    </table>
  `;
}


function individualGameStatsTable(lines) {
  const meaningful = lines.filter(line => Object.values(line.stats || {}).some(value => Number(value) > 0)).slice(0, 14);
  if (!meaningful.length) return "";
  return `
    <h4>Individual Game Stats</h4>
    <table style="color:#241a10">
      <thead><tr><th>Player</th><th>Stats</th></tr></thead>
      <tbody>
        ${meaningful.map(line => `
          <tr>
            <td>${escapeHtml(line.player)} (${escapeHtml(line.grade)})</td>
            <td>${Object.entries(line.stats).map(([key, value]) => `${escapeHtml(formatStatKey(key))}: ${value}`).join(" • ")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function rankTeams() {
  return [...game.teams]
    .map(team => {
      const gamesPlayed = team.record.wins + team.record.losses;
      const winPct = gamesPlayed ? team.record.wins / gamesPlayed : 0.5;
      const pointDiff = gamesPlayed ? (team.record.pf - team.record.pa) / gamesPlayed : 0;
      const score = winPct * 42 + team.power * 0.32 + pointDiff * 0.42 + team.record.districtWins * 1.2;

      return {
        id: team.id,
        name: team.name,
        record: `${team.record.wins}-${team.record.losses}`,
        score: round1(score),
        power: team.power
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((team, index) => ({
      ...team,
      rank: index + 1
    }));
}

function stateLeaders() {
  const categories = [
    ["passYards", "Passing"],
    ["rushYards", "Rushing"],
    ["recYards", "Receiving"],
    ["tackles", "Tackles"],
    ["sacks", "Sacks"],
    ["interceptions", "Interceptions"]
  ];

  const stroudPlayers = game.players.map(player => ({
    school: "Stroud",
    player: player.name,
    grade: player.grade,
    stats: player.seasonStats
  }));

  const leaders = {};
  for (const [stat, label] of categories) {
    leaders[label] = [...stroudPlayers]
      .sort((a, b) => (b.stats[stat] || 0) - (a.stats[stat] || 0))
      .slice(0, 10)
      .map(item => ({
        name: item.player,
        school: item.school,
        grade: item.grade,
        value: item.stats[stat] || 0
      }));
  }

  return leaders;
}

function teamLeaders() {
  return [
    ["passYards", "Passing"],
    ["rushYards", "Rushing"],
    ["recYards", "Receiving"],
    ["tackles", "Tackles"]
  ].map(([stat, label]) => {
    const player = [...game.players].sort((a, b) => (b.seasonStats[stat] || 0) - (a.seasonStats[stat] || 0))[0];
    return {
      label,
      name: player?.name || "-",
      value: player?.seasonStats[stat] || 0
    };
  });
}

/* ------------------------------ Playoffs etc ------------------------------ */

function seedPlayoffs() {
  const qualifiers = [];

  for (const district of Object.keys(DISTRICTS)) {
    const districtTeams = game.teams
      .filter(team => team.district === district)
      .sort((a, b) =>
        b.record.districtWins - a.record.districtWins
        || b.record.wins - a.record.wins
        || (b.record.pf - b.record.pa) - (a.record.pf - a.record.pa)
        || b.power - a.power
      )
      .slice(0, 4);

    qualifiers.push(...districtTeams);
  }

  const rankings = rankTeams();
  const seeded = qualifiers
    .map(team => ({
      team,
      rankingScore: rankings.find(item => item.id === team.id)?.score || team.power
    }))
    .sort((a, b) => b.rankingScore - a.rankingScore)
    .map(item => item.team)
    .slice(0, 16);

  game.playoffBracket = [];
  for (let i = 0; i < 8; i++) {
    game.playoffBracket.push({
      ...createGame(11, seeded[i].id, seeded[15 - i].id, false),
      playoff: true,
      label: "Round 1"
    });
  }

  game.phase = "playoffs";
  game.playoffRound = 1;
  game.paper = {
    week: 11,
    headline: "Playoff Bracket Set",
    body: "Sixteen teams remain. Four rounds. Single elimination. One state champion. Not everyone got in.",
    topPerformers: [],
    around: game.playoffBracket.map(item => ({
      home: getTeam(item.homeId).name,
      away: getTeam(item.awayId).name,
      homeScore: "-",
      awayScore: "-",
      district: false
    })),
    rankings: rankTeams().slice(0, 10),
    leaders: stateLeaders(),
    rare: [{ name: "Selection Sunday", note: "The bracket is set. Top four from each district are alive." }],
    injuries: [],
    gameStats: null,
    playerStats: []
  };
}

function runPlayoffRound() {
  const labels = ["Round 1", "Quarterfinal", "Semifinal", "State Championship"];
  const label = labels[game.playoffRound - 1];
  const roundGames = game.playoffBracket.filter(item => item.label === label && !item.played);

  for (const scheduledGame of roundGames) {
    simulateGame(scheduledGame);
  }

  const winners = roundGames.map(item => getTeam(item.homeScore > item.awayScore ? item.homeId : item.awayId));
  game.paper = makeWeeklyPaper(game.week, roundGames);
  game.paper.headline = label === "State Championship" ? `${winners[0].name} Wins State` : `${label} Complete`;

  if (game.playoffRound === 4) {
    finalizeSeason(winners[0].id === "team_stroud");
    game.phase = "offseason";
    return;
  }

  const nextLabel = labels[game.playoffRound];
  for (let i = 0; i < winners.length; i += 2) {
    game.playoffBracket.push({
      ...createGame(11 + game.playoffRound, winners[i].id, winners[i + 1].id, false),
      playoff: true,
      label: nextLabel
    });
  }

  game.playoffRound += 1;
  weeklyPractice();
}

function finalizeSeason(stroudChampion) {
  generateAwards(stroudChampion);

  const stroud = getTeam("team_stroud");
  game.history.unshift({
    year: game.year,
    wins: stroud.record.wins,
    losses: stroud.record.losses,
    districtWins: stroud.record.districtWins,
    districtLosses: stroud.record.districtLosses,
    pf: stroud.record.pf,
    pa: stroud.record.pa,
    offense: game.settings.offense,
    defense: game.settings.defense,
    stateChampion: stroudChampion
  });
}

function generateAwards(stroudChampion) {
  const candidates = game.players
    .map(player => ({
      player,
      score:
        player.seasonStats.passYards * 0.012 +
        player.seasonStats.rushYards * 0.018 +
        player.seasonStats.recYards * 0.018 +
        player.seasonStats.tackles * 0.7 +
        player.seasonStats.sacks * 5 +
        player.seasonStats.interceptions * 6 +
        player.seasonStats.passTD * 7 +
        player.seasonStats.rushTD * 7 +
        player.seasonStats.recTD * 7 +
        (player.hidden.gamer ? 12 : 0) +
        (player.hidden.clutch ? 10 : 0)
    }))
    .sort((a, b) => b.score - a.score);

  const awards = [];
  if (candidates[0]) awards.push(["State MVP", candidates[0].player]);

  const allDistrict = candidates.slice(0, 12).map(item => item.player);
  const allState = candidates.slice(0, 6).map(item => item.player);

  for (const player of allDistrict) player.awards.push(`${game.year} All-District`);
  for (const player of allState) player.awards.push(`${game.year} All-State`);

  if (stroudChampion) {
    awards.push(["Coach of the Year", `Coach ${game.coachName}`]);
  }

  game.awards.unshift({
    year: game.year,
    awards: awards.map(([label, winner]) => ({
      label,
      winner: typeof winner === "string" ? winner : winner.name
    })),
    allDistrict: allDistrict.map(player => player.name),
    allState: allState.map(player => player.name)
  });
}

function startNextSeason() {
  offseasonProgression();

  game.year += 1;
  game.week = 1;
  game.phase = "regular";
  game.playoffRound = 0;
  game.playoffBracket = [];

  for (const team of game.teams) {
    team.history.unshift({
      year: game.year - 1,
      ...team.record
    });

    team.record = {
      wins: 0,
      losses: 0,
      districtWins: 0,
      districtLosses: 0,
      pf: 0,
      pa: 0
    };

    if (team.id !== "team_stroud") {
      team.power = clamp(team.power + rand(-8, 8), 18, 94);
    }
  }

  for (const player of game.players) {
    player.seasonStats = emptyStats();
  }

  game.depth = staffGuessDepthChart();
  game.schedule = createSchedule();
  recalculateTeamRatings();
  game.rankings = rankTeams();
  game.leaders = stateLeaders();
  game.paper = incomingFreshmanPaper();
}

function offseasonProgression() {
  game.players = game.players.filter(player => player.grade !== "SR");

  for (const player of game.players) {
    player.grade = { FR: "SO", SO: "JR", JR: "SR" }[player.grade] || player.grade;

    if (Math.random() < (player.hidden.genetics + player.hidden.workEthic) / 210) {
      player.height = clamp(player.height + rand(0, 2), 62, 80);
    }

    player.weight = Math.round(clamp(
      player.weight + rand(3, 16) * (player.hidden.genetics + player.hidden.workEthic) / 190,
      120,
      330
    ));

    for (const stat of PLAYER_STATS) {
      const ceiling = 58 + player.hidden.genetics * 0.36 + player.hidden.workEthic * 0.18;
      const gain = Math.random() * 4.2 * (player.hidden.workEthic / 100) + Math.random() * 2.2 * (player.hidden.genetics / 100);
      if (player.stats[stat] < ceiling) {
        player.stats[stat] = round1(clamp(player.stats[stat] + gain, 1, 99));
      }
    }

    revealTrait(player, "genetics", rand(9, 17));
    revealTrait(player, "workEthic", rand(9, 17));
  }

  game.players.push(...createFreshmanClass());
}

function updateRecords() {
  for (const player of game.players) {
    const tracked = [
      ["passYards", "Passing yards"],
      ["passTD", "Passing TD"],
      ["rushYards", "Rushing yards"],
      ["rushTD", "Rushing TD"],
      ["recYards", "Receiving yards"],
      ["recTD", "Receiving TD"],
      ["tackles", "Tackles"],
      ["sacks", "Sacks"],
      ["interceptions", "Interceptions"]
    ];

    for (const [stat, label] of tracked) {
      const seasonValue = player.seasonStats[stat] || 0;
      const careerValue = player.careerStats[stat] || 0;

      if (!game.records.season[label] || seasonValue > game.records.season[label].value) {
        game.records.season[label] = {
          value: seasonValue,
          player: player.name,
          year: game.year
        };
      }

      if (!game.records.career[label] || careerValue > game.records.career[label].value) {
        game.records.career[label] = {
          value: careerValue,
          player: player.name,
          year: game.year
        };
      }
    }
  }
}

/* ------------------------------ Persistence ------------------------------ */

function saveLocal() {
  if (!game) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
  toast("Saved locally.");
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;

    game = JSON.parse(raw);
    migrateSave();
    return true;
  } catch {
    return false;
  }
}

function migrateSave() {
  if (game?.players) game.players.forEach(player => ensurePlayerPortrait(player));
  game.version = 1;
  game.players ||= [];
  game.records ||= { season: {}, career: {} };
  game.awards ||= [];
  game.history ||= [];
  game.depth ||= emptyDepthChart();
  game.prestige ??= 25;
  game.rivalries ||= createRivalries();
  ensureRivalTeams();
  repairScheduleIfNeeded();

  for (const player of game.players) {
    player.offensePosition ||= recommendPositions(player)[0] || "WR";
    player.defensePosition ||= "LB";
    player.specialPosition ||= "";
    player.notes ||= [];
    player.awards ||= [];
    player.seasonStats ||= emptyStats();
    player.careerStats ||= emptyStats();
  }
}

async function saveCloud() {
  if (!game) {
    toast("No dynasty to save.");
    return;
  }

  try {
    await ensureFirebase();
    if (!currentUser) {
      toast("Sign in first.");
      return;
    }

    await firebaseFns.setDoc(firebaseFns.doc(db, "users", currentUser.uid, "saves", "main"), {
      updatedAt: firebaseFns.serverTimestamp(),
      gameState: game
    });

    toast("Cloud saved.");
  } catch (error) {
    reportFatalError(error);
    toast("Cloud save failed.");
  }
}

async function loadCloud() {
  try {
    await ensureFirebase();
    if (!currentUser) {
      toast("Sign in first.");
      return;
    }

    const snapshot = await firebaseFns.getDoc(firebaseFns.doc(db, "users", currentUser.uid, "saves", "main"));
    if (!snapshot.exists()) {
      toast("No cloud save found.");
      return;
    }

    game = snapshot.data().gameState;
    migrateSave();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
    showApp();
    render();
    toast("Cloud loaded.");
  } catch (error) {
    reportFatalError(error);
    toast("Cloud load failed.");
  }
}


/* ------------------------------ Menu and Hub ------------------------------ */

function openMainMenu() {
  const panel = document.getElementById("menuPanel");
  panel.innerHTML = `
    <div class="split">
      <h3>HS Football GM</h3>
      <button id="closeMenuBtn" class="secondary" style="width:auto">Close</button>
    </div>
    <p class="muted small">${BUILD_VERSION}</p>

    <div class="menu-section-title">Program</div>
    ${menuButton("dashboard", "Home Hub")}
    ${menuButton("roster", "Roster")}
    ${menuButton("depth", "Depth Chart")}
    ${menuButton("schemes", "Schemes")}

    <div class="menu-section-title">Season</div>
    ${menuButton("newspaper", "Friday Night Paper")}
    ${menuButton("schedule", "Schedule / Playoffs")}
    ${menuButton("rankings", "Rankings & Leaders")}
    ${menuButton("standings", "Standings")}
    ${menuButton("awards", "Awards")}
    ${menuButton("records", "Records & History")}

    <div class="menu-section-title">Tools</div>
    <button id="menuSaveBtn" class="secondary">Save Local</button>
    <button id="menuCloudSaveBtn" class="secondary">Cloud Save</button>
    <button id="menuCloudLoadBtn" class="secondary">Cloud Load</button>
    <button id="menuExportBtn" class="secondary">Export Save</button>
    <button id="menuSettingsBtn" class="secondary">Settings</button>
    <button id="menuTutorialBtn" class="secondary">Tutorial</button>
    <button id="menuNewBtn" class="danger">New Dynasty</button>
  `;

  document.getElementById("menuOverlay").classList.remove("hidden");

  document.getElementById("closeMenuBtn").addEventListener("click", closeMainMenu);
  document.querySelectorAll("[data-menu-view]").forEach(button => {
    button.addEventListener("click", () => {
      currentView = button.dataset.menuView;
      closeMainMenu();
      render();
    });
  });

  document.getElementById("menuSaveBtn").addEventListener("click", () => { saveLocal(); closeMainMenu(); });
  document.getElementById("menuCloudSaveBtn").addEventListener("click", () => { saveCloud(); closeMainMenu(); });
  document.getElementById("menuCloudLoadBtn").addEventListener("click", () => { loadCloud(); closeMainMenu(); });
  document.getElementById("menuExportBtn").addEventListener("click", () => { exportSave(); closeMainMenu(); });
  document.getElementById("menuSettingsBtn").addEventListener("click", () => { closeMainMenu(); openSettings(); });
  document.getElementById("menuTutorialBtn").addEventListener("click", () => { closeMainMenu(); openTutorial(); });
  document.getElementById("menuNewBtn").addEventListener("click", () => { closeMainMenu(); confirmNewDynasty(); });
}

function closeMainMenu() {
  document.getElementById("menuOverlay").classList.add("hidden");
}

function menuButton(viewKey, label) {
  return `<button class="${currentView === viewKey ? "" : "secondary"}" data-menu-view="${viewKey}">${label}</button>`;
}

function latestStroudGame() {
  const all = [...(game.schedule || []), ...(game.playoffBracket || [])];
  return all.filter(item => item.played && (item.homeId === "team_stroud" || item.awayId === "team_stroud")).slice(-1)[0] || null;
}

function nextStroudGame() {
  return game.schedule?.find(item => !item.played && (item.homeId === "team_stroud" || item.awayId === "team_stroud"))
    || game.playoffBracket?.find(item => !item.played && (item.homeId === "team_stroud" || item.awayId === "team_stroud"))
    || null;
}

function stroudResultText(scheduledGame) {
  if (!scheduledGame) return "No result yet.";
  const home = getTeam(scheduledGame.homeId);
  const away = getTeam(scheduledGame.awayId);
  const stroudWon = (scheduledGame.homeId === "team_stroud" && scheduledGame.homeScore > scheduledGame.awayScore)
    || (scheduledGame.awayId === "team_stroud" && scheduledGame.awayScore > scheduledGame.homeScore);
  const opponent = scheduledGame.homeId === "team_stroud" ? away : home;
  const stroudScore = scheduledGame.homeId === "team_stroud" ? scheduledGame.homeScore : scheduledGame.awayScore;
  const oppScore = scheduledGame.homeId === "team_stroud" ? scheduledGame.awayScore : scheduledGame.homeScore;
  return `${stroudWon ? "W" : "L"} ${stroudScore}-${oppScore} vs ${opponent.name}`;
}

function hubTopStory() {
  const stroud = getTeam("team_stroud");
  const rank = rankTeams().find(item => item.id === "team_stroud")?.rank || "NR";
  const last = latestStroudGame();
  const streak = currentProgramStreak();

  if (last) {
    const won = (last.homeId === "team_stroud" && last.homeScore > last.awayScore) || (last.awayId === "team_stroud" && last.awayScore > last.homeScore);
    const opp = getTeam(last.homeId === "team_stroud" ? last.awayId : last.homeId);
    if (RIVALS.includes(opp.name) && won) return `${opp.name} rivalry win has the town buzzing. The trophy case has a little more shine this week.`;
    if (won && Math.abs(last.homeScore - last.awayScore) <= 7) return `Stroud survived a tight one, and close wins are starting to feel like part of the Tigers' identity.`;
    if (won) return `The Tigers keep stacking wins under Coach ${game.coachName || "Coach"}, and the state poll is starting to notice.`;
    return `The Tigers are looking for answers after the loss, but the season still has room for a response.`;
  }

  if (stroud.record.wins === 0 && stroud.record.losses === 0) {
    return `A new Stroud season begins with questions everywhere. The first job is simple: find the right kids for the right spots.`;
  }

  if (streak.count >= 3 && streak.type === "W") return `The Tigers have won ${streak.count} straight. Momentum is real in Stroud.`;
  if (rank !== "NR" && rank <= 10) return `Stroud sits at #${rank} in the state rankings, a long way from the 2-8 season this staff inherited.`;
  return `The Tigers continue building their identity week by week.`;
}

function currentProgramStreak() {
  const games = [...(game.schedule || []), ...(game.playoffBracket || [])]
    .filter(item => item.played && (item.homeId === "team_stroud" || item.awayId === "team_stroud"));
  let count = 0;
  let type = "";
  for (let i = games.length - 1; i >= 0; i--) {
    const item = games[i];
    const won = (item.homeId === "team_stroud" && item.homeScore > item.awayScore) || (item.awayId === "team_stroud" && item.awayScore > item.homeScore);
    const result = won ? "W" : "L";
    if (!type) type = result;
    if (result !== type) break;
    count += 1;
  }
  return { type, count };
}

function programPulseText() {
  const stroud = getTeam("team_stroud");
  if (game.phase === "intro") return "The job is still new. First, learn the roster.";
  if (game.phase === "playoffs") return "November football has arrived. Every mistake gets louder now.";
  if (game.phase === "offseason") return "The offseason is where skinny freshmen become Friday night starters.";
  if (stroud.record.wins >= 7) return "The town is paying attention. Stroud football has juice again.";
  if (stroud.record.losses >= 5) return "Patience is being tested, but the staff is still building.";
  return "The season is still taking shape. One Friday can change the whole mood.";
}

function upcomingStroudGames() {
  return (game.schedule || [])
    .filter(item => !item.played && (item.homeId === "team_stroud" || item.awayId === "team_stroud"))
    .slice(0, 4)
    .map(item => {
      const opponent = getTeam(item.homeId === "team_stroud" ? item.awayId : item.homeId);
      return { weekLabel: item.label || `Week ${item.week}`, opponent: `${opponent.name} ${opponent.mascot}` };
    });
}

function expandedFlavorLine(context, player) {
  const coach = game.coachName || "Coach";
  const playerName = player?.name || "one Tiger";
  const lines = {
    win: [
      `The Tigers looked comfortable late, and that matters in November football.`,
      `Coach ${coach}'s sideline had a different energy after the final whistle.`,
      `Players lingered on the field afterward, soaking in another Friday night win.`
    ],
    loss: [
      `The film room will not be quiet this week.`,
      `Stroud had moments, but not enough answers when the game tilted.`,
      `The staff still believes the roster has more than it showed Friday.`
    ],
    rivalry: [
      `Rivalry weeks carry a different weight, and the Tigers played like they knew it.`,
      `The student section stayed loud long after the final whistle.`,
      `A trophy game always leaves a mark on the season.`
    ],
    gamer: [
      `${playerName} keeps showing up near the football when the Tigers need a play.`,
      `Coaches are starting to trust ${playerName} in moments that do not show up cleanly on a ratings sheet.`,
      `There is something about Friday nights that seems to bring out a different version of ${playerName}.`
    ],
    clutch: [
      `${playerName} looked calm when the game got tight.`,
      `Late-game pressure did not seem to bother ${playerName}.`,
      `Some kids shrink when the lights get bright. ${playerName} did not.`
    ],
    work: [
      `${playerName} was one of the last players off the practice field this week.`,
      `The staff continues to mention ${playerName}'s habits when talking about development.`,
      `Not every improvement is loud. ${playerName}'s week-to-week work is starting to show.`
    ]
  };
  return choice(lines[context] || lines.win);
}

/* ---------------------------------- UI ---------------------------------- */

function showLogin() {
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("gameApp").classList.add("hidden");
}

function showApp() {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("gameApp").classList.remove("hidden");
  document.getElementById("coachLabel").textContent = game?.coachName ? `Coach ${game.coachName}` : "Coach";
  document.getElementById("authLabel").textContent = currentUser
    ? `${currentUser.isAnonymous ? "Guest" : "Google"} save available`
    : "Local only";
  document.getElementById("prestigeLabel").textContent = game ? `Prestige: ${game.prestige ?? 25}` : "Prestige: --";
  document.getElementById("topSubTitle").textContent = game?.coachName ? `Stroud Tigers • Coach ${game.coachName} • ${BUILD_VERSION}` : `Stroud Tigers • ${BUILD_VERSION}`;
}

function render() {
  if (!game) {
    showLogin();
    return;
  }

  ensureRivalTeams();
  repairScheduleIfNeeded();
  showApp();
  renderNav();

  document.getElementById("seasonBadge").textContent = String(game.year);

  const titles = {
    dashboard: ["Dashboard", "The weekly pulse of Stroud football."],
    roster: ["Roster", "Scout, sort, and open player cards."],
    depth: ["Depth Chart", "Staff guesses only. Move kids where you want."],
    schemes: ["Schemes & Practice", "Build around what walked through the doors."],
    newspaper: ["Friday Night Paper", "Every week should feel like progression."],
    rankings: ["Rankings & Leaders", "State rankings and statistical races."],
    schedule: ["Schedule & Playoffs", "Ten regular-season games and four playoff rounds."],
    standings: ["Standings", "Districts stay together."],
    awards: ["Awards", "Season awards, All-District, and All-State."],
    records: ["Records & History", "School records and program history."]
  };

  document.getElementById("pageTitle").textContent = titles[currentView][0];
  document.getElementById("pageSubtitle").textContent = titles[currentView][1];

  const renderers = {
    dashboard: renderDashboard,
    roster: renderRoster,
    depth: renderDepth,
    schemes: renderSchemes,
    newspaper: renderNewspaper,
    rankings: renderRankings,
    schedule: renderSchedule,
    standings: renderStandings,
    awards: renderAwards,
    records: renderRecords
  };

  renderers[currentView]();
}

function renderNav() {
  const navItems = [
    ["dashboard", "Home"],
    ["roster", "Roster"],
    ["depth", "Depth"],
    ["schemes", "Schemes"],
    ["newspaper", "Newspaper"],
    ["rankings", "Rankings"],
    ["schedule", "Schedule"],
    ["standings", "Standings"],
    ["awards", "Awards"],
    ["records", "Records"]
  ];

  document.getElementById("nav").innerHTML = navItems
    .map(([key, label]) => `
      <button data-view="${key}" class="${currentView === key ? "active" : ""}">
        ${label}<span>›</span>
      </button>
    `)
    .join("");

  document.querySelectorAll("[data-view]").forEach(button => {
    button.addEventListener("click", () => {
      currentView = button.dataset.view;
      render();
    });
  });
}

function ratingLine(label, value) {
  return `
    <div style="margin:8px 0">
      <div class="split">
        <span class="muted">${label}</span>
        <strong>${letterGrade(value)}</strong>
      </div>
      <div class="meter"><span style="width:${clamp(value)}%"></span></div>
    </div>
  `;
}

function renderDashboard() {
  const stroud = getTeam("team_stroud");
  const nextGame = nextStroudGame();
  const lastGame = latestStroudGame();
  const nextOpponent = nextGame ? getTeam(nextGame.homeId === "team_stroud" ? nextGame.awayId : nextGame.homeId) : null;
  const rank = rankTeams().find(item => item.id === "team_stroud")?.rank || "NR";
  const leaders = teamLeaders();
  const streak = currentProgramStreak();

  document.getElementById("view").innerHTML = `
    <div class="team-hub-grid">
      <div class="hub-scoreboard">
        <p class="pill gold">${BUILD_VERSION}</p>
        <h1 class="hub-big-title">Stroud Tigers</h1>
        <p class="muted">Coach ${escapeHtml(game.coachName || "New HC")} • ${game.year} Season</p>

        <div class="grid four" style="margin-top:14px">
          <div class="hub-metric"><span class="muted small">Record</span><br><strong>${stroud.record.wins}-${stroud.record.losses}</strong></div>
          <div class="hub-metric"><span class="muted small">District</span><br><strong>${stroud.record.districtWins}-${stroud.record.districtLosses}</strong></div>
          <div class="hub-metric"><span class="muted small">State Rank</span><br><strong>${rank === "NR" ? "NR" : "#" + rank}</strong></div>
          <div class="hub-metric"><span class="muted small">Prestige</span><br><strong>${game.prestige ?? 25}</strong></div>
        </div>

        <div class="grid two" style="margin-top:14px">
          <div class="card">
            <h3>Next Game</h3>
            ${nextOpponent ? `
              <strong>${escapeHtml(nextOpponent.name)} ${escapeHtml(nextOpponent.mascot)}</strong>
              <p class="muted">${escapeHtml(nextGame.label || `Week ${nextGame.week}`)} ${nextGame.district ? "• District" : ""}</p>
              ${RIVALS.includes(nextOpponent.name) ? `<span class="pill gold">${escapeHtml(game.rivalries?.[nextOpponent.name]?.trophy || "Rivalry Game")}</span>` : ""}
            ` : "<p class='muted'>No game scheduled.</p>"}
          </div>
          <div class="card">
            <h3>Last Result</h3>
            <strong>${escapeHtml(stroudResultText(lastGame))}</strong>
            <p class="muted">${streak.count ? `${streak.type}${streak.count} current streak` : "Season has not started."}</p>
          </div>
        </div>
      </div>

      <div class="hub-story">
        <h3>Top Story</h3>
        <p>${escapeHtml(hubTopStory())}</p>
        <hr>
        <p><strong>Program Pulse:</strong> ${escapeHtml(programPulseText())}</p>
      </div>
    </div>

    <div class="grid three" style="margin-top:14px">
      <div class="card">
        <h3>Team Snapshot</h3>
        <div class="varsity-snapshot">
          <span class="status-pill starter">Varsity ${varsityCounts().varsity}</span>
          <span class="status-pill jv">JV ${varsityCounts().jv}</span>
        </div>
        <br>
        ${ratingLine("Offense", stroud.offenseRating)}
        ${ratingLine("Defense", stroud.defenseRating)}
        ${ratingLine("Power", stroud.power)}
      </div>

      <div class="card">
        <h3>Top Tigers</h3>
        ${leaders.map(item => `<div class="split" style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,.07)"><span>${escapeHtml(item.label)}<br><strong>${escapeHtml(item.name)}</strong></span><span class="pill">${item.value}</span></div>`).join("")}
      </div>

      <div class="card">
        <h3>Upcoming</h3>
        ${upcomingStroudGames().map(item => `<div class="split" style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,.07)"><span>${escapeHtml(item.weekLabel)}</span><strong>${escapeHtml(item.opponent)}</strong></div>`).join("") || "<p class='muted'>No upcoming games.</p>"}
      </div>
    </div>

    <div class="card" style="margin-top:14px">
      <h3>Rivalry Trophies</h3>
      <div class="grid four">
        ${Object.entries(game.rivalries || {}).map(([name, item]) => `
          <div class="card">
            <strong>${escapeHtml(item.trophy)}</strong><br>
            <span class="muted">vs ${escapeHtml(name)}</span><br>
            <span>Stroud ${item.stroudWins} - ${item.opponentWins}</span><br>
            <span class="pill gold">${escapeHtml(item.currentStreakTeam)} +${item.currentStreak}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function rankingList(teams) {
  return teams
    .map(team => `
      <div class="split" style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,.07)">
        <span><strong>#${team.rank}</strong> ${escapeHtml(team.name)}</span>
        <span class="pill">${team.record}</span>
      </div>
    `)
    .join("");
}

function renderRoster() {
  const counts = varsityCounts();
  const sortKey = window.rosterSortKey || "name";
  const sortDir = window.rosterSortDir || "asc";
  const columns = [
    ["name", "Name"],
    ["status", "Status"],
    ["offense", "O"],
    ["defense", "D"],
    ["special", "ST"],
    ["grade", "Yr"],
    ["height", "Ht"],
    ["weight", "Wt"],
    ["speed", "Spd"],
    ["accel", "Acc"],
    ["strength", "Str"],
    ["agility", "Agi"],
    ["stamina", "Sta"],
    ["armStrength", "Arm"],
    ["throwAccuracy", "ThA"],
    ["catching", "Cat"],
    ["carry", "Car"],
    ["blocking", "Blk"],
    ["tackling", "Tkl"],
    ["coverage", "Cov"],
    ["vision", "Vis"],
    ["pursuit", "Pur"],
    ["kickPower", "KP"],
    ["kickAccuracy", "KA"]
  ];

  const sorted = sortedRosterPlayers(sortKey, sortDir);

  document.getElementById("view").innerHTML = `
    <div class="card">
      <div class="split">
        <h3>Roster <span class="muted small">Tap headers to sort. Tap a player row to open profile.</span></h3>
        <div class="row">
          <span class="status-pill starter">Varsity ${counts.varsity}</span>
          <span class="status-pill jv">JV ${counts.jv}</span>
          <span class="pill">${game.players.length} players</span>
        </div>
      </div>

      <p class="muted small">
        O/D/ST show actual varsity two-deep roles. Everyone else shows JV.
      </p>

      <div class="table-wrap">
        <table class="roster-table">
          <thead>
            <tr>
              ${columns.map(([key, label]) => `<th data-roster-sort="${key}">${label}${sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${sorted.map(player => `
              <tr data-player-id="${player.id}">
                <td><span class="player-name" data-player-id="${player.id}">${escapeHtml(player.name)}</span></td>
                <td>${playerStatusPill(player.id)}</td>
                <td>${escapeHtml(rolePositionOnly(player.id, "offense"))}</td>
                <td>${escapeHtml(rolePositionOnly(player.id, "defense"))}</td>
                <td>${escapeHtml(rolePositionOnly(player.id, "special"))}</td>
                <td>${player.grade}</td>
                <td>${formatHeight(player.height)}</td>
                <td>${player.weight}</td>
                <td>${player.stats.speed}</td>
                <td>${player.stats.accel}</td>
                <td>${player.stats.strength}</td>
                <td>${player.stats.agility}</td>
                <td>${player.stats.stamina}</td>
                <td>${player.stats.armStrength}</td>
                <td>${player.stats.throwAccuracy}</td>
                <td>${player.stats.catching}</td>
                <td>${player.stats.carry}</td>
                <td>${player.stats.blocking}</td>
                <td>${player.stats.tackling}</td>
                <td>${player.stats.coverage}</td>
                <td>${player.stats.vision}</td>
                <td>${player.stats.pursuit}</td>
                <td>${player.stats.kickPower}</td>
                <td>${player.stats.kickAccuracy}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.querySelectorAll("tr[data-player-id]").forEach(row => {
    row.addEventListener("click", event => {
      if (event.target.closest("[data-roster-sort]")) return;
      openPlayerCard(row.dataset.playerId);
    });
  });

  document.querySelectorAll("[data-roster-sort]").forEach(header => {
    header.addEventListener("click", () => {
      const key = header.dataset.rosterSort;
      if (window.rosterSortKey === key) {
        window.rosterSortDir = window.rosterSortDir === "asc" ? "desc" : "asc";
      } else {
        window.rosterSortKey = key;
        window.rosterSortDir = ["name", "status", "offense", "defense", "special", "grade"].includes(key) ? "asc" : "desc";
      }
      renderRoster();
    });
  });
}

function sortedRosterPlayers(sortKey, sortDir) {
  const dir = sortDir === "asc" ? 1 : -1;
  return [...game.players].sort((a, b) => {
    const av = rosterSortValue(a, sortKey);
    const bv = rosterSortValue(b, sortKey);
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });
}

function rosterSortValue(player, key) {
  if (key === "name") return player.name;
  if (key === "status") return playerSimpleStatus(player.id);
  if (key === "offense") return rolePositionOnly(player.id, "offense");
  if (key === "defense") return rolePositionOnly(player.id, "defense");
  if (key === "special") return rolePositionOnly(player.id, "special");
  if (key === "grade") return ["FR", "SO", "JR", "SR"].indexOf(player.grade);
  if (key === "height") return player.height;
  if (key === "weight") return player.weight;
  return player.stats[key] ?? 0;
}

function fillRemainingDepthChart() {
  const guessed = staffGuessDepthChart();

  for (const side of ["offense", "defense", "special"]) {
    for (const position of Object.keys(game.depth[side])) {
      for (let slot = 0; slot < 2; slot++) {
        if (!game.depth[side][position][slot]) {
          const candidate = guessed[side]?.[position]?.[slot] || "";
          if (candidate) {
            game.depth[side][position][slot] = candidate;
          }
        }
      }
    }
  }
}

function getDepthSortMode() { return window.depthSortMode || "best"; }
function setDepthSortMode(mode) { window.depthSortMode = mode === "name" ? "name" : "best"; }
function sortedPlayersForDepth(position) {
  const players = [...game.players];
  if (getDepthSortMode() === "name") return players.sort((a, b) => a.name.localeCompare(b.name));
  return players.sort((a, b) => {
    const fitDiff = positionFit(b, position) - positionFit(a, position);
    if (fitDiff !== 0) return fitDiff;
    return a.name.localeCompare(b.name);
  });
}
function visibleOffensePositions() { return requiredOffensePositions(); }

function renderDepth() {
  const activeSide = window.currentDepthSide || "offense";
  document.getElementById("view").innerHTML = `
    <div class="depth-toolbar">
      <button id="fillDepthBtn">Fill Remaining</button>
      <button id="clearDepthBtn" class="secondary">Clear</button>
      <span class="pill gold">${escapeHtml(game.settings.offense)} requirements active</span>
      <label for="depthSortSelect">Sort dropdowns</label>
      <select id="depthSortSelect">
        <option value="best">Best Here</option>
        <option value="name">Name</option>
      </select>
      <span class="depth-sort-note">● starter • ○ backup • JV not in two-deep</span>
    </div>
    <div class="depth-tabs">
      ${[["offense","Offense"],["defense","Defense"],["special","Special Teams"]].map(([side,label]) => `<button data-depth-tab="${side}" class="${activeSide === side ? "active" : ""}">${label}</button>`).join("")}
    </div>
    <div class="card depth-table-card">
      ${activeSide === "offense" ? renderDepthTable("offense", visibleOffensePositions()) : ""}
      ${activeSide === "defense" ? renderDepthTable("defense", DEFENSE_POSITIONS) : ""}
      ${activeSide === "special" ? renderDepthTable("special", SPECIAL_POSITIONS) : ""}
    </div>`;
  const depthSortSelect = document.getElementById("depthSortSelect");
  if (depthSortSelect) {
    depthSortSelect.value = getDepthSortMode();
    depthSortSelect.addEventListener("change", () => { setDepthSortMode(depthSortSelect.value); renderDepth(); });
  }
  document.querySelectorAll("[data-depth-tab]").forEach(button => {
    button.addEventListener("click", () => { window.currentDepthSide = button.dataset.depthTab; renderDepth(); });
  });
  document.querySelectorAll("[data-open-player-select]").forEach(button => {
    button.addEventListener("click", () => {
      const selectedId = game.depth[button.dataset.side][button.dataset.position][Number(button.dataset.slot)];
      openDepthPlayerSelect(button.dataset.side, button.dataset.position, Number(button.dataset.slot), selectedId);
    });
  });
  document.getElementById("fillDepthBtn").addEventListener("click", () => {
    fillRemainingDepthChart();
    recalculateTeamRatings();
    saveLocalSilent();
    renderDepth();
    toast("Filled empty spots only.");
  });
  document.getElementById("clearDepthBtn").addEventListener("click", () => {
    game.depth = emptyDepthChart();
    recalculateTeamRatings();
    saveLocalSilent();
    renderDepth();
  });
}

function renderDepthTable(side, positions) {
  return `<h3>${side === "offense" ? "Offense" : side === "defense" ? "Defense" : "Special Teams"}</h3>
    <table class="depth-table">
      <thead><tr><th>Pos</th><th>Starter</th><th>Backup</th><th>Notes</th></tr></thead>
      <tbody>${positions.map(position => renderDepthTableRow(side, position)).join("")}</tbody>
    </table>`;
}
function renderDepthTableRow(side, position) {
  const slots = game.depth[side][position];
  return `<tr>
    <td><div class="depth-position-label">${position}</div><span class="pill good">Starter required</span><br><span class="pill blue">Backup required</span></td>
    <td>${renderDepthSelect(side, position, 0, slots[0])}</td>
    <td>${renderDepthSelect(side, position, 1, slots[1])}</td>
    <td class="muted small">${depthPositionNote(side, position)}</td>
  </tr>`;
}
function depthPositionNote(side, position) {
  const scheme = game.settings.offense;
  const pos = normalizePosition(position);
  if (side === "offense") {
    if (scheme === "Wing-T" && position === "FB") return "Engine of the offense. Carries, lead blocks, sells fakes.";
    if (scheme === "Wing-T" && ["LG", "RG"].includes(position)) return "Pulling guards matter. Slow guards kill the Wing-T.";
    if (scheme === "Air Raid" && ["WR1", "WR2", "WR3"].includes(position)) return "Major target volume in this offense.";
    if (["Flexbone", "Wishbone", "Option"].includes(scheme) && position === "QB") return "Decision-making and ball handling matter more than pure arm.";
    if (pos === "WR" && ["Wing-T", "Flexbone", "Wishbone"].includes(scheme)) return "Mostly blocks and decoys. Great WRs are less impactful here.";
  }
  if (side === "defense") {
    if (["CB1", "CB2"].includes(position)) return "Bad corners get punished by passing teams.";
    if (["FS", "SS"].includes(position)) return "Safeties clean up mistakes and matter against spread teams.";
    if (["DT1", "DT2", "LE", "RE"].includes(position)) return "Controls the line. Huge against run-heavy teams.";
  }
  return "Only starter and backup enter games. Everyone else is JV until placed in the two-deep.";
}

function openDepthPlayerSelect(side, position, slot, selectedId) {
  const overlay = document.getElementById("playerSelectOverlay");
  const panel = document.getElementById("playerSelectPanel");
  if (!overlay || !panel) return;

  const sortMode = getDepthSortMode();
  const players = sortedPlayersForDepth(position);

  panel.innerHTML = `
    <div class="player-select-head">
      <div class="player-select-title">Select Player</div>
      <div class="player-select-controls">
        <label class="muted small">Sort by</label>
        <select id="playerPopupSort">
          <option value="best">Best Here</option>
          <option value="name">Name</option>
        </select>
        <button id="closePlayerSelectBtn" class="player-select-close secondary">×</button>
      </div>
    </div>
    <div class="player-select-list">
      <button class="player-select-row ${!selectedId ? "selected" : ""}" data-select-player="">
        <div>
          <div class="player-select-name">Empty</div>
          <div class="player-select-meta">No player assigned</div>
        </div>
        <div class="player-select-roles">
          <span class="select-role-badge jv">—</span>
        </div>
        <div class="player-select-grade">Here: -</div>
      </button>
      ${players.map(player => {
        const hereGrade = letterGrade(positionFit(player, position));
        return `
          <button class="player-select-row ${player.id === selectedId ? "selected" : ""}" data-select-player="${player.id}">
            <div>
              <div class="player-select-name">${escapeHtml(player.name)}</div>
              <div class="player-select-meta">${player.grade} • ${formatHeight(player.height)} • ${player.weight}</div>
            </div>
            <div class="player-select-roles">
              ${selectRoleBadgesForSide(player.id, "offense")}
              ${selectRoleBadgesForSide(player.id, "defense")}
            </div>
            <div class="player-select-grade">Here: ${hereGrade}</div>
          </button>
        `;
      }).join("")}
    </div>
    <div class="player-select-footer">
      <span><span class="legend-dot starter"></span>Starter</span>
      <span><span class="legend-dot backup"></span>Backup</span>
      <span><span class="legend-dot jv"></span>JV / not in two-deep</span>
    </div>
  `;

  overlay.classList.remove("hidden");

  const popupSort = document.getElementById("playerPopupSort");
  popupSort.value = sortMode;
  popupSort.addEventListener("change", () => {
    setDepthSortMode(popupSort.value);
    openDepthPlayerSelect(side, position, slot, selectedId);
  });

  document.getElementById("closePlayerSelectBtn").addEventListener("click", closeDepthPlayerSelect);

  panel.querySelectorAll("[data-select-player]").forEach(button => {
    button.addEventListener("click", () => {
      setDepthPlayer(side, position, slot, button.dataset.selectPlayer);
      saveLocalSilent();
      closeDepthPlayerSelect();
      renderDepth();
    });
  });
}

function closeDepthPlayerSelect() {
  document.getElementById("playerSelectOverlay")?.classList.add("hidden");
}


function renderDepthSelect(side, position, slot, selectedId) {
  const player = getPlayer(selectedId);
  const grade = player ? letterGrade(positionFit(player, position)) : "-";
  const gradeClassName = player ? gradeClass(positionFit(player, position)) : "";
  const buttonText = player ? player.name : "Empty";

  return `
    <div>
      <button class="depth-fake-select" data-open-player-select="1" data-side="${side}" data-position="${position}" data-slot="${slot}">
        ${escapeHtml(buttonText)}
      </button>
      <div class="depth-player-mini"><span class="pill ${gradeClassName}">Here: ${grade}</span></div>
      ${player ? `<div class="depth-context">${playerStatusPill(player.id)}<br>O: ${escapeHtml(rolePositionOnly(player.id, "offense"))} • D: ${escapeHtml(rolePositionOnly(player.id, "defense"))}</div>` : ""}
    </div>
  `;
}

function renderSchemes() {
  const offenseProfile = SCHEME_PROFILES[game.settings.offense] || SCHEME_PROFILES["Pro Style"];
  const defenseProfile = DEFENSE_PROFILES[game.settings.defense] || DEFENSE_PROFILES["4-3"];

  document.getElementById("view").innerHTML = `
    <div class="grid two">
      <div class="card">
        <h3>Systems</h3>
        <label class="muted small">Offense</label>
        <select id="offenseSelect">${OFFENSES.map(item => `<option>${item}</option>`).join("")}</select>
        <br><br>
        <label class="muted small">Defense</label>
        <select id="defenseSelect">${DEFENSES.map(item => `<option>${item}</option>`).join("")}</select>
        <br><br>
        <button id="saveSchemesBtn">Save Systems</button>
      </div>

      <div class="card">
        <h3>Practice</h3>
        <label class="muted small">Team Focus</label>
        <select id="teamFocusSelect">
          ${["Position Drills", "Weight Room", "Conditioning", "Film Study", "Scrimmage"].map(item => `<option>${item}</option>`).join("")}
        </select>
        <p class="muted">Practice improves ratings and reveals hidden traits. Scrimmage helps reveal Gamer and Clutch. Film Study helps reveal Football IQ.</p>
        <button id="savePracticeBtn">Save Practice</button>
      </div>
    </div>

    <div class="grid two" style="margin-top:14px">
      <div class="card scheme-card">
        <h3>${escapeHtml(game.settings.offense)} Offense</h3>
        <span class="pill gold">${escapeHtml(offenseProfile.runPass)}</span>
        <h4>Position Demands</h4>
        <p class="muted"><strong>Most Critical:</strong> ${offenseProfile.critical.join(", ")}</p>
        <p class="muted">${escapeHtml(offenseProfile.text)}</p>
      </div>

      <div class="card scheme-card">
        <h3>${escapeHtml(game.settings.defense)} Defense</h3>
        <h4>Position Demands</h4>
        <p class="muted"><strong>Most Critical:</strong> ${defenseProfile.critical.join(", ")}</p>
        <p class="muted">${escapeHtml(defenseProfile.text)}</p>
      </div>
    </div>
  `;

  document.getElementById("offenseSelect").value = game.settings.offense;
  document.getElementById("defenseSelect").value = game.settings.defense;
  document.getElementById("teamFocusSelect").value = game.settings.teamFocus;

  document.getElementById("saveSchemesBtn").addEventListener("click", () => {
    game.settings.offense = document.getElementById("offenseSelect").value;
    game.settings.defense = document.getElementById("defenseSelect").value;
    recalculateTeamRatings();
    saveLocalSilent();
    render();
    toast("Schemes saved.");
  });

  document.getElementById("savePracticeBtn").addEventListener("click", () => {
    game.settings.teamFocus = document.getElementById("teamFocusSelect").value;
    saveLocalSilent();
    toast("Practice saved.");
  });
}

function renderNewspaper() {
  document.getElementById("view").innerHTML = game.paper
    ? newspaperHtml()
    : "<div class='card'><h3>No paper yet</h3><p class='muted'>Advance a week.</p></div>";
}

function renderRankings() {
  const leaders = game.leaders || stateLeaders();

  document.getElementById("view").innerHTML = `
    <div class="grid two">
      <div class="card">
        <h3>State Top 25</h3>
        ${rankingList(rankTeams().slice(0, 25))}
      </div>

      <div class="card">
        <h3>Stroud Leaders</h3>
        ${Object.entries(leaders).map(([category, list]) => `
          <h4>${escapeHtml(category)}</h4>
          ${list.slice(0, 5).map((item, index) => `
            <div class="split">
              <span>${index + 1}. ${escapeHtml(item.name)}</span>
              <strong>${item.value}</strong>
            </div>
          `).join("")}
        `).join("")}
      </div>
    </div>
  `;
}

function renderSchedule() {
  const games = [
    ...(game.schedule || []).filter(item => item.homeId === "team_stroud" || item.awayId === "team_stroud"),
    ...(game.playoffBracket || []).filter(item => item.homeId === "team_stroud" || item.awayId === "team_stroud")
  ].sort((a, b) => a.week - b.week);

  document.getElementById("view").innerHTML = `
    <div class="grid">
      ${games.map(item => {
        const home = getTeam(item.homeId);
        const away = getTeam(item.awayId);
        return `
          <div class="schedule-game">
            <span class="pill ${item.playoff ? "gold" : "blue"}">${escapeHtml(item.label || `Week ${item.week}`)}</span>
            <div>
              <strong>
                ${item.played
                  ? `${escapeHtml(home.name)} ${item.homeScore} - ${escapeHtml(away.name)} ${item.awayScore}`
                  : `${escapeHtml(home.name)} vs ${escapeHtml(away.name)}`}
              </strong><br>
              <span class="muted small">${item.district ? "District" : "Non-district/Playoff"}</span>
            </div>
            <span class="pill">${item.played ? "Final" : "Upcoming"}</span>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderStandings() {
  document.getElementById("view").innerHTML = `
    <div class="grid two">
      ${Object.keys(DISTRICTS).map(district => {
        const teams = game.teams
          .filter(team => team.district === district)
          .sort((a, b) =>
            b.record.districtWins - a.record.districtWins
            || b.record.wins - a.record.wins
            || (b.record.pf - b.record.pa) - (a.record.pf - a.record.pa)
          );

        return `
          <div class="card">
            <h3>District ${district}</h3>
            <table>
              <thead>
                <tr><th>Team</th><th>Mascot</th><th>Overall</th><th>District</th><th>PF</th><th>PA</th></tr>
              </thead>
              <tbody>
                ${teams.map(team => `
                  <tr>
                    <td><strong class="${team.id === "team_stroud" ? "gold-text" : ""}">${escapeHtml(team.name)}</strong></td>
                    <td>${escapeHtml(team.mascot)}</td>
                    <td>${team.record.wins}-${team.record.losses}</td>
                    <td>${team.record.districtWins}-${team.record.districtLosses}</td>
                    <td>${team.record.pf}</td>
                    <td>${team.record.pa}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderAwards() {
  document.getElementById("view").innerHTML = `
    <div class="card">
      <h1>Awards</h1>
      <p class="muted">Season awards, all-district, all-state, and state champions.</p>
    </div>
    ${seasonAwardsHtml()}
  `;
}

function renderRecords() {
  const recordBlock = (title, records) => `
    <div class="card">
      <h3>${title}</h3>
      <div class="grid two">
        ${Object.entries(records).length ? Object.entries(records).map(([label, item]) => `
          <div class="card">
            <span class="muted small">${escapeHtml(label)}</span><br>
            <strong>${item.value}</strong><br>
            ${escapeHtml(item.player)} <span class="muted">${item.year}</span>
          </div>
        `).join("") : "<p class='muted'>No records.</p>"}
      </div>
    </div>
  `;

  document.getElementById("view").innerHTML = `
    <div class="grid two">
      ${recordBlock("Season Records", game.records.season)}
      ${recordBlock("Career Records", game.records.career)}
    </div>

    <div class="card" style="margin-top:14px">
      <h3>Program History</h3>
      <table>
        <thead>
          <tr><th>Year</th><th>Record</th><th>District</th><th>PF</th><th>PA</th><th>Result</th></tr>
        </thead>
        <tbody>
          ${game.history.map(item => `
            <tr>
              <td>${item.year}</td>
              <td>${item.wins}-${item.losses}</td>
              <td>${item.districtWins}-${item.districtLosses}</td>
              <td>${item.pf}</td>
              <td>${item.pa}</td>
              <td>${item.stateChampion ? "State Champs" : "Finished"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}


function playerPositionEditor(player) {
  const offenseOptions = ["QB", "RB", "FB", "WR", "TE", "OL"];
  const defenseOptions = ["DL", "LB", "CB", "S"];
  const specialOptions = ["", "K", "P", "KR", "PR"];
  const optionHtml = (options, selected) => options.map(option => `<option value="${option}" ${option === selected ? "selected" : ""}>${option || "None"}</option>`).join("");

  return `
    <div class="card" style="margin-bottom:14px">
      <h3>Set Player Positions</h3>
      <p>${playerStatusPill(player.id)} <span class="muted">${escapeHtml(playerVarsityStatus(player.id))}</span></p>
      <p class="muted">These are scout/projected labels only. Actual playing time comes from the varsity depth chart.</p>
      <div class="grid three">
        <div><label class="muted small">Offense</label><select id="playerOffensePos">${optionHtml(offenseOptions, player.offensePosition)}</select></div>
        <div><label class="muted small">Defense</label><select id="playerDefensePos">${optionHtml(defenseOptions, player.defensePosition)}</select></div>
        <div><label class="muted small">Special Teams</label><select id="playerSpecialPos">${optionHtml(specialOptions, player.specialPosition || "")}</select></div>
      </div>
      <br><button id="savePlayerPositionsBtn">Save Player Positions</button>
    </div>
  `;
}
function bindPlayerPositionEditor(player) {
  document.getElementById("savePlayerPositionsBtn")?.addEventListener("click", () => {
    player.offensePosition = document.getElementById("playerOffensePos").value;
    player.defensePosition = document.getElementById("playerDefensePos").value;
    player.specialPosition = document.getElementById("playerSpecialPos").value;
    saveLocalSilent();
    toast(`${player.name}'s positions updated.`);
    openPlayerCard(player.id);
    if (currentView === "roster" || currentView === "depth") render();
  });
}


function portraitHash(input) {
  const str = String(input || "player");
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function ensurePlayerPortrait(player) {
  const version = 2;
  if (!player.portrait || player.portrait.version !== version) {
    const seed = portraitHash(`${player.id}-${player.name}-${player.grade}-${player.height}-${player.weight}`);
    const pick = (arr, offset = 0) => arr[(seed + offset * 97) % arr.length];

    player.portrait = {
      version,
      skin: pick(["#f6d2b8", "#f1c6a8", "#e8b892", "#f3d7c4", "#dfaa83"], 1),
      hair: pick(["#1f1410", "#3b2418", "#5b351f", "#d7b56d", "#111827", "#7a4a2a", "#2a1b14"], 3),
      hairStyle: pick(["short", "flat", "curly", "shag", "mohawk", "buzz", "side"], 5),
      eyes: pick(["#111827", "#263238", "#214761", "#3c2a1e"], 7),
      mouth: pick(["neutral", "smile", "serious", "grin"], 9),
      facialHair: player.grade === "FR" ? "none" : pick(["none", "none", "stache", "goatee", "chin"], 11),
      face: pick(["round", "square", "long", "wide"], 13),
      brows: pick(["calm", "angry", "raised"], 15)
    };
  }
  return player.portrait;
}

function playerPortraitSvg(player) {
  const p = ensurePlayerPortrait(player);
  const faceW = p.face === "square" ? 54 : p.face === "long" ? 48 : p.face === "wide" ? 60 : 52;
  const faceH = p.face === "long" ? 62 : 56;
  const mouthPath = p.mouth === "smile" ? "M48 70 Q58 78 68 70" : p.mouth === "serious" ? "M48 72 L68 72" : p.mouth === "grin" ? "M48 69 Q58 80 68 69" : "M50 72 Q58 74 66 72";
  const browLeft = p.brows === "angry" ? "M42 50 L53 47" : p.brows === "raised" ? "M42 47 Q48 44 53 47" : "M42 50 Q48 48 53 50";
  const browRight = p.brows === "angry" ? "M64 47 L75 50" : p.brows === "raised" ? "M64 47 Q70 44 75 47" : "M64 50 Q70 48 75 50";

  const hair = {
    buzz: `<rect x="35" y="24" width="46" height="15" rx="7" fill="${p.hair}"/>`,
    short: `<path d="M34 44 Q38 20 58 20 Q80 21 83 45 Q70 32 58 34 Q45 32 34 44Z" fill="${p.hair}"/>`,
    flat: `<path d="M34 39 Q38 18 80 25 L84 42 Q62 32 34 39Z" fill="${p.hair}"/>`,
    curly: `<path d="M33 42 C30 24 43 18 50 24 C56 14 68 19 70 26 C82 22 88 35 82 47 C68 33 49 32 33 42Z" fill="${p.hair}"/>`,
    shag: `<path d="M31 42 Q40 18 60 21 Q82 23 86 45 Q78 39 74 56 Q68 40 59 38 Q45 39 38 56 Q36 45 31 42Z" fill="${p.hair}"/>`,
    mohawk: `<path d="M54 14 L64 14 L70 42 L48 42Z" fill="${p.hair}"/><path d="M36 43 Q45 31 58 31 Q74 31 82 44 L82 51 Q61 41 36 51Z" fill="${p.hair}"/>`,
    side: `<path d="M32 43 Q39 20 60 21 Q78 22 84 41 Q62 31 43 39 Q38 49 34 58 Q31 49 32 43Z" fill="${p.hair}"/>`
  }[p.hairStyle];

  const facial = p.facialHair === "stache"
    ? `<path d="M48 66 Q56 62 64 66 Q56 70 48 66Z" fill="${p.hair}"/>`
    : p.facialHair === "goatee"
      ? `<path d="M52 75 Q58 85 64 75 Q59 80 52 75Z" fill="${p.hair}"/>`
      : p.facialHair === "chin"
        ? `<ellipse cx="58" cy="78" rx="7" ry="4" fill="${p.hair}"/>`
        : "";

  return `
    <svg viewBox="0 0 116 116" xmlns="http://www.w3.org/2000/svg">
      <rect width="116" height="116" fill="#081426"/>
      <path d="M24 110 Q58 82 92 110Z" fill="#173fb8"/>
      <path d="M31 110 Q58 90 85 110Z" fill="#f7f7f7" opacity=".96"/>
      <rect x="${58 - faceW/2}" y="32" width="${faceW}" height="${faceH}" rx="${p.face === "square" ? 13 : 24}" fill="${p.skin}"/>
      ${hair}
      <circle cx="47" cy="57" r="4" fill="${p.eyes}"/>
      <circle cx="69" cy="57" r="4" fill="${p.eyes}"/>
      <path d="${browLeft}" stroke="#111827" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="${browRight}" stroke="#111827" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M58 59 L54 66 L61 66" stroke="#8b5a40" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${mouthPath}" stroke="#3d261b" stroke-width="3" fill="none" stroke-linecap="round"/>
      ${facial}
    </svg>
  `;
}

function playerCardIntro(player) {
  return `
    <div class="card player-card-intro">
      <div class="player-portrait">${playerPortraitSvg(player)}</div>
      <div class="player-card-intro-info">
        <h3 style="margin:0">${escapeHtml(player.name)}</h3>
        <p class="muted">${player.grade} • ${formatHeight(player.height)} • ${player.weight} lbs</p>
        <p>${playerStatusPill(player.id)} <span class="muted">${escapeHtml(playerVarsityStatus(player.id))}</span></p>
      </div>
    </div>
  `;
}

function openPlayerCard(playerId) {
  try {
  const player = getPlayer(playerId);
  if (!player) { toast(`Player not found: ${playerId}`); return; }

  const traitLine = (label, trait) => {
    const knowledge = player.knowledge[trait];
    const range = knowledge.known < 2 ? "???" : `${knowledge.min}-${knowledge.max}`;

    return `
      <div style="margin:10px 0">
        <div class="split">
          <span>${label}</span>
          <strong>${range}</strong>
        </div>
        <div class="meter"><span style="width:${knowledge.known}%"></span></div>
        <div class="muted small">Confidence ${Math.round(knowledge.known)}%</div>
      </div>
    `;
  };

  setModal(
    player.name,
    `${player.grade} • ${formatHeight(player.height)} • ${player.weight} lbs • ${playerVarsityStatus(player.id)}`,
    `
      ${playerCardIntro(player)}
      ${playerPositionEditor(player)}
      <div class="grid two">
        <div class="card">
          <h3 style="margin:0">Ratings</h3>
          <div class="position-chip-row">
            ${["QB", "RB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K"].map(position => {
              const value = positionFit(player, position);
              return `<span class="position-grade-pill ${positionPillClass(value)}"><span class="pos">${position}</span><span class="grade">${letterGrade(value)}</span></span>`;
            }).join("")}
          </div>
          <div class="stat-grid">
            ${PLAYER_STATS.map(stat => `
              <div class="stat-line" style="display:block">
                <div class="split"><span>${STAT_LABELS[stat]}</span><strong>${player.stats[stat]}</strong></div>
                <div class="meter stat-line-bar"><span style="width:${clamp(player.stats[stat])}%"></span></div>
              </div>
            `).join("")}
          </div>
        </div>

        <div class="card">
          <h3>Coach Read</h3>
          ${traitLine("Gamer", "gamer")}
          ${traitLine("Clutch", "clutch")}
          ${traitLine("Football IQ", "footballIQ")}
          ${traitLine("Work Ethic", "workEthic")}
          ${traitLine("Genetics", "genetics")}
        </div>
      </div>

      <div class="grid two" style="margin-top:14px">
        <div class="card">
          <h3>Stats & Awards</h3>
          <p>
            <strong>Season:</strong>
            Pass ${player.seasonStats.passYards}/${player.seasonStats.passTD},
            Rush ${player.seasonStats.rushYards}/${player.seasonStats.rushTD},
            Rec ${player.seasonStats.recYards}/${player.seasonStats.recTD},
            Tkl ${player.seasonStats.tackles}
          </p>
          <p>
            ${player.awards.length
              ? player.awards.map(award => `<span class="pill gold">${escapeHtml(award)}</span>`).join(" ")
              : "<span class='muted'>No awards yet.</span>"}
          </p>
        </div>
      </div>

      <div class="card" style="margin-top:14px">
        <h3>Coach Notes</h3>
        ${player.notes.map(note => `<p class="muted">${escapeHtml(note)}</p>`).join("")}
      </div>
    `
  );

  showModal();
  bindPlayerPositionEditor(player);
  } catch (error) {
    console.error(error);
    toast(`Player card failed: ${error.message}`);
  }
}

function showIntroNewspaper() {
  setModal(
    "The Stroud Gazette",
    "New head coach introduction",
    `
      <div class="news-paper">
        <h3>The Stroud Gazette</h3>
        <h4>Tigers Hire New Head Coach After 2-8 Season</h4>
        <p>
          Stroud football is looking for a reset. Last year ended at 2-8, with too many long Friday nights
          and not enough answers. The school board has handed the program to a new head coach with one job:
          make the Tigers matter again.
        </p>
        <p>Enter your coach name below. It will appear in newspapers and program history.</p>
        <input id="coachNameInput" placeholder="Coach name" style="background:#fff;color:#111;border:1px solid #8b7d58">
        <br><br>
        <button id="beginSeasonBtn" class="gold">Begin New Season</button>
      </div>
    `
  );

  showModal();

  document.getElementById("beginSeasonBtn").addEventListener("click", startFirstSeason);
}

function setModal(title, subtitle, html) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalSubtitle").textContent = subtitle;
  document.getElementById("modalBody").innerHTML = html;
}

function showModal() {
  document.getElementById("modalBackdrop").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modalBackdrop").classList.add("hidden");
}

function saveLocalSilent() {
  if (!game) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
}




function ensureRivalTeams() {
  if (!game?.teams) return;

  for (const name of EXTRA_TEAMS) {
    if (!game.teams.some(team => team.name === name)) {
      game.teams.push(createTeam(name, "Rival"));
    }
  }

  for (const team of game.teams) {
    if (MASCOTS[team.name]) team.mascot = MASCOTS[team.name];
  }
}

function repairScheduleIfNeeded() {
  if (!game || game.phase !== "regular") return;
  if (!game.schedule?.length) return;

  const stroudGames = game.schedule.filter(item => item.homeId === "team_stroud" || item.awayId === "team_stroud");
  const opponentNames = stroudGames.map(item => {
    const opponentId = item.homeId === "team_stroud" ? item.awayId : item.homeId;
    return getTeam(opponentId)?.name;
  });

  const hasCurrentRivals = RIVALS.every(name => opponentNames.includes(name));
  const hasOldRivals = opponentNames.includes("Depew") || opponentNames.includes("Davenport");

  if (!hasCurrentRivals || hasOldRivals || stroudGames.length < 10) {
    game.schedule = createSchedule();
    // schedule repaired silently
  }
}

/* ----------------------------- UI small helpers ---------------------------- */

function confirmNewDynasty() {
  if (!game) {
    createNewDynastyIntro();
    return;
  }

  const ok = window.confirm(
    "Start a new dynasty? This will replace the current local dynasty unless you export or cloud save it first."
  );

  if (ok) createNewDynastyIntro();
}


function playerDepthRoles(playerId) {
  const roles = [];
  if (!game?.depth || !playerId) return roles;

  for (const [side, positions] of Object.entries(game.depth)) {
    for (const [position, slots] of Object.entries(positions)) {
      if (slots[0] === playerId) roles.push({ type: "Starter", side, position });
      if (slots[1] === playerId) roles.push({ type: "Backup", side, position });
    }
  }

  return roles;
}

function playerVarsityStatus(playerId) {
  const roles = playerDepthRoles(playerId);
  if (!roles.length) return "JV";

  const starters = roles.filter(role => role.type === "Starter").map(role => `${role.type} ${role.position}`);
  const backups = roles.filter(role => role.type === "Backup").map(role => `${role.type} ${role.position}`);
  return [...starters, ...backups].join(" / ");
}

function playerSimpleStatus(playerId) {
  const roles = playerDepthRoles(playerId);
  if (!roles.length) return "JV";
  if (roles.some(role => role.type === "Starter")) return "STARTER";
  return "BACKUP";
}

function playerStatusClass(playerId) {
  const status = playerSimpleStatus(playerId);
  if (status === "STARTER") return "starter";
  if (status === "BACKUP") return "backup";
  return "jv";
}

function playerStatusPill(playerId) {
  const status = playerSimpleStatus(playerId);
  return `<span class="status-pill ${playerStatusClass(playerId)}">${status}</span>`;
}

function varsityCounts() {
  const varsityIds = new Set();
  if (!game?.depth) return { varsity: 0, jv: game?.players?.length || 0 };

  for (const side of Object.values(game.depth)) {
    for (const slots of Object.values(side)) {
      if (slots[0]) varsityIds.add(slots[0]);
      if (slots[1]) varsityIds.add(slots[1]);
    }
  }

  return {
    varsity: varsityIds.size,
    jv: Math.max(0, game.players.length - varsityIds.size)
  };
}


function playerCurrentRoleText(player) {
  if (!player) return "";

  const offenseText = player.offensePosition ? `Off ${player.offensePosition}` : "Off -";
  const defenseText = player.defensePosition ? `Def ${player.defensePosition}` : "Def -";
  const specialText = player.specialPosition ? `ST ${player.specialPosition}` : "ST -";

  return `${offenseText} / ${defenseText} / ${specialText}`;
}

function currentAssignedGradeText(player) {
  if (!player) return "";

  const grades = [];
  if (player.offensePosition) grades.push(`Off ${player.offensePosition}: ${letterGrade(positionFit(player, player.offensePosition))}`);
  if (player.defensePosition) grades.push(`Def ${player.defensePosition}: ${letterGrade(positionFit(player, player.defensePosition))}`);
  if (player.specialPosition) grades.push(`ST ${player.specialPosition}: ${letterGrade(positionFit(player, player.specialPosition))}`);

  return grades.join(" • ");
}

function depthOptionLabel(player, position) {
  const projected = letterGrade(positionFit(player, position));
  const current = playerCurrentRoleText(player);
  return `${player.name} • ${player.grade} • ${formatHeight(player.height)} ${player.weight} • ${current} • Here: ${projected}`;
}

function findStroudGame(games) {
  return games.find(item => item.homeId === "team_stroud" || item.awayId === "team_stroud");
}

/* -------------------------- Settings and tutorial ------------------------- */

function openSettings() {
  setModal(
    "Settings",
    "Audio, saves, display, and reset tools.",
    `
      <div class="grid two">
        <div class="card">
          <h3>Audio</h3>
          <div class="settings-row">
            <div>
              <strong>Sounds</strong>
              <p class="muted small">Menu clicks, whistle-style advance, injuries, and big newspaper moments.</p>
            </div>
            <button id="settingsSoundBtn" class="secondary">${soundEnabled ? "On" : "Off"}</button>
          </div>
        </div>

        <div class="card">
          <h3>Save Tools</h3>
          <div class="grid">
            <button id="settingsSaveLocalBtn">Save Local</button>
            <button id="settingsSaveCloudBtn" class="secondary">Save Cloud</button>
            <button id="settingsLoadCloudBtn" class="secondary">Load Cloud</button>
            <button id="settingsExportBtn" class="secondary">Export Save</button>
            <button id="settingsClearCacheBtn" class="danger">Clear Cache & Reload</button>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:14px">
        <h3>Roster Rules</h3>
        <p class="muted">
          Every player has one offensive position and one defensive position on his player profile.
          On the depth chart, a player can fill 1 offense spot, 1 defense spot, and 1 special teams spot.
        </p>
        <p class="muted">
          Two-way starters lose a small amount of effectiveness by quarter:
          Q1 100%, Q2 98%, Q3 96%, Q4 94%. Gamer and Clutch players can fight through that better.
        </p>
      </div>
    `
  );

  showModal();

  document.getElementById("settingsSoundBtn").addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    document.getElementById("settingsSoundBtn").textContent = soundEnabled ? "On" : "Off";
    playSound("click");
  });

  document.getElementById("settingsSaveLocalBtn").addEventListener("click", saveLocal);
  document.getElementById("settingsSaveCloudBtn").addEventListener("click", saveCloud);
  document.getElementById("settingsLoadCloudBtn").addEventListener("click", loadCloud);
  document.getElementById("settingsExportBtn").addEventListener("click", exportSave);
  document.getElementById("settingsClearCacheBtn").addEventListener("click", () => {
    localStorage.clear();
    location.reload();
  });
}

function openTutorial() {
  setModal(
    "Coach Walkthrough",
    "How to play HS Football GM.",
    `
      <div class="tutorial-section">
        <h3>Welcome Coach</h3>
        <p class="muted">
          You took over Stroud after a 2-8 season. You do not recruit. Every year, 4-12 freshmen show up.
          Your job is to develop them, find positions, survive the regular season, and make a run at state.
        </p>
      </div>

      <div class="tutorial-section">
        <h3>The Weekly Loop</h3>
        <ol>
          <li>Review the newspaper, rankings, standings, injuries, and notes.</li>
          <li>Open player cards and look for clues about hidden traits.</li>
          <li>Adjust schemes, practice focus, and the depth chart.</li>
          <li>Advance the week and read the new Friday Night Paper.</li>
        </ol>
      </div>

      <div class="tutorial-section">
        <h3>Hidden Traits</h3>
        <p class="muted">
          Gamer and Clutch are true/false traits. Football IQ, Work Ethic, and Genetics are hidden ratings.
          You never see exact values right away. Practices and games reveal ranges over time.
        </p>
      </div>

      <div class="tutorial-section">
        <h3>Positions and Depth Chart</h3>
        <p class="muted">
          Every player has an offensive and defensive position, but you can place anyone anywhere.
          The game gives letter grades, not hard rules. A lineman can play QB if you want, but the results may be ugly.
        </p>
      </div>

      <div class="tutorial-section">
        <h3>Rivalries</h3>
        <p class="muted">
          Stroud plays Chandler, Bristow, Prague, and Cushing every year. Rivalry wins affect prestige,
          newspaper coverage, and program history.
        </p>
      </div>

      <div class="tutorial-section">
        <h3>Playoffs</h3>
        <p class="muted">
          The regular season is 10 games. The playoffs are 16 teams and 4 single-elimination rounds:
          Round 1, Quarterfinal, Semifinal, State Championship.
        </p>
      </div>
    `
  );

  showModal();
}

function exportSave() {
  if (!game) return;

  const blob = new Blob([JSON.stringify(game, null, 2)], { type: "application/json" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = "hs-football-gm-save.json";
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

function updateRivalryRecord(scheduledGame) {
  if (!scheduledGame || !(scheduledGame.homeId === "team_stroud" || scheduledGame.awayId === "team_stroud")) return;

  const opponentId = scheduledGame.homeId === "team_stroud" ? scheduledGame.awayId : scheduledGame.homeId;
  const opponent = getTeam(opponentId);
  if (!opponent || !RIVALS.includes(opponent.name)) return;

  game.rivalries ||= createRivalries();
  const rivalry = game.rivalries[opponent.name];
  if (!rivalry) return;

  const stroudWon = (scheduledGame.homeId === "team_stroud" && scheduledGame.homeScore > scheduledGame.awayScore)
    || (scheduledGame.awayId === "team_stroud" && scheduledGame.awayScore > scheduledGame.homeScore);

  if (stroudWon) {
    rivalry.stroudWins += 1;
    rivalry.currentStreakTeam = "Stroud";
    rivalry.currentStreak = rivalry.currentStreakTeam === "Stroud" ? rivalry.currentStreak + 1 : 1;
  } else {
    rivalry.opponentWins += 1;
    rivalry.currentStreakTeam = opponent.name;
    rivalry.currentStreak = rivalry.currentStreakTeam === opponent.name ? rivalry.currentStreak + 1 : 1;
  }

  const margin = Math.abs(scheduledGame.homeScore - scheduledGame.awayScore);
  if (!rivalry.biggestGame || margin > rivalry.biggestGame.margin) {
    rivalry.biggestGame = {
      year: game.year,
      margin,
      score: `${scheduledGame.homeScore}-${scheduledGame.awayScore}`,
      winner: stroudWon ? "Stroud" : opponent.name
    };
  }
}

function createRivalries() {
  return {
    Chandler: { trophy: "Route 66 Trophy", stroudWins: 21, opponentWins: 26, currentStreakTeam: "Chandler", currentStreak: 2, biggestGame: null },
    Bristow: { trophy: "Creek County Classic", stroudWins: 17, opponentWins: 14, currentStreakTeam: "Stroud", currentStreak: 1, biggestGame: null },
    Prague: { trophy: "Lincoln County Cup", stroudWins: 18, opponentWins: 19, currentStreakTeam: "Prague", currentStreak: 1, biggestGame: null },
    Cushing: { trophy: "Pipeline Trophy", stroudWins: 12, opponentWins: 22, currentStreakTeam: "Cushing", currentStreak: 3, biggestGame: null }
  };
}

function adjustPrestigeForGame(scheduledGame) {
  if (!scheduledGame || !(scheduledGame.homeId === "team_stroud" || scheduledGame.awayId === "team_stroud")) return;

  const opponent = getTeam(scheduledGame.homeId === "team_stroud" ? scheduledGame.awayId : scheduledGame.homeId);
  const stroudWon = (scheduledGame.homeId === "team_stroud" && scheduledGame.homeScore > scheduledGame.awayScore)
    || (scheduledGame.awayId === "team_stroud" && scheduledGame.awayScore > scheduledGame.homeScore);
  const margin = Math.abs(scheduledGame.homeScore - scheduledGame.awayScore);

  let change = 0;
  if (stroudWon) change += RIVALS.includes(opponent.name) ? 3 : 1;
  else change -= margin >= 28 ? 2 : 1;

  if (scheduledGame.playoff && stroudWon) change += 4;
  if (scheduledGame.district && stroudWon) change += 2;

  game.prestige = clamp((game.prestige ?? 25) + change, 1, 99);
}

/* ------------------------------- Listeners ------------------------------- */

bindClick("mainMenuBtn", openMainMenu);
bindClick("googleSignInBtn", async () => {
  try {
    await ensureFirebase();
    await firebaseFns.signInWithPopup(auth, googleProvider);
    if (!game && loadLocal()) {
      showApp();
      render();
    } else {
      toast("Signed in. Start or load a dynasty.");
    }
  } catch (error) {
    toast(`Google failed: ${error.message}`);
  }
});

bindClick("guestSignInBtn", async () => {
  try {
    await ensureFirebase();
    await firebaseFns.signInAnonymously(auth);
    if (loadLocal()) {
      showApp();
      render();
    } else {
      toast("Guest signed in. Start a dynasty.");
    }
  } catch (error) {
    toast(`Guest failed: ${error.message}`);
  }
});

bindClick("newDynastyBtn", confirmNewDynasty);
bindClick("topNewDynastyBtn", confirmNewDynasty);
bindClick("advanceWeekBtn", advanceWeek);
bindClick("watchGameBtn", watchGame);
bindClick("startNextSeasonBtn", advanceToNextSeason);

bindClick("topSaveLocalBtn", saveLocal);
bindClick("topSaveCloudBtn", saveCloud);
bindClick("topLoadCloudBtn", loadCloud);
bindClick("topExportBtn", exportSave);

bindClick("loadCloudBtnLogin", loadCloud);
bindClick("settingsBtn", openSettings);
bindClick("tutorialBtn", openTutorial);

bindClick("clearCacheBtn", () => {
  localStorage.clear();
  location.reload();
});

bindClick("closeModalBtn", closeModal);

const watchGameOverlayNode = document.getElementById("watchGameOverlay");
if (watchGameOverlayNode) {
  watchGameOverlayNode.addEventListener("click", event => {
    if (event.target.id === "watchGameOverlay") closeWatchGameOverlay();
  });
}

const playerSelectOverlayNode = document.getElementById("playerSelectOverlay");
if (playerSelectOverlayNode) {
  playerSelectOverlayNode.addEventListener("click", event => {
    if (event.target.id === "playerSelectOverlay") closeDepthPlayerSelect();
  });
}

const menuOverlayNode = document.getElementById("menuOverlay");
if (menuOverlayNode) {
  menuOverlayNode.addEventListener("click", event => {
    if (event.target.id === "menuOverlay") closeMainMenu();
  });
}

const modalBackdropNode = document.getElementById("modalBackdrop");
if (modalBackdropNode) {
  modalBackdropNode.addEventListener("click", event => {
    if (event.target.id === "modalBackdrop") closeModal();
  });
}

bindClick("importSaveBtnLogin", () => {
  document.getElementById("importFileInput")?.click();
});

const importFileInput = document.getElementById("importFileInput");
if (importFileInput) {
  importFileInput.addEventListener("change", event => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        game = JSON.parse(reader.result);
        migrateSave();
        saveLocalSilent();
        showApp();
        render();
        toast("Imported save.");
      } catch {
        toast("Import failed.");
      }
    };

    reader.readAsText(file);
  });
}




document.addEventListener("click", event => {
  const watchButton = event.target.closest?.("#watchGameBtn");
  if (watchButton) {
    event.preventDefault();
    event.stopPropagation();
    watchGame();
  }
});


document.addEventListener("click", event => {
  const playerNode = event.target.closest?.("[data-player-id]");
  if (!playerNode) return;

  const playerId = playerNode.dataset.playerId;
  if (!playerId) return;

  event.preventDefault();
  event.stopPropagation();
  openPlayerCard(playerId);
});

/* -------------------------------- Startup -------------------------------- */

try {
  console.log("HS Football GM v0.0.8-alpha");
  if (loadLocal()) {
    showApp();
    render();
  } else {
    showLogin();
  }
} catch (error) {
  reportFatalError(error);
  showLogin();
}
function finishPlayoffsAfterStroudElimination() {
  if (!game.playoffBracket || !game.playoffBracket.length) return null;

  let safety = 0;
  while (game.playoffBracket.some(g => !g.played) && safety < 100) {
    safety++;
    const next = game.playoffBracket.find(g => !g.played);
    if (!next) break;

    // If Stroud is still in the next game, leave it for the user to play/watch.
    if (next.homeId === "team_stroud" || next.awayId === "team_stroud") break;

    simulateGame(next);
  }

  const played = game.playoffBracket.filter(g => g.played);
  const finalGame = played[played.length - 1];
  if (!finalGame) return null;

  const championId = finalGame.homeScore >= finalGame.awayScore ? finalGame.homeId : finalGame.awayId;
  const champion = getTeam(championId) || { name: "Unknown" };

  game.stateChampion = {
    year: game.year,
    teamId: championId,
    teamName: champion.name,
    score: `${getTeam(finalGame.homeId)?.name || "Home"} ${finalGame.homeScore}, ${getTeam(finalGame.awayId)?.name || "Away"} ${finalGame.awayScore}`
  };

  game.seasonAwards = generateSeasonAwards();
  return game.stateChampion;
}

function generateSeasonAwards() {
  const players = [...(game.players || [])];

  const bestBy = (label, statKey, fallbackPosition = "") => {
    const sorted = players
      .map(player => ({ player, value: safeNumber(player.seasonStats?.[statKey]) }))
      .sort((a, b) => b.value - a.value);

    const best = sorted[0];
    if (!best || best.value <= 0) {
      const fallback = [...players].sort((a, b) => overallPlayerScore(b) - overallPlayerScore(a))[0];
      return { label, name: fallback?.name || "No winner", detail: fallbackPosition ? `${fallbackPosition} • coach vote` : "Coach vote" };
    }

    return { label, name: best.player.name, detail: `${best.value} ${label.toLowerCase()}` };
  };

  const allDistrict = [...players]
    .sort((a, b) => overallPlayerScore(b) - overallPlayerScore(a))
    .slice(0, 8)
    .map(player => ({ name: player.name, detail: `${player.grade} • ${rolePositionOnly(player.id, "offense")} / ${rolePositionOnly(player.id, "defense")}` }));

  const allState = [...players]
    .sort((a, b) => overallPlayerScore(b) - overallPlayerScore(a))
    .slice(0, 3)
    .map(player => ({ name: player.name, detail: `${player.grade} • ${letterGrade(overallPlayerScore(player))}` }));

  return {
    year: game.year,
    awards: [
      bestBy("Passing yards", "passYards", "QB"),
      bestBy("Rushing yards", "rushYards", "RB"),
      bestBy("Receiving yards", "recYards", "WR"),
      bestBy("Tackles", "tackles", "DEF"),
      bestBy("Sacks", "sacks", "DEF"),
      bestBy("Interceptions", "interceptions", "DB")
    ],
    allDistrict,
    allState
  };
}

function overallPlayerScore(player) {
  if (!player) return 0;
  const values = Object.values(player.stats || {}).map(v => safeNumber(v)).filter(v => Number.isFinite(v));
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}


function offseasonDevelopPlayer(player) {
  const work = safeNumber(player.hidden?.workEthic, 55);
  const genetics = safeNumber(player.hidden?.genetics, 55);
  const growthRoll = (work + genetics) / 2;

  const heightGain = Math.random() < (genetics / 165) ? rand(0, 2) : 0;
  const weightGain = clamp(Math.round(rand(3, 16) * (genetics / 75)), 1, 22);

  player.height = safeNumber(player.height, 68) + heightGain;
  player.weight = safeNumber(player.weight, 170) + weightGain;

  for (const key of Object.keys(player.stats || {})) {
    const gain = Math.max(0, Math.round((growthRoll - 35) / 32 + rand(0, 2)));
    player.stats[key] = clamp(safeNumber(player.stats[key]) + gain, 1, 99);
  }
}

function advanceToNextSeason() {
  if (!game) return;

  const oldYear = game.year || new Date().getFullYear();
  const graduating = (game.players || []).filter(player => player.grade === "SR");
  const returning = (game.players || []).filter(player => player.grade !== "SR");

  game.history = game.history || {};
  game.history.champions = game.history.champions || [];
  if (game.stateChampion) game.history.champions.unshift(game.stateChampion);
  game.history.awards = game.history.awards || [];
  if (game.seasonAwards) game.history.awards.unshift(game.seasonAwards);

  returning.forEach(player => {
    player.grade = player.grade === "JR" ? "SR" : player.grade === "SO" ? "JR" : "SO";
    offseasonDevelopPlayer(player);
    player.seasonStats = emptyPlayerStats();
  });

  const freshmanCount = rand(4, 12);
  const freshmen = [];
  for (let i = 0; i < freshmanCount; i++) {
    const player = generatePlayer("FR");
    ensurePlayerPortrait(player);
    freshmen.push(player);
  }

  game.players = [...returning, ...freshmen];
  game.year = oldYear + 1;
  game.week = 1;
  game.phase = "regular";
  game.depth = emptyDepthChart();
  game.schedule = makeSchedule(game.year);
  game.playoffBracket = [];
  game.newspapers = [];
  game.lastResult = null;
  game.stateChampion = null;
  game.seasonAwards = null;
  game.offseasonReason = "";

  recalculateTeamRatings();
  saveLocalSilent();
  render();

  showModal(
    "New Season",
    `${game.year} season`,
    `
      <div class="card">
        <h3>Graduation</h3>
        <p class="muted">${graduating.length} seniors graduated from Stroud.</p>
      </div>
      <div class="card">
        <h3>Incoming Freshmen</h3>
        <p class="muted">${freshmen.length} new freshmen have entered the program.</p>
        ${freshmen.map(player => `<div class="mini-card"><strong>${escapeHtml(player.name)}</strong><br>${player.grade} • ${formatHeight(player.height)} • ${player.weight} lbs</div>`).join("")}
      </div>
      <div class="card">
        <h3>Depth Chart Reset</h3>
        <p class="muted">Your varsity two-deep has been cleared. Set starters and backups before Week 1.</p>
        <button id="newSeasonDepthBtn">Set Depth Chart</button>
      </div>
    `
  );

  setTimeout(() => {
    const button = document.getElementById("newSeasonDepthBtn");
    if (button) button.addEventListener("click", () => {
      closeModal();
      navigate("depth");
    });
  }, 0);
}



window.advanceToNextSeason = advanceToNextSeason;

function advancePlayoffBracketAfterGame(scheduledGame) {
  if (typeof buildNextPlayoffRound === "function") buildNextPlayoffRound();
}
