export default function Slider({ label, value, min, max, step, onChange, display, T }) {
  return (
    <div style={{ minWidth:150 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
        <span style={{ fontFamily:"monospace", fontSize:9, color:T.muted3, letterSpacing:2, textTransform:"uppercase" }}>{label}</span>
        <span style={{ fontFamily:"monospace", fontSize:9, color:T.muted1 }}>{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width:"100%", accentColor:T.accent, cursor:"pointer", height:3 }}
      />
    </div>
  );
}
