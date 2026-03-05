import { useState, useEffect, useCallback, useRef } from "react";

// ─── Supabase config ──────────────────────────────────────────────────────────
const SUPABASE_URL = "https://ylwblpqcujtqghcfssbn.supabase.co";
const SUPABASE_KEY = "sb_publishable_ts_Jy5bPH7xdjdjTHffadg_2FIcFHaC";

const db = {
  async select(table, filters = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?select=*`;
    Object.entries(filters).forEach(([k, v]) => { url += `&${k}=eq.${v}`; });
    const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    return r.json();
  },
  async insert(table, row) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(row),
    });
    return r.json();
  },
  async update(table, id, patch) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(patch),
    });
    return r.json();
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const uuid = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
const now  = () => new Date().toISOString();
const genCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({length:6}, () => chars[Math.floor(Math.random()*chars.length)]).join("");
};
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate()+n); return r.toISOString(); };
const timeAgo = (ts) => {
  const s = Math.floor((Date.now()-new Date(ts).getTime())/1000);
  if(s<60) return `${s}s ago`;
  if(s<3600) return `${Math.floor(s/60)}m ago`;
  if(s<86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
};
const fmtFull = (ts) => new Date(ts).toLocaleString();
const fmtDate = (ts) => new Date(ts).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});

// ─── Seed staff if DB empty ────────────────────────────────────────────────────
const ADMIN = { id: "admin-001", username: "admin", password_hash: "admin123" };

async function seedIfEmpty(staffList) {
  if (staffList.length === 0) {
    const s1 = { id: uuid(), name: "Alex Rivera", pin: "1234", created_at: now() };
    const s2 = { id: uuid(), name: "Jordan Lee",  pin: "5678", created_at: now() };
    await db.insert("staff", [s1, s2]);
    return [s1, s2];
  }
  return staffList;
}

// ─── Colors & styles ──────────────────────────────────────────────────────────
const C = {
  bg:"#FAFAF8", surface:"#FFFFFF", border:"#E8E5DF", text:"#1A1814", muted:"#8A8580",
  accent:"#C8520A", accentBg:"#FDF3EE", green:"#1A7A4A", greenBg:"#EBF7F1",
  red:"#B8200A", redBg:"#FEF0EE", gray:"#6B6760", grayBg:"#F2F0EC",
};
const S = {
  app: { fontFamily:"'DM Mono','Courier New',monospace", background:C.bg, minHeight:"100vh", color:C.text },
  card: { background:C.surface, border:`1px solid ${C.border}`, borderRadius:2, padding:"20px 24px" },
  btn: (v="primary") => ({
    display:"inline-flex", alignItems:"center", justifyContent:"center",
    padding:"9px 18px", borderRadius:2, fontSize:13, fontWeight:600,
    fontFamily:"inherit", cursor:"pointer", border:"none", letterSpacing:"0.04em", textTransform:"uppercase",
    ...(v==="primary" ? {background:C.accent,color:"#fff"} : {}),
    ...(v==="ghost"   ? {background:"transparent",color:C.muted,border:`1px solid ${C.border}`} : {}),
    ...(v==="danger"  ? {background:C.red,color:"#fff"} : {}),
    ...(v==="success" ? {background:C.green,color:"#fff"} : {}),
  }),
  input: { width:"100%", padding:"9px 12px", fontSize:13, fontFamily:"inherit",
    border:`1px solid ${C.border}`, borderRadius:2, background:C.surface,
    color:C.text, outline:"none", boxSizing:"border-box" },
  label: { fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase",
    color:C.muted, display:"block", marginBottom:6 },
  tag: (status) => {
    const m = { active:{bg:C.greenBg,color:C.green}, redeemed:{bg:C.accentBg,color:C.accent},
      voided:{bg:C.redBg,color:C.red}, expired:{bg:C.grayBg,color:C.gray} };
    const s = m[status]||m.expired;
    return { display:"inline-block", padding:"2px 8px", borderRadius:2, fontSize:11,
      fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", background:s.bg, color:s.color };
  },
};

function Tag({status}) { return <span style={S.tag(status)}>{status}</span>; }

function Modal({title, children, onClose}) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",display:"flex",
      alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
      <div style={{...S.card,minWidth:340,maxWidth:480,width:"100%"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
          <span style={{fontSize:14,fontWeight:700,letterSpacing:"0.04em",textTransform:"uppercase"}}>{title}</span>
          {onClose && <button onClick={onClose} style={{...S.btn("ghost"),padding:"4px 10px"}}>✕</button>}
        </div>
        {children}
      </div>
    </div>
  );
}

function Tile({label, value, color}) {
  return (
    <div style={{...S.card,flex:1,minWidth:120}}>
      <div style={{fontSize:28,fontWeight:700,color:color||C.text,marginBottom:4}}>{value}</div>
      <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:C.muted}}>{label}</div>
    </div>
  );
}

function Numpad({value, onChange}) {
  const keys = ["1","2","3","4","5","6","7","8","9","CLR","0","DEL"];
  const tap = (k) => {
    if(k==="CLR") { onChange(""); return; }
    if(k==="DEL") { onChange(value.slice(0,-1)); return; }
    if(value.length>=6) return;
    onChange(value+k);
  };
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:12}}>
      {keys.map(k=>(
        <button key={k} onClick={()=>tap(k)} style={{...S.btn(k==="CLR"?"danger":"ghost"),padding:"16px 0",fontSize:16,fontWeight:700}}>{k}</button>
      ))}
    </div>
  );
}

function AlphaNumpad({value, onChange}) {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("");
  const digits  = ["1","2","3","4","5","6","7","8","9","0"];
  const tap = (k) => {
    if(k==="DEL") { onChange(value.slice(0,-1)); return; }
    if(k==="CLR") { onChange(""); return; }
    if(value.length>=6) return;
    onChange(value+k);
  };
  const keyBtn = (k) => (
    <button key={k} onClick={()=>tap(k)} style={{padding:"10px 0",fontSize:13,fontWeight:700,fontFamily:"inherit",background:C.surface,border:`1px solid ${C.border}`,borderRadius:2,color:C.text,cursor:"pointer",lineHeight:1}}>{k}</button>
  );
  return (
    <div style={{marginTop:12}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:5,marginBottom:5}}>{letters.map(k=>keyBtn(k))}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:5}}>
        {digits.map(k=>keyBtn(k))}
        <button onClick={()=>tap("DEL")} style={{padding:"10px 0",fontSize:11,fontWeight:700,fontFamily:"inherit",background:C.surface,border:`1px solid ${C.border}`,borderRadius:2,color:C.muted,cursor:"pointer"}}>DEL</button>
        <button onClick={()=>tap("CLR")} style={{padding:"10px 0",fontSize:11,fontWeight:700,fontFamily:"inherit",background:C.redBg,border:`1px solid ${C.border}`,borderRadius:2,color:C.red,cursor:"pointer"}}>CLR</button>
      </div>
    </div>
  );
}

function Loading({message="Loading…"}) {
  return (
    <div style={{...S.app,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:C.accent,marginBottom:16}}>Restaurant Rewards</div>
        <div style={{fontSize:13,color:C.muted}}>{message}</div>
      </div>
    </div>
  );
}

function ErrorScreen({message, onRetry}) {
  return (
    <div style={{...S.app,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{...S.card,width:360,textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:12}}>⚠️</div>
        <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>Database Error</div>
        <div style={{fontSize:12,color:C.muted,marginBottom:8}}>{message}</div>
        <div style={{fontSize:11,color:C.muted,marginBottom:20,padding:"10px",background:C.grayBg,borderRadius:2,textAlign:"left"}}>
          Make sure you ran the SQL setup in Supabase and that Row Level Security is disabled (or policies are set for public access).
        </div>
        <button style={{...S.btn("primary"),width:"100%"}} onClick={onRetry}>Retry Connection</button>
      </div>
    </div>
  );
}

// ─── Admin Login ───────────────────────────────────────────────────────────────
function AdminLogin({onLogin}) {
  const [u,setU]=useState(""); const [p,setP]=useState(""); const [err,setErr]=useState("");
  const submit = () => {
    if(u===ADMIN.username && p===ADMIN.password_hash) onLogin();
    else setErr("Invalid credentials");
  };
  return (
    <div style={{...S.app,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{...S.card,width:320}}>
        <div style={{marginBottom:24}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:C.accent,marginBottom:6}}>Restaurant Rewards</div>
          <div style={{fontSize:20,fontWeight:700}}>Admin Login</div>
        </div>
        <div style={{marginBottom:12}}>
          <label style={S.label}>Username</label>
          <input style={S.input} value={u} onChange={e=>setU(e.target.value)} placeholder="admin" autoFocus />
        </div>
        <div style={{marginBottom:16}}>
          <label style={S.label}>Password</label>
          <input style={S.input} type="password" value={p} onChange={e=>setP(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="••••••••" />
        </div>
        {err && <div style={{fontSize:12,color:C.red,marginBottom:12}}>{err}</div>}
        <button style={{...S.btn("primary"),width:"100%"}} onClick={submit}>Sign In</button>
        <div style={{marginTop:16,fontSize:11,color:C.muted,textAlign:"center"}}>Default: admin / admin123</div>
      </div>
    </div>
  );
}

// ─── New Code Form ─────────────────────────────────────────────────────────────
function NewCodeForm({onClose, onCreated}) {
  const [type,setType]=useState("dollar");
  const [amount,setAmount]=useState("");
  const [note,setNote]=useState("");
  const [code,setCode]=useState(genCode);
  const [err,setErr]=useState("");
  const [saving,setSaving]=useState(false);

  const submit = async () => {
    const amt = parseInt(amount,10);
    if(!amount||isNaN(amt)||amt<=0) { setErr("Enter a valid amount"); return; }
    if(type==="percent"&&amt>100) { setErr("Percent cannot exceed 100"); return; }
    setSaving(true);
    const c = { id:uuid(), code, reward_type:type, amount:amt, note,
      status:"active", created_at:now(), expires_at:addDays(now(),14),
      redeemed_at:null, voided_at:null, redeemed_by_staff_id:null,
      voided_by_staff_id:null, created_by_admin_id:ADMIN.id };
    await db.insert("codes", c);
    await db.insert("logs", { id:uuid(), event_type:"created", code_id:c.id,
      staff_id:null, admin_id:ADMIN.id, timestamp:c.created_at,
      ip_address:"admin", device_fingerprint:"admin-browser", details:note||"" });
    setSaving(false);
    onCreated(c);
  };

  return (
    <Modal title="New Reward Code" onClose={onClose}>
      <div style={{marginBottom:12}}>
        <label style={S.label}>Reward Type</label>
        <div style={{display:"flex",gap:8}}>
          {["dollar","percent"].map(t=>(
            <button key={t} onClick={()=>setType(t)} style={{...S.btn(type===t?"primary":"ghost"),flex:1}}>
              {t==="dollar"?"$ Dollar":"% Percent"}
            </button>
          ))}
        </div>
      </div>
      <div style={{marginBottom:12}}>
        <label style={S.label}>Amount ({type==="dollar"?"$":"%"})</label>
        <input style={S.input} type="number" min="1" max={type==="percent"?100:9999}
          value={amount} onChange={e=>setAmount(e.target.value)} placeholder="e.g. 10" />
      </div>
      <div style={{marginBottom:12}}>
        <label style={S.label}>Internal Note (optional)</label>
        <input style={S.input} value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. Birthday promo" />
      </div>
      <div style={{marginBottom:16}}>
        <label style={S.label}>Code (auto-generated)</label>
        <div style={{display:"flex",gap:8}}>
          <input style={{...S.input,letterSpacing:"0.2em",fontWeight:700,flex:1}} readOnly value={code}/>
          <button style={{...S.btn("ghost"),padding:"9px 14px",fontSize:16}} onClick={()=>setCode(genCode())}>↻</button>
        </div>
        <div style={{fontSize:11,color:C.muted,marginTop:6}}>Expires {fmtDate(addDays(now(),14))} (14 days)</div>
      </div>
      {err && <div style={{fontSize:12,color:C.red,marginBottom:12}}>{err}</div>}
      <button style={{...S.btn("primary"),width:"100%"}} onClick={submit} disabled={saving}>
        {saving?"Saving…":"Create Code"}
      </button>
    </Modal>
  );
}

function ConfirmModal({code, onClose}) {
  const [copied,setCopied]=useState(false);
  const copy = () => { navigator.clipboard?.writeText(code.code); setCopied(true); };
  return (
    <Modal title="Code Created">
      <div style={{textAlign:"center",padding:"8px 0 16px"}}>
        <div style={{fontSize:11,color:C.muted,marginBottom:8,letterSpacing:"0.08em",textTransform:"uppercase"}}>Your reward code</div>
        <div style={{fontSize:36,fontWeight:700,letterSpacing:"0.3em",color:C.accent,marginBottom:4}}>{code.code}</div>
        <div style={{fontSize:13,color:C.muted,marginBottom:16}}>
          {code.reward_type==="dollar"?`$${code.amount} off`:`${code.amount}% off`} · Expires {fmtDate(code.expires_at)}
        </div>
        <button style={{...S.btn(copied?"success":"primary"),width:"100%",marginBottom:8}} onClick={copy}>
          {copied?"Copied!":"Copy Code"}
        </button>
        <button style={{...S.btn("ghost"),width:"100%"}} onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}

// ─── Admin Dashboard ───────────────────────────────────────────────────────────
function AdminDashboard({staff, onLogout}) {
  const [tab,setTab]=useState("logs");
  const [codes,setCodes]=useState([]);
  const [logs,setLogs]=useState([]);
  const [showNew,setShowNew]=useState(false);
  const [confirmCode,setConfirmCode]=useState(null);
  const [loading,setLoading]=useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const nowStr = now();
    const allCodes = await db.select("codes");
    const toExpire = allCodes.filter(c=>c.status==="active"&&c.expires_at<nowStr);
    await Promise.all(toExpire.map(async c => {
      await db.update("codes", c.id, {status:"expired"});
      await db.insert("logs", {id:uuid(),event_type:"expired",code_id:c.id,
        staff_id:null,admin_id:null,timestamp:nowStr,ip_address:"system",device_fingerprint:"system",details:"Auto-expired"});
    }));
    const [freshCodes, freshLogs] = await Promise.all([db.select("codes"), db.select("logs")]);
    setCodes(freshCodes);
    setLogs([...freshLogs].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)));
    setLoading(false);
  }, []);

  useEffect(()=>{ load(); },[]);

  const today = new Date().toDateString();
  const activeCodes   = codes.filter(c=>c.status==="active").length;
  const redeemedToday = logs.filter(l=>l.event_type==="redeemed"&&new Date(l.timestamp).toDateString()===today).length;
  const voidedToday   = logs.filter(l=>l.event_type==="voided"  &&new Date(l.timestamp).toDateString()===today).length;
  const expiredToday  = logs.filter(l=>l.event_type==="expired" &&new Date(l.timestamp).toDateString()===today).length;

  const getStaffName = (id)=>{ if(!id) return "—"; const s=staff.find(x=>x.id===id); return s?s.name:"Unknown"; };
  const getCode = (id)=>{ if(!id) return "—"; const c=codes.find(x=>x.id===id); return c?c.code:"—"; };
  const evtColor = {created:C.accent,redeemed:C.green,voided:C.red,expired:C.gray,failed_redeem:"#B8820A",failed_void:"#B8820A"};

  return (
    <div style={S.app}>
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52}}>
        <div style={{display:"flex",alignItems:"center",gap:24}}>
          <span style={{fontSize:11,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:C.accent}}>Rewards Admin</span>
          <div style={{display:"flex",gap:2}}>
            {["logs","codes"].map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={{...S.btn(tab===t?"primary":"ghost"),padding:"5px 14px",fontSize:11}}>
                {t.charAt(0).toUpperCase()+t.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button style={{...S.btn("ghost"),fontSize:11}} onClick={load}>↻ Refresh</button>
          <button style={{...S.btn("primary"),fontSize:11}} onClick={()=>setShowNew(true)}>+ New Code</button>
          <button style={{...S.btn("ghost"),fontSize:11}} onClick={onLogout}>Logout</button>
        </div>
      </div>

      <div style={{maxWidth:960,margin:"0 auto",padding:"24px 16px"}}>
        <div style={{display:"flex",gap:12,marginBottom:24,flexWrap:"wrap"}}>
          <Tile label="Active Codes"   value={loading?"…":activeCodes}   color={C.green}  />
          <Tile label="Redeemed Today" value={loading?"…":redeemedToday} color={C.accent} />
          <Tile label="Voided Today"   value={loading?"…":voidedToday}   color={C.red}    />
          <Tile label="Expired Today"  value={loading?"…":expiredToday}  color={C.gray}   />
        </div>

        {loading ? (
          <div style={{textAlign:"center",padding:40,color:C.muted,fontSize:13}}>Loading from database…</div>
        ) : tab==="logs" ? (
          <div style={S.card}>
            <div style={{fontSize:12,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:C.muted,marginBottom:16}}>Event Log — {logs.length} entries</div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{borderBottom:`1px solid ${C.border}`}}>
                  {["Event","Code","Staff / Admin","Details","Time"].map(h=>(
                    <th key={h} style={{textAlign:"left",padding:"6px 10px",fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:C.muted,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(l=>(
                  <tr key={l.id} style={{borderBottom:`1px solid ${C.border}`}}>
                    <td style={{padding:"9px 10px",whiteSpace:"nowrap"}}>
                      <span style={{fontWeight:700,fontSize:11,letterSpacing:"0.04em",color:evtColor[l.event_type]||C.text,textTransform:"uppercase"}}>{l.event_type.replace(/_/g," ")}</span>
                    </td>
                    <td style={{padding:"9px 10px",fontWeight:700,letterSpacing:"0.15em"}}>{getCode(l.code_id)}</td>
                    <td style={{padding:"9px 10px",color:C.muted}}>{l.staff_id?getStaffName(l.staff_id):l.admin_id?"Admin":"System"}</td>
                    <td style={{padding:"9px 10px",color:C.muted,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.details||"—"}</td>
                    <td style={{padding:"9px 10px",color:C.muted,whiteSpace:"nowrap"}}>
                      <span title={fmtFull(l.timestamp)} style={{cursor:"default"}}>{timeAgo(l.timestamp)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={S.card}>
            <div style={{fontSize:12,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:C.muted,marginBottom:16}}>All Codes — {codes.length} total</div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{borderBottom:`1px solid ${C.border}`}}>
                  {["Code","Type","Amount","Note","Status","Expires","Created"].map(h=>(
                    <th key={h} style={{textAlign:"left",padding:"6px 10px",fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:C.muted,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...codes].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).map(c=>(
                  <tr key={c.id} style={{borderBottom:`1px solid ${C.border}`}}>
                    <td style={{padding:"9px 10px",fontWeight:700,letterSpacing:"0.15em",color:C.accent}}>{c.code}</td>
                    <td style={{padding:"9px 10px",color:C.muted,textTransform:"uppercase",fontSize:11}}>{c.reward_type}</td>
                    <td style={{padding:"9px 10px",fontWeight:700}}>{c.reward_type==="dollar"?`$${c.amount}`:`${c.amount}%`}</td>
                    <td style={{padding:"9px 10px",color:C.muted,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.note||"—"}</td>
                    <td style={{padding:"9px 10px"}}><Tag status={c.status}/></td>
                    <td style={{padding:"9px 10px",color:C.muted,whiteSpace:"nowrap"}}>{fmtDate(c.expires_at)}</td>
                    <td style={{padding:"9px 10px",color:C.muted,whiteSpace:"nowrap"}}>
                      <span title={fmtFull(c.created_at)} style={{cursor:"default"}}>{timeAgo(c.created_at)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNew && <NewCodeForm onClose={()=>setShowNew(false)} onCreated={(c)=>{ setShowNew(false); setConfirmCode(c); load(); }} />}
      {confirmCode && <ConfirmModal code={confirmCode} onClose={()=>setConfirmCode(null)} />}
    </div>
  );
}

// ─── Staff Login ───────────────────────────────────────────────────────────────
function StaffLogin({staff, onLogin}) {
  const [pin,setPin]=useState("");
  const [err,setErr]=useState("");

  useEffect(()=>{
    if(pin.length===4) {
      const s = staff.find(x=>x.pin===pin);
      if(s) onLogin(s);
      else { setErr("Invalid PIN"); setPin(""); }
    }
  },[pin]);

  return (
    <div style={{...S.app,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{...S.card,width:300}}>
        <div style={{marginBottom:20,textAlign:"center"}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:C.accent,marginBottom:6}}>Restaurant Rewards</div>
          <div style={{fontSize:18,fontWeight:700}}>Staff Login</div>
          <div style={{fontSize:12,color:C.muted,marginTop:4}}>Enter your 4-digit PIN</div>
        </div>
        <div style={{display:"flex",justifyContent:"center",gap:10,marginBottom:4}}>
          {[0,1,2,3].map(i=>(
            <div key={i} style={{width:14,height:14,borderRadius:"50%",background:pin.length>i?C.accent:C.border,transition:"background 0.15s"}}/>
          ))}
        </div>
        {err && <div style={{fontSize:12,color:C.red,textAlign:"center",marginTop:8}}>{err}</div>}
        <Numpad value={pin} onChange={setPin}/>
        <div style={{marginTop:16,fontSize:11,color:C.muted,textAlign:"center"}}>PINs: 1234 (Alex) · 5678 (Jordan)</div>
      </div>
    </div>
  );
}

// ─── Staff Action ──────────────────────────────────────────────────────────────
function StaffAction({action, staffMember, onBack}) {
  const [code,setCode]=useState("");
  const [result,setResult]=useState(null);
  const [busy,setBusy]=useState(false);

  const process = useCallback(async (enteredCode) => {
    setBusy(true);
    const upper = enteredCode.toUpperCase();
    const nowStr = now();
    const allCodes = await db.select("codes");
    const c = allCodes.find(x=>x.code===upper);
    const logBase = {id:uuid(),staff_id:staffMember.id,admin_id:null,timestamp:nowStr,ip_address:"staff",device_fingerprint:"staff-browser"};

    if(!c) {
      await db.insert("logs",{...logBase,event_type:`failed_${action}`,code_id:null,details:`Code '${upper}' not found`});
      setResult({type:"error",msg:"Invalid code"}); setBusy(false); return;
    }
    if(c.status==="active"&&c.expires_at<nowStr) {
      await db.update("codes",c.id,{status:"expired"});
      await db.insert("logs",{...logBase,event_type:`failed_${action}`,code_id:c.id,details:"Code expired"});
      setResult({type:"error",msg:"Expired"}); setBusy(false); return;
    }
    if(c.status==="expired")  { await db.insert("logs",{...logBase,event_type:`failed_${action}`,code_id:c.id,details:"Code expired"});    setResult({type:"error",msg:"Expired"});          setBusy(false); return; }
    if(c.status==="redeemed") { await db.insert("logs",{...logBase,event_type:`failed_${action}`,code_id:c.id,details:"Already redeemed"}); setResult({type:"error",msg:"Already redeemed"}); setBusy(false); return; }
    if(c.status==="voided")   { await db.insert("logs",{...logBase,event_type:`failed_${action}`,code_id:c.id,details:"Already voided"});   setResult({type:"error",msg:"Invalid code"});     setBusy(false); return; }

    if(action==="redeem") {
      await db.update("codes",c.id,{status:"redeemed",redeemed_at:nowStr,redeemed_by_staff_id:staffMember.id});
      const reward = c.reward_type==="dollar"?`$${c.amount} off`:`${c.amount}% off`;
      await db.insert("logs",{...logBase,event_type:"redeemed",code_id:c.id,details:reward});
      setResult({type:"success",msg:"Redeemed",reward});
    } else {
      await db.update("codes",c.id,{status:"voided",voided_at:nowStr,voided_by_staff_id:staffMember.id});
      await db.insert("logs",{...logBase,event_type:"voided",code_id:c.id,details:""});
      setResult({type:"success",msg:"Voided"});
    }
    setBusy(false);
  }, [action, staffMember]);

  useEffect(()=>{ if(code.length===6&&!result&&!busy) process(code); },[code]);

  useEffect(()=>{
    const handler = (e) => {
      if(result||busy) return;
      if(e.key==="Backspace") { setCode(c=>c.slice(0,-1)); return; }
      if(e.key==="Escape")    { setCode(""); return; }
      if(/^[a-zA-Z0-9]$/.test(e.key)) setCode(c=>c.length<6?(c+e.key).toUpperCase():c);
    };
    window.addEventListener("keydown",handler);
    return ()=>window.removeEventListener("keydown",handler);
  },[result,busy]);

  const reset = ()=>{ setCode(""); setResult(null); setBusy(false); };

  if(result) {
    const isOk = result.type==="success";
    return (
      <div style={{...S.app,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{...S.card,width:300,textAlign:"center"}}>
          <div style={{fontSize:56,marginBottom:8}}>{isOk?"✓":"✕"}</div>
          <div style={{fontSize:28,fontWeight:700,color:isOk?C.green:C.red,marginBottom:4,letterSpacing:"0.04em"}}>{result.msg}</div>
          {result.reward && <div style={{fontSize:16,color:C.accent,fontWeight:700,marginBottom:16}}>{result.reward}</div>}
          <button style={{...S.btn(isOk?"success":"danger"),width:"100%",marginBottom:8}} onClick={reset}>
            {action==="redeem"?"Redeem Another":"Void Another"}
          </button>
          <button style={{...S.btn("ghost"),width:"100%"}} onClick={onBack}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{...S.app,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{...S.card,width:380}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",color:action==="redeem"?C.green:C.red}}>
            {action==="redeem"?"Redeem Code":"Void Code"}
          </div>
          <button style={{...S.btn("ghost"),padding:"4px 10px",fontSize:11}} onClick={onBack}>Back</button>
        </div>
        <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:4}}>
          {[0,1,2,3,4,5].map(i=>(
            <div key={i} style={{width:44,height:52,border:`1px solid ${i<code.length?C.accent:C.border}`,borderRadius:2,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:20,color:i<code.length?C.accent:C.muted,background:i<code.length?C.accentBg:C.surface,transition:"all 0.1s"}}>
              {code[i]||""}
            </div>
          ))}
        </div>
        {busy
          ? <div style={{fontSize:11,color:C.accent,textAlign:"center",marginTop:8,marginBottom:4}}>Checking with database…</div>
          : <div style={{fontSize:11,color:C.muted,textAlign:"center",marginTop:6,marginBottom:2}}>Tap keys below or type on keyboard</div>
        }
        <AlphaNumpad value={code} onChange={v=>{ if(!busy) setCode(v.replace(/[^a-zA-Z0-9]/g,"").toUpperCase().slice(0,6)); }}/>
      </div>
    </div>
  );
}

// ─── Staff Home ────────────────────────────────────────────────────────────────
function StaffHome({staffMember, onLogout}) {
  const [action,setAction]=useState(null);
  if(action) return <StaffAction action={action} staffMember={staffMember} onBack={()=>setAction(null)}/>;
  return (
    <div style={{...S.app,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{...S.card,width:300,textAlign:"center"}}>
        <div style={{marginBottom:28}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:C.accent,marginBottom:6}}>Restaurant Rewards</div>
          <div style={{fontSize:18,fontWeight:700}}>Welcome, {staffMember.name}</div>
        </div>
        <button style={{...S.btn("success"),width:"100%",marginBottom:10,padding:"16px 0",fontSize:15}} onClick={()=>setAction("redeem")}>Redeem</button>
        <button style={{...S.btn("danger"),width:"100%",padding:"16px 0",fontSize:15}} onClick={()=>setAction("void")}>Void</button>
        <button style={{...S.btn("ghost"),width:"100%",marginTop:16,fontSize:11}} onClick={onLogout}>Logout</button>
      </div>
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [mode,setMode]=useState("loading");
  const [staff,setStaff]=useState([]);
  const [staffMember,setStaffMember]=useState(null);
  const [error,setError]=useState(null);

  const init = useCallback(async () => {
    setMode("loading"); setError(null);
    try {
      let staffList = await db.select("staff");
      if (!Array.isArray(staffList)) throw new Error(staffList?.message || "DB error");
      staffList = await seedIfEmpty(staffList);
      setStaff(staffList);
      setMode("choose");
    } catch(e) {
      setError(e.message || "Could not connect to database.");
      setMode("error");
    }
  }, []);

  useEffect(()=>{ init(); },[]);

  const logout = ()=>{ setStaffMember(null); setMode("choose"); };

  if(mode==="loading") return <Loading message="Connecting to database…"/>;
  if(mode==="error")   return <ErrorScreen message={error} onRetry={init}/>;

  if(mode==="choose") return (
    <div style={{...S.app,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{...S.card,width:320,textAlign:"center"}}>
        <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:C.accent,marginBottom:8}}>Restaurant Rewards</div>
        <div style={{fontSize:20,fontWeight:700,marginBottom:4}}>Select Role</div>
        <div style={{fontSize:12,color:C.muted,marginBottom:24}}>Data syncs in real time across all devices.</div>
        <button style={{...S.btn("primary"),width:"100%",marginBottom:10,padding:"14px 0",fontSize:13}} onClick={()=>setMode("admin-login")}>Admin Dashboard</button>
        <button style={{...S.btn("ghost"),width:"100%",padding:"14px 0",fontSize:13}} onClick={()=>setMode("staff-login")}>Staff Interface</button>
        <div style={{marginTop:20,padding:"12px 16px",background:C.accentBg,borderRadius:2,textAlign:"left"}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:C.accent,marginBottom:6}}>Credentials</div>
          <div style={{fontSize:11,color:C.text,lineHeight:1.7}}>
            Admin: <b>admin</b> / <b>admin123</b><br/>
            Staff PIN: <b>1234</b> (Alex Rivera)<br/>
            Staff PIN: <b>5678</b> (Jordan Lee)
          </div>
        </div>
      </div>
    </div>
  );

  if(mode==="admin-login") return <AdminLogin onLogin={()=>setMode("admin")}/>;
  if(mode==="staff-login") return <StaffLogin staff={staff} onLogin={(s)=>{ setStaffMember(s); setMode("staff"); }}/>;
  if(mode==="admin") return <AdminDashboard staff={staff} onLogout={logout}/>;
  if(mode==="staff") return <StaffHome staffMember={staffMember} onLogout={logout}/>;
  return null;
}
