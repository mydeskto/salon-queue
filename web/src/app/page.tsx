import { redirect } from 'next/navigation';

// Every screen starts at sign-in — there is no shared landing page. Role
// decides the destination after login (see lib/auth.tsx homeFor).
export default function RootPage() {
  redirect('/login');
}
