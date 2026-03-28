import { RPC, CHROMATIC, FIXED_KEY, SCALE_IVS, CHORD_FUNCS } from "./constants.js";

// --- CIRCLE-OF-FIFTHS MELODIC STATE MACHINE ---
export function nextMelodicNote(state, chordTones, minOct, maxOct, style = "lyrical") {
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
    if      (r < 0.40) d += Math.random() < 0.58 ? 1 : -1;
    else if (r < 0.60) d += Math.random() < 0.5 ? 2 : -2;
    else if (r < 0.82) {
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

// --- BLOCK → MUSICAL CONTEXT ---
export function blockToContext(block) {
  const { hash, txCount, fees, programs } = block;
  const { rootIdx } = FIXED_KEY;

  const chordIdx     = parseInt(hash.slice(4, 6), 16) % CHORD_FUNCS.length;
  const chord        = CHORD_FUNCS[chordIdx];
  const chordVoicing = chord.tones.map(t => `${CHROMATIC[(rootIdx + t) % 12]}3`);
  const chordDensity = Math.min(1.0, Math.max(0.25, (txCount - 200) / 1800));
  const activeVoices = Math.min(6, Math.max(2,
    programs > 30 ? 6 : programs > 20 ? 5 : programs > 12 ? 4 : programs > 6 ? 3 : 2
  ));
  const filterFreq   = Math.min(5500, Math.max(700, fees * 1000 + 900));

  return {
    chordTones:   chord.tones,
    chordVoicing,
    hornNote:     `${CHROMATIC[(rootIdx + chord.rootOff) % 12]}3`,
    hornFifth:    `${CHROMATIC[(rootIdx + (chord.rootOff + 7) % 12) % 12]}3`,
    timpani:      `${CHROMATIC[rootIdx]}1`,
    chordName:    chord.name,
    chordDensity, activeVoices, filterFreq,
  };
}
