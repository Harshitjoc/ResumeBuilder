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

function fillForm(resume: ResumeData): number {
  const values = getResumeValues(resume)
  const filledKeys = new Set<string>()
  const candidates: FieldCandidate[] = []

  for (const def of FIELD_DEFINITIONS) {
    const value = values[def.key]
    if (!value) continue
    for (const el of document.querySelectorAll<HTMLElement>(
      "input, textarea"
    )) {
      if (!isFillable(el)) continue
      if (matchField(el, def)) {
        candidates.push({ element: el, value, key: def.key })
        break // FIRST matching field per data key only
      }
    }
  }

  let count = 0
  for (const candidate of candidates) {
    if (filledKeys.has(candidate.key)) continue
    setNativeValue(candidate.element, candidate.value)
    highlight(candidate.element)
    filledKeys.add(candidate.key)
    count++
  }

  return count
}

function tryFill(): void {
  chrome.storage.local.get(["resume"], (result) => {
    const resume = result.resume as ResumeData | undefined
    if (!resume) {
      console.warn(
        "[Resume Autofill] No resume stored. Import one from the extension popup first."
      )
      return
    }
    console.log(`[Resume Autofill] Filled ${fillForm(resume)} field(s).`)
  })
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "FILL_RESUME") {
    tryFill()
  }
})

// MutationObserver for delayed/SPA forms — re-scan after the DOM settles.
let debounceTimer: number | undefined
const observer = new MutationObserver(() => {
  if (debounceTimer) return
  debounceTimer = window.setTimeout(() => {
    debounceTimer = undefined
    chrome.storage.local.get(["resume"], (result) => {
      if (!result.resume) return
      fillForm(result.resume as ResumeData)
    })
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
