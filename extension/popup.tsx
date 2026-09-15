import { useEffect, useState } from "react"
import { isResumeData, type ResumeData } from "~types/resume"

interface TaggedResume {
  tag: string
  storedAt: string
  resume: ResumeData
}

function IndexPopup() {
  const [raw, setRaw] = useState("")
  const [tagInput, setTagInput] = useState("")
  const [error, setError] = useState("")
  const [activeResume, setActiveResume] = useState<ResumeData | null>(null)
  const [activeTag, setActiveTag] = useState<string>("")
  const [saved, setSaved] = useState(false)
  const [taggedResumes, setTaggedResumes] = useState<TaggedResume[]>([])
  const [trackError, setTrackError] = useState("")
  const [backendUrl, setBackendUrl] = useState("http://localhost:8000")
  const [appUrl, setAppUrl] = useState("http://localhost:5173")
  const [autofillMode, setAutofillMode] = useState<"ask" | "always">("ask")
  const [trackFills, setTrackFills] = useState(false)
  const [autofillLog, setAutofillLog] = useState<Array<Record<string, unknown>>>([])
  const [extTokenInput, setExtTokenInput] = useState("")
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState("")
  const [syncError, setSyncError] = useState("")

  useEffect(() => {
    chrome.storage.local.get(
      ["resume", "resumes", "backendUrl", "appUrl", "autofillMode", "trackFills", "autofillLog"],
      (result) => {
        if (result.resume && isResumeData(result.resume)) {
          setActiveResume(result.resume as ResumeData)
        }
        if (Array.isArray(result.resumes)) {
          setTaggedResumes(result.resumes as TaggedResume[])
        }
        if (typeof result.backendUrl === "string" && result.backendUrl.trim()) {
          setBackendUrl(result.backendUrl)
        }
        if (typeof result.appUrl === "string" && result.appUrl.trim()) {
          setAppUrl(result.appUrl)
        }
        if (result.autofillMode === "always" || result.autofillMode === "ask") {
          setAutofillMode(result.autofillMode)
        }
        setTrackFills(Boolean(result.trackFills))
        if (Array.isArray(result.autofillLog)) {
          setAutofillLog(result.autofillLog as Array<Record<string, unknown>>)
        }
        // Determine active tag from tagged list if possible
        if (result.resume && Array.isArray(result.resumes)) {
          const match = (result.resumes as TaggedResume[]).find(
            (tr) => JSON.stringify(tr.resume) === JSON.stringify(result.resume)
          )
          if (match) setActiveTag(match.tag)
        }
      }
    )
  }, [])

  async function handleSyncFromAccount() {
    setSyncMsg("")
    setSyncError("")
    const url = backendUrl.trim().replace(/\/+$/, "")
    const token = extTokenInput.trim()
    if (!url) {
      setSyncError("Enter the backend URL (e.g. http://localhost:8000).")
      return
    }
    if (!token) {
      setSyncError("Paste the sync token you generated in the app (Account → Chrome extension sync).")
      return
    }
    setSyncing(true)
    try {
      const res = await fetch(`${url}/api/ext/resumes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      })
      const text = await res.text()
      let data: { resumes?: Array<{ tag?: string; resume?: unknown }> } = {}
      try {
        data = JSON.parse(text)
      } catch {
        /* fall through */
      }
      if (!res.ok) {
        const detail =
          (data as { detail?: unknown })?.detail ||
          (typeof data === "string" ? data : `Request failed (${res.status})`)
        const readable =
          detail && typeof detail === "object"
            ? (detail as { detail?: string }).detail || JSON.stringify(detail)
            : String(detail ?? res.statusText)
        setSyncError(`Sync failed: ${readable}`)
        setSyncing(false)
        return
      }
      const synced = (data.resumes ?? [])
        .filter((r) => r.resume && isResumeData(r.resume))
        .map((r) => ({
          tag: r.tag || "Resume",
          storedAt: new Date().toISOString(),
          resume: r.resume as ResumeData
        }))
      if (synced.length === 0) {
        setSyncError(
          "No resumes found in your account. Save a resume in the app first, then try again."
        )
        setSyncing(false)
        return
      }
      // Merge: cloud entries overwrite same-tag manual entries, manual-only tags survive
      const cloudTags = new Set(synced.map((s) => s.tag))
      const manualKept = taggedResumes.filter((tr) => !cloudTags.has(tr.tag))
      const merged = [...manualKept, ...synced]
      chrome.storage.local.set({ resumes: merged, resume: synced[0].resume }, () => {
        setTaggedResumes(merged)
        setActiveResume(synced[0].resume)
        setActiveTag(synced[0].tag)
        setRaw(JSON.stringify(synced[0].resume, null, 2))
        setExtTokenInput("")
        setSyncMsg(`Synced ${synced.length} resume(s) from your account.`)
      })
    } catch (err) {
      setSyncError(
        `Could not reach the backend at ${backendUrl}. Check the URL and that the server is running.`
      )
    } finally {
      setSyncing(false)
    }
  }

  function handleLoad() {
    setError("")
    setSaved(false)
    setTrackError("")
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (e) {
      setError(`Invalid JSON: ${(e as Error).message}`)
      return
    }
    if (!isResumeData(parsed)) {
      setError(
        "JSON does not match the resume shape. Expected { contact: { fullName, email, phone, ... }, professionalSummary, skills[], experience[], education[], projects[], certifications[] }."
      )
      return
    }
    const resume = parsed as ResumeData
    const tag = tagInput.trim() || resume.contact.fullName || "Unnamed"
    const entry: TaggedResume = {
      tag,
      storedAt: new Date().toISOString(),
      resume
    }

    const updated = taggedResumes.filter((tr) => tr.tag !== tag)
    updated.push(entry)

    chrome.storage.local.set(
      { resume, resumes: updated },
      () => {
        setActiveResume(resume)
        setActiveTag(tag)
        setTaggedResumes(updated)
        setSaved(true)
        setTagInput("")
      }
    )
  }

  function handleUse(tr: TaggedResume) {
    chrome.storage.local.set({ resume: tr.resume }, () => {
      setActiveResume(tr.resume)
      setActiveTag(tr.tag)
      setRaw(JSON.stringify(tr.resume, null, 2))
      setSaved(false)
      setError("")
      setTrackError("")
    })
  }

  function handleDelete(tag: string) {
    const updated = taggedResumes.filter((tr) => tr.tag !== tag)
    chrome.storage.local.set({ resumes: updated }, () => {
      setTaggedResumes(updated)
      if (activeTag === tag) {
        chrome.storage.local.remove("resume", () => {
          setActiveResume(null)
          setActiveTag("")
          setRaw("")
          setSaved(false)
        })
      }
    })
  }

  function handleClear() {
    chrome.storage.local.remove(["resume"], () => {
      setActiveResume(null)
      setActiveTag("")
      setRaw("")
      setSaved(false)
      setError("")
      setTrackError("")
    })
  }

  async function fillCurrentForm() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) {
      setError("Could not find the active tab.")
      return
    }
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "FILL_RESUME" })
    } catch {
      setError(
        "The content script is not running on this page. Open a supported job board (LinkedIn, Indeed, Workday, Greenhouse, or Lever) and try again."
      )
    }
  }

  async function trackApplication() {
    setTrackError("")
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.url) {
      setTrackError("Cannot read the current tab URL. If this is a chrome:// page, open a regular page first.")
      return
    }
    const url = tab.url
    const title = tab.title || ""
    const origin = appUrl.trim().replace(/\/+$/, "") || "http://localhost:5173"
    chrome.tabs.create({
      url:
        origin +
        "/applications?url=" +
        encodeURIComponent(url) +
        "&title=" +
        encodeURIComponent(title) +
        (activeTag
          ? "&resumeTag=" + encodeURIComponent(activeTag)
          : "")
    })
  }

  return (
    <div style={{ width: 400, padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ margin: 0, fontSize: 16 }}>Resume Autofill</h2>
      <p style={{ margin: "4px 0 12px", color: "#555", fontSize: 13 }}>
        Import your resume and auto-fill job forms.
      </p>

      <div
        style={{
          marginBottom: 12,
          padding: 12,
          borderRadius: 6,
          background: "#f8fafc",
          border: "1px solid #e2e8f0"
        }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
          Sync from account <span style={{ fontWeight: 400, color: "#0f172a" }}>(Pro)</span>
        </div>
        <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
          Backend URL
          <input
            value={backendUrl}
            onChange={(e) => {
              setBackendUrl(e.target.value)
              chrome.storage.local.set({ backendUrl: e.target.value })
            }}
            placeholder="http://localhost:8000"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "6px 8px",
              fontSize: 12,
              marginTop: 4,
              border: "1px solid #d1d5db",
              borderRadius: 4
            }}
          />
        </label>
        <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
          Sync token
          <input
            value={extTokenInput}
            onChange={(e) => setExtTokenInput(e.target.value)}
            placeholder="Paste token from Account → Chrome extension sync"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "6px 8px",
              fontSize: 12,
              marginTop: 4,
              border: "1px solid #d1d5db",
              borderRadius: 4
            }}
          />
        </label>
        <button
          onClick={handleSyncFromAccount}
          disabled={syncing}
          style={{
            width: "100%",
            marginTop: 8,
            padding: "8px 0",
            background: "#0f172a",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: syncing ? "not-allowed" : "pointer",
            fontSize: 12,
            fontWeight: 600
          }}>
          {syncing ? "Syncing…" : "Sync resumes from account"}
        </button>
        {syncMsg && <div style={{ marginTop: 6, color: "#15803d", fontSize: 12 }}>{syncMsg}</div>}
        {syncError && <div style={{ marginTop: 6, color: "#b91c1c", fontSize: 12 }}>{syncError}</div>}
        <p style={{ marginTop: 8, color: "#94a3b8", fontSize: 11 }}>
          Pro only. Generate a token in the app (Account → Chrome extension sync), then paste it above. It expires in
          5 minutes.
        </p>
      </div>

      {activeResume && (
        <div
          style={{
            padding: 10,
            borderRadius: 6,
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            marginBottom: 12,
            fontSize: 13
          }}>
          <div style={{ fontWeight: 600 }}>
            {saved ? "Saved and ready:" : "Active resume:"}
          </div>
          <div>
            {activeResume.contact.fullName || "(no name)"} ·{" "}
            {activeResume.skills.length} skills
            {activeTag && (
              <span style={{ marginLeft: 6, color: "#15803d" }}>
                [{activeTag}]
              </span>
            )}
          </div>
          {saved && (
            <div style={{ color: "#15803d", marginTop: 4 }}>
              Saved to storage
            </div>
          )}
        </div>
      )}

      {taggedResumes.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 6
            }}>
            Saved resumes
          </div>
          {taggedResumes.map((tr) => (
            <div
              key={tr.tag}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 8px",
                borderRadius: 4,
                background:
                  tr.tag === activeTag ? "#eff6ff" : "#f9fafb",
                border: "1px solid #e5e7eb",
                marginBottom: 4,
                fontSize: 12
              }}>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <strong>{tr.tag}</strong>
                {" · "}
                {tr.resume.contact.fullName || "(no name)"}
              </span>
              <button
                onClick={() => handleUse(tr)}
                style={{
                  padding: "3px 8px",
                  background: tr.tag === activeTag ? "#16a34a" : "#2563eb",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 11
                }}>
                {tr.tag === activeTag ? "Active" : "Use"}
              </button>
              <button
                onClick={() => handleDelete(tr.tag)}
                style={{
                  padding: "3px 8px",
                  background: "#fff",
                  color: "#b91c1c",
                  border: "1px solid #e5e7eb",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 11
                }}>
                Del
              </button>
            </div>
          ))}
        </div>
      )}

      <label
        style={{ display: "block", fontSize: 13, marginBottom: 4 }}
        htmlFor="resume-tag">
        Tag (optional):
      </label>
      <input
        id="resume-tag"
        value={tagInput}
        onChange={(e) => setTagInput(e.target.value)}
        placeholder="e.g. Frontend roles, Company X"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "6px 8px",
          fontSize: 13,
          border: "1px solid #d1d5db",
          borderRadius: 4,
          marginBottom: 8
        }}
      />

      <label
        style={{ display: "block", fontSize: 13, marginBottom: 4 }}
        htmlFor="resume-json">
        Paste resume JSON (export from the builder):
      </label>
      <textarea
        id="resume-json"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder='{"contact":{"fullName":"..."}, ...}'
        style={{
          width: "100%",
          height: 140,
          boxSizing: "border-box",
          fontFamily: "monospace",
          fontSize: 12
        }}
      />

      {error && (
        <div style={{ marginTop: 8, color: "#b91c1c", fontSize: 12 }}>{error}</div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          onClick={handleLoad}
          style={{
            flex: 1,
            padding: "8px 0",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13
          }}>
          Load resume
        </button>
        <button
          onClick={handleClear}
          style={{
            padding: "8px 12px",
            background: "#fff",
            color: "#b91c1c",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13
          }}>
          Clear active
        </button>
      </div>

      <button
        onClick={fillCurrentForm}
        disabled={!activeResume}
        style={{
          width: "100%",
          marginTop: 10,
          padding: "10px 0",
          background: activeResume ? "#16a34a" : "#d1d5db",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: activeResume ? "pointer" : "not-allowed",
          fontSize: 13,
          fontWeight: 600
        }}>
        Fill current job form
        {activeTag && activeResume ? ` (${activeTag})` : ""}
      </button>

      <button
        onClick={trackApplication}
        style={{
          width: "100%",
          marginTop: 8,
          padding: "8px 0",
          background: "#7c3aed",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          fontSize: 13
        }}>
        Track this application in the app
      </button>

      {trackError && (
        <div style={{ marginTop: 6, color: "#b91c1c", fontSize: 12 }}>{trackError}</div>
      )}

      <div
        style={{
          marginTop: 12,
          padding: 10,
          borderRadius: 6,
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          fontSize: 12
        }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Autofill consent</div>
        <label style={{ display: "block", marginBottom: 6 }}>
          Fill mode:{" "}
          <select
            value={autofillMode}
            onChange={(e) => {
              const next = e.target.value as "ask" | "always"
              setAutofillMode(next)
              chrome.storage.local.set({ autofillMode: next })
            }}
            style={{ padding: "4px 6px", marginLeft: 4, borderRadius: 4, border: "1px solid #d1d5db" }}>
            <option value="ask">Ask each time (preview first)</option>
            <option value="always">Always fill (slim confirm above form)</option>
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <input
            type="checkbox"
            checked={trackFills}
            onChange={(e) => {
              setTrackFills(e.target.checked)
              chrome.storage.local.set({ trackFills: e.target.checked })
            }}
          />
          Track fills in the app (opens the tracker after filling)
        </label>
        <label style={{ display: "block", marginBottom: 6 }}>
          App origin for deep links
          <input
            value={appUrl}
            onChange={(e) => {
              setAppUrl(e.target.value)
              chrome.storage.local.set({ appUrl: e.target.value })
            }}
            placeholder="http://localhost:5173"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "5px 8px",
              fontSize: 12,
              marginTop: 4,
              border: "1px solid #d1d5db",
              borderRadius: 4
            }}
          />
        </label>
        {autofillLog.length > 0 && (
          <div>
            <div style={{ fontWeight: 600, margin: "4px 0 4px" }}>Recent fills</div>
            {autofillLog.slice(0, 5).map((entry, i) => (
              <div key={i} style={{ fontSize: 11, color: "#475569", padding: "3px 0", borderTop: "1px solid #e2e8f0" }}>
                {entry.status === "filled" ? "✓" : "—"} {String(entry.host || "")} · {String(entry.fieldCount || 0)} field(s) ·{" "}
                {entry.filledAt ? new Date(String(entry.filledAt)).toLocaleTimeString() : ""}
              </div>
            ))}
          </div>
        )}
      </div>

      <p style={{ marginTop: 12, color: "#888", fontSize: 11 }}>
        The extension previews which fields it will fill and writes nothing until
        you tap Fill.
      </p>
    </div>
  )
}

export default IndexPopup
