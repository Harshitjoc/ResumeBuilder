# Resume Builder & Optimizer Platform
## Complete Product Specification & AI Prompts

---

## EXECUTIVE SUMMARY

A comprehensive resume management platform that:
1. **Builds resumes from scratch** for new users via guided onboarding
2. **Learns existing resume formats** from uploaded documents
3. **Optimizes resumes** for specific job descriptions with user verification
4. **Auto-fills applications** with customized resume data
5. **Maintains authenticity** by preventing false claims and role misalignment

**Target User:** Job seekers (Entry to Senior level) looking for intelligent, error-free job applications

---

## PART 1: PRODUCT ARCHITECTURE

### 1.1 Tech Stack Recommendations

**Frontend:**
- React/Vue.js (responsive, mobile-friendly)
- Rich text editor (Draft.js or similar for resume editing)
- PDF renderer (for resume preview)

**Backend:**
- Node.js/Python FastAPI (for resume processing)
- PostgreSQL (user data, resume versions)
- Redis (caching parsed job descriptions)
- Claude API (resume generation, job analysis, customization)

**Extensions:**
- Chrome/Firefox extension for browser-based job board integration
- Context menus for quick copy-paste

**Storage:**
- Cloud storage (AWS S3/GCP Cloud Storage) for resume PDFs and versions

---

### 1.2 Core Data Models

```
USER
├── id (UUID)
├── email
├── profile_name
├── experience_level (entry/mid/senior/lead)
├── primary_role (Software Engineer, PM, etc.)
├── tech_stack (array)
├── target_companies (array)
├── created_at
└── updated_at

RESUME (base/master copy)
├── id (UUID)
├── user_id
├── template_format (classic/modern/minimalist/ats-optimized)
├── format_metadata (fonts, spacing, colors, sections)
├── sections:
│   ├── contact_info
│   ├── professional_summary
│   ├── work_experience (array)
│   ├── education (array)
│   ├── skills (array)
│   ├── projects (array)
│   ├── certifications (array)
│   └── custom_sections (array)
├── version_number
├── created_at
└── updated_at

RESUME_VERSION (customized versions)
├── id (UUID)
├── base_resume_id
├── job_posting_id (reference)
├── customized_sections (delta from base)
├── customization_rationale (what changed and why)
├── user_approved (boolean)
├── used_for_application (boolean)
├── application_date
├── application_status
└── created_at

JOB_POSTING
├── id (UUID)
├── user_id
├── raw_text (pasted job description)
├── parsed_data:
│   ├── job_title
│   ├── company_name
│   ├── required_skills (array)
│   ├── preferred_skills (array)
│   ├── experience_years
│   ├── role_type (full-stack, backend, frontend, etc.)
│   ├── industry
│   ├── seniority_level
│   └── key_responsibilities (array)
├── relevance_score (0-100)
├── compatibility_flag (true/false - matches user's core expertise?)
├── created_at
└── updated_at

VERIFICATION_QUEUE
├── id (UUID)
├── resume_version_id
├── change_type (section_modified/skills_reordered/summary_rewritten)
├── original_content
├── proposed_content
├── reason_for_change
├── user_action (approved/rejected/edited)
├── action_timestamp
└── notes
```

---

## PART 2: USER FLOWS

### 2.1 New User Flow (Resume Creation from Scratch)

