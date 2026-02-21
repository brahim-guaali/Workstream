# Workstream

A visual project tracker that shows how work branches over time. Track parallel workstreams, see when and why they diverged, and maintain context across your team.

## Features

- **Dual Visualization**: Switch between tree and timeline views
- **Stream Management**: Create, branch, and track workstreams
- **Rich Context**: Add notes, change status, and link artifacts
- **Event History**: Full audit trail of stream changes
- **Source Types**: Categorize streams (task, investigation, meeting, blocker, discovery)

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: TailwindCSS
- **Visualization**: D3.js
- **Backend**: Supabase (PostgreSQL + Auth)

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Add your Supabase credentials to .env
# VITE_SUPABASE_URL=your-project-url
# VITE_SUPABASE_ANON_KEY=your-anon-key

# Start development server
npm run dev
```

### Database Setup

1. Create a new Supabase project
2. Run the migration in `supabase/migrations/001_initial_schema.sql`
3. Enable Row Level Security (already included in migration)

## Project Structure

```
src/
├── components/
│   ├── layout/          # Header, Layout
│   ├── project/         # ProjectList, ProjectCard
│   ├── stream/          # StreamDetail, AddStreamModal
│   ├── visualization/   # StreamTree, TimelineView, ViewToggle
│   └── ui/              # Button, Modal, Input, etc.
├── hooks/               # useProjects, useStreams, useVisualization
├── lib/                 # supabase.ts, utils.ts
├── types/               # database.ts
└── pages/               # HomePage, ProjectPage
```

## Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## License

MIT
