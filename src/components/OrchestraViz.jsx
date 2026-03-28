const ANIM = `
  @keyframes bow-stroke { 0%,100%{transform:rotate(-20deg)} 50%{transform:rotate(20deg)} }
  @keyframes key-tap-l  { 0%,100%{transform:translateY(0)}  50%{transform:translateY(5px)} }
  @keyframes key-tap-r  { 0%,100%{transform:translateY(0)}  50%{transform:translateY(5px)} }
  @keyframes flute-sway { 0%,100%{transform:rotate(-3deg)}  50%{transform:rotate(3deg)}  }
  @keyframes horn-bell  { 0%,100%{transform:scale(1)}       50%{transform:scale(1.08)}   }
`;

// All figurines share viewBox="0 0 90 100" so they align on a common baseline.
const H = ({ cx, cy, r = 8, c }) =>
  <circle cx={cx} cy={cy} r={r} stroke={c} strokeWidth="1.5" fill="none"/>;
const L = ({ x1, y1, x2, y2, c, w = 1.5, op = 1 }) =>
  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={w} opacity={op}/>;

// ── PIANO ─────────────────────────────────────────────────────────────────────
// Seated player; keyboard at waist height so figure is full-sized.
function Piano({ active, playing, color }) {
  const c = active ? color : "#2a2a2a";
  const lA = playing ? { animation:"key-tap-l 0.45s ease-in-out infinite",       transformOrigin:"26px 42px" } : {};
  const rA = playing ? { animation:"key-tap-r 0.45s ease-in-out infinite 0.23s", transformOrigin:"64px 42px" } : {};
  return (
    <svg width="90" height="100" viewBox="0 0 90 100">
      <H cx={45} cy={11} c={c}/>
      {/* torso */}
      <L x1={45} y1={19} x2={45} y2={54} c={c}/>
      {/* seated legs */}
      <L x1={45} y1={54} x2={30} y2={66} c={c}/><L x1={30} y1={66} x2={30} y2={84} c={c}/>
      <L x1={45} y1={54} x2={60} y2={66} c={c}/><L x1={60} y1={66} x2={60} y2={84} c={c}/>
      {/* left upper arm */}
      <L x1={45} y1={28} x2={26} y2={42} c={c}/>
      {/* left forearm — taps */}
      <g style={lA}><L x1={26} y1={42} x2={18} y2={56} c={c}/></g>
      {/* right upper arm */}
      <L x1={45} y1={28} x2={64} y2={42} c={c}/>
      {/* right forearm — taps */}
      <g style={rA}><L x1={64} y1={42} x2={72} y2={56} c={c}/></g>
      {/* piano body */}
      <rect x={4} y={56} width={82} height={22} rx={2} stroke={c} strokeWidth="1.5" fill="none"/>
      {/* white key dividers */}
      {[14,22,30,38,46,54,62,70].map(x =>
        <line key={x} x1={x} y1={56} x2={x} y2={78} stroke={c} strokeWidth="0.6" opacity="0.3"/>
      )}
      {/* black keys */}
      {[10,18,34,42,50,58].map((x, i) =>
        <rect key={i} x={x} y={56} width={7} height={12} rx={1}
          stroke={c} strokeWidth="1" fill={active ? color+"55" : "none"}/>
      )}
    </svg>
  );
}

// ── STRINGS (violin) ──────────────────────────────────────────────────────────
function Strings({ active, playing, color }) {
  const c = active ? color : "#2a2a2a";
  const bA = playing ? { animation:"bow-stroke 0.7s ease-in-out infinite", transformOrigin:"62px 26px" } : {};
  return (
    <svg width="90" height="100" viewBox="0 0 90 100">
      <H cx={45} cy={11} c={c}/>
      <L x1={45} y1={19} x2={45} y2={64} c={c}/>
      {/* legs */}
      <L x1={45} y1={64} x2={37} y2={80} c={c}/><L x1={37} y1={80} x2={37} y2={92} c={c}/>
      <L x1={45} y1={64} x2={53} y2={80} c={c}/><L x1={53} y1={80} x2={53} y2={92} c={c}/>
      {/* left arm — up to violin neck */}
      <L x1={45} y1={28} x2={32} y2={22} c={c}/>
      <L x1={32} y1={22} x2={26} y2={14} c={c}/>
      {/* violin body at shoulder */}
      <ellipse cx={31} cy={31} rx={6} ry={10} stroke={c} strokeWidth="1.5" fill="none"/>
      {/* f-hole hint */}
      <L x1={29} y1={28} x2={29} y2={34} c={c} w={0.7} op={0.5}/>
      {/* right arm + bow */}
      <L x1={45} y1={28} x2={62} y2={26} c={c}/>
      <g style={bA}>
        <L x1={62} y1={26} x2={80} y2={34} c={c} w={2.5}/>
      </g>
    </svg>
  );
}