```
1. SIGN UP & ONBOARDING
   ├─ Email/OAuth login
   ├─ Basic profile questions:
   │  ├─ Full name
   │  ├─ Email
   │  ├─ Phone
   │  ├─ Current job title
   │  ├─ Experience level (0-2 / 2-5 / 5-10 / 10+ years)
   │  └─ Primary specialization
   └─ Redirect to resume template selection

2. TEMPLATE SELECTION
   ├─ Show 4-5 resume templates
   │  ├─ Classic (traditional, ATS-friendly)
   │  ├─ Modern (design-forward, tech-heavy)
   │  ├─ Minimalist (clean, concise)
   │  ├─ ATS-Optimized (plain text, no formatting)
   │  └─ Customizable (user can modify)
   └─ User selects one

3. DETAILED QUESTIONNAIRE (AI-guided)
   ├─ Work Experience Section:
   │  ├─ "How many jobs have you had?"
   │  ├─ For each job:
   │  │  ├─ Company name
   │  │  ├─ Job title
   │  │  ├─ Employment dates
   │  │  ├─ "What did you accomplish here?" (3-5 bullet points)
   │  │  ├─ Technologies used
   │  │  └─ Team size / scope (if relevant)
   │  └─ AI rephrases bullets for impact
   │
   ├─ Education Section:
   │  ├─ Degree
   │  ├─ School
   │  ├─ Graduation date
   │  ├─ Honors/GPA (optional)
   │  └─ Relevant coursework (optional)
   │
   ├─ Skills Section:
   │  ├─ Languages (Python, Java, JavaScript, etc.)
   │  ├─ Frameworks (React, Django, Spring, etc.)
   │  ├─ Tools/Platforms (AWS, Docker, Git, etc.)
   │  ├─ Soft skills (Leadership, Communication, etc.)
   │  └─ AI suggests based on experience
   │
   ├─ Projects Section (optional):
   │  ├─ For each project:
   │  │  ├─ Project name
   │  │  ├─ Description
   │  │  ├─ Link (GitHub, live demo)
   │  │  ├─ Technologies
   │  │  └─ Your role & impact
   │  └─ AI formats for impact
   │
   ├─ Certifications (optional):
   │  ├─ Certification name
   │  ├─ Issuing body
   │  ├─ Date obtained
   │  └─ Credential link (optional)
   │
   ├─ Professional Summary:
   │  ├─ "Tell us about your career in 2-3 sentences"
   │  └─ AI generates 3 versions, user picks one
   │
   └─ Review & Generate

4. RESUME GENERATION & PREVIEW
   ├─ AI structures all data into resume format
   ├─ User previews in chosen template
   ├─ User can:
   │  ├─ Edit any section inline
   │  ├─ Reorder sections
   │  ├─ Adjust formatting
   │  └─ Download as PDF / Word
   └─ Save as master resume

5. MASTER RESUME STORED
   └─ Ready for job-specific customization
```

---

### 2.2 Existing User Flow (Upload Resume)

```
1. UPLOAD EXISTING RESUME
   ├─ User uploads PDF/Word resume
   ├─ System extracts:
   │  ├─ Text content
   │  ├─ Format metadata (fonts, spacing, sections)
   │  ├─ Structure (sections present, order)
   │  └─ Style (ATS-friendly, modern, etc.)
   └─ AI parses into structured data

2. FORMAT LEARNING
   ├─ AI analyzes format:
   │  ├─ Section order
   │  ├─ Font, size, colors
   │  ├─ Spacing & margins
   │  ├─ Bullet point style
   │  └─ Any custom sections
   └─ Stores format template for future versions

3. DATA VERIFICATION
   ├─ System presents parsed data to user:
   │  ├─ "We found these work experiences..."
   │  ├─ "These are your skills..."
   │  ├─ "Is this correct?"
   │  └─ User edits/confirms
   └─ Stores clean structured data

4. READY FOR CUSTOMIZATION
   └─ Master resume loaded, ready for job posting
```

---

### 2.3 Job Optimization Flow (Core Feature)

```
1. JOB POSTING INPUT
   ├─ User pastes job description
   ├─ OR user provides job link
   └─ System extracts and parses

2. JOB ANALYSIS
   ├─ AI extracts:
   │  ├─ Required skills
   │  ├─ Preferred skills
   │  ├─ Years of experience needed
   │  ├─ Key responsibilities
   │  ├─ Tech stack
   │  ├─ Role type (Frontend/Backend/Full-stack/etc.)
   │  ├─ Seniority level
   │  └─ Industry/domain
   └─ Stores in JOB_POSTING table

3. COMPATIBILITY CHECK
   ├─ AI compares job to user's master resume:
   │  ├─ "Is this in your core expertise?"
   │  ├─ "Do you have 80%+ of required skills?"
   │  ├─ "Is the seniority level appropriate?"
   │  └─ Generates compatibility_score (0-100)
   │
   ├─ If compatibility < 60%:
   │  ├─ Show user: "This role seems outside your core expertise"
   │  ├─ Offer to proceed anyway with warning
   │  └─ Flag in verification queue
   │
   └─ If compatibility >= 60%:
       └─ Proceed to customization

4. RESUME CUSTOMIZATION LOGIC
   ├─ AI analyzes delta (gap between resume and job):
   │  ├─ Skills to highlight (already in resume, match job)
   │  ├─ Skills to downplay (less relevant to job)
   │  ├─ Experience to emphasize (relevant projects/roles)
   │  ├─ Achievements to reorder (job-relevant ones first)
   │  ├─ Keywords to include (from job posting)
   │  └─ Sections to reorder (if needed)
   │
   ├─ Creates customized version:
   │  ├─ Reorders bullet points by relevance
   │  ├─ Rephrases bullets to match job language
   │  ├─ Highlights matching skills
   │  ├─ Removes/minimizes unrelated details
   │  ├─ Adds keywords (if naturally fitting)
   │  └─ NEVER invents new experiences
   │
   └─ Stores all changes for user review

5. VERIFICATION & APPROVAL
   ├─ System presents side-by-side comparison:
   │  ├─ Original section vs. Customized section
   │  ├─ Highlights what changed
   │  ├─ Explains why (e.g., "Reordered to match job priorities")
   │  └─ Shows compatibility reasoning
   │
   ├─ User reviews each change:
   │  ├─ ✓ Approve change
   │  ├─ ✗ Reject change (keep original)
   │  ├─ ✏️ Edit manually
   │  └─ ? Ask AI to explain
   │
   ├─ User can toggle sections:
   │  ├─ Include/exclude entire sections
   │  ├─ Reorder sections manually
   │  └─ Add custom sections (cover letter, etc.)
   │
   └─ Final review before download

6. DOWNLOAD & APPLY
   ├─ Generate final resume in:
   │  ├─ PDF (maintains formatting)
   │  ├─ Word (.docx)
   │  ├─ Plain text (for ATS)
   │  └─ Google Docs (for sharing)
   │
   ├─ Extension integration:
   │  ├─ Auto-fill application forms
   │  ├─ Copy customized resume to clipboard
   │  └─ Track which version was used
   │
   └─ Mark as "applied" and store application record
```

