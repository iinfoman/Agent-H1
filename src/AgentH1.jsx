import { useState, useRef, useEffect } from "react";

const MODEL = "claude-sonnet-4-20250514";

const BOOT_LINES = [
  "AGENT H1 DEPLOYMENT ENGINE INITIALIZING...",
  "GITHUB API MODULE: ONLINE",
  "NETLIFY API MODULE: ONLINE",
  "CODE GENERATION ENGINE: ONLINE",
  "ERROR CORRECTION LOOP: ONLINE",
  "ALL SYSTEMS NOMINAL.",
  "READY FOR AUTONOMOUS DEPLOYMENT.",
];

export default function AgentH1Deploy() {
  const [phase, setPhase] = useState("boot");
  const [bootIdx, setBootIdx] = useState(0);
  const [tokens, setTokens] = useState({ github: "", netlify: "" });
  const [goal, setGoal] = useState("");
  const [log, setLog] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const logRef = useRef(null);

  useEffect(() => {
    if (phase !== "boot") return;
    if (bootIdx < BOOT_LINES.length) {
      const t = setTimeout(() => setBootIdx(i => i + 1), 200 + Math.random() * 120);
      return () => clearTimeout(t);
    } else {
      setTimeout(() => setPhase("tokens"), 500);
    }
  }, [phase, bootIdx]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const addLog = (type, text) => {
    setLog(prev => [...prev, { type, text, id: Date.now() + Math.random() }]);
  };

  const delay = ms => new Promise(r => setTimeout(r, ms));

  // ── CALL CLAUDE VIA NETLIFY FUNCTION ────────────────────────────────────────
  const callClaude = async (messages) => {
    const res = await fetch("/.netlify/functions/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1000, messages })
    });
    const data = await res.json();
    return (data.content || []).map(b => b.text || "").filter(Boolean).join("\n");
  };

  // ── GITHUB API ───────────────────────────────────────────────────────────────
  const github = async (path, method = "GET", body = null) => {
    const res = await fetch(`https://api.github.com${path}`, {
      method,
      headers: {
        "Authorization": `token ${tokens.github}`,
        "Content-Type": "application/json",
        "Accept": "application/vnd.github.v3+json"
      },
      body: body ? JSON.stringify(body) : null
    });
    return res.json();
  };

  // ── NETLIFY API ──────────────────────────────────────────────────────────────
  const netlify = async (path, method = "GET", body = null) => {
    const res = await fetch(`https://api.netlify.com/api/v1${path}`, {
      method,
      headers: {
        "Authorization": `Bearer ${tokens.netlify}`,
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : null
    });
    return res.json();
  };

  // ── MAIN AGENT ───────────────────────────────────────────────────────────────
  const runAgent = async () => {
    setPhase("running");
    setLog([]);
    setResult(null);
    setError(null);

    try {
      // STEP 1: Plan
      addLog("think", "Analyzing mission...");
      await delay(300);

      const planRaw = await callClaude([{
        role: "user",
        content: `You are Agent H1. Plan this project: "${goal}"

Return ONLY this JSON (no markdown):
{
  "projectName": "short-kebab-case-name-max-20-chars",
  "title": "Human readable title",
  "description": "One sentence description",
  "sections": ["section1", "section2", "section3"]
}`
      }]);

      const plan = JSON.parse(planRaw.replace(/```json|```/g, "").trim());
      addLog("plan", `PROJECT: ${plan.title}`);
      addLog("plan", `SECTIONS: ${plan.sections.join(", ")}`);
      await delay(300);

      // STEP 2: Generate code
      addLog("action", "GENERATING CODE...");
      const htmlCode = await callClaude([{
        role: "user",
        content: `Build a complete beautiful website for: "${goal}"

Title: ${plan.title}
Description: ${plan.description}
Sections: ${plan.sections.join(", ")}

Requirements:
- Single HTML file with embedded CSS and JS
- Dark modern design with gradients and animations
- Mobile responsive
- Real compelling content not placeholders
- Professional and impressive

Return ONLY the complete HTML. No explanation. No markdown. Just raw HTML starting with <!DOCTYPE html>`
      }]);

      addLog("result", `Code generated: ${htmlCode.length} characters`);
      await delay(300);

      // STEP 3: Create GitHub repo
      addLog("action", "CREATING GITHUB REPO...");
      const repoName = plan.projectName.slice(0, 20) + "-" + Date.now().toString().slice(-5);
      const repo = await github("/user/repos", "POST", {
        name: repoName,
        description: plan.description,
        private: false,
        auto_init: false
      });

      if (!repo.full_name) throw new Error(`GitHub repo failed: ${JSON.stringify(repo)}`);
      addLog("result", `REPO: github.com/${repo.full_name}`);
      await delay(400);

      // STEP 4: Push files
      addLog("action", "PUSHING CODE TO GITHUB...");

      const toBase64 = str => btoa(unescape(encodeURIComponent(str)));

      await github(`/repos/${repo.full_name}/contents/index.html`, "PUT", {
        message: "Add website - Agent H1",
        content: toBase64(htmlCode)
      });

      await github(`/repos/${repo.full_name}/contents/netlify.toml`, "PUT", {
        message: "Add Netlify config",
        content: toBase64(`[build]\n  publish = "."`)
      });

      addLog("result", "FILES PUSHED TO GITHUB");
      await delay(400);

      // STEP 5: Deploy to Netlify
      addLog("action", "DEPLOYING TO NETLIFY...");

      const site = await netlify("/sites", "POST", {
        name: repoName,
        repo: {
          provider: "github",
          repo: repo.full_name,
          branch: "main",
          cmd: "",
          dir: "."
        }
      });

      await delay(2000);

      const siteUrl = site.ssl_url || site.url || `https://${repoName}.netlify.app`;
      addLog("result", `SITE: ${siteUrl}`);
      addLog("done", "MISSION COMPLETE. SITE IS LIVE.");

      setResult({
        title: plan.title,
        repoUrl: repo.html_url,
        siteUrl
      });
      setPhase("done");

    } catch (e) {
      console.error(e);
      addLog("error", `ERROR: ${e.message}`);
      setError(e.message);
      setPhase("error");
    }
  };

  const reset = () => {
    setPhase("ready");
    setGoal("");
    setLog([]);
    setResult(null);
    setError(null);
  };

  return (
    <div style={s.root}>
      <style>{css}</style>
      <div style={s.scanlines} />

      <div style={s.header}>
        <div style={s.headerTop}>
          <div style={s.logo}><span style={s.logoH}>H</span><span style={s.logo1}>1</span></div>
          <div style={s.headerRight}>
            <div style={s.agentLabel}>DEPLOYMENT ENGINE</div>
            <div style={s.statusRow}>
              <div style={{ ...s.dot, background: phase === "running" ? "#ff3300" : "#00ff88" }} className={phase === "running" ? "pulse-red" : "pulse-green"} />
              <span style={s.statusText}>{
                phase === "boot" ? "BOOTING" :
                phase === "tokens" ? "AWAITING CREDENTIALS" :
                phase === "ready" ? "STANDING BY" :
                phase === "running" ? "DEPLOYING" :
                phase === "done" ? "MISSION COMPLETE" : "ERROR"
              }</span>
            </div>
          </div>
        </div>
        <div style={s.divider} />
        <div style={s.tagline}>AUTONOMOUS BUILD · DEPLOY · DELIVER</div>
      </div>

      {phase === "boot" && (
        <div style={s.terminal} className="fade-in">
          {BOOT_LINES.slice(0, bootIdx).map((line, i) => (
            <div key={i} style={s.bootLine} className="slide-in">
              <span style={s.prompt}>H1›</span> {line}
            </div>
          ))}
          <span style={s.cursor} className="blink">█</span>
        </div>
      )}

      {phase === "tokens" && (
        <div style={s.body} className="fade-in">
          <div style={s.sectionLabel}>CREDENTIALS REQUIRED</div>
          <p style={s.hint}>Stored in memory only. Never saved anywhere.</p>
          <div style={s.fieldGroup}>
            <label style={s.label}>GITHUB PERSONAL ACCESS TOKEN</label>
            <input style={s.input} type="password" placeholder="ghp_xxxxxxxxxxxx" value={tokens.github} onChange={e => setTokens({ ...tokens, github: e.target.value })} />
          </div>
          <div style={s.fieldGroup}>
            <label style={s.label}>NETLIFY PERSONAL ACCESS TOKEN</label>
            <input style={s.input} type="password" placeholder="nfp_xxxxxxxxxxxx" value={tokens.netlify} onChange={e => setTokens({ ...tokens, netlify: e.target.value })} />
          </div>
          <button style={s.btn} onClick={() => { if (tokens.github && tokens.netlify) setPhase("ready"); }} className="btn-glow">
            ⚡ AUTHENTICATE & PROCEED
          </button>
        </div>
      )}

      {phase === "ready" && (
        <div style={s.body} className="fade-in">
          <div style={s.sectionLabel}>MISSION INPUT</div>
          <textarea style={s.textarea} rows={3} placeholder="Describe what to build and deploy... e.g. 'Build a landing page for a barber shop called Fresh Cuts'" value={goal} onChange={e => setGoal(e.target.value)} autoFocus />
          {error && <div style={s.errorBox}>{error}</div>}
          <div style={s.examples}>
            {[
              "Build a landing page for a barber shop called Fresh Cuts",
              "Create a portfolio site for a photographer",
              "Build a restaurant website for Spice Garden",
              "Create a coming soon page for my AI startup"
            ].map((ex, i) => (
              <div key={i} style={s.chip} onClick={() => setGoal(ex)} className="chip-hover">{ex}</div>
            ))}
          </div>
          <button style={s.btn} onClick={runAgent} className="btn-glow">⚡ DEPLOY AGENT H1</button>
        </div>
      )}

      {(phase === "running" || phase === "done" || phase === "error") && (
        <div style={s.body} className="fade-in">
          {phase === "running" && (
            <div style={s.missionBanner}>
              <div style={s.missionLabel}>ACTIVE MISSION</div>
              <div style={s.missionGoal}>"{goal}"</div>
            </div>
          )}

          <div style={s.terminal} ref={logRef}>
            {log.map(entry => (
              <div key={entry.id} style={s.logEntry} className="slide-in">
                <span style={logColor(entry.type)}>{logPrefix(entry.type)}</span>
                <span style={logText(entry.type)}>{entry.text}</span>
              </div>
            ))}
            {phase === "running" && <span style={s.cursor} className="blink">█</span>}
          </div>

          {phase === "done" && result && (
            <div style={s.resultCard} className="fade-in">
              <div style={s.resultBadge}>✓ DEPLOYED SUCCESSFULLY</div>
              <h2 style={s.resultTitle}>{result.title}</h2>
              <div style={s.linkRow}>
                <div style={s.linkLabel}>LIVE SITE</div>
                <a href={result.siteUrl} target="_blank" rel="noreferrer" style={s.link}>{result.siteUrl}</a>
              </div>
              <div style={s.linkRow}>
                <div style={s.linkLabel}>GITHUB REPO</div>
                <a href={result.repoUrl} target="_blank" rel="noreferrer" style={s.link}>{result.repoUrl}</a>
              </div>
              <button style={s.resetBtn} onClick={reset} className="btn-glow">↺ NEW MISSION</button>
            </div>
          )}

          {phase === "error" && (
            <div>
              <div style={s.errorBox}>{error}</div>
              <button style={s.btn} onClick={reset} className="btn-glow">↺ RETRY</button>
            </div>
          )}
        </div>
      )}

      <div style={s.footer}>AGENT H1 · DEPLOYMENT ENGINE · ALL SYSTEMS ACTIVE</div>
    </div>
  );
}

const logPrefix = t => ({ plan: "PLAN   › ", action: "ACT    › ", result: "OUTPUT › ", think: "THINK  › ", done: "DONE   › ", error: "ERROR  › " }[t] || "       › ");
const logColor = t => ({ plan: { color: "#4488ff", fontWeight: 700, flexShrink: 0, fontSize: 11 }, action: { color: "#ffaa00", fontWeight: 700, flexShrink: 0, fontSize: 11 }, result: { color: "#888", fontWeight: 700, flexShrink: 0, fontSize: 11 }, think: { color: "#555", fontWeight: 700, flexShrink: 0, fontSize: 11 }, done: { color: "#00ff88", fontWeight: 700, flexShrink: 0, fontSize: 11 }, error: { color: "#ff4444", fontWeight: 700, flexShrink: 0, fontSize: 11 } }[t] || {});
const logText = t => ({ fontSize: 12, lineHeight: 1.6, color: t === "result" ? "#999" : t === "done" ? "#00ff88" : t === "error" ? "#ff4444" : t === "plan" ? "#ccc" : "#666", whiteSpace: "pre-wrap", wordBreak: "break-word" });

const s = {
  root: { background: "#060608", minHeight: "100vh", maxWidth: 500, margin: "0 auto", fontFamily: "'Courier New', monospace", color: "#ccc", position: "relative" },
  scanlines: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)", pointerEvents: "none", zIndex: 100 },
  header: { padding: "24px 20px 16px", borderBottom: "1px solid #111", background: "linear-gradient(180deg, #0a0a0f 0%, #060608 100%)" },
  headerTop: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  logo: { display: "flex", alignItems: "baseline" },
  logoH: { fontSize: 52, fontWeight: 900, color: "#fff", lineHeight: 1, letterSpacing: -4 },
  logo1: { fontSize: 52, fontWeight: 900, color: "#00ff88", lineHeight: 1 },
  headerRight: { textAlign: "right" },
  agentLabel: { fontSize: 10, letterSpacing: 4, color: "#333", marginBottom: 6 },
  statusRow: { display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" },
  dot: { width: 8, height: 8, borderRadius: "50%" },
  statusText: { fontSize: 10, letterSpacing: 2, color: "#555" },
  divider: { height: 1, background: "linear-gradient(90deg, #00ff8830, #4488ff20, transparent)", marginBottom: 10 },
  tagline: { fontSize: 9, letterSpacing: 3, color: "#333" },
  body: { padding: "20px 16px" },
  sectionLabel: { fontSize: 9, letterSpacing: 3, color: "#333", marginBottom: 10 },
  hint: { fontSize: 12, color: "#444", marginBottom: 16, lineHeight: 1.5 },
  fieldGroup: { marginBottom: 16 },
  label: { display: "block", fontSize: 9, letterSpacing: 2, color: "#555", marginBottom: 6 },
  input: { width: "100%", background: "#0a0a0f", border: "1px solid #1a1a2a", color: "#00ff88", padding: 12, fontSize: 13, fontFamily: "'Courier New', monospace", boxSizing: "border-box", outline: "none" },
  textarea: { width: "100%", background: "#0a0a0f", border: "1px solid #1a1a2a", color: "#00ff88", padding: 14, fontSize: 13, fontFamily: "'Courier New', monospace", boxSizing: "border-box", outline: "none", resize: "none", lineHeight: 1.6, marginBottom: 12 },
  btn: { width: "100%", background: "transparent", border: "2px solid #00ff88", color: "#00ff88", padding: 16, fontSize: 13, fontWeight: 700, letterSpacing: 3, cursor: "pointer", fontFamily: "'Courier New', monospace", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 },
  examples: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 },
  chip: { background: "#0a0a0f", border: "1px solid #141420", padding: "8px 12px", fontSize: 11, color: "#444", cursor: "pointer" },
  errorBox: { background: "#1a0a0a", border: "1px solid #440000", color: "#ff4444", padding: "10px 12px", fontSize: 12, marginBottom: 12 },
  missionBanner: { background: "#0a0a0f", border: "1px solid #1a1a2a", borderLeft: "3px solid #ffaa00", padding: "12px 14px", marginBottom: 12 },
  missionLabel: { fontSize: 9, letterSpacing: 3, color: "#ffaa00", marginBottom: 4 },
  missionGoal: { fontSize: 13, color: "#ccc", lineHeight: 1.5 },
  terminal: { background: "#040406", border: "1px solid #0e0e18", padding: 14, maxHeight: 300, overflowY: "auto", marginBottom: 16 },
  logEntry: { display: "flex", gap: 8, padding: "4px 0", borderBottom: "1px solid #0a0a0f", alignItems: "flex-start" },
  cursor: { color: "#00ff88", display: "inline-block", fontSize: 14 },
  bootLine: { padding: "3px 0", fontSize: 12, color: "#444" },
  prompt: { color: "#00ff88", marginRight: 6 },
  resultCard: { background: "#080810", border: "1px solid #1a1a2a", borderTop: "2px solid #00ff88", padding: 20, marginBottom: 16 },
  resultBadge: { fontSize: 9, letterSpacing: 3, color: "#00ff88", marginBottom: 10 },
  resultTitle: { fontSize: 20, fontWeight: 700, color: "#fff", margin: "0 0 16px" },
  linkRow: { marginBottom: 12 },
  linkLabel: { fontSize: 9, letterSpacing: 2, color: "#555", marginBottom: 4 },
  link: { color: "#4488ff", fontSize: 13, wordBreak: "break-all", textDecoration: "none" },
  resetBtn: { width: "100%", background: "transparent", border: "1px solid #1a1a2a", color: "#444", padding: 14, fontSize: 11, letterSpacing: 3, cursor: "pointer", fontFamily: "'Courier New', monospace", marginTop: 16 },
  footer: { textAlign: "center", fontSize: 8, letterSpacing: 3, color: "#1a1a2a", padding: "16px 0 24px", borderTop: "1px solid #0e0e0e" },
};

