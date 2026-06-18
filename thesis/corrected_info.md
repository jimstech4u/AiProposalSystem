# Corrected Thesis Content (grounded in the actual codebase)

This file contains **drop-in replacement text** for the sections of the thesis that did not match the implemented system. Everything here is taken from the real code: `supabase.sql`, `src/lib/*`, the page components in `src/app/pages/**`, and `package.json`.

Roles used throughout the system are exactly four:
**Software Engineer (`engineer`), Project Manager (`project-manager`), Sales (`sales`), and System Administrator (`admin`)**. There is **no "Client" login role** — a *client* is a data record managed by Project Manager / Sales / Admin.

---

## A. The system is an LLM-API integration (not trained ML / NLP)

> Use this wording wherever the thesis currently says "machine-learning models trained on historical data", "NLP feature extraction", "classification models", or "retraining".

**Corrected description:**

The intelligence in the system is provided by a **Large Language Model (LLM) accessed over a hosted API**, not by locally trained machine-learning models. All AI features — requirement analysis, proposal generation, cost estimation, timeline prediction, and technology recommendation — are implemented by composing a structured prompt, sending it to the LLM endpoint, and parsing the returned JSON/text.

- **Provider / model:** NVIDIA NIM (OpenAI-compatible Chat Completions API, `https://integrate.api.nvidia.com/v1/chat/completions`), model **`meta/llama-3.3-70b-instruct`** (configurable through the `VITE_NVIDIA_MODEL` / `VITE_NVIDIA_API_KEY` environment variables in `src/lib/config.ts`).
- **Client module:** `src/lib/nvidia.ts` (`generateWithNvidia`) builds the request, handles authentication, errors (401/403/404/410/429/503), and retry/back-off.
- **Resilience:** when the API is unavailable, each module falls back to **deterministic local heuristics** (`buildLocalProposalContent`, `localEstimateFromProject`, `localTimelineFromProject`, `buildLocalRecommendation`) so the workflow never blocks.
- **Historical context:** past projects in the **project repository** are supplied to the model as *context* in the prompt; the model itself is not retrained. "Continuous improvement" therefore means **prompt and context refinement**, not model retraining.

---

## B. "Technologies and Tools Used" (corrected table)

| Technology / Tool | Use in the System |
|---|---|
| React 18 + TypeScript | Frontend component architecture and typed UI implementation |
| Vite | Development server and production build tool |
| React Router DOM v7 | Client-side routing and protected (role-based) route flow |
| Tailwind CSS v4 | Responsive styling and consistent visual design |
| Radix UI | Accessible, unstyled UI primitives |
| MUI (@mui/material) | Additional UI components |
| Framer Motion (`motion`) | UI animation and transitions |
| Lucide React | Application icons |
| Recharts | Charts for dashboards, cost breakdowns, and analysis results |
| Sonner | Toast notifications |
| **NVIDIA NIM LLM API (`meta/llama-3.3-70b-instruct`)** | **AI requirement analysis, proposal generation, cost & timeline estimation, and technology recommendation** |
| Supabase (PostgreSQL) | Authentication, database, Row-Level Security policies, and audit persistence |
| Supabase Studio | Database administration and inspection |
| Visual Studio Code | Development environment |

---

## C. System Architectural Design (corrected prose)

> Replaces the paragraphs that mention "HTML, CSS, JavaScript, and Bootstrap", "MySQL", and a "Python AI processing layer". This prose now matches Figure 23.

The system follows a modern **client + Backend-as-a-Service (BaaS)** architecture composed of the following layers:

- **Presentation Layer:** A single-page application (SPA) built with **React 18 and TypeScript**, bundled by **Vite**, styled with **Tailwind CSS v4**, and composed from **Radix UI** and **MUI** components. Role-specific views are rendered for Software Engineers, Project Managers, Sales, and System Administrators, each seeing only the features permitted by their role.
- **Application Logic Layer:** Business logic runs in the browser (React hooks/services). It coordinates requirement submission, proposal generation, cost estimation, timeline prediction, and technology recommendation, and enforces role-based access in the UI (`src/lib/permissions.ts`).
- **AI-Assisted Logic Layer:** Calls the **NVIDIA LLM API** (`src/lib/nvidia.ts`) for analysis and generation tasks, with deterministic local fallbacks (see Section A).
- **Data & Authentication Layer:** **Supabase** provides managed **PostgreSQL**, authentication (email/password with JWT sessions), and **Row-Level Security (RLS)** policies that enforce role-based authorization at the database. The SPA communicates with the database through Supabase's **PostgREST** auto-generated REST endpoints; database triggers maintain the audit log and notifications.
- **External Services (future):** Optional integrations such as CRM, e-mail, calendar, and project-management tools.

