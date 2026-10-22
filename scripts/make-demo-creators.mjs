// Makes data/demo-creators.json: 100 MADE-UP creators for the demo. Not real people.
// The random numbers use a fixed seed, so running this again gives the same file.
// Run with: node scripts/make-demo-creators.mjs
//
// The mix:
//   65 honest creators: normal engagement, real conversation, steady growth
//   20 suspicious: 7 huge following with very few comments, 7 sudden follower jumps,
//                  6 repetitive/generic comments
//   15 too little data: 5 under 1,000 followers, 5 accounts under a week old, 5 with no likes/comments recorded
import { writeFileSync, mkdirSync } from "node:fs";

let seed = 20261023;
const rand = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (a, b) => a + rand() * (b - a);
const int = (a, b) => Math.round(between(a, b));
const pick = (list) => list[Math.floor(rand() * list.length)];
const round = (n, step) => Math.round(n / step) * step;

const CITIES = [
  ["Mumbai", "Maharashtra"], ["Delhi", "Delhi"], ["Bengaluru", "Karnataka"], ["Hyderabad", "Telangana"],
  ["Chennai", "Tamil Nadu"], ["Kolkata", "West Bengal"], ["Pune", "Maharashtra"], ["Ahmedabad", "Gujarat"],
  ["Jaipur", "Rajasthan"], ["Lucknow", "Uttar Pradesh"], ["Chandigarh", "Chandigarh"], ["Kochi", "Kerala"],
  ["Indore", "Madhya Pradesh"], ["Goa", "Goa"],
];
// Mumbai and Delhi get more creators, as in real life
const CITY_WEIGHTS = [5, 4, 4, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1];
const pickCity = () => {
  let r = rand() * CITY_WEIGHTS.reduce((a, b) => a + b, 0);
  for (let i = 0; i < CITIES.length; i++) if ((r -= CITY_WEIGHTS[i]) < 0) return CITIES[i];
  return CITIES[0];
};

const NICHES = {
  Beauty: { subs: ["Skincare", "Makeup", "Haircare", "Clean beauty"], words: ["glow", "skin", "dewy", "blush", "beauty"], ages: [45, 35, 14, 6] },
  Fashion: { subs: ["Streetwear", "Ethnic wear", "Sustainable fashion", "Menswear"], words: ["style", "fits", "drip", "threads", "closet"], ages: [42, 38, 14, 6] },
  Food: { subs: ["Home cooking", "Street food", "Healthy eating", "Baking"], words: ["eats", "kitchen", "tadka", "bakes", "foodie"], ages: [28, 40, 22, 10] },
  Fitness: { subs: ["Gym training", "Yoga", "Running", "Home workouts"], words: ["fit", "lifts", "yoga", "runs", "strong"], ages: [36, 42, 16, 6] },
  Tech: { subs: ["Gadget reviews", "Smartphones", "Productivity", "Gaming"], words: ["tech", "gadgets", "unboxed", "bytes", "geek"], ages: [40, 38, 16, 6] },
  Home: { subs: ["Home decor", "Plants", "Organising", "DIY"], words: ["nest", "home", "plants", "decor", "nook"], ages: [18, 40, 28, 14] },
};
const NAMES = ["tara", "riya", "kabir", "ananya", "arjun", "meera", "zoya", "vikram", "isha", "rohan", "neha", "aditya", "sana", "dev", "kavya", "nikhil", "pooja", "aman", "diya", "karan", "simran", "yash", "anika", "rahul", "aisha", "varun", "mira", "sid", "priya", "ayaan"];
const BRANDS = ["Lotus Leaf Co.", "UrbanKraft", "Spice Route", "FitFuel", "Nimbus Tech", "Casa Verde", "Rang Threads", "Glowberry", "PeakPro", "Chai Theory", "Loom & Lane", "PixelNest"];

