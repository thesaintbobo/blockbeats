const ANIM = `
  @keyframes bow-stroke  { 0%,100%{transform:rotate(-22deg)} 50%{transform:rotate(22deg)} }
  @keyframes key-tap-l   { 0%,100%{transform:translateY(0)}  50%{transform:translateY(5px)} }
  @keyframes key-tap-r   { 0%,100%{transform:translateY(0)}  50%{transform:translateY(5px)} }
  @keyframes flute-sway  { 0%,100%{transform:rotate(-3deg)}  50%{transform:rotate(3deg)} }
  @keyframes horn-bell   { 0%,100%{transform:scale(1)}       50%{transform:scale(1.06)} }
  @keyframes fade-in     { from{opacity:0} to{opacity:1} }
`;

// ── shared helpers ───────────────────────────────────────────────────────────
const H = ({ cx, cy, r = 7, c }) =>
  <circle cx={cx} cy={cy} r={r} stroke={c} strokeWidth="1.5" fill="none"/>;

const L = ({ x1, y1, x2, y2, c, w = 1.5, op = 1 }) =>
  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={w} opacity={op}/>;

// ── PIANO ────────────────────────────────────────────────────────────────────
function Piano({ active, playing, color }) {
  const c   = active ? color : "#2a2a2a";
  const lAn = playing ? { animation:"key-tap-l 0.45s ease-in-out infinite",            transformOrigin:"22px 38px" } : {};
  const rAn = playing ? { animation:"key-tap-r 0.45s ease-in-out infinite 0.22s",      transformOrigin:"58px 38px" } : {};
  return (
    <svg width="80" height="92" viewBox="0 0 80 92">
      <H cx={40} cy={9} c={c}/>
      <L x1={40} y1={16} x2={40} y2={48} c={c}/>
      {/* seated legs */}
      <L x1={40} y1={48} x2={28} y2={60} c={c}/><L x1={28} y1={60} x2={28} y2={72} c={c}/>
      <L x1={40} y1={48} x2={52} y2={60} c={c}/><L x1={52} y1={60} x2={52} y2={72} c={c}/>
      {/* left arm */}
      <L x1={40} y1={26} x2={22} y2={38} c={c}/>
      <g style={lAn}><L x1={22} y1={38} x2={16} y2={52} c={c}/></g>
      {/* right arm */}
      <L x1={40} y1={26} x2={58} y2={38} c={c}/>
      <g style={rAn}><L x1={58} y1={38} x2={64} y2={52} c={c}/></g>
      {/* piano body */}
      <rect x={5} y={54} width={70} height={18} rx={2} stroke={c} strokeWidth="1.5" fill="none"/>
      {/* white key dividers */}
      {[14,21,28,35,42,49,56,63].map(x => <L key={x} x1={x} y1={54} x2={x} y2={72} c={c} w={0.6} op={0.35}/>)}
      {/* black keys */}
      {[10,17,31,38,45].map((x,i) => (
        <rect key={i} x={x} y={54} width={6} height={10} rx={0.5}
          stroke={c} strokeWidth="1"
          fill={active ? color + "55" : "none"}/>
      ))}
    </svg>
  );
}

// ── STRINGS (violin) ─────────────────────────────────────────────────────────
function Strings({ active, playing, color }) {
  const c   = active ? color : "#2a2a2a";
  const bAn = playing ? { animation:"bow-stroke 0.7s ease-in-out infinite", transformOrigin:"60px 22px" } : {};
  return (
    <svg width="80" height="92" viewBox="0 0 80 92">
      <H cx={40} cy={9} c={c}/>
      <L x1={40} y1={16} x2={40} y2={58} c={c}/>
      {/* left arm — holding violin neck up */}
      <L x1={40} y1={26} x2={27} y2={20} c={c}/>
      <L x1={27} y1={20} x2={22} y2={13} c={c}/>
      {/* violin body at shoulder */}
      <ellipse cx={30} cy={29} rx={6} ry={9} stroke={c} strokeWidth="1.5" fill="none"/>
      <L x1={24} y1={29} x2={27} y2={20} c={c} w={0.8} op={0.5}/>
      {/* bow arm */}
      <L x1={40} y1={26} x2={60} y2={22} c={c}/>
      <g style={bAn}>
        <L x1={60} y1={22} x2={76} y2={30} c={c} w={2}/>
      </g>
      {/* legs */}
      <L x1={40} y1={58} x2={32} y2={74} c={c}/><L x1={40} y1={58} x2={48} y2={74} c={c}/>
    </svg>
  );
}

// ── CELLO ─────────────────────────────────────────────────────────────────────
function Cello({ active, playing, color }) {
  const c   = active ? color : "#2a2a2a";
  const bAn = playing ? { animation:"bow-stroke 0.9s ease-in-out infinite 0.1s", transformOrigin:"62px 32px" } : {};
  return (
    <svg width="80" height="92" viewBox="0 0 80 92">
      <H cx={38} cy={9} c={c}/>
      <L x1={38} y1={16} x2={38} y2={48} c={c}/>
      {/* seated legs */}
      <L x1={38} y1={48} x2={26} y2={60} c={c}/><L x1={26} y1={60} x2={26} y2={72} c={c}/>
      <L x1={38} y1={48} x2={50} y2={60} c={c}/><L x1={50} y1={60} x2={50} y2={72} c={c}/>
      {/* large cello body between legs */}
      <ellipse cx={30} cy={54} rx={9} ry={14} stroke={c} strokeWidth="1.5" fill="none"/>
      {/* cello neck */}
      <L x1={30} y1={40} x2={30} y2={28} c={c} w={1.2}/>
      {/* left arm holding neck */}
      <L x1={38} y1={26} x2={30} y2={32} c={c}/>
      {/* bow arm */}
      <L x1={38} y1={30} x2={62} y2={32} c={c}/>
      <g style={bAn}>
        <L x1={62} y1={32} x2={76} y2={42} c={c} w={2}/>
      </g>
    </svg>
  );
}

