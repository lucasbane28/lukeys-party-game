import { useState, useEffect } from 'react';
import { db } from './firebase';
import {
  doc, collection, getDoc, setDoc, deleteDoc,
  onSnapshot, getDocs,
} from 'firebase/firestore';

// ============================================================
// Firestore helpers
// ============================================================
const GAME_DOC    = ()     => doc(db, 'game', 'state');
const PLAYER_DOC  = (name) => doc(db, 'players', name.toLowerCase().replace(/\//g, '_'));
const FACT_DOC    = (id)   => doc(db, 'facts',   id);
const STORY_DOC   = (id)   => doc(db, 'stories', id);
const playersCol  = ()     => collection(db, 'players');
const factsCol    = ()     => collection(db, 'facts');
const storiesCol  = ()     => collection(db, 'stories');

// ============================================================
// Constants + utilities
// ============================================================
const HOST_NAME        = 'Lukey';
const HOST_NAME_FORMAL = 'Lucas';
const GAME1_TITLE      = 'Two Truths & a Lukey';
const GAME2_TITLE      = 'Lucas is a Starfucker!';

const uid = () => Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function arrangeGame1(facts) {
  const lucas  = shuffle(facts.filter(f =>  f.isLucas));
  const guests = shuffle(facts.filter(f => !f.isLucas));
  const rounds = [];
  const numRounds = Math.min(Math.floor(guests.length / 2), lucas.length);
  for (let i = 0; i < numRounds; i++) {
    const lFact = lucas[i];
    const gA    = guests[i * 2];
    const gB    = guests[i * 2 + 1];
    const positions = shuffle([
      { ...lFact, isLucas: true  },
      { ...gA,    isLucas: false },
      { ...gB,    isLucas: false },
    ]);
    const lukeyIndex = positions.findIndex(p => p.isLucas);
    rounds.push({ id: 'r' + uid(), facts: positions.map(p => p.text), lukeyIndex });
  }
  return rounds;
}

function arrangeGame2(stories) {
  return shuffle(stories).map(s => ({
    id: 'r' + uid(),
    story: s.text,
    isLukey: s.isLucas,
  }));
}

function countAnswers(players, key) {
  return Object.values(players).filter(p => p.answers && p.answers[key] !== undefined).length;
}

// ============================================================
// Decorative components
// ============================================================
function AmbientBg() {
  return (
    <>
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="blob-a absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full"
             style={{background:'radial-gradient(circle,rgba(255,94,158,0.22),transparent 60%)'}}/>
        <div className="blob-b absolute -bottom-60 -left-40 w-[520px] h-[520px] rounded-full"
             style={{background:'radial-gradient(circle,rgba(94,234,212,0.16),transparent 60%)'}}/>
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full"
             style={{background:'radial-gradient(circle,rgba(251,191,36,0.06),transparent 60%)'}}/>
      </div>
      <div className="tropic-pattern"/>
      <div className="grain"/>
    </>
  );
}

function Sparkle({size=16,className='',style={}}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={style} aria-hidden>
      <path d="M12 0 L13.5 9 L24 12 L13.5 15 L12 24 L10.5 15 L0 12 L10.5 9 Z"/>
    </svg>
  );
}

function Palm({size=22,className=''}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 22 Q13 16 12 12 Q9 16 5 17 Q9 14 12 12 Q5 11 3 7 Q8 9 12 12 Q11 7 13 3 Q13 8 12 12 Q17 11 21 7 Q17 13 12 12 Q15 16 19 17 Q14 16 12 12 Q11 17 12 22 Z"/>
    </svg>
  );
}