---

## PART 3: VERIFICATION GATES & SAFETY CHECKS

### 3.1 Validation Rules (NEVER Bypass)

```
RULE 1: NO INVENTED EXPERIENCES
├─ Any work experience, project, or achievement must exist in master resume
├─ AI can rephrase, reorder, emphasize — but NOT fabricate
├─ System flags attempted additions for user review

RULE 2: NO FALSE SKILLS
├─ Skills must match master resume or user explicitly confirms
├─ Example: Don't add "Kubernetes" if not in original resume
├─ User must manually approve new skills

RULE 3: NO DATE MODIFICATIONS
├─ Employment dates, graduation dates must be accurate
├─ Cannot stretch timeline to meet "5 years experience" requirement
├─ System blocks date changes

RULE 4: NO DEGREE INFLATION
├─ Cannot change Bachelor's to Master's
├─ Cannot change "relevant coursework" to "concentration"
├─ System prevents education-level changes

RULE 5: COMPATIBILITY GATING
├─ If job requires "Senior" but user is "Mid-level":
│  ├─ Flag for user attention
│  ├─ Proceed only with explicit user approval
│  └─ Add note: "Applying above your level"
│
├─ If job is completely outside core expertise:
│  ├─ Show warning: "You've customized this heavily. Proceed?"
│  └─ Require manual confirmation

RULE 6: KEYWORD INJECTION LIMITS
├─ Don't force keywords that don't naturally fit
├─ Example: Don't add "machine learning" to a frontend engineer's resume
├─ Only inject keywords that logically relate to their actual skills

RULE 7: METRIC ACCURACY
├─ Don't modify existing metrics/numbers
├─ "Increased revenue by 30%" cannot become "50%" to match job description
├─ User must manually update if numbers change
```

### 3.2 Verification Queue

Every customized version goes through approval before download:

```
CHANGE TYPES REQUIRING APPROVAL:

1. Section reordering
   └─ "Moved 'Projects' above 'Education' to highlight relevant work"

2. Bullet point reordering
   └─ "Reordered bullets to emphasize job-relevant achievements"

3. Bullet point rephrasing
   └─ Original: "Built e-commerce platform"
      Customized: "Architected scalable e-commerce platform handling 10k+ daily transactions"
      Reason: "Emphasized scalability to match job's scale focus"

4. Skill reordering
   └─ "Moved Python to top 3 based on job's primary language requirement"

5. New skills added (user approval required)
   └─ Cannot add without explicit user confirmation

6. Section inclusion/exclusion
   └─ "Removed 'Projects' section to keep resume to 1 page"

7. Low compatibility warning
   └─ "Your experience is 55% aligned with this role. Proceed anyway?"

8. Major keyword additions
   └─ "Added 'microservices' to achievements (appeared 5 times in job posting)"
```

---

## PART 4: FEATURE SPECIFICATIONS

### 4.1 Resume Templates