// ── CELLO ─────────────────────────────────────────────────────────────────────
// Cello body sits clearly between the player's knees, not overlapping the torso.
function Cello({ active, playing, color }) {
  const c = active ? color : "#2a2a2a";
  const bA = playing ? { animation:"bow-stroke 0.9s ease-in-out infinite 0.1s", transformOrigin:"68px 34px" } : {};
  return (
    <svg width="90" height="100" viewBox="0 0 90 100">
      <H cx={50} cy={11} c={c}/>
      <L x1={50} y1={19} x2={50} y2={54} c={c}/>
      {/* seated legs — wide stance to frame the cello */}
      <L x1={50} y1={54} x2={34} y2={66} c={c}/><L x1={34} y1={66} x2={34} y2={86} c={c}/>
      <L x1={50} y1={54} x2={66} y2={66} c={c}/><L x1={66} y1={66} x2={66} y2={86} c={c}/>
      {/* cello body — centered between legs, below torso */}
      <ellipse cx={50} cy={72} rx={10} ry={16} stroke={c} strokeWidth="1.5" fill="none"/>
      {/* cello waist indents */}
      <L x1={40} y1={70} x2={40} y2={74} c={c} w={0.8} op={0.6}/>
      <L x1={60} y1={70} x2={60} y2={74} c={c} w={0.8} op={0.6}/>
      {/* cello neck — rises up from body to player's left hand */}
      <L x1={50} y1={56} x2={46} y2={22} c={c} w={1.2}/>
      {/* left arm — reaching to neck */}
      <L x1={50} y1={28} x2={46} y2={26} c={c}/>
      {/* right arm + bow */}
      <L x1={50} y1={32} x2={68} y2={34} c={c}/>
      <g style={bA}>
        <L x1={68} y1={34} x2={84} y2={46} c={c} w={2.5}/>
      </g>
    </svg>
  );
}

// ── DOUBLE BASS ───────────────────────────────────────────────────────────────
function DBass({ active, playing, color }) {
  const c = active ? color : "#2a2a2a";
  const bA = playing ? { animation:"bow-stroke 1.1s ease-in-out infinite 0.2s", transformOrigin:"66px 30px" } : {};
  return (
    <svg width="90" height="100" viewBox="0 0 90 100">
      <H cx={52} cy={11} c={c}/>
      <L x1={52} y1={19} x2={52} y2={64} c={c}/>
      {/* legs */}
      <L x1={52} y1={64} x2={44} y2={80} c={c}/><L x1={44} y1={80} x2={44} y2={92} c={c}/>
      <L x1={52} y1={64} x2={60} y2={80} c={c}/><L x1={60} y1={80} x2={60} y2={92} c={c}/>
      {/* bass body — large, tall, to the left */}
      <ellipse cx={22} cy={58} rx={12} ry={22} stroke={c} strokeWidth="1.5" fill="none"/>
      {/* bass waist indents */}
      <L x1={10} y1={56} x2={10} y2={60} c={c} w={0.8} op={0.6}/>
      <L x1={34} y1={56} x2={34} y2={60} c={c} w={0.8} op={0.6}/>
      {/* bass neck — very tall */}
      <L x1={22} y1={36} x2={24} y2={8} c={c} w={1.3}/>
      {/* left arm reaching across to neck */}
      <L x1={52} y1={28} x2={28} y2={38} c={c}/>
      {/* right arm + bow */}
      <L x1={52} y1={32} x2={66} y2={30} c={c}/>
      <g style={bA}>
        <L x1={66} y1={30} x2={82} y2={44} c={c} w={2.5}/>
      </g>
    </svg>
  );
}

