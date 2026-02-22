# Workstream

A visual project tracker that shows how work branches over time. Track parallel workstreams, see when and why they diverged, and maintain context across your team.

## Features

- **Visual Stream Tree**: Interactive canvas with drag-and-drop, zoom, and pan navigation
- **Stream Management**: Create, branch, and track workstreams in a nested hierarchy
- **Rich Context**: Add notes, change status, and link artifacts to any stream
- **Project Metrics**: Track key metrics with change percentages and optional targets
- **Stream Dependencies**: Define dependencies between streams
- **Source Types**: Categorize streams as task, investigation, meeting, blocker, or discovery
- **Export Formats**: Export projects as JSON (data backup), Markdown (readable document), or PDF (print)
- **Import / Export**: Full JSON import/export with metrics, streams, events, and positions preserved
- **Google Auth**: Sign in with Google via Firebase Authentication

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: TailwindCSS 4
- **Visualization**: D3.js
- **Backend**: Firebase (Firestore + Auth)
- **Hosting**: Firebase Hosting

## Getting Started

### Prerequisites

- Node.js 20+
- A Firebase project with Firestore and Authentication enabled

### Installation

```bash
# Install dependencies
npm install

# Create .env with your Firebase config
cat > .env << 'EOF'
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
VITE_LOGO_URL=/your-logo.svg
EOF

# Start development server
npm run dev
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_FIREBASE_API_KEY` | Yes | Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Yes | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Yes | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Yes | Firebase app ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | No | Google Analytics measurement ID |
| `VITE_LOGO_URL` | No | Logo image URL shown on the sign-in page |

### Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Firestore Database**
3. Enable **Authentication** with Google sign-in provider
4. Copy your Firebase config values into `.env`

## Project Structure

```
src/
├── components/
│   ├── auth/              # SignIn
│   ├── layout/            # Header, Layout
│   ├── project/           # ProjectList, ProjectCard
│   ├── stream/            # StreamDetail, AddStreamModal
│   ├── visualization/     # StreamTree (D3 canvas)
│   └── ui/                # Button, Modal, Input, Textarea
├── contexts/              # AuthContext
├── hooks/                 # useProjects, useStreams, useEvents
├── lib/                   # firebase.ts, utils.ts, exportDocument.ts
├── types/                 # database.ts
└── pages/                 # HomePage, ProjectPage
```

## Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Type-check and build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## Deployment

```bash
npm run build
firebase deploy --only hosting --project your-project-id
```

## License

MIT
