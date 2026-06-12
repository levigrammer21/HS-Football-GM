
"use strict";
const BUILD_VERSION = "v0.0.15-alpha";
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
  if (!node) {
    console.warn(`Missing button: ${id}`);
    return;
  }
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
        note: "The current depth chart is a staff guess. Open player cards, move kids around, or leave it for later."
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

function getTeam(teamId) {
  return game.teams.find(team => team.id === teamId);
}

function teamByName(name) {
  return game.teams.find(team => team.name === name);
}

function getPlayer(playerId) {
  return game.players.find(player => player.id === playerId);
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

  return {
    varsity: varsityIds.size,
    jv: Math.max(0, game.players.length - varsityIds.size)
  };
}

function rosterRoleForSide(playerId, side) {
  const roles = playerDepthRoles(playerId).filter(role => role.side === side);
  if (!roles.length) return "JV";
  return roles.map(role => `${role.type} ${role.position}`).join(" / ");
}

function positionLabelForDropdown(player, position) {
  return `${player.name} • ${player.grade} • ${formatHeight(player.height)} ${player.weight} • ${playerSimpleStatus(player.id)} • Here: ${letterGrade(positionFit(player, position))}`;
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
  showFinalResultThenPaper();
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

function simulateGame(scheduledGame) {
  const home = getTeam(scheduledGame.homeId);
  const away = getTeam(scheduledGame.awayId);

  const activeDepth = JSON.parse(JSON.stringify(game.depth));
  const participation = [];
  scheduledGame.log = [];

  for (let quarter = 1; quarter <= 4; quarter++) {
    processQuarterInjuries(scheduledGame, quarter, activeDepth);
    participation.push(JSON.parse(JSON.stringify(activeDepth)));
  }

  const [homeScore, awayScore] = simulateScore(home, away);
  scheduledGame.homeScore = homeScore;
  scheduledGame.awayScore = awayScore;
  scheduledGame.played = true;

  scheduledGame.stats = {
    home: simulateBoxScore(home, away, homeScore),
    away: simulateBoxScore(away, home, awayScore)
  };

  applyTeamResult(home, away, homeScore, awayScore, scheduledGame.district);

  if (scheduledGame.homeId === "team_stroud" || scheduledGame.awayId === "team_stroud") {
    applyStroudStats(scheduledGame, participation);
    updateRivalryRecord(scheduledGame);
    adjustPrestigeForGame(scheduledGame);
  }
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

function rushingSharesForScheme() {
  const scheme = game.settings.offense;
  if (scheme === "Wing-T") return { qb: 0.08, rb: 0.28, fb: 0.34, wr: 0.10, other: 0.20 };
  if (["Flexbone", "Wishbone", "Option"].includes(scheme)) return { qb: 0.24, rb: 0.26, fb: 0.25, wr: 0.06, other: 0.19 };
  if (scheme === "Power-I") return { qb: 0.03, rb: 0.52, fb: 0.22, wr: 0.02, other: 0.21 };
  if (scheme === "Air Raid") return { qb: 0.06, rb: 0.68, fb: 0.02, wr: 0.04, other: 0.20 };
  if (scheme === "Spread") return { qb: 0.16, rb: 0.60, fb: 0.02, wr: 0.05, other: 0.17 };
  return { qb: 0.08, rb: 0.56, fb: 0.12, wr: 0.04, other: 0.20 };
}

function applyStroudStats(scheduledGame, participation) {
  const stroudIsHome = scheduledGame.homeId === "team_stroud";
  const teamStats = stroudIsHome ? scheduledGame.stats.home : scheduledGame.stats.away;
  const opponentScore = stroudIsHome ? scheduledGame.awayScore : scheduledGame.homeScore;
  const myScore = stroudIsHome ? scheduledGame.homeScore : scheduledGame.awayScore;

  const firstDepth = participation[0];
  const ids = offensivePlayerIdsFromDepth(firstDepth);
  const defense = firstDepth.defense;
  const quarterShare = playerQuarterShares(participation);
  const gameLines = [];

  const qb = getPlayer(ids.qb);
  const rb = getPlayer(ids.rb);
  const fb = getPlayer(ids.fb);
  const wr1 = getPlayer(ids.wr1);
  const wr2 = getPlayer(ids.wr2);
  const wr3 = getPlayer(ids.wr3);
  const te = getPlayer(ids.te);
  const receivers = [wr1, wr2, wr3, te].filter(Boolean);
  const defenders = DEFENSE_POSITIONS.map(pos => getPlayer(defense[pos][0])).filter(Boolean);

  // Passing: keep HS stat lines sane.
  if (qb) {
    const share = quarterShare[qb.id] || 1;
    const passYards = scaledStat(teamStats.passYards, share);
    const passTD = scaledStat(teamStats.passTD, share);
    const qbRush = scaledStat(teamStats.rushYards * rushingSharesForScheme().qb, share);

    addStats(qb, {
      games: 1,
      passYards,
      passTD,
      intThrown: teamStats.turnovers ? rand(0, Math.min(2, teamStats.turnovers)) : 0,
      rushYards: qbRush,
      rushTD: Math.random() < 0.15 ? 1 : 0
    });

    addLineIfMeaningful(gameLines, qb, { passYards, passTD, rushYards: qbRush });
  }

  // Rushing distribution must never exceed team rushing.
  const rushShare = rushingSharesForScheme();
  const rushingWeights = {};
  if (rb) rushingWeights[rb.id] = rushShare.rb;
  if (fb) rushingWeights[fb.id] = rushShare.fb;
  if (qb) rushingWeights[qb.id] = rushShare.qb;
  if (wr1) rushingWeights[wr1.id] = rushShare.wr / 2;
  if (wr2) rushingWeights[wr2.id] = rushShare.wr / 2;

  const rushYardsById = distributeInteger(teamStats.rushYards, rushingWeights, 240);
  const rushTDById = distributeInteger(teamStats.rushTD, rushingWeights, 5);

  for (const [playerId, yards] of Object.entries(rushYardsById)) {
    const player = getPlayer(playerId);
    if (!player || player === qb) continue;
    const tds = rushTDById[playerId] || 0;

    addStats(player, {
      games: 1,
      rushYards: yards,
      rushTD: tds
    });

    addLineIfMeaningful(gameLines, player, { rushYards: yards, rushTD: tds });
  }

  // Receiving distribution must sum to team passing yards and no 0-yard TDs.
  const receivingWeights = {};
  if (wr1) receivingWeights[wr1.id] = game.settings.offense === "Air Raid" ? 1.35 : 1.0;
  if (wr2) receivingWeights[wr2.id] = 0.9;
  if (wr3) receivingWeights[wr3.id] = ["Air Raid", "Spread"].includes(game.settings.offense) ? 0.75 : 0.25;
  if (te) receivingWeights[te.id] = ["Pro Style", "Spread"].includes(game.settings.offense) ? 0.75 : 0.25;
  if (rb) receivingWeights[rb.id] = ["Air Raid", "Spread", "Pro Style"].includes(game.settings.offense) ? 0.35 : 0.1;

  const recYardsById = distributeInteger(teamStats.passYards, receivingWeights, 210);
  const recTDById = {};
  for (let i = 0; i < teamStats.passTD; i++) {
    const eligible = Object.entries(recYardsById).filter(([, yards]) => yards >= 8);
    if (!eligible.length) break;
    const [playerId] = eligible[rand(0, eligible.length - 1)];
    recTDById[playerId] = (recTDById[playerId] || 0) + 1;
  }

  for (const [playerId, yards] of Object.entries(recYardsById)) {
    const player = getPlayer(playerId);
    if (!player || yards <= 0) continue;
    const catches = Math.max(1, Math.min(12, Math.round(yards / rand(9, 18))));
    const recTD = recTDById[playerId] || 0;

    addStats(player, {
      games: 1,
      catches,
      recYards: yards,
      recTD
    });

    addLineIfMeaningful(gameLines, player, { catches, recYards: yards, recTD });
  }

  // Defensive distribution: team tackles should be realistic and spread around.
  const totalTackles = clamp(
    42 + Math.round(opponentScore * 0.45) + rand(-6, 8),
    32,
    72
  );

  const tackleWeights = {};
  for (const defender of defenders) {
    const posBoost = defender.defensePosition === "LB" ? 1.35 : defender.defensePosition === "DL" ? 1.05 : 0.9;
    tackleWeights[defender.id] = posBoost + (defender.stats.tackling || 50) / 100;
  }

  const tacklesById = distributeInteger(totalTackles, tackleWeights, 13);
  for (const [playerId, tackles] of Object.entries(tacklesById)) {
    const defender = getPlayer(playerId);
    if (!defender || tackles <= 0) continue;

    const sacks = Math.random() < 0.10 && ["DL", "LB"].includes(defender.defensePosition) ? 1 : 0;
    const interceptions = Math.random() < 0.06 && ["CB", "S", "LB"].includes(defender.defensePosition) ? 1 : 0;

    addStats(defender, {
      games: 1,
      tackles,
      sacks,
      interceptions
    });

    addLineIfMeaningful(gameLines, defender, { tackles, sacks, interceptions });
  }

  scheduledGame.playerStats = gameLines;

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

  document.getElementById("view").innerHTML = `
    <div class="card">
      <div class="split">
        <h3>Roster</h3>
        <div class="row">
          <span class="status-pill starter">Varsity ${counts.varsity}</span>
          <span class="status-pill jv">JV ${counts.jv}</span>
          <span class="pill">${game.players.length} players</span>
        </div>
      </div>

      <p class="muted small">
        Offense/Defense columns show actual varsity depth-chart roles. If a player is not in the two-deep, he shows JV.
      </p>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Offense</th>
              <th>Defense</th>
              <th>ST</th>
              <th>Yr</th>
              <th>Ht</th>
              <th>Wt</th>
              <th>Spd</th>
              <th>Str</th>
              <th>Agi</th>
              <th>Blk</th>
              <th>Tkl</th>
            </tr>
          </thead>
          <tbody>
            ${game.players.map(player => `
              <tr>
                <td><span class="player-name" data-player-id="${player.id}">${escapeHtml(player.name)}</span></td>
                <td>${playerStatusPill(player.id)}</td>
                <td>${escapeHtml(rosterRoleForSide(player.id, "offense"))}</td>
                <td>${escapeHtml(rosterRoleForSide(player.id, "defense"))}</td>
                <td>${escapeHtml(rosterRoleForSide(player.id, "special"))}</td>
                <td>${player.grade}</td>
                <td>${formatHeight(player.height)}</td>
                <td>${player.weight}</td>
                <td>${player.stats.speed}</td>
                <td>${player.stats.strength}</td>
                <td>${player.stats.agility}</td>
                <td>${player.stats.blocking}</td>
                <td>${player.stats.tackling}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.querySelectorAll("[data-player-id]").forEach(node => {
    node.addEventListener("click", () => openPlayerCard(Number(node.dataset.playerId)));
  });
}


function getDepthSortMode() {
  return window.depthSortMode || "best";
}

function setDepthSortMode(mode) {
  window.depthSortMode = mode === "name" ? "name" : "best";
}

function sortedPlayersForDepth(position) {
  const players = [...game.players];

  if (getDepthSortMode() === "name") {
    return players.sort((a, b) => a.name.localeCompare(b.name));
  }

  return players.sort((a, b) => {
    const fitDiff = positionFit(b, position) - positionFit(a, position);
    if (fitDiff !== 0) return fitDiff;
    return a.name.localeCompare(b.name);
  });
}


function renderDepth() {
  const offenseReq = requiredOffensePositions();
  const offenseBackupReq = requiredBackupOffensePositions();
  const tabs = [
    ["offense", "Offense"],
    ["defense", "Defense"],
    ["special", "Special Teams"]
  ];

  const activeSide = window.currentDepthSide || "offense";

  document.getElementById("view").innerHTML = `
    <div class="depth-toolbar">
      <button id="fillDepthBtn">Fill Staff Guess</button>
      <button id="clearDepthBtn" class="secondary">Clear</button>
      <span class="pill gold">${escapeHtml(game.settings.offense)} requirements active</span>
      <label for="depthSortSelect">Sort dropdowns</label>
      <select id="depthSortSelect">
        <option value="best">Best Here</option>
        <option value="name">Name</option>
      </select>
    </div>

    <div class="depth-tabs">
      ${tabs.map(([side, label]) => `<button data-depth-tab="${side}" class="${activeSide === side ? "active" : ""}">${label}</button>`).join("")}
    </div>

    <div class="card depth-table-card">
      ${activeSide === "offense" ? renderDepthTable("offense", OFFENSE_POSITIONS, offenseReq, offenseBackupReq) : ""}
      ${activeSide === "defense" ? renderDepthTable("defense", DEFENSE_POSITIONS, DEFENSE_POSITIONS, DEFENSE_POSITIONS) : ""}
      ${activeSide === "special" ? renderDepthTable("special", SPECIAL_POSITIONS, SPECIAL_POSITIONS, SPECIAL_POSITIONS) : ""}
    </div>
  `;

  const depthSortSelect = document.getElementById("depthSortSelect");
  if (depthSortSelect) {
    depthSortSelect.value = getDepthSortMode();
    depthSortSelect.addEventListener("change", () => {
      setDepthSortMode(depthSortSelect.value);
      renderDepth();
    });
  }

  document.querySelectorAll("[data-depth-tab]").forEach(button => {
    button.addEventListener("click", () => {
      window.currentDepthSide = button.dataset.depthTab;
      renderDepth();
    });
  });

  document.querySelectorAll("[data-depth-select]").forEach(select => {
    select.addEventListener("change", () => {
      setDepthPlayer(select.dataset.side, select.dataset.position, Number(select.dataset.slot), select.value);
      saveLocalSilent();
      renderDepth();
    });
  });

  document.getElementById("fillDepthBtn").addEventListener("click", () => {
    game.depth = staffGuessDepthChart();
    recalculateTeamRatings();
    saveLocalSilent();
    renderDepth();
  });

  document.getElementById("clearDepthBtn").addEventListener("click", () => {
    game.depth = emptyDepthChart();
    recalculateTeamRatings();
    saveLocalSilent();
    renderDepth();
  });
}

function renderDepthTable(side, positions, requiredStarters, requiredBackups) {
  return `
    <h3>${side === "offense" ? "Offense" : side === "defense" ? "Defense" : "Special Teams"}</h3>
    <table class="depth-table">
      <thead>
        <tr>
          <th>Pos</th>
          <th>Starter</th>
          <th>Backup</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${positions.map(position => renderDepthTableRow(side, position, requiredStarters.includes(position), requiredBackups.includes(position))).join("")}
      </tbody>
    </table>
  `;
}

function renderDepthTableRow(side, position, starterRequired, backupRequired) {
  const slots = game.depth[side][position];

  return `
    <tr>
      <td>
        <strong class="gold-text">${position}</strong><br>
        ${starterRequired ? `<span class="pill good">Starter required</span>` : `<span class="pill">Situational</span>`}
        ${backupRequired ? `<br><span class="pill blue">Backup required</span>` : ""}
      </td>
      <td>${renderDepthSelect(side, position, 0, slots[0])}</td>
      <td>${renderDepthSelect(side, position, 1, slots[1])}</td>
      <td class="muted small">${depthPositionNote(side, position)}</td>
    </tr>
  `;
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

function renderDepthSelect(side, position, slot, selectedId) {
  const player = getPlayer(selectedId);
  const grade = player ? letterGrade(positionFit(player, position)) : "-";
  const gradeClassName = player ? gradeClass(positionFit(player, position)) : "";

  return `
    <div>
      <select data-depth-select="1" data-side="${side}" data-position="${position}" data-slot="${slot}">
        <option value="">Empty</option>
        ${sortedPlayersForDepth(position).map(candidate => `
          <option value="${candidate.id}" ${candidate.id === selectedId ? "selected" : ""}>
            ${escapeHtml(positionLabelForDropdown(candidate, position))}
          </option>
        `).join("")}
      </select>
      <div class="depth-player-mini"><span class="pill ${gradeClassName}">Here: ${grade}</span></div>
      ${player ? `<div class="depth-context">${playerStatusPill(player.id)}<br>${escapeHtml(playerVarsityStatus(player.id))}</div>` : ""}
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
    <div class="grid">
      ${game.awards.length ? game.awards.map(awardYear => `
        <div class="card">
          <h3>${awardYear.year} Awards</h3>
          <div class="grid two">
            <div>
              ${awardYear.awards.map(item => `
                <p><strong>${escapeHtml(item.label)}</strong><br><span class="gold-text">${escapeHtml(item.winner)}</span></p>
              `).join("")}
            </div>

            <div>
              <h4>All-District</h4>
              <p>${awardYear.allDistrict.map(escapeHtml).join(", ")}</p>

              <h4>All-State</h4>
              <p>${awardYear.allState.map(escapeHtml).join(", ")}</p>
            </div>
          </div>
        </div>
      `).join("") : "<div class='card'><h3>No Awards Yet</h3><p class='muted'>Complete a season.</p></div>"}
    </div>
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

function openPlayerCard(playerId) {
  const player = getPlayer(playerId);
  if (!player) return;

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