const css = `
  * { box-sizing: border-box; }
  .fade-in { animation: fadeIn 0.5s ease; }
  .slide-in { animation: slideIn 0.3s ease; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
  @keyframes slideIn { from { opacity:0; transform:translateX(-4px); } to { opacity:1; transform:translateX(0); } }
  .blink { animation: blink 1s step-end infinite; }
  @keyframes blink { 50% { opacity:0; } }
  .pulse-green { animation: pulseG 2s ease-in-out infinite; }
  @keyframes pulseG { 0%,100% { box-shadow:0 0 4px #00ff88; } 50% { box-shadow:0 0 12px #00ff88; } }
  .pulse-red { animation: pulseR 0.8s ease-in-out infinite; }
  @keyframes pulseR { 0%,100% { box-shadow:0 0 4px #ff3300; } 50% { box-shadow:0 0 12px #ff3300; } }
  .btn-glow:hover { box-shadow:0 0 20px rgba(0,255,136,0.3); background:rgba(0,255,136,0.05); }
  .btn-glow { transition:all 0.2s; }
  .chip-hover:hover { border-color:#2a2a4a; color:#666; background:#0e0e18; }
  .chip-hover { transition:all 0.15s; }
  input:focus, textarea:focus { border-color:#00ff8840 !important; }
  ::-webkit-scrollbar { width:4px; }
  ::-webkit-scrollbar-track { background:#040406; }
  ::-webkit-scrollbar-thumb { background:#1a1a2a; }
  a:hover { color:#00ff88 !important; }
`;
