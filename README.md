# ProposalAI - AI-Powered Technical Proposal System

A comprehensive web application for software development firms to automate technical proposal generation, cost estimation, and project timeline prediction using AI.

## Features

### 🎯 Core Modules

1. **Authentication & User Management**
   - Multi-role support (Engineer, Project Manager, Sales, Admin)
   - Secure login/registration with email verification
   - Profile management and role-based access control

2. **Role-Specific Dashboards**
   - Engineer Dashboard: Focus on technical tasks and proposals
   - Project Manager Dashboard: Team performance and resource allocation
   - Sales Dashboard: Win/loss analysis and revenue tracking
   - Admin Dashboard: System health and user management

3. **AI-Powered Requirement Analysis**
   - Structured requirement capture
   - Automatic categorization and prioritization
   - Complexity assessment with confidence scores
   - Gap detection and recommendations

4. **AI Proposal Generation**
   - Template-based proposal creation
   - Automatic content generation for all sections
   - Customizable tone and detail levels
   - Real-time editing with AI assistance
   - Version control and collaboration

5. **Cost Estimation**
   - Module-wise cost breakdown
   - Resource allocation and hourly rates
   - AI-powered estimation with confidence scores
   - Historical comparison and scenario planning
   - Infrastructure and third-party costs

6. **Timeline Prediction**
   - Phase-based project timeline
   - Milestone planning and tracking
   - Critical path analysis
   - Team size recommendations
   - Gantt chart visualization

7. **Technology Stack Recommendation**
   - AI-powered stack selection
   - Comparison matrix for alternatives
   - Pros/cons analysis
   - Match scoring with project requirements
   - Industry best practices

8. **Project Repository**
   - Historical project database
   - Actual vs. estimated comparison
   - Lessons learned tracking
   - Accuracy analytics
   - Similar project finder

9. **Client Management**
   - Client directory and profiles
   - Project and proposal history
   - Communication tracking
   - Relationship analytics
   - Revenue and engagement metrics

10. **Reports & Analytics**
    - Comprehensive KPI dashboards
    - Proposal volume and win rate trends
    - Estimation accuracy tracking
    - Custom report generation
    - Export capabilities

## Technology Stack

- **Frontend:** React 18 with TypeScript
- **Routing:** React Router DOM v7
- **Styling:** Tailwind CSS v4
- **UI Components:** Radix UI primitives
- **Charts:** Recharts
- **Icons:** Lucide React
- **Animations:** Motion (formerly Framer Motion)
- **Notifications:** Sonner
- **Build Tool:** Vite

## Key Design Features

### AI-Powered Indicators
- Purple gradient badges and buttons for AI features
- Confidence scores displayed with sparkle icons
- Clear visual distinction between manual and AI-generated content
- Real-time AI processing animations

### Professional B2B Design
- Clean, modern interface with consistent color scheme
- Blue as primary brand color (trust and professionalism)
- Purple accents for AI features (innovation)
- Clear information hierarchy
- Responsive layout (desktop-focused)

### User Experience
- Role-based navigation and features
- Quick actions on all dashboards
- Search and filter capabilities
- Empty states with clear CTAs
- Loading states and progress indicators
- Toast notifications for user feedback

## Project Structure

```
/src
├── app/
│   ├── components/
│   │   └── ui/          # Reusable UI components
│   ├── layouts/
│   │   └── dashboard-layout.tsx
│   ├── pages/
│   │   ├── auth/        # Authentication pages
│   │   ├── dashboards/  # Role-specific dashboards
│   │   ├── requirements/# Requirement analysis
│   │   ├── proposals/   # Proposal management
│   │   ├── estimation/  # Cost estimation
│   │   ├── timeline/    # Timeline prediction
│   │   ├── technology/  # Tech recommendations
│   │   ├── repository/  # Project repository
│   │   ├── clients/     # Client management
│   │   └── reports/     # Analytics & reports
│   └── App.tsx          # Main application with routing
├── lib/
│   └── utils.ts         # Utility functions
└── styles/              # Global styles

```

## Component Architecture

### Reusable UI Components
- Button (with variants: primary, secondary, success, danger, ai, ghost, outline)
- Input (text, email, password, etc.)
- Card (with header, content, footer)
- Badge (status indicators)
- All styled with Tailwind CSS for consistency

### Layout Components
- DashboardLayout: Main layout with sidebar navigation and top bar
- Collapsible sidebar with icons and labels
- User profile dropdown
- Global search
- Notification bell

## Data Visualization

Uses Recharts for all charts and graphs:
- Line charts (trends over time)
- Bar charts (comparisons)
- Pie charts (distributions)
- Radar charts (complexity analysis)
- Area charts (cumulative data)

## Responsive Design

- **Desktop (1280px+):** Full sidebar, multi-column layouts
- **Tablet (768px-1279px):** Collapsed sidebar, adapted layouts
- **Mobile (<768px):** Stacked layouts, touch-friendly controls

## Accessibility

- Keyboard navigation support
- ARIA labels on interactive elements
- Focus states on all controls
- Color contrast compliance
- Alt text for icons and images

## Future Enhancements

Potential future enhancements:
- WebSocket for real-time collaboration
- Advanced Gantt chart interactions
- File upload and management
- Email integration
- Calendar synchronization
- Advanced security features
- Multi-language support
- Dark mode toggle
- Mobile applications

## Development Notes

The application uses Supabase-backed operational records and Gemini-assisted generation.

The application includes:
- Complex state management
- Multi-page routing
- Role-based access
- Data visualization
- Modern React patterns
- Professional UI/UX design
- Responsive layouts
- Accessibility considerations

## License

This project is intended for academic evaluation and controlled organizational testing.