Key architectural qualities: scalability (managed PostgreSQL + stateless SPA), security (RLS + JWT + HTTPS), maintainability (modular components), and reliability (local AI fallbacks and error handling).

---

## D. Data Dictionary (Tables 16–21, corrected to PostgreSQL)

> The real schema (`supabase.sql`) uses **`uuid` primary keys** (`gen_random_uuid()`), **`timestamptz`**, **`boolean`**, **`numeric`**, **`jsonb`**, and PostgreSQL **enums** — not MySQL `INT/AUTO_INCREMENT/TINYINT/DATETIME`. User passwords are stored by Supabase Auth in `auth.users`, **not** in the profile table.

**Enums:**
- `app_role`: `engineer`, `project-manager`, `sales`, `admin`
- `project_status`: `draft`, `analysis`, `proposal`, `approved`, `won`, `lost`, `archived`
- `proposal_status`: `draft`, `in_review`, `approved`, `rejected`, `sent`, `accepted`, `declined`

### Table 16: `user_profiles`
| Field | Data Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK, FK → auth.users(id) | User identifier (matches Supabase Auth user) |
| full_name | text | NOT NULL | Full name of the user |
| email | text | UNIQUE, NOT NULL | Login email address |
| phone | text | nullable | Contact phone number |
| employee_id | text | UNIQUE, nullable | Organisation employee identifier |
| company_name | text | nullable | Company / organisation name |
| job_title | text | nullable | Job title |
| department | text | nullable | Department |
| role | app_role | NOT NULL, default `engineer` | Access role (engineer / project-manager / sales / admin) |
| avatar_url | text | nullable | Profile picture URL |
| is_active | boolean | NOT NULL, default true | Account active status |
| created_at | timestamptz | NOT NULL, default now() | Creation timestamp |
| updated_at | timestamptz | NOT NULL, default now() | Last update timestamp |

*Note: passwords are held by Supabase Auth (`auth.users.encrypted_password`), not in this table.*

### Table 17: `projects`
| Field | Data Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK, default gen_random_uuid() | Project identifier |
| client_id | uuid | FK → clients(id) | Associated client record |
| title | text | NOT NULL | Project title |
| description | text | nullable | Project description |
| industry | text | nullable | Client industry domain |
| project_type | text | NOT NULL | Type of project (Web, Mobile, etc.) |
| status | project_status | NOT NULL, default `draft` | Project lifecycle status |
| requirements_text | text | nullable | Raw requirements text |
| target_users | text | nullable | Expected user base |
| integration_needs | text | nullable | Integration requirements |
| constraints | text | nullable | Project constraints |
| complexity_score | numeric(5,2) | CHECK 0–100 | AI-computed complexity score |
| confidence_score | numeric(5,2) | CHECK 0–100 | Analysis confidence score |
| submitted_by | uuid | FK → user_profiles(id) | User who submitted the project |
| created_at / updated_at | timestamptz | default now() | Timestamps |

### Table 18: `proposals`
| Field | Data Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK | Proposal identifier |
| project_id | uuid | NOT NULL, FK → projects(id) | Associated project |
| created_by | uuid | FK → user_profiles(id) | User who created/generated it |
| title | text | NOT NULL | Proposal title |
| template_name | text | nullable | Template used |
| tone | text | default `professional` | Writing tone |
| detail_level | text | default `standard` | Level of detail |
| executive_summary / technical_approach / architecture_description | text | nullable | Generated narrative sections |
| deliverables / assumptions / acceptance_criteria | jsonb | default `[]` | Structured list sections |
| status | proposal_status | NOT NULL, default `draft` | Proposal status |
| version | integer | NOT NULL, default 1 | Version number |
| generated_content | jsonb | default `{}` | Full generated section content |
| created_at / updated_at | timestamptz | default now() | Timestamps |