#### Template 1: Classic (ATS-Optimized)
```
Structure:
├─ CONTACT INFORMATION
│  └─ Name | Email | Phone | LinkedIn | GitHub
├─ PROFESSIONAL SUMMARY (3-4 lines)
├─ TECHNICAL SKILLS
│  ├─ Languages: ...
│  ├─ Frameworks: ...
│  └─ Tools: ...
├─ WORK EXPERIENCE
│  ├─ Job Title | Company | Dates
│  └─ Bullet points (achievements)
├─ EDUCATION
│  └─ Degree | School | Date
├─ PROJECTS (optional)
│  └─ Project name | description | link
└─ CERTIFICATIONS (optional)

Style:
├─ Font: Arial or Calibri
├─ Size: 10-12pt
├─ Color: Black text, blue links only
├─ No graphics, logos, or tables
├─ Spacing: Standard margins
└─ Goal: 100% ATS-compatible
```

#### Template 2: Modern
```
Structure:
├─ HEADER (with color accent)
│  ├─ Name (large, bold)
│  └─ Tagline / Title
├─ QUICK CONTACT
│  └─ Email | Phone | LinkedIn | GitHub | Website
├─ PROFESSIONAL SUMMARY
│  └─ Paragraph or bullet list
├─ KEY SKILLS
│  └─ Skills grouped by category
├─ EXPERIENCE
│  ├─ Job Title | Company | Dates
│  └─ Impact-focused bullets
├─ PROJECTS
│  ├─ Project with thumbnail
│  └─ Description + link
├─ EDUCATION
└─ ADDITIONAL
   └─ Certifications, publications, etc.

Style:
├─ Font: Modern sans-serif (Helvetica, Open Sans)
├─ Color: 1-2 accent colors
├─ Icons: For section headers
├─ Layout: 2-column or card-based
├─ Goal: Visually engaging, still readable
```

#### Template 3: Minimalist
```
Structure:
├─ NAME
├─ Email | Phone | LinkedIn | GitHub
├─ ABOUT
│  └─ 2-3 lines
├─ SKILLS
│  └─ Comma-separated, grouped
├─ EXPERIENCE
│  ├─ Title | Company | Dates
│  └─ Bullets
├─ EDUCATION
└─ PROJECTS (optional)

Style:
├─ Font: Simple serif (Times) or sans-serif
├─ Size: Consistent, minimal variation
├─ Color: Single color (black, dark gray)
├─ Spacing: Generous whitespace
└─ Goal: Maximum clarity, minimal distraction
```

#### Template 4: Customizable
```
Structure:
└─ User selects from available components:
   ├─ Section order (drag & drop)
   ├─ Font family (4-5 choices)
   ├─ Color scheme (5-6 presets)
   ├─ Spacing (compact / normal / spacious)
   ├─ Icon usage (yes/no)
   └─ Section visibility (show/hide each section)

Live preview:
└─ As user changes settings, preview updates in real-time
```

---

### 4.2 Chrome Extension Features

```
FEATURE 1: Resume Auto-Fill on Job Applications
├─ Detect job posting page (LinkedIn, Indeed, Glassdoor, etc.)
├─ Extract job title, company, link
├─ Show notification: "Want to auto-fill this application with your optimized resume?"
├─ User clicks → Extension opens side panel
├─ Side panel shows:
│  ├─ "Create new customization for this job?"
│  ├─ OR "Use existing customization?"
│  └─ One-click fill (if approved)

FEATURE 2: Quick Job Analysis
├─ Right-click on job description
├─ Select "Analyze with Resume Builder"
├─ Opens side panel with:
│  ├─ AI analysis of job
│  ├─ Compatibility score
│  ├─ Customization suggestion
│  └─ "Start customization" button

FEATURE 3: One-Click Resume Download
├─ After customization approval
├─ "Download as PDF" button in extension
├─ Saves to Downloads folder
├─ Can auto-fill application form if field detected

FEATURE 4: Resume Version History
├─ Sidebar showing:
│  ├─ Master resume (base version)
│  ├─ Recent customizations (linked to jobs)
│  ├─ Applied versions (with application date)
│  └─ Reuse button (apply same customization to similar job)
```

---

## PART 5: AI PROMPTS FOR EACH FEATURE

### PROMPT 1: Resume Building from Scratch (Initial Summary Generation)