// Tiers by followers, with a normal engagement rate range (%) and a rate per post (₹)
const TIERS = [
  { name: "nano", f: [1_500, 9_800], er: [3.5, 9], rate: [1_500, 6_000] },
  { name: "micro", f: [10_000, 99_000], er: [1.8, 6], rate: [6_000, 45_000] },
  { name: "mid", f: [100_000, 480_000], er: [1.2, 4], rate: [45_000, 1_60_000] },
  { name: "macro", f: [500_000, 2_400_000], er: [0.7, 2.8], rate: [1_60_000, 6_00_000] },
];
const TIER_WEIGHTS = [0.3, 0.42, 0.2, 0.08];
const pickTier = () => {
  let r = rand();
  for (let i = 0; i < TIERS.length; i++) if ((r -= TIER_WEIGHTS[i]) < 0) return TIERS[i];
  return TIERS[1];
};

const used = new Set();
function handleFor(nicheKey) {
  for (;;) {
    const h = `${pick(NAMES)}_${pick(NICHES[nicheKey].words)}${rand() < 0.4 ? int(1, 99) : ""}.demo`;
    if (!used.has(h)) { used.add(h); return h; }
  }
}

function audienceAges(base) {
  const raw = base.map((p) => Math.max(2, p + between(-10, 10)));
  const total = raw.reduce((a, b) => a + b, 0);
  const pct = raw.map((p) => Math.round((p / total) * 100));
  pct[1] += 100 - pct.reduce((a, b) => a + b, 0);
  return { "18-24": pct[0], "25-34": pct[1], "35-44": pct[2], "45+": pct[3] };
}

// Audiences mostly come from the creator's own city, then big metros (as on real Indian accounts)
function topCities(home) {
  const own = int(25, 55);
  const metroFirst = (c) => (["Mumbai", "Delhi", "Bengaluru"].includes(c) ? rand() * 0.5 : 0.3 + rand());
  const others = CITIES.filter(([c]) => c !== home).sort((a, b) => metroFirst(a[0]) - metroFirst(b[0])).slice(0, 3);
  const second = int(8, 18), third = int(5, 12), fourth = int(3, 8);
  return [
    { city: home, pct: own },
    { city: others[0][0], pct: second },
    { city: others[1][0], pct: third },
    { city: others[2][0], pct: fourth },
  ];
}

// 13 weekly follower counts ending at today's count. `jumpWeek` adds one sudden spike.
function history(followers, growth90Pct, jumpWeek = -1, jumpPct = 0) {
  const start = followers / (1 + growth90Pct / 100);
  const weeks = [];
  let count = start;
  const steady = (followers - start - (jumpWeek >= 0 ? start * (jumpPct / 100) : 0)) / 12;
  for (let w = 0; w < 13; w++) {
    weeks.push(Math.round(count));
    count += Math.max(0, steady * between(0.6, 1.4));
    if (w === jumpWeek) count += start * (jumpPct / 100);
  }
  weeks[12] = followers;
  return weeks;
}

