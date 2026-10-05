import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Admin Control Center | AuroWater',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminIndexPage() {
  redirect('/admin/dashboard');
}
