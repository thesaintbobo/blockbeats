import { INSTRUMENTS } from "../constants.js";

export default function OrchestraViz({ activeVoices, activityRef, tick, T }) {
  return (
    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
      {INSTRUMENTS.map(({ key, label, color, voice }) => {
        const active  = activeVoices >= voice;
        const playing = (Date.now() - (activityRef.current[key] || 0)) < 800;
        return (
          <div key={key} style={{
            padding:"6px 10px", borderRadius:5, minWidth:60,
            background: active ? T.orchActiveBg : T.orchInactiveBg,
            border: `1px solid ${active ? color + "44" : T.orchInactiveBorder}`,
            opacity: active ? 1 : 0.3,
            transition: "opacity 1.5s, border 1.5s",
          }}>
            <div style={{ fontSize:9, color: active ? color : T.muted4, letterSpacing:1, fontFamily:"monospace", textAlign:"center" }}>
              {label}
            </div>
            <div style={{ marginTop:4, height:2, background:T.barBg, borderRadius:1, overflow:"hidden" }}>
              <div style={{
                height:"100%", background:color, borderRadius:1,
                width: playing ? "100%" : "0%",
                transition: playing ? "none" : "width 0.9s ease-out",
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