function TikiOrnament({className=''}) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`} style={{color:'var(--pink)'}}>
      <div style={{width:50,height:1,background:'currentColor',opacity:0.4}}/>
      <Sparkle size={10} style={{color:'var(--sun)'}}/>
      <Palm size={20}/>
      <Sparkle size={10} style={{color:'var(--sun)'}}/>
      <div style={{width:50,height:1,background:'currentColor',opacity:0.4}}/>
    </div>
  );
}

function Confetti({show}) {
  if (!show) return null;
  const colors=['#ff5e9e','#5eead4','#fbbf24','#a3e635','#fb7185','#fff5e6'];
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {Array.from({length:60},(_,i)=>{
        const left=Math.random()*100, delay=Math.random()*0.8, duration=2+Math.random()*1.8;
        const color=colors[i%colors.length], size=6+Math.random()*8;
        return <div key={i} style={{position:'absolute',left:`${left}%`,top:'-5vh',width:size,height:size*0.45,background:color,animation:`confetti-fall ${duration}s ${delay}s ease-in forwards`,borderRadius:'2px'}}/>;
      })}
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [boot,       setBoot]       = useState('loading');
  const [game,       setGame]       = useState(null);
  const [players,    setPlayers]    = useState({});
  const [factsPool,  setFactsPool]  = useState([]);
  const [storiesPool,setStoriesPool]= useState([]);
  const [role,       setRole]       = useState(null);
  const [myName,     setMyName]     = useState(null);
  const [pinSetup,   setPinSetup]   = useState('');
  const [hostPinInput,setHostPinInput]=useState('');
  const [showHostLogin,setShowHostLogin]=useState(false);
  const [nameInput,  setNameInput]  = useState('');
  const [errMsg,     setErrMsg]     = useState('');
  const [confetti,   setConfetti]   = useState(false);

  useEffect(() => {
    const unsubs = [];

    unsubs.push(onSnapshot(GAME_DOC(), snap => {
      if (snap.exists()) { setGame(snap.data()); setBoot('has-game'); }
      else               { setGame(null);         setBoot('first-time'); }
    }));

    unsubs.push(onSnapshot(playersCol(), snap => {
      const ps = {};
      snap.docs.forEach(d => { const data = d.data(); if (data.name) ps[data.name] = data; });
      setPlayers(ps);
    }));

    unsubs.push(onSnapshot(factsCol(), snap => {
      setFactsPool(snap.docs.map(d => d.data()).sort((a,b) => a.createdAt - b.createdAt));
    }));

    unsubs.push(onSnapshot(storiesCol(), snap => {
      setStoriesPool(snap.docs.map(d => d.data()).sort((a,b) => a.createdAt - b.createdAt));
    }));

    return () => unsubs.forEach(u => u());
  }, []);

  async function createGame() {
    if (!/^\d{4}$/.test(pinSetup)) { setErrMsg('PIN must be 4 digits'); return; }
    const newGame = {
      hostPin: pinSetup, phase: 'lobby',
      game1: { rounds:[], currentRound:0, revealed:false },
      game2: { rounds:[], currentRound:0, revealed:false },
      createdAt: Date.now(),
    };
    await setDoc(GAME_DOC(), newGame);
    setRole('host'); setErrMsg('');
  }

  function tryHostLogin() {
    if (!game) return;
    if (hostPinInput.trim() === (game.hostPin||'').trim()) {
      setRole('host'); setShowHostLogin(false); setErrMsg(''); setHostPinInput('');
    } else { setErrMsg('Wrong PIN, babe.'); }
  }

  async function joinAsPlayer() {
    const name = nameInput.trim();
    if (!name)              { setErrMsg('Need a name to join'); return; }
    if (name.length > 24)  { setErrMsg('Keep it under 24 characters'); return; }
    if ([HOST_NAME,HOST_NAME_FORMAL].map(n=>n.toLowerCase()).includes(name.toLowerCase()))
      { setErrMsg("That name's taken by the birthday boy"); return; }
    const snap = await getDoc(PLAYER_DOC(name));
    if (!snap.exists())
      await setDoc(PLAYER_DOC(name), { name, score:0, answers:{}, scored:{}, joinedAt:Date.now() });
    setMyName(name); setRole('player'); setErrMsg('');
  }

  async function addFact({text,isLucas,attribution}) {
    if (!text.trim()) return;
    const id = uid();
    await setDoc(FACT_DOC(id), {
      id, text:text.trim(), isLucas,
      submittedBy: attribution||(isLucas?HOST_NAME:(myName||'guest')),
      createdAt: Date.now(),
    });
  }
  async function deleteFact(id) { await deleteDoc(FACT_DOC(id)); }

  async function addStory({text,isLucas,attribution}) {
    if (!text.trim()) return;
    const id = uid();
    await setDoc(STORY_DOC(id), {
      id, text:text.trim(), isLucas,
      submittedBy: attribution||(isLucas?HOST_NAME:(myName||'guest')),
      createdAt: Date.now(),
    });
  }
  async function deleteStory(id) { await deleteDoc(STORY_DOC(id)); }

  async function setPhase(newPhase, extra={}) {
    if (!game) return;
    await setDoc(GAME_DOC(), {...game, phase:newPhase, ...extra});
  }

  async function startGame1() {
    const rounds = arrangeGame1(factsPool);
    if (!rounds.length) { alert('Need at least 2 guest facts and 1 Lukey fact.'); return; }
    await setPhase('game1', { game1:{ rounds, currentRound:0, revealed:false } });
  }

  async function reveal1() {
    const updated = {...game, game1:{...game.game1, revealed:true}};
    const r   = game.game1.rounds[game.game1.currentRound];
    const key = `g1-${game.game1.currentRound}`;
    const correct = r.lukeyIndex;
    const pSnap = await getDocs(playersCol());
    for (const d of pSnap.docs) {
      const p   = d.data();
      const ans = p.answers?.[key];
      if (ans === undefined) continue;
      if (p.scored?.[key]  !== undefined) continue;
      const delta = ans === correct ? 10 : -5;
      await setDoc(PLAYER_DOC(p.name), {
        ...p, score:(p.score||0)+delta,
        scored:{...(p.scored||{}), [key]:delta},
      });
    }
    await setDoc(GAME_DOC(), updated);
  }

  async function nextG1() {
    const next = game.game1.currentRound + 1;
    if (next >= game.game1.rounds.length) await setPhase('between');
    else await setDoc(GAME_DOC(), {...game, game1:{...game.game1, currentRound:next, revealed:false}});
  }

  async function startGame2() {
    const rounds = arrangeGame2(storiesPool);
    if (!rounds.length) { alert('Need at least 1 story to start Game 2.'); return; }
    await setPhase('game2', { game2:{ rounds, currentRound:0, revealed:false } });
  }

  async function reveal2() {
    const updated = {...game, game2:{...game.game2, revealed:true}};
    const r       = game.game2.rounds[game.game2.currentRound];
    const key     = `g2-${game.game2.currentRound}`;
    const correct = r.isLukey ? 'lukey' : 'guest';
    const pSnap   = await getDocs(playersCol());
    for (const d of pSnap.docs) {
      const p   = d.data();
      const ans = p.answers?.[key];
      if (ans === undefined) continue;
      if (p.scored?.[key]  !== undefined) continue;
      const delta = ans === correct ? 10 : -5;
      await setDoc(PLAYER_DOC(p.name), {
        ...p, score:(p.score||0)+delta,
        scored:{...(p.scored||{}), [key]:delta},
      });
    }
    await setDoc(GAME_DOC(), updated);
  }

  async function nextG2() {
    const next = game.game2.currentRound + 1;
    if (next >= game.game2.rounds.length) {
      await setPhase('final');
      setConfetti(true);
      setTimeout(() => setConfetti(false), 5000);
    } else {
      await setDoc(GAME_DOC(), {...game, game2:{...game.game2, currentRound:next, revealed:false}});
    }
  }

  async function submitAnswer(key, value) {
    if (!myName) return;
    const p = players[myName];
    if (!p || p.answers?.[key] !== undefined) return;
    await setDoc(PLAYER_DOC(myName), {...p, answers:{...(p.answers||{}), [key]:value}});
  }

  async function reopenLobby() { await setPhase('lobby'); }

  async function resetEverything() {
    if (!confirm('Wipe everything — game, scores, facts, stories. Sure?')) return;
    setRole(null); setMyName(null);
    await deleteDoc(GAME_DOC());
    for (const f of factsPool)   await deleteDoc(FACT_DOC(f.id));
    for (const s of storiesPool) await deleteDoc(STORY_DOC(s.id));
    const pSnap = await getDocs(playersCol());
    for (const d of pSnap.docs) await deleteDoc(d.ref);
  }

  if (boot === 'loading') return (
    <div className="min-h-screen w-full flex items-center justify-center ff-body"
         style={{background:'var(--bg)',color:'var(--cream-2)'}}>
      <div className="text-sm tracking-widest uppercase">setting the table…</div>
    </div>
  );

  if (boot === 'first-time') return (
    <SplashHost pinSetup={pinSetup} setPinSetup={setPinSetup} onCreate={createGame} errMsg={errMsg}/>
  );

  if (boot === 'has-game' && !role) return (
    <JoinScreen
      nameInput={nameInput} setNameInput={setNameInput} onJoin={joinAsPlayer}
      showHostLogin={showHostLogin} setShowHostLogin={setShowHostLogin}
      hostPinInput={hostPinInput} setHostPinInput={setHostPinInput}
      onHostLogin={tryHostLogin} errMsg={errMsg}
      playerCount={Object.keys(players).length}
    />
  );

  return (
    <div className="min-h-screen w-full ff-body relative" style={{background:'var(--bg)',color:'var(--cream)'}}>
      <AmbientBg/>
      <Confetti show={confetti}/>
      <div className="relative z-10 max-w-2xl mx-auto px-5 py-8 sm:py-10">
        <Header role={role} myName={myName}
          onLogout={()=>{setRole(null);setMyName(null);}}
          onReset={resetEverything} onReopenLobby={reopenLobby}/>

        {game.phase==='lobby'   && <LobbyView game={game} players={players} role={role} myName={myName}
          factsPool={factsPool} storiesPool={storiesPool}
          onAddFact={addFact} onDeleteFact={deleteFact}
          onAddStory={addStory} onDeleteStory={deleteStory} onStart={startGame1}/>}

        {game.phase==='game1'   && <Game1View game={game} players={players} role={role} myName={myName}
          onSubmit={submitAnswer} onReveal={reveal1} onNext={nextG1}/>}

        {game.phase==='between' && <BetweenView game={game} players={players} role={role} myName={myName}
          storiesPool={storiesPool} onAddStory={addStory} onDeleteStory={deleteStory} onStart={startGame2}/>}

        {game.phase==='game2'   && <Game2View game={game} players={players} role={role} myName={myName}
          onSubmit={submitAnswer} onReveal={reveal2} onNext={nextG2}/>}

        {game.phase==='final'   && <FinalView game={game} players={players} role={role} myName={myName}/>}
      </div>
    </div>
  );
}

// ============================================================
// SPLASH (first-time host setup)
// ============================================================
function SplashHost({pinSetup,setPinSetup,onCreate,errMsg}) {
  return (
    <div className="min-h-screen w-full ff-body relative overflow-hidden" style={{background:'var(--bg)',color:'var(--cream)'}}>
      <AmbientBg/>
      <div className="relative z-10 max-w-xl mx-auto px-5 pt-16 sm:pt-24 pb-16 fade-up">
        <div className="text-center">
          <div className="flex justify-center mb-5">
            <div className="wiggle" style={{color:'var(--sun)'}}><Palm size={56}/></div>
          </div>
          <div className="tag mb-6"><Sparkle size={10}/> the host's setup</div>
          <h1 className="ff-display text-[44px] sm:text-[64px] leading-[0.95] mb-4">
            <span className="block" style={{color:'var(--cream)'}}>{HOST_NAME}'s</span>
            <span className="pink-shimmer block">Good Good</span>
            <span className="block" style={{color:'var(--jade)'}}>40th</span>
          </h1>
          <TikiOrnament className="my-6"/>
          <p className="text-base leading-relaxed max-w-sm mx-auto" style={{color:'var(--cream-2)'}}>
            Two games. However many mouths to feed. Guests can add their own facts on their phones. 🍹
          </p>
        </div>
        <div className="gg-card mt-10 scale-in" style={{animationDelay:'0.15s'}}>
          <div className="ff-display text-2xl mb-2">Set a host PIN</div>
          <p className="text-sm mb-5" style={{color:'var(--cream-2)'}}>
            So a tipsy guest can't hijack your show.
          </p>
          <input className="gg-input ff-num text-center tracking-[0.5em] mb-3"
            style={{fontSize:28}} value={pinSetup}
            onChange={e=>setPinSetup(e.target.value.replace(/\D/g,'').slice(0,4))}
            onKeyDown={e=>e.key==='Enter'&&onCreate()}
            placeholder="••••" inputMode="numeric" maxLength={4}/>
          {errMsg && <div className="text-sm mb-3" style={{color:'var(--coral)'}}>{errMsg}</div>}
          <button className="gg-btn gg-btn-primary w-full" onClick={onCreate} disabled={pinSetup.length!==4}>
            Open the lobby →
          </button>
        </div>
        <div className="text-center mt-8 text-xs tracking-widest uppercase" style={{color:'var(--cream-3)'}}>
          good good · good food · good lies
        </div>
      </div>
    </div>
  );
}

// ============================================================
// JOIN SCREEN
// ============================================================
function JoinScreen({nameInput,setNameInput,onJoin,showHostLogin,setShowHostLogin,hostPinInput,setHostPinInput,onHostLogin,errMsg,playerCount}) {
  return (
    <div className="min-h-screen w-full ff-body relative overflow-hidden" style={{background:'var(--bg)',color:'var(--cream)'}}>
      <AmbientBg/>
      <div className="relative z-10 max-w-md mx-auto px-5 pt-12 sm:pt-20 pb-16 fade-up">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4"><div className="wiggle" style={{color:'var(--sun)'}}><Palm size={48}/></div></div>
          <div className="tag mb-5">
            <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{background:'var(--pink)'}}/>
            {playerCount>0?`${playerCount} ${playerCount===1?'guest seated':'guests seated'}`:'now seating'}
          </div>
          <h1 className="ff-display text-[40px] sm:text-[56px] leading-[0.95] mb-3">
            <span className="block" style={{color:'var(--cream)'}}>{HOST_NAME}'s</span>
            <span className="pink-shimmer block">Good Good</span>
            <span className="block" style={{color:'var(--jade)'}}>40th</span>
          </h1>
          <TikiOrnament className="my-5"/>
        </div>
        {!showHostLogin ? (
          <>
            <div className="gg-card scale-in">
              <label className="block text-xs tracking-widest uppercase mb-2" style={{color:'var(--cream-3)'}}>Your name</label>
              <input className="gg-input mb-4" value={nameInput}
                onChange={e=>setNameInput(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&onJoin()}
                placeholder="What shall we call you?" maxLength={24}/>
              {errMsg && <div className="text-sm mb-3" style={{color:'var(--coral)'}}>{errMsg}</div>}
              <button className="gg-btn gg-btn-primary w-full" onClick={onJoin}>Take a seat 🍹</button>
            </div>
            <div className="text-center mt-7">
              <button className="text-xs tracking-widest uppercase" style={{color:'var(--cream-3)'}}
                onClick={()=>setShowHostLogin(true)}>Are you {HOST_NAME}? →</button>
            </div>
          </>
        ) : (
          <>
            <div className="gg-card scale-in">
              <label className="block text-xs tracking-widest uppercase mb-2" style={{color:'var(--cream-3)'}}>Host PIN</label>
              <input className="gg-input ff-num text-center tracking-[0.5em] mb-4"
                style={{fontSize:28}} value={hostPinInput}
                onChange={e=>setHostPinInput(e.target.value.replace(/\D/g,'').slice(0,4))}
                onKeyDown={e=>e.key==='Enter'&&onHostLogin()}
                placeholder="••••" inputMode="numeric" maxLength={4}/>
              {errMsg && <div className="text-sm mb-3" style={{color:'var(--coral)'}}>{errMsg}</div>}
              <button className="gg-btn gg-btn-primary w-full" onClick={onHostLogin}>Enter →</button>
            </div>
            <div className="text-center mt-7">
              <button className="text-xs tracking-widest uppercase" style={{color:'var(--cream-3)'}}
                onClick={()=>setShowHostLogin(false)}>← I'm just a guest</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// HEADER
// ============================================================
function Header({role,myName,onLogout,onReset,onReopenLobby}) {
  const [menuOpen,setMenuOpen]=useState(false);
  return (
    <div className="flex items-center justify-between mb-7 fade-up">
      <div className="min-w-0 flex-1">
        <div className="ff-display text-2xl sm:text-3xl leading-none truncate" style={{color:'var(--cream)'}}>
          {HOST_NAME}'s <span style={{color:'var(--pink)'}}>Good Good</span> 40th
        </div>
        <div className="text-xs tracking-widest uppercase mt-1.5 flex items-center gap-2" style={{color:'var(--cream-3)'}}>
          {role==='host'
            ? <><Sparkle size={9} style={{color:'var(--sun)'}}/> host · {HOST_NAME}</>
            : <><span className="w-1 h-1 rounded-full" style={{background:'var(--jade)'}}/> guest · {myName}</>}
        </div>
      </div>
      <div className="relative ml-3">
        <button onClick={()=>setMenuOpen(!menuOpen)}
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{border:'1px solid var(--hairline)',color:'var(--pink)'}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-2 w-56 rounded-xl overflow-hidden z-30 scale-in"
               style={{background:'var(--ink-2)',border:'1px solid var(--hairline)'}}>
            <button onClick={()=>{setMenuOpen(false);onLogout();}}
              className="w-full text-left px-4 py-3 text-sm hover:bg-black/30" style={{color:'var(--cream)'}}>
              Switch identity
            </button>
            {role==='host' && <>
              <div className="hairline"/>
              <button onClick={()=>{setMenuOpen(false);onReopenLobby();}}
                className="w-full text-left px-4 py-3 text-sm hover:bg-black/30" style={{color:'var(--cream)'}}>
                Return to lobby
              </button>
              <div className="hairline"/>
              <button onClick={()=>{setMenuOpen(false);onReset();}}
                className="w-full text-left px-4 py-3 text-sm hover:bg-black/30" style={{color:'var(--coral)'}}>
                Reset everything
              </button>
            </>}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// LOBBY VIEW
// ============================================================
function LobbyView({game,players,role,myName,factsPool,storiesPool,onAddFact,onDeleteFact,onAddStory,onDeleteStory,onStart}) {
  const playerList   = Object.values(players).sort((a,b)=>a.joinedAt-b.joinedAt);
  const lucasFacts   = factsPool.filter(f=>f.isLucas);
  const guestFacts   = factsPool.filter(f=>!f.isLucas);
  const possibleRounds = Math.min(Math.floor(guestFacts.length/2),lucasFacts.length);
  const canStart     = possibleRounds>=1;

  return (
    <div className="fade-up">
      <div className="text-center mb-8">
        <div className="tag mb-5">
          <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{background:'var(--pink)'}}/>
          {role==='host' ? 'lobby open · gathering content' : `you're in · waiting for ${HOST_NAME}`}
        </div>
        <h1 className="ff-display text-4xl sm:text-5xl leading-[0.95] mb-3">
          {role==='host'
            ? <>The pool's <span style={{color:'var(--pink)'}}>filling up</span></>
            : <>You're <span style={{color:'var(--jade)'}}>seated</span> 🍹</>}
        </h1>
        <p className="text-sm max-w-sm mx-auto" style={{color:'var(--cream-2)'}}>
          {role==='host'
            ? "Add your own facts and stories, or your guests can too."
            : `Drop in some facts and a story while ${HOST_NAME} wrangles everyone.`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-6">
        <StatCard label={`${HOST_NAME}'s facts`} count={lucasFacts.length}       color="var(--pink)"/>
        <StatCard label="Guest facts"            count={guestFacts.length}        color="var(--jade)"/>
        <StatCard label="Stories"                count={storiesPool.length}        color="var(--sun)"/>
      </div>

      {role==='host'
        ? <HostSubmissionPanel factsPool={factsPool} storiesPool={storiesPool}
            onAddFact={onAddFact} onDeleteFact={onDeleteFact}
            onAddStory={onAddStory} onDeleteStory={onDeleteStory}/>
        : <GuestSubmissionPanel myName={myName}
            factsPool={factsPool} storiesPool={storiesPool}
            onAddFact={onAddFact} onDeleteFact={onDeleteFact}
            onAddStory={onAddStory} onDeleteStory={onDeleteStory}/>}

      <div className="gg-card mb-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs tracking-widest uppercase" style={{color:'var(--cream-3)'}}>At the table</div>
          <div className="ff-num text-2xl" style={{color:'var(--pink)'}}>{playerList.length}</div>
        </div>
        {playerList.length===0
          ? <div className="text-center py-4 text-sm" style={{color:'var(--cream-3)'}}>nobody yet…</div>
          : <div className="grid grid-cols-2 gap-2">
              {playerList.map(p=>(
                <div key={p.name} className="px-3 py-2 rounded-lg text-sm flex items-center gap-2"
                  style={{
                    background: p.name===myName?'rgba(255,94,158,0.12)':'var(--ink-2)',
                    border:'1px solid '+(p.name===myName?'var(--pink)':'transparent'),
                    color: p.name===myName?'var(--pink-bright)':'var(--cream)',
                  }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{background:'var(--jade)'}}/>
                  <span className="truncate">{p.name}</span>
                </div>
              ))}
            </div>}
      </div>

      {role==='host' && (
        <>
          {canStart
            ? <div className="text-center mb-3 text-xs" style={{color:'var(--cream-3)'}}>
                ↳ {possibleRounds} round{possibleRounds===1?'':'s'} possible from current pool
              </div>
            : <div className="text-center mb-3 text-sm px-4" style={{color:'var(--coral)'}}>
                {GAME1_TITLE} needs at least 2 guest facts and 1 {HOST_NAME} fact
              </div>}
          <button className="gg-btn gg-btn-primary w-full" onClick={onStart} disabled={!canStart} style={{padding:'18px'}}>
            Start Game 1: {GAME1_TITLE} →
          </button>
        </>
      )}
    </div>
  );
}