```
SYSTEM PROMPT:
You are an expert resume writer and career coach. Your job is to transform a 
user's raw career information into a compelling, achievement-focused resume 
that gets past both ATS systems and human recruiters.

GUIDELINES:
- Focus on impact and quantifiable achievements
- Use action verbs (Built, Designed, Optimized, Scaled, etc.)
- Translate technical jargon into business impact
- Highlight leadership and growth (especially for mid+ level)
- Keep language concise and professional
- No buzzwords without substance
- Maintain honesty - rephrase existing achievements, don't invent new ones

USER INFORMATION:
{user_data_in_json}

Example transformation:
Raw: "I worked on a website project"
Professional: "Architected and deployed responsive web application serving 50k+ monthly users, improving page load time by 40%"

Now, help me create a professional summary (3-4 sentences) for this candidate:
- Focus on unique value proposition
- Highlight years of experience and key specializations
- Mention 2-3 standout achievements
- Keep it compelling but not overselling

Output as: Plain text, suitable for resume top section.
```

---

### PROMPT 2: Work Experience Bullet Point Enhancement

```
SYSTEM PROMPT:
You are a resume optimization expert. Transform vague job descriptions into 
impact-driven bullet points that showcase achievement and business value.

RULES:
1. Start with action verb (Built, Designed, Optimized, Led, etc.)
2. Include specifics: metrics, scale, or impact if available
3. Translate technical work into business impact
4. Keep to one line (resume-ready)
5. Be truthful - enhance, don't invent

For each bullet point the user provides, generate 2-3 stronger alternatives.

Example:
Input: "Fixed bugs in the backend system"
Output Option 1: "Debugged and optimized backend API, reducing latency by 35% and improving system reliability"
Output Option 2: "Resolved critical backend system issues affecting 10k+ daily users, improving uptime to 99.8%"

User's raw bullets from job: {job_bullets}

Generate enhanced versions for each bullet point above.
```

---

### PROMPT 3: Job Description Parsing & Analysis

```
SYSTEM PROMPT:
You are an expert recruiter and job market analyst. Parse job descriptions 
to extract key requirements, culture signals, and priorities.

EXTRACT THE FOLLOWING:

1. JOB METADATA
   - Job title (exact from posting)
   - Company name
   - Seniority level (entry/mid/senior/lead)
   - Role type (e.g., Full-Stack Engineer, Backend, Frontend, DevOps)
   
2. REQUIRED SKILLS
   - Technical skills (extract programming languages, frameworks, tools)
   - Soft skills (communication, leadership, etc.)
   - Domain knowledge (fintech, healthcare, etc.)
   
3. PREFERRED SKILLS
   - Nice-to-have technologies
   - Experience areas that differentiate candidates
   
4. EXPERIENCE REQUIREMENTS
   - Minimum years of experience
   - Specific domain experience needed
   - Industry experience preferred
   
5. KEY RESPONSIBILITIES
   - Top 3-5 primary duties
   - Team interactions (who they'll work with)
   - Scope of impact (users, revenue, etc.)
   
6. CULTURE & VALUES (if mentioned)
   - Company culture signals
   - Team dynamics
   
7. RED FLAGS (if any)
   - Unrealistic expectations
   - Signs of dysfunction
   
JOB POSTING TEXT:
{job_posting_text}

Output as JSON:
{
  "job_title": "...",
  "company": "...",
  "seniority_level": "...",
  "role_type": "...",
  "required_skills": [...],
  "preferred_skills": [...],
  "experience_years": X,
  "key_responsibilities": [...],
  "culture_signals": "...",
  "red_flags": [...]
}
```

---

### PROMPT 4: Resume-to-Job Compatibility Analysis

```
SYSTEM PROMPT:
You are a career advisor evaluating fit between a candidate's resume and 
a specific job posting. Assess compatibility without overselling or underselling.

ANALYZE COMPATIBILITY:

1. SKILL MATCH
   - Which required skills does candidate have?
   - Which are missing?
   - Which nice-to-haves does candidate have?
   - Calculate skill match percentage: (matching skills / required skills) * 100
   
2. EXPERIENCE LEVEL ALIGNMENT
   - Is candidate's seniority appropriate for the role?
   - Any overqualification or underqualification concerns?
   
3. ROLE TYPE FIT
   - Does candidate's specialty match the role?
   - Example: If job is "Backend Engineer" and candidate is "Full-Stack", 
     how well does their backend experience fit?
   
4. INDUSTRY/DOMAIN FIT
   - Has candidate worked in this industry?
   - Can they transfer skills from adjacent industries?
   
5. DEAL BREAKERS
   - Are there any hard requirements candidate doesn't meet?
   - Can they be addressed in customization, or is this a non-starter?

CANDIDATE RESUME:
{resume_data_in_json}

TARGET JOB:
{parsed_job_data_in_json}

Provide output as:
{
  "skill_match_percentage": X,
  "skill_gaps": ["skill1", "skill2"],
  "skill_strengths": ["skill1", "skill2"],
  "seniority_alignment": "appropriate/overqualified/underqualified",
  "role_type_fit": "strong/moderate/weak",
  "industry_fit": "strong/moderate/none",
  "deal_breakers": [...],
  "overall_compatibility_score": (0-100),
  "recommendation": "Strong fit / Moderate fit / Stretch / Not recommended",
  "reasoning": "..."
}

If compatibility_score < 60, also include:
{
  "concerns": ["..."],
  "warning": "This role is outside your core expertise. Consider carefully."
}
```

