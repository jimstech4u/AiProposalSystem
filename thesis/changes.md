# Thesis ↔ Codebase Consistency Review

**Document reviewed:** `thesis/Ajibewa_Irekanmi_25626_Thesis.docx`
**Code reviewed:** `Ai Proposal System` (React 18 + TypeScript SPA, Supabase PostgreSQL, NVIDIA LLM API), `supabase.sql`, and the figure images in `thesis/images/`.
**Date:** 2026-06-18

This is a list of everything that does **not** match the actual system, ordered by severity, for your review. Nothing in the thesis or code was changed — this is a proposal of edits only.

---

## ⚠️ Legend
- 🔴 **Critical** – factually wrong; a reviewer comparing the document to the running system will catch it.
- 🟠 **Important** – inconsistent or outdated; should be fixed.
- 🟡 **Minor** – cosmetic / numbering / wording.
- ✅ **Correct** – verified accurate, listed so you know **not** to touch it.

---

## 🔴 1. The system is described as custom-trained Machine Learning / NLP, but it is actually an LLM API integration

This is the single biggest recurring issue. It appears in the **Abstract**, **Objectives**, **System Architecture**, **Software Testing**, **Recommendations**, and the sequence/use-case descriptions.

**What the thesis says (repeatedly):**
- "machine learning-assisted estimation logic", "AI estimation models **trained on** historical project data"
- "NLP-based requirement analysis engine", "applies NLP-based feature extraction", "classification models"
- Recommendation: "the AI estimation models should be periodically **retrained** … a quarterly model **review/retraining**".

**What the code actually does:**
- All AI features call a single **Large Language Model over an HTTP API** — `src/lib/nvidia.ts` → `https://integrate.api.nvidia.com/v1/chat/completions` (OpenAI-compatible), model **`meta/llama-3.3-70b-instruct`** (configured in `.env.local` / `src/lib/config.ts`).
- There is **no trained ML model, no NLP pipeline, no scikit-learn/NLTK, no model training or retraining**. Each module builds a text prompt and parses the JSON/text the LLM returns (`requirement-analysis.tsx`, `proposal-generation.tsx`, `cost-estimation.tsx`, `timeline-prediction.tsx`, `technology-recommendation.tsx`).
- When the API is unavailable, the app falls back to **deterministic local heuristics** (`buildLocalProposalContent`, `localEstimateFromProject`, `localTimelineFromProject`, `buildLocalRecommendation`).

**Recommended change:** Re-word AI claims throughout to "AI-assisted via a **Large Language Model (LLM)** accessed through an API (NVIDIA NIM, model `meta/llama-3.3-70b-instruct`), with deterministic local fallbacks; the project repository provides historical context." Remove "trained models / retraining / NLP classification" language, or explicitly reframe "continuous improvement" as **prompt/context refinement** rather than model retraining.

> Note: A previous version used Google **Gemini**; it has now been switched to **NVIDIA**. Make sure no "Gemini" wording remains in the thesis.

---

## 🔴 2. "Technologies and Tools Used" table — omits the AI provider; otherwise correct

Location: **Chapter 4 → Technologies and Tools Used**.

✅ The listed rows are accurate: React 18 + TypeScript, Vite, React Router DOM v7, Tailwind CSS v4, Radix UI, Lucide React, Recharts, Sonner, Supabase PostgreSQL, VS Code.

🔴 **Missing the most important item for an "AI-Powered" system — the AI engine itself.** Add a row:
- **NVIDIA NIM LLM API (`meta/llama-3.3-70b-instruct`)** — AI requirement analysis, proposal generation, cost/timeline estimation, and technology recommendation.

🟡 Also missing (optional, present in `package.json`): **MUI (@mui/material)** and **Framer Motion (`motion`)**. Add if you want the list to be exhaustive.

---

## 🔴 3. System Architecture **prose contradicts its own (correct) diagram**

Location: **Chapter 3 → System Architectural Design** (Figure 23).

✅ **Figure 23 (the image) is correct and modern:** Users = Engineer/PM/Sales/Admin; React 18 + TypeScript SPA (Vite, Tailwind, Radix); Supabase Auth + RBAC; PostgreSQL; AI-Assisted Logic Layer; External Services. **Do not change the diagram.**

