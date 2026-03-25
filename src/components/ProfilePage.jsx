// src/components/ProfilePage.jsx
// Beautiful player profile + stats dashboard.
// Shows local progress, global leaderboard rank, per-model breakdown, recent games.

import { useState, useEffect } from "react";
import { MODELS, PLAYER_LEVELS, getLevel, ACHIEVEMENTS } from "../utils/gameData.js";
import { winRate, modelWinRate, formatDate, fetchGlobalLeaderboard } from "../utils/playerDB.js";

export default function ProfilePage({ profile, onClose, onRename, unlocked }) {
  const [tab, setTab]       = useState("overview");
  const [globalLB, setGLB]  = useState(null);
  const [lbLoading, setLBL] = useState(false);
  const [renaming, setRen]  = useState(false);
  const [newName, setNewName]= useState(profile?.username || "");

  const lvl = getLevel(profile?.xp || 0);

  useEffect(() => {
    if (tab === "leaderboard") {
      setLBL(true);
      fetchGlobalLeaderboard().then(data => { setGLB(data); setLBL(false); });
    }
  }, [tab]);

  if (!profile) return null;

  const wr = winRate(profile);
  const achUnlocked = ACHIEVEMENTS.filter(a => unlocked.has(a.id));
  const achLocked   = ACHIEVEMENTS.filter(a => !unlocked.has(a.id));

  return (
    <div className="profile-overlay">
      <div className="profile-modal">
        {/* Header */}
        <div className="pm-header" style={{ background: `linear-gradient(135deg, ${lvl.cur.color}18, transparent)`, borderBottom: `1px solid ${lvl.cur.color}33` }}>
          <div className="pm-avatar" style={{ background: `${lvl.cur.color}22`, border: `2px solid ${lvl.cur.color}88` }}>
            {profile.username[0]?.toUpperCase()}
          </div>
          <div className="pm-identity">
            {renaming ? (
              <div className="pm-rename">
                <input
                  className="pm-rename-input"
                  value={newName}
                  onChange={e => setNewName(e.target.value.replace(/[^a-zA-Z0-9_]/g,"").slice(0,20))}
                  onKeyDown={e => { if(e.key==="Enter"){ onRename(newName); setRen(false); } if(e.key==="Escape") setRen(false); }}
                  autoFocus
                  maxLength={20}
                  placeholder="Username (a-z, 0-9, _)"
                />
                <button className="pm-rename-save" onClick={()=>{ onRename(newName); setRen(false); }}>Save</button>
                <button className="pm-rename-cancel" onClick={()=>setRen(false)}>✕</button>
              </div>
            ) : (
              <div className="pm-name-row">
                <span className="pm-username">{profile.username}</span>
                <button className="pm-edit-btn" onClick={()=>setRen(true)} title="Rename">✏️</button>
              </div>
            )}
            <div className="pm-level" style={{ color: lvl.cur.color }}>
              {lvl.cur.name} · Level {lvl.cur.lvl}
            </div>
            <div className="pm-since">Playing since {formatDate(profile.createdAt)}</div>
          </div>
          <div className="pm-score-big">
            <div style={{ fontFamily:"var(--fdis)", fontSize:"1.8rem", color:"var(--gold)", lineHeight:1 }}>
              {(profile.totalScore||0).toLocaleString()}
            </div>
            <div style={{ fontFamily:"var(--fmono)", fontSize:".58rem", color:"var(--t3)", letterSpacing:".2em", textTransform:"uppercase", marginTop:3 }}>
              Total Points
            </div>
          </div>
          <button className="pm-close" onClick={onClose}>✕</button>
        </div>

        {/* XP bar */}
        <div className="pm-xpbar">
          <div className="pm-xplabel">
            <span style={{ fontFamily:"var(--fmono)", fontSize:".65rem", color: lvl.cur.color }}>{(profile.xp||0).toLocaleString()} XP</span>
            {lvl.nxt && <span style={{ fontSize:".6rem", color:"var(--t3)" }}>{Math.round(lvl.nxt.xp-(profile.xp||0)).toLocaleString()} to {lvl.nxt.name}</span>}
          </div>
          <div className="pm-xptrack">
            <div className="pm-xpfill" style={{ width:`${lvl.pct}%`, background:`linear-gradient(90deg, ${lvl.cur.color}88, ${lvl.cur.color})` }}/>
          </div>
        </div>

        {/* Tabs */}
        <div className="pm-tabs">
          {["overview","models","history","achievements","leaderboard"].map(t=>(
            <button key={t} className={`pm-tab ${tab===t?"pm-tab-on":""}`} onClick={()=>setTab(t)}>
              {t==="overview"?"📊 Overview": t==="models"?"🤖 vs AI": t==="history"?"⏱ History": t==="achievements"?"🏆 Trophies":"🌍 Global"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="pm-body">

          {/* OVERVIEW */}
          {tab==="overview" && (
            <div className="pm-overview">
              <div className="pm-stats-grid">
                <StatCard icon="⚔️" label="Games Played" val={profile.totalGames||0}/>
                <StatCard icon="✅" label="Wins"         val={profile.totalWins||0}   color="var(--green)"/>
                <StatCard icon="❌" label="Losses"       val={profile.totalLosses||0} color="#ef4444"/>
                <StatCard icon="🤝" label="Draws"        val={profile.totalDraws||0}  color="var(--t2)"/>
                <StatCard icon="📈" label="Win Rate"     val={`${wr}%`}               color={wr>=50?"var(--green)":"#ef4444"}/>
                <StatCard icon="🔥" label="Best Streak"  val={profile.bestStreak||0}  color="#f97316"/>
                <StatCard icon="🏆" label="Achievements" val={`${achUnlocked.length}/${ACHIEVEMENTS.length}`} color="var(--gold)"/>
                <StatCard icon="💀" label="Apex Defeated" val={profile.defeatedApex?"YES":"NO"} color={profile.defeatedApex?"#ef4444":"var(--t3)"}/>
              </div>

              {/* Level progress */}
              <div className="pm-section-title">Level Progress</div>
              <div className="level-ladder">
                {PLAYER_LEVELS.map((l,i)=>{
                  const done = (profile.xp||0) >= l.xp;
                  const isCur = l.lvl === lvl.cur.lvl;
                  const nextLvl = PLAYER_LEVELS[i+1];
                  const pct = isCur && nextLvl
                    ? Math.min(100, (((profile.xp||0) - l.xp) / (nextLvl.xp - l.xp)) * 100)
                    : done ? 100 : 0;
                  return (
                    <div key={l.lvl} className={`ll-step ${done?"ll-done":""} ${isCur?"ll-cur":""}`}
                      style={{"--lc": l.color}}>
                      <div className="ll-badge" style={{background: done||isCur ? l.color : "var(--bg4)", color: done||isCur ? "#08090f" : "var(--t3)"}}>
                        {done && !isCur ? "✓" : l.lvl}
                      </div>
                      <div className="ll-info">
                        <div className="ll-name" style={isCur?{color:l.color}:{}}>{l.name}</div>
                        {isCur && (
                          <div className="ll-bar">
                            <div className="ll-bar-fill" style={{width:`${pct}%`, background:l.color}}/>
                          </div>
                        )}
                        {!isCur && !done && (
                          <div className="ll-xp-need">{(l.xp-(profile.xp||0)).toLocaleString()} XP</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VS AI MODELS */}
          {tab==="models" && (
            <div className="pm-models">
              {MODELS.map(m => {
                const ms = profile.modelStats?.[m.id];
                const mwr = modelWinRate(profile, m.id);
                return (
                  <div key={m.id} className="mm-row" style={{"--c":m.color}}>
                    <span className="mm-avatar">{m.avatar}</span>
                    <div className="mm-info">
                      <div className="mm-name" style={{color:m.color}}>{m.name}</div>
                      <div className="mm-sub">{m.provider} · {m.tier}</div>
                    </div>
                    {ms ? (
                      <div className="mm-stats">
                        <MiniStat label="Games" val={ms.games}/>
                        <MiniStat label="Wins"  val={ms.wins} color="var(--green)"/>
                        <MiniStat label="W/R"   val={`${mwr}%`} color={mwr>=50?"var(--green)":"#ef4444"}/>
                        <MiniStat label="Best"  val={(ms.highScore||0).toLocaleString()} color="var(--gold)"/>
                      </div>
                    ) : (
                      <div className="mm-unplayed">Not yet challenged</div>
                    )}
                    <div className="mm-bar">
                      <div style={{width:`${mwr}%`, background:`linear-gradient(90deg, ${m.color}44, ${m.color})`}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* HISTORY */}
          {tab==="history" && (
            <div className="pm-history">
              {(!profile.recentGames || profile.recentGames.length===0) ? (
                <div className="pm-empty">No games played yet. Get out there!</div>
              ) : (
                <table className="hist-table">
                  <thead>
                    <tr>
                      <th>Opponent</th><th>Result</th><th>Score</th><th>Moves</th><th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.recentGames.map((g,i)=>{
                      const mod = MODELS.find(m=>m.id===g.modelId);
                      return (
                        <tr key={i}>
                          <td>
                            <span style={{marginRight:6}}>{mod?.avatar||"🤖"}</span>
                            <span style={{color:mod?.color||"var(--t1)"}}>{g.modelName}</span>
                          </td>
                          <td>
                            <span className={`hist-result ${g.result}`}>
                              {g.result==="win"?"WIN":g.result==="lose"?"LOSS":"DRAW"}
                            </span>
                          </td>
                          <td style={{fontFamily:"var(--fdis)",color:"var(--gold)"}}>{(g.score||0).toLocaleString()}</td>
                          <td style={{fontFamily:"var(--fmono)",color:"var(--t3)"}}>{g.moves||"—"}</td>
                          <td style={{color:"var(--t3)",fontSize:".7rem"}}>{formatDate(g.date)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ACHIEVEMENTS */}
          {tab==="achievements" && (
            <div className="pm-ach">
              {achUnlocked.length > 0 && (
                <>
                  <div className="pm-section-title" style={{color:"var(--gold)"}}>🏆 Unlocked ({achUnlocked.length})</div>
                  <div className="ach-full-grid">
                    {achUnlocked.map(a=>(
                      <div key={a.id} className="ach-full-card unlocked">
                        <div className="afc-icon">{a.icon}</div>
                        <div className="afc-name">{a.name}</div>
                        <div className="afc-desc">{a.desc}</div>
                        <div className="afc-xp">+{a.xp} XP</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {achLocked.length > 0 && (
                <>
                  <div className="pm-section-title" style={{marginTop:16}}>🔒 Locked ({achLocked.length})</div>
                  <div className="ach-full-grid">
                    {achLocked.map(a=>(
                      <div key={a.id} className="ach-full-card locked">
                        <div className="afc-icon">{a.icon}</div>
                        <div className="afc-name">{a.name}</div>
                        <div className="afc-desc">{a.desc}</div>
                        <div className="afc-xp">+{a.xp} XP</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* GLOBAL LEADERBOARD */}
          {tab==="leaderboard" && (
            <div className="pm-lb">
              {lbLoading && (
                <div className="pm-loading">
                  <div className="pm-spinner"/>
                  <span>Connecting to global leaderboard...</span>
                </div>
              )}
              {!lbLoading && !globalLB && (
                <div className="pm-nodb">
                  <div className="pm-nodb-icon">🌐</div>
                  <div className="pm-nodb-title">Global Leaderboard Not Connected</div>
                  <div className="pm-nodb-desc">
                    Add a Supabase database to track scores globally across all players.
                    Your local scores are saved on this device.
                  </div>
                  <div className="pm-nodb-steps">
                    <div className="step"><span>1</span> Sign up free at <a href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a></div>
                    <div className="step"><span>2</span> Create a project → copy the Project URL and service_role key</div>
                    <div className="step"><span>3</span> In Vercel: Project → Settings → Environment Variables → add <code>SUPABASE_URL + SUPABASE_SERVICE_KEY</code></div>
                    <div className="step"><span>4</span> Redeploy — tables are created automatically</div>
                  </div>
                </div>
              )}
              {!lbLoading && globalLB && (
                <>
                  <div className="pm-section-title">🌍 Top Players (Global)</div>
                  <table className="hist-table">
                    <thead><tr><th>#</th><th>Player</th><th>Score</th><th>Wins</th><th>Level</th></tr></thead>
                    <tbody>
                      {globalLB.players?.map((p,i)=>(
                        <tr key={i} style={p.username===profile.username?{background:"rgba(245,197,66,.07)"}:{}}>
                          <td style={{fontFamily:"var(--fmono)",color:"var(--t3)"}}>{i<3?["🥇","🥈","🥉"][i]:`#${i+1}`}</td>
                          <td style={{fontFamily:"var(--fmono)",color:p.username===profile.username?"var(--gold)":"var(--t1)"}}>
                            {p.username}{p.defeated_apex&&<span title="Defeated Apex" style={{marginLeft:4}}>💀</span>}
                          </td>
                          <td style={{fontFamily:"var(--fdis)",color:"var(--gold)"}}>{Number(p.total_score||0).toLocaleString()}</td>
                          <td style={{color:"var(--t2)"}}>{p.total_wins||0}</td>
                          <td style={{color:"var(--t2)",fontSize:".7rem"}}>{PLAYER_LEVELS.find(l=>l.lvl===Number(p.player_level))?.name||"Pawn"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {globalLB.aiStats?.length > 0 && (
                    <>
                      <div className="pm-section-title" style={{marginTop:20}}>🤖 AI Rankings (Global)</div>
                      <table className="hist-table">
                        <thead><tr><th>Model</th><th>Wins vs Humans</th><th>Losses</th><th>Games</th></tr></thead>
                        <tbody>
                          {globalLB.aiStats.map((a,i)=>{
                            const mod = MODELS.find(m=>m.id===a.model_id);
                            return (
                              <tr key={i}>
                                <td><span style={{marginRight:6}}>{mod?.avatar||"🤖"}</span><span style={{color:mod?.color||"var(--t1)"}}>{a.model_name}</span></td>
                                <td style={{color:"#ef4444",fontFamily:"var(--fdis)"}}>{a.wins_against_humans||0}</td>
                                <td style={{color:"var(--green)",fontFamily:"var(--fdis)"}}>{a.losses_to_humans||0}</td>
                                <td style={{color:"var(--t3)"}}>{a.total_games||0}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{PROFILE_CSS}</style>
    </div>
  );
}

function StatCard({icon,label,val,color}) {
  return (
    <div className="sc">
      <div className="sc-icon">{icon}</div>
      <div className="sc-val" style={color?{color}:{}}>{val}</div>
      <div className="sc-label">{label}</div>
    </div>
  );
}
function MiniStat({label,val,color}) {
  return <div className="ms"><div className="ms-val" style={color?{color}:{}}>{val}</div><div className="ms-label">{label}</div></div>;
}

const PROFILE_CSS = `
:root { --green: #22c55e; }

.profile-overlay{position:fixed;inset:0;z-index:400;background:rgba(8,9,15,.9);backdrop-filter:blur(16px);
  display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeIn .3s ease}

.profile-modal{background:var(--bg1);border:1px solid rgba(255,255,255,.1);border-radius:14px;
  width:100%;max-width:860px;max-height:90vh;display:flex;flex-direction:column;
  box-shadow:0 24px 80px rgba(0,0,0,.95);animation:slideUp .4s var(--eback);overflow:hidden}

.pm-header{display:flex;align-items:center;gap:16px;padding:20px 24px;flex-shrink:0}
.pm-avatar{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-family:var(--fdis);font-size:1.3rem;flex-shrink:0}
.pm-identity{flex:1;min-width:0}
.pm-name-row{display:flex;align-items:center;gap:8px}
.pm-username{font-family:var(--fdis);font-size:1.1rem;color:var(--t1)}
.pm-edit-btn{background:none;border:none;cursor:pointer;font-size:.9rem;opacity:.5;padding:2px 4px;transition:opacity .2s}
.pm-edit-btn:hover{opacity:1}
.pm-level{font-family:var(--fmono);font-size:.72rem;margin-top:3px}
.pm-since{font-size:.62rem;color:var(--t3);margin-top:2px}
.pm-rename{display:flex;align-items:center;gap:6px}
.pm-rename-input{background:var(--bg2);border:1px solid var(--gold);border-radius:4px;padding:5px 10px;
  font-family:var(--fmono);font-size:.82rem;color:var(--t1);outline:none;width:180px}
.pm-rename-save{font-family:var(--fraj);font-size:.72rem;font-weight:700;padding:5px 12px;
  background:var(--gold);color:#08090f;border:none;border-radius:4px;cursor:pointer}
.pm-rename-cancel{background:none;border:none;cursor:pointer;color:var(--t3);font-size:.9rem;padding:4px}
.pm-score-big{text-align:right;flex-shrink:0}
.pm-close{background:none;border:none;cursor:pointer;color:var(--t3);font-size:1.1rem;padding:4px 8px;
  transition:color .2s;flex-shrink:0;margin-left:4px}
.pm-close:hover{color:var(--t1)}

.pm-xpbar{padding:0 24px 12px;flex-shrink:0}
.pm-xplabel{display:flex;justify-content:space-between;margin-bottom:5px}
.pm-xptrack{height:6px;background:var(--bg3);border-radius:3px;overflow:hidden}
.pm-xpfill{height:100%;border-radius:3px;transition:width .8s var(--ease)}

.pm-tabs{display:flex;gap:2px;padding:0 16px;flex-shrink:0;border-bottom:1px solid rgba(255,255,255,.06);overflow-x:auto}
.pm-tab{font-family:var(--fraj);font-weight:600;font-size:.72rem;padding:10px 14px;border:none;
  background:transparent;color:var(--t3);cursor:pointer;border-bottom:2px solid transparent;
  transition:all .18s;white-space:nowrap}
.pm-tab:hover{color:var(--t2)}
.pm-tab-on{color:var(--gold);border-bottom-color:var(--gold)}

.pm-body{overflow-y:auto;flex:1;padding:20px 24px}
.pm-section-title{font-family:var(--fmono);font-size:.6rem;letter-spacing:.22em;color:var(--t3);
  text-transform:uppercase;margin-bottom:12px}
.pm-empty{color:var(--t3);font-style:italic;text-align:center;padding:32px}

/* OVERVIEW */
.pm-stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px}
.sc{background:var(--bg2);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:14px 10px;text-align:center}
.sc-icon{font-size:1.3rem;margin-bottom:6px}
.sc-val{font-family:var(--fdis);font-size:1.2rem;color:var(--t1);line-height:1;margin-bottom:4px}
.sc-label{font-family:var(--fmono);font-size:.58rem;color:var(--t3);letter-spacing:.1em;text-transform:uppercase}

.level-ladder{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.ll-step{display:flex;align-items:center;gap:10px;padding:10px 12px;
  background:var(--bg2);border:1px solid rgba(255,255,255,.06);
  border-radius:8px;transition:all .2s;opacity:.35;position:relative;overflow:hidden}
.ll-step::before{content:"";position:absolute;inset:0;
  background:linear-gradient(135deg,var(--lc,transparent),transparent);opacity:0;transition:.3s}
.ll-done{opacity:.65}
.ll-done::before{opacity:.06}
.ll-cur{opacity:1;border-color:var(--lc,rgba(255,255,255,.2));box-shadow:0 0 0 1px var(--lc,transparent),inset 0 0 20px rgba(255,255,255,.03)}
.ll-cur::before{opacity:.1}
.ll-badge{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;
  justify-content:center;font-family:var(--fdis);font-size:.72rem;font-weight:700;flex-shrink:0;transition:.2s}
.ll-info{flex:1;min-width:0}
.ll-name{font-family:var(--fraj);font-weight:700;font-size:.75rem;color:var(--t2);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px}
.ll-bar{height:3px;background:var(--bg4);border-radius:2px;overflow:hidden}
.ll-bar-fill{height:100%;border-radius:2px;transition:width .8s var(--ease)}
.ll-xp-need{font-family:var(--fmono);font-size:.58rem;color:var(--t3)}
@media(max-width:600px){.level-ladder{grid-template-columns:repeat(2,1fr)}}
@media(max-width:380px){.level-ladder{grid-template-columns:1fr}}

/* VS MODELS */
.pm-models{display:flex;flex-direction:column;gap:8px}
.mm-row{position:relative;background:var(--bg2);border:1px solid rgba(255,255,255,.06);
  border-left:3px solid var(--c,rgba(255,255,255,.1));border-radius:7px;
  padding:12px 14px;display:flex;align-items:center;gap:12px;overflow:hidden}
.mm-avatar{font-size:1.4rem;flex-shrink:0}
.mm-info{flex:1;min-width:0}
.mm-name{font-family:var(--fmono);font-size:.78rem}
.mm-sub{font-size:.62rem;color:var(--t3);margin-top:2px}
.mm-stats{display:flex;gap:16px;flex-shrink:0}
.ms{text-align:center}
.ms-val{font-family:var(--fdis);font-size:.9rem;color:var(--t1);line-height:1}
.ms-label{font-size:.55rem;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin-top:2px}
.mm-unplayed{font-size:.72rem;color:var(--t3);font-style:italic}
.mm-bar{position:absolute;bottom:0;left:0;right:0;height:2px;background:var(--bg3)}
.mm-bar div{height:100%;transition:width .6s var(--ease)}

/* HISTORY */
.pm-history{overflow-x:auto}
.hist-table{width:100%;border-collapse:collapse;font-size:.8rem}
.hist-table th{font-family:var(--fmono);font-size:.58rem;letter-spacing:.15em;color:var(--t3);
  text-transform:uppercase;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.08);text-align:left}
.hist-table td{padding:9px 12px;border-bottom:1px solid rgba(255,255,255,.04);color:var(--t2)}
.hist-table tr:hover td{background:rgba(255,255,255,.02)}
.hist-result{font-family:var(--fdis);font-size:.68rem;letter-spacing:.1em;padding:3px 8px;border-radius:3px}
.hist-result.win{color:#22c55e;background:rgba(34,197,94,.15)}
.hist-result.lose{color:#ef4444;background:rgba(239,68,68,.15)}
.hist-result.draw{color:var(--t2);background:rgba(255,255,255,.08)}

/* ACHIEVEMENTS */
.ach-full-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;margin-bottom:8px}
.ach-full-card{background:var(--bg2);border:1px solid rgba(255,255,255,.06);border-radius:8px;
  padding:14px 10px;text-align:center;transition:all .2s}
.ach-full-card.unlocked{border-color:rgba(245,197,66,.3);background:rgba(245,197,66,.04)}
.ach-full-card.locked{opacity:.3;filter:grayscale(.8)}
.afc-icon{font-size:1.6rem;margin-bottom:6px}
.afc-name{font-family:var(--fraj);font-weight:700;font-size:.78rem;color:var(--t1);margin-bottom:3px}
.afc-desc{font-size:.65rem;color:var(--t3);line-height:1.4;margin-bottom:6px}
.afc-xp{font-family:var(--fdis);font-size:.7rem;color:var(--gold)}

/* LEADERBOARD TAB */
.pm-nodb{text-align:center;padding:32px 20px}
.pm-nodb-icon{font-size:2.5rem;margin-bottom:12px}
.pm-nodb-title{font-family:var(--fdis);font-size:1rem;color:var(--t1);margin-bottom:8px}
.pm-nodb-desc{font-size:.82rem;color:var(--t2);max-width:400px;margin:0 auto 20px;line-height:1.6}
.pm-nodb-steps{text-align:left;max-width:400px;margin:0 auto;display:flex;flex-direction:column;gap:10px}
.step{display:flex;align-items:flex-start;gap:10px;font-size:.8rem;color:var(--t2);line-height:1.5}
.step span{background:var(--gold);color:#08090f;font-family:var(--fdis);font-size:.65rem;width:20px;height:20px;
  border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.step a{color:var(--gold)}
.step code{background:var(--bg2);padding:1px 6px;border-radius:3px;font-family:var(--fmono);font-size:.72rem;color:var(--gold)}

.pm-loading{display:flex;align-items:center;justify-content:center;gap:14px;padding:48px;color:var(--t2)}
.pm-spinner{width:24px;height:24px;border:2px solid rgba(255,255,255,.1);border-top-color:var(--gold);
  border-radius:50%;animation:spin .8s linear infinite}

@media(max-width:600px){
  .pm-stats-grid{grid-template-columns:repeat(2,1fr)}
  .ach-full-grid{grid-template-columns:repeat(2,1fr)}
  .pm-header{flex-wrap:wrap}
  .pm-tabs{gap:0}
  .pm-tab{padding:8px 10px;font-size:.65rem}
}
`;
