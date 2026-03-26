'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export type AuthRole = 'customer' | 'technician' | 'supplier' | 'admin';

export type Session = {
  email: string;
  name: string;
  role: AuthRole;
  loggedIn: boolean;
  loginTime: number;
  aurotapId?: string;
};

export function safeParseJSON<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function useAuth() {
  const router = useRouter();
  const [session, setSession] = React.useState<Session | null>(null);
  const [checked, setChecked] = React.useState(false);

  React.useEffect(() => {
    // Only run on the client
    if (typeof window !== 'undefined') {
      const parsed = safeParseJSON<Session>(localStorage.getItem('aurowater_session'));
      if (parsed?.loggedIn) setSession(parsed);
    }
    setChecked(true);
  }, []);

  const logout = () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('aurowater_session');
      }
    } catch {
      // ignore
    }
    toast.success('Signed out. See you soon!');
    router.push('/');
  };

  return {
    user: session?.name ? session.name : null,
    role: (session?.role ?? null) as AuthRole | null,
    isLoggedIn: !!session?.loggedIn,
    loginTime: session?.loginTime ?? null,
    aurotapId: session?.aurotapId,
    checked,
    logout,
  };
}



// 'use client';

// import React from 'react';
// import { useRouter } from 'next/navigation';
// import { toast } from 'sonner';

// export type AuthRole = 'customer' | 'technician' | 'supplier' | 'admin';

// export type Session = {
//   email: string;
//   name: string;
//   role: AuthRole;
//   loggedIn: boolean;
//   loginTime: number;
//   aurotapId?: string;
// };

// export function safeParseJSON<T>(raw: string | null): T | null {
//   if (!raw) return null;
//   try {
//     return JSON.parse(raw) as T;
//   } catch {
//     return null;
//   }
// }

// export function useAuth() {
//   const router = useRouter();
//   const [session, setSession] = React.useState<Session | null>(null);
//   const [checked, setChecked] = React.useState(false);

//   React.useEffect(() => {
//     const parsed = safeParseJSON<Session>(localStorage.getItem('aurowater_session'));
//     if (parsed?.loggedIn) setSession(parsed);
//     setChecked(true);
//   }, []);

//   const logout = () => {
//     try {
//       localStorage.removeItem('aurowater_session');
//     } catch {
//       // ignore
//     }
//     toast.success('Signed out. See you soon!');
//     router.push('/');
//   };

//   return {
//     user: session?.name ? session.name : null,
//     role: (session?.role ?? null) as AuthRole | null,
//     isLoggedIn: !!session?.loggedIn,
//     loginTime: session?.loginTime ?? null,
//     aurotapId: session?.aurotapId,
//     checked,
//     logout,
//   };
// }