🔴 **The surrounding paragraphs contradict the diagram and the code:**
| Thesis prose says | Reality (code + the diagram) |
|---|---|
| "Presentation Layer … built using **HTML, CSS, JavaScript, and Bootstrap**" | **React 18 + TypeScript + Tailwind CSS v4 + Radix UI + MUI** (no Bootstrap, no hand-written HTML/CSS/JS) |
| "Database Layer: Built on **MySQL**" (stated twice) | **Supabase PostgreSQL** |
| "AI Processing Layer: machine learning estimation models, NLP engine…" | **LLM API call** (see item 1) |
| "RESTful APIs" between a custom frontend/backend | The SPA talks **directly to Supabase REST (PostgREST)** and to the **LLM API**; there is **no custom PHP/REST backend** |

**Recommended change:** Rewrite the four layer paragraphs to match the diagram: Presentation (React/TS/Tailwind/Radix SPA) → Supabase (Auth + RLS + PostgREST) → PostgreSQL → LLM API for AI tasks. Replace every "MySQL" with "PostgreSQL (Supabase)".

---

## 🔴 4. Data Dictionary (Tables 16–21) uses MySQL types and wrong fields — the real DB is PostgreSQL

Location: **Chapter 3 → Data Dictionary**. The actual schema is in `supabase.sql`.

🔴 **Data types are MySQL, the system uses PostgreSQL:**
- `INT … Auto Increment` primary keys → real schema uses **`uuid` primary keys** (`gen_random_uuid()`).
- `TINYINT(1)` → **`boolean`**; `DATETIME` → **`timestamptz`**; `DECIMAL` → `numeric`; `role VARCHAR` → a PostgreSQL **enum `app_role`**.

🔴 **Specific table problems:**
- **Table 16 "User Table"** — the system table is **`user_profiles`**, and it has **no `password` column** (passwords live in Supabase `auth.users.encrypted_password`). Real columns: `id (uuid)`, `full_name`, `email`, `phone`, `employee_id`, `company_name`, `job_title`, `department`, `role (app_role)`, `avatar_url`, `is_active`, `created_at`, `updated_at`. **Remove the `password` field** from the data dictionary.
- **Table 17 "Projects"** — uses `client_name VARCHAR(20)` and `project_title VARCHAR(20)`. Real schema: `client_id uuid → clients(id)` (a foreign key, not a name string), `title text`, plus `description`, `industry`, `project_type`, `status (project_status enum)`, `requirements_text`, `target_users`, `integration_needs`, `constraints`, `complexity_score`, `confidence_score`, `submitted_by`. (Also `VARCHAR(20)` is far too short for a title.)
- **Table 18 "Proposal"** — field `generated_by` → real column is **`created_by`**. Real proposals table also has `title`, `template_name`, `tone`, `detail_level`, `executive_summary`, `technical_approach`, `architecture_description`, `deliverables/assumptions/acceptance_criteria (jsonb)`, `status (proposal_status enum)`, `version`, `generated_content (jsonb)`.
- **Table 19 "Cost Estimation"** — 🔴 `currency DEFAULT 'USD'` → real default is **`'NGN'`** (see item 8). `breakdown TEXT` and `confidence_level VARCHAR` don't exist; real columns: `development_cost`, `infrastructure_cost`, `third_party_cost`, `contingency_percent`, `contingency_amount`, `total_cost`, `min_cost`, `max_cost`, `confidence_score (numeric)`, `assumptions (jsonb)`, plus a separate **`cost_estimation_items`** table.
- **Table 20 "Technology Recommendations"** — real columns: `stack_name`, `frontend`, `backend`, `database_name`, `hosting`, `match_score`, `rationale`, `pros/cons/alternatives (jsonb)` (not `frontend_stack`/`backend_stack`/`justification`).
- **Table 21 "Notifications"** — uses `recipient_id`, `is_read TINYINT`, `sent_by`. Real columns: `user_id`, `title`, `message`, `type`, `entity_type`, `entity_id`, `read_at (timestamptz)`, `created_at`. There is **no `sent_by` / `is_read`** (read state is the `read_at` timestamp).