function creator(kind, i) {
  const nicheKey = pick(Object.keys(NICHES));
  const niche = NICHES[nicheKey];
  const [city, state] = pickCity();
  const tier = pickTier();
  let followers = round(between(...tier.f), 50);
  let er = between(...tier.er);
  let commentShare = between(2, 7); // comments as % of likes
  let growth90 = between(2, 14);
  let jumpWeek = -1, jumpPct = 0;
  let generic = int(4, 14); // generic comments out of 50
  let repeated = int(0, 4);
  let daysOfData = 90;
  let postsPerMonth = int(6, 20);
  let rate = round(between(...tier.rate), 500);

  if (kind === "fewcomments") { // big following, very few comments (bought followers/likes)
    followers = round(between(2_50_000, 15_00_000), 1000);
    er = between(0.2, 0.5);
    commentShare = between(0.15, 0.5);
    rate = round(between(1_20_000, 4_00_000), 1000);
  } else if (kind === "jump") { // sudden follower jump
    jumpWeek = int(6, 10);
    jumpPct = between(35, 80);
    growth90 = jumpPct + between(3, 10);
    er = tier.er[0] * between(0.35, 0.6);
  } else if (kind === "repetitive") { // engagement-pod style comments
    generic = int(24, 34);
    repeated = int(10, 16);
    er = tier.er[1] * between(0.9, 1.3);
    commentShare = between(5, 10);
  } else if (kind === "tiny") {
    followers = int(250, 950);
  } else if (kind === "new") {
    daysOfData = int(2, 6);
    followers = round(between(4_000, 30_000), 50);
    postsPerMonth = int(2, 6);
  } else if (kind === "blank") {
    followers = round(between(3_000, 60_000), 50);
  }

  // Rate follows the creator's real size (suspicious "few comments" creators keep their inflated rate)
  if (kind !== "fewcomments") rate = round(between(...TIERS.find((t) => followers <= t.f[1] * 1.05 || t === TIERS.at(-1)).rate), 500);

  const avgLikes = kind === "blank" ? 0 : Math.round((followers * er) / 100 / (1 + commentShare / 100));
  const avgComments = kind === "blank" ? 0 : Math.round((avgLikes * commentShare) / 100);
  const weeks = kind === "new" ? [followers] : history(followers, growth90, jumpWeek, jumpPct);

  // ~30 creators have past promo-code/link campaigns; fakes sold far less
  let pastCampaigns = [];
  if (!["tiny", "new", "blank"].includes(kind) && rand() < 0.36) {
    const engaged = followers * (er / 100);
    const convert = kind === "honest" ? between(0.006, 0.02) : between(0.0005, 0.002);
    pastCampaigns = Array.from({ length: int(1, 3) }, () => ({
      brand: pick(BRANDS),
      orders: Math.max(1, Math.round(engaged * convert * between(0.7, 1.3))),
      method: rand() < 0.6 ? "promo code" : "link",
    }));
  }

  return {
    id: `c${String(i + 1).padStart(3, "0")}`,
    handle: handleFor(nicheKey),
    platform: rand() < 0.88 ? "Instagram" : "YouTube",
    niche: nicheKey,
    subNiche: pick(niche.subs),
    city,
    state,
    followers,
    avgLikes,
    avgComments,
    followerHistory: weeks,
    daysOfData,
    postsPerMonth,
    audienceAge: audienceAges(niche.ages),
    audienceTopCities: topCities(city),
    commentSample: { checked: kind === "blank" ? 0 : 50, generic: kind === "blank" ? 0 : generic, repeated: kind === "blank" ? 0 : repeated },
    pastBrands: Array.from({ length: int(0, 4) }, () => pick(BRANDS)).filter((b, j, a) => a.indexOf(b) === j),
    ratePerPost: rate,
    pastCampaigns,
    demoKind: kind, // for checking the demo only; never shown as a label
  };
}

const kinds = [
  ...Array(65).fill("honest"),
  ...Array(7).fill("fewcomments"), ...Array(7).fill("jump"), ...Array(6).fill("repetitive"),
  ...Array(5).fill("tiny"), ...Array(5).fill("new"), ...Array(5).fill("blank"),
].sort(() => rand() - 0.5);

const creators = kinds.map(creator);
mkdirSync("data", { recursive: true });
writeFileSync("data/demo-creators.json", JSON.stringify(creators, null, 1) + "\n");
const count = (k) => creators.filter((c) => c.demoKind === k).length;
console.log(`Wrote ${creators.length} demo creators:`, {
  honest: count("honest"), fewcomments: count("fewcomments"), jump: count("jump"), repetitive: count("repetitive"),
  tiny: count("tiny"), new: count("new"), blank: count("blank"),
  withPastSales: creators.filter((c) => c.pastCampaigns.length).length,
  youtube: creators.filter((c) => c.platform === "YouTube").length,
});
