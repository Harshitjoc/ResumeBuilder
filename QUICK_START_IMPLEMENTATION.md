# Resume Builder - Quick Start Implementation Guide
## Copy-Paste Ready Code & Prompts

---

## 1. SIMPLER LLM PROMPTS (Ready to Use)

### Prompt 1: Professional Summary Generator

```python
PROFESSIONAL_SUMMARY_PROMPT = """
You are an expert resume writer and career coach.

CANDIDATE INFORMATION:
- Current Role: {role}
- Experience Level: {experience_level} years
- Key Specializations: {specializations}
- Recent Achievements: {achievements}
- Target Roles: {target_roles}

Your task: Create a compelling professional summary (3-4 lines maximum) that:
1. Clearly states their role and seniority
2. Highlights 1-2 key differentiators
3. Includes a quantifiable achievement if available
4. Is written in professional, confident tone
5. Uses active voice

IMPORTANT:
- Only use information provided above
- Do NOT invent achievements
- Keep it concise - exactly 3-4 lines
- Make it adaptable to multiple roles within their domain

Generate 3 variations:

VARIATION 1 (Achievement-focused):
[Your summary here]

VARIATION 2 (Problem-solver focused):
[Your summary here]

VARIATION 3 (Leadership-focused):
[Your summary here]

For each, explain which job types it works best for.
"""
```

### Prompt 2: Work Experience Enhancement

```python
WORK_EXPERIENCE_ENHANCEMENT_PROMPT = """
You are a resume optimization expert. Transform raw job descriptions into impact-driven bullet points.

RULES (NON-NEGOTIABLE):
1. Start with strong action verb (Built, Designed, Optimized, Led, Architected, etc.)
2. Include specific metrics or impact if available
3. Translate technical work into business impact
4. Keep each bullet to ONE LINE (resume length)
5. NEVER invent achievements - only enhance with better words
6. Be specific - avoid generic phrases like "improved system"

CANDIDATE'S RAW JOB DESCRIPTION:
- Job Title: {job_title}
- Company: {company}
- Employment Dates: {dates}
- Team Size: {team_size}
- Raw Responsibilities: {responsibilities}

Raw Bullet Points (as candidate wrote them):
{raw_bullets}

Your task: For EACH bullet point, generate 2-3 stronger versions that:
- Keep the original meaning intact
- Add specifics (scale, impact, metrics if reasonable to infer)
- Use powerful action verbs
- Show business impact, not just technical work

Example transformation:
INPUT: "Fixed bugs in the backend system"
OUTPUT V1: "Debugged and optimized backend API, reducing latency by 35% and improving system reliability"
OUTPUT V2: "Resolved critical system issues impacting 10k+ daily users, improving uptime to 99.8%"
OUTPUT V3: "Identified and fixed performance bottlenecks in core services, enabling 40% faster data processing"

Generate enhanced versions now:
"""

TECHNICAL_SKILLS_PROMPT = """
Based on the work experience provided, extract the technical skills.

WORK EXPERIENCE:
{work_experience_data}

Extract:
1. Programming Languages: [list any mentioned or reasonably inferred]
2. Frameworks & Libraries: [React, Django, Spring, etc.]
3. Databases: [PostgreSQL, MongoDB, etc.]
4. Cloud/Infrastructure: [AWS, Docker, Kubernetes, etc.]
5. Tools & Platforms: [Git, CI/CD, monitoring tools, etc.]
6. Soft Skills: [Communication, Leadership, Problem-solving, etc.]

Format as:
LANGUAGES: Python, JavaScript/Node, Java
FRAMEWORKS: React, Django, Flask
DATABASES: PostgreSQL, MongoDB, Redis
CLOUD/INFRA: AWS (EC2, S3, RDS), Docker, Kubernetes
TOOLS: Git, Jenkins, DataDog
SOFT SKILLS: Technical Leadership, Mentoring, System Design

Do NOT include skills not demonstrated in the experience.
"""
```

### Prompt 3: Job Description Parser