---

### PROMPT 5: Intelligent Resume Customization

```
SYSTEM PROMPT:
You are an expert resume optimizer. Your job is to customize a resume for 
a specific job posting while maintaining absolute authenticity.

CUSTOMIZATION RULES (NON-NEGOTIABLE):
1. NEVER invent work experience, projects, or skills not in the master resume
2. NEVER change dates or degree levels
3. NEVER add false metrics or achievements
4. DO reorder bullets by job relevance
5. DO rephrase bullets to use job-specific language
6. DO highlight matching skills
7. DO suggest keyword additions only if they naturally fit
8. DO flag concerns about alignment for human review

CUSTOMIZATION STRATEGY:

Phase 1: ANALYZE DELTA
- What skills does the job require that the candidate has?
- What responsibilities align with candidate's experience?
- What should be emphasized vs. de-emphasized?

Phase 2: REORDER & REPHRASE
- Move most relevant bullets to top of each section
- Rephrase bullets to match job language (where truthful)
- Example rewrite:
  Original: "Built distributed system for data processing"
  For job emphasizing: "Designed scalable microservices architecture for real-time data pipeline processing 1M+ events/day"
  (Only if this matches their actual experience)

Phase 3: SECTION OPTIMIZATION
- Suggest which sections to include/exclude for 1-page limit
- If 2+ pages, recommend what to cut
- Reorder sections by relevance

Phase 4: KEYWORD INJECTION
- Identify 5-10 high-value keywords from job posting
- Suggest where they naturally fit in resume
- ONLY if they match candidate's actual experience

CANDIDATE RESUME:
{resume_data_in_json}

TARGET JOB:
{parsed_job_data_in_json}

Provide output as:
{
  "customizations": [
    {
      "section": "work_experience",
      "entry_index": 0,
      "change_type": "bullet_reorder_and_rephrase",
      "original_bullets": ["...", "..."],
      "customized_bullets": ["...", "..."],
      "reason": "Reordered and rephrased to emphasize [job requirement]",
      "severity": "low/medium/high"
    },
    {
      "section": "skills",
      "change_type": "reorder",
      "original_order": ["Python", "JavaScript", "Java"],
      "new_order": ["Python", "Java", "JavaScript"],
      "reason": "Job emphasizes Java heavily; moved to position 2",
      "severity": "low"
    }
  ],
  "section_recommendations": {
    "include": ["work_experience", "skills", "projects"],
    "exclude": ["certifications"],
    "reason": "Keep resume to 1 page by removing less relevant certifications"
  },
  "keyword_suggestions": [
    {
      "keyword": "microservices",
      "where": "work_experience, bullet 2",
      "why": "Appears 4x in job posting and matches candidate's architecture work"
    }
  ],
  "compatibility_concerns": [],
  "overall_assessment": "This customization maintains authenticity while highlighting relevant experience"
}
```

---

### PROMPT 6: Verification Queue Explanation

```
SYSTEM PROMPT:
You are a resume editor explaining changes to a candidate. For each change 
in the verification queue, explain why it matters and what it means.

For each proposed change, generate a user-friendly explanation:

CHANGE DETAILS:
{change_data_in_json}

Example output:
{
  "change_summary": "Reordered bullets in 'Senior Engineer' role",
  "what_changed": [
    "Moved 'Led backend redesign serving 2M users' to position 1 (from position 3)"
  ],
  "why_it_matters": "This achievement directly matches the job's requirement for 'experience with large-scale backend systems.' By putting it first, we make the match immediately obvious to the hiring manager.",
  "impact": "Better chance of passing initial screening",
  "user_options": {
    "approve": "Yes, this improves relevance",
    "reject": "No, use original order",
    "edit": "Let me edit this manually"
  }
}
```

---

### PROMPT 7: Professional Summary Generation

