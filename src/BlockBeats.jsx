import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";

const RPC = "/rpc";
const CHROMATIC = ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"];

const BPM = 160;
const SIG = 3;

// A natural minor — fixed forever.
// Relative minor of C major, no accidentals, the most emotionally pure minor.
const FIXED_KEY = { rootIdx: 9, root: "A" };

// Natural minor (Aeolian) scale intervals from root
const SCALE_IVS = [0, 2, 3, 5, 7, 8, 10];

// Diatonic chords — blocks pick one every ~4s for harmonic breathing
const CHORD_FUNCS = [
  { name: "i",   rootOff: 0,  tones: [0,3,7]  }, // Am — tonic, home
  { name: "VI",  rootOff: 8,  tones: [8,0,3]  }, // F  — warm, hopeful
  { name: "VII", rootOff: 10, tones: [10,2,5] }, // G  — cinematic, flowing
  { name: "iv",  rootOff: 5,  tones: [5,8,0]  }, // Dm — yearning, sorrowful
  { name: "III", rootOff: 3,  tones: [3,7,10] }, // C  — gentle, resolving
];

const INSTRUMENTS = [
  { key:"pno",  label:"PIANO",   color:"#ffe4a0", voice:1 },
  { key:"v1",   label:"STRINGS", color:"#00ff88", voice:2 },
  { key:"cel",  label:"CELLO",   color:"#00ff88", voice:3 },
  { key:"bass", label:"D.BASS",  color:"#00ff88", voice:4 },
  { key:"flt",  label:"FLUTE",   color:"#88ddff", voice:5 },
  { key:"hrn",  label:"HORN",    color:"#ffaa44", voice:6 },
];

// --- CIRCLE-OF-FIFTHS MELODIC STATE MACHINE ---
// The diatonic scale is built from stacked perfect 5ths, so walking through
// scale degrees IS navigating the circle of fifths. This function advances
// one melodic step for an instrument, choosing stepwise motion ~60% of the time,
// chord-tone leaps ~25%, and root resolution ~15%.
//
// style: "lyrical"  — piano/flute: free melody, steps + leaps, wide range
//        "inner"    — strings: stable inner harmony, mostly stepwise
//        "bass"     — bass: anchors root + 5th, rare passing tones
function nextMelodicNote(state, chordTones, minOct, maxOct, style = "lyrical") {
  const r = Math.random();
  let { d, o } = state;

  if (style === "bass") {
    if      (r < 0.45) d = 0;             // root (A)
    else if (r < 0.72) d = 4;             // 5th (E) — the bass circle-of-fifths move
    else if (r < 0.88) d = (Math.random() < 0.5 ? 2 : 6); // passing tones (C or G)
    else               d = 0;             // resolve
  } else if (style === "inner") {
    if      (r < 0.55) d += Math.random() < 0.55 ? 1 : -1;  // stepwise
    else if (r < 0.75) {
      // leap to closest chord tone
      const targets = chordTones.map(ct => SCALE_IVS.indexOf(ct)).filter(i => i >= 0);
      if (targets.length) d = targets.reduce((b,t) => Math.abs(t-d) < Math.abs(b-d) ? t : b);
    }
    else if (r < 0.9)  d += Math.random() < 0.5 ? 2 : -2;  // skip
    else               d = Math.round(d / 2);                // drift toward middle
  } else {
    // lyrical — for piano melody and flute
    if      (r < 0.40) d += Math.random() < 0.58 ? 1 : -1;  // stepwise (slightly upward biased)
    else if (r < 0.60) d += Math.random() < 0.5 ? 2 : -2;   // skip
    else if (r < 0.82) {
      // leap to nearest chord tone (harmonic grounding)
      const targets = chordTones.map(ct => SCALE_IVS.indexOf(ct)).filter(i => i >= 0);
      if (targets.length) d = targets.reduce((b,t) => Math.abs(t-d) < Math.abs(b-d) ? t : b);
    }
    else               d = 0;  // resolve to root — phrase ending
  }

  // Wrap degree across octave boundaries
  while (d < 0)  { d += 7; o--; }
  while (d >= 7) { d -= 7; o++; }

  // Clamp to instrument's register
  if (o < minOct) { o = minOct; d = 0; }
  if (o > maxOct) { o = maxOct; d = 4; }

  const semitone = SCALE_IVS[d];
  const note = `${CHROMATIC[(FIXED_KEY.rootIdx + semitone) % 12]}${o}`;
  return { d, o, note };
}