// ── FLUTE ─────────────────────────────────────────────────────────────────────
function Flute({ active, playing, color }) {
  const c = active ? color : "#2a2a2a";
  const fA = playing ? { animation:"flute-sway 1.2s ease-in-out infinite", transformOrigin:"45px 34px" } : {};
  return (
    <svg width="90" height="100" viewBox="0 0 90 100">
      <H cx={45} cy={11} c={c}/>
      <L x1={45} y1={19} x2={45} y2={64} c={c}/>
      {/* legs */}
      <L x1={45} y1={64} x2={37} y2={80} c={c}/><L x1={37} y1={80} x2={37} y2={92} c={c}/>
      <L x1={45} y1={64} x2={53} y2={80} c={c}/><L x1={53} y1={80} x2={53} y2={92} c={c}/>
      {/* arms out — left shorter (near mouth), right extended */}
      <L x1={45} y1={30} x2={22} y2={36} c={c}/>
      <L x1={45} y1={30} x2={70} y2={30} c={c}/>
      {/* flute tube */}
      <g style={fA}>
        <rect x={8} y={31} width={74} height={5} rx={2.5} stroke={c} strokeWidth="1.5" fill="none"/>
        {/* embouchure hole */}
        <circle cx={16} cy={33.5} r={2} stroke={c} strokeWidth="1" fill={active ? color+"55" : "none"}/>
        {/* tone holes */}
        {[30,40,50,60,70].map((x, i) =>
          <circle key={i} cx={x} cy={33.5} r={1.8} stroke={c} strokeWidth="1" fill={active && i%2===0 ? color+"44" : "none"}/>
        )}
      </g>
    </svg>
  );
}

// ── HORN ──────────────────────────────────────────────────────────────────────
function Horn({ active, playing, color }) {
  const c = active ? color : "#2a2a2a";
  const bA = playing ? { animation:"horn-bell 0.6s ease-in-out infinite", transformOrigin:"62px 50px" } : {};
  return (
    <svg width="90" height="100" viewBox="0 0 90 100">
      <H cx={38} cy={11} c={c}/>
      <L x1={38} y1={19} x2={38} y2={64} c={c}/>
      {/* legs */}
      <L x1={38} y1={64} x2={30} y2={80} c={c}/><L x1={30} y1={80} x2={30} y2={92} c={c}/>
      <L x1={38} y1={64} x2={46} y2={80} c={c}/><L x1={46} y1={80} x2={46} y2={92} c={c}/>
      {/* both arms reaching to horn */}
      <L x1={38} y1={28} x2={50} y2={34} c={c}/>
      <L x1={38} y1={36} x2={50} y2={42} c={c}/>
      {/* French horn — outer coil */}
      <circle cx={62} cy={42} r={16} stroke={c} strokeWidth="1.5" fill="none"/>
      {/* inner coil */}
      <circle cx={62} cy={42} r={9}  stroke={c} strokeWidth="1"   fill="none" opacity="0.6"/>
      {/* center dot */}
      <circle cx={62} cy={42} r={2}  stroke={c} strokeWidth="1"   fill={active ? color+"66" : "none"}/>
      {/* mouthpiece tube */}
      <L x1={50} y1={30} x2={48} y2={36} c={c} w={1.5}/>
      {/* bell — thicker for visibility */}
      <g style={bA}>
        <path d={`M76 48 Q86 44 88 52 Q86 62 76 58`} stroke={c} strokeWidth="3" fill="none"/>
      </g>
    </svg>
  );
}

// ── FIGURINE MAP ──────────────────────────────────────────────────────────────
const FIGS = { pno:Piano, v1:Strings, cel:Cello, bass:DBass, flt:Flute, hrn:Horn };

// ── ORCHESTRA PIT ─────────────────────────────────────────────────────────────
export default function OrchestraViz({ activeVoices, activityRef, tick, T }) {
  return (
    <>
      <style>{ANIM}</style>
      <div style={{ display:"flex", gap:24, flexWrap:"wrap", alignItems:"flex-end" }}>
        {[
          { key:"pno",  label:"PIANO",   color:"#ffe4a0", voice:1 },
          { key:"v1",   label:"STRINGS", color:"#00ff88", voice:2 },
          { key:"cel",  label:"CELLO",   color:"#00ff88", voice:3 },
          { key:"bass", label:"D.BASS",  color:"#00ff88", voice:4 },
          { key:"flt",  label:"FLUTE",   color:"#88ddff", voice:5 },
          { key:"hrn",  label:"HORN",    color:"#ffaa44", voice:6 },
        ].map(({ key, label, color, voice }) => {
          const active  = activeVoices >= voice;
          const playing = (Date.now() - (activityRef.current[key] || 0)) < 800;
          const Fig     = FIGS[key];
          return (
            <div key={key} style={{ textAlign:"center", opacity: active ? 1 : 0.18, transition:"opacity 1.5s" }}>
              <Fig active={active} playing={playing} color={color}/>
              <div style={{ fontFamily:"monospace", fontSize:8, letterSpacing:1.5, color: active ? color : T.muted4, marginTop:6 }}>
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
