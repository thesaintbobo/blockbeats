import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";

// --- SCALES & MUSIC THEORY ---
const SCALES = {
  pentatonic: ["C", "D", "E", "G", "A"],
  minor: ["C", "D", "Eb", "F", "G", "Ab", "Bb"],
  dorian: ["C", "D", "Eb", "F", "G", "A", "Bb"],
  phrygian: ["C", "Db", "Eb", "F", "G", "Ab", "Bb"],
  mixolydian: ["C", "D", "E", "F", "G", "A", "Bb"],
};

const OCTAVES = [2, 3, 4, 5];

// --- FAKE SOLANA BLOCK GENERATOR ---
function generateBlockHash() {
  const chars = "0123456789abcdef";
  let hash = "";
  for (let i = 0; i < 64; i++) hash += chars[Math.floor(Math.random() * 16)];
  return hash;
}

function generateBlock(slot) {
  const hash = generateBlockHash();
  const txCount = Math.floor(Math.random() * 2800) + 200;
  const fees = (Math.random() * 5 + 0.01).toFixed(4);
  const rewards = (Math.random() * 0.5).toFixed(6);
  const programs = Math.floor(Math.random() * 40) + 5;
  const time = Date.now();
  return { slot, hash, txCount, fees: parseFloat(fees), rewards: parseFloat(rewards), programs, time };
}

// --- MAP BLOCK DATA TO MUSIC ---
function hashToNotes(hash, scale, count = 8) {
  const scaleNotes = SCALES[scale] || SCALES.pentatonic;
  const notes = [];
  for (let i = 0; i < count; i++) {
    const byte = parseInt(hash.substring(i * 2, i * 2 + 2), 16);
    const noteIdx = byte % scaleNotes.length;
    const octave = OCTAVES[Math.floor(byte / scaleNotes.length) % OCTAVES.length];
    notes.push(`${scaleNotes[noteIdx]}${octave}`);
  }
  return notes;
}

function txCountToTempo(txCount) {
  return Math.min(180, Math.max(80, Math.floor(txCount / 20) + 60));
}

function feesToFilterFreq(fees) {
  return Math.min(8000, Math.max(200, fees * 1500));
}

// --- WAVEFORM VISUALIZER ---
function WaveformCanvas({ analyserRef, isPlaying, color }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width = canvas.offsetWidth * 2;
    const H = canvas.height = canvas.offsetHeight * 2;

    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      ctx.fillStyle = "rgba(8, 8, 12, 0.15)";
      ctx.fillRect(0, 0, W, H);

      if (!analyserRef.current || !isPlaying) {
        // idle animation
        ctx.beginPath();
        const t = Date.now() / 1000;
        for (let x = 0; x < W; x++) {
          const y = H / 2 + Math.sin(x / 40 + t * 2) * 8 + Math.sin(x / 80 + t) * 4;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = color + "44";
        ctx.lineWidth = 2;
        ctx.stroke();
        return;
      }

      const analyser = analyserRef.current;
      const bufLen = analyser.frequencyBinCount;
      const data = new Float32Array(bufLen);
      analyser.getFloatTimeDomainData(data);

      // main wave
      ctx.beginPath();
      const sliceW = W / bufLen;
      for (let i = 0; i < bufLen; i++) {
        const y = (data[i] * 0.5 + 0.5) * H;
        i === 0 ? ctx.moveTo(i * sliceW, y) : ctx.lineTo(i * sliceW, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // mirror wave
      ctx.beginPath();
      for (let i = 0; i < bufLen; i++) {
        const y = H - (data[i] * 0.5 + 0.5) * H;
        i === 0 ? ctx.moveTo(i * sliceW, y) : ctx.lineTo(i * sliceW, y);
      }
      ctx.strokeStyle = color + "33";
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying, color]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />;
}

// --- BLOCK HISTORY DISPLAY ---
function BlockTicker({ blocks, activeIdx }) {
  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "4px 0", scrollbarWidth: "none" }}>
      {blocks.map((b, i) => (
        <div key={b.slot} style={{
          minWidth: 100, padding: "6px 8px", borderRadius: 6,
          background: i === activeIdx ? "rgba(0,255,136,0.12)" : "rgba(255,255,255,0.03)",
          border: i === activeIdx ? "1px solid #00ff88" : "1px solid rgba(255,255,255,0.06)",
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 10,
          color: i === activeIdx ? "#00ff88" : "#666", transition: "all 0.3s",
          flexShrink: 0,
        }}>
          <div style={{ fontWeight: 700, fontSize: 11 }}>#{b.slot.toLocaleString()}</div>
          <div style={{ opacity: 0.7 }}>{b.txCount} txs</div>
          <div style={{ opacity: 0.5, fontSize: 9, marginTop: 2 }}>{b.hash.slice(0, 8)}...</div>
        </div>
      ))}
    </div>
  );
}

