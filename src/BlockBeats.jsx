import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";

import THEMES from "./theme.js";
import { BPM, SIG, VERSION } from "./constants.js";
import { DAILY_KEY } from "./constants.js";
import { nextMelodicNote, fetchRealBlock, generateFakeBlock, blockToContext } from "./music.js";
import { formatTime, timeAgo } from "./utils.js";
import BackgroundCanvas from "./components/BackgroundCanvas.jsx";
import OrchestraViz    from "./components/OrchestraViz.jsx";
import BlockTicker     from "./components/BlockTicker.jsx";
import Slider          from "./components/Slider.jsx";
import SolanaLogo      from "./components/SolanaLogo.jsx";

export default function BlockBeats() {
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [blocks,       setBlocks]       = useState([]);
  const [activeBlock,  setActiveBlock]  = useState(null);
  const [chordName,    setChordName]    = useState("i7");
  const [activeVoices, setActiveVoices] = useState(0);
  const [volume,       setVolume]       = useState(75);
  const [reverbWet,    setReverbWet]    = useState(0.62);
  const [stats,        setStats]        = useState({ blocks:0, tx:0, fees:0 });
  const [rpcStatus,    setRpcStatus]    = useState("idle");
  const [error,        setError]        = useState(null);
  const [sessionTime,  setSessionTime]  = useState(0);
  const [tps,          setTps]          = useState(0);
  const [theme,        setTheme]        = useState("dark");

  const T      = THEMES[theme];
  const ACCENT = T.accent;

  // ── synth refs ─────────────────────────────────────────────────────────────
  const pnoMelRef = useRef(null);   // piano melody (monophonic, lead)
  const pnoRef    = useRef(null);   // piano chord pad (polyphonic, soft)
  const v1Ref     = useRef(null);   // strings (polyphonic pad)
  const celRef    = useRef(null);   // cello (countermelody)
  const bassRef   = useRef(null);   // double bass
  const fltRef    = useRef(null);   // flute
  const hrnRef    = useRef(null);   // horn
  const timpRef   = useRef(null);   // timpani
  const cltRef    = useRef(null);   // celeste (bell sparkle)

  const melStatesRef    = useRef({ pnoMel:{d:2,o:4}, cel:{d:2,o:3}, bass:{d:0,o:2}, flt:{d:0,o:5} });
  const chordTonesRef   = useRef([0,3,7,10]);
  const openChordRef    = useRef([]);         // open-voiced chord array for pno + strings
  const pnoChordProbRef = useRef(0.5);
  const phraseBarRef    = useRef(0);          // 0-3 position within 4-bar phrase

  const analyserRef     = useRef(null);
  const fftAnalyserRef  = useRef(null);
  const reverbLushRef   = useRef(null);
  const filterMainRef   = useRef(null);
  const isPlayingRef    = useRef(false);
  const intervalRef     = useRef(null);
  const instrActivity   = useRef({});

  const keyLabel = `${DAILY_KEY.root} ${DAILY_KEY.mode.toUpperCase()}`;

  useEffect(() => {
    if (!isPlaying) return;
    const t = setInterval(() => setSessionTime(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [isPlaying]);

  // Spacebar to play/stop
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        if (isPlayingRef.current) stopPlaying(); else startPlaying();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── melodic play helper ────────────────────────────────────────────────────
  function melodicPlay(key, synth, dur, time, style, minOct, maxOct) {
    if (!synth) return;
    const next = nextMelodicNote(
      melStatesRef.current[key],
      chordTonesRef.current,
      minOct, maxOct, style,
      phraseBarRef.current
    );
    melStatesRef.current[key] = { d: next.d, o: next.o };
    try {
      synth.triggerAttackRelease(next.note, dur, time);
      instrActivity.current[key] = Date.now();
    } catch (e) {}

    // celeste sparkle: when piano melody hits oct 5+, add a bell shimmer 2 octaves up
    if (key === "pnoMel" && next.o >= 5 && Math.random() < 0.38 && cltRef.current) {
      const sparkleNote = next.note.replace(/(\d+)$/, n => String(parseInt(n) + 2));
      try {
        cltRef.current.triggerAttackRelease(sparkleNote, "8n", time + 0.05);
        instrActivity.current.clt = Date.now();
      } catch (e) {}
    }
  }

  // ── audio setup ───────────────────────────────────────────────────────────
  const setupAudio = useCallback(async () => {
    await Tone.start();

    // ── effects ─────────────────────────────────────────────────────────────
    const reverbLush  = new Tone.Reverb({ decay:8.0, wet:0.62, preDelay:0.04 });
    const reverbShort = new Tone.Reverb({ decay:2.5, wet:0.25, preDelay:0.01 });
    await Promise.all([reverbLush.generate(), reverbShort.generate()]);

    const pingPong   = new Tone.PingPongDelay("8n", 0.18);  pingPong.wet.value = 0.16;
    const filterMain = new Tone.Filter({ frequency:3200, type:"lowpass", rolloff:-12 });
    const filterBass = new Tone.Filter({ frequency:380,  type:"lowpass", rolloff:-24 });
    const chorus     = new Tone.Chorus({ frequency:1.2, delayTime:3.5, depth:0.22, spread:180 });
    chorus.start();
    const vibrato    = new Tone.Vibrato({ frequency:4.5, depth:0.03 });

    const waveAn = new Tone.Analyser("waveform", 2048);
    const fftAn  = new Tone.Analyser("fft", 64);

    // ── routing ─────────────────────────────────────────────────────────────
    //   filterMain → reverbLush → waveAn → fftAn → dest
    filterMain.connect(reverbLush);
    reverbLush.connect(waveAn);
    waveAn.connect(fftAn);
    fftAn.connect(Tone.getDestination());
    //   reverbShort → dest (separate path for bass/timp)
    reverbShort.connect(Tone.getDestination());

    Tone.getDestination().volume.value = -40 + (volume / 100) * 40;

    // ── synths ──────────────────────────────────────────────────────────────
    // Piano melody — lead, triangle, ping-pong shimmer
    pnoMelRef.current = new Tone.Synth({
      oscillator: { type:"triangle" },
      envelope:   { attack:0.008, decay:0.7, sustain:0.18, release:3.2 },
      volume: -5,
    });
    pnoMelRef.current.connect(pingPong);
    pingPong.connect(filterMain);

    // Piano chords — soft sine pad
    pnoRef.current = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type:"sine" },
      envelope:   { attack:0.08, decay:1.4, sustain:0.06, release:4.5 },
      volume: -16,
    });
    pnoRef.current.connect(filterMain);

    // Strings — warm polyphonic pad (chord wash, not melody)
    v1Ref.current = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type:"fatsawtooth", count:3, spread:18 },
      envelope:   { attack:0.45, decay:0.1, sustain:0.92, release:5.5 },
      volume: -18,
    });
    v1Ref.current.connect(vibrato);
    vibrato.connect(filterMain);

    // Cello — melodic countermelody
    celRef.current = new Tone.Synth({
      oscillator: { type:"fatsawtooth", count:2, spread:10 },
      envelope:   { attack:0.35, decay:0.15, sustain:0.84, release:5.0 },
      volume: -13,
    });
    celRef.current.connect(filterMain);

    // Double bass — clean tonal foundation, dedicated lowpass
    bassRef.current = new Tone.Synth({
      oscillator: { type:"triangle" },
      envelope:   { attack:0.08, decay:0.4, sustain:0.80, release:5.5 },
      volume: -9,
    });
    bassRef.current.connect(filterBass);
    filterBass.connect(reverbShort);

    // Flute — bright runs
    fltRef.current = new Tone.Synth({
      oscillator: { type:"sine" },
      envelope:   { attack:0.04, decay:0.08, sustain:0.75, release:2.0 },
      volume: -17,
    });
    fltRef.current.connect(chorus);
    chorus.connect(filterMain);

    // Horn — AMSynth swell
    hrnRef.current = new Tone.AMSynth({
      oscillator:           { type:"triangle" },
      envelope:             { attack:1.2, decay:0.6, sustain:0.70, release:5.5 },
      modulation:           { type:"sine" },
      modulationEnvelope:   { attack:1.5, decay:0.5, sustain:0.5, release:4.0 },
      harmonicity: 0.75,
      volume: -15,
    });
    hrnRef.current.connect(filterMain);

    // Timpani — percussive block marker
    timpRef.current = new Tone.MembraneSynth({
      pitchDecay: 0.08, octaves: 5,
      envelope:   { attack:0.001, decay:0.7, sustain:0.01, release:2.2 },
      volume: -14,
    });
    timpRef.current.connect(reverbShort);

    // Celeste — bell sparkle (bypass filter for bright shimmer)
    cltRef.current = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type:"sine" },
      envelope:   { attack:0.001, decay:1.1, sustain:0.0, release:2.8 },
      volume: -22,
    });
    cltRef.current.connect(reverbLush);

    reverbLushRef.current  = reverbLush;
    filterMainRef.current  = filterMain;
    analyserRef.current    = waveAn;
    fftAnalyserRef.current = fftAn;

    melStatesRef.current = { pnoMel:{d:2,o:4}, cel:{d:2,o:3}, bass:{d:0,o:2}, flt:{d:0,o:5} };
    phraseBarRef.current = 0;

    Tone.Transport.timeSignature = SIG;
    Tone.Transport.bpm.value     = BPM;

    // ── scheduling ──────────────────────────────────────────────────────────

    // Phrase bar counter (0-3): advances every measure
    Tone.Transport.scheduleRepeat(() => {
      phraseBarRef.current = (phraseBarRef.current + 1) % 4;
    }, "1m");

    // Piano melody — shaped by phrase position (rise → peak → taper → breathe)
    Tone.Transport.scheduleRepeat(t => {
      const prob = [0.65, 0.82, 0.50, 0.12][phraseBarRef.current];
      if (Math.random() > prob) return;
      melodicPlay("pnoMel", pnoMelRef.current, "4n.", t, "lyrical", 4, 5);
    }, "4n");

    // Piano chord pad — every 2 bars, offset by 1 bar (dialogue with strings)
    Tone.Transport.scheduleRepeat(t => {
      if (Math.random() > pnoChordProbRef.current) return;
      if (!pnoRef.current || !openChordRef.current?.length) return;
      try { pnoRef.current.triggerAttackRelease(openChordRef.current, "2m", t); instrActivity.current.pno = Date.now(); } catch(e) {}
    }, "2m", "1m");

    // Strings pad — every 2 bars, long duration overlaps into next phrase (legato wash)
    Tone.Transport.scheduleRepeat(t => {
      if (Math.random() > 0.85 || !v1Ref.current || !openChordRef.current?.length) return;
      try { v1Ref.current.triggerAttackRelease(openChordRef.current, "2m.", t); instrActivity.current.v1 = Date.now(); } catch(e) {}
    }, "2m");

    // Cello — countermelody on bar 2 of each 2-bar group (dialogue with strings)
    Tone.Transport.scheduleRepeat(t => {
      melodicPlay("cel", celRef.current, "1m", t, "inner", 2, 3);
    }, "2m", "1m");

    // Bass — every measure, grounding tonal center
    Tone.Transport.scheduleRepeat(t => {
      melodicPlay("bass", bassRef.current, "1m.", t, "bass", 1, 2);
    }, "1m");

    // Flute — phrase bars 0-1: active (55%), bars 2-3: sparse (15%)
    Tone.Transport.scheduleRepeat(t => {
      const prob = phraseBarRef.current <= 1 ? 0.55 : 0.15;
      if (Math.random() > prob) return;
      melodicPlay("flt", fltRef.current, "4n", t, "lyrical", 5, 6);
    }, "2n", "2n");

    Tone.Transport.start();
  }, [volume]);

  // ── conduct block ─────────────────────────────────────────────────────────
  const conductBlock = useCallback((block) => {
    const ctx = blockToContext(block);
    chordTonesRef.current   = ctx.chordTones;
    openChordRef.current    = ctx.chordVoicing;
    pnoChordProbRef.current = ctx.chordDensity;
    filterMainRef.current?.frequency.rampTo(ctx.filterFreq, 1.2);

    // Timpani always marks new block
    try { if (timpRef.current) { timpRef.current.triggerAttackRelease(ctx.timpani, "4n"); instrActivity.current.timp = Date.now(); } } catch(e) {}

    // Horn swell: only on high-fee blocks or the very first block
    if (ctx.fees > 0.8 || stats.blocks === 0) {
      setTimeout(() => {
        try {
          if (hrnRef.current) {
            hrnRef.current.triggerAttackRelease(ctx.hornNote, "2n"); instrActivity.current.hrn = Date.now();
            setTimeout(() => { try { hrnRef.current?.triggerAttackRelease(ctx.hornFifth, "2n"); } catch(e) {} }, 1400);
          }
        } catch(e) {}
      }, 300);
    }

    setChordName(ctx.chordName);
    setActiveVoices(ctx.activeVoices);
    setActiveBlock(block);
    setTps(Math.round(block.txCount / 0.4));
    setStats(prev => ({ blocks: prev.blocks + 1, tx: prev.tx + block.txCount, fees: prev.fees + block.fees }));
  }, [stats.blocks]);

  // ── stop / start ──────────────────────────────────────────────────────────
  const stopPlaying = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false); setRpcStatus("idle");
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    Tone.Transport.stop(); Tone.Transport.cancel();
    [pnoMelRef, pnoRef, v1Ref, celRef, bassRef, fltRef, hrnRef, timpRef, cltRef,
     analyserRef, fftAnalyserRef, reverbLushRef, filterMainRef].forEach(r => {
      if (r.current) { try { r.current.dispose(); } catch(e) {} r.current = null; }
    });
    setActiveVoices(0);
  }, []);

  const startPlaying = useCallback(async () => {
    try {
      await setupAudio();
      isPlayingRef.current = true;
      setIsPlaying(true); setSessionTime(0); setRpcStatus("connecting");
      let first = await fetchRealBlock().catch(() => null);
      if (!first) { first = generateFakeBlock(); setRpcStatus("simulated"); } else setRpcStatus("live");
      setBlocks([first]); conductBlock(first);
      intervalRef.current = setInterval(async () => {
        if (!isPlayingRef.current) return;
        let b = await fetchRealBlock().catch(() => null);
        if (!b) { b = generateFakeBlock(); setRpcStatus("simulated"); } else setRpcStatus("live");
        setBlocks(prev => [b, ...prev].slice(0, 20));
        conductBlock(b);
      }, 4000);
    } catch (err) { console.error("[BlockBeats]", err); setError(err.message); }
  }, [setupAudio, conductBlock]);

  useEffect(() => { return () => { stopPlaying(); }; }, []);

  const handleShare = () => {
    const text = activeBlock
      ? `Solana as an anime OST — ${keyLabel}, chord ${chordName}, slot #${activeBlock.slot.toLocaleString()}, ${tps.toLocaleString()} TPS. Every block conducts the harmony.`
      : `Every Solana block conducts a live orchestral anime OST in ${keyLabel}. Generative music from the blockchain.`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`, "_blank");
  };

  const statusBadge = { idle:null, connecting:{label:"CONNECTING",color:"#888"}, live:{label:"LIVE",color:"#14F195"}, simulated:{label:"SIM",color:"#f0a500"} }[rpcStatus];
  const glass = { background:T.glass, backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)" };
  const lbl   = { fontFamily:"monospace", fontSize:9, color:T.muted3, textTransform:"uppercase", letterSpacing:2, marginBottom:4 };
  const btn   = (active) => ({ padding:"5px 11px", borderRadius:4, border:"none", cursor:"pointer", fontFamily:"monospace", fontSize:10, fontWeight:600, transition:"all 0.15s", background: active ? ACCENT : T.btnBg, color: active ? "#000" : T.muted2 });
  const link  = { color:T.muted5, textDecoration:"none", letterSpacing:1, fontSize:9 };

  return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.text, fontFamily:"'Space Mono','JetBrains Mono',monospace" }}>
      <BackgroundCanvas analyserRef={analyserRef} fftAnalyserRef={fftAnalyserRef} isPlaying={isPlaying} color={ACCENT} T={T} />

      {/* SPLASH */}
      {!isPlaying && (
        <div style={{ position:"fixed", inset:0, zIndex:10, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ textAlign:"center" }}>
            <button onClick={startPlaying} style={{ width:84, height:84, borderRadius:"50%", border:`2px solid ${ACCENT}`, background:"rgba(255,228,160,0.06)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px", boxShadow:`0 0 50px rgba(255,228,160,0.15)` }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill={ACCENT}><polygon points="8,5 19,12 8,19"/></svg>
            </button>
            <div style={{ fontSize:22, fontWeight:800, letterSpacing:4 }}>BLOCK<span style={{ color:ACCENT }}>BEATS</span></div>
            <div style={{ fontSize:9, color:T.muted3, marginTop:6, letterSpacing:2 }}>TODAY'S KEY: <span style={{ color:ACCENT }}>{keyLabel}</span></div>
            <div style={{ fontSize:9, color:T.muted4, marginTop:4, letterSpacing:2 }}>A LIVE ORCHESTRAL ANIME OST CONDUCTED BY SOLANA</div>
            <div style={{ fontSize:8, color:T.muted5, marginTop:6, letterSpacing:1 }}>PRESS SPACE OR CLICK TO BEGIN</div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:5, marginTop:16, opacity:0.45 }}>
              <SolanaLogo size={11} />
              <span style={{ fontSize:8, letterSpacing:2, color:T.muted4 }}>POWERED BY SOLANA</span>
            </div>
          </div>
        </div>
      )}

      <div style={{ position:"relative", zIndex:3, display:"flex", flexDirection:"column", minHeight:"100vh" }}>

        {/* HEADER */}
        <div style={{ ...glass, padding:"14px 24px", borderBottom:`1px solid ${T.sectionBorder}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background: isPlaying ? ACCENT : T.dotOff, boxShadow: isPlaying ? `0 0 10px ${ACCENT}` : "none", transition:"all 0.3s" }}/>
            <span style={{ fontSize:14, fontWeight:800, letterSpacing:3 }}>BLOCK<span style={{ color:ACCENT }}>BEATS</span></span>
            <span style={{ fontSize:8, color:T.muted4, letterSpacing:1, border:`1px solid ${T.divider}`, padding:"1px 5px", borderRadius:3 }}>{VERSION}</span>
            {statusBadge && (
              <span style={{ fontSize:8, padding:"2px 6px", borderRadius:3, border:`1px solid ${statusBadge.color}`, color:statusBadge.color, letterSpacing:1, display:"flex", alignItems:"center", gap:4 }}>
                {statusBadge.label === "LIVE" && <SolanaLogo size={9} />}
                {statusBadge.label}
              </span>
            )}
            {isPlaying && <span style={{ fontSize:9, color:T.muted4, letterSpacing:1 }}>{keyLabel} · {chordName}</span>}
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            {isPlaying && <span style={{ fontFamily:"monospace", fontSize:11, color:T.muted4 }}>{formatTime(sessionTime)}</span>}
            {activeBlock && <button onClick={handleShare} style={{ ...btn(false), color:T.muted1, border:`1px solid ${T.shareBtnBorder}` }}>↗ SHARE</button>}
            {isPlaying && <button onClick={stopPlaying} style={{ ...btn(false), color:T.muted3, border:`1px solid ${T.stopBtnBorder}` }}>■ STOP</button>}
            <button onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} style={{ ...btn(false), border:`1px solid ${T.stopBtnBorder}`, fontSize:12, padding:"4px 9px" }} title="Toggle theme">
              {theme === "dark" ? "☀" : "☽"}
            </button>
          </div>
        </div>

        {error && <div style={{ margin:"8px 24px", padding:"8px 12px", borderRadius:6, background:T.errBg, border:`1px solid ${T.errBorder}`, fontSize:11, color:T.errText }}>ERROR: {error}</div>}

        {/* STATS */}
        {isPlaying && (
          <div style={{ ...glass, padding:"10px 24px", borderBottom:`1px solid ${T.divider}`, display:"flex", gap:28, flexWrap:"wrap" }}>
            {[
              { label:"KEY",      value:keyLabel,               color:ACCENT  },
              { label:"CHORD",    value:chordName,              color:T.muted1 },
              { label:"BPM",      value:BPM                                   },
              { label:"VOICES",   value:`${activeVoices}/6`                   },
              { label:"BLOCKS",   value:stats.blocks                          },
              { label:"TOTAL TX", value:stats.tx.toLocaleString()             },
              { label:"TPS",      value:tps.toLocaleString()                  },
              { label:"FEES SOL", value:stats.fees.toFixed(3)                 },
            ].map(s => (
              <div key={s.label}>
                <div style={lbl}>{s.label}</div>
                <div style={{ fontFamily:"monospace", fontSize:16, fontWeight:700, color: s.color || T.val }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* ORCHESTRA */}
        {isPlaying && (
          <div style={{ ...glass, padding:"14px 24px", borderBottom:`1px solid ${T.divider}` }}>
            <div style={{ ...lbl, marginBottom:10 }}>ORCHESTRA</div>
            <OrchestraViz activeVoices={activeVoices} activityRef={instrActivity} tick={0} T={T} />
          </div>
        )}

        {/* CONTROLS */}
        <div style={{ ...glass, padding:"14px 24px", borderBottom:`1px solid ${T.divider}`, display:"flex", gap:20, flexWrap:"wrap", alignItems:"flex-start" }}>
          <Slider label="REVERB" value={reverbWet} min={0} max={1} step={0.01}
            onChange={v => { setReverbWet(v); if (reverbLushRef.current) reverbLushRef.current.wet.rampTo(v, 0.2); }}
            display={`${Math.round(reverbWet * 100)}%`} T={T} />
          <Slider label="VOLUME" value={volume} min={0} max={100} step={1}
            onChange={v => { setVolume(v); Tone.getDestination().volume.rampTo(-40 + (v / 100) * 40, 0.05); }}
            display={`${volume}%`} T={T} />
        </div>

        {/* CURRENT BLOCK — slim strip */}
        {activeBlock && (
          <div style={{ ...glass, padding:"10px 24px", borderBottom:`1px solid ${T.divider}` }}>
            <div style={{ display:"flex", alignItems:"baseline", gap:16, flexWrap:"wrap" }}>
              <span style={{ fontFamily:"monospace", fontSize:9, color:T.muted3, letterSpacing:2 }}>BLOCK</span>
              <span style={{ fontFamily:"monospace", fontSize:14, fontWeight:700, color:T.val }}>#{activeBlock.slot.toLocaleString()}</span>
              <span style={{ fontFamily:"monospace", fontSize:11, color:T.muted2 }}>{activeBlock.txCount.toLocaleString()} TXS</span>
              <span style={{ fontFamily:"monospace", fontSize:11, color:T.muted2 }}>{activeBlock.fees.toFixed(4)} SOL</span>
              <span style={{ fontFamily:"monospace", fontSize:11, color:T.muted2 }}>{activeBlock.programs} PROGRAMS</span>
              <span style={{ fontFamily:"monospace", fontSize:9, color:T.muted4 }}>{activeBlock.hash.slice(0,14)}…</span>
              <span style={{ fontFamily:"monospace", fontSize:9, color:T.muted4 }}>{timeAgo(activeBlock.time)}</span>
            </div>
            <div style={{ marginTop:5, fontSize:8, color:T.footnote, letterSpacing:0.5 }}>
              HASH → chord {chordName} &nbsp;·&nbsp; TX COUNT → density &nbsp;·&nbsp; FEES → filter &amp; horn &nbsp;·&nbsp; PROGRAMS → voices ({activeVoices}/6)
            </div>
          </div>
        )}

        {/* BLOCK HISTORY */}
        {blocks.length > 0 && (
          <div style={{ ...glass, padding:"16px 24px 20px", flex:1 }}>
            <div style={{ ...lbl, marginBottom:12 }}>BLOCK HISTORY — TX COUNT</div>
            <BlockTicker blocks={blocks} T={T} accent={ACCENT} />
          </div>
        )}

        {/* FOOTER */}
        <div style={{ ...glass, padding:"10px 24px", borderTop:`1px solid ${T.divider}`, fontSize:9, color:T.muted5, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
          <span>BLOCKBEATS {VERSION} · {keyLabel} · CIRCLE OF FIFTHS · {BPM} BPM ANIME OST</span>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <a href="https://github.com/thesaintbobo/blockbeats" target="_blank" rel="noopener noreferrer" style={link}
               onMouseOver={e=>e.target.style.color=ACCENT} onMouseOut={e=>e.target.style.color=T.muted5}>GITHUB</a>
            <span style={{ color:T.muted6 }}>·</span>
            <a href="https://tonejs.github.io" target="_blank" rel="noopener noreferrer" style={link}
               onMouseOver={e=>e.target.style.color=ACCENT} onMouseOut={e=>e.target.style.color=T.muted5}>TONE.JS</a>
            <span style={{ color:T.muted6 }}>·</span>
            <div style={{ display:"flex", alignItems:"center", gap:4 }}>
              <SolanaLogo size={11} />
              <a href="https://solana.com" target="_blank" rel="noopener noreferrer" style={link}
                 onMouseOver={e=>e.target.style.color="#14F195"} onMouseOut={e=>e.target.style.color=T.muted5}>SOLANA</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
