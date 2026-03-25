import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Chess } from "chess.js";
import { getBestMove } from "./utils/stockfish.js";
import { aiChat } from "./utils/aiChat.js";
import { MODELS, PLAYER_LEVELS, getLevel, ACHIEVEMENTS, calcScore, INIT_LB } from "./utils/gameData.js";
import { loadProfile, saveProfile, defaultProfile, recordGame, syncToNeon, fetchGlobalLeaderboard } from "./utils/playerDB.js";
import ProfilePage from "./components/ProfilePage.jsx";

/* ─────────────────────────── CONSTANTS ───────────────────────────── */
const FILES = ["a","b","c","d","e","f","g","h"];
const RANKS = [8,7,6,5,4,3,2,1];
const GLYPHS = { wK:"♔",wQ:"♕",wR:"♖",wB:"♗",wN:"♘",wP:"♙", bK:"♚",bQ:"♛",bR:"♜",bB:"♝",bN:"♞",bP:"♟" };

/* ─────────────────────────── ROOT APP ────────────────────────────── */
export default function App() {
  /* screens: onboard | home | select | intro | game | over */
  const [screen, setScreen]   = useState(() => loadProfile() ? "home" : "onboard");
  const [model,  setModel]    = useState(MODELS[0]);
  const [userKey, setUserKey] = useState(() => localStorage.getItem("ca_key") || "");

  /* unified profile */
  const [profile, setProfile]       = useState(() => loadProfile() || defaultProfile("Player"));
  const [showProfile, setShowProfile] = useState(false);
  const [onboardName, setOnboardName] = useState("");

  /* chess state */
  const [chess]     = useState(() => new Chess());
  const [fen, setFen]               = useState(chess.fen());
  const [sel, setSel]               = useState(null);
  const [legal, setLegal]           = useState([]);
  const [lastMove, setLastMove]     = useState(null);
  const [thinking, setThinking]     = useState(false);
  const [history, setHistory]       = useState([]);
  const [result, setResult]         = useState(null);
  const [shake, setShake]           = useState(false);

  /* AI speech */
  const [speech, setSpeech]         = useState("");
  const [speechKey, setSpeechKey]   = useState(0);
  const [aiLoading, setAiLoading]   = useState(false);

  /* derive stats from profile */
  const xp       = profile.xp || 0;
  const streak   = profile.currentStreak || 0;
  const lossRun  = profile.lossStreak || 0;
  const totalPts = profile.totalScore || 0;
  const games    = profile.totalGames || 0;
  const wins     = profile.totalWins || 0;
  const unlocked = useMemo(() => new Set(profile.achievements || []), [profile.achievements]);
  const [lb, setLb]                 = useState(INIT_LB);
  const [newAchs, setNewAchs]       = useState([]);
  const [popups, setPopups]         = useState([]);
  const [breakdown, setBreakdown]   = useState(null);
  const [moveCount, setMoveCount]   = useState(0);
  const [lbTab, setLbTab]           = useState("players"); // players | ai | ach
  const [usedBYOK, setUsedBYOK]    = useState(false);

  const tRef     = useRef(false);  // thinking ref
  const startRef = useRef(null);
  const moveRef  = useRef(0);

  const lvl = useMemo(() => getLevel(xp), [xp]);

  /* persist profile to localStorage whenever it changes */
  useEffect(() => { saveProfile(profile); }, [profile]);
  useEffect(() => { if (userKey) localStorage.setItem("ca_key", userKey); else localStorage.removeItem("ca_key"); }, [userKey]);

  /* ── helpers ── */
  const say = useCallback((text) => { setSpeech(text); setSpeechKey(k=>k+1); }, []);

  const popup = useCallback((text, color="#facc15") => {
    const id = Date.now()+Math.random();
    setPopups(p=>[...p,{id,text,color}]);
    setTimeout(()=>setPopups(p=>p.filter(x=>x.id!==id)), 2000);
  }, []);

  const checkAchs = useCallback((state) => {
    const gained = ACHIEVEMENTS.filter(a => !unlocked.has(a.id) && a.check(state));
    if (!gained.length) return;
    // Update profile achievements
    setProfile(p => {
      const newAchs = [...new Set([...(p.achievements||[]), ...gained.map(a=>a.id)])];
      const xpBonus = gained.reduce((s,a)=>s+a.xp, 0);
      return { ...p, achievements: newAchs, xp: (p.xp||0) + xpBonus };
    });
    setNewAchs(gained);
    gained.forEach(a => popup(`🏆 ${a.name}  +${a.xp} XP`, "#facc15"));
    setTimeout(()=>setNewAchs([]), 4500);
  }, [unlocked, popup]);

  /* ── end game ── */
  const endGame = useCallback(async (res, finalMoves) => {
    if (tRef.current) { tRef.current = false; setThinking(false); }
    const elapsed = startRef.current ? (Date.now()-startRef.current)/1000 : 999;
    const isWin = res === "win";

    setResult(res);
    setScreen("over");
    setGames(g=>g+1);

    let bd = { base:0,speed:0,eff:0,strk:0,total:0 };
    if (isWin) {
      bd = calcScore({ model, moves:finalMoves, seconds:elapsed, streak });
      setBreakdown(bd);
      popup(`+${bd.total.toLocaleString()} pts`, model.color);
      if ((streak+1)>1) popup(`🔥 ${streak+1} STREAK!`, "#ef4444");
    } else {
      setBreakdown(null);
    }

    // Update profile in one atomic operation
    setProfile(prev => {
      const updated = recordGame(prev, {
        modelId:   model.id,
        modelName: model.name,
        result:    res,
        score:     bd.total,
        moves:     finalMoves,
        seconds:   Math.round(elapsed),
      });
      // Update local leaderboard
      const lvInfo = getLevel(updated.xp);
      setLb(lb => {
        const you = { name: updated.username, pts: updated.totalScore, wins: updated.totalWins,
          lvl: lvInfo.cur.lvl, apex: updated.defeatedApex || model.tierNum===6, streak: updated.currentStreak };
        return [...lb.filter(e=>e.name!==updated.username), you].sort((a,b)=>b.pts-a.pts).slice(0,8);
      });
      return updated;
    });

    // Check achievements with updated state
    const newStreak = isWin ? streak+1 : 0;
    const newLoss   = isWin ? 0 : lossRun+1;
    checkAchs({ wins: isWin?wins+1:wins, games:games+1, streak:newStreak, lossRun:newLoss,
      lastWin:isWin, lastSec:elapsed, lastMoves:finalMoves, lastTier:model.tierNum, usedBYOK });

    // Async: sync to Neon (never blocks)
    syncToNeon(profile, { result:res, score:bd.total, modelId:model.id, modelName:model.name });

    setAiLoading(true);
    aiChat({ type:"analysis", modelId:model.id, data:{ result:res, moves:finalMoves }, userKey: userKey||null })
      .then(t=>{ if(t) say(t); setAiLoading(false); });
  }, [model, streak, lossRun, xp, wins, games, totalPts, userKey, popup, checkAchs, say, profile]);

  /* ── player move ── */
  const handleSq = useCallback(async (sq) => {
    if (screen !== "game" || tRef.current || chess.turn() !== "w") return;
    const piece = chess.get(sq);

    if (sel) {
      const mv = legal.find(m=>m.to===sq);
      if (mv) {
        chess.move(mv);
        const newFen = chess.fen();
        const newCount = moveRef.current + 1;
        moveRef.current = newCount;
        setFen(newFen);
        setLastMove({from:mv.from,to:mv.to});
        setHistory(h=>[...h,{...mv,color:"w"}]);
        setMoveCount(newCount);
        setSel(null); setLegal([]);

        /* check animation */
        if (chess.inCheck()) { setShake(true); setTimeout(()=>setShake(false),500); }
        if (chess.isGameOver()) { endGame(chess.isCheckmate()?"win":"draw", newCount); return; }

        /* fire commentary async — never awaits */
        if (newCount % 3 === 0) {
          setAiLoading(true);
          aiChat({ type:"react", modelId:model.id, data:{ move:mv.san, n:newCount, check:chess.inCheck(), capture:mv.flags.includes("c") }, userKey:userKey||null })
            .then(t=>{ if(t) say(t); setAiLoading(false); });
        }

        /* Chess Engine */
        tRef.current = true; setThinking(true);
        try {
          const aim = await getBestMove(newFen, model.depth, model.skill, chess);
          if (!aim) return;
          try { chess.move(aim); } catch { chess.move({...aim,promotion:"q"}); }
          const n2 = newCount+1;
          moveRef.current = n2;
          setFen(chess.fen());
          setLastMove({from:aim.from,to:aim.to});
          setHistory(h=>[...h,{from:aim.from,to:aim.to,san:`${aim.from}-${aim.to}`,color:"b"}]);
          setMoveCount(n2);
          if (chess.inCheck()) { setShake(true); setTimeout(()=>setShake(false),500); }
          if (chess.isGameOver()) { endGame(chess.isCheckmate()?"lose":"draw", n2); return; }
        } finally { tRef.current = false; setThinking(false); }
        return;
      }
      if (piece?.color==="w") { setSel(sq); setLegal(chess.moves({square:sq,verbose:true})); return; }
      setSel(null); setLegal([]);
      return;
    }
    if (piece?.color==="w") { setSel(sq); setLegal(chess.moves({square:sq,verbose:true})); }
  }, [screen, chess, sel, legal, model, userKey, endGame, say]);

  /* ── start battle ── */
  const startBattle = useCallback(async (m) => {
    setModel(m);
    chess.reset(); setFen(chess.fen());
    setSel(null); setLegal([]); setLastMove(null); setHistory([]);
    setResult(null); setBreakdown(null); setMoveCount(0); moveRef.current=0;
    tRef.current=false; startRef.current=Date.now();
    setScreen("intro");
    setSpeech(""); setAiLoading(true);
    if (userKey) setUsedBYOK(true);
    aiChat({ type:"taunt", modelId:m.id, userKey:userKey||null })
      .then(t=>{ say(t||m.taunt); setAiLoading(false); });
    setTimeout(()=>setScreen("game"), 3200);
  }, [chess, userKey, say]);

  const resign = useCallback(() => { if(screen==="game") endGame("lose", moveRef.current); }, [screen, endGame]);

  /* board helpers */
  const validSet   = useMemo(()=>new Set(legal.map(m=>m.to)),   [legal]);
  const captureSet = useMemo(()=>new Set(legal.filter(m=>m.flags.includes("c")||m.flags.includes("e")).map(m=>m.to)), [legal]);

  function getPiece(f,r) { return chess.board()[8-r]?.[FILES.indexOf(f)]||null; }
  function sqCls(f,r) {
    const sq=`${f}${r}`, fi=FILES.indexOf(f), ri=RANKS.indexOf(r);
    const light=(fi+ri)%2===0, p=getPiece(f,r);
    const kingCheck = chess.inCheck()&&p?.type==="k"&&p?.color===chess.turn();
    return ["sq",light?"sq-l":"sq-d", sel===sq&&"sq-sel", (lastMove?.from===sq||lastMove?.to===sq)&&sel!==sq&&"sq-last",
      validSet.has(sq)&&!captureSet.has(sq)&&"sq-dot", captureSet.has(sq)&&"sq-cap", kingCheck&&"sq-check"].filter(Boolean).join(" ");
  }

  const myRankIdx = lb.findIndex(e=>e.name==="You");

  /* ─── RENDER ─── */
  const handleOnboard = () => {
    const name = onboardName.trim().replace(/[^a-zA-Z0-9_]/g,"").slice(0,20) || "Player";
    const fresh = defaultProfile(name);
    setProfile(fresh);
    setScreen("home");
  };

  const handleRename = (newName) => {
    const name = newName.trim().replace(/[^a-zA-Z0-9_]/g,"").slice(0,20) || profile.username;
    setProfile(p => ({ ...p, username: name }));
  };

  return (
    <div className="app">
      <Particles />
      {popups.map(p=><Popup key={p.id} text={p.text} color={p.color}/>)}
      {newAchs.map(a=><AchToast key={a.id} ach={a}/>)}

      {/* Profile button — always visible except onboard */}
      {screen !== "onboard" && (
        <button className="profile-btn" onClick={()=>setShowProfile(true)}
          title={`${profile.username} · ${getLevel(xp).cur.name}`}>
          <span className="pb-avatar" style={{background:`${getLevel(xp).cur.color}33`,color:getLevel(xp).cur.color}}>
            {profile.username[0]?.toUpperCase()}
          </span>
          <span className="pb-name">{profile.username}</span>
          <span className="pb-level" style={{color:getLevel(xp).cur.color}}>{getLevel(xp).cur.name}</span>
        </button>
      )}

      {/* Profile modal */}
      {showProfile && (
        <ProfilePage
          profile={profile}
          unlocked={unlocked}
          onClose={()=>setShowProfile(false)}
          onRename={handleRename}
        />
      )}

      {/* ONBOARD */}
      {screen==="onboard" && (
        <OnboardScreen
          name={onboardName}
          onChange={setOnboardName}
          onStart={handleOnboard}
        />
      )}

      {/* HOME */}
      {screen==="home" && (
        <HomeScreen
          lvl={lvl} xp={xp} streak={streak} totalPts={totalPts}
          userKey={userKey} onKeyChange={setUserKey}
          lb={lb} lbTab={lbTab} onLbTab={setLbTab}
          unlocked={unlocked} wins={wins} games={games}
          myRankIdx={myRankIdx}
          onSelectModel={()=>setScreen("select")}
        />
      )}

      {/* MODEL SELECT */}
      {screen==="select" && (
        <SelectScreen
          userKey={userKey} onKeyChange={setUserKey}
          onStart={startBattle}
          onBack={()=>setScreen("home")}
        />
      )}

      {/* BATTLE INTRO */}
      {screen==="intro" && (
        <IntroScreen model={model} speech={speech} aiLoading={aiLoading}/>
      )}

      {/* GAME */}
      {(screen==="game"||screen==="over") && (
        <GameScreen
          model={model} speech={speech} speechKey={speechKey} aiLoading={aiLoading}
          chess={chess} fen={fen} shake={shake}
          FILES={FILES} RANKS={RANKS} GLYPHS={GLYPHS}
          sqCls={sqCls} getPiece={getPiece} validSet={validSet} captureSet={captureSet}
          onSq={handleSq} thinking={thinking}
          history={history} screen={screen} result={result} breakdown={breakdown}
          streak={streak} moveCount={moveCount}
          lb={lb} lbTab={lbTab} onLbTab={setLbTab}
          lvl={lvl} xp={xp} totalPts={totalPts} myRankIdx={myRankIdx}
          onResign={resign}
          onPlayAgain={()=>startBattle(model)}
          onHome={()=>setScreen("home")}
          onSelectNew={()=>setScreen("select")}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   SCREENS
═══════════════════════════════════════════════════ */

/* ── HOME ── */
function HomeScreen({ lvl, xp, streak, totalPts, userKey, onKeyChange, lb, lbTab, onLbTab, unlocked, wins, games, myRankIdx, onSelectModel }) {
  return (
    <div className="home-screen">
      <div className="home-hero">
        <div className="hero-badge">AI BATTLE ROYALE</div>
        <h1 className="hero-title">CHESS<br/><span>ARENA</span></h1>
        <p className="hero-sub">Challenge AI models. Climb the leaderboard. Prove your worth.</p>
        <button className="btn-play" onClick={onSelectModel}>
          <span>⚔</span> ENTER THE ARENA
        </button>
        <div className="hero-stats">
          <HeroStat icon="🏆" val={totalPts.toLocaleString()} label="Points"/>
          <HeroStat icon="🔥" val={streak||"—"} label="Streak"/>
          <HeroStat icon="⚔️" val={`${wins}W`} label={`${games} games`}/>
          <HeroStat icon="📊" val={myRankIdx>=0?`#${myRankIdx+1}`:"—"} label="Rank"/>
        </div>
      </div>

      <div className="home-side">
        {/* Player card */}
        <div className="player-hud">
          <div className="ph-avatar" style={{background:`${lvl.cur.color}22`,border:`2px solid ${lvl.cur.color}66`}}>
            {lvl.cur.name[0]}
          </div>
          <div className="ph-info">
            <div className="ph-level" style={{color:lvl.cur.color}}>{lvl.cur.name}</div>
            <div className="ph-xp">{xp.toLocaleString()} XP</div>
            <div className="xp-bar"><div className="xp-fill" style={{width:`${lvl.pct}%`,background:lvl.cur.color}}/></div>
            {lvl.nxt&&<div className="ph-next">{Math.round(lvl.nxt.xp-xp)} XP to {lvl.nxt.name}</div>}
          </div>
        </div>

        {/* BYOK */}
        <BYOKPanel userKey={userKey} onChange={onKeyChange}/>

        {/* Tabs */}
        <Tabs value={lbTab} onChange={onLbTab} tabs={[{id:"players",label:"👥 Players"},{id:"ai",label:"🤖 AI Ranks"},{id:"ach",label:"🏆 Trophies"}]}/>
        {lbTab==="players" && <LBPanel lb={lb}/>}
        {lbTab==="ai"      && <AIRanks/>}
        {lbTab==="ach"     && <AchGrid unlocked={unlocked}/>}
      </div>
    </div>
  );
}
function HeroStat({icon,val,label}) {
  return <div className="hero-stat"><span className="hs-icon">{icon}</span><span className="hs-val">{val}</span><span className="hs-label">{label}</span></div>;
}

/* ── SELECT ── */
function SelectScreen({ userKey, onKeyChange, onStart, onBack }) {
  const [hov, setHov] = useState(null);
  return (
    <div className="select-screen">
      <div className="sel-header">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <h2 className="sel-title">Choose Your Opponent</h2>
        <BYOKPanel userKey={userKey} onChange={onKeyChange} compact/>
      </div>
      <div className="model-grid">
        {MODELS.map((m,i)=>(
          <ModelCard key={m.id} model={m} hovered={hov===m.id}
            onHover={()=>setHov(m.id)} onLeave={()=>setHov(null)}
            onPlay={()=>onStart(m)}
            style={{animationDelay:`${i*0.06}s`}}
          />
        ))}
      </div>
    </div>
  );
}

/* ── MODEL CARD ── */
function ModelCard({model:m, hovered, onHover, onLeave, onPlay, style}) {
  const wr = Math.round(m.wins/(m.wins+m.losses+m.draws)*100);
  return (
    <div className="mcard" onMouseEnter={onHover} onMouseLeave={onLeave}
      style={{...style,"--c":m.color,"--g":m.glow,"--b":m.bg, animationName:"cardIn"}}
      data-active={hovered}>
      <div className="mc-tier" style={{color:m.color}}>{m.tier.toUpperCase()} · {m.mult}×</div>
      <div className="mc-top">
        <span className="mc-avatar">{m.avatar}</span>
        <div>
          <div className="mc-label" style={{color:m.color}}>{m.label}</div>
          <div className="mc-name">{m.name}</div>
          <div className="mc-provider">{m.provider}</div>
        </div>
        <div className="mc-elo">{m.elo}<span>ELO</span></div>
      </div>
      <div className="mc-taunt">"{m.taunt}"</div>
      <div className="mc-stats">
        <div className="mc-stat"><span>{m.wins.toLocaleString()}</span>Wins</div>
        <div className="mc-stat"><span>{wr}%</span>Win Rate</div>
        <div className="mc-stat"><span>{m.depth}</span>Depth</div>
        <div className="mc-stat"><span>{m.skill}/20</span>Skill</div>
      </div>
      <div className="mc-bar"><div style={{width:`${wr}%`}}/></div>
      <button className="mc-btn" onClick={onPlay}>
        Challenge {m.name} <span>{m.mult}×</span>
      </button>
    </div>
  );
}

/* ── INTRO ── */
function IntroScreen({model:m, speech, aiLoading}) {
  return (
    <div className="intro-screen" style={{"--c":m.color,"--g":m.glow}}>
      <div className="intro-card">
        <div className="intro-vs">BATTLE STARTS</div>
        <div className="intro-avatar">{m.avatar}</div>
        <div className="intro-label" style={{color:m.color}}>{m.label}</div>
        <div className="intro-name">{m.name}</div>
        <div className="intro-provider">{m.provider} · Elo {m.elo}</div>
        <div className="intro-divider" style={{background:m.color}}/>
        <div className="intro-speech">
          {aiLoading ? <Dots color={m.color}/> : speech||m.taunt}
        </div>
        <div className="intro-mult" style={{color:m.color}}>{m.mult}× Score Multiplier</div>
        <div className="intro-bar"><div className="intro-bar-fill" style={{background:m.color}}/></div>
      </div>
    </div>
  );
}

/* ── GAME ── */
function GameScreen({model:m,speech,speechKey,aiLoading,chess,fen,shake,FILES,RANKS,GLYPHS,sqCls,getPiece,validSet,captureSet,onSq,thinking,history,screen,result,breakdown,streak,moveCount,lb,lbTab,onLbTab,lvl,xp,totalPts,myRankIdx,onResign,onPlayAgain,onHome,onSelectNew}) {
  return (
    <div className="game-screen" style={{"--c":m.color,"--g":m.glow,"--b":m.bg}}>
      {/* LEFT */}
      <aside className="g-aside">
        <div className="g-model-badge">
          <span className="gmb-avatar">{m.avatar}</span>
          <div>
            <div className="gmb-label" style={{color:m.color}}>{m.label}</div>
            <div className="gmb-sub">{m.name} · {m.provider}</div>
          </div>
          <div className="gmb-mult" style={{color:m.color}}>{m.mult}×</div>
        </div>

        {/* Speech bubble */}
        <div className="speech-bubble" key={speechKey} style={{borderColor:`${m.color}40`,background:m.bg}}>
          <span className="sb-avatar">{m.avatar}</span>
          <div className="sb-text">{aiLoading?<Dots color={m.color}/>:speech||m.taunt}</div>
        </div>

        <Tabs value={lbTab} onChange={onLbTab} tabs={[{id:"players",label:"👥"},{id:"ai",label:"🤖"},{id:"ach",label:"🏆"}]} small/>
        {lbTab==="players" && <LBPanel lb={lb} compact/>}
        {lbTab==="ai"      && <AIRanks compact/>}
        {lbTab==="ach"     && <AchGrid unlocked={new Set()} compact/>}
      </aside>

      {/* CENTER */}
      <main className="g-main">
        {/* top bar */}
        <div className="g-topbar">
          <div className="g-opp">
            <span>{m.avatar}</span>
            <div>
              <div style={{fontFamily:"var(--fmono)",fontSize:"0.75rem",color:m.color}}>{m.name}</div>
              <div style={{fontSize:"0.62rem",color:"var(--t3)"}}>Elo {m.elo}</div>
            </div>
          </div>
          {screen==="game" && (
            <div className="g-status">
              {thinking ? (
                <span className="status-thinking" style={{color:m.color}}>
                  {m.name} calculating <Dots color={m.color} inline/>
                </span>
              ) : chess.inCheck() ? (
                <span className="status-check">⚠ CHECK!</span>
              ) : (
                <span className="status-idle">Your move</span>
              )}
            </div>
          )}
          {screen==="game" && (
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span className="move-badge">Move {Math.ceil(moveCount/2)}</span>
              <button className="btn-resign" onClick={onResign}>Resign</button>
            </div>
          )}
          {screen==="over" && (
            <div className="g-result" style={{color:result==="win"?"var(--gold)":result==="lose"?"#ef4444":"var(--t2)"}}>
              {result==="win"?"VICTORY ✓":result==="lose"?"DEFEATED":"DRAW"}
            </div>
          )}
        </div>

        {/* BOARD */}
        <div className={`board-wrap ${shake?"board-shake":""}`}>
          <div className="board-ranks">
            {RANKS.map(r=><div key={r} className="coord">{r}</div>)}
          </div>
          <div>
            <div className="board" style={{opacity:screen==="over"?0.6:1}}>
              {RANKS.map(rank=>FILES.map(file=>{
                const sq=`${file}${rank}`;
                const p=getPiece(file,rank);
                const pk=p?`${p.color==="w"?"w":"b"}${p.type.toUpperCase()}`:null;
                const isDot=validSet.has(sq)&&!captureSet.has(sq);
                const isCap=captureSet.has(sq);
                return (
                  <div key={sq} className={sqCls(file,rank)} onClick={()=>onSq(sq)}>
                    {pk&&<span className={`piece ${p.color==="b"?"pb":""}`}>{GLYPHS[pk]}</span>}
                    {isDot&&<span className="dot"/>}
                    {isCap&&<span className="ring"/>}
                  </div>
                );
              }))}
            </div>
            <div className="board-files">{FILES.map(f=><div key={f} className="coord">{f}</div>)}</div>
          </div>
        </div>

        {/* bottom bar: player */}
        <div className="g-bottombar">
          <div className="g-player">
            <div className="gp-avatar" style={{background:`${lvl.cur.color}22`,border:`2px solid ${lvl.cur.color}55`,color:lvl.cur.color}}>
              {lvl.cur.name[0]}
            </div>
            <div>
              <div style={{fontFamily:"var(--fmono)",fontSize:"0.75rem",color:"var(--t1)"}}>You</div>
              <div style={{fontSize:"0.62rem",color:lvl.cur.color}}>{lvl.cur.name}</div>
            </div>
          </div>
          <div className="xp-bar" style={{width:160}}>
            <div className="xp-fill" style={{width:`${lvl.pct}%`,background:lvl.cur.color}}/>
          </div>
          <div style={{fontFamily:"var(--fmono)",fontSize:"0.7rem",color:"var(--gold)"}}>
            {totalPts.toLocaleString()} pts
          </div>
          {streak>0&&<div className="streak-badge">🔥 {streak}</div>}
        </div>

        {/* Move log */}
        {history.length>0&&(
          <div className="movelog">
            {history.filter(h=>h.color==="w").map((wm,i)=>{
              const bm=history[i*2+1];
              return <span key={i} className="ml-pair">
                <span className="ml-n">{i+1}.</span>
                <span className="ml-w">{wm.san||`${wm.from}${wm.to}`}</span>
                {bm&&<span className="ml-b">{bm.san||`${bm.from}${bm.to}`}</span>}
              </span>;
            })}
          </div>
        )}
      </main>

      {/* RIGHT */}
      <aside className="g-aside-r">
        <div className="aside-title">Match Stats</div>
        <StatRow icon="⚔️" label="Moves" val={moveCount}/>
        <StatRow icon="🔥" label="Streak" val={streak||"—"}/>
        <StatRow icon="💎" label="Potential" val={`${(1000*m.mult).toFixed(0)} pts`}/>
        <StatRow icon="📈" label="Multiplier" val={`${m.mult}×`}/>

        {screen==="game"&&<div className="aside-title" style={{marginTop:16}}>All Models</div>}
        {screen==="game"&&MODELS.map(mo=>(
          <div key={mo.id} className="mini-model" style={{"--c":mo.color, opacity:mo.id===m.id?1:0.45}}>
            <span>{mo.avatar}</span>
            <div style={{flex:1}}>
              <div style={{fontFamily:"var(--fmono)",fontSize:"0.68rem",color:mo.color}}>{mo.name}</div>
              <div style={{fontSize:"0.58rem",color:"var(--t3)"}}>Elo {mo.elo}</div>
            </div>
            <div style={{fontFamily:"var(--fmono)",fontSize:"0.68rem",color:mo.color}}>{mo.mult}×</div>
          </div>
        ))}
      </aside>

      {/* GAME OVER OVERLAY */}
      {screen==="over"&&(
        <OverlayResult
          result={result} model={m} breakdown={breakdown}
          speech={speech} aiLoading={aiLoading}
          onPlayAgain={onPlayAgain} onHome={onHome} onSelectNew={onSelectNew}
        />
      )}
    </div>
  );
}

/* ── OVERLAY ── */
function OverlayResult({result,model:m,breakdown,speech,aiLoading,onPlayAgain,onHome,onSelectNew}) {
  return (
    <div className="overlay">
      <div className="ov" style={{"--c":m.color,"--g":m.glow}}>
        <div className="ov-avatar">{m.avatar}</div>
        <div className="ov-result" style={{color:result==="win"?"var(--gold)":result==="lose"?"#ef4444":"var(--t2)"}}>
          {result==="win"?"VICTORY":result==="lose"?"DEFEATED":"DRAW"}
        </div>
        <div className="ov-model" style={{color:m.color}}>{m.label} · {m.name}</div>
        <div className="ov-speech">{aiLoading?<Dots color={m.color}/>:`"${speech||m.taunt}"`}</div>

        {result==="win"&&breakdown&&(
          <div className="ov-score-block">
            <div className="ov-pts">{breakdown.total.toLocaleString()}</div>
            <div className="ov-pts-label">POINTS EARNED</div>
            <div className="ov-rows">
              <OvRow l={`Base × ${m.mult} multiplier`}    v={breakdown.base}/>
              {breakdown.speed>0&&<OvRow l="⚡ Speed bonus"       v={breakdown.speed}/>}
              {breakdown.eff>0  &&<OvRow l="♟ Efficiency bonus"   v={breakdown.eff}/>}
              {breakdown.strk>0 &&<OvRow l="🔥 Streak bonus"      v={breakdown.strk}/>}
            </div>
          </div>
        )}

        <div className="ov-actions">
          <button className="btn-play" onClick={onPlayAgain} style={{"--bc":m.color}}>
            Play Again
          </button>
          <button className="btn-secondary" onClick={onSelectNew}>New Opponent</button>
          <button className="btn-ghost" onClick={onHome}>Home</button>
        </div>
      </div>
    </div>
  );
}
function OvRow({l,v}) {
  return <div className="ov-row"><span>{l}</span><span>+{v.toLocaleString()}</span></div>;
}

/* ═══════════════════════════════════════════════════
   SHARED COMPONENTS
═══════════════════════════════════════════════════ */

function BYOKPanel({userKey, onChange, compact}) {
  const [show, setShow] = useState(false);
  return (
    <div className={`byok ${compact?"byok-compact":""}`}>
      <button className="byok-toggle" onClick={()=>setShow(s=>!s)}>
        🔑 {userKey?"Custom API Key ✓":"Bring Your Own Key (BYOK)"}
        <span>{show?"▲":"▼"}</span>
      </button>
      {show&&(
        <div className="byok-body">
          <p className="byok-info">
            Paste your <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">OpenRouter key</a> to use premium models or increase rate limits. Free models work without a key.
          </p>
          <div className="byok-input-wrap">
            <input
              className="byok-input"
              type="password"
              placeholder="sk-or-v1-..."
              value={userKey}
              onChange={e=>onChange(e.target.value)}
            />
            {userKey&&<button className="byok-clear" onClick={()=>onChange("")}>✕</button>}
          </div>
          <div className="byok-models">
            <span>Works with any OpenRouter model, including:</span>
            <code>openai/gpt-4o</code>
            <code>anthropic/claude-3.5-sonnet</code>
            <code>google/gemini-flash-1.5</code>
          </div>
        </div>
      )}
    </div>
  );
}

function Tabs({value, onChange, tabs, small}) {
  return (
    <div className={`tabs ${small?"tabs-sm":""}`}>
      {tabs.map(t=>(
        <button key={t.id} className={`tab ${value===t.id?"tab-on":""}`} onClick={()=>onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function LBPanel({lb, compact}) {
  const medals = ["🥇","🥈","🥉"];
  return (
    <div className="lb">
      {lb.map((e,i)=>(
        <div key={i} className={`lb-row ${e.name==="You"?"lb-you":""} ${compact?"lb-compact":""}`}>
          <span className="lb-rank">{i<3?medals[i]:`#${i+1}`}</span>
          <div className="lb-body">
            <div className="lb-name" style={e.name==="You"?{color:"var(--gold)"}:{}}>{e.name}{e.apex&&<span title="Defeated Apex">💀</span>}</div>
            {!compact&&<div className="lb-sub">{PLAYER_LEVELS.find(l=>l.lvl===e.lvl)?.name||"Pawn"}{e.streak>0&&` · 🔥${e.streak}`}</div>}
          </div>
          <div className="lb-pts">{e.pts.toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}

function AIRanks({compact}) {
  return (
    <div className="lb">
      {[...MODELS].reverse().map((m,i)=>{
        const wr=Math.round(m.wins/(m.wins+m.losses+m.draws)*100);
        return (
          <div key={m.id} className={`lb-row ${compact?"lb-compact":""}`} style={{"--c":m.color}}>
            <span className="lb-rank" style={{fontSize:"1rem"}}>{m.avatar}</span>
            <div className="lb-body">
              <div className="lb-name" style={{color:m.color}}>{m.name}</div>
              {!compact&&<div className="lb-sub">{m.provider} · Elo {m.elo}</div>}
            </div>
            <div>
              <div className="lb-pts" style={{color:m.color}}>{wr}%</div>
              {!compact&&<div style={{fontSize:"0.58rem",color:"var(--t3)",textAlign:"right"}}>{m.wins.toLocaleString()}W</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AchGrid({unlocked, compact}) {
  return (
    <div className={`ach-grid ${compact?"ach-compact":""}`}>
      {ACHIEVEMENTS.map(a=>{
        const on=unlocked.has(a.id);
        return (
          <div key={a.id} className={`ach-card ${on?"ach-on":""}`} title={`${a.name}: ${a.desc}`}>
            <div className="ach-icon">{a.icon}</div>
            {!compact&&<div className="ach-name">{a.name}</div>}
            {!compact&&<div className="ach-xp">+{a.xp} XP</div>}
          </div>
        );
      })}
    </div>
  );
}

function StatRow({icon,label,val}) {
  return (
    <div className="stat-row">
      <span>{icon} {label}</span>
      <span className="sr-val">{val}</span>
    </div>
  );
}

function Dots({color, inline}) {
  return (
    <span className={`dots ${inline?"dots-i":""}`}>
      {[0,1,2].map(i=><span key={i} className="dot-blink" style={{background:color||"var(--gold)",animationDelay:`${i*0.18}s`}}/>)}
    </span>
  );
}

function Popup({text,color}) {
  return <div className="popup" style={{color}}>{text}</div>;
}

function AchToast({ach}) {
  return (
    <div className="ach-toast">
      <span style={{fontSize:"1.6rem"}}>{ach.icon}</span>
      <div>
        <div className="at-title">Achievement Unlocked!</div>
        <div className="at-name">{ach.name}</div>
        <div className="at-xp">+{ach.xp} XP</div>
      </div>
    </div>
  );
}

/* ── Animated background particles ── */
function Particles() {
  const pts = useMemo(()=>Array.from({length:18},(_,i)=>({
    id:i,
    x: Math.random()*100,
    y: Math.random()*100,
    s: 0.3+Math.random()*0.7,
    d: 6+Math.random()*12,
    delay: Math.random()*8,
  })),[]);
  return (
    <div className="particles" aria-hidden>
      {pts.map(p=>(
        <div key={p.id} className="particle"
          style={{left:`${p.x}%`,top:`${p.y}%`,width:`${p.s*6}px`,height:`${p.s*6}px`,
            animationDuration:`${p.d}s`,animationDelay:`${p.delay}s`,opacity:p.s*0.4}}/>
      ))}
    </div>
  );
}

/* ── Onboard ── */
function OnboardScreen({ name, onChange, onStart }) {
  return (
    <div className="onboard">
      <div className="ob-card">
        <div className="ob-logo">♟</div>
        <h1 className="ob-title">Chess Arena</h1>
        <p className="ob-sub">AI Battle Royale — Challenge models, climb the leaderboard, prove your worth.</p>
        <div className="ob-form">
          <label className="ob-label">Choose your username</label>
          <input
            className="ob-input"
            placeholder="e.g. GrandMagnus99"
            value={name}
            onChange={e=>onChange(e.target.value.replace(/[^a-zA-Z0-9_]/g,"").slice(0,20))}
            onKeyDown={e=>e.key==="Enter"&&name.trim()&&onStart()}
            autoFocus maxLength={20}
          />
          <div className="ob-hint">Letters, numbers, underscores only · Max 20 chars</div>
        </div>
        <button className="btn-play ob-start" onClick={onStart} disabled={!name.trim()}>
          ⚔ Enter the Arena
        </button>
        <div className="ob-features">
          <span>🤖 6 AI models</span>
          <span>🏆 Achievements</span>
          <span>📊 Progress tracking</span>
          <span>🌍 Global leaderboard</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   GLOBAL STYLES
═══════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Russo+One&family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:     #08090f;
  --bg1:    #0e0f1a;
  --bg2:    #141526;
  --bg3:    #1c1d30;
  --bg4:    #22233a;
  --t1:     #eeeaf8;
  --t2:     #8884a8;
  --t3:     #504e6a;
  --gold:   #f5c542;
  --sq-l:   #e8d5a8;
  --sq-d:   #8b6b35;
  --fdis:   'Russo One', sans-serif;
  --fraj:   'Rajdhani', sans-serif;
  --fmono:  'Share Tech Mono', monospace;
  --ease:   cubic-bezier(.25,.46,.45,.94);
  --eback:  cubic-bezier(.34,1.56,.64,1);
}
html{-webkit-font-smoothing:antialiased}
body{background:var(--bg);color:var(--t1);font-family:var(--fraj);overflow-x:hidden;min-height:100vh}
a{color:inherit}
::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--t3);border-radius:2px}
::selection{background:rgba(245,197,66,.2)}

/* ANIMATIONS */
@keyframes fadeIn   {from{opacity:0}to{opacity:1}}
@keyframes slideUp  {from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideInR {from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
@keyframes cardIn   {from{opacity:0;transform:translateY(24px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes popIn    {0%{transform:scale(.5);opacity:0}65%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
@keyframes float    {0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes glow     {0%,100%{box-shadow:0 0 0 0 var(--g,transparent)}50%{box-shadow:0 0 20px 4px var(--g,transparent)}}
@keyframes blink    {0%,80%,100%{opacity:0}40%{opacity:1}}
@keyframes scoreUp  {0%{transform:translateY(0);opacity:1}100%{transform:translateY(-70px);opacity:0}}
@keyframes spin     {to{transform:rotate(360deg)}}
@keyframes shake    {0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
@keyframes barGrow  {from{width:0}to{width:100%}}
@keyframes particleFloat{0%,100%{transform:translateY(0) scale(1);opacity:var(--op,.3)}50%{transform:translateY(-30px) scale(1.2);opacity:calc(var(--op,.3)*.5)}}
@keyframes toastIn  {from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}
@keyframes introPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}

/* APP */
.app{min-height:100vh;display:flex;flex-direction:column;
  background:radial-gradient(ellipse 80% 50% at 50% -10%,rgba(100,50,200,.1) 0%,transparent 60%),
  radial-gradient(ellipse 60% 40% at 80% 80%,rgba(239,68,68,.05) 0%,transparent 50%), var(--bg)}

/* PARTICLES */
.particles{position:fixed;inset:0;pointer-events:none;z-index:0}
.particle{position:absolute;border-radius:50%;background:var(--gold);animation:particleFloat linear infinite}

/* POPUP */
.popup{position:fixed;right:28px;top:90px;font-family:var(--fdis);font-size:1.3rem;
  pointer-events:none;z-index:600;animation:scoreUp 2s ease forwards;
  text-shadow:0 0 20px currentColor;letter-spacing:.05em}

/* ACH TOAST */
.ach-toast{position:fixed;bottom:28px;right:28px;display:flex;align-items:center;gap:14px;
  background:var(--bg3);border:1px solid var(--gold);border-radius:10px;padding:16px 20px;z-index:600;
  box-shadow:0 8px 40px rgba(0,0,0,.8),0 0 20px rgba(245,197,66,.15);
  animation:toastIn .4s var(--eback) both}
.at-title{font-family:var(--fdis);font-size:.65rem;letter-spacing:.2em;color:var(--gold);margin-bottom:2px}
.at-name{font-family:var(--fraj);font-size:.9rem;font-weight:700;color:var(--t1)}
.at-xp{font-family:var(--fmono);font-size:.7rem;color:var(--gold);margin-top:2px}

/* ── HOME SCREEN ── */
.home-screen{display:grid;grid-template-columns:1fr 380px;min-height:100vh;gap:0;position:relative;z-index:1}
.home-hero{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 48px;gap:20px;
  background:radial-gradient(ellipse 70% 60% at 50% 40%,rgba(100,50,200,.12) 0%,transparent 70%)}
.hero-badge{font-family:var(--fmono);font-size:.65rem;letter-spacing:.4em;color:var(--gold);
  background:rgba(245,197,66,.1);border:1px solid rgba(245,197,66,.3);padding:5px 16px;border-radius:20px}
.hero-title{font-family:var(--fdis);font-size:clamp(3rem,8vw,6rem);line-height:.9;text-align:center;
  color:var(--t1);text-shadow:0 0 60px rgba(245,197,66,.2)}
.hero-title span{
  background:linear-gradient(135deg,#f5c542,#f97316,#ef4444);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  display:block;font-size:1.3em}
.hero-sub{font-size:1.1rem;color:var(--t2);text-align:center;max-width:400px;line-height:1.6}
.btn-play{font-family:var(--fdis);font-size:1rem;letter-spacing:.1em;padding:18px 48px;
  border-radius:6px;border:none;cursor:pointer;position:relative;overflow:hidden;
  background:linear-gradient(135deg,var(--bc,#f5c542),var(--bc2,#f97316));
  color:#0a0b14;transition:all .25s var(--ease)}
.btn-play::before{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(135deg,rgba(255,255,255,.2),transparent);opacity:0;transition:.2s}
.btn-play:hover{transform:translateY(-3px);box-shadow:0 10px 40px rgba(245,197,66,.4)}
.btn-play:hover::before{opacity:1}
.btn-play:active{transform:translateY(0)}
.hero-stats{display:flex;gap:28px;flex-wrap:wrap;justify-content:center}
.hero-stat{display:flex;flex-direction:column;align-items:center;gap:4px}
.hs-icon{font-size:1.4rem}
.hs-val{font-family:var(--fdis);font-size:1.2rem;color:var(--gold)}
.hs-label{font-family:var(--fmono);font-size:.6rem;color:var(--t3);letter-spacing:.12em;text-transform:uppercase}

.home-side{background:rgba(14,15,26,.8);border-left:1px solid rgba(255,255,255,.06);
  padding:24px 18px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;max-height:100vh}

/* PLAYER HUD */
.player-hud{display:flex;align-items:center;gap:12px;padding:14px;background:var(--bg2);
  border:1px solid rgba(255,255,255,.07);border-radius:8px}
.ph-avatar{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-family:var(--fdis);font-size:1.1rem;flex-shrink:0}
.ph-info{flex:1;min-width:0}
.ph-level{font-family:var(--fdis);font-size:.85rem;line-height:1}
.ph-xp{font-family:var(--fmono);font-size:.65rem;color:var(--t3);margin:3px 0}
.xp-bar{height:4px;background:var(--bg4);border-radius:2px;overflow:hidden}
.xp-fill{height:100%;border-radius:2px;transition:width .8s var(--ease)}
.ph-next{font-size:.6rem;color:var(--t3);margin-top:3px}

/* BYOK */
.byok{background:var(--bg2);border:1px solid rgba(255,255,255,.07);border-radius:8px;overflow:hidden}
.byok-compact{background:transparent;border:none}
.byok-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;padding:11px 14px;
  background:transparent;border:none;cursor:pointer;font-family:var(--fraj);font-size:.82rem;
  color:var(--t2);font-weight:600;transition:color .2s;gap:8px}
.byok-toggle:hover{color:var(--gold)}
.byok-body{padding:0 14px 14px;display:flex;flex-direction:column;gap:8px;animation:fadeIn .2s ease}
.byok-info{font-size:.75rem;color:var(--t3);line-height:1.5}
.byok-info a{color:var(--gold);text-decoration:none}
.byok-info a:hover{text-decoration:underline}
.byok-input-wrap{position:relative}
.byok-input{width:100%;background:var(--bg3);border:1px solid rgba(255,255,255,.1);border-radius:5px;
  padding:9px 36px 9px 12px;font-family:var(--fmono);font-size:.75rem;color:var(--t1);outline:none;
  transition:border-color .2s}
.byok-input:focus{border-color:var(--gold)}
.byok-clear{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;
  cursor:pointer;color:var(--t3);font-size:.9rem;padding:2px 4px}
.byok-clear:hover{color:var(--t1)}
.byok-models{display:flex;flex-wrap:wrap;gap:5px;align-items:center;font-size:.68rem;color:var(--t3)}
.byok-models code{background:var(--bg3);padding:2px 6px;border-radius:3px;font-family:var(--fmono);
  font-size:.62rem;color:var(--gold)}

/* TABS */
.tabs{display:flex;gap:3px}
.tabs-sm .tab{padding:6px 10px;font-size:.65rem}
.tab{font-family:var(--fraj);font-weight:600;font-size:.7rem;letter-spacing:.06em;padding:8px 14px;
  border-radius:5px;border:1px solid rgba(255,255,255,.07);background:transparent;
  color:var(--t3);cursor:pointer;transition:all .18s}
.tab:hover{color:var(--t2);border-color:rgba(255,255,255,.15)}
.tab-on{background:var(--bg3);color:var(--gold);border-color:rgba(245,197,66,.3)}

/* LB */
.lb{display:flex;flex-direction:column}
.lb-row{display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:8px;
  padding:9px 4px;border-bottom:1px solid rgba(255,255,255,.04);transition:background .15s}
.lb-row:last-child{border-bottom:none}
.lb-you{background:rgba(245,197,66,.05);border-radius:5px;padding:9px 8px}
.lb-compact{padding:6px 4px}
.lb-rank{font-size:.85rem;text-align:center}
.lb-name{font-family:var(--fmono);font-size:.75rem;color:var(--t1)}
.lb-name span{margin-left:4px;font-size:.7rem}
.lb-sub{font-size:.6rem;color:var(--t3);margin-top:1px}
.lb-pts{font-family:var(--fdis);font-size:.78rem;color:var(--gold);text-align:right;white-space:nowrap}

/* ACH */
.ach-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.ach-compact{grid-template-columns:repeat(5,1fr)}
.ach-card{background:var(--bg2);border:1px solid rgba(255,255,255,.06);border-radius:6px;padding:8px 4px;
  text-align:center;opacity:.3;filter:grayscale(.9);transition:all .2s;cursor:default}
.ach-on{opacity:1;filter:none;border-color:var(--gold);animation:popIn .5s var(--eback)}
.ach-icon{font-size:1.3rem;margin-bottom:3px}
.ach-name{font-family:var(--fraj);font-size:.58rem;font-weight:600;color:var(--t2)}
.ach-xp{font-family:var(--fmono);font-size:.55rem;color:var(--gold);margin-top:1px}

/* ── SELECT SCREEN ── */
.select-screen{min-height:100vh;display:flex;flex-direction:column;padding:24px 32px;gap:20px;position:relative;z-index:1}
.sel-header{display:flex;align-items:center;gap:20px;flex-wrap:wrap}
.sel-title{font-family:var(--fdis);font-size:1.5rem;color:var(--t1);flex:1}
.btn-back{font-family:var(--fraj);font-weight:700;font-size:.8rem;padding:10px 18px;background:transparent;
  border:1px solid rgba(255,255,255,.12);border-radius:5px;color:var(--t2);cursor:pointer;transition:all .2s;letter-spacing:.05em}
.btn-back:hover{color:var(--t1);border-color:rgba(255,255,255,.3)}

/* MODEL GRID */
.model-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;padding-bottom:32px}
.mcard{background:var(--bg1);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:18px;
  cursor:pointer;transition:all .22s var(--ease);position:relative;overflow:hidden;
  animation:cardIn .4s var(--ease) both}
.mcard::before{content:'';position:absolute;inset:0;border-radius:10px;pointer-events:none;
  background:radial-gradient(ellipse 80% 60% at 50% 0%,var(--b,transparent),transparent);opacity:0;transition:.3s}
.mcard[data-active=true]{border-color:var(--c);box-shadow:0 0 0 1px var(--c),0 12px 40px rgba(0,0,0,.7),0 0 30px var(--g)}
.mcard[data-active=true]::before{opacity:1}
.mcard:hover{transform:translateY(-4px);border-color:rgba(255,255,255,.18)}
.mc-tier{font-family:var(--fmono);font-size:.58rem;letter-spacing:.2em;margin-bottom:10px}
.mc-top{display:flex;align-items:flex-start;gap:12px;margin-bottom:10px}
.mc-avatar{font-size:2rem;flex-shrink:0;animation:float 3s ease-in-out infinite}
.mc-label{font-family:var(--fdis);font-size:.9rem;line-height:1.1;margin-bottom:2px}
.mc-name{font-family:var(--fmono);font-size:.78rem;color:var(--t2)}
.mc-provider{font-size:.65rem;color:var(--t3);margin-top:2px}
.mc-elo{margin-left:auto;text-align:right;font-family:var(--fdis);font-size:1.4rem;color:var(--t1);line-height:1}
.mc-elo span{display:block;font-family:var(--fmono);font-size:.55rem;color:var(--t3);text-align:right}
.mc-taunt{font-size:.78rem;color:var(--t2);font-style:italic;margin-bottom:12px;padding-left:4px;
  border-left:2px solid var(--c);padding-left:8px}
.mc-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin-bottom:12px}
.mc-stat{text-align:center;padding:6px 0;border-right:1px solid rgba(255,255,255,.05)}
.mc-stat:last-child{border-right:none}
.mc-stat span{display:block;font-family:var(--fdis);font-size:.95rem;color:var(--c)}
.mc-stat{font-size:.58rem;color:var(--t3);text-transform:uppercase;letter-spacing:.06em}
.mc-bar{height:3px;background:var(--bg3);border-radius:2px;overflow:hidden;margin-bottom:12px}
.mc-bar div{height:100%;background:linear-gradient(90deg,var(--bg3),var(--c));border-radius:2px;transition:width .6s var(--ease)}
.mc-btn{width:100%;font-family:var(--fdis);font-size:.78rem;letter-spacing:.08em;padding:12px;
  border-radius:6px;border:1px solid var(--c);background:var(--b,transparent);color:var(--c);
  cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:space-between}
.mc-btn:hover{background:var(--c);color:#080910}
.mc-btn span{font-size:1rem}

/* ── INTRO ── */
.intro-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;
  position:relative;z-index:1;
  background:radial-gradient(ellipse 60% 60% at 50% 50%,var(--g) 0%,transparent 65%);
  animation:fadeIn .35s ease}
.intro-card{background:rgba(14,15,26,.92);border:1px solid rgba(255,255,255,.1);border-top:3px solid var(--c);
  border-radius:14px;padding:52px 44px;text-align:center;max-width:460px;width:92%;
  box-shadow:0 0 60px var(--g),0 24px 80px rgba(0,0,0,.95);animation:slideUp .5s var(--eback)}
.intro-vs{font-family:var(--fmono);font-size:.6rem;letter-spacing:.4em;color:var(--t3);text-transform:uppercase;margin-bottom:20px}
.intro-avatar{font-size:4.5rem;display:block;margin-bottom:16px;animation:float 2s ease-in-out infinite}
.intro-label{font-family:var(--fdis);font-size:1.6rem;margin-bottom:4px;text-shadow:0 0 30px var(--c)}
.intro-name{font-family:var(--fmono);font-size:1rem;color:var(--t2);margin-bottom:2px}
.intro-provider{font-size:.72rem;color:var(--t3);margin-bottom:18px}
.intro-divider{height:2px;width:60%;margin:0 auto 18px;opacity:.4;border-radius:2px}
.intro-speech{font-family:var(--fraj);font-size:1.05rem;color:var(--t2);font-style:italic;line-height:1.6;min-height:2.4em;margin-bottom:18px}
.intro-mult{font-family:var(--fdis);font-size:.9rem;margin-bottom:22px}
.intro-bar{height:3px;background:var(--bg3);border-radius:2px;overflow:hidden}
.intro-bar-fill{height:100%;border-radius:2px;animation:barGrow 3.2s linear forwards}

/* ── GAME SCREEN ── */
.game-screen{display:grid;grid-template-columns:240px 1fr 200px;min-height:100vh;position:relative;z-index:1;
  animation:fadeIn .3s ease}
.g-aside{padding:16px 14px;background:rgba(14,15,26,.8);border-right:1px solid rgba(255,255,255,.05);
  display:flex;flex-direction:column;gap:10px;overflow-y:auto;max-height:100vh}
.g-aside-r{padding:16px 14px;background:rgba(14,15,26,.8);border-left:1px solid rgba(255,255,255,.05);
  display:flex;flex-direction:column;gap:6px;overflow-y:auto;max-height:100vh}
.g-model-badge{display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--b);
  border:1px solid rgba(var(--c),.25);border-radius:8px;border-left:3px solid var(--c)}
.gmb-avatar{font-size:1.6rem}
.gmb-label{font-family:var(--fdis);font-size:.78rem;color:var(--c)}
.gmb-sub{font-size:.62rem;color:var(--t3);margin-top:1px}
.gmb-mult{font-family:var(--fdis);font-size:1rem;color:var(--c);margin-left:auto}

.speech-bubble{padding:12px;border-radius:8px;border:1px solid;animation:slideInR .3s var(--ease);min-height:56px;
  display:flex;align-items:flex-start;gap:8px}
.sb-avatar{font-size:1.2rem;flex-shrink:0;margin-top:2px}
.sb-text{font-family:var(--fraj);font-size:.8rem;color:var(--t2);font-style:italic;line-height:1.5}

.aside-title{font-family:var(--fmono);font-size:.58rem;letter-spacing:.22em;color:var(--t3);text-transform:uppercase;
  padding-bottom:7px;border-bottom:1px solid rgba(255,255,255,.06)}

.g-main{display:flex;flex-direction:column;align-items:center;padding:16px 20px;gap:10px;
  background:radial-gradient(ellipse 50% 50% at 50% 50%,rgba(var(--c),.02) 0%,transparent 70%)}
.g-topbar{width:100%;max-width:520px;display:flex;align-items:center;gap:12px;
  background:var(--bg1);border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:10px 14px}
.g-opp{display:flex;align-items:center;gap:8px}
.g-status{flex:1;font-family:var(--fmono);font-size:.72rem;text-align:center}
.status-thinking{color:var(--t2)}
.status-check{color:#ef4444;font-family:var(--fdis);letter-spacing:.1em;animation:introPulse 1s ease infinite}
.status-idle{color:var(--t3)}
.g-result{font-family:var(--fdis);font-size:1rem;letter-spacing:.12em;margin-left:auto}
.move-badge{font-family:var(--fmono);font-size:.65rem;color:var(--t3);padding:5px 10px;background:var(--bg2);border-radius:4px}
.btn-resign{font-family:var(--fraj);font-weight:700;font-size:.65rem;letter-spacing:.08em;padding:7px 14px;
  background:transparent;border:1px solid rgba(239,68,68,.25);color:rgba(239,68,68,.7);border-radius:4px;cursor:pointer;transition:all .2s}
.btn-resign:hover{background:rgba(239,68,68,.1);color:#ef4444}

/* BOARD */
.board-wrap{display:flex;gap:5px;align-items:flex-start}
.board-shake{animation:shake .5s ease}
.board-ranks{display:flex;flex-direction:column;width:16px}
.coord{display:flex;align-items:center;justify-content:center;font-family:var(--fmono);font-size:.55rem;color:var(--t3)}
.board-ranks .coord{height:60px}
.board-files{display:flex}
.board-files .coord{width:60px}
.board{display:grid;grid-template-columns:repeat(8,60px);grid-template-rows:repeat(8,60px);
  border:2px solid rgba(255,255,255,.15);border-radius:3px;overflow:hidden;
  box-shadow:0 20px 70px rgba(0,0,0,.9),0 0 0 1px rgba(0,0,0,.5),0 0 40px rgba(var(--c),.05)}
.sq{width:60px;height:60px;display:flex;align-items:center;justify-content:center;
  position:relative;cursor:pointer;transition:background .1s}
.sq-l{background:var(--sq-l)}
.sq-d{background:var(--sq-d)}
.sq-l:hover{background:#f2e4bc}
.sq-d:hover{background:#a07c42}
.sq-sel{background:rgba(245,197,66,.75)!important;box-shadow:inset 0 0 0 2px rgba(255,255,255,.4)}
.sq-last{background:rgba(245,197,66,.28)!important}
.sq-check{background:rgba(239,68,68,.6)!important;animation:glow 1s ease-in-out infinite}
.piece{font-size:2.5rem;line-height:1;user-select:none;pointer-events:none;z-index:2;position:relative;
  filter:drop-shadow(0 2px 4px rgba(0,0,0,.8));transition:transform .1s}
.sq:hover .piece,.sq-sel .piece{transform:scale(1.08)}
.pb{filter:drop-shadow(0 2px 5px rgba(0,0,0,.95)) drop-shadow(0 0 2px rgba(0,0,0,.9))}
.dot{position:absolute;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,.24);pointer-events:none;z-index:1}
.ring{position:absolute;inset:5px;border-radius:50%;border:4px solid rgba(239,68,68,.4);pointer-events:none;z-index:1}

.g-bottombar{width:100%;max-width:520px;display:flex;align-items:center;gap:10px;
  background:var(--bg1);border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:10px 14px}
.gp-avatar{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-family:var(--fdis);font-size:.85rem;flex-shrink:0}
.streak-badge{font-family:var(--fdis);font-size:.75rem;padding:4px 10px;background:rgba(239,68,68,.15);
  border:1px solid rgba(239,68,68,.3);border-radius:4px;color:#ef4444;margin-left:auto}
.movelog{width:100%;max-width:520px;background:var(--bg1);border:1px solid rgba(255,255,255,.06);
  border-radius:7px;padding:8px 12px;display:flex;flex-wrap:wrap;gap:2px 10px;max-height:68px;overflow-y:auto}
.ml-pair{display:flex;align-items:center;gap:3px}
.ml-n{font-family:var(--fmono);font-size:.6rem;color:var(--t3)}
.ml-w{font-family:var(--fmono);font-size:.68rem;color:var(--t1)}
.ml-b{font-family:var(--fmono);font-size:.68rem;color:var(--t3)}

/* STAT ROW */
.stat-row{display:flex;justify-content:space-between;align-items:center;padding:7px 4px;
  border-bottom:1px solid rgba(255,255,255,.04);font-size:.76rem;color:var(--t2)}
.stat-row:last-of-type{border-bottom:none}
.sr-val{font-family:var(--fdis);font-size:.8rem;color:var(--gold)}
.mini-model{display:flex;align-items:center;gap:7px;padding:6px 6px;border-radius:5px;
  border-left:2px solid var(--c);padding-left:8px;margin-bottom:3px;background:rgba(var(--c),.04)}

/* OVERLAY */
.overlay{position:fixed;inset:0;z-index:300;background:rgba(8,9,15,.88);backdrop-filter:blur(14px);
  display:flex;align-items:center;justify-content:center;animation:fadeIn .3s ease}
.ov{background:var(--bg1);border:1px solid rgba(255,255,255,.1);border-top:3px solid var(--c);
  border-radius:14px;padding:44px 40px;text-align:center;max-width:480px;width:94%;
  box-shadow:0 0 60px var(--g),0 24px 80px rgba(0,0,0,.95);animation:slideUp .4s var(--eback)}
.ov-avatar{font-size:3.5rem;display:block;margin-bottom:12px;animation:float 2.5s ease-in-out infinite}
.ov-result{font-family:var(--fdis);font-size:2.2rem;letter-spacing:.1em;margin-bottom:6px;
  text-shadow:0 0 30px currentColor}
.ov-model{font-family:var(--fmono);font-size:.72rem;letter-spacing:.12em;margin-bottom:14px}
.ov-speech{font-family:var(--fraj);font-size:.9rem;color:var(--t2);font-style:italic;line-height:1.6;
  min-height:2.5em;margin-bottom:18px}
.ov-score-block{margin-bottom:22px}
.ov-pts{font-family:var(--fdis);font-size:3rem;line-height:1;color:var(--c);text-shadow:0 0 24px var(--g)}
.ov-pts-label{font-family:var(--fmono);font-size:.58rem;letter-spacing:.25em;color:var(--t3);text-transform:uppercase;margin-bottom:14px}
.ov-rows{display:flex;flex-direction:column;gap:5px;text-align:left}
.ov-row{display:flex;justify-content:space-between;font-size:.82rem;color:var(--t2);
  padding:7px 12px;background:rgba(0,0,0,.3);border-radius:4px}
.ov-row span:last-child{font-family:var(--fdis);color:var(--gold)}
.ov-actions{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.btn-secondary{font-family:var(--fdis);font-size:.72rem;letter-spacing:.08em;padding:11px 20px;
  border-radius:5px;border:1px solid rgba(255,255,255,.15);background:transparent;color:var(--t2);cursor:pointer;transition:all .2s}
.btn-secondary:hover{border-color:rgba(255,255,255,.35);color:var(--t1)}
.btn-ghost{font-family:var(--fdis);font-size:.68rem;letter-spacing:.08em;padding:10px 18px;
  border-radius:5px;border:1px solid rgba(255,255,255,.08);background:transparent;color:var(--t3);cursor:pointer;transition:all .2s}
.btn-ghost:hover{color:var(--t2)}

/* DOTS */
.dots{display:inline-flex;align-items:center;gap:3px}
.dots-i{margin-left:6px}
.dot-blink{width:5px;height:5px;border-radius:50%;animation:blink 1.4s infinite}

/* RESPONSIVE */
@media(max-width:1100px){
  .home-screen{grid-template-columns:1fr 320px}
  .game-screen{grid-template-columns:200px 1fr 170px}
}
@media(max-width:800px){
  .home-screen{grid-template-columns:1fr}
  .home-side{display:none}
  .game-screen{grid-template-columns:1fr}
  .g-aside,.g-aside-r{display:none}
  .board{grid-template-columns:repeat(8,46px);grid-template-rows:repeat(8,46px)}
  .sq{width:46px;height:46px}
  .board-ranks .coord{height:46px}
  .board-files .coord{width:46px}
  .piece{font-size:1.85rem}
  .select-screen{padding:16px}
  .model-grid{grid-template-columns:1fr}
}
@media(max-width:480px){
  .hero-title{font-size:3.5rem}
  .ov{padding:28px 22px}
  .ov-pts{font-size:2.2rem}
}

/* ── PROFILE BUTTON (always-visible top-right) ── */
.profile-btn{position:fixed;top:14px;right:20px;z-index:200;display:flex;align-items:center;gap:8px;
  background:var(--bg2);border:1px solid rgba(255,255,255,.1);border-radius:24px;
  padding:6px 14px 6px 6px;cursor:pointer;transition:all .2s;font-family:var(--fraj)}
.profile-btn:hover{border-color:rgba(255,255,255,.25);transform:translateY(-1px);
  box-shadow:0 4px 20px rgba(0,0,0,.5)}
.pb-avatar{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;
  justify-content:center;font-family:var(--fdis);font-size:.75rem;flex-shrink:0}
.pb-name{font-size:.75rem;font-weight:600;color:var(--t1);max-width:80px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pb-level{font-size:.62rem;font-family:var(--fmono)}

/* ── ONBOARD SCREEN ── */
.onboard{min-height:100vh;display:flex;align-items:center;justify-content:center;
  padding:20px;position:relative;z-index:1;
  background:radial-gradient(ellipse 70% 60% at 50% 40%, rgba(100,50,200,.15) 0%, transparent 65%)}
.ob-card{background:var(--bg1);border:1px solid rgba(255,255,255,.1);border-radius:16px;
  padding:52px 44px;text-align:center;max-width:480px;width:100%;
  box-shadow:0 24px 80px rgba(0,0,0,.9);animation:slideUp .5s var(--eback)}
.ob-logo{font-size:4rem;margin-bottom:12px;display:block;animation:float 3s ease-in-out infinite}
.ob-title{font-family:var(--fdis);font-size:2.4rem;
  background:linear-gradient(135deg,#f5c542,#f97316,#ef4444);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  margin-bottom:10px}
.ob-sub{font-size:.92rem;color:var(--t2);line-height:1.6;max-width:360px;margin:0 auto 28px}
.ob-form{margin-bottom:24px;text-align:left}
.ob-label{display:block;font-family:var(--fmono);font-size:.62rem;letter-spacing:.18em;
  color:var(--t3);text-transform:uppercase;margin-bottom:8px}
.ob-input{width:100%;background:var(--bg2);border:2px solid rgba(255,255,255,.1);border-radius:8px;
  padding:13px 16px;font-family:var(--fmono);font-size:1rem;color:var(--t1);outline:none;
  transition:border-color .2s;text-align:center;letter-spacing:.05em}
.ob-input:focus{border-color:var(--gold)}
.ob-hint{font-size:.65rem;color:var(--t3);margin-top:6px;text-align:center}
.ob-start{width:100%;justify-content:center;font-size:.9rem;padding:16px}
.ob-start:disabled{opacity:.4;cursor:not-allowed;transform:none!important;box-shadow:none!important}
.ob-features{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:20px}
.ob-features span{font-size:.72rem;color:var(--t3);background:var(--bg2);
  padding:4px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.06)}
`;

if (typeof document !== "undefined") {
  const el = document.createElement("style");
  el.textContent = CSS;
  document.head.appendChild(el);
}
