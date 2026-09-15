import type { PlasmoCSConfig } from "plasmo"
import type { ResumeData } from "~types/resume"

export const config: PlasmoCSConfig = {
  matches: [
    "https://www.linkedin.com/*",
    "https://*.indeed.com/*",
    "https://*.myworkdayjobs.com/*",
    "https://boards.greenhouse.io/*",
    "https://jobs.lever.co/*"
  ],
  run_at: "document_idle"
}

interface FieldCandidate {
  element: HTMLInputElement | HTMLTextAreaElement
  value: string
  key: string
}

interface FillLogEntry {
  host: string
  url: string
  title: string
  filledAt: string
  fieldCount: number
  resumeTag: string
  status: "filled" | "skipped"
}

const FIELD_DEFINITIONS: Array<{
  key: string
  matchers: string[]
}> = [
  {
    key: "firstName",
    matchers: [
      "first name", "firstname", "given name",
      "jobapply_firstname", "first_name", "fname"
    ]
  },
  {
    key: "lastName",
    matchers: [
      "last name", "lastname", "family name", "surname",
      "jobapply_lastname", "last_name", "lname"
    ]
  },
  {
    key: "fullName",
    matchers: ["full name", "fullname", "jobapply_fullname"]
  },
  {
    key: "email",
    matchers: [
      "email", "e-mail", "email address",
      "jobapply_email", "emailaddress"
    ]
  },
  {
    key: "phone",
    matchers: [
      "phone", "telephone", "mobile", "cell", "contact number",
      "phone number", "jobapply_phone", "phonenumber"
    ]
  },
  {
    key: "location",
    matchers: [
      "city", "location", "state", "zip", "postal", "address",
      "jobapply_city", "jobapply_location"
    ]
  },
  {
    key: "linkedin",
    matchers: [
      "linkedin", "linkedinurl", "linkedin_url",
      "job_application_linkedin_url"
    ]
  },
  {
    key: "education",
    matchers: ["school", "university", "college", "education"]
  }
]

function normalizeToken(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function collectFieldAttributes(el: HTMLInputElement | HTMLTextAreaElement): string[] {
  const parts: string[] = []
  const attrs = ["name", "id", "aria-label", "placeholder", "data-testid", "data-automation-id"]
  for (const attr of attrs) {
    const val = el.getAttribute(attr)
    if (val) parts.push(val)
  }
  const label = findLabelFor(el)
  if (label) parts.push(label)
  return parts
}

function findLabelFor(el: HTMLElement): string | null {
  const id = el.getAttribute("id")
  if (id) {
    try {
      const label = document.querySelector(`label[for="${CSS.escape(id)}"]`)
      if (label && label.textContent) return label.textContent
    } catch {
      /* ignore invalid CSS selectors */
    }
  }
  const wrap = el.closest("label")
  if (wrap && wrap.textContent) return wrap.textContent
  return null
}

function matchField(
  el: HTMLInputElement | HTMLTextAreaElement,
  def: (typeof FIELD_DEFINITIONS)[number]
): boolean {
  const haystacks = collectFieldAttributes(el).map(normalizeToken)
  return def.matchers.some((matcher) => {
    const m = normalizeToken(matcher)
    return haystacks.some((h) => h.includes(m))
  })
}

function getResumeValues(resume: ResumeData): Record<string, string> {
  const phone =
    resume.contact.phone ||
    resume.contact.email ||
    ""
  const linkedin = resume.contact.linkedin || resume.contact.website || ""
  const school =
    resume.education && resume.education.length > 0
      ? resume.education[0].school
      : ""

  return {
    fullName: resume.contact.fullName || "",
    firstName: (resume.contact.fullName || "").split(/\s+/)[0] || "",
    lastName:
      (resume.contact.fullName || "").split(/\s+/).slice(1).join(" ") || "",
    email: resume.contact.email || "",
    phone,
    location: "",
    linkedin,
    education: school
  }
}

function isFillable(el: Element): el is HTMLInputElement | HTMLTextAreaElement {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (el.disabled || el.readOnly) return false
    const type = (el as HTMLInputElement).type
    if (type && ["hidden", "submit", "button", "reset", "file", "checkbox", "radio"].includes(type)) {
      return false
    }
    // Skip job-search bar inputs / autocomplete origin fields
    const cls = (el.className || "").toString().toLowerCase()
    if (/search|jobq|jobs-search/.test(cls)) return false
    return true
  }
  return false
}

function setNativeValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string
): void {
  const valueSetter = Object.getOwnPropertyDescriptor(
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    "value"
  )?.set
  const prototype = Object.getPrototypeOf(el)
  const protoValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set
  if (valueSetter && valueSetter !== protoValueSetter) {
    valueSetter.call(el, value)
  } else if (protoValueSetter) {
    protoValueSetter.call(el, value)
  } else {
    el.value = value
  }
  el.dispatchEvent(new Event("input", { bubbles: true }))
  el.dispatchEvent(new Event("change", { bubbles: true }))
}

function highlight(el: HTMLElement): void {
  const originalOutline = el.style.outline
  el.style.outline = "2px solid #22c55e"
  el.style.outlineOffset = "2px"
  setTimeout(() => {
    el.style.outline = originalOutline
    el.style.outlineOffset = ""
  }, 2000)
}

// ---------------------------------------------------------------------------
// Consent-first flow: propose, never write until the user taps Fill.
// ---------------------------------------------------------------------------

function proposeFields(resume: ResumeData): FieldCandidate[] {
  const values = getResumeValues(resume)
  const candidates: FieldCandidate[] = []
  const filledKeys = new Set<string>()

  for (const def of FIELD_DEFINITIONS) {
    const value = values[def.key]
    if (!value) continue
    for (const el of document.querySelectorAll<HTMLElement>("input, textarea")) {
      if (!isFillable(el)) continue
      if (matchField(el, def)) {
        candidates.push({ element: el, value, key: def.key })
        filledKeys.add(def.key)
        break // FIRST matching field per data key only
      }
    }
  }

  return candidates
}

function signatureOf(candidates: FieldCandidate[]): string {
  return JSON.stringify(candidates.map((c) => [c.key, c.value]))
}

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

const host = window.location.hostname

function storageGet(keys: string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => resolve(result as Record<string, unknown>))
  })
}

function storageSet(values: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set(values, () => resolve())
  })
}

interface ExtensionPrefs {
  resume?: ResumeData
  resumes?: Array<{ tag: string; resume: ResumeData }>
  autofillMode?: "ask" | "always"
  autofillModes?: Record<string, "ask" | "always">
  trackFills?: boolean
  appUrl?: string
  autofillLog?: FillLogEntry[]
}

async function activeResumeTag(prefs: ExtensionPrefs): Promise<string> {
  if (!prefs.resume || !Array.isArray(prefs.resumes)) return ""
  const match = prefs.resumes.find(
    (tr) => JSON.stringify(tr.resume) === JSON.stringify(prefs.resume)
  )
  return match?.tag ?? ""
}

async function getHostMode(prefs: ExtensionPrefs): Promise<"ask" | "always"> {
  if (prefs.autofillModes?.[host]) return prefs.autofillModes[host]
  return prefs.autofillMode === "always" ? "always" : "ask"
}

function logFill(entry: FillLogEntry): void {
  chrome.storage.local.get(["autofillLog"], (result) => {
    const log: FillLogEntry[] = Array.isArray(result.autofillLog)
      ? result.autofillLog
      : []
    log.unshift(entry)
    chrome.storage.local.set({ autofillLog: log.slice(0, 20) })
  })
}

async function maybeDeepLink(
  prefs: ExtensionPrefs,
  resumeTag: string,
  fieldCount: number
): Promise<void> {
  if (!prefs.trackFills || fieldCount === 0) return
  const appUrl = (prefs.appUrl ?? "http://localhost:5173").replace(/\/+$/, "")
  const params = new URLSearchParams({
    url: window.location.href,
    title: document.title
  })
  if (resumeTag) params.set("resumeTag", resumeTag)
  try {
    chrome.runtime.sendMessage({
      type: "OPEN_TRACKER",
      payload: `${appUrl}/applications?${params.toString()}`
    })
  } catch {
    /* background may be unavailable during reloads */
  }
}

