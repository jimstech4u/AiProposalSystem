# UML Diagram Prompts & Corrected Sources

Prompts to (re)generate **every** UML diagram in the thesis so each one matches the implemented system. Each section has:
1. a **natural-language prompt** (paste into an AI/diagram generator), and
2. ready-to-render **PlantUML source**.

Ground truth used: roles = **engineer, project-manager, sales, admin** (no "Client" login); AI = **NVIDIA LLM API** (`meta/llama-3.3-70b-instruct`) with local fallbacks; database = **Supabase PostgreSQL** (uuid keys, enums, RLS); currency = **NGN (₦)**.

Render any block with:
```
java -jar plantuml.jar -tpng diagram.puml      # PNG
java -jar plantuml.jar -tsvg diagram.puml      # SVG (sharper for print)
```
The three **corrected** diagrams (Use Case, Class, ER) are rendered into `thesis/corrected_images/`.

---

## 1. Use Case Diagram (Figure 7) — **WRONG → regenerated**

**What was wrong:** actors were `Client / Software Engineer / System Administrator`. There is **no Client login role**, and **Project Manager and Sales were missing**.

**Prompt:**
> Create a UML use-case diagram for the "AI-Powered Technical Proposal & Cost Estimation System". Use exactly four human actors — **Software Engineer, Project Manager, Sales, System Administrator** — plus a system actor **AI Engine (NVIDIA LLM API)**. Do NOT include a "Client" actor (clients are data records, not users). Place all use cases inside a system boundary: Register/Login; Submit & Analyze Requirements; Generate Proposal; Estimate Cost (NGN); Predict Timeline; Recommend Technologies; Review/Approve Proposal; Manage Clients; Manage Project Repository; Generate Reports & Analytics; Manage Templates; Manage Integrations; Perform Security Audit; Manage Users & Roles. Connect actors by their real permissions: all four authenticate; Engineer/PM/Sales submit requirements & generate proposals; Engineer runs cost/timeline/technology; PM & Admin review proposals, manage repository & templates; PM/Sales manage clients & reports; Admin manages integrations, security audit, and users. The AI Engine performs the analysis/generation/estimation/recommendation use cases.

```plantuml
@startuml
left to right direction
skinparam packageStyle rectangle
skinparam actorStyle awesome
title Use Case Diagram - AI-Powered Technical Proposal & Cost Estimation System

actor "Software Engineer" as ENG
actor "Project Manager" as PM
actor "Sales" as SALES
actor "System Administrator" as ADMIN
actor "AI Engine\n(NVIDIA LLM API)" as AI

rectangle "AI-Powered Technical Proposal & Cost Estimation System" {
  usecase "Register / Login" as UC_AUTH
  usecase "Submit & Analyze Requirements" as UC_REQ
  usecase "Generate Proposal" as UC_PROP
  usecase "Estimate Cost (NGN)" as UC_COST
  usecase "Predict Timeline" as UC_TIME
  usecase "Recommend Technologies" as UC_TECH
  usecase "Review / Approve Proposal" as UC_REVIEW
  usecase "Manage Clients" as UC_CLIENT
  usecase "Manage Project Repository" as UC_REPO
  usecase "Generate Reports & Analytics" as UC_REPORT
  usecase "Manage Templates" as UC_TPL
  usecase "Manage Integrations" as UC_INT
  usecase "Perform Security Audit" as UC_SEC
  usecase "Manage Users & Roles" as UC_USER
}

ENG --> UC_AUTH
PM --> UC_AUTH
SALES --> UC_AUTH
ADMIN --> UC_AUTH

ENG --> UC_REQ
PM --> UC_REQ
SALES --> UC_REQ
ENG --> UC_PROP
PM --> UC_PROP
SALES --> UC_PROP
ENG --> UC_COST
ENG --> UC_TIME
ENG --> UC_TECH

PM --> UC_REVIEW
ADMIN --> UC_REVIEW
PM --> UC_REPO
ADMIN --> UC_REPO
PM --> UC_CLIENT
SALES --> UC_CLIENT
PM --> UC_REPORT
SALES --> UC_REPORT
ADMIN --> UC_REPORT
PM --> UC_TPL
ADMIN --> UC_TPL
ADMIN --> UC_INT
ADMIN --> UC_SEC
ADMIN --> UC_USER

UC_REQ --> AI
UC_PROP --> AI
UC_COST --> AI
UC_TIME --> AI
UC_TECH --> AI
@enduml
```