function StatCard({label,count,color}) {
  return (
    <div className="rounded-2xl p-3 text-center" style={{background:'var(--ink)',border:'1px solid var(--hairline)'}}>
      <div className="ff-num text-3xl" style={{color}}>{count}</div>
      <div className="text-[10px] tracking-widest uppercase mt-1" style={{color:'var(--cream-3)'}}>{label}</div>
    </div>
  );
}

function TabBtn({active,onClick,children}) {
  return (
    <button onClick={onClick} className="flex-1 py-2 rounded-full text-sm font-semibold transition-all"
      style={{background:active?'var(--pink)':'transparent',color:active?'white':'var(--cream-2)'}}>
      {children}
    </button>
  );
}

function HostSubmissionPanel({factsPool,storiesPool,onAddFact,onDeleteFact,onAddStory,onDeleteStory}) {
  const [openTab,setOpenTab]=useState('facts');
  return (
    <div className="gg-card">
      <div className="flex gap-2 mb-5 p-1 rounded-full" style={{background:'var(--bg-2)'}}>
        <TabBtn active={openTab==='facts'} onClick={()=>setOpenTab('facts')}>
          Facts <span className="ml-1.5 ff-num text-xs opacity-70">({factsPool.length})</span>
        </TabBtn>
        <TabBtn active={openTab==='stories'} onClick={()=>setOpenTab('stories')}>
          Stories <span className="ml-1.5 ff-num text-xs opacity-70">({storiesPool.length})</span>
        </TabBtn>
      </div>
      {openTab==='facts'   && <FactsManager   pool={factsPool}   onAdd={onAddFact}   onDelete={onDeleteFact}   hostMode/>}
      {openTab==='stories' && <StoriesManager pool={storiesPool} onAdd={onAddStory} onDelete={onDeleteStory} hostMode/>}
    </div>
  );
}