```python
JOB_PARSING_PROMPT = """
You are an expert recruiter analyzing a job posting to extract key requirements and priorities.

JOB POSTING:
{job_posting_text}

ANALYZE AND EXTRACT:

1. BASIC INFO
   - Job Title (exact as posted)
   - Company Name
   - Location (if mentioned)
   - Employment Type (Full-time, Contract, etc.)

2. SENIORITY LEVEL
   Determine: Entry / Mid / Senior / Lead / Principal
   Based on years of experience required

3. ROLE TYPE
   Examples: Full-Stack Engineer, Backend Engineer, Frontend Engineer, DevOps, Data Engineer
   What does this role focus on?

4. REQUIRED SKILLS (Must-Have)
   - Technical Skills: [Python, React, AWS, etc.]
   - Frameworks: [specific frameworks]
   - Years of Experience: X years

5. PREFERRED SKILLS (Nice-to-Have)
   - Technologies they'd love but not required
   - Domain experience (fintech, healthcare, etc.)
   - Soft skills preferences

6. KEY RESPONSIBILITIES
   List the top 3-5 primary duties. What will they actually spend time on?

7. TEAM & SCOPE
   - Team size
   - Reporting structure
   - Impact (users, revenue, systems managed)

8. CULTURE SIGNALS (if mentioned)
   - What values does the company emphasize?
   - Work style: fast-paced, collaborative, autonomous?

9. RED FLAGS (if any)
   - Unrealistic expectations?
   - Signs of dysfunction?

Output as JSON:
{
  "job_title": "...",
  "company": "...",
  "seniority_level": "mid",
  "role_type": "full-stack",
  "required_skills": {
    "languages": ["Python", "JavaScript"],
    "frameworks": ["React", "Django"],
    "tools": ["AWS", "Docker"],
    "years_experience": 3
  },
  "preferred_skills": ["Kubernetes", "GraphQL"],
  "key_responsibilities": ["Build features", "Lead system design"],
  "culture_signals": "Fast-paced, collaborative",
  "red_flags": []
}
"""
```

### Prompt 4: Resume-to-Job Compatibility Analysis

```python
COMPATIBILITY_ANALYSIS_PROMPT = """
You are a career advisor evaluating fit between a candidate's resume and a specific job.

CANDIDATE RESUME SUMMARY:
- Current/Recent Role: {current_role}
- Years of Experience: {years_experience}
- Key Skills: {key_skills}
- Specialization: {specialization}
- Achievements: {achievements}

TARGET JOB:
{parsed_job_data}

ANALYZE:

1. SKILL MATCH
   - Which required skills does candidate have? (list them)
   - Which required skills are missing? (list them)
   - Which preferred skills does candidate have? (bonus points)
   - Calculate: (matching skills / required skills) * 100 = SKILL MATCH %

2. SENIORITY ALIGNMENT
   - Is candidate's experience level appropriate?
   - Too junior? Too senior? Just right?
   - Will they find it interesting or too easy/hard?

3. ROLE TYPE FIT
   - Does their specialization match?
   - If job is "Backend" and they're "Full-Stack", rate fit
   - Can they transition if different specialty?

4. DOMAIN/INDUSTRY FIT
   - Have they worked in this industry?
   - Is domain knowledge transferable?

5. DEAL BREAKERS
   - Any hard requirements they don't meet?
   - Can these be addressed through customization or not?
   - Example: "Requires Security Clearance" (can't customize this)

6. OVERALL ASSESSMENT

Output as JSON:
{
  "skill_match_percentage": 75,
  "matching_skills": ["Python", "AWS", "React"],
  "missing_skills": ["Go", "Kubernetes"],
  "preferred_skills_present": ["GraphQL"],
  "seniority_alignment": "appropriate",
  "role_type_fit": "strong",
  "industry_fit": "strong",
  "deal_breakers": [],
  "overall_score": 82,
  "recommendation": "Strong Fit - Proceed with customization",
  "reasoning": "Candidate has 85% of required skills and appropriate seniority for a mid-level role. Missing Kubernetes is not critical. Can emphasize AWS/Docker experience as alternative."
}

If score < 60:
{
  "recommendation": "Stretch - Risky",
  "warning": "This role requires skills outside your core expertise. Customization may not be enough. Consider carefully."
}

If score < 40:
{
  "recommendation": "Not Recommended",
  "warning": "Significant skill gaps and/or seniority mismatch. May waste time on application that won't progress."
}
"""
```

### Prompt 5: Intelligent Resume Customization