### Table 19: `cost_estimations` (+ `cost_estimation_items`)
| Field | Data Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK | Estimation identifier |
| project_id | uuid | NOT NULL, FK → projects(id) | Associated project |
| proposal_id | uuid | FK → proposals(id) | Associated proposal (optional) |
| created_by | uuid | FK → user_profiles(id) | Author |
| currency | text | NOT NULL, default **`NGN`** | Currency of the estimate |
| development_cost | numeric(14,2) | default 0 | Development labour cost |
| infrastructure_cost | numeric(14,2) | default 0 | Infrastructure / hosting cost |
| third_party_cost | numeric(14,2) | default 0 | Third-party / licensing cost |
| contingency_percent | numeric(5,2) | default 10 | Contingency percentage |
| contingency_amount | numeric(14,2) | default 0 | Contingency amount |
| total_cost | numeric(14,2) | default 0 | Total projected cost |
| min_cost / max_cost | numeric(14,2) | nullable | Estimate range |
| confidence_score | numeric(5,2) | CHECK 0–100 | Estimation confidence |
| assumptions | jsonb | default `[]` | Estimation assumptions |
| created_at | timestamptz | default now() | Timestamp |

**`cost_estimation_items`** — line items: `id (uuid PK)`, `estimation_id (uuid FK)`, `module_name (text)`, `resource_role (text)`, `hours numeric(10,2)`, `hourly_rate numeric(10,2)`, `multiplier numeric(8,2)`, `amount numeric(14,2)` *(generated column: hours × hourly_rate × multiplier)*.

### Table 20: `tech_recommendations`
| Field | Data Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK | Recommendation identifier |
| project_id | uuid | NOT NULL, FK → projects(id) | Associated project |
| created_by | uuid | FK → user_profiles(id) | Author |
| stack_name | text | NOT NULL | Recommended stack name |
| frontend | text | nullable | Recommended frontend technology |
| backend | text | nullable | Recommended backend technology |
| database_name | text | nullable | Recommended database |
| hosting | text | nullable | Recommended hosting/deployment |
| match_score | numeric(5,2) | CHECK 0–100 | Suitability score |
| rationale | text | nullable | Reasoning |
| pros / cons / alternatives | jsonb | default `[]` | Structured lists |
| created_at | timestamptz | default now() | Timestamp |

### Table 21: `notifications`
| Field | Data Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK | Notification identifier |
| user_id | uuid | NOT NULL, FK → user_profiles(id) | Recipient |
| title | text | NOT NULL | Notification title |
| message | text | NOT NULL | Notification body |
| type | text | NOT NULL, default `info` | Type (info / success / warning) |
| entity_type | text | nullable | Related entity type (e.g. `proposal`) |
| entity_id | uuid | nullable | Related entity id |
| read_at | timestamptz | nullable | Read timestamp (null = unread) |
| created_at | timestamptz | default now() | Created timestamp |

*The full schema contains 19 tables, including `clients`, `requirements`, `proposal_versions`, `proposal_reviews`, `timeline_predictions`, `timeline_phases`, `project_repository`, `proposal_templates`, `integrations`, `report_configs`, `user_settings`, and `audit_logs`, all with RLS enabled.*

---

## E. The "Sales" role (add everywhere "Client" appears as a role)

The system implements **four roles**: `engineer`, `project-manager`, `sales`, `admin` (`app_role` enum in `supabase.sql`; the sign-up dropdown in `register.tsx` offers *Software Engineer / Project Manager / Sales Team*; the Security & Audit "Role Permissions Matrix" lists Engineer / Project Manager / Sales / Admin).

**Role permissions (from `src/lib/permissions.ts`):**

| Resource | Engineer | Project Manager | Sales | Admin |
|---|---|---|---|---|
| Dashboard | read | read | read | read |
| Requirements | C R U D | C R U D | C R U | C R U D |
| Proposals | C R U | C R U D | C R U | C R U D |
| Proposal Reviews | – | full + approve | – | full + approve |
| Repository | read | C R U D | read | C R U D |
| Clients | – | C R U D | C R U D | C R U D |
| Reports | – | C R U D | C R U | C R U D |
| Templates | – | C R U D | – | C R U D |
| Integrations | – | – | – | C R U D |
| Security audit | – | – | – | C R U D |
| Settings / Profile | read/update | read/update | read/update | full |

> Replace every "Client" role mention in REQ 1, REQ 8, the Scope, the Role-Based Dashboard section, the Use-Case actors, and the use-case tables with the correct roles. Where the customer is meant, call them a **client (record/external party)**, not a system user.

---

## F. Software Testing (corrected)

> Replaces the Integration-Testing sentence that mentions "the PHP application layer and the Python AI processing components".

**Unit Testing.** Individual functions and components were tested in isolation: requirement-form input validation; the JSON-extraction helper (`extractJsonObject`) that parses LLM responses; the local fallback generators (cost, timeline, technology, proposal); `formatCurrency` (NGN formatting); and the role-permission checks in `permissions.ts`.