function GuestSubmissionPanel({myName,factsPool,storiesPool,onAddFact,onDeleteFact,onAddStory,onDeleteStory}) {
  const [openTab,setOpenTab]=useState('fact');
  const myFacts   = factsPool.filter(f=>!f.isLucas&&f.submittedBy===myName);
  const myStories = storiesPool.filter(s=>!s.isLucas&&s.submittedBy===myName);
  return (
    <div className="gg-card">
      <div className="flex gap-2 mb-5 p-1 rounded-full" style={{background:'var(--bg-2)'}}>
        <TabBtn active={openTab==='fact'} onClick={()=>setOpenTab('fact')}>
          Add a fact <span className="ml-1.5 ff-num text-xs opacity-70">({myFacts.length})</span>
        </TabBtn>
        <TabBtn active={openTab==='story'} onClick={()=>setOpenTab('story')}>
          Add a story <span className="ml-1.5 ff-num text-xs opacity-70">({myStories.length})</span>
        </TabBtn>
      </div>
      {openTab==='fact'  && <GuestFactForm  myName={myName} myFacts={myFacts}     onAddFact={onAddFact}     onDeleteFact={onDeleteFact}/>}
      {openTab==='story' && <GuestStoryForm myName={myName} myStories={myStories} onAddStory={onAddStory}   onDeleteStory={onDeleteStory}/>}
    </div>
  );
}

