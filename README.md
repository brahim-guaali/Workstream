<div align="center">

# Workstream

**A visual project tracker that shows how work branches over time.**

Track parallel workstreams, see when and why they diverged, and maintain context across your team.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Firebase](https://img.shields.io/badge/Firebase-11-ffca28?logo=firebase&logoColor=black)](https://firebase.google.com)
[![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white)](https://vite.dev)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-4-06b6d4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![D3.js](https://img.shields.io/badge/D3.js-7-f9a03c?logo=d3dotjs&logoColor=white)](https://d3js.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

<br />

https://github.com/user-attachments/assets/37d18491-6b29-4698-9c46-078cf517bcaa

</div>

---

## Features

- **Visual Stream Tree** — Interactive D3-powered canvas with drag-and-drop, zoom, and pan
- **Stream Branching** — Create, branch, and track workstreams in a nested hierarchy
- **Rich Context** — Add notes, change status, and link artifacts (PRs, tickets, docs) to any stream
- **Project Metrics** — Track key metrics with change percentages and optional targets
- **Stream Dependencies** — Define and visualize dependencies between streams
- **Source Types** — Categorize streams as task, investigation, meeting, blocker, or discovery
- **AI Insights** — AI-powered analysis with TL;DR, progress, blockers, metrics trends, and recommendations (Gemini 2.5 Flash via Firebase AI Logic)
- **Export** — Export projects as JSON, Markdown, or PDF
- **Import / Export** — Full JSON round-trip with metrics, streams, events, and canvas positions preserved
- **Real-time Collaboration** — Share projects with role-based access (owner, editor, viewer)
- **Google Auth** — Sign in with Google via Firebase Authentication
- **Mobile Responsive** — Fully responsive layout for desktop and mobile

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript 5.9, Vite 7 |
| **Styling** | TailwindCSS 4 |
| **Visualization** | D3.js 7 |
| **AI** | Firebase AI Logic (Gemini 2.5 Flash) |
| **Backend** | Firebase (Firestore + Auth) |
| **Hosting** | Firebase Hosting |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 20+
- A Firebase project with Firestore and Authentication enabled

### Installation

```bash
# Clone the repository
git clone https://github.com/brahim-guaali/Workstream.git
cd Workstream

# Install dependencies
npm install

# Copy the example env file and fill in your Firebase config
cp .env.example .env

# Start development server
npm run dev
```

### Environment Variables

| Variable | Required | Description |
|----------|:--------:|-------------|
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
4. Enable the **Gemini Developer API** (under Build > AI Logic) for AI Insights
5. Copy your Firebase config values into `.env`

## Project Structure

```
src/
├── components/
│   ├── auth/              # Sign-in flow
│   ├── layout/            # Header, Layout shell
│   ├── project/           # Project list, cards, sharing
│   ├── stream/            # Stream detail panel, modals
│   ├── visualization/     # D3 stream tree canvas
│   └── ui/                # Reusable primitives (Button, Modal, Input, etc.)
├── contexts/              # Auth context provider
├── hooks/                 # Custom hooks (projects, streams, events, AI insights)
├── lib/                   # Firebase init, utilities, export logic
├── types/                 # TypeScript type definitions
└── pages/                 # HomePage, ProjectPage
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |

## Deployment

```bash
npm run build
firebase deploy --only hosting --project your-project-id
```

## Contributing

Contributions are welcome! Please read the [Contributing Guide](CONTRIBUTING.md) before submitting a pull request.

## License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">
  <sub>Built with React, D3.js, Firebase, and a lot of coffee.</sub>
</div>