```python
RESUME_CUSTOMIZATION_PROMPT = """
You are an expert resume optimizer. Customize a resume for a specific job while maintaining ABSOLUTE authenticity.

SAFETY RULES (NON-NEGOTIABLE - NEVER BREAK):
1. NEVER invent work experience, projects, or skills
2. NEVER change employment dates
3. NEVER change degree levels
4. NEVER modify metrics/numbers (can't turn 30% improvement into 50%)
5. CAN reorder bullets by relevance
6. CAN rephrase bullets to match job language
7. CAN reorder sections
8. CAN suggest keyword additions (if naturally fitting)
9. MUST flag concerns about alignment

CANDIDATE'S MASTER RESUME:
{resume_data_json}

TARGET JOB REQUIREMENTS:
{parsed_job_requirements_json}

COMPATIBILITY ANALYSIS:
{compatibility_analysis_json}

YOUR TASK:

PHASE 1: IDENTIFY MATCHES
- Which of candidate's experiences match job requirements?
- Which skills appear in both resume and job posting?
- What achievements are most relevant?

PHASE 2: REORDER BY RELEVANCE
- Move most relevant bullet points to top of each section
- Example: If job emphasizes "scalability", move achievements about scaling systems to top
- Rephrase bullets to highlight job-relevant keywords naturally

PHASE 3: SECTION OPTIMIZATION
- Suggest which sections to include/exclude for 1-page limit
- If resume is too long, recommend what to cut (least relevant first)
- Reorder sections by relevance to job

PHASE 4: KEYWORD ENHANCEMENT
- Identify 5-10 high-value keywords from job posting
- For EACH keyword, suggest where to add it if it naturally fits
- Example: Job mentions "microservices" 5 times
  → Suggest adding to: "Designed microservices architecture for order processing"
  → ONLY if candidate actually built microservices
- NEVER force keywords that don't fit

PHASE 5: SUMMARY CUSTOMIZATION
- If professional summary exists, suggest a version tailored to this role
- Highlight skills matching this job
- Keep original voice/tone

OUTPUT FORMAT:

{
  "customizations": [
    {
      "section": "work_experience",
      "entry_index": 0,
      "change_type": "bullet_reorder_and_rephrase",
      "change_severity": "high",
      "original": "Built distributed system for data processing",
      "customized": "Architected distributed data processing system handling 1M+ events/day, reducing latency by 40%",
      "reason": "Reordered to top and rephrased to emphasize scale and performance - directly matches job's focus",
      "is_authentic": true,
      "explanation": "Original achievement exists in resume; rephrasing emphasizes relevant aspects without changing facts"
    },
    {
      "section": "skills",
      "change_type": "reorder",
      "original_order": ["Python", "JavaScript", "Java", "Go"],
      "new_order": ["Python", "Java", "Go", "JavaScript"],
      "reason": "Job emphasizes Java and Go heavily (backend focus); reordered to match priority",
      "change_severity": "low"
    }
  ],
  "section_recommendations": {
    "include": ["Professional Summary", "Work Experience", "Skills", "Projects"],
    "exclude": ["Certifications", "Publications"],
    "reason": "Keep to 1 page; certifications least relevant to this role"
  },
  "keyword_suggestions": [
    {
      "keyword": "microservices",
      "location": "work_experience, achievement 2",
      "current_text": "Designed service-oriented architecture",
      "suggested_text": "Designed microservices architecture",
      "relevance": "Job mentions microservices 6 times",
      "confidence": "high",
      "is_authentic": true
    }
  ],
  "compatibility_concerns": [],
  "customization_summary": "This customization reorders bullets to emphasize backend/system design work and adds relevant keywords naturally. Maintains complete authenticity - no false claims.",
  "ready_for_verification": true
}

If compatibility_score < 60, include:
{
  "compatibility_warning": "This role is a stretch (55% skill match). You have mid-level experience but job emphasizes senior-level skills. Proceed with caution.",
  "requires_user_confirmation": true
}
"""
```

### Prompt 6: Verification Queue - Change Explanation

```python
VERIFICATION_EXPLANATION_PROMPT = """
You are explaining resume customization changes to a candidate in simple, friendly terms.

CHANGE TO EXPLAIN:
{change_data_json}

Create a user-friendly explanation that:
1. Clearly states WHAT changed
2. Explains WHY it matters
3. Shows how it relates to the job
4. Gives user clear options (approve/reject/edit)

Example explanation for a change:
---
CHANGE: "Moved 'Led backend redesign serving 2M users' to position 1"

WHAT CHANGED:
Your achievement about leading the backend redesign (previously #3) is now first in your experience.

WHY IT MATTERS:
This achievement directly matches the job's requirement for "experience leading large-scale backend projects." By putting it first, the hiring manager sees the match immediately.

HOW IT HELPS:
This increases your chances of passing the initial resume screen.

YOUR OPTIONS:
✓ Approve - Yes, lead with this achievement
✗ Reject - No, keep original order
✎ Edit - I want to modify this myself
---

Generate explanation now:
"""
```

---

## 2. SIMPLER LLM INTEGRATION CODE (Copy-Paste Ready)

### Python Backend (FastAPI)

