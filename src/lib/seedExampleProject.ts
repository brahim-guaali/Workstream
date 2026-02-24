import type { User } from 'firebase/auth';
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

type StreamStatus = 'backlog' | 'active' | 'blocked' | 'done';
type SourceType = 'task' | 'investigation' | 'meeting' | 'blocker' | 'discovery';

interface SeedStream {
  title: string;
  description: string | null;
  status: StreamStatus;
  sourceType: SourceType;
  dependencies: string[];
  dueDate: Date | null;
  note: string | null;
  children: SeedStream[];
}

function buildStreamTree(firstName: string): SeedStream[] {
  const now = new Date();
  const daysFromNow = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return d;
  };

  return [
    {
      title: `${firstName}'s Weekend Hackathon`,
      description: null,
      status: 'active',
      sourceType: 'task',
      dependencies: [],
      dueDate: null,
      note: `Welcome ${firstName}! This is your example project. Explore the cards, check notes, and see how everything connects.`,
      children: [
        {
          title: 'Brainstorm app ideas',
          description: null,
          status: 'done',
          sourceType: 'investigation',
          dependencies: [],
          dueDate: null,
          note: null,
          children: [
            {
              title: 'Research trending APIs',
              description: null,
              status: 'active',
              sourceType: 'investigation',
              dependencies: [],
              dueDate: null,
              note: `${firstName} found some interesting options — OpenAI, Stripe, and Maps`,
              children: [
                {
                  title: 'Waiting on API key approval',
                  description: null,
                  status: 'blocked',
                  sourceType: 'blocker',
                  dependencies: [firstName],
                  dueDate: null,
                  note: `${firstName}, check your email for the API key confirmation`,
                  children: [],
                },
                {
                  title: 'Prototype with Maps API',
                  description: null,
                  status: 'active',
                  sourceType: 'discovery',
                  dependencies: [],
                  dueDate: daysFromNow(4),
                  note: `${firstName} discovered the free tier is perfect for a weekend project`,
                  children: [],
                },
              ],
            },
            {
              title: 'Pick the tech stack',
              description: null,
              status: 'done',
              sourceType: 'meeting',
              dependencies: [],
              dueDate: null,
              note: `${firstName} decided: React + Firebase — great choice!`,
              children: [
                {
                  title: 'Learn React basics',
                  description: null,
                  status: 'done',
                  sourceType: 'task',
                  dependencies: [],
                  dueDate: null,
                  note: `${firstName} finished the tutorial in one evening`,
                  children: [],
                },
                {
                  title: 'Set up Firebase project',
                  description: null,
                  status: 'done',
                  sourceType: 'task',
                  dependencies: [],
                  dueDate: null,
                  note: null,
                  children: [],
                },
              ],
            },
            {
              title: 'Write project README',
              description: null,
              status: 'backlog',
              sourceType: 'task',
              dependencies: [],
              dueDate: null,
              note: null,
              children: [],
            },
          ],
        },
        {
          title: 'Build the app',
          description: null,
          status: 'active',
          sourceType: 'task',
          dependencies: [],
          dueDate: null,
          note: null,
          children: [
            {
              title: 'Design the UI mockups',
              description: null,
              status: 'active',
              sourceType: 'discovery',
              dependencies: [`${firstName}'s sketches`],
              dueDate: daysFromNow(5),
              note: null,
              children: [],
            },
            {
              title: 'Set up the project repo',
              description: null,
              status: 'done',
              sourceType: 'task',
              dependencies: [],
              dueDate: null,
              note: `Repo created! ${firstName} is ready to code`,
              children: [],
            },
            {
              title: 'Implement auth flow',
              description: null,
              status: 'active',
              sourceType: 'task',
              dependencies: ['Design Team'],
              dueDate: daysFromNow(3),
              note: null,
              children: [],
            },
            {
              title: 'Add dark mode',
              description: null,
              status: 'backlog',
              sourceType: 'discovery',
              dependencies: [],
              dueDate: null,
              note: null,
              children: [],
            },
          ],
        },
        {
          title: 'Launch prep',
          description: null,
          status: 'backlog',
          sourceType: 'task',
          dependencies: [],
          dueDate: null,
          note: null,
          children: [
            {
              title: 'Write launch tweet',
              description: null,
              status: 'backlog',
              sourceType: 'task',
              dependencies: [],
              dueDate: null,
              note: `Draft: '${firstName} just shipped something cool'`,
              children: [],
            },
            {
              title: 'Deploy to production',
              description: null,
              status: 'backlog',
              sourceType: 'task',
              dependencies: ['Build the app'],
              dueDate: null,
              note: null,
              children: [],
            },
          ],
        },
      ],
    },
  ];
}

async function createStreamRecursive(
  uid: string,
  projectId: string,
  parentStreamId: string | null,
  stream: SeedStream,
): Promise<void> {
  const streamsRef = collection(db, 'users', uid, 'projects', projectId, 'streams');

  const docRef = await addDoc(streamsRef, {
    title: stream.title,
    description: stream.description,
    status: stream.status,
    sourceType: stream.sourceType,
    parentStreamId: parentStreamId,
    branchedFromEventId: null,
    dependencies: stream.dependencies,
    dueDate: stream.dueDate ? Timestamp.fromDate(stream.dueDate) : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (stream.note) {
    const eventsRef = collection(
      db, 'users', uid, 'projects', projectId, 'streams', docRef.id, 'events',
    );
    await addDoc(eventsRef, {
      type: 'note',
      content: stream.note,
      metadata: null,
      createdAt: serverTimestamp(),
    });
  }

  for (const child of stream.children) {
    await createStreamRecursive(uid, projectId, docRef.id, child);
  }
}

export async function seedExampleProject(user: User): Promise<void> {
  const uid = user.uid;

  // Idempotent: skip if user already has any projects
  const projectsRef = collection(db, 'users', uid, 'projects');
  const existingProjects = await getDocs(projectsRef);
  if (!existingProjects.empty) return;

  const firstName = user.displayName?.split(' ')[0] || 'Friend';

  // Create the project
  const projectDoc = await addDoc(projectsRef, {
    name: `Weekend App Hackathon for ${firstName}`,
    description: `${firstName}'s weekend project — from idea to launch in 48 hours!`,
    metrics: [
      {
        id: crypto.randomUUID(),
        name: 'Features Built',
        value: 3,
        initialValue: 0,
        target: 8,
      },
      {
        id: crypto.randomUUID(),
        name: 'Bugs Squashed',
        value: 5,
        initialValue: 0,
        target: 12,
      },
      {
        id: crypto.randomUUID(),
        name: 'Coffees Consumed',
        value: 7,
        initialValue: 0,
        target: 10,
      },
    ],
    sharedWith: [],
    sharedWithUids: [],
    sharedWithEditorUids: [],
    ownerEmail: user.email || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Create all streams recursively
  const tree = buildStreamTree(firstName);
  for (const rootStream of tree) {
    await createStreamRecursive(uid, projectDoc.id, null, rootStream);
  }

}