function FactsManager({pool,onAdd,onDelete,hostMode}) {
  const [text,setText]           = useState('');
  const [isLucas,setIsLucas]     = useState(!!hostMode);
  const [attribution,setAttr]    = useState('');
  const submit = async () => {
    if (!text.trim()) return;
    await onAdd({text, isLucas, attribution:attribution.trim()||undefined});
    setText(''); setAttr('');
  };
  return (
    <div>
      <div className="text-xs tracking-widest uppercase mb-3" style={{color:'var(--cream-3)'}}>
        {hostMode?'Add a fact to the pool':'Add a fact about yourself'}
      </div>
      {hostMode && (
        <div className="flex gap-2 mb-3">
          <button onClick={()=>setIsLucas(true)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{border:'2px solid '+(isLucas?'var(--pink)':'var(--hairline)'),background:isLucas?'rgba(255,94,158,0.12)':'transparent',color:isLucas?'var(--pink-bright)':'var(--cream-2)'}}>
            Mine ({HOST_NAME})
          </button>
          <button onClick={()=>setIsLucas(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{border:'2px solid '+(!isLucas?'var(--jade)':'var(--hairline)'),background:!isLucas?'rgba(94,234,212,0.1)':'transparent',color:!isLucas?'var(--jade)':'var(--cream-2)'}}>
            From a guest
          </button>
        </div>
      )}
      <textarea className="gg-input mb-2" rows={2}
        placeholder={hostMode&&!isLucas?"A guest's fact…":`A fact about ${HOST_NAME}…`}
        value={text} onChange={e=>setText(e.target.value)}/>
      {hostMode && !isLucas && (
        <input className="gg-input mb-2 text-sm" placeholder="Whose fact? (optional)"
          value={attribution} onChange={e=>setAttr(e.target.value)} maxLength={24}/>
      )}
      <button className="gg-btn gg-btn-primary w-full mb-5" onClick={submit} disabled={!text.trim()}>
        + Add to pool
      </button>
      {pool.length>0 && <>
        <div className="jade-line mb-3"/>
        <div className="text-xs tracking-widest uppercase mb-2" style={{color:'var(--cream-3)'}}>In the pool</div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {pool.map(item=><PoolItemRow key={item.id} item={item} onDelete={()=>onDelete(item.id)}/>)}
        </div>
      </>}
    </div>
  );
}

function StoriesManager({pool,onAdd,onDelete,hostMode}) {
  const [text,setText]        = useState('');
  const [isLucas,setIsLucas]  = useState(!!hostMode);
  const [attribution,setAttr] = useState('');
  const submit = async () => {
    if (!text.trim()) return;
    await onAdd({text, isLucas, attribution:attribution.trim()||undefined});
    setText(''); setAttr('');
  };
  return (
    <div>
      <div className="text-xs tracking-widest uppercase mb-3" style={{color:'var(--cream-3)'}}>
        {hostMode?'Add a celebrity story':'Your celebrity story'}
      </div>
      {hostMode && (
        <div className="flex gap-2 mb-3">
          <button onClick={()=>setIsLucas(true)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{border:'2px solid '+(isLucas?'var(--pink)':'var(--hairline)'),background:isLucas?'rgba(255,94,158,0.12)':'transparent',color:isLucas?'var(--pink-bright)':'var(--cream-2)'}}>
            Mine ({HOST_NAME})
          </button>
          <button onClick={()=>setIsLucas(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{border:'2px solid '+(!isLucas?'var(--jade)':'var(--hairline)'),background:!isLucas?'rgba(94,234,212,0.1)':'transparent',color:!isLucas?'var(--jade)':'var(--cream-2)'}}>
            From a guest
          </button>
        </div>
      )}
      <textarea className="gg-input mb-2" rows={3} placeholder="The celebrity encounter…"
        value={text} onChange={e=>setText(e.target.value)}/>
      {hostMode && !isLucas && (
        <input className="gg-input mb-2 text-sm" placeholder="Whose story? (optional)"
          value={attribution} onChange={e=>setAttr(e.target.value)} maxLength={24}/>
      )}
      <button className="gg-btn gg-btn-primary w-full mb-5" onClick={submit} disabled={!text.trim()}>
        + Add to pool
      </button>
      {pool.length>0 && <>
        <div className="jade-line mb-3"/>
        <div className="text-xs tracking-widest uppercase mb-2" style={{color:'var(--cream-3)'}}>In the pool</div>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {pool.map(item=><PoolItemRow key={item.id} item={item} onDelete={()=>onDelete(item.id)}/>)}
        </div>
      </>}
    </div>
  );
}

function GuestFactForm({myName,myFacts,onAddFact,onDeleteFact}) {
  const [text,setText]=useState('');
  const submit=async()=>{ if(!text.trim())return; await onAddFact({text,isLucas:false,attribution:myName}); setText(''); };
  return (
    <div>
      <div className="text-xs tracking-widest uppercase mb-3" style={{color:'var(--cream-3)'}}>
        Submit a fact about yourself · for game one
      </div>
      <textarea className="gg-input mb-2" rows={2}
        placeholder="Something interesting / weird / unexpected about you…"
        value={text} onChange={e=>setText(e.target.value)}/>
      <button className="gg-btn gg-btn-primary w-full mb-4" onClick={submit} disabled={!text.trim()}>
        + Throw it in the pool
      </button>
      {myFacts.length>0 && <>
        <div className="jade-line mb-3"/>
        <div className="text-xs tracking-widest uppercase mb-2" style={{color:'var(--cream-3)'}}>your facts</div>
        <div className="space-y-2">
          {myFacts.map(item=><PoolItemRow key={item.id} item={item} onDelete={()=>onDeleteFact(item.id)}/>)}
        </div>
      </>}
    </div>
  );
}

function GuestStoryForm({myName,myStories,onAddStory,onDeleteStory}) {
  const [text,setText]=useState('');
  const submit=async()=>{ if(!text.trim())return; await onAddStory({text,isLucas:false,attribution:myName}); setText(''); };
  return (
    <div>
      <div className="text-xs tracking-widest uppercase mb-3" style={{color:'var(--cream-3)'}}>
        Your celebrity story · for game two
      </div>
      <p className="text-xs mb-3" style={{color:'var(--cream-3)'}}>
        That time you ran into someone famous. {HOST_NAME} won't see who it's from until the reveal.
      </p>
      <textarea className="gg-input mb-2" rows={3} placeholder="The story…"
        value={text} onChange={e=>setText(e.target.value)}/>
      <button className="gg-btn gg-btn-primary w-full mb-4" onClick={submit} disabled={!text.trim()}>
        + Throw it in the pool
      </button>
      {myStories.length>0 && <>
        <div className="jade-line mb-3"/>
        <div className="text-xs tracking-widest uppercase mb-2" style={{color:'var(--cream-3)'}}>your stories</div>
        <div className="space-y-2">
          {myStories.map(item=><PoolItemRow key={item.id} item={item} onDelete={()=>onDeleteStory(item.id)}/>)}
        </div>
      </>}
    </div>
  );
}

function PoolItemRow({item,onDelete}) {
  const cls='pool-item '+(item.isLucas?'pool-item-lucas':'pool-item-jade');
  return (
    <div className={cls+' flex items-start gap-3'}>
      <div className="flex-1 min-w-0">
        <div style={{color:'var(--cream)'}}>{item.text}</div>
        <div className="text-[10px] tracking-widest uppercase mt-1.5"
             style={{color:item.isLucas?'var(--pink)':'var(--jade)'}}>
          {item.isLucas?`${HOST_NAME}'s`:`from ${item.submittedBy}`}
        </div>
      </div>
      {onDelete && (
        <button onClick={onDelete}
          className="flex-shrink-0 text-[10px] tracking-widest uppercase opacity-50 hover:opacity-100 transition-opacity"
          style={{color:'var(--coral)'}}>remove</button>
      )}
    </div>
  );
}

// ============================================================
// GAME 1 — Two Truths & a Lukey
// ============================================================
function Game1View({game,players,role,myName,onSubmit,onReveal,onNext}) {
  const round    = game.game1.rounds[game.game1.currentRound];
  const total    = game.game1.rounds.length;
  const cur      = game.game1.currentRound;
  const revealed = game.game1.revealed;
  const key      = `g1-${cur}`;
  const me       = myName?players[myName]:null;
  const myAnswer = me?.answers?.[key];
  const myDelta  = me?.scored?.[key];
  const totalP   = Object.keys(players).length;
  const answered = countAnswers(players,key);
  if (!round) return null;

  return (
    <div className="fade-up" key={key}>
      <RoundHeader title={GAME1_TITLE} game="01" round={cur+1} total={total} accentVar="--pink"/>
      <div className="text-center mb-7">
        <p className="ff-display text-2xl sm:text-3xl" style={{color:'var(--cream)'}}>
          {revealed
            ? <>The <span style={{color:'var(--lime)'}}>truth</span>, revealed</>
            : <>Which one is <span style={{color:'var(--pink)'}}>{HOST_NAME}</span>?</>}
        </p>
      </div>

      <div className="space-y-3 mb-6">
        {round.facts.map((f,i)=>{
          const isMine=i===round.lukeyIndex;
          let cls='gg-choice';
          if (revealed) { if(isMine) cls+=' correct'; else if(myAnswer===i) cls+=' wrong'; }
          else if (myAnswer===i) cls+=' selected';
          const disabled=revealed||myAnswer!==undefined||role==='host';
          return (
            <button key={i} className={cls} disabled={disabled} onClick={()=>onSubmit(key,i)}>
              <div className="gg-letter">{String.fromCharCode(65+i)}</div>
              <div className="flex-1">
                <div>{f}</div>
                {revealed&&isMine && (
                  <div className="text-xs tracking-widest uppercase mt-2 flex items-center gap-1.5" style={{color:'var(--lime)'}}>
                    <Sparkle size={9}/> {HOST_NAME}'s
                  </div>
                )}
                {!revealed&&role==='host'&&isMine && (
                  <div className="text-[10px] tracking-widest uppercase mt-1.5" style={{color:'var(--pink-deep)',opacity:0.7}}>
                    · yours (host only)
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {!revealed && (
        <div className="flex items-center justify-between mb-6 px-2 text-xs tracking-widest uppercase" style={{color:'var(--cream-3)'}}>
          <span>{answered} / {totalP} answered</span>
          {myAnswer!==undefined&&role!=='host' && <span style={{color:'var(--pink)'}}>locked in 🔒</span>}
        </div>
      )}

      {revealed&&role!=='host'&&me && <ScoreReveal delta={myDelta} score={me.score}/>}

      {role==='host' && (
        <div className="flex gap-3 mt-6">
          {!revealed
            ? <button className="gg-btn gg-btn-primary flex-1" onClick={onReveal}>Reveal answer →</button>
            : <button className="gg-btn gg-btn-primary flex-1" onClick={onNext}>
                {cur+1<total?'Next round →':`On to ${GAME2_TITLE} →`}
              </button>}
        </div>
      )}
      {revealed && <LiveLeaderboard players={players} myName={myName}/>}
    </div>
  );
}

// ============================================================
// BETWEEN GAMES
// ============================================================
function BetweenView({game,players,role,myName,storiesPool,onAddStory,onDeleteStory,onStart}) {
  const sorted = Object.values(players).sort((a,b)=>(b.score||0)-(a.score||0));
  return (
    <div className="fade-up">
      <div className="text-center mb-7">
        <div className="tag tag-jade mb-5">intermission 🍹</div>
        <h1 className="ff-display text-4xl sm:text-5xl leading-[0.95] mb-3" style={{color:'var(--cream)'}}>
          End of <span style={{color:'var(--pink)'}}>game one</span>
        </h1>
        <TikiOrnament className="my-5"/>
        <p className="text-sm max-w-sm mx-auto" style={{color:'var(--cream-2)'}}>
          A pause for sips. Up next — <span style={{color:'var(--jade)'}}>{GAME2_TITLE}</span> ✨
        </p>
      </div>
      <div className="gg-card mb-5">
        <div className="text-xs tracking-widest uppercase mb-3" style={{color:'var(--cream-3)'}}>standings so far</div>
        <Standings sorted={sorted} highlight={myName}/>
      </div>
      {role==='host'
        ? <details className="gg-card mb-5">
            <summary className="cursor-pointer text-sm font-semibold" style={{color:'var(--jade)'}}>
              + Add more stories before we start ({storiesPool.length} in pool)
            </summary>
            <div className="mt-4"><StoriesManager pool={storiesPool} onAdd={onAddStory} onDelete={onDeleteStory} hostMode/></div>
          </details>
        : <details className="gg-card mb-5">
            <summary className="cursor-pointer text-sm font-semibold" style={{color:'var(--jade)'}}>
              + Add another story before round two
            </summary>
            <div className="mt-4">
              <GuestStoryForm myName={myName}
                myStories={storiesPool.filter(s=>!s.isLucas&&s.submittedBy===myName)}
                onAddStory={onAddStory} onDeleteStory={onDeleteStory}/>
            </div>
          </details>}
      {role==='host' && (
        <button className="gg-btn gg-btn-jade w-full" onClick={onStart} style={{padding:'18px'}} disabled={!storiesPool.length}>
          {!storiesPool.length?'Need at least 1 story':`Start ${GAME2_TITLE} →`}
        </button>
      )}
    </div>
  );
}

// ============================================================
// GAME 2 — Lucas is a Starfucker!
// ============================================================
function Game2View({game,players,role,myName,onSubmit,onReveal,onNext}) {
  const round    = game.game2.rounds[game.game2.currentRound];
  const total    = game.game2.rounds.length;
  const cur      = game.game2.currentRound;
  const revealed = game.game2.revealed;
  const key      = `g2-${cur}`;
  const me       = myName?players[myName]:null;
  const myAnswer = me?.answers?.[key];
  const myDelta  = me?.scored?.[key];
  const totalP   = Object.keys(players).length;
  const answered = countAnswers(players,key);
  if (!round) return null;
  const correctAnswer = round.isLukey?'lukey':'guest';

  return (
    <div className="fade-up" key={key}>
      <RoundHeader title={GAME2_TITLE} game="02" round={cur+1} total={total} accentVar="--jade"/>
      <div className="gg-card mb-7" style={{background:'linear-gradient(135deg,var(--ink),var(--ink-2))',borderColor:'rgba(94,234,212,0.3)'}}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs tracking-widest uppercase flex items-center gap-1.5" style={{color:'var(--jade)'}}>
            <Sparkle size={9}/> the story
          </div>
          {!revealed&&role==='host' && (
            <div className="text-[10px] tracking-widest uppercase" style={{color:'var(--pink-deep)',opacity:0.75}}>
              answer: {round.isLukey?'yours':"a guest's"}
            </div>
          )}
        </div>
        <p className="ff-display text-lg sm:text-xl leading-relaxed" style={{color:'var(--cream)'}}>
          "{round.story}"
        </p>
      </div>

      <div className="text-center mb-5">
        <p className="ff-display text-2xl sm:text-3xl" style={{color:'var(--cream)'}}>
          {revealed
            ? <>The <span style={{color:'var(--lime)'}}>truth</span></>
            : <><span style={{color:'var(--pink)'}}>{HOST_NAME_FORMAL}'s</span> — or a guest's?</>}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          {val:'lukey', label:HOST_NAME,  subtle:'tap if it was the host', accent:'var(--pink)'},
          {val:'guest', label:'A guest',  subtle:"tap if it wasn't",        accent:'var(--jade)'},
        ].map(opt=>{
          let cls='gg-choice flex-col text-center items-center';
          const correct=opt.val===correctAnswer;
          if(revealed){if(correct)cls+=' correct';else if(myAnswer===opt.val)cls+=' wrong';}
          else if(myAnswer===opt.val) cls+=' selected';
          const disabled=revealed||myAnswer!==undefined||role==='host';
          return (
            <button key={opt.val} className={cls} disabled={disabled}
              onClick={()=>onSubmit(key,opt.val)} style={{padding:'24px 14px',minHeight:130}}>
              <div className="ff-display text-2xl mb-1"
                   style={{color:revealed&&correct?'var(--lime)':opt.accent}}>
                {opt.label}
              </div>
              <div className="text-[10px] tracking-widest uppercase" style={{color:'var(--cream-3)'}}>
                {opt.subtle}
              </div>
            </button>
          );
        })}
      </div>

      {!revealed && (
        <div className="flex items-center justify-between mb-6 px-2 text-xs tracking-widest uppercase" style={{color:'var(--cream-3)'}}>
          <span>{answered} / {totalP} answered</span>
          {myAnswer!==undefined&&role!=='host' && <span style={{color:'var(--jade)'}}>locked in 🔒</span>}
        </div>
      )}

      {revealed&&role!=='host'&&me && <ScoreReveal delta={myDelta} score={me.score}/>}

      {role==='host' && (
        <div className="flex gap-3 mt-6">
          {!revealed
            ? <button className="gg-btn gg-btn-jade flex-1" onClick={onReveal}>Reveal answer →</button>
            : <button className="gg-btn gg-btn-jade flex-1" onClick={onNext}>
                {cur+1<total?'Next story →':'See final standings →'}
              </button>}
        </div>
      )}
      {revealed && <LiveLeaderboard players={players} myName={myName}/>}
    </div>
  );
}

// ============================================================
// FINAL VIEW
// ============================================================
function FinalView({players,myName}) {
  const sorted = Object.values(players).sort((a,b)=>(b.score||0)-(a.score||0));
  const winner = sorted[0];
  const me     = myName?players[myName]:null;
  const myRank = me?sorted.findIndex(p=>p.name===me.name)+1:null;
  return (
    <div className="fade-up">
      <div className="text-center mb-8">
        <div className="tag tag-sun mb-5"><Sparkle size={10}/> the night concludes</div>
        <h1 className="ff-display text-4xl sm:text-6xl leading-[0.92] mb-3">
          <span className="block" style={{color:'var(--cream)'}}>and the</span>
          <span className="pink-shimmer block">winner is</span>
        </h1>
      </div>
      {winner && (
        <div className="gg-card text-center mb-6 scale-in"
          style={{background:'linear-gradient(135deg,rgba(255,94,158,0.18),rgba(251,191,36,0.08))',borderColor:'var(--pink)',borderWidth:2}}>
          <div className="text-5xl mb-3">👑</div>
          <div className="ff-display text-4xl mb-2" style={{color:'var(--cream)'}}>{winner.name}</div>
          <div className="ff-num text-3xl" style={{color:'var(--sun)'}}>{winner.score} pts</div>
        </div>
      )}
      {me&&myRank&&myRank>1 && (
        <div className="gg-card text-center mb-5 scale-in" style={{animationDelay:'0.2s'}}>
          <div className="text-xs tracking-widest uppercase mb-2" style={{color:'var(--cream-3)'}}>You finished</div>
          <div className="ff-display text-3xl" style={{color:'var(--cream)'}}>#{myRank} · {me.score} pts</div>
        </div>
      )}
      <div className="gg-card mb-5">
        <div className="text-xs tracking-widest uppercase mb-3" style={{color:'var(--cream-3)'}}>final standings</div>
        <Standings sorted={sorted} highlight={myName}/>
      </div>
      <TikiOrnament className="mt-8"/>
      <div className="text-center mt-3 text-xs tracking-widest uppercase" style={{color:'var(--cream-3)'}}>
        thanks for celebrating with {HOST_NAME} 🌴
      </div>
    </div>
  );
}

// ============================================================
// Shared UI helpers
// ============================================================
function RoundHeader({title,game,round,total,accentVar}) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs tracking-widest uppercase" style={{color:'var(--cream-3)'}}>
          Game {game} · Round {round} of {total}
        </div>
        <div className="ff-num text-xs" style={{color:`var(${accentVar})`}}>
          {String(round).padStart(2,'0')} / {String(total).padStart(2,'0')}
        </div>
      </div>
      <div className="ff-display text-2xl sm:text-3xl mb-2" style={{color:`var(${accentVar})`}}>{title}</div>
      <div className="hairline"/>
    </div>
  );
}

function ScoreReveal({delta,score}) {
  if (delta===undefined) return (
    <div className="gg-card text-center mb-4 scale-in">
      <div className="text-xs tracking-widest uppercase mb-1" style={{color:'var(--cream-3)'}}>You didn't answer this round</div>
    </div>
  );
  const correct=delta>0;
  return (
    <div className="gg-card text-center mb-4"
      style={{background:correct?'rgba(163,230,53,0.08)':'rgba(251,113,133,0.06)',borderColor:correct?'var(--lime)':'rgba(251,113,133,0.4)'}}>
      <div className="text-xs tracking-widest uppercase mb-2 flex items-center justify-center gap-1.5"
           style={{color:correct?'var(--lime)':'var(--coral)'}}>
        {correct?<><Sparkle size={9}/> correct</>:'mistaken'}
      </div>
      <div className="ff-display text-5xl pop-up" style={{color:correct?'var(--lime)':'var(--coral)'}}>
        {correct?'+':''}{delta}
      </div>
      <div className="text-sm mt-1" style={{color:'var(--cream-2)'}}>
        Total: <span className="ff-num" style={{color:'var(--cream)'}}>{score}</span>
      </div>
    </div>
  );
}

function LiveLeaderboard({players,myName}) {
  const sorted=Object.values(players).sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,5);
  if (!sorted.length) return null;
  return (
    <div className="gg-card mt-6 scale-in">
      <div className="text-xs tracking-widest uppercase mb-3 flex items-center gap-1.5" style={{color:'var(--cream-3)'}}>
        <Sparkle size={9} style={{color:'var(--sun)'}}/> top of the leaderboard
      </div>
      <Standings sorted={sorted} highlight={myName}/>
    </div>
  );
}

function Standings({sorted,highlight}) {
  return (
    <div className="space-y-2">
      {sorted.map((p,i)=>{
        const isMe=p.name===highlight;
        const medal=i===0?'👑':i===1?'🥈':i===2?'🥉':null;
        return (
          <div key={p.name} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
            style={{background:isMe?'rgba(255,94,158,0.1)':'transparent',border:'1px solid '+(isMe?'var(--hairline-strong)':'transparent')}}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="ff-num text-base w-6 text-center" style={{color:i<3?'var(--sun)':'var(--cream-3)'}}>
                {medal||(i+1)}
              </div>
              <div className="truncate" style={{color:isMe?'var(--pink-bright)':'var(--cream)'}}>
                {p.name}{isMe?' (you)':''}
              </div>
            </div>
            <div className="ff-num text-base flex-shrink-0" style={{color:i<3?'var(--sun)':'var(--cream-2)'}}>{p.score||0}</div>
          </div>
        );
      })}
    </div>
  );
}