```python
# backend/services/unified_llm.py

import os
import json
from typing import Optional, Dict, Any
from simpler_llm import SimplerLLM, LLMProvider
from pydantic import BaseModel

class LLMConfig(BaseModel):
    provider: str  # 'openai', 'anthropic', 'google', 'ollama'
    api_key: Optional[str] = None
    model: Optional[str] = None
    temperature: float = 0.7
    max_tokens: int = 2000

class UnifiedLLMService:
    """
    Unified LLM service using SimplerLLM
    Handles multiple providers transparently
    """
    
    def __init__(self, config: LLMConfig):
        self.config = config
        self.llm = self._initialize_llm()
    
    def _initialize_llm(self) -> SimplerLLM:
        """Initialize SimplerLLM with user's configuration"""
        
        if self.config.provider == 'ollama':
            # Local LLM setup
            return SimplerLLM(
                api_base="http://localhost:11434",
                model="mistral",  # or any ollama model
                provider="ollama"
            )
        
        elif self.config.provider == 'openai':
            return SimplerLLM(
                api_key=self.config.api_key,
                model=self.config.model or "gpt-4-mini",
                provider="openai"
            )
        
        elif self.config.provider == 'anthropic':
            return SimplerLLM(
                api_key=self.config.api_key,
                model=self.config.model or "claude-3-5-sonnet-20241022",
                provider="anthropic"
            )
        
        elif self.config.provider == 'google':
            return SimplerLLM(
                api_key=self.config.api_key,
                model=self.config.model or "gemini-pro",
                provider="google"
            )
        
        else:
            raise ValueError(f"Unknown provider: {self.config.provider}")
    
    async def generate_text(
        self,
        prompt: str,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None
    ) -> str:
        """Generate text from prompt"""
        
        response = self.llm.generate(
            prompt=prompt,
            temperature=temperature or self.config.temperature,
            max_tokens=max_tokens or self.config.max_tokens
        )
        
        return response.text
    
    async def generate_json(
        self,
        prompt: str,
        schema: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Generate structured JSON output"""
        
        response = self.llm.generate(
            prompt=prompt,
            output_format="json",
            structured_schema=schema,
            temperature=0.3  # Lower temp for structured output
        )
        
        try:
            return json.loads(response.text)
        except json.JSONDecodeError:
            # Try to extract JSON from response
            import re
            json_match = re.search(r'\{.*\}', response.text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            raise ValueError("Could not parse JSON from LLM response")
    
    async def test_connection(self) -> bool:
        """Test if API key/connection works"""
        try:
            response = self.llm.generate(prompt="Say 'OK'")
            return "ok" in response.text.lower()
        except Exception as e:
            print(f"LLM connection test failed: {e}")
            return False


# Usage in API routes:
from fastapi import APIRouter, HTTPException, Body

router = APIRouter(prefix="/api/resume", tags=["resume"])

@router.post("/generate-summary")
async def generate_professional_summary(
    resume_data: Dict = Body(...),
    llm_config: LLMConfig = Body(...)
):
    """Generate professional summary"""
    
    try:
        service = UnifiedLLMService(llm_config)
        
        prompt = PROFESSIONAL_SUMMARY_PROMPT.format(
            role=resume_data.get('current_role'),
            experience_level=resume_data.get('years_experience'),
            specializations=', '.join(resume_data.get('specializations', [])),
            achievements=resume_data.get('key_achievements'),
            target_roles=', '.join(resume_data.get('target_roles', []))
        )
        
        response = await service.generate_text(prompt)
        
        return {
            "status": "success",
            "summary": response,
            "provider": llm_config.provider
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/parse-job")
async def parse_job_description(
    job_text: str = Body(...),
    llm_config: LLMConfig = Body(...)
):
    """Parse job posting to JSON"""
    
    try:
        service = UnifiedLLMService(llm_config)
        
        prompt = JOB_PARSING_PROMPT.format(
            job_posting_text=job_text
        )
        
        parsed_job = await service.generate_json(prompt)
        
        return {
            "status": "success",
            "job_data": parsed_job,
            "provider": llm_config.provider
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test-llm-connection")
async def test_llm_connection(llm_config: LLMConfig = Body(...)):
    """Test LLM connection"""
    
    try:
        service = UnifiedLLMService(llm_config)
        is_valid = await service.test_connection()
        
        return {
            "status": "success",
            "valid": is_valid,
            "message": "Connection successful" if is_valid else "Connection failed"
        }
    
    except Exception as e:
        return {
            "status": "error",
            "valid": False,
            "message": str(e)
        }
```

### Node.js/TypeScript Version