---

## 2. Class Diagram (Figure 13) — **regenerated (accurate attributes)**

**What was off:** attributes typed as `Integer` (real PKs are `uuid`); included a `Client` entity that is fine, but field names drifted.

**Prompt:**
> Create a UML class diagram for the system's domain model. Use these classes with `uuid` identifiers and the real attributes: UserProfile(id, full_name, email, role:app_role, is_active), Client(id, company_name, contact_email, industry), Project(id, title, project_type, status:project_status, complexity_score), Requirement(id, category, priority, description), Proposal(id, title, status:proposal_status, version, generated_content:jsonb), CostEstimation(id, currency=NGN, total_cost, confidence_score), TimelinePrediction(id, duration_weeks, risk_level), TechRecommendation(id, stack_name, match_score), Notification(id, title, message, read_at). Relationships: a Client owns many Projects; a UserProfile submits many Projects and receives many Notifications; a Project has many Requirements, Proposals, CostEstimations, TimelinePredictions, and TechRecommendations.

```plantuml
@startuml
skinparam classAttributeIconSize 0
title Class Diagram - AI-Powered Technical Proposal & Cost Estimation System

class UserProfile {
  +id : uuid
  +full_name : string
  +email : string
  +role : app_role
  +is_active : boolean
  +login()
  +updateProfile()
}
class Client {
  +id : uuid
  +company_name : string
  +contact_email : string
  +industry : string
}
class Project {
  +id : uuid
  +title : string
  +project_type : string
  +status : project_status
  +complexity_score : numeric
}
class Requirement {
  +id : uuid
  +category : string
  +priority : string
  +description : text
}
class Proposal {
  +id : uuid
  +title : string
  +status : proposal_status
  +version : int
  +generated_content : jsonb
  +generate()
}
class CostEstimation {
  +id : uuid
  +currency : string = "NGN"
  +total_cost : numeric
  +confidence_score : numeric
  +calculate()
}
class TimelinePrediction {
  +id : uuid
  +duration_weeks : int
  +risk_level : string
  +predict()
}
class TechRecommendation {
  +id : uuid
  +stack_name : string
  +match_score : numeric
  +recommend()
}
class Notification {
  +id : uuid
  +title : string
  +message : string
  +read_at : timestamptz
}

Client "1" --> "0..*" Project : owns
UserProfile "1" --> "0..*" Project : submits
UserProfile "1" --> "0..*" Notification : receives
Project "1" --> "0..*" Requirement
Project "1" --> "0..*" Proposal
Project "1" --> "0..*" CostEstimation
Project "1" --> "0..*" TimelinePrediction
Project "1" --> "0..*" TechRecommendation
@enduml
```

---

## 3. Database / ER Diagram (Figure 22) — **regenerated (PostgreSQL)**

**What was off:** `client_name`→`company_name`, `generated_by`→`created_by`, "Users"→`user_profiles`; types should be PostgreSQL.

**Prompt:**
> Create an entity-relationship diagram for the Supabase PostgreSQL schema. Show tables `user_profiles`, `clients`, `projects`, `requirements`, `proposals`, `cost_estimations`, `cost_estimation_items`, `timeline_predictions`, `tech_recommendations`, `notifications` with `uuid` primary keys and the correct foreign keys (projects→clients & user_profiles; requirements/proposals/cost_estimations/timeline_predictions/tech_recommendations→projects; cost_estimation_items→cost_estimations; notifications→user_profiles). Use crow's-foot one-to-many notation.