// --- SOLANA ---
async function fetchRealBlock() {
  const slotRes = await fetch(RPC, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getSlot",params:[{commitment:"finalized"}]}),
  });
  const { result: slot } = await slotRes.json();
  for (let s = slot; s >= slot - 5; s--) {
    const r = await fetch(RPC, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({jsonrpc:"2.0",id:2,method:"getBlock",params:[s,{encoding:"base64",maxSupportedTransactionVersion:0,transactionDetails:"accounts",rewards:true,commitment:"finalized"}]}),
    });
    const { result: block } = await r.json();
    if (!block) continue;
    const txCount  = block.transactions?.length ?? 0;
    const fees     = (block.transactions?.reduce((s,tx) => s+(tx.meta?.fee??0),0)??0)/1e9;
    const programs = new Set(block.transactions?.flatMap(tx=>tx.transaction?.accountKeys?.map(k=>k.pubkey)??[])??[]).size;
    return { slot:s, hash:block.blockhash, txCount, fees, programs, time:Date.now(), live:true };
  }
  return null;
}
let fakeSlot = 298_400_000;
function generateFakeBlock() {
  const chars = "0123456789abcdef";
  let hash = ""; for (let i=0;i<64;i++) hash+=chars[Math.floor(Math.random()*16)];
  return { slot:fakeSlot++, hash, txCount:Math.floor(Math.random()*2800)+200, fees:parseFloat((Math.random()*5+0.01).toFixed(4)), programs:Math.floor(Math.random()*40)+5, time:Date.now(), live:false };
}

// --- BLOCK → MUSICAL CONTEXT ---
// Extracts only what blocks should modulate: chord function, texture, filter.
// Key, mode, BPM — never touched.
function blockToContext(block) {
  const { hash, txCount, fees, programs } = block;
  const { rootIdx } = FIXED_KEY;

  const chordIdx = parseInt(hash.slice(4,6),16) % CHORD_FUNCS.length;
  const chord    = CHORD_FUNCS[chordIdx];

  // Left-hand chord voicing: root-position triad in octave 3
  const chordVoicing = chord.tones.map(t => `${CHROMATIC[(rootIdx+t)%12]}3`);

  // Piano chord density: busier blocks → chords fire more often
  const chordDensity = Math.min(1.0, Math.max(0.25, (txCount - 200) / 1800));

  const activeVoices = Math.min(6, Math.max(2,
    programs > 30 ? 6 : programs > 20 ? 5 : programs > 12 ? 4 : programs > 6 ? 3 : 2
  ));
  const filterFreq = Math.min(5500, Math.max(700, fees * 1000 + 900));

  return {
    chordTones: chord.tones,
    chordVoicing,
    hornNote:  `${CHROMATIC[(rootIdx+chord.rootOff)%12]}3`,
    hornFifth: `${CHROMATIC[(rootIdx+(chord.rootOff+7)%12)%12]}3`,
    timpani:   `${CHROMATIC[rootIdx]}1`,
    chordName: chord.name,
    chordDensity, activeVoices, filterFreq,
  };
}