```
SYSTEM PROMPT:
Create a compelling professional summary that positions the candidate for 
their target roles. The summary should be 3-4 lines, achievement-focused, 
and adaptable to multiple job types within their domain.

CANDIDATE INFO:
- Experience level: {level}
- Primary role: {role}
- Key achievements: {achievements}
- Specializations: {specializations}
- Target roles: {target_roles}

Generate 3 variations of a professional summary:

VARIATION 1 (Achievement-focused): 
Starts with quantified impact, highlights scale and specialization

VARIATION 2 (Problem-solving focused):
Emphasizes solving complex technical problems and driving innovation

VARIATION 3 (Leadership-focused - if applicable):
Highlights team leadership, mentorship, and strategic impact

For each variation, include:
- The summary text (3-4 lines)
- Best use case (which job types)
- Tone (confident, measured, authoritative)
```

---

## PART 6: WORKFLOW DIAGRAMS

### User Flow Diagram

```
                           ┌─────────────┐
                           │   NEW USER  │
                           └──────┬──────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    v                           v
         ┌──────────────────┐        ┌──────────────────┐
         │ Resume from      │        │ Upload Existing  │
         │ Scratch          │        │ Resume           │
         └────────┬─────────┘        └────────┬─────────┘
                  │                           │
         ┌────────v─────────┐        ┌────────v─────────┐
         │ Template Select  │        │ Format Learning  │
         └────────┬─────────┘        │ & Parsing        │
                  │                  └────────┬─────────┘
         ┌────────v─────────┐                │
         │ Guided Q&A       │        ┌────────v─────────┐
         │ (All sections)   │        │ Data Verification│
         └────────┬─────────┘        └────────┬─────────┘
                  │                           │
         ┌────────v─────────┐                │
         │ AI Generation    │<───────┬────────┘
         └────────┬─────────┘        │
                  │         ┌────────v─────────┐
                  └────────>│ MASTER RESUME    │
                            │ (Stored)         │
                            └────────┬─────────┘
                                     │
                          ┌──────────v──────────┐
                          │ Ready for Job       │
                          │ Customization       │
                          └──────────┬──────────┘
                                     │
              ┌──────────────────────┘
              │
              v
    ┌─────────────────────┐
    │ USER PASTES JOB     │
    │ DESCRIPTION         │
    └──────────┬──────────┘
               │
    ┌──────────v──────────┐
    │ Job Parsing         │
    │ & Analysis          │
    └──────────┬──────────┘
               │
    ┌──────────v──────────┐
    │ Compatibility Check │
    │ (GATE)              │
    └──────────┬──────────┘
               │
         ┌─────┴─────┐
         │ YES | NO  │
         v           v
     ┌─────┐      ┌────────┐
     │CONT │      │WARNING │
     └──┬──┘      └───┬────┘
        │             │
   ┌────v─────────────v───┐
   │ Resume Customization │
   └────┬────────────────┘
        │
   ┌────v─────────────────────┐
   │ Verification Queue       │
   │ (Side-by-side review)    │
   └────┬──────────────────────┘
        │
   ┌────v──────────────┐
   │ User Approves All │
   │ Changes           │
   └────┬──────────────┘
        │
   ┌────v──────────────────┐
   │ Generate Final Resume │
   │ (PDF/Word/Text)       │
   └────┬──────────────────┘
        │
   ┌────v──────────────────┐
   │ Download & Apply      │
   │ (Track application)   │
   └───────────────────────┘
```

---

## PART 7: IMPLEMENTATION CHECKLIST

### Phase 1: MVP (4-6 weeks)
- [ ] User authentication (email + OAuth)
- [ ] Single resume template (Classic/ATS)
- [ ] Resume building questionnaire (work, education, skills)
- [ ] AI resume generation (using Claude API)
- [ ] Job posting parser
- [ ] Basic compatibility scoring
- [ ] Simple resume customization (reorder bullets)
- [ ] Verification queue (side-by-side comparison)
- [ ] PDF download
- [ ] Master resume storage (PostgreSQL)

### Phase 2: Polish & Scale (2-3 weeks)
- [ ] Additional templates (Modern, Minimalist)
- [ ] Upload existing resume feature
- [ ] Format learning & preservation
- [ ] Chrome extension (basic functionality)
- [ ] Resume version history
- [ ] Application tracking
- [ ] Email notifications

### Phase 3: Advanced Features (3-4 weeks)
- [ ] Auto-fill job applications (extension)
- [ ] Advanced keyword injection
- [ ] Cover letter generator
- [ ] Competitor resume analysis
- [ ] Job matching recommendations
- [ ] API for integration with job boards