```plantuml
@startuml
hide circle
skinparam linetype ortho
title Database Schema (PostgreSQL / Supabase) - AI Proposal System

entity user_profiles {
  *id : uuid <<PK>>
  --
  full_name : text
  email : text
  role : app_role
  is_active : boolean
}
entity clients {
  *id : uuid <<PK>>
  --
  company_name : text
  contact_email : text
  industry : text
}
entity projects {
  *id : uuid <<PK>>
  --
  client_id : uuid <<FK>>
  submitted_by : uuid <<FK>>
  title : text
  project_type : text
  status : project_status
  complexity_score : numeric
}
entity requirements {
  *id : uuid <<PK>>
  --
  project_id : uuid <<FK>>
  category : text
  priority : text
}
entity proposals {
  *id : uuid <<PK>>
  --
  project_id : uuid <<FK>>
  created_by : uuid <<FK>>
  status : proposal_status
  version : int
  generated_content : jsonb
}
entity cost_estimations {
  *id : uuid <<PK>>
  --
  project_id : uuid <<FK>>
  currency : text = "NGN"
  total_cost : numeric
  confidence_score : numeric
}
entity cost_estimation_items {
  *id : uuid <<PK>>
  --
  estimation_id : uuid <<FK>>
  module_name : text
  hours : numeric
  hourly_rate : numeric
  amount : numeric
}
entity timeline_predictions {
  *id : uuid <<PK>>
  --
  project_id : uuid <<FK>>
  duration_weeks : int
  risk_level : text
}
entity tech_recommendations {
  *id : uuid <<PK>>
  --
  project_id : uuid <<FK>>
  stack_name : text
  match_score : numeric
}
entity notifications {
  *id : uuid <<PK>>
  --
  user_id : uuid <<FK>>
  title : text
  read_at : timestamptz
}

clients ||--o{ projects
user_profiles ||--o{ projects
projects ||--o{ requirements
projects ||--o{ proposals
projects ||--o{ cost_estimations
projects ||--o{ timeline_predictions
projects ||--o{ tech_recommendations
cost_estimations ||--o{ cost_estimation_items
user_profiles ||--o{ notifications
@enduml
```

---

## 4. System Architecture (Figure 23) — already correct; prompt for reference

**Prompt:**
> Create a layered architecture diagram. Box 1 (Users): Engineer, PM, Sales, Admin. Box 2 (Presentation): React 18 + TypeScript SPA — Vite, Tailwind CSS, Radix UI, MUI. Box 3 (Application Modules): Requirements, Proposals, Cost, Timeline, Technology, Reports. Box 4 (AI-Assisted Logic Layer): NVIDIA LLM API for analysis, generation, estimation, recommendation (with local fallbacks). Box 5 (Data/Auth): Supabase Auth + RBAC/RLS, PostgreSQL. Box 6 (External, future): CRM, Email, Calendar, PM tools. Arrows: Users→Presentation & Application; Presentation→Supabase Auth; Application→PostgreSQL; Application→AI Layer; AI/Application→External Services.

```plantuml
@startuml
skinparam componentStyle rectangle
title System Architecture - AI-Powered Technical Proposal & Cost Estimation System

actor "Users\n(Engineer, PM, Sales, Admin)" as U
package "Presentation Layer" {
  [React 18 + TypeScript SPA\n(Vite, Tailwind, Radix UI, MUI)] as SPA
}
package "Application & AI Logic" {
  [Application Modules\n(Requirements, Proposals, Cost,\nTimeline, Technology, Reports)] as APP
  [AI-Assisted Logic\n(NVIDIA LLM API + local fallbacks)] as AI
}
package "Data & Authentication (Supabase)" {
  [Supabase Auth + RBAC / RLS] as AUTH
  database "PostgreSQL\n(Projects & History)" as DB
}
[External Services\n(CRM, Email, Calendar, PM tools)] as EXT

U --> SPA
SPA --> APP
SPA --> AUTH
APP --> AI
APP --> DB
AUTH --> DB
AI --> EXT
@enduml
```

---

## 5. Activity Diagram (Figure 21) — prompt