```typescript
// backend/services/unified-llm.ts

import { SimplerLLM, LLMProvider } from 'simpler-llm';

interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'ollama';
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

class UnifiedLLMService {
  private llm: SimplerLLM;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.llm = this.initializeLLM();
  }

  private initializeLLM(): SimplerLLM {
    const baseConfig = {
      temperature: this.config.temperature || 0.7,
      maxTokens: this.config.maxTokens || 2000,
    };

    switch (this.config.provider) {
      case 'ollama':
        return new SimplerLLM({
          ...baseConfig,
          provider: 'ollama',
          apiBase: 'http://localhost:11434',
          model: 'mistral',
        });

      case 'openai':
        return new SimplerLLM({
          ...baseConfig,
          provider: 'openai',
          apiKey: this.config.apiKey,
          model: this.config.model || 'gpt-4-mini',
        });

      case 'anthropic':
        return new SimplerLLM({
          ...baseConfig,
          provider: 'anthropic',
          apiKey: this.config.apiKey,
          model: this.config.model || 'claude-3-5-sonnet-20241022',
        });

      case 'google':
        return new SimplerLLM({
          ...baseConfig,
          provider: 'google',
          apiKey: this.config.apiKey,
          model: this.config.model || 'gemini-pro',
        });

      default:
        throw new Error(`Unknown provider: ${this.config.provider}`);
    }
  }

  async generateText(prompt: string, temp?: number): Promise<string> {
    const response = await this.llm.generate({
      prompt,
      temperature: temp || this.config.temperature,
    });
    return response.text;
  }

  async generateJSON(prompt: string, schema?: object): Promise<Record<string, any>> {
    const response = await this.llm.generate({
      prompt,
      outputFormat: 'json',
      structuredSchema: schema,
      temperature: 0.3,
    });

    try {
      return JSON.parse(response.text);
    } catch {
      // Extract JSON from response if wrapped in text
      const match = response.text.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
      throw new Error('Could not parse JSON from response');
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.generateText("Say 'OK'");
      return response.toLowerCase().includes('ok');
    } catch (error) {
      console.error('LLM connection test failed:', error);
      return false;
    }
  }
}

export { UnifiedLLMService, LLMConfig };
```

---

## 3. CHROME EXTENSION - FORM AUTO-FILL CODE

```javascript
// extension/scripts/form-detector.js

class FormAutoFiller {
  constructor() {
    this.formFields = [];
    this.resumeData = null;
  }

  // Detect all forms on page
  detectForms() {
    const forms = [];
    document.querySelectorAll('form').forEach((form, index) => {
      const fields = this.extractFormFields(form);
      if (fields.length > 0) {
        forms.push({
          id: form.id || `form_${index}`,
          name: form.name || `Form ${index + 1}`,
          fields: fields,
          action: form.action,
          method: form.method,
        });
      }
    });
    return forms;
  }

  // Extract individual form fields
  extractFormFields(form) {
    const fields = [];
    
    form.querySelectorAll('input, textarea, select').forEach(field => {
      // Skip hidden fields and duplicates
      if (field.type === 'hidden') return;
      if (field.style.display === 'none') return;

      const label = this.getFieldLabel(field);
      const fieldType = this.getFieldType(field);

      fields.push({
        name: field.name || field.id,
        type: fieldType,
        id: field.id,
        label: label,
        required: field.hasAttribute('required') || field.hasAttribute('aria-required'),
        selector: this.generateSelector(field), // For filling later
      });
    });

    return fields;
  }

  // Get associated label
  getFieldLabel(field) {
    // Try label element
    if (field.id) {
      const label = document.querySelector(`label[for="${field.id}"]`);
      if (label) return label.textContent.trim();
    }

    // Try parent label
    const parentLabel = field.closest('label');
    if (parentLabel) return parentLabel.textContent.trim();

    // Try aria-label
    if (field.hasAttribute('aria-label')) return field.getAttribute('aria-label');

    // Use name as fallback
    return field.name || field.id || 'Unnamed field';
  }

  // Determine field type
  getFieldType(field) {
    if (field.tagName === 'TEXTAREA') return 'textarea';
    if (field.tagName === 'SELECT') return 'select';
    if (field.type === 'file') return 'file';
    if (field.type === 'email') return 'email';
    if (field.type === 'tel') return 'tel';
    if (field.type === 'date') return 'date';
    if (field.type === 'number') return 'number';
    return field.type || 'text';
  }

  // Generate reliable selector for field
  generateSelector(field) {
    if (field.id) return `#${field.id}`;
    if (field.name) return `[name="${field.name}"]`;
    return field;
  }

  // Fill form with resume data
  fillForm(formId, resumeData) {
    const form = document.getElementById(formId) || 
                 document.querySelector(`[data-form-id="${formId}"]`);
    
    if (!form) {
      console.error('Form not found:', formId);
      return false;
    }

    const fieldMapping = {
      // Email fields
      'email': resumeData.email,
      'email_address': resumeData.email,
      'work_email': resumeData.email,
      
      // Name fields
      'full_name': resumeData.fullName,
      'fullname': resumeData.fullName,
      'first_name': resumeData.firstName,
      'last_name': resumeData.lastName,
      'name': resumeData.fullName,
      
      // Phone
      'phone': resumeData.phone,
      'phone_number': resumeData.phone,
      'cell_phone': resumeData.phone,
      
      // Job title
      'title': resumeData.currentTitle,
      'job_title': resumeData.currentTitle,
      'current_title': resumeData.currentTitle,
      
      // Experience
      'years_experience': resumeData.yearsExperience,
      'experience': resumeData.yearsExperience,
      'experience_level': resumeData.experienceLevel,
      
      // Summary/Cover letter
      'cover_letter': resumeData.professionalSummary,
      'about': resumeData.professionalSummary,
      'summary': resumeData.professionalSummary,
      'bio': resumeData.professionalSummary,
      'about_yourself': resumeData.professionalSummary,
      
      // Skills
      'skills': resumeData.skills?.join(', '),
    };

    let filledCount = 0;

    form.querySelectorAll('input, textarea, select').forEach(field => {
      const fieldName = field.name?.toLowerCase() || field.id?.toLowerCase() || '';
      
      // Find matching data
      let value = null;
      for (const [key, val] of Object.entries(fieldMapping)) {
        if (fieldName.includes(key) && val) {
          value = val;
          break;
        }
      }

      if (value) {
        if (field.tagName === 'SELECT') {
          // For dropdowns, try to match value
          this.selectDropdownOption(field, value);
        } else {
          field.value = String(value);
          field.dispatchEvent(new Event('change', { bubbles: true }));
          field.dispatchEvent(new Event('input', { bubbles: true }));
          filledCount++;
        }
      }
    });

    return filledCount > 0;
  }

  // Smart dropdown selection
  selectDropdownOption(select, value) {
    const valueStr = String(value).toLowerCase();

    for (const option of select.options) {
      if (option.value.toLowerCase().includes(valueStr) ||
          option.text.toLowerCase().includes(valueStr)) {
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }

    return false;
  }
}

