import { useState, useEffect, useRef } from "react";

// ─── AGENT H1 ────────────────────────────────────────────────────────────────
// A true agentic AI: receives any goal, plans autonomously, loops through
// tasks using web search, builds outputs, delivers everything end-to-end.
// ─────────────────────────────────────────────────────────────────────────────

const MODEL = "claude-sonnet-4-20250514";
const MAX_LOOPS = 6;

const BOOT_LINES = [
  "AGENT H1 INITIALIZING...",
  "LOADING AUTONOMOUS DECISION ENGINE...",
  "WEB SEARCH MODULE: ONLINE",
  "BUILD ENGINE: ONLINE",
  "STRATEGY CORE: ONLINE",
  "EXECUTION LAYER: ONLINE",
  "ALL SYSTEMS NOMINAL.",
  "READY FOR MISSION INPUT.",
];

const EXAMPLES = [
  "Make me money today with no budget",
  "Build me a landing page for a barber shop",
  "Find the best digital product to sell this week and create it",
  "Think of a SaaS idea and write the full pitch",
  "Create a cold outreach campaign for web design clients",
];

export default function AgentH1() {
  const [phase, setPhase] = useState("boot"); // boot | idle | running | done
  const [bootIdx, setBootIdx] = useState(0);
  const [goal, setGoal] = useState("");
  const [log, setLog] = useState([]); // { type: 'plan'|'action'|'result'|'think'|'done', text, loop }
  const [output, setOutput] = useState(null);
  const [loopCount, setLoopCount] = useState(0);
  const [error, setError] = useState(null);
  const logRef = useRef(null);
  const inputRef = useRef(null);

  // Boot sequence
  useEffect(() => {
    if (phase !== "boot") return;
    if (bootIdx < BOOT_LINES.length) {
      const t = setTimeout(() => setBootIdx(i => i + 1), 220 + Math.random() * 150);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setPhase("idle"), 600);
      return () => clearTimeout(t);
    }
  }, [phase, bootIdx]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const addLog = (type, text, loop = null) => {
    setLog(prev => [...prev, { type, text, loop, id: Date.now() + Math.random() }]);
  };

  const callClaude = async (messages, useSearch = false) => {
    const body = {
      model: MODEL,
      max_tokens: 1000,
      messages,
    };
    if (useSearch) {
      body.tools = [{ type: "web_search_20250305", name: "web_search" }];
    }
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    // Extract all text from content blocks
    const text = (data.content || [])
      .map(b => b.type === "text" ? b.text : "")
      .filter(Boolean)
      .join("\n");
    return text;
  };

  const runAgent = async () => {
    if (!goal.trim()) return;
    setPhase("running");
    setLog([]);
    setOutput(null);
    setError(null);
    setLoopCount(0);

    try {
      // ── STEP 1: PLAN ──────────────────────────────────────────────────────
      addLog("think", "Analyzing mission objective...");
      await delay(400);

      const planPrompt = `You are Agent H1, an autonomous AI operator. Your job is to take any goal and break it into a precise action plan.

GOAL: "${goal}"

Create a step-by-step action plan. Each step must be a concrete action (research, build, write, analyze, create, choose platform, etc).

Respond ONLY in this JSON format:
{
  "mission": "One sentence summary of what you will accomplish",
  "needs_web_search": true/false,
  "steps": [
    {"id": 1, "action": "action name", "description": "what exactly to do"},
    {"id": 2, "action": "action name", "description": "what exactly to do"}
  ]
}`;

      const planRaw = await callClaude([{ role: "user", content: planPrompt }]);
      const plan = JSON.parse(planRaw.replace(/```json|```/g, "").trim());

      addLog("plan", `MISSION: ${plan.mission}`);
      await delay(300);
      plan.steps.forEach((s, i) => {
        addLog("plan", `STEP ${s.id}: ${s.action.toUpperCase()} — ${s.description}`);
      });
      await delay(400);

      // ── STEP 2: EXECUTE EACH STEP ─────────────────────────────────────────
      const stepResults = [];

      for (let i = 0; i < plan.steps.length && i < MAX_LOOPS; i++) {
        const step = plan.steps[i];
        setLoopCount(i + 1);
        await delay(300);
        addLog("action", `[LOOP ${i + 1}] EXECUTING: ${step.action.toUpperCase()}`, i + 1);

        const execPrompt = `You are Agent H1. You are executing step ${step.id} of a mission.

OVERALL GOAL: "${goal}"
MISSION: "${plan.mission}"
THIS STEP: ${step.action} — ${step.description}
PREVIOUS RESULTS: ${stepResults.length > 0 ? stepResults.map((r, idx) => `Step ${idx + 1}: ${r}`).join('\n') : 'None yet'}

Execute this step fully. Be specific, detailed, and actionable. Produce real usable output — not placeholders.
Write your output directly. No meta-commentary. Just the work.`;

        const stepResult = await callClaude(
          [{ role: "user", content: execPrompt }],
          plan.needs_web_search && i === 0
        );

        stepResults.push(stepResult.slice(0, 300));
        addLog("result", stepResult, i + 1);
        await delay(200);
      }

      // ── STEP 3: SYNTHESIZE FINAL OUTPUT ───────────────────────────────────
      addLog("think", "Synthesizing all outputs into final deliverable...");
      await delay(400);

      const synthPrompt = `You are Agent H1. You have completed all action steps for this mission.

ORIGINAL GOAL: "${goal}"
MISSION: "${plan.mission}"

STEP RESULTS:
${stepResults.map((r, i) => `--- STEP ${i + 1} ---\n${r}`).join('\n\n')}

Now produce the FINAL COMPLETE DELIVERABLE. This is what the user actually gets.

Respond in this JSON format ONLY (no markdown, no backticks):
{
  "title": "What was accomplished",
  "summary": "2-3 sentence summary of what was done and achieved",
  "deliverables": [
    {"label": "Deliverable name", "content": "Full content here — be complete, not a placeholder"}
  ],
  "next_actions": ["Specific action 1", "Specific action 2", "Specific action 3"],
  "platforms": ["Best platform to use/sell/launch — be specific"],
  "estimated_value": "e.g. $200-500/week or saves 5 hours/week"
}`;

      const synthRaw = await callClaude([{ role: "user", content: synthPrompt }]);
      const synth = JSON.parse(synthRaw.replace(/```json|```/g, "").trim());

      addLog("done", "MISSION COMPLETE. DELIVERABLE READY.");
      setOutput(synth);
      setPhase("done");

    } catch (e) {
      console.error(e);
      setError("Agent encountered an error. Check your input and retry.");
      setPhase("idle");
    }
  };

  const reset = () => {
    setPhase("idle");
    setGoal("");
    setLog([]);
    setOutput(null);
    setError(null);
    setLoopCount(0);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const delay = ms => new Promise(r => setTimeout(r, ms));

  return (
    <div style={s.root}>
      <style>{css}</style>

      {/* SCANLINE OVERLAY */}
      <div style={s.scanlines} />

      {/* HEADER */}
      <div style={s.header}>
        <div style={s.headerTop}>
          <div style={s.logoBlock}>
            <span style={s.logoH}>H</span>
            <span style={s.logo1}>1</span>
          </div>
          <div style={s.headerRight}>
            <div style={s.agentLabel}>AGENT H1</div>
            <div style={s.statusRow}>
              <div style={{ ...s.statusDot, background: phase === "running" ? "#ff3300" : "#00ff88" }} className={phase === "running" ? "pulse-red" : "pulse-green"} />
              <span style={s.statusText}>{phase === "boot" ? "BOOTING" : phase === "running" ? "ACTIVE MISSION" : phase === "done" ? "MISSION COMPLETE" : "STANDING BY"}</span>
            </div>
          </div>
        </div>
        <div style={s.headerDivider} />
        <div style={s.tagline}>AUTONOMOUS AI OPERATOR — THINK. ACT. DELIVER.</div>
      </div>

      {/* BOOT PHASE */}
      {phase === "boot" && (
        <div style={s.terminal} className="fade-in">
          {BOOT_LINES.slice(0, bootIdx).map((line, i) => (
            <div key={i} style={s.bootLine} className="slide-in">
              <span style={s.prompt}>H1›</span> {line}
            </div>
          ))}
          {bootIdx < BOOT_LINES.length && <span style={s.cursor} className="blink">█</span>}
        </div>
      )}

      {/* IDLE / INPUT */}
      {(phase === "idle" || phase === "running" || phase === "done") && (
        <div style={s.body}>

          {/* MISSION INPUT */}
          {phase === "idle" && (
            <div className="fade-in">
              <div style={s.sectionLabel}>MISSION INPUT</div>
              <div style={s.inputWrap}>
                <textarea
                  ref={inputRef}
                  style={s.missionInput}
                  rows={3}
                  placeholder="State your goal. Agent H1 will handle the rest..."
                  value={goal}
                  onChange={e => setGoal(e.target.value)}
                  autoFocus
                />
              </div>
              {error && <div style={s.error}>{error}</div>}
              <div style={s.examplesLabel}>EXAMPLE MISSIONS:</div>
              <div style={s.examples}>
                {EXAMPLES.map((ex, i) => (
                  <div key={i} style={s.exampleChip} onClick={() => setGoal(ex)} className="chip-hover">
                    {ex}
                  </div>
                ))}
              </div>
              <button style={s.launchBtn} onClick={runAgent} className="btn-glow">
                <span style={s.btnIcon}>⚡</span> DEPLOY AGENT H1
              </button>
            </div>
          )}

          {/* ACTIVE LOG */}
          {(phase === "running" || phase === "done") && (
            <div className="fade-in">
              {phase === "running" && (
                <div style={s.missionBanner}>
                  <div style={s.missionLabel}>ACTIVE MISSION</div>
                  <div style={s.missionGoal}>"{goal}"</div>
                  <div style={s.loopCounter}>LOOP {loopCount} / {MAX_LOOPS}</div>
                </div>
              )}

              <div style={s.terminal} ref={logRef}>
                {log.map((entry) => (
                  <div key={entry.id} style={s.logEntry} className="slide-in">
                    <span style={logColor(entry.type)}>{logPrefix(entry.type)}</span>
                    <span style={logTextStyle(entry.type)}>{entry.text}</span>
                  </div>
                ))}
                {phase === "running" && <span style={s.cursor} className="blink">█</span>}
              </div>

              {/* FINAL OUTPUT */}
              {phase === "done" && output && (
                <div style={s.outputWrap} className="fade-in">
                  <div style={s.outputHeader}>
                    <span style={s.outputBadge}>✓ DELIVERABLE</span>
                    <h2 style={s.outputTitle}>{output.title}</h2>
                    <p style={s.outputSummary}>{output.summary}</p>
                  </div>

                  {output.estimated_value && (
                    <div style={s.valueBar}>
                      <span style={s.valueLabel}>ESTIMATED VALUE</span>
                      <span style={s.valueAmount}>{output.estimated_value}</span>
                    </div>
                  )}

                  {output.deliverables?.map((d, i) => (
                    <div key={i} style={s.deliverable}>
                      <div style={s.deliverableLabel}>{d.label}</div>
                      <div style={s.deliverableContent}>{d.content}</div>
                    </div>
                  ))}

                  {output.platforms?.length > 0 && (
                    <div style={s.deliverable}>
                      <div style={s.deliverableLabel}>PLATFORMS TO USE</div>
                      {output.platforms.map((p, i) => (
                        <div key={i} style={s.platformItem}>▸ {p}</div>
                      ))}
                    </div>
                  )}

                  {output.next_actions?.length > 0 && (
                    <div style={s.deliverable}>
                      <div style={s.deliverableLabel}>EXECUTE NOW</div>
                      {output.next_actions.map((a, i) => (
                        <div key={i} style={s.actionItem}>
                          <span style={s.actionNum}>{i + 1}</span>
                          <span>{a}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <button style={s.resetBtn} onClick={reset} className="btn-glow">
                    ↺ NEW MISSION
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* FOOTER */}
      <div style={s.footer}>AGENT H1 · AUTONOMOUS OPERATIONS · ALL SYSTEMS ACTIVE</div>
    </div>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const logPrefix = type => ({
  plan:   "PLAN   › ",
  action: "ACT    › ",
  result: "OUTPUT › ",
  think:  "THINK  › ",
  done:   "DONE   › ",
}[type] || "       › ");

const logColor = type => ({
  plan:   { color: "#4488ff", fontWeight: 700, flexShrink: 0, fontSize: 11 },
  action: { color: "#ffaa00", fontWeight: 700, flexShrink: 0, fontSize: 11 },
  result: { color: "#888", fontWeight: 700, flexShrink: 0, fontSize: 11 },
  think:  { color: "#555", fontWeight: 700, flexShrink: 0, fontSize: 11 },
  done:   { color: "#00ff88", fontWeight: 700, flexShrink: 0, fontSize: 11 },
}[type] || {});

const logTextStyle = type => ({
  fontSize: 12,
  lineHeight: 1.6,
  color: type === "result" ? "#999" : type === "done" ? "#00ff88" : type === "plan" ? "#ccc" : "#666",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
});

// ─── STYLES ──────────────────────────────────────────────────────────────────

const s = {
  root: { background: "#060608", minHeight: "100vh", maxWidth: 500, margin: "0 auto", fontFamily: "'Courier New', Courier, monospace", color: "#ccc", position: "relative", overflow: "hidden" },
  scanlines: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)", pointerEvents: "none", zIndex: 100 },
  header: { padding: "24px 20px 16px", borderBottom: "1px solid #111", background: "linear-gradient(180deg, #0a0a0f 0%, #060608 100%)" },
  headerTop: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  logoBlock: { display: "flex", alignItems: "baseline", gap: 0 },
  logoH: { fontSize: 52, fontWeight: 900, color: "#fff", lineHeight: 1, letterSpacing: -4 },
  logo1: { fontSize: 52, fontWeight: 900, color: "#00ff88", lineHeight: 1 },
  headerRight: { textAlign: "right" },
  agentLabel: { fontSize: 10, letterSpacing: 4, color: "#333", marginBottom: 6 },
  statusRow: { display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" },
  statusDot: { width: 8, height: 8, borderRadius: "50%" },
  statusText: { fontSize: 10, letterSpacing: 2, color: "#555" },
  headerDivider: { height: 1, background: "linear-gradient(90deg, #00ff8830, #4488ff20, transparent)", marginBottom: 10 },
  tagline: { fontSize: 9, letterSpacing: 3, color: "#333" },
  body: { padding: "20px 16px" },
  sectionLabel: { fontSize: 9, letterSpacing: 3, color: "#333", marginBottom: 10 },
  inputWrap: { marginBottom: 12 },
  missionInput: { width: "100%", background: "#0a0a0f", border: "1px solid #1a1a2a", color: "#00ff88", padding: 14, fontSize: 14, fontFamily: "'Courier New', monospace", boxSizing: "border-box", outline: "none", resize: "none", lineHeight: 1.6 },
  examplesLabel: { fontSize: 9, letterSpacing: 3, color: "#2a2a3a", marginBottom: 8 },
  examples: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 },
  exampleChip: { background: "#0a0a0f", border: "1px solid #141420", padding: "8px 12px", fontSize: 11, color: "#444", cursor: "pointer", letterSpacing: 0.5 },
  launchBtn: { width: "100%", background: "transparent", border: "2px solid #00ff88", color: "#00ff88", padding: 16, fontSize: 13, fontWeight: 700, letterSpacing: 3, cursor: "pointer", fontFamily: "'Courier New', monospace", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 },
  btnIcon: { fontSize: 16 },
  error: { background: "#1a0a0a", border: "1px solid #440000", color: "#ff4444", padding: "10px 12px", fontSize: 12, marginBottom: 12 },
  missionBanner: { background: "#0a0a0f", border: "1px solid #1a1a2a", borderLeft: "3px solid #ffaa00", padding: "12px 14px", marginBottom: 12 },
  missionLabel: { fontSize: 9, letterSpacing: 3, color: "#ffaa00", marginBottom: 4 },
  missionGoal: { fontSize: 13, color: "#ccc", lineHeight: 1.5 },
  loopCounter: { fontSize: 9, letterSpacing: 2, color: "#333", marginTop: 6 },
  terminal: { background: "#040406", border: "1px solid #0e0e18", padding: 14, maxHeight: 280, overflowY: "auto", marginBottom: 16 },
  logEntry: { display: "flex", gap: 8, padding: "4px 0", borderBottom: "1px solid #0a0a0f", alignItems: "flex-start" },
  cursor: { color: "#00ff88", display: "inline-block", fontSize: 14 },
  bootLine: { padding: "3px 0", fontSize: 12, color: "#444" },
  prompt: { color: "#00ff88", marginRight: 6 },
  outputWrap: { marginTop: 4 },
  outputHeader: { background: "#080810", border: "1px solid #1a1a2a", borderTop: "2px solid #00ff88", padding: 16, marginBottom: 12 },
  outputBadge: { fontSize: 9, letterSpacing: 3, color: "#00ff88", display: "block", marginBottom: 8 },
  outputTitle: { fontSize: 18, fontWeight: 700, color: "#fff", margin: "0 0 8px", lineHeight: 1.3 },
  outputSummary: { fontSize: 13, color: "#777", lineHeight: 1.6, margin: 0 },
  valueBar: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0a1a0f", border: "1px solid #1a3a2a", padding: "10px 14px", marginBottom: 12 },
  valueLabel: { fontSize: 9, letterSpacing: 3, color: "#555" },
  valueAmount: { fontSize: 15, fontWeight: 700, color: "#00ff88" },
  deliverable: { background: "#040406", border: "1px solid #0e0e18", padding: 14, marginBottom: 8 },
  deliverableLabel: { fontSize: 9, letterSpacing: 3, color: "#4488ff", marginBottom: 10 },
  deliverableContent: { fontSize: 13, color: "#888", lineHeight: 1.7, whiteSpace: "pre-wrap" },
  platformItem: { fontSize: 13, color: "#aaa", padding: "4px 0", borderBottom: "1px solid #0a0a0f" },
  actionItem: { display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid #0a0a0f", fontSize: 13, color: "#aaa" },
  actionNum: { background: "#00ff88", color: "#000", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1 },
  resetBtn: { width: "100%", background: "transparent", border: "1px solid #1a1a2a", color: "#444", padding: 14, fontSize: 11, letterSpacing: 3, cursor: "pointer", fontFamily: "'Courier New', monospace", marginTop: 12, marginBottom: 24 },
  footer: { textAlign: "center", fontSize: 8, letterSpacing: 3, color: "#1a1a2a", padding: "16px 0 24px", borderTop: "1px solid #0e0e0e" },
};

const css = `
  * { box-sizing: border-box; }
  .fade-in { animation: fadeIn 0.5s ease; }
  .slide-in { animation: slideIn 0.3s ease; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideIn { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: translateX(0); } }
  .blink { animation: blink 1s step-end infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  .pulse-green { animation: pulseGreen 2s ease-in-out infinite; }
  @keyframes pulseGreen { 0%,100% { box-shadow: 0 0 4px #00ff88; } 50% { box-shadow: 0 0 12px #00ff88; } }
  .pulse-red { animation: pulseRed 0.8s ease-in-out infinite; }
  @keyframes pulseRed { 0%,100% { box-shadow: 0 0 4px #ff3300; } 50% { box-shadow: 0 0 12px #ff3300; } }
  .btn-glow:hover { box-shadow: 0 0 20px rgba(0,255,136,0.3); background: rgba(0,255,136,0.05); }
  .btn-glow { transition: all 0.2s; }
  .chip-hover:hover { border-color: #2a2a4a; color: #666; background: #0e0e18; }
  .chip-hover { transition: all 0.15s; }
  textarea:focus { border-color: #00ff8840 !important; box-shadow: 0 0 12px rgba(0,255,136,0.05); }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: #040406; }
  ::-webkit-scrollbar-thumb { background: #1a1a2a; }
`;
