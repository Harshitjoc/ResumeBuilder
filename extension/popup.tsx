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

  useEffect(() => {
    chrome.storage.local.get(["resume", "resumes"], (result) => {
      if (result.resume && isResumeData(result.resume)) {
        setActiveResume(result.resume as ResumeData)
      }
      if (Array.isArray(result.resumes)) {
        setTaggedResumes(result.resumes as TaggedResume[])
      }
      // Determine active tag from tagged list if possible
      if (result.resume && Array.isArray(result.resumes)) {
        const match = (result.resumes as TaggedResume[]).find(
          (tr) => JSON.stringify(tr.resume) === JSON.stringify(result.resume)
        )
        if (match) setActiveTag(match.tag)
      }
    })
  }, [])

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
    chrome.tabs.create({
      url:
        "http://localhost:5180/applications?url=" +
        encodeURIComponent(url) +
        "&title=" +
        encodeURIComponent(title)
    })
  }

  return (
    <div style={{ width: 400, padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ margin: 0, fontSize: 16 }}>Resume Autofill</h2>
      <p style={{ margin: "4px 0 12px", color: "#555", fontSize: 13 }}>
        Import your resume and auto-fill job forms.
      </p>

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

      <p style={{ marginTop: 12, color: "#888", fontSize: 11 }}>
        Tip: open a supported job board (LinkedIn, Indeed, Workday, Greenhouse,
        or Lever), then click "Fill current job form".
      </p>
    </div>
  )
}

export default IndexPopup
