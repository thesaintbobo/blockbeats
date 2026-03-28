export const RPC     = "/rpc";
export const VERSION = "v0.9";
export const BPM     = 88;
export const SIG     = 4;

export const CHROMATIC = ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"];

export const INSTRUMENTS = [
  { key:"pno",  label:"PIANO",   color:"#ffe4a0", voice:1 },
  { key:"v1",   label:"STRINGS", color:"#00ff88", voice:2 },
  { key:"cel",  label:"CELLO",   color:"#00ff88", voice:3 },
  { key:"bass", label:"D.BASS",  color:"#00ff88", voice:4 },
  { key:"flt",  label:"FLUTE",   color:"#88ddff", voice:5 },
  { key:"hrn",  label:"HORN",    color:"#ffaa44", voice:6 },
];

// --- DAILY KEY ROTATION ---
const KEY_POOL = [
  { rootIdx: 9,  root: "A",  mode: "minor" },
  { rootIdx: 0,  root: "C",  mode: "major" },
  { rootIdx: 4,  root: "E",  mode: "minor" },
  { rootIdx: 7,  root: "G",  mode: "major" },
  { rootIdx: 2,  root: "D",  mode: "minor" },
  { rootIdx: 5,  root: "F",  mode: "major" },
  { rootIdx: 11, root: "B",  mode: "minor" },
  { rootIdx: 3,  root: "Eb", mode: "major" },
  { rootIdx: 6,  root: "F#", mode: "minor" },
  { rootIdx: 10, root: "Bb", mode: "major" },
  { rootIdx: 1,  root: "C#", mode: "minor" },
  { rootIdx: 8,  root: "Ab", mode: "major" },
];

export const SCALE_BY_MODE = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
};

// 7th chords — the Hisaishi signature palette (Am7, FMaj7, CMaj7, G7 style)
export const CHORDS_BY_MODE = {
  minor: [
    { name:"i7",      rootOff:0,  tones:[0,3,7,10]  },  // root min7
    { name:"VImaj7",  rootOff:8,  tones:[8,0,3,7]   },  // ♭VI maj7
    { name:"♭VII7",   rootOff:10, tones:[10,2,5,8]  },  // ♭VII dom7
    { name:"iv7",     rootOff:5,  tones:[5,8,0,3]   },  // iv min7
    { name:"IIImaj7", rootOff:3,  tones:[3,7,10,2]  },  // ♭III maj7
  ],
  major: [
    { name:"Imaj7",  rootOff:0, tones:[0,4,7,11]  },
    { name:"IVmaj7", rootOff:5, tones:[5,9,0,4]   },
    { name:"V7",     rootOff:7, tones:[7,11,2,5]  },
    { name:"vi7",    rootOff:9, tones:[9,0,4,7]   },
    { name:"ii7",    rootOff:2, tones:[2,5,9,0]   },
  ],
};

const dayNum    = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
export const DAILY_KEY  = KEY_POOL[dayNum % KEY_POOL.length];
export const FIXED_KEY  = { rootIdx: DAILY_KEY.rootIdx, root: DAILY_KEY.root };
export const SCALE_IVS  = SCALE_BY_MODE[DAILY_KEY.mode];
export const CHORD_FUNCS = CHORDS_BY_MODE[DAILY_KEY.mode];