---

## PART 8: SAFETY & COMPLIANCE

### Data Security
- All resume data encrypted at rest (AES-256)
- HTTPS for all data transmission
- User owns their data; can export/delete anytime
- No sharing of resume data with 3rd parties without consent

### Privacy
- GDPR compliant
- Clear privacy policy
- No tracking/analytics without consent
- Option to use locally (offline mode in future)

### AI Accuracy
- Always show source (which part of resume + which job requirement)
- Transparent about changes (full audit trail)
- User has final approval on all changes
- No automatic submissions (always manual review)

---

## PART 9: SUCCESS METRICS

### User Acquisition
- Users created per month
- Template selection (which templates preferred)
- Conversion from signup to completed resume

### Engagement
- Resumes customized per user (avg)
- Jobs analyzed per user (avg)
- Applications tracked (to measure ROI)

### Quality
- User approval rate for AI suggestions (% of changes approved)
- Time saved per application (estimated)
- Application success rate (track interviews/offers correlating to app)

### Satisfaction
- NPS score (likelihood to recommend)
- Feature usage (which features drive most value)
- Support tickets (identify pain points)

---

## PART 10: DEPLOYMENT & HOSTING

### Backend Deployment
- **Platform:** AWS / GCP / Heroku
- **Database:** PostgreSQL (managed: AWS RDS or similar)
- **Storage:** AWS S3 (for PDFs)
- **Cache:** Redis (for parsing job descriptions, caching templates)
- **API:** REST or GraphQL (design choice)

### Frontend Deployment
- **Platform:** Vercel / Netlify (for web app)
- **CDN:** Cloudflare (for performance)
- **Extension:** Chrome Web Store, Firefox Add-ons

### Scaling Considerations
- Database indexing on user_id, job_posting_id
- Caching layer for AI prompts (to reduce API calls)
- Rate limiting on API endpoints
- Background jobs (async PDF generation, email notifications)

---

## PART 11: COST ESTIMATION (Monthly)

| Component | Cost |
|-----------|------|
| Claude API (resume generation, parsing) | $500-2000 |
| AWS RDS (PostgreSQL) | $50-200 |
| AWS S3 (resume storage) | $20-100 |
| Redis (caching) | $50-150 |
| Hosting (backend) | $100-500 |
| CDN & monitoring | $50-200 |
| **Total** | **~$770-3150/month at scale** |

**Revenue Model Options:**
- Freemium: Free resume builder, paid for customizations ($5-10/month)
- Premium subscription: Unlimited customizations ($9.99-19.99/month)
- B2B: Sell to career coaches, universities (custom pricing)

---

## QUICK START GUIDE FOR DEVELOPERS

If you're building this, start here:

1. **Set up project structure:**
   ```
   resume-builder/
   ├── backend/
   │   ├── models/ (database schemas)
   │   ├── routes/ (API endpoints)
   │   ├── prompts/ (AI prompts)
   │   ├── utils/ (parsing, formatting)
   │   └── services/ (Claude API calls)
   ├── frontend/
   │   ├── components/ (React)
   │   ├── pages/ (onboarding, builder, customizer)
   │   └── utils/ (formatting, validation)
   ├── extension/
   │   ├── manifest.json
   │   ├── popup.html/js
   │   └── content-scripts/
   └── prompts/ (all AI prompts as files)
   ```

2. **Build in this order:**
   - Auth system
   - Database schema
   - Resume builder questionnaire
   - AI generation (using Claude)
   - Job parser
   - Customization logic
   - Verification queue
   - PDF generation
   - Extension

3. **Test rigorously:**
   - Unit tests for resume data validation
   - Integration tests for AI prompt outputs
   - E2E tests for full user flows
   - QA on all verification gates (prevent false customizations)

4. **Key libraries to consider:**
   - **PDFKit** or **pdfmake** (PDF generation)
   - **Cheerio** or **jsdom** (HTML parsing for job boards)
   - **Bull** (job queue for async tasks)
   - **Nodemailer** (email notifications)
   - **Multer** (file uploads)

---

## FINAL NOTES

This specification is comprehensive but flexible. You can:
- Start with MVP and add features gradually
- Adjust templates based on user feedback
- Modify AI prompts if they're not generating expected quality
- Add integrations with job boards as priorities evolve

The key principle: **Always prioritize authenticity over aggressive optimization.**

A resume that honestly showcases a candidate's skills will outperform one that overextends. This is your competitive advantage.

Good luck building this! 🚀