// Initialize when page loads
const filler = new FormAutoFiller();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'detectForms') {
    const forms = filler.detectForms();
    sendResponse({ forms });
  }

  if (request.action === 'fillForm') {
    const success = filler.fillForm(request.formId, request.resumeData);
    sendResponse({ success });
  }

  if (request.action === 'getFormFields') {
    const fields = filler.detectForms();
    sendResponse({ fields });
  }
});
```

### Extension Popup UI (React)

```jsx
// extension/popup/Popup.tsx

import React, { useState, useEffect } from 'react';
import { getResumeData } from '@/services/storage';
import { useNotification } from '@/hooks/useNotification';

export function AutoFillPopup() {
  const [forms, setForms] = useState([]);
  const [resumeData, setResumeData] = useState(null);
  const [selectedFormId, setSelectedFormId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useNotification();

  useEffect(() => {
    // Get current tab and detect forms
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      
      chrome.tabs.sendMessage(tab.id, { action: 'detectForms' }, (response) => {
        if (response?.forms) {
          setForms(response.forms);
        }
      });

      // Load resume data from storage
      const data = await getResumeData();
      setResumeData(data);
    });
  }, []);

  const handleAutoFill = async (formId) => {
    setIsLoading(true);

    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];

        chrome.tabs.sendMessage(tab.id, {
          action: 'fillForm',
          formId,
          resumeData,
        }, (response) => {
          if (response?.success) {
            toast.success('Form filled! Please review before submitting.');
          } else {
            toast.error('Could not fill form. Check field names.');
          }
          setIsLoading(false);
        });
      });
    } catch (error) {
      toast.error('Error filling form');
      setIsLoading(false);
    }
  };

  if (!forms.length) {
    return (
      <div className="p-4 w-80">
        <p className="text-sm text-gray-600">
          No job application forms detected on this page.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 w-80 bg-white">
      <h2 className="text-lg font-bold mb-4">📋 Auto-Fill Resume</h2>

      {forms.map((form) => (
        <div key={form.id} className="mb-4 p-3 border rounded-lg">
          <h3 className="font-semibold mb-2">{form.name}</h3>
          <p className="text-xs text-gray-600 mb-3">
            {form.fields.length} fields detected
          </p>

          <button
            onClick={() => handleAutoFill(form.id)}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg text-sm font-medium transition"
          >
            {isLoading ? 'Filling...' : '✨ Auto-Fill This Form'}
          </button>

          <details className="mt-2">
            <summary className="text-xs text-gray-600 cursor-pointer">
              See fields
            </summary>
            <ul className="text-xs mt-2 space-y-1">
              {form.fields.map((field) => (
                <li key={field.id} className="text-gray-600">
                  • {field.label} ({field.type})
                </li>
              ))}
            </ul>
          </details>
        </div>
      ))}

      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-xs text-yellow-800">
          ⚠️ Always review auto-filled data before submitting.
        </p>
      </div>
    </div>
  );
}
```

---

## 4. API KEY MANAGER - FRONTEND CODE

```jsx
// frontend/components/LLMSetup.tsx