**Recommended change:** Regenerate all data-dictionary tables from `supabase.sql` (uuid PKs, `timestamptz`, `boolean`, `numeric`, enums), fix field names, drop the `password` field, and change currency to NGN. Optionally note the larger schema has 19 tables (incl. `clients`, `proposal_versions`, `proposal_reviews`, `cost_estimation_items`, `timeline_phases`, `proposal_templates`, `integrations`, `report_configs`, `user_settings`, `audit_logs`).

---

## 🔴 5. Roles: "Client" is not a login role, and "Sales" is missing everywhere

The thesis consistently lists the four roles as **System Administrator, Project Manager, Software Engineer, and Client**. The actual system roles (`app_role` enum in `supabase.sql`, `src/lib/permissions.ts`, the signup dropdown, and the login "Demo Access" panel) are:

> **engineer, project-manager, sales, admin**

- 🔴 **There is no "Client" login/role.** Clients are **records** in the `clients` table (managed by PM/Sales/Admin), not users who log in. The signup page (`register.tsx`) offers only **Software Engineer / Project Manager / Sales Team**. Figure 25 (Login) confirms demo accounts: `engineer@`, `manager@`, `sales@`, `admin@company.com`.
- 🔴 **The "Sales" role is never mentioned** anywhere in the thesis, but it exists in the system and even has its own dashboard (`sales-dashboard.tsx`) and permission set.

**Recommended change:** Replace the "Client" role with **"Sales"** in the role list throughout (Functional Req REQ 1 & REQ 8, Scope, Use Case intro, Role-Based Dashboard section, Use Case tables). Where you genuinely mean the customer (e.g., "submit a client brief"), refer to them as a **client record / external party**, not a system user role. Confirmed by the **Role Permissions Matrix** visible in Figure 30 (Engineer / Project Manager / Sales / Admin).

---

## 🟠 6. Use Case Diagram (Figure 7) and use-case tables — actor mismatches

- 🟠 **Figure 7 actors are `Client`, `Software Engineer`, `System Administrator`.** It is missing **Project Manager** and **Sales**, and includes **Client** (not a system role). The diagram should show the real actors **Engineer, Project Manager, Sales, Administrator** (+ AI Engine). (Note: even the thesis text lists actors as "Software Engineer, Project Manager, System Administrator, and Client", which itself doesn't match the diagram's three actors.)
- 🟠 **Table 1 (Register User Account)** actor = "New User (Client, Software Engineer, System Administrator)" → registration offers **Engineer / PM / Sales** (Admin is seeded, not self-registered); no Client.
- 🟠 **Table 4 (Submit Project Requirements)** actor = "Client" → in code requirements are created by **engineer / project-manager / sales** (`permissions.ts`), via the Requirement Analysis page.
- 🟠 **Table 10 (Manage Project Repository)** actor = "Software Engineer, System Administrator" → repository create/update/delete is **project-manager / admin** (engineer is read-only).
- 🟠 **Table 11 (Generate Reports & Analytics)** actor = "System Administrator, Software Engineer" → reports are **project-manager / sales / admin** (not engineer).
- 🟡 **Tables 2 and 3 are duplicates** — both titled "Use Case Description for Login into System" with identical content (the List of Tables even lists them identically). The prose above Table 3 actually describes *account management*. One of these should be corrected/removed.

✅ The use-case **descriptions** (pre/post-conditions, normal/alternative flows) are otherwise well-written and structurally consistent with the workflow.

---

## 🟠 7. Screenshots (Figures 24–30)

All screenshots are **genuine captures of the real app** and the UI matches the code. Issues:

- 🔴 **Figure 29 (Cost Estimation) shows US dollars (`$125,000`, `$10K`, `$115K–$135K`).** The current code formats currency as **Naira (₦)** via `formatCurrency` (`Intl.NumberFormat('en-NG', currency:'NGN')`, `src/lib/format.ts`) and the cost prompt asks for an estimate "in NGN". This screenshot is from an older build — **re-capture it with the current NGN build**.
- 🟠 **Figure 26 (Role-Based Dashboard) shows "Total Revenue $2.4M"** (USD) — same currency mismatch (this stat is demo/mock data in the dashboard). Re-capture or reconcile currency.
- 🔴 **Figure 30 is captioned "Admin / System Management Page" but the screenshot is actually the "Security & Audit" page** (Total Activities / Active Users / Security Alerts / Audit Log / Role Permissions Matrix). Either change the caption + description to "Security & Audit", or replace the image with the actual admin/user-management view. Note: there is **no dedicated user-account-management screen** in the codebase — the description of "create/edit/deactivate user accounts, configure AI model parameters, database backup" is **not implemented as shown**; the admin-only screens that exist are the **Admin Dashboard** and **Security & Audit**.
- 🟠 **Sign-Up description** (Figure 24) says the form collects "full name, email, password, confirm password, and role" with "a password strength indicator". The real form (and the screenshot) also collects **Phone, Employee ID, Company Name, Job Title, Department**, and there is **no visible password-strength indicator**. Update the description to match.
- 🟠 **Proposal Generation description** (Figure 28) lists 14 sections (Company Introduction, Project Understanding, Resource and Team Structure, Quality Assurance Approach, Contact Information, …). The app's actual default sections are: **Cover Page, Executive Summary, Project Background, Scope & Objectives, Technical Approach, System Architecture, Module Breakdown, Technology Stack, Timeline & Milestones, Cost Breakdown, Terms & Conditions**. Align the description with the real section list.
- 🟡 **Missing screenshots for two core modules.** The Scope claims seven modules, but there are no figures for the **Timeline Prediction** and **Technology Recommendation** pages (both exist: `timeline-prediction.tsx`, `technology-recommendation.tsx`). Consider adding them for completeness.

---

## 🟠 8. Currency: pick one and use it consistently

- Code/DB use **NGN (₦)**: `supabase.sql` (`currency text default 'NGN'`), `formatCurrency` → `en-NG`/`NGN`, cost prompt "in NGN", and the locale list defaults to `en-NG`.
- The thesis (Data Dictionary Table 19) says **USD**, and screenshots show **`$`**.

**Recommended change:** Standardise on **NGN (₦)** everywhere (it fits the Nigerian case study) — update the data dictionary, and re-capture the dollar screenshots. (Or, if you prefer USD for the document, change `format.ts` and `supabase.sql` to USD — but NGN is the lower-effort, more consistent choice.)

---

## 🟠 9. Software Testing — references a PHP + Python stack that doesn't exist

Location: **Chapter 4 → Software Testing → Integration Testing**.

- 🔴 "The interface between the **PHP application layer** and the **Python AI processing components** was tested…" — there is **no PHP and no Python AI component**. The real integration points are **React SPA ↔ Supabase (PostgREST/Auth) ↔ NVIDIA LLM API**.

**Recommended change:** Rewrite to describe testing of the React app against Supabase (CRUD + RLS) and against the LLM API (request/response parsing, JSON-extraction fallbacks, retry/quota handling, local-fallback paths). The Unit/Validation Testing wording is otherwise fine conceptually.

---

## 🟠 10. Hardware & Software Requirements — server stack is wrong

Location: **Chapter 4 → Hardware and Software Requirements → Server-Side Requirements**.

| Thesis says | Reality |
|---|---|
| Web Server: **Apache 2.4 / NGINX** | None required — the app is a **static Vite build** served by any static host; the backend is **Supabase (managed)** |
| DBMS: **MySQL 8.0** | **Supabase PostgreSQL** |
| Server-Side Scripting: **PHP 8.0 + PDO** | **None** (no server-side scripting; logic is client-side + Supabase) |
| AI Runtime: **Python 3.8 + scikit-learn/NLTK/NumPy/Pandas** | **None locally** — AI is the **hosted NVIDIA LLM API** |
| **phpMyAdmin 5.0** | **Supabase Studio** |
| **NVIDIA GPU** "for AI model training and inference" | No local GPU — inference is on **NVIDIA's hosted API** |

