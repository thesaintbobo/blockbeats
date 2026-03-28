# BlockBeats

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Live Solana blockchain activity, translated into generative orchestral music.**

Every block that lands on Solana becomes a musical event. Transaction volume drives chord density, block hash determines harmony, and six instruments — piano, strings, cello, double bass, flute, and horn — improvise continuously in A natural minor.

**[Try it live →](https://blockbeats-lilac.vercel.app)**

---

## How it works

Each ~400ms Solana block is parsed for three values:

| Block data | Musical effect |
|---|---|
| Transaction count | Piano chord density — busier blocks = denser chords |
| Block hash | Chord function selection (Am / F / G / Dm / C) |
| Fee total | Filter cutoff — higher fees = brighter texture |

The six instruments follow a **circle-of-fifths melodic state machine** — each voice moves stepwise, leaps to chord tones, or resolves to root depending on its role (lyrical, inner harmony, or bass anchor). Key and tempo never change.

## Stack

- **React 18** + **Vite**
- **Tone.js 15** — synthesis, sequencing, effects
- **Solana JSON-RPC** — `getSlot` + `getBlock` (finalized)

## Run locally

```bash
npm install
npm run dev
```

Runs on `http://localhost:5173` by default.

> The app proxies RPC calls through `/rpc` — configure your Solana RPC endpoint in `vite.config.js` if self-hosting.

## Self-hosting

See [deploy.sh](deploy.sh) and [setup-server.sh](setup-server.sh) for nginx deployment. Update `SERVER_USER` and `SERVER_HOST` with your own server details.