**Integration Testing.** Tested the integration points that actually exist:
- **React SPA ↔ Supabase** — authenticated CRUD against PostgreSQL through PostgREST, and verification that **Row-Level Security** correctly allows/denies operations per role.
- **React SPA ↔ NVIDIA LLM API** — request construction, response/JSON parsing, error handling (401/403/404/410/429/503), retry/back-off, and automatic switch to local fallbacks when the API is unavailable.
- **End-to-end workflow** — requirement analysis → proposal generation → cost estimation → timeline prediction → technology recommendation, verifying data flows correctly between modules and is persisted in Supabase.

**Validation Testing.** The assembled system was validated against the functional and non-functional requirements (role-based access, NGN cost output, proposal section generation, audit logging via database triggers), confirming readiness for deployment.

*(There is no PHP and no local Python AI runtime; remove all such references.)*

---

## G. Hardware & Software Requirements (corrected)

**Client-Side (unchanged, still valid):** modern browser (Chrome 90+, Firefox 88+, Edge 90+, Safari 14+); Windows 10+/macOS 11+/Linux Ubuntu 20.04+; 4 GB RAM (8 GB recommended); dual-core 2.0 GHz+; broadband ≥ 2 Mbps; 1280×720+ display.

**Build / Deployment (replaces the Apache/MySQL/PHP/Python/phpMyAdmin server section):**
- **Node.js 18+** — required only to build the SPA (`npm run build` via Vite). No application server runs in production.
- **Static hosting / CDN** (e.g., Netlify, Vercel, Supabase Hosting, or any static web server) to serve the built `dist/` assets over **HTTPS**.
- **Supabase project** — managed **PostgreSQL 15+**, Authentication, and Row-Level Security (no self-managed MySQL/Apache/PHP).
- **Outbound HTTPS** access to the **NVIDIA LLM API** for AI features (a valid `VITE_NVIDIA_API_KEY`).
- **Database administration** via **Supabase Studio** (not phpMyAdmin).
- **No local GPU** is required — model inference runs on NVIDIA's hosted infrastructure.

---

## H. Sequence-Diagram Descriptions (corrected terminology)

> Keep the overall flows; correct the component names so they match the implementation (Supabase Auth instead of a generic "authentication module + user database"; LLM API instead of "NLP/ML engine").

- **Sign Up (Fig 14):** User submits the registration form (name, email, role, organisation details, password) → the SPA calls **Supabase Auth `signUp`** → Supabase creates the auth user and a `user_profiles` row (via the `handle_new_user` trigger) → on success the user is taken to sign-in (email verification by OTP where enabled).
- **Sign In (Fig 15):** User submits email + password → SPA calls **Supabase Auth `signInWithPassword`** → Supabase returns a **JWT session** → the SPA reads the user's `role` from `user_profiles` and routes to the role-based dashboard. (No custom "authentication module/user database"; passwords are verified by Supabase Auth.)
- **Submit Project Requirements (Fig 16):** Engineer/PM/Sales fills the requirement form → SPA validates and stores the project/requirements in Supabase → triggers AI analysis by calling the **LLM API**, which returns a structured JSON analysis (complexity score, categorised requirements); a local fallback is used if the API is unavailable.
- **Generate Proposal (Fig 17):** From a selected analysis, the SPA sends a prompt with project/requirement context to the **LLM API**, which returns proposal section content; the draft and its versions are stored in `proposals`/`proposal_versions`.
- **Cost Estimation (Fig 18):** The SPA sends complexity/scope context to the **LLM API** requesting an **NGN** itemised estimate (JSON); results are computed/normalised client-side and stored in `cost_estimations` + `cost_estimation_items`. Local heuristic fallback on failure.
- **Timeline Prediction (Fig 19):** The SPA requests a phased schedule from the **LLM API** using complexity, team size, and historical context; phases/milestones are stored in `timeline_predictions`/`timeline_phases`.
- **Send Notification (Fig 20):** Notifications are primarily **system-generated** — database triggers (e.g., `notify_proposal_review`) insert rows into `notifications`, which appear on the recipient's in-app bell. (E-mail dispatch and a manual "compose notification" screen are **future work**, not currently implemented; adjust the description accordingly.)

---

*See `corrected_images/` for regenerated screenshots (Figures 24–30) and corrected UML diagrams, and `UML_prompt.md` for the prompts used to (re)generate every diagram.*