// --- NOTE GRID VISUALIZER ---
function NoteGrid({ notes, currentNote }) {
  return (
    <div style={{ display: "flex", gap: 3, justifyContent: "center", padding: "8px 0" }}>
      {notes.map((note, i) => (
        <div key={i} style={{
          width: 36, height: 36, borderRadius: 6, display: "flex",
          alignItems: "center", justifyContent: "center",
          background: i === currentNote ? "#00ff88" : "rgba(255,255,255,0.04)",
          color: i === currentNote ? "#000" : "#555",
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700,
          border: i === currentNote ? "none" : "1px solid rgba(255,255,255,0.06)",
          transition: "all 0.15s", transform: i === currentNote ? "scale(1.15)" : "scale(1)",
          boxShadow: i === currentNote ? "0 0 20px rgba(0,255,136,0.4)" : "none",
        }}>
          {note.replace(/\d/, "")}
          <span style={{ fontSize: 7, opacity: 0.6 }}>{note.match(/\d/)?.[0]}</span>
        </div>
      ))}
    </div>
  );
}

// --- MAIN APP ---
export default function BlockBeats() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [blocks, setBlocks] = useState([]);
  const [activeBlock, setActiveBlock] = useState(null);
  const [currentNote, setCurrentNote] = useState(-1);
  const [notes, setNotes] = useState([]);
  const [scale, setScale] = useState("pentatonic");
  const [synthType, setSynthType] = useState("fm");
  const [tempo, setTempo] = useState(120);
  const [stats, setStats] = useState({ blocksPlayed: 0, totalTx: 0 });
  const [slotCounter, setSlotCounter] = useState(298_400_000);

  const synthRef = useRef(null);
  const filterRef = useRef(null);
  const reverbRef = useRef(null);
  const analyserRef = useRef(null);
  const seqRef = useRef(null);
  const intervalRef = useRef(null);
  const isPlayingRef = useRef(false);

  const accentColor = "#00ff88";

  const setupAudio = useCallback(async () => {
    await Tone.start();

    const analyser = new Tone.Analyser("waveform", 2048);
    const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.3 });
    const filter = new Tone.Filter({ frequency: 2000, type: "lowpass", rolloff: -24 });
    const delay = new Tone.FeedbackDelay({ delayTime: "8n", feedback: 0.2, wet: 0.15 });

    await reverb.generate();

    const createSynth = (type) => {
      if (type === "fm") return new Tone.FMSynth({
        modulationIndex: 8, harmonicity: 3,
        envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.8 },
        volume: -12,
      });
      if (type === "am") return new Tone.AMSynth({
        harmonicity: 2,
        envelope: { attack: 0.05, decay: 0.4, sustain: 0.2, release: 1 },
        volume: -12,
      });
      if (type === "membrane") return new Tone.MembraneSynth({
        pitchDecay: 0.05, octaves: 4, envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 },
        volume: -10,
      });
      return new Tone.Synth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.02, decay: 0.2, sustain: 0.3, release: 0.6 },
        volume: -12,
      });
    };

    const synth = createSynth(synthType);
    synth.chain(filter, delay, reverb, analyser, Tone.getDestination());

    synthRef.current = synth;
    filterRef.current = filter;
    reverbRef.current = reverb;
    analyserRef.current = analyser;

    return synth;
  }, [synthType]);

  const playBlock = useCallback((block) => {
    if (!synthRef.current) return;

    const blockNotes = hashToNotes(block.hash, scale, 8);
    const blockTempo = txCountToTempo(block.txCount);
    const filterFreq = feesToFilterFreq(block.fees);

    setNotes(blockNotes);
    setTempo(blockTempo);
    setActiveBlock(block);
    setStats(prev => ({ blocksPlayed: prev.blocksPlayed + 1, totalTx: prev.totalTx + block.txCount }));

    if (filterRef.current) {
      filterRef.current.frequency.rampTo(filterFreq, 0.5);
    }

    Tone.getTransport().bpm.rampTo(blockTempo, 0.3);

    if (seqRef.current) {
      seqRef.current.dispose();
    }

    let noteIdx = 0;
    const seq = new Tone.Sequence(
      (time, note) => {
        if (!isPlayingRef.current) return;
        try {
          synthRef.current.triggerAttackRelease(note, "16n", time);
        } catch (e) { /* gracefully ignore */ }
        const idx = noteIdx % blockNotes.length;
        Tone.getDraw().schedule(() => setCurrentNote(idx), time);
        noteIdx++;
      },
      blockNotes,
      "8n"
    );

    seq.start(0);
    seqRef.current = seq;

    if (Tone.getTransport().state !== "started") {
      Tone.getTransport().start();
    }
  }, [scale]);

  const startPlaying = useCallback(async () => {
    const synth = await setupAudio();
    if (!synth) return;

    isPlayingRef.current = true;
    setIsPlaying(true);

    const firstBlock = generateBlock(slotCounter);
    setBlocks([firstBlock]);
    playBlock(firstBlock);

    let slot = slotCounter;
    intervalRef.current = setInterval(() => {
      if (!isPlayingRef.current) return;
      slot += 1;
      setSlotCounter(slot);
      const newBlock = generateBlock(slot);
      setBlocks(prev => {
        const updated = [newBlock, ...prev].slice(0, 20);
        return updated;
      });
      playBlock(newBlock);
    }, 4000);
  }, [setupAudio, playBlock, slotCounter]);

  const stopPlaying = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);

    if (seqRef.current) { seqRef.current.dispose(); seqRef.current = null; }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }

    Tone.getTransport().stop();
    Tone.getTransport().cancel();

    if (synthRef.current) {
      synthRef.current.dispose();
      synthRef.current = null;
    }
    if (filterRef.current) { filterRef.current.dispose(); filterRef.current = null; }
    if (reverbRef.current) { reverbRef.current.dispose(); reverbRef.current = null; }

    setCurrentNote(-1);
  }, []);

  useEffect(() => {
    return () => {
      stopPlaying();
    };
  }, []);

  const handleSynthChange = (type) => {
    setSynthType(type);
    if (isPlaying) {
      stopPlaying();
      setTimeout(() => startPlaying(), 100);
    }
  };

  const label = { fontFamily: "'Space Mono', 'JetBrains Mono', monospace", fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 };
  const statVal = { fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color: "#eee" };
  const selector = (active) => ({
    padding: "5px 10px", borderRadius: 4, border: "none", cursor: "pointer",
    fontFamily: "'Space Mono', monospace", fontSize: 10, fontWeight: 600,
    background: active ? accentColor : "rgba(255,255,255,0.05)",
    color: active ? "#000" : "#777",
    transition: "all 0.2s",
  });

  return (
    <div style={{
      minHeight: "100vh", background: "#08080c", color: "#eee",
      fontFamily: "'Space Mono', 'JetBrains Mono', 'Fira Code', monospace",
      display: "flex", flexDirection: "column",
    }}>
      {/* HEADER */}
      <div style={{
        padding: "20px 24px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: isPlaying ? accentColor : "#333",
              boxShadow: isPlaying ? `0 0 12px ${accentColor}` : "none",
              transition: "all 0.3s",
            }} />
            <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase" }}>
              BLOCK<span style={{ color: accentColor }}>BEATS</span>
            </span>
          </div>
          <div style={{ fontSize: 9, color: "#444", marginTop: 4, letterSpacing: 1 }}>
            GENERATIVE MUSIC FROM SOLANA BLOCKS
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ textAlign: "right" }}>
            <div style={label}>BPM</div>
            <div style={{ ...statVal, color: accentColor, fontSize: 22 }}>{tempo}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={label}>BLOCKS</div>
            <div style={statVal}>{stats.blocksPlayed}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={label}>TOTAL TX</div>
            <div style={statVal}>{stats.totalTx.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* WAVEFORM */}
      <div style={{ height: 140, background: "rgba(0,0,0,0.3)", position: "relative" }}>
        <WaveformCanvas analyserRef={analyserRef} isPlaying={isPlaying} color={accentColor} />
        {!isPlaying && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <button onClick={startPlaying} style={{
              width: 64, height: 64, borderRadius: "50%", border: `2px solid ${accentColor}`,
              background: "rgba(0,255,136,0.08)", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", transition: "all 0.3s",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill={accentColor}>
                <polygon points="8,5 19,12 8,19" />
              </svg>
            </button>
          </div>
        )}
        {isPlaying && (
          <button onClick={stopPlaying} style={{
            position: "absolute", bottom: 8, right: 12, background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "4px 10px",
            color: "#888", fontFamily: "monospace", fontSize: 10, cursor: "pointer",
          }}>
            ■ STOP
          </button>
        )}
      </div>

      {/* NOTE SEQUENCE */}
      {notes.length > 0 && (
        <div style={{ padding: "12px 24px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ ...label, marginBottom: 8 }}>ACTIVE SEQUENCE</div>
          <NoteGrid notes={notes} currentNote={currentNote} />
        </div>
      )}

      {/* CONTROLS */}
      <div style={{
        padding: "16px 24px", display: "flex", gap: 24, flexWrap: "wrap",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
        <div>
          <div style={label}>SCALE</div>
          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
            {Object.keys(SCALES).map(s => (
              <button key={s} style={selector(scale === s)} onClick={() => setScale(s)}>
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={label}>SYNTH ENGINE</div>
          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
            {["fm", "am", "sine", "membrane"].map(s => (
              <button key={s} style={selector(synthType === s)} onClick={() => handleSynthChange(s)}>
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ACTIVE BLOCK INFO */}
      {activeBlock && (
        <div style={{
          padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}>
          <div style={label}>NOW SONIFYING</div>
          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            {[
              { label: "SLOT", value: `#${activeBlock.slot.toLocaleString()}` },
              { label: "TRANSACTIONS", value: activeBlock.txCount.toLocaleString() },
              { label: "FEES (SOL)", value: activeBlock.fees },
              { label: "PROGRAMS", value: activeBlock.programs },
              { label: "HASH", value: activeBlock.hash.slice(0, 16) + "..." },
            ].map(item => (
              <div key={item.label} style={{
                padding: "10px 12px", borderRadius: 6,
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)",
              }}>
                <div style={{ fontSize: 8, color: "#555", letterSpacing: 1.5, marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#ccc" }}>{item.value}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 9, color: "#444", lineHeight: 1.6 }}>
            HASH → NOTE SELECTION &nbsp;|&nbsp; TX COUNT → TEMPO ({tempo} BPM) &nbsp;|&nbsp; FEES → FILTER ({Math.round(feesToFilterFreq(activeBlock.fees))}Hz)
          </div>
        </div>
      )}

      {/* BLOCK TICKER */}
      {blocks.length > 0 && (
        <div style={{ padding: "12px 24px", flex: 1 }}>
          <div style={label}>BLOCK HISTORY</div>
          <div style={{ marginTop: 8 }}>
            <BlockTicker blocks={blocks} activeIdx={0} />
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div style={{
        padding: "12px 24px", borderTop: "1px solid rgba(255,255,255,0.04)",
        fontSize: 9, color: "#333", display: "flex", justifyContent: "space-between",
      }}>
        <span>BLOCKBEATS v0.1 — SIMULATED SOLANA MAINNET DATA</span>
        <span>POWERED BY TONE.JS</span>
      </div>
    </div>
  );
}
