import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export interface RegisteredUser {
  uid: string;
  email: string;
  displayName: string;
}

export function useRegisteredUsers(excludeEmails: string[]) {
  const { user } = useAuth();
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, 'user_emails'),
      (snapshot) => {
        const excludeSet = new Set(
          excludeEmails.map((e) => e.toLowerCase())
        );
        if (user.email) {
          excludeSet.add(user.email.toLowerCase());
        }

        const result: RegisteredUser[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.email && !excludeSet.has(data.email.toLowerCase())) {
            result.push({
              uid: data.uid,
              email: data.email,
              displayName: data.displayName || '',
            });
          }
        });

        setUsers(result);
        setLoading(false);
      },
      () => {
        setUsers([]);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user, excludeEmails]);

  return { users, loading };
}