**Prompt:**
> Create a UML activity diagram for the end-to-end proposal workflow with swimlanes for **User (Engineer/PM/Sales)**, **System (Supabase)**, and **AI Engine (LLM)**. Flow: Login → Submit project requirements → System stores & requests AI analysis → AI returns complexity/categorised requirements → User reviews → Generate proposal (AI) → Estimate cost in NGN (AI) → Predict timeline (AI) → Recommend technologies (AI) → User edits/approves → Submit for review → PM/Admin approves → store version & notify. Include a decision node "API available?" branching to a deterministic local fallback when the LLM is unavailable.

```plantuml
@startuml
title Activity Diagram - Proposal & Estimation Workflow
|User (Engineer/PM/Sales)|
start
:Login (Supabase Auth);
:Submit project requirements;
|System (Supabase)|
:Validate & store project/requirements;
if (LLM API available?) then (yes)
  |AI Engine (NVIDIA LLM)|
  :Analyze requirements\n(complexity, categories);
else (no)
  |System (Supabase)|
  :Use deterministic local fallback;
endif
|User (Engineer/PM/Sales)|
:Review analysis;
|AI Engine (NVIDIA LLM)|
:Generate proposal sections;
:Estimate cost (NGN);
:Predict timeline;
:Recommend technologies;
|User (Engineer/PM/Sales)|
:Edit & submit for review;
|System (Supabase)|
:Store proposal version;
if (PM/Admin approves?) then (yes)
  :Mark approved & notify (trigger);
  stop
else (no)
  :Request revision & notify;
  stop
endif
@enduml
```

---

## 6. Sequence Diagrams (Figures 14–20) — prompts + example

**General rule:** participants are **User → SPA (React) → Supabase Auth/PostgREST → PostgreSQL** and, for AI steps, **→ NVIDIA LLM API** (with a local-fallback alt). Do **not** use a generic "authentication module + user database" or an "NLP/ML engine".

**Prompts (one per diagram):**
- **Sign Up:** User → SPA → Supabase Auth `signUp` → creates auth user + `user_profiles` (trigger) → success/redirect; alt: validation error.
- **Sign In:** User → SPA → Supabase Auth `signInWithPassword` → returns JWT → SPA reads `role` from `user_profiles` → routes to role dashboard; alt: invalid credentials.
- **Submit & Analyze Requirements:** User → SPA → store project/requirements in PostgreSQL → SPA → NVIDIA LLM API (analyze) → JSON analysis → store/show; alt: API down → local fallback.
- **Generate Proposal:** User selects analysis → SPA → NVIDIA LLM API (generate sections) → store in `proposals`/`proposal_versions` → display.
- **Cost Estimation:** User → SPA → NVIDIA LLM API (NGN estimate) → compute/normalise → store `cost_estimations` + items.
- **Timeline Prediction:** User → SPA → NVIDIA LLM API (phased schedule) → store `timeline_predictions`/`timeline_phases`.
- **Send Notification:** system event → database trigger inserts into `notifications` → recipient sees in-app bell (email = future work).

**Example (Sign In) PlantUML:**
```plantuml
@startuml
title Sign In Sequence Diagram
actor User
participant "SPA (React)" as SPA
participant "Supabase Auth" as AUTH
database "PostgreSQL\n(user_profiles)" as DB

User -> SPA : enter email & password
SPA -> AUTH : signInWithPassword(email, password)
AUTH -> DB : verify credentials (auth.users)
alt valid credentials
  AUTH --> SPA : JWT session
  SPA -> DB : select role from user_profiles
  DB --> SPA : role
  SPA --> User : redirect to role-based dashboard
else invalid
  AUTH --> SPA : 400 error
  SPA --> User : show "Sign in failed"
end
@enduml
```

---

## Rendering notes
- These were rendered with PlantUML (`java -jar plantuml.jar`). If a layout-dependent diagram (use case / class / activity) fails because **Graphviz** is not installed, add `!pragma layout smetana` just after `@startuml` to use PlantUML's built-in layout engine.
- For print quality, render SVG (`-tsvg`) and place the SVG/scaled-PNG in the thesis.