// ── DOUBLE BASS ───────────────────────────────────────────────────────────────
function DBass({ active, playing, color }) {
  const c   = active ? color : "#2a2a2a";
  const bAn = playing ? { animation:"bow-stroke 1.1s ease-in-out infinite 0.2s", transformOrigin:"64px 28px" } : {};
  return (
    <svg width="80" height="92" viewBox="0 0 80 92">
      <H cx={42} cy={9} c={c}/>
      <L x1={42} y1={16} x2={42} y2={60} c={c}/>
      {/* legs */}
      <L x1={42} y1={60} x2={34} y2={76} c={c}/><L x1={42} y1={60} x2={50} y2={76} c={c}/>
      {/* very tall bass body */}
      <ellipse cx={22} cy={50} rx={10} ry={18} stroke={c} strokeWidth="1.5" fill="none"/>
      {/* bass neck — tall */}
      <L x1={22} y1={32} x2={22} y2={8} c={c} w={1.2}/>
      {/* left arm reaching across */}
      <L x1={42} y1={28} x2={24} y2={36} c={c}/>
      {/* bow arm */}
      <L x1={42} y1={30} x2={64} y2={28} c={c}/>
      <g style={bAn}>
        <L x1={64} y1={28} x2={76} y2={40} c={c} w={2}/>
      </g>
    </svg>
  );
}

// ── FLUTE ─────────────────────────────────────────────────────────────────────
function Flute({ active, playing, color }) {
  const c   = active ? color : "#2a2a2a";
  const bAn = playing ? { animation:"flute-sway 1.2s ease-in-out infinite", transformOrigin:"40px 40px" } : {};
  return (
    <svg width="80" height="92" viewBox="0 0 80 92">
      <H cx={40} cy={9} c={c}/>
      <L x1={40} y1={16} x2={40} y2={60} c={c}/>
      {/* legs */}
      <L x1={40} y1={60} x2={32} y2={76} c={c}/><L x1={40} y1={60} x2={48} y2={76} c={c}/>
      {/* arms out holding flute */}
      <L x1={40} y1={28} x2={16} y2={34} c={c}/>
      <L x1={40} y1={28} x2={64} y2={28} c={c}/>
      {/* flute — long horizontal tube */}
      <g style={bAn}>
        <rect x={10} y={30} width={62} height={4} rx={2} stroke={c} strokeWidth="1.5" fill="none"/>
        {/* tone holes */}
        {[28,36,44,52].map((x,i) => (
          <circle key={i} cx={x} cy={32} r={1.5} stroke={c} strokeWidth="1" fill={active ? color+"66" : "none"}/>
        ))}
      </g>
    </svg>
  );
}

// ── HORN ──────────────────────────────────────────────────────────────────────
function Horn({ active, playing, color }) {
  const c   = active ? color : "#2a2a2a";
  const bAn = playing ? { animation:"horn-bell 0.6s ease-in-out infinite", transformOrigin:"58px 46px" } : {};
  return (
    <svg width="80" height="92" viewBox="0 0 80 92">
      <H cx={34} cy={9} c={c}/>
      <L x1={34} y1={16} x2={34} y2={60} c={c}/>
      {/* legs */}
      <L x1={34} y1={60} x2={26} y2={76} c={c}/><L x1={34} y1={60} x2={42} y2={76} c={c}/>
      {/* both arms forward holding horn */}
      <L x1={34} y1={26} x2={46} y2={32} c={c}/>
      <L x1={34} y1={32} x2={46} y2={38} c={c}/>
      {/* French horn coil */}
      <circle cx={54} cy={36} r={12} stroke={c} strokeWidth="1.5" fill="none"/>
      <circle cx={54} cy={36} r={7}  stroke={c} strokeWidth="1" fill="none" opacity="0.5"/>
      {/* mouthpiece */}
      <L x1={42} y1={28} x2={44} y2={32} c={c} w={1.2}/>
      {/* bell */}
      <g style={bAn}>
        <path d="M62 40 Q72 38 74 46 Q72 54 62 52" stroke={c} strokeWidth="2" fill="none"/>
      </g>
    </svg>
  );
}

// ── FIGURINE MAP ──────────────────────────────────────────────────────────────
const FIGS = { pno: Piano, v1: Strings, cel: Cello, bass: DBass, flt: Flute, hrn: Horn };

// ── ORCHESTRA PIT ─────────────────────────────────────────────────────────────
export default function OrchestraViz({ activeVoices, activityRef, tick, T }) {
  return (
    <>
      <style>{ANIM}</style>
      <div style={{ display:"flex", gap:20, flexWrap:"wrap", alignItems:"flex-end" }}>
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
            <div key={key} style={{ textAlign:"center", opacity: active ? 1 : 0.2, transition:"opacity 1.5s" }}>
              <Fig active={active} playing={playing} color={color}/>
              <div style={{
                fontFamily:"monospace", fontSize:8, letterSpacing:1.5,
                color: active ? color : T.muted4,
                marginTop:4,
              }}>
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