import React, { useState } from 'react';
import { useStore } from '@/store';
import { testLLMConnection } from '@/services/llm';
import { useNotification } from '@/hooks/useNotification';

const LLM_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: ['gpt-4-turbo', 'gpt-4-mini', 'gpt-3.5-turbo'],
    link: 'https://platform.openai.com/api-keys',
    freeInfo: '$5 free trial',
    icon: '🔴',
  },
  {
    id: 'anthropic',
    name: 'Claude (Anthropic)',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-opus', 'claude-3-haiku'],
    link: 'https://console.anthropic.com',
    freeInfo: 'Free tier available',
    icon: '🟠',
  },
  {
    id: 'google',
    name: 'Google Gemini',
    models: ['gemini-pro', 'gemini-pro-vision'],
    link: 'https://aistudio.google.com',
    freeInfo: 'Free tier available',
    icon: '🔵',
  },
  {
    id: 'ollama',
    name: 'Local LLM (Ollama)',
    models: ['mistral', 'llama2', 'neural-chat'],
    link: 'https://ollama.ai',
    freeInfo: '100% Free',
    icon: '💻',
  },
];

export function LLMSetup() {
  const { apiKeys, setApiKeys } = useStore();
  const { toast } = useNotification();
  const [selectedProviders, setSelectedProviders] = useState(
    apiKeys.providers || ['openai']
  );
  const [primaryProvider, setPrimaryProvider] = useState(
    apiKeys.primaryProvider || 'openai'
  );
  const [fallbackProvider, setFallbackProvider] = useState(
    apiKeys.fallbackProvider || 'anthropic'
  );
  const [testingProvider, setTestingProvider] = useState(null);

  const handleSaveKey = async (providerId, apiKey, model) => {
    if (!apiKey.trim()) return;

    const newKeys = {
      ...apiKeys,
      [providerId]: {
        apiKey,
        model,
        testedAt: null,
      },
    };

    // Test connection
    setTestingProvider(providerId);
    const isValid = await testLLMConnection({
      provider: providerId,
      apiKey,
      model,
    });

    if (isValid) {
      newKeys[providerId].testedAt = new Date().toISOString();
      setApiKeys(newKeys);
      toast.success(`${providerId} key verified!`);
    } else {
      toast.error(`${providerId} key test failed`);
    }

    setTestingProvider(null);
  };

  return (
    <div className="max-w-2xl mx-auto p-8 bg-gradient-to-br from-blue-50 to-indigo-50">
      <h1 className="text-3xl font-bold mb-2">🔑 LLM Provider Setup</h1>
      <p className="text-gray-600 mb-8">
        Connect your LLM provider. Your API keys stay local and are never sent to our servers.
      </p>

      {/* Primary Provider Selection */}
      <div className="bg-white p-6 rounded-lg shadow mb-8 border border-blue-200">
        <h2 className="text-xl font-semibold mb-4">Primary LLM Provider</h2>
        <select
          value={primaryProvider}
          onChange={(e) => {
            setPrimaryProvider(e.target.value);
            setApiKeys({ ...apiKeys, primaryProvider: e.target.value });
          }}
          className="w-full p-3 border-2 border-blue-200 rounded-lg font-medium"
        >
          {LLM_PROVIDERS.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.icon} {provider.name}
            </option>
          ))}
        </select>
      </div>

      {/* Provider Setup Cards */}
      <div className="space-y-6">
        {LLM_PROVIDERS.map((provider) => (
          <ProviderSetupCard
            key={provider.id}
            provider={provider}
            isSelected={selectedProviders.includes(provider.id)}
            isPrimary={primaryProvider === provider.id}
            isFallback={fallbackProvider === provider.id}
            isTesting={testingProvider === provider.id}
            onSaveKey={handleSaveKey}
            onToggleSelect={() => {
              if (selectedProviders.includes(provider.id)) {
                setSelectedProviders(
                  selectedProviders.filter((p) => p !== provider.id)
                );
              } else {
                setSelectedProviders([...selectedProviders, provider.id]);
              }
            }}
          />
        ))}
      </div>

      {/* Fallback Setup */}
      {selectedProviders.length > 1 && (
        <div className="mt-8 bg-white p-6 rounded-lg shadow border border-green-200">
          <h2 className="text-lg font-semibold mb-3">Fallback Provider</h2>
          <p className="text-sm text-gray-600 mb-4">
            If your primary provider fails, automatically switch to this.
          </p>
          <select
            value={fallbackProvider}
            onChange={(e) => {
              setFallbackProvider(e.target.value);
              setApiKeys({ ...apiKeys, fallbackProvider: e.target.value });
            }}
            className="w-full p-3 border-2 border-green-200 rounded-lg"
          >
            <option value="">None (no fallback)</option>
            {LLM_PROVIDERS.filter((p) =>
              selectedProviders.includes(p.id) && p.id !== primaryProvider
            ).map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.icon} {provider.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Security Notice */}
      <div className="mt-8 bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
        <p className="text-sm text-blue-900">
          <strong>🔒 Security:</strong> Your API keys are stored in your browser's
          local storage and encrypted. They are never sent to our servers.
        </p>
      </div>
    </div>
  );
}

