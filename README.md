# BlockBeats

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Live Solana blockchain activity, translated into generative orchestral music.**

Every block that lands on Solana becomes a musical event. Transaction volume drives chord density, block hash determines harmony, and six instruments — piano, strings, cello, double bass, flute, and horn — improvise continuously. The key and mode rotate once every 24 hours, giving each day a distinct emotional colour.

**[Try it live →](https://blockbeats-lilac.vercel.app)**

---

## How it works

Each ~400ms Solana block is parsed for three values:

| Block data | Musical effect |
|---|---|
| Transaction count | Piano chord density — busier blocks = denser chords |
| Block hash | Chord function selection (diatonic to today's key) |
| Fee total | Filter cutoff — higher fees = brighter texture |
| Program count | Number of active orchestral voices (2–6) |

The six instruments follow a **circle-of-fifths melodic state machine** — each voice moves stepwise, leaps to chord tones, or resolves to root depending on its role (lyrical, inner harmony, or bass anchor).

### Daily key rotation

The key and mode (major/minor) rotate once every 24 hours, cycling through 12 different tonalities. Every visit to the same day produces the same key — so the music is deterministic per day, but changes overnight.

## Features

- Live Solana RPC data — real blocks, real rhythm
- 6-voice orchestral synthesis (piano, strings, cello, double bass, flute, horn)
- Daily key rotation across major and minor tonalities
- Light / dark theme toggle
- Spacebar to play/stop
- Click any block in history to re-conduct it

## Stack

- **React 18** + **Vite**
- **[Tone.js 15](https://tonejs.github.io)** — synthesis, sequencing, effects
- **Solana JSON-RPC** — `getSlot` + `getBlock` (finalized commitment)

## Run locally

```bash
npm install
npm run dev
```

Runs on `http://localhost:5173` by default.

> The app proxies RPC calls through `/rpc` — configure your Solana RPC endpoint in `vite.config.js` if self-hosting.

## Self-hosting

See [deploy.sh](deploy.sh) and [setup-server.sh](setup-server.sh) for nginx deployment. Update `SERVER_USER` and `SERVER_HOST` with your own server details.

## License

MIT — see [LICENSE](LICENSE).
