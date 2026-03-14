import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';

const useAdmin = (user: User | null) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (user) {
      user.getIdTokenResult()
        .then((result) => { if (!cancelled) setIsAdmin(!!result.claims.admin); })
        .catch(() => { if (!cancelled) setIsAdmin(false); })
        .finally(() => { if (!cancelled) setLoading(false); });
    } else {
      setIsAdmin(false);
      setLoading(false);
    }

    return () => { cancelled = true; };
  }, [user]);

  return { isAdmin, loading };
};

export default useAdmin;
