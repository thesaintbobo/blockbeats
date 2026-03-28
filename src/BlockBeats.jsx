import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";

import THEMES from "./theme.js";
import { BPM, SIG, VERSION, DAILY_KEY } from "./constants.js";
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
  const [chordName,    setChordName]    = useState("i");
  const [activeVoices, setActiveVoices] = useState(0);
  const [volume,       setVolume]       = useState(75);
  const [reverbWet,    setReverbWet]    = useState(0.5);
  const [stats,        setStats]        = useState({ blocks:0, tx:0, fees:0 });
  const [rpcStatus,    setRpcStatus]    = useState("idle");
  const [error,        setError]        = useState(null);
  const [sessionTime,  setSessionTime]  = useState(0);
  const [tps,          setTps]          = useState(0);
  const [activityTick, setActivityTick] = useState(0);
  const [theme,        setTheme]        = useState("dark");

  const T      = THEMES[theme];
  const ACCENT = T.accent;

  // synth refs
  const pnoRef  = useRef(null);
  const v1Ref   = useRef(null);
  const celRef  = useRef(null);
  const bassRef = useRef(null);
  const fltRef  = useRef(null);
  const hrnRef  = useRef(null);
  const timpRef = useRef(null);

  const melStatesRef    = useRef({ pno:{d:2,o:4}, v1:{d:4,o:4}, cel:{d:2,o:3}, bass:{d:0,o:2}, flt:{d:0,o:5} });
  const chordTonesRef   = useRef([0,3,7]);
  const pnoChordRef     = useRef([]);
  const pnoChordProbRef = useRef(0.5);
  const analyserRef     = useRef(null);
  const fftAnalyserRef  = useRef(null);
  const reverbRef       = useRef(null);
  const filterRef       = useRef(null);
  const instrActivity   = useRef({});
  const isPlayingRef    = useRef(false);
  const intervalRef     = useRef(null);

  const keyLabel = `${DAILY_KEY.root} ${DAILY_KEY.mode.toUpperCase()}`;

  useEffect(() => {
    if (!isPlaying) return;
    const t = setInterval(() => setSessionTime(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;
    const t = setInterval(() => setActivityTick(n => n + 1), 100);
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

  function melodicPlay(key, synth, dur, time, style, minOct, maxOct) {
    if (!synth) return;
    const next = nextMelodicNote(melStatesRef.current[key], chordTonesRef.current, minOct, maxOct, style);
    melStatesRef.current[key] = { d: next.d, o: next.o };
    try { synth.triggerAttackRelease(next.note, dur, time); instrActivity.current[key] = Date.now(); } catch (e) {}
  }

  const setupAudio = useCallback(async () => {
    await Tone.start();
    const reverb  = new Tone.Reverb({ decay:5.0, wet:0.5, preDelay:0.025 });
    await reverb.generate();
    const filter  = new Tone.Filter({ frequency:2800, type:"lowpass", rolloff:-12 });
    const chorus  = new Tone.Chorus({ frequency:2.0, delayTime:2.8, depth:0.3, spread:180 });
    chorus.start();
    const vibrato = new Tone.Vibrato({ frequency:5.2, depth:0.04 });
    const waveAn  = new Tone.Analyser("waveform", 2048);
    const fftAn   = new Tone.Analyser("fft", 64);

    chorus.connect(filter); vibrato.connect(chorus); filter.connect(reverb);
    reverb.connect(waveAn); waveAn.connect(fftAn); fftAn.connect(Tone.getDestination());
    Tone.getDestination().volume.value = -40 + (75 / 100) * 40;

    const toStrings = s => { s.connect(vibrato); return s; };
    const toDirect  = s => { s.connect(filter);  return s; };

    pnoRef.current  = toDirect(new Tone.PolySynth(Tone.Synth, { oscillator:{type:"triangle"}, envelope:{attack:0.006,decay:0.9,sustain:0.12,release:2.5}, volume:-8 }));
    v1Ref.current   = toStrings(new Tone.Synth({ oscillator:{type:"fatsawtooth",count:3,spread:20}, envelope:{attack:0.22,decay:0.15,sustain:0.80,release:3.2}, volume:-18 }));
    celRef.current  = toStrings(new Tone.Synth({ oscillator:{type:"fatsawtooth",count:2,spread:12}, envelope:{attack:0.32,decay:0.20,sustain:0.78,release:3.8}, volume:-14 }));
    bassRef.current = toStrings(new Tone.Synth({ oscillator:{type:"triangle"}, envelope:{attack:0.5,decay:0.35,sustain:0.75,release:4.5}, volume:-10 }));
    fltRef.current  = toDirect(new Tone.Synth({ oscillator:{type:"sine"}, envelope:{attack:0.07,decay:0.12,sustain:0.70,release:1.2}, volume:-22 }));
    hrnRef.current  = toDirect(new Tone.AMSynth({ oscillator:{type:"triangle"}, envelope:{attack:0.8,decay:0.5,sustain:0.65,release:4.0}, modulation:{type:"sine"}, modulationEnvelope:{attack:1.0,decay:0.4,sustain:0.5,release:3.0}, harmonicity:0.5, volume:-17 }));
    timpRef.current = toDirect(new Tone.MembraneSynth({ pitchDecay:0.05, octaves:5, envelope:{attack:0.001,decay:0.7,sustain:0.01,release:2.2}, volume:-14 }));

    reverbRef.current = reverb; filterRef.current = filter;
    analyserRef.current = waveAn; fftAnalyserRef.current = fftAn;
    melStatesRef.current = { pno:{d:2,o:4}, v1:{d:4,o:4}, cel:{d:2,o:3}, bass:{d:0,o:2}, flt:{d:0,o:5} };

    Tone.Transport.timeSignature = SIG;
    Tone.Transport.bpm.value     = BPM;

    const pno = pnoRef, v1 = v1Ref, cel = celRef, bass = bassRef, flt = fltRef;
    Tone.Transport.scheduleRepeat(t => { if (Math.random() > 0.6) return; melodicPlay("pno", pno.current, "2n", t, "lyrical", 4, 5); }, "2n");
    Tone.Transport.scheduleRepeat(t => { if (Math.random() > pnoChordProbRef.current) return; const chord = pnoChordRef.current; if (!chord?.length || !pno.current) return; try { pno.current.triggerAttackRelease(chord, "2n.", t); instrActivity.current.pno = Date.now(); } catch (e) {} }, "1m");
    Tone.Transport.scheduleRepeat(t => { melodicPlay("v1",   v1.current,   "2n.",  t, "inner",   3, 4); }, "2n", "4n");
    Tone.Transport.scheduleRepeat(t => { melodicPlay("cel",  cel.current,  "1m",   t, "inner",   2, 3); }, "1m", "8n");
    Tone.Transport.scheduleRepeat(t => { melodicPlay("bass", bass.current, "1m.",  t, "bass",    1, 2); }, "1m");
    Tone.Transport.scheduleRepeat(t => { if (Math.random() > 0.3) return; melodicPlay("flt", flt.current, "8n", t, "lyrical", 5, 6); }, "4n", "1m");
    Tone.Transport.start();
  }, []);

  const conductBlock = useCallback((block) => {
    const ctx = blockToContext(block);
    chordTonesRef.current   = ctx.chordTones;
    pnoChordRef.current     = ctx.chordVoicing;
    pnoChordProbRef.current = ctx.chordDensity;
    filterRef.current?.frequency.rampTo(ctx.filterFreq, 3.5);
    try { if (timpRef.current) { timpRef.current.triggerAttackRelease(ctx.timpani, "4n"); instrActivity.current.timp = Date.now(); } } catch (e) {}
    setTimeout(() => {
      try {
        if (hrnRef.current) {
          hrnRef.current.triggerAttackRelease(ctx.hornNote, "1n"); instrActivity.current.hrn = Date.now();
          setTimeout(() => { try { hrnRef.current?.triggerAttackRelease(ctx.hornFifth, "1n"); } catch (e) {} }, 600);
        }
      } catch (e) {}
    }, 250);
setChordName(ctx.chordName);
    setActiveVoices(ctx.activeVoices);
    setActiveBlock(block);
    setTps(Math.round(block.txCount / 0.4));
    setStats(prev => ({ blocks: prev.blocks + 1, tx: prev.tx + block.txCount, fees: prev.fees + block.fees }));
  }, []);

  const stopPlaying = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false); setRpcStatus("idle");
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    Tone.Transport.stop(); Tone.Transport.cancel();
    [pnoRef, v1Ref, celRef, bassRef, fltRef, hrnRef, timpRef, analyserRef, fftAnalyserRef, reverbRef, filterRef].forEach(r => {
      if (r.current) { try { r.current.dispose(); } catch (e) {} r.current = null; }
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
      ? `Solana as a waltz — ${keyLabel}, chord ${chordName}, slot #${activeBlock.slot.toLocaleString()}, ${tps.toLocaleString()} TPS. Every block conducts the harmony.`
      : `Every Solana block conducts a live orchestral waltz in ${keyLabel}. Generative music from the blockchain.`;
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
            <div style={{ fontSize:9, color:T.muted4, marginTop:4, letterSpacing:2 }}>A CONTINUOUS ORCHESTRAL WALTZ CONDUCTED BY SOLANA</div>
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
            <OrchestraViz activeVoices={activeVoices} activityRef={instrActivity} tick={activityTick} T={T} />
          </div>
        )}

        {/* CONTROLS */}
        <div style={{ ...glass, padding:"14px 24px", borderBottom:`1px solid ${T.divider}`, display:"flex", gap:20, flexWrap:"wrap", alignItems:"flex-start" }}>
          <Slider label="REVERB" value={reverbWet} min={0} max={1} step={0.01}
            onChange={v => { setReverbWet(v); if (reverbRef.current) reverbRef.current.wet.rampTo(v, 0.2); }}
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
              HASH → chord {chordName} &nbsp;·&nbsp; TX COUNT → density &nbsp;·&nbsp; FEES → filter &nbsp;·&nbsp; PROGRAMS → voices ({activeVoices}/6)
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
          <span>BLOCKBEATS {VERSION} · {keyLabel} · CIRCLE OF FIFTHS · {BPM} BPM WALTZ</span>
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