function formatTime(s) { return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,"0")}`; }
function timeAgo(ms) { const s=Math.floor((Date.now()-ms)/1000); return s<60?`${s}s ago`:`${Math.floor(s/60)}m ago`; }

// --- BACKGROUND CANVAS ---
function BackgroundCanvas({ analyserRef, fftAnalyserRef, isPlaying, color }) {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const resize = () => { canvas.width=canvas.offsetWidth*devicePixelRatio; canvas.height=canvas.offsetHeight*devicePixelRatio; };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);
    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      const W=canvas.width, H=canvas.height;
      ctx.fillStyle="rgba(8,8,12,0.1)"; ctx.fillRect(0,0,W,H);
      if (!analyserRef.current || !isPlaying) {
        ctx.beginPath(); const t=Date.now()/1000;
        for (let x=0;x<W;x++) { const y=H/2+Math.sin(x/80+t*1.5)*18+Math.sin(x/160+t*0.7)*9; x===0?ctx.moveTo(x,y):ctx.lineTo(x,y); }
        ctx.strokeStyle=color+"18"; ctx.lineWidth=1.5; ctx.stroke(); return;
      }
      const wave=analyserRef.current.getValue(), n=wave.length, sw=W/n;
      ctx.beginPath();
      for (let i=0;i<n;i++) { const y=(wave[i]*0.5+0.5)*H; i===0?ctx.moveTo(i*sw,y):ctx.lineTo(i*sw,y); }
      for (let i=n-1;i>=0;i--) ctx.lineTo(i*sw,H-(wave[i]*0.5+0.5)*H);
      ctx.closePath();
      const g=ctx.createLinearGradient(0,0,0,H);
      g.addColorStop(0,color+"05"); g.addColorStop(0.5,color+"14"); g.addColorStop(1,color+"05");
      ctx.fillStyle=g; ctx.fill();
      ctx.beginPath();
      for (let i=0;i<n;i++) { const y=(wave[i]*0.5+0.5)*H; i===0?ctx.moveTo(i*sw,y):ctx.lineTo(i*sw,y); }
      ctx.strokeStyle=color+"bb"; ctx.lineWidth=1.5; ctx.shadowColor=color; ctx.shadowBlur=10; ctx.stroke(); ctx.shadowBlur=0;
      if (fftAnalyserRef.current) {
        try {
          const fft=fftAnalyserRef.current.getValue(), bw=W/fft.length;
          for (let i=0;i<fft.length;i++) {
            const norm=Math.max(0,(fft[i]+80)/80);
            ctx.fillStyle=color+Math.round(norm*0x55).toString(16).padStart(2,"0");
            ctx.fillRect(i*bw,H-norm*H*0.13,Math.max(1,bw-1),norm*H*0.13);
          }
        } catch(e){}
      }
    };
    draw();
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect(); };
  }, [isPlaying, color]);
  return <canvas ref={canvasRef} style={{position:"fixed",top:0,left:0,width:"100%",height:"100%",zIndex:0,pointerEvents:"none"}} />;
}

// --- ORCHESTRA VIZ ---
function OrchestraViz({ activeVoices, activityRef, tick }) {
  return (
    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
      {INSTRUMENTS.map(({key,label,color,voice}) => {
        const active  = activeVoices >= voice;
        const playing = (Date.now()-(activityRef.current[key]||0)) < 800;
        return (
          <div key={key} style={{padding:"6px 10px",borderRadius:5,minWidth:60,
            background:active?"rgba(0,0,0,0.25)":"rgba(255,255,255,0.01)",
            border:`1px solid ${active?color+"44":"rgba(255,255,255,0.04)"}`,
            opacity:active?1:0.3,transition:"opacity 1.5s, border 1.5s"}}>
            <div style={{fontSize:9,color:active?color:"#444",letterSpacing:1,fontFamily:"monospace",textAlign:"center"}}>{label}</div>
            <div style={{marginTop:4,height:2,background:"#1a1a1a",borderRadius:1,overflow:"hidden"}}>
              <div style={{height:"100%",background:color,borderRadius:1,
                width:playing?"100%":"0%",transition:playing?"none":"width 0.9s ease-out"}} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- BLOCK TICKER ---
function BlockTicker({ blocks, onSelect }) {
  return (
    <div style={{display:"flex",gap:6,overflowX:"auto",padding:"4px 0",scrollbarWidth:"none"}}>
      {blocks.map((b,i) => (
        <div key={b.slot} onClick={()=>onSelect(b)} style={{
          minWidth:110,padding:"6px 8px",borderRadius:6,cursor:"pointer",
          background:i===0?"rgba(255,228,160,0.08)":"rgba(255,255,255,0.03)",
          border:i===0?"1px solid rgba(255,228,160,0.35)":"1px solid rgba(255,255,255,0.06)",
          fontFamily:"monospace",fontSize:10,
          color:i===0?"#ffe4a0":"#555",transition:"all 0.2s",flexShrink:0}}>
          <div style={{fontWeight:700,fontSize:11}}>#{b.slot.toLocaleString()}</div>
          <div style={{opacity:0.7,marginTop:2}}>{b.txCount.toLocaleString()} txs</div>
          <div style={{opacity:0.4,fontSize:9,marginTop:2}}>{timeAgo(b.time)}</div>
        </div>
      ))}
    </div>
  );
}

// --- SLIDER ---
function Slider({ label, value, min, max, step, onChange, display }) {
  return (
    <div style={{minWidth:150}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
        <span style={{fontFamily:"monospace",fontSize:9,color:"#555",letterSpacing:2,textTransform:"uppercase"}}>{label}</span>
        <span style={{fontFamily:"monospace",fontSize:9,color:"#888"}}>{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e=>onChange(parseFloat(e.target.value))}
        style={{width:"100%",accentColor:"#ffe4a0",cursor:"pointer",height:3}} />
    </div>
  );
}

// --- MAIN ---
export default function BlockBeats() {
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [blocks,       setBlocks]       = useState([]);
  const [activeBlock,  setActiveBlock]  = useState(null);
  const [chordName,    setChordName]    = useState("i");
  const [activeVoices, setActiveVoices] = useState(0);
  const [volume,       setVolume]       = useState(75);
  const [reverbWet,    setReverbWet]    = useState(0.5);
  const [stats,        setStats]        = useState({blocks:0,tx:0,fees:0});
  const [rpcStatus,    setRpcStatus]    = useState("idle");
  const [error,        setError]        = useState(null);
  const [sessionTime,  setSessionTime]  = useState(0);
  const [tps,          setTps]          = useState(0);
  const [blockFlash,   setBlockFlash]   = useState(false);
  const [activityTick, setActivityTick] = useState(0);

  // synth refs
  const pnoRef  = useRef(null);
  const v1Ref   = useRef(null);
  const celRef  = useRef(null);
  const bassRef = useRef(null);
  const fltRef  = useRef(null);
  const hrnRef  = useRef(null);
  const timpRef = useRef(null);

  // per-instrument melodic state: { d: scale degree 0-6, o: octave }
  // initial positions spread through the scale for immediate harmonic richness
  const melStatesRef = useRef({
    pno:  { d: 2, o: 4 },  // piano starts on C4 (minor 3rd — emotionally weighted)
    v1:   { d: 4, o: 4 },  // strings on E4 (5th — stable)
    cel:  { d: 2, o: 3 },  // cello on C3 (inner harmony)
    bass: { d: 0, o: 2 },  // bass on A2 (root anchor)
    flt:  { d: 0, o: 5 },  // flute on A5 (high, floaty)
  });

  // current chord tones — updated per block, read by melodic callbacks
  const chordTonesRef   = useRef([0,3,7]); // Am initially
  const pnoChordRef     = useRef([]);       // left-hand voicing
  const pnoChordProbRef = useRef(0.5);      // chord fire probability

  // audio chain refs
  const analyserRef    = useRef(null);
  const fftAnalyserRef = useRef(null);
  const reverbRef      = useRef(null);
  const filterRef      = useRef(null);
  const scheduleIds    = useRef([]);
  const instrActivity  = useRef({});
  const isPlayingRef   = useRef(false);
  const intervalRef    = useRef(null);

  const ACCENT = "#ffe4a0";

  useEffect(()=>{ if(!isPlaying)return; const t=setInterval(()=>setSessionTime(s=>s+1),1000); return()=>clearInterval(t); },[isPlaying]);
  useEffect(()=>{ if(!isPlaying)return; const t=setInterval(()=>setActivityTick(n=>n+1),100); return()=>clearInterval(t); },[isPlaying]);

  // melodicPlay: advances instrument's melodic state and plays the resulting note
  function melodicPlay(key, synth, dur, time, style, minOct, maxOct) {
    if (!synth) return;
    const state = melStatesRef.current[key];
    const next  = nextMelodicNote(state, chordTonesRef.current, minOct, maxOct, style);
    melStatesRef.current[key] = { d: next.d, o: next.o };
    try { synth.triggerAttackRelease(next.note, dur, time); instrActivity.current[key] = Date.now(); } catch(e){}
  }

  const setupAudio = useCallback(async () => {
    await Tone.start();

    const reverb = new Tone.Reverb({ decay:5.0, wet:0.5, preDelay:0.025 });
    await reverb.generate();
    const filter  = new Tone.Filter({ frequency:2800, type:"lowpass", rolloff:-12 });
    const chorus  = new Tone.Chorus({ frequency:2.0, delayTime:2.8, depth:0.3, spread:180 });
    chorus.start();
    const vibrato = new Tone.Vibrato({ frequency:5.2, depth:0.04 });

    const waveAn = new Tone.Analyser("waveform", 2048);
    const fftAn  = new Tone.Analyser("fft", 64);
    // strings → vibrato → chorus → filter → reverb → analysers → out
    // piano/flute direct → filter → reverb
    chorus.connect(filter);
    vibrato.connect(chorus);
    filter.connect(reverb);
    reverb.connect(waveAn);
    waveAn.connect(fftAn);
    fftAn.connect(Tone.getDestination());
    Tone.getDestination().volume.value = -40 + (75/100)*40;

    const toStrings = s => { s.connect(vibrato); return s; };
    const toDirect  = s => { s.connect(filter);  return s; };

    // PIANO — PolySynth: handles both melody notes and left-hand chords simultaneously
    pnoRef.current = toDirect(new Tone.PolySynth(Tone.Synth, {
      oscillator: { type:"triangle" },
      envelope:   { attack:0.006, decay:0.9, sustain:0.12, release:2.5 },
      volume: -8,
    }));

    // STRINGS — fat unison, vibrato, slow attack = bowed ensemble
    v1Ref.current = toStrings(new Tone.Synth({
      oscillator: { type:"fatsawtooth", count:3, spread:20 },
      envelope:   { attack:0.22, decay:0.15, sustain:0.80, release:3.2 },
      volume: -18,
    }));

    // CELLO — darker fat oscillator, inner voice
    celRef.current = toStrings(new Tone.Synth({
      oscillator: { type:"fatsawtooth", count:2, spread:12 },
      envelope:   { attack:0.32, decay:0.20, sustain:0.78, release:3.8 },
      volume: -14,
    }));

    // BASS — triangle, warm round low end, no buzz
    bassRef.current = toStrings(new Tone.Synth({
      oscillator: { type:"triangle" },
      envelope:   { attack:0.5, decay:0.35, sustain:0.75, release:4.5 },
      volume: -10,
    }));

    // FLUTE — pure sine, ornamental
    fltRef.current = toDirect(new Tone.Synth({
      oscillator: { type:"sine" },
      envelope:   { attack:0.07, decay:0.12, sustain:0.70, release:1.2 },
      volume: -22,
    }));

    // HORN — slow swell on block arrival
    hrnRef.current = toDirect(new Tone.AMSynth({
      oscillator: { type:"triangle" },
      envelope:   { attack:0.8, decay:0.5, sustain:0.65, release:4.0 },
      modulation: { type:"sine" },
      modulationEnvelope: { attack:1.0, decay:0.4, sustain:0.5, release:3.0 },
      harmonicity: 0.5,
      volume: -17,
    }));

    // TIMPANI — block arrival accent
    timpRef.current = toDirect(new Tone.MembraneSynth({
      pitchDecay:0.05, octaves:5,
      envelope: { attack:0.001, decay:0.7, sustain:0.01, release:2.2 },
      volume: -14,
    }));

    reverbRef.current      = reverb;
    filterRef.current      = filter;
    analyserRef.current    = waveAn;
    fftAnalyserRef.current = fftAn;

    // Reset melodic states to starting positions
    melStatesRef.current = {
      pno:  { d:2, o:4 },
      v1:   { d:4, o:4 },
      cel:  { d:2, o:3 },
      bass: { d:0, o:2 },
      flt:  { d:0, o:5 },
    };

    Tone.Transport.timeSignature = SIG;
    Tone.Transport.bpm.value     = BPM;

    // Capture refs for scheduling closures
    const pno = pnoRef, v1 = v1Ref, cel = celRef, bass = bassRef, flt = fltRef;

    scheduleIds.current = [
      // PIANO right hand: melodic phrases, fires ~60% of half-bars
      // lyrical style: stepwise + chord leaps, octaves 4-5
      Tone.Transport.scheduleRepeat(t => {
        if (Math.random() > 0.6) return;
        melodicPlay("pno", pno.current, "2n", t, "lyrical", 4, 5);
      }, "2n"),

      // PIANO left hand: chord voicing on beat 1, density from block
      Tone.Transport.scheduleRepeat(t => {
        if (Math.random() > pnoChordProbRef.current) return;
        const chord = pnoChordRef.current;
        if (!chord?.length || !pno.current) return;
        try { pno.current.triggerAttackRelease(chord, "2n.", t); instrActivity.current.pno = Date.now(); } catch(e){}
      }, "1m"),

      // STRINGS: inner harmony, every 2 beats, oct 3-4
      // inner style: mostly stepwise, gravitates to chord tones
      Tone.Transport.scheduleRepeat(t => {
        melodicPlay("v1", v1.current, "2n.", t, "inner", 3, 4);
      }, "2n", "4n"),

      // CELLO: slower counter-line, every bar, oct 2-3
      Tone.Transport.scheduleRepeat(t => {
        melodicPlay("cel", cel.current, "1m", t, "inner", 2, 3);
      }, "1m", "8n"),

      // BASS: root + 5th anchoring, one note per bar, oct 1-2
      // bass style: strongly favors root and 5th — circle of fifths foundation
      Tone.Transport.scheduleRepeat(t => {
        melodicPlay("bass", bass.current, "1m.", t, "bass", 1, 2);
      }, "1m"),

      // FLUTE: sparse ornaments, lyrical leaps, high register
      Tone.Transport.scheduleRepeat(t => {
        if (Math.random() > 0.3) return;
        melodicPlay("flt", flt.current, "8n", t, "lyrical", 5, 6);
      }, "4n", "1m"),
    ];

    Tone.Transport.start();
    return true;
  }, []);

  const conductBlock = useCallback((block) => {
    const ctx = blockToContext(block);

    // Update harmony — all melodic state machines gravitate toward these tones
    chordTonesRef.current   = ctx.chordTones;
    pnoChordRef.current     = ctx.chordVoicing;
    pnoChordProbRef.current = ctx.chordDensity;

    // Smooth filter drift
    filterRef.current?.frequency.rampTo(ctx.filterFreq, 3.5);

    // Block arrival: timpani + horn swell
    try {
      if (timpRef.current) { timpRef.current.triggerAttackRelease(ctx.timpani,"4n"); instrActivity.current.timp=Date.now(); }
    } catch(e){}
    setTimeout(()=>{
      try {
        if (hrnRef.current) {
          hrnRef.current.triggerAttackRelease(ctx.hornNote,"1n"); instrActivity.current.hrn=Date.now();
          setTimeout(()=>{ try{ hrnRef.current?.triggerAttackRelease(ctx.hornFifth,"1n"); }catch(e){} },600);
        }
      } catch(e){}
    },250);

    setBlockFlash(true); setTimeout(()=>setBlockFlash(false),60);
    setChordName(ctx.chordName);
    setActiveVoices(ctx.activeVoices);
    setActiveBlock(block);
    setTps(Math.round(block.txCount/0.4));
    setStats(prev=>({blocks:prev.blocks+1,tx:prev.tx+block.txCount,fees:prev.fees+block.fees}));
  }, []);

  const stopPlaying = useCallback(()=>{
    isPlayingRef.current = false;
    setIsPlaying(false); setRpcStatus("idle");
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current=null; }
    Tone.Transport.stop(); Tone.Transport.cancel();
    [pnoRef,v1Ref,celRef,bassRef,fltRef,hrnRef,timpRef,analyserRef,fftAnalyserRef,reverbRef,filterRef].forEach(r=>{
      if(r.current){try{r.current.dispose();}catch(e){} r.current=null;}
    });
    setActiveVoices(0);
  },[]);

  const startPlaying = useCallback(async ()=>{
    try {
      await setupAudio();
      isPlayingRef.current = true;
      setIsPlaying(true); setSessionTime(0); setRpcStatus("connecting");

      let first = await fetchRealBlock().catch(()=>null);
      if (!first) { first=generateFakeBlock(); setRpcStatus("simulated"); }
      else setRpcStatus("live");

      setBlocks([first]);
      conductBlock(first);

      intervalRef.current = setInterval(async ()=>{
        if (!isPlayingRef.current) return;
        let b = await fetchRealBlock().catch(()=>null);
        if (!b) { b=generateFakeBlock(); setRpcStatus("simulated"); }
        else setRpcStatus("live");
        setBlocks(prev=>[b,...prev].slice(0,20));
        conductBlock(b);
      }, 4000);
    } catch(err) {
      console.error("[BlockBeats]",err); setError(err.message);
    }
  },[setupAudio,conductBlock]);

  useEffect(()=>{ return ()=>{ stopPlaying(); }; },[]);

  const handleShare = ()=>{
    const text = activeBlock
      ? `Solana as a waltz — A minor, chord ${chordName}, slot #${activeBlock.slot.toLocaleString()}, ${tps.toLocaleString()} TPS. Every block conducts the harmony.`
      : "Every Solana block conducts a live orchestral waltz in A minor. Generative music from the blockchain.";
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`, "_blank");
  };

  const statusBadge = {idle:null,connecting:{label:"CONNECTING",color:"#888"},live:{label:"LIVE",color:ACCENT},simulated:{label:"SIM",color:"#f0a500"}}[rpcStatus];
  const glass = {background:"rgba(8,8,12,0.78)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)"};
  const lbl   = {fontFamily:"monospace",fontSize:9,color:"#555",textTransform:"uppercase",letterSpacing:2,marginBottom:4};
  const btn   = (active)=>({padding:"5px 11px",borderRadius:4,border:"none",cursor:"pointer",fontFamily:"monospace",fontSize:10,fontWeight:600,transition:"all 0.15s",background:active?ACCENT:"rgba(255,255,255,0.05)",color:active?"#000":"#666"});

  return (
    <div style={{minHeight:"100vh",background:"#08080c",color:"#eee",fontFamily:"'Space Mono','JetBrains Mono',monospace"}}>
      <BackgroundCanvas analyserRef={analyserRef} fftAnalyserRef={fftAnalyserRef} isPlaying={isPlaying} color={ACCENT} />
      <div style={{position:"fixed",inset:0,zIndex:2,pointerEvents:"none",background:"rgba(255,228,160,0.04)",opacity:blockFlash?1:0,transition:blockFlash?"none":"opacity 1.2s ease-out"}} />

      {!isPlaying && (
        <div style={{position:"fixed",inset:0,zIndex:10,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{textAlign:"center"}}>
            <button onClick={startPlaying} style={{width:84,height:84,borderRadius:"50%",border:`2px solid ${ACCENT}`,background:"rgba(255,228,160,0.06)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",boxShadow:`0 0 50px rgba(255,228,160,0.15)`}}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill={ACCENT}><polygon points="8,5 19,12 8,19"/></svg>
            </button>
            <div style={{fontSize:22,fontWeight:800,letterSpacing:4}}>BLOCK<span style={{color:ACCENT}}>BEATS</span></div>
            <div style={{fontSize:9,color:"#444",marginTop:8,letterSpacing:2}}>A CONTINUOUS ORCHESTRAL WALTZ CONDUCTED BY SOLANA</div>
          </div>
        </div>
      )}

      <div style={{position:"relative",zIndex:3,display:"flex",flexDirection:"column",minHeight:"100vh"}}>
        <div style={{...glass,padding:"14px 24px",borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:isPlaying?ACCENT:"#333",boxShadow:isPlaying?`0 0 10px ${ACCENT}`:"none",transition:"all 0.3s"}}/>
            <span style={{fontSize:14,fontWeight:800,letterSpacing:3}}>BLOCK<span style={{color:ACCENT}}>BEATS</span></span>
            {statusBadge && <span style={{fontSize:8,padding:"2px 6px",borderRadius:3,border:`1px solid ${statusBadge.color}`,color:statusBadge.color,letterSpacing:1}}>{statusBadge.label}</span>}
            {isPlaying && <span style={{fontSize:9,color:"#444",letterSpacing:1}}>A MINOR · {chordName}</span>}
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            {isPlaying && <span style={{fontFamily:"monospace",fontSize:11,color:"#444"}}>{formatTime(sessionTime)}</span>}
            {activeBlock && <button onClick={handleShare} style={{...btn(false),color:"#888",border:"1px solid rgba(255,255,255,0.1)"}}>↗ SHARE</button>}
            {isPlaying && <button onClick={stopPlaying} style={{...btn(false),color:"#555",border:"1px solid rgba(255,255,255,0.08)"}}>■ STOP</button>}
          </div>
        </div>

        {error && <div style={{margin:"8px 24px",padding:"8px 12px",borderRadius:6,background:"rgba(255,40,40,0.1)",border:"1px solid rgba(255,40,40,0.3)",fontSize:11,color:"#ff6060"}}>ERROR: {error}</div>}

        {isPlaying && (
          <div style={{...glass,padding:"10px 24px",borderBottom:"1px solid rgba(255,255,255,0.04)",display:"flex",gap:28,flexWrap:"wrap"}}>
            {[
              {label:"KEY",     value:"A minor",   color:ACCENT},
              {label:"CHORD",   value:chordName,   color:"#aaa"},
              {label:"BPM",     value:BPM},
              {label:"VOICES",  value:`${activeVoices}/6`},
              {label:"BLOCKS",  value:stats.blocks},
              {label:"TOTAL TX",value:stats.tx.toLocaleString()},
              {label:"TPS",     value:tps.toLocaleString()},
              {label:"FEES SOL",value:stats.fees.toFixed(3)},
            ].map(s=>(
              <div key={s.label}>
                <div style={lbl}>{s.label}</div>
                <div style={{fontFamily:"monospace",fontSize:16,fontWeight:700,color:s.color||"#ddd"}}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {isPlaying && (
          <div style={{...glass,padding:"14px 24px",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
            <div style={{...lbl,marginBottom:10}}>ORCHESTRA</div>
            <OrchestraViz activeVoices={activeVoices} activityRef={instrActivity} tick={activityTick} />
          </div>
        )}

        <div style={{...glass,padding:"14px 24px",borderBottom:"1px solid rgba(255,255,255,0.04)",display:"flex",gap:20,flexWrap:"wrap",alignItems:"flex-start"}}>
          <Slider label="REVERB" value={reverbWet} min={0} max={1} step={0.01}
            onChange={v=>{ setReverbWet(v); if(reverbRef.current) reverbRef.current.wet.rampTo(v,0.2); }}
            display={`${Math.round(reverbWet*100)}%`} />
          <Slider label="VOLUME" value={volume} min={0} max={100} step={1}
            onChange={v=>{ setVolume(v); Tone.getDestination().volume.rampTo(-40+(v/100)*40,0.05); }}
            display={`${volume}%`} />
        </div>

        {activeBlock && (
          <div style={{...glass,padding:"14px 24px",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
            <div style={lbl}>CONDUCTING BLOCK</div>
            <div style={{marginTop:8,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8}}>
              {[
                {label:"SLOT",         value:`#${activeBlock.slot.toLocaleString()}`},
                {label:"TRANSACTIONS", value:activeBlock.txCount.toLocaleString()},
                {label:"FEES (SOL)",   value:activeBlock.fees.toFixed(4)},
                {label:"PROGRAMS",     value:activeBlock.programs.toLocaleString()},
                {label:"HASH",         value:activeBlock.hash.slice(0,16)+"…"},
                {label:"RECEIVED",     value:timeAgo(activeBlock.time)},
              ].map(item=>(
                <div key={item.label} style={{padding:"8px 10px",borderRadius:5,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.04)"}}>
                  <div style={{fontSize:8,color:"#444",letterSpacing:1.5,marginBottom:4}}>{item.label}</div>
                  <div style={{fontSize:12,fontWeight:600,color:"#ccc"}}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{marginTop:8,fontSize:9,color:"#2a2a2a",lineHeight:1.8}}>
              KEY: A minor (fixed) &nbsp;|&nbsp; HASH → chord {chordName} &nbsp;|&nbsp; TX COUNT → chord density &nbsp;|&nbsp; PROGRAMS → voices ({activeVoices}/6) &nbsp;|&nbsp; FEES → filter
            </div>
          </div>
        )}

        {blocks.length > 0 && (
          <div style={{...glass,padding:"12px 24px",flex:1}}>
            <div style={{...lbl,marginBottom:8}}>BLOCK HISTORY — CLICK TO RE-CONDUCT</div>
            <BlockTicker blocks={blocks} onSelect={b=>{ if(isPlaying) conductBlock(b); }} />
          </div>
        )}

        <div style={{...glass,padding:"10px 24px",borderTop:"1px solid rgba(255,255,255,0.04)",fontSize:9,color:"#222",display:"flex",justifyContent:"space-between"}}>
          <span>BLOCKBEATS v0.8 — A MINOR · CIRCLE OF FIFTHS · {BPM} BPM WALTZ</span>
          <span>POWERED BY TONE.JS</span>
        </div>
      </div>
    </div>
  );
}
