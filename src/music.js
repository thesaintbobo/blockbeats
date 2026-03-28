import { RPC, CHROMATIC, FIXED_KEY, SCALE_IVS, CHORD_FUNCS } from "./constants.js";

// --- CIRCLE-OF-FIFTHS MELODIC STATE MACHINE ---
// phrasePos (0-3): controls melodic arc direction
//   0-1 = rising tendency, 2-3 = resolving/falling tendency
export function nextMelodicNote(state, chordTones, minOct, maxOct, style = "lyrical", phrasePos = 1) {
  const r = Math.random();
  let { d, o } = state;

  if (style === "bass") {
    if      (r < 0.45) d = 0;
    else if (r < 0.72) d = 4;
    else if (r < 0.88) d = Math.random() < 0.5 ? 2 : 6;
    else               d = 0;
  } else if (style === "inner") {
    if      (r < 0.55) d += Math.random() < 0.55 ? 1 : -1;
    else if (r < 0.75) {
      const targets = chordTones.map(ct => SCALE_IVS.indexOf(ct)).filter(i => i >= 0);
      if (targets.length) d = targets.reduce((b, t) => Math.abs(t - d) < Math.abs(b - d) ? t : b);
    }
    else if (r < 0.9)  d += Math.random() < 0.5 ? 2 : -2;
    else               d = Math.round(d / 2);
  } else {
    // lyrical — phrase-aware arc: bars 0-1 lean up, bars 2-3 lean down (resolve)
    const stepUp = phrasePos <= 1 ? 0.62 : 0.40;
    // stronger chord-tone landing on phrase opening (bar 0)
    const chordProb = phrasePos === 0 ? 0.40 : 0.22;
    if      (r < 0.40) d += (Math.random() < stepUp ? 1 : -1);
    else if (r < 0.60) d += Math.random() < 0.5 ? 2 : -2;
    else if (r < 0.60 + chordProb) {
      const targets = chordTones.map(ct => SCALE_IVS.indexOf(ct)).filter(i => i >= 0);
      if (targets.length) d = targets.reduce((b, t) => Math.abs(t - d) < Math.abs(b - d) ? t : b);
    }
    else d = 0;
  }

  while (d < 0)  { d += 7; o--; }
  while (d >= 7) { d -= 7; o++; }
  if (o < minOct) { o = minOct; d = 0; }
  if (o > maxOct) { o = maxOct; d = 4; }

  const note = `${CHROMATIC[(FIXED_KEY.rootIdx + SCALE_IVS[d]) % 12]}${o}`;
  return { d, o, note };
}

// --- SOLANA RPC ---
export async function fetchRealBlock() {
  const slotRes = await fetch(RPC, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc:"2.0", id:1, method:"getSlot", params:[{ commitment:"finalized" }] }),
  });
  const { result: slot } = await slotRes.json();
  for (let s = slot; s >= slot - 5; s--) {
    const r = await fetch(RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc:"2.0", id:2, method:"getBlock", params:[s, { encoding:"base64", maxSupportedTransactionVersion:0, transactionDetails:"accounts", rewards:true, commitment:"finalized" }] }),
    });
    const { result: block } = await r.json();
    if (!block) continue;
    const txCount  = block.transactions?.length ?? 0;
    const fees     = (block.transactions?.reduce((s, tx) => s + (tx.meta?.fee ?? 0), 0) ?? 0) / 1e9;
    const programs = new Set(block.transactions?.flatMap(tx => tx.transaction?.accountKeys?.map(k => k.pubkey) ?? []) ?? []).size;
    return { slot: s, hash: block.blockhash, txCount, fees, programs, time: Date.now(), live: true };
  }
  return null;
}

let fakeSlot = 298_400_000;
export function generateFakeBlock() {
  const chars = "0123456789abcdef";
  let hash = ""; for (let i = 0; i < 64; i++) hash += chars[Math.floor(Math.random() * 16)];
  return { slot: fakeSlot++, hash, txCount: Math.floor(Math.random() * 2800) + 200, fees: parseFloat((Math.random() * 5 + 0.01).toFixed(4)), programs: Math.floor(Math.random() * 40) + 5, time: Date.now(), live: false };
}

// --- OPEN CHORD VOICING (two-octave spread, root doubled) ---
function openVoicing(chord, rootIdx) {
  const [r, third, fifth, sev] = chord.tones;
  const v = [
    `${CHROMATIC[(rootIdx + r)     % 12]}2`,  // root in bass
    `${CHROMATIC[(rootIdx + third) % 12]}3`,  // third
    `${CHROMATIC[(rootIdx + fifth) % 12]}3`,  // fifth
    `${CHROMATIC[(rootIdx + r)     % 12]}4`,  // root doubled, bright
  ];
  if (sev !== undefined) v.push(`${CHROMATIC[(rootIdx + sev) % 12]}4`);
  return v;
}

// --- BLOCK → MUSICAL CONTEXT ---
export function blockToContext(block) {
  const { hash, txCount, fees, programs } = block;
  const { rootIdx } = FIXED_KEY;

  const chordIdx     = parseInt(hash.slice(4, 6), 16) % CHORD_FUNCS.length;
  const chord        = CHORD_FUNCS[chordIdx];
  const chordVoicing = openVoicing(chord, rootIdx);
  const chordDensity = Math.min(1.0, Math.max(0.25, (txCount - 200) / 1800));
  const activeVoices = Math.min(6, Math.max(2,
    programs > 30 ? 6 : programs > 20 ? 5 : programs > 12 ? 4 : programs > 6 ? 3 : 2
  ));
  // Warmer filter range: 1800-4200 Hz (was 700-5500), ramp time now 1.2s
  const filterFreq = Math.min(4200, Math.max(1800, fees * 800 + 1800));

  return {
    chordTones:   chord.tones,
    chordVoicing,
    hornNote:     `${CHROMATIC[(rootIdx + chord.rootOff) % 12]}3`,
    hornFifth:    `${CHROMATIC[(rootIdx + (chord.rootOff + 7) % 12) % 12]}4`,
    timpani:      `${CHROMATIC[rootIdx]}1`,
    chordName:    chord.name,
    chordDensity, activeVoices, filterFreq,
    fees,
  };
}
