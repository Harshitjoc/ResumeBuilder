# Resume Autofill (Chrome Extension)

Phase 5 browser extension for the AI Resume Builder. It imports the resume you
build in the web app and auto-fills common job-application form fields on job
boards (LinkedIn and Indeed, plus a manual trigger on any tab).

## How to load the unpacked extension

1. Run a production build (from this directory):

   ```bash
   npm install
   npm run build
   ```

2. Open `chrome://extensions` in Chrome.
3. Toggle **Developer mode** (top-right).
4. Click **Load unpacked**.
5. Select the folder `extension/build/chrome-mv3-prod` (Chrome Manifest V3).
   - During development you can use `npm run dev` and load
     `extension/build/chrome-mv3-dev` instead.

## How to import a resume

1. Open the extension popup (click the puzzle icon, then Resume Autofill).
2. Export your resume from the builder web app as JSON (its `ResumeData` shape:
   `contact`, `professionalSummary`, `skills`, `experience`, `education`,
   `projects`, `certifications`).
3. Paste the JSON into the textarea in the popup.
4. Click **Load resume**.

The popup validates the JSON against the expected shape and shows a clear error
if it doesn't match. On success it shows **Resume loaded: \<name\> · \<n\> skills**
and stores the resume in `chrome.storage.local` under the key `resume`.

## How to fill a form

Open a supported job board page, then click **Fill current job form** in the
popup. The content script writes matching values into the page and flashes a
green outline around each filled field for 2 seconds.

### Field discovery & mapping

The content script discovers fields by scanning `input` and `textarea` elements
and reading their `name`, `id`, `aria-label`, `placeholder`, and any linked
`<label>` text. Matching is a case-insensitive substring match against these
curated keys:

- **full name** — `fullName` from the resume
- **first name** — first token of `fullName`
- **last name** — remaining tokens of `fullName`
- **email** — `contact.email`
- **phone** — `contact.phone`
- **location/city** — best-effort (no location field in the base resume shape)
- **linkedin url** — `contact.linkedin` or `contact.website`
- **education/school** — first entry of `education[].school`

Only the **first** matching field per data key is filled, to avoid multi-page
confusion (e.g. repeated work-history rows are left alone; only the current row
is prefilled).

### Technical notes

- A `MutationObserver` watches the DOM so delayed/SPA-rendered forms are
  re-scanned and filled once they appear.
- Values are written with the native input setter and then `input`/`change`
  events are dispatched (bubbling) so React/Vue/other frameworks register the
  change.
- Hidden, submit, button, file, checkbox, and search-bar inputs are skipped.
- Supported by default on `https://www.linkedin.com/*` and
  `https://*.indeed.com/*`; the popup's "Fill current job form" button works on
  any tab, but a content script must be injected there first (MVP targets the
  two job boards).

## Limitations

- You must paste the resume JSON manually (MVP). The extension cannot read the
  builder web app's `localStorage` because origins differ.
- Field mapping is substring-based and best-effort — not every site will have
  every field matched.
- Apollo/Location fields aren't in the base resume shape, so city/location is a
  no-op until such a field exists.
