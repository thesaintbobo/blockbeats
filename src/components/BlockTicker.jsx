import { timeAgo } from "../utils.js";

const BAR_H = 64;

export default function BlockTicker({ blocks, T, accent }) {
  if (!blocks.length) return null;
  const maxTx = Math.max(...blocks.map(b => b.txCount));

  return (
    <div style={{ display:"flex", gap:5, alignItems:"flex-end", height: BAR_H + 36, overflowX:"auto", scrollbarWidth:"none", paddingBottom:2 }}>
      {blocks.map((b, i) => {
        const pct     = b.txCount / maxTx;
        const isLatest = i === 0;
        const barH    = Math.max(4, Math.round(pct * BAR_H));
        const opacity = isLatest ? 1 : Math.max(0.2, 0.7 - i * 0.03);
        return (
          <div key={b.slot} title={`#${b.slot.toLocaleString()} · ${b.txCount.toLocaleString()} txs · ${timeAgo(b.time)}`}
            style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, flexShrink:0, cursor:"default" }}>
            {/* tx count on hover via title; show on latest */}
            {isLatest && (
              <div style={{ fontFamily:"monospace", fontSize:7, color:accent, letterSpacing:0, marginBottom:2 }}>
                {b.txCount.toLocaleString()}
              </div>
            )}
            {/* bar */}
            <div style={{
              width: 10, height: barH, borderRadius: "2px 2px 0 0",
              background: isLatest ? accent : T.muted5,
              opacity, transition:"height 0.4s ease",
              boxShadow: isLatest ? `0 0 8px ${accent}66` : "none",
            }}/>
            {/* slot tail (last 4 digits) rotated */}
            <div style={{
              fontFamily:"monospace", fontSize:7,
              color: isLatest ? accent : T.muted4,
              writingMode:"vertical-rl", transform:"rotate(180deg)",
              letterSpacing:0, opacity: isLatest ? 1 : 0.5,
            }}>
              {String(b.slot).slice(-4)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