✅ The **Client-Side Requirements** (browsers, OS list, RAM, processor, resolution, bandwidth) are reasonable and can stay.

**Recommended change:** Replace the server section with: Node.js 18+ (build only), a static host / CDN (or Supabase Hosting), a Supabase project (managed PostgreSQL + Auth), and outbound HTTPS access to the NVIDIA API. Drop Apache/MySQL/PHP/Python/phpMyAdmin and the local-GPU requirement.

---

## 🟠 11. Sequence diagram descriptions — terminology

The seven sequence-diagram **descriptions** are conceptually fine, but a few details don't match the implementation:
- They refer to a generic "**authentication module**" querying the "**user database**". In reality this is **Supabase Auth** (`supabase.auth.signInWithPassword`), with profile/role read from `user_profiles`.
- "AI analysis engine … applies **NLP-based feature extraction** / classification models" → it sends a **prompt to the LLM** and parses the returned JSON (see item 1).
- **Send Notification (Figure 20):** describes a user composing a message, selecting recipients, and dispatching "**via email** depending on notification preferences". In code, notifications are **auto-generated by system events** (e.g., the `notify_proposal_review` DB trigger writes to the `notifications` table) and surfaced via the in-app bell — there is **no compose-and-email notification screen**. Either reframe this as system-generated in-app notifications, or note email delivery as future work.

---

## 🟡 12. List of Figures / List of Tables numbering

- 🟠 **List of Figures is out of sync with the body.** It lists Fig 24 Signup, 25 Login, **26 Proposal Generation, 27 Cost Estimation, 28 Admin** (stops at 28). The body actually has: 24 Signup, 25 Login, **26 Role-Based Dashboard, 27 Requirement Analysis, 28 Proposal Generation, 29 Cost Estimation, 30 Admin**. Update the List of Figures to include Role-Based Dashboard + Requirement Analysis and renumber 24–30.
- 🟡 **List of Tables:** "Table 16: **Uses** Table" → should read "**User** Table" (matches the body).
- 🟡 A couple of figure captions sit **above** their image instead of below (Fig 28, Fig 29) — fix placement.

---

## ✅ Verified correct — do NOT change
- **Figure 23 System Architecture diagram** (the image) — matches the stack and roles.
- **Figure 22 Database diagram** and **Figure 13 Class diagram** — conceptually correct table/entity set (minor field-name drift only: `client_name`→`company_name`, `generated_by`→`created_by`, "Users"→`user_profiles`, Integer→uuid; acceptable for conceptual diagrams).
- **Technologies and Tools table** rows (accurate; just add the AI provider — item 2).
- **Figures 24, 25, 26, 27, 28** are real screenshots that match the implemented UI.
- **Role Permissions Matrix** in Figure 30 — matches `permissions.ts` (Engineer/PM/Sales/Admin).
- Chapters 1–2 narrative (problem, motivation, current manual process, Figure 1) — no code dependency; fine.

---

## Suggested priority order for editing
1. Item 5 (roles: Client→Sales) and item 1 (AI = LLM, not trained ML/NLP) — they recur across many chapters.
2. Items 3, 4, 9, 10 (architecture prose, data dictionary, testing, server requirements) — the hard technical facts (MySQL/PHP/Python → PostgreSQL/Supabase/LLM).
3. Item 7 + 8 (re-capture NGN screenshots, fix Fig 30 caption).
4. Items 2, 6, 11, 12 (tech table AI row, use-case actors, sequence wording, figure/table lists).

---

### Notes on verification method
Findings were derived from the thesis text/tables/figures extracted from the `.docx`, cross-checked against `supabase.sql`, `src/lib/*` (`config.ts`, `nvidia.ts`, `permissions.ts`, `format.ts`, `supabase.ts`), the page components in `src/app/pages/**`, `package.json`, and visual inspection of every diagram and screenshot in `thesis/images/`. A live click-through with test users was **not** performed (no browser-automation tooling in this environment), but the login screen exposes demo accounts — `engineer@ / manager@ / sales@ / admin@company.com` (any password) — if you want to walk each page manually to confirm.