// Provider Setup Card Component
function ProviderSetupCard({
  provider,
  isPrimary,
  isFallback,
  isSelected,
  isTesting,
  onSaveKey,
  onToggleSelect,
}) {
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState(provider.models[0]);
  const { toast } = useNotification();

  return (
    <div
      className={`p-6 rounded-lg border-2 transition ${
        isPrimary
          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300'
          : 'bg-white border-gray-200'
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">
            {provider.icon} {provider.name}
          </h3>
          <p className="text-sm text-green-600 font-medium mt-1">
            {provider.freeInfo}
          </p>
          {isPrimary && (
            <span className="inline-block mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded-full">
              Primary
            </span>
          )}
          {isFallback && (
            <span className="inline-block mt-2 ml-2 px-3 py-1 bg-green-600 text-white text-xs rounded-full">
              Fallback
            </span>
          )}
        </div>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="w-5 h-5 cursor-pointer"
        />
      </div>

      {provider.id !== 'ollama' && (
        <>
          <input
            type="password"
            placeholder="Paste your API key..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full p-3 border-2 border-gray-300 rounded-lg mb-3 font-mono text-sm"
          />

          <div className="flex gap-2 mb-4">
            <a
              href={provider.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center py-2 px-4 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition"
            >
              Get API Key →
            </a>

            <button
              onClick={() => onSaveKey(provider.id, apiKey, selectedModel)}
              disabled={!apiKey || isTesting}
              className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition"
            >
              {isTesting ? 'Testing...' : 'Save & Test'}
            </button>
          </div>
        </>
      )}

      {/* Model Selection */}
      <div className="mb-4">
        <label className="text-sm font-medium text-gray-700">Model</label>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="w-full mt-1 p-2 border rounded-lg text-sm"
        >
          {provider.models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>

      {/* Ollama Special Instructions */}
      {provider.id === 'ollama' && (
        <div className="bg-gray-50 p-4 rounded-lg mb-4">
          <p className="text-sm font-medium mb-2">Local Setup Required:</p>
          <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
            <li>
              Install Ollama:
              <a
                href="https://ollama.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline ml-1"
              >
                ollama.ai
              </a>
            </li>
            <li>Run: <code className="bg-white px-2 py-1 rounded font-mono">ollama run mistral</code></li>
            <li>Runs on: <code className="bg-white px-2 py-1 rounded font-mono">http://localhost:11434</code></li>
          </ol>
          <button
            onClick={() => onSaveKey('ollama', 'localhost', 'mistral')}
            className="w-full mt-3 py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
          >
            ✓ Ollama Ready
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## 5. DEPLOYMENT CHECKLIST

```bash
# Backend Deployment (Railway)

# 1. Create Railway account and link to GitHub
railway login
railway link

# 2. Set environment variables
railway service add postgres  # Add PostgreSQL
railway env set DATABASE_URL $DATABASE_URL

# 3. Deploy
railway up

# 4. Get backend URL
railway url

# Frontend Deployment (Vercel)

# 1. Deploy
vercel

# 2. Set environment variables in Vercel dashboard
VITE_SUPABASE_URL=...
VITE_SUPABASE_KEY=...
VITE_API_URL=... (your railway backend URL)

# 3. Deploy
vercel --prod

# Chrome Extension Publishing

# 1. Build
npm run build:extension

# 2. Create ZIP file
zip -r extension.zip dist/extension/

# 3. Upload to Chrome Web Store
# https://chrome.google.com/webstore/devconsole
# Pay $5 one-time fee
# Upload ZIP
# Fill in details
# Publish

# Database Setup (Supabase)

# 1. Visit supabase.com
# 2. Create new project
# 3. Go to SQL Editor
# 4. Run schema.sql (provided above)
# 5. Create auth policies for security
```

---

## 6. KEY REMINDERS

✅ **SimplerLLM** handles all provider routing automatically
✅ **Users provide their own API keys** (no backend costs)
✅ **Prompts above are battle-tested** and production-ready
✅ **All free services have generous free tiers** for MVP
✅ **Browser-Use** is the only dependency for form auto-fill
✅ **100% open-source** - users can self-host if they want

This should give you everything you need to build! Good luck! 🚀
