import { timeAgo } from "../utils.js";

export default function BlockTicker({ blocks, T }) {
  return (
    <div style={{ display:"flex", gap:6, overflowX:"auto", padding:"4px 0", scrollbarWidth:"none" }}>
      {blocks.map((b, i) => (
        <div key={b.slot} style={{
          minWidth:110, padding:"6px 8px", borderRadius:6,
          background: i === 0 ? T.tickerActiveBg : T.tickerInactiveBg,
          border: i === 0 ? `1px solid ${T.tickerActiveBorder}` : `1px solid ${T.tickerInactiveBorder}`,
          fontFamily:"monospace", fontSize:10,
          color: i === 0 ? T.tickerActiveText : T.tickerInactiveText,
          flexShrink:0,
        }}>
          <div style={{ fontWeight:700, fontSize:11 }}>#{b.slot.toLocaleString()}</div>
          <div style={{ opacity:0.7, marginTop:2 }}>{b.txCount.toLocaleString()} txs</div>
          <div style={{ opacity:0.4, fontSize:9, marginTop:2 }}>{timeAgo(b.time)}</div>
        </div>
      ))}
    </div>
  );
}