let pendingCandidates: FieldCandidate[] = []
let panelHostShadow: ShadowRoot | null = null
let lastSkippedSignature = ""
let offeredSignature = ""

function closePanel(): void {
  const hostEl = document.getElementById("rb-autofill-host")
  if (hostEl) hostEl.remove()
  panelHostShadow = null
  pendingCandidates = []
}

function ensurePanelHost(): ShadowRoot | null {
  let hostEl = document.getElementById("rb-autofill-host")
  if (!hostEl) {
    hostEl = document.createElement("div")
    hostEl.id = "rb-autofill-host"
    hostEl.style.cssText =
      "all:initial;position:fixed;top:16px;right:16px;z-index:2147483647;"
    hostEl.attachShadow({ mode: "open" })
    document.documentElement.appendChild(hostEl)
  }
  panelHostShadow = hostEl.shadowRoot
  return panelHostShadow
}

const PANEL_STYLE = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
  .card {
    width: 340px; background: #ffffff; border: 1px solid #e2e8f0;
    border-radius: 12px; box-shadow: 0 10px 30px rgba(15,23,42,.18);
    overflow: hidden;
  }
  .head {
    padding: 10px 14px; background: #0f172a; color: #fff;
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
  }
  .head b { font-size: 13px; }
  .head .tag { font-size: 11px; color: #94a3b8; font-weight: 400; }
  .rows { max-height: 240px; overflow: auto; padding: 8px 12px; }
  .row {
    display: flex; gap: 8px; padding: 6px 0; border-bottom: 1px solid #f1f5f9;
    font-size: 12px;
  }
  .row:last-child { border-bottom: none; }
  .row .k { width: 90px; color: #64748b; font-weight: 600; flex-shrink: 0; }
  .row .v { color: #0f172a; word-break: break-word; }
  .foot { padding: 10px 12px; border-top: 1px solid #f1f5f9; display: flex; gap: 8px; }
  .btn {
    border: none; border-radius: 8px; padding: 8px 12px; cursor: pointer;
    font-size: 12px; font-weight: 600;
  }
  .btn-fill { background: #16a34a; color: #fff; flex: 1; }
  .btn-fill:hover { background: #15803d; }
  .btn-ghost { background: #f1f5f9; color: #334155; }
  .btn-ghost:hover { background: #e2e8f0; }
  .note { padding: 0 12px 10px; font-size: 10.5px; color: #94a3b8; }
  .banner {
    width: 260px; background: #ffffff; border: 1px solid #e2e8f0;
    border-radius: 12px; box-shadow: 0 10px 30px rgba(15,23,42,.18);
    overflow: hidden;
  }
  .banner .body { padding: 10px 12px; font-size: 12px; color: #0f172a; }
  .banner .body p { margin: 0 0 4px; font-weight: 600; }
  .banner .body span { color: #64748b; }
  .banner .foot { padding: 8px 12px; border-top: 1px solid #f1f5f9; display: flex; gap: 8px; }
`

function attachStyles(): void {
  const style = document.createElement("style")
  style.textContent = PANEL_STYLE
  panelHostShadow?.appendChild(style)
}

function showFullPreview(candidates: FieldCandidate[], resumeTag: string): void {
  closePanel()
  const shadow = ensurePanelHost()
  if (!shadow) return
  attachStyles()

  const card = document.createElement("div")
  card.className = "card"
  card.innerHTML = `
    <div class="head">
      <span><b>Resume Autofill</b><br><span class="tag">${escapeHtml(resumeTag || "Active resume")}</span></span>
      <span class="tag">detects ${candidates.length} field${candidates.length === 1 ? "" : "s"}</span>
    </div>
    <div class="rows">
      ${candidates
        .map(
          (c) =>
            `<div class="row"><span class="k">${escapeHtml(c.key)}</span><span class="v">${escapeHtml(c.value)}</span></div>`
        )
        .join("")}
    </div>
    <div class="note">Nothing is written until you tap Fill. The preview never leaves this page.</div>
    <div class="foot">
      <button class="btn btn-fill">Fill ${candidates.length} field${candidates.length === 1 ? "" : "s"}</button>
      <button class="btn btn-ghost btn-skip">Skip</button>
      <button class="btn btn-ghost btn-always">Always for this site</button>
    </div>
  `
  shadow.appendChild(card)

  card.querySelector(".btn-fill")?.addEventListener("click", () => {
    void performFill(candidates, resumeTag, "filled")
  })
  card.querySelector(".btn-skip")?.addEventListener("click", () => {
    lastSkippedSignature = signatureOf(candidates)
    logFill({
      host,
      url: window.location.href,
      title: document.title,
      filledAt: new Date().toISOString(),
      fieldCount: 0,
      resumeTag,
      status: "skipped"
    })
    closePanel()
  })
  card.querySelector(".btn-always")?.addEventListener("click", async () => {
    const prefs = (await storageGet(["autofillModes"])) as Partial<ExtensionPrefs>
    const modes = prefs.autofillModes ?? {}
    modes[host] = "always"
    await storageSet({ autofillModes: modes })
    void performFill(candidates, resumeTag, "filled")
  })
}

function showSlimBanner(candidates: FieldCandidate[], resumeTag: string): void {
  closePanel()
  const shadow = ensurePanelHost()
  if (!shadow) return
  attachStyles()

  const banner = document.createElement("div")
  banner.className = "banner"
  banner.innerHTML = `
    <div class="body">
      <p>Resume autofill</p>
      <span>Will fill ${candidates.length} field${candidates.length === 1 ? "" : "s"} on ${escapeHtml(host)}</span>
    </div>
    <div class="foot">
      <button class="btn btn-fill">Fill</button>
      <button class="btn btn-ghost btn-now">Not now</button>
    </div>
  `
  shadow.appendChild(banner)
  banner.querySelector(".btn-fill")?.addEventListener("click", () => {
    void performFill(candidates, resumeTag, "filled")
  })
  banner.querySelector(".btn-now")?.addEventListener("click", () => {
    logFill({
      host,
      url: window.location.href,
      title: document.title,
      filledAt: new Date().toISOString(),
      fieldCount: 0,
      resumeTag,
      status: "skipped"
    })
    closePanel()
  })
}

async function performFill(
  candidates: FieldCandidate[],
  resumeTag: string,
  status: "filled" | "skipped"
): Promise<void> {
  let count = 0
  for (const candidate of candidates) {
    setNativeValue(candidate.element, candidate.value)
    highlight(candidate.element)
    count++
  }
  logFill({
    host,
    url: window.location.href,
    title: document.title,
    filledAt: new Date().toISOString(),
    fieldCount: count,
    resumeTag,
    status
  })
  const prefs = (await storageGet(["trackFills", "appUrl"])) as Partial<ExtensionPrefs>
  await maybeDeepLink(
    prefs,
    resumeTag,
    count
  )
  closePanel()
  console.info(`[Resume Autofill] Consent-first fill applied: ${count} field(s).`)
}

async function offerPreview(): Promise<void> {
  const prefs = (await storageGet([
    "resume",
    "resumes",
    "autofillMode",
    "autofillModes",
    "trackFills",
    "appUrl"
  ])) as ExtensionPrefs
  const { resume } = prefs
  if (!resume) return
  if (document.getElementById("rb-autofill-host")) return // a panel is visible

  const candidates = proposeFields(resume)
  if (candidates.length === 0) return

  const sig = signatureOf(candidates)
  const tag = await activeResumeTag(prefs)
  const mode = await getHostMode(prefs)

  if (mode === "ask") {
    if (sig === lastSkippedSignature) return
    showFullPreview(candidates, tag)
  } else {
    if (sig === offeredSignature) return // once per page load per signature
    offeredSignature = sig
    showSlimBanner(candidates, tag)
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "FILL_RESUME") {
    void offerPreview()
  }
})

// MutationObserver for delayed/SPA forms — offer, never autowrite.
let debounceTimer: number | undefined
const observer = new MutationObserver(() => {
  if (debounceTimer) return
  debounceTimer = window.setTimeout(() => {
    debounceTimer = undefined
    void offerPreview()
  }, 2000)
})

function startObserver(): void {
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true })
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startObserver)
} else {
  startObserver()
}

export {}