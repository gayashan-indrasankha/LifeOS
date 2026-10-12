import { requireUser } from '@/lib/auth/session';
import { headers } from 'next/headers';
import { getUserSettings } from '@/lib/dal/user-settings';
import { AppSidebar, MobileNav } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { CloudRefresh } from '@/components/providers/cloud-refresh';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const settings = await getUserSettings(user.id);
  const isAndroidApp = (await headers()).get('user-agent')?.includes('LifeOSAndroid/1');

  return (
    <div className={`${isAndroidApp ? 'lifeos-android ' : ''}flex min-h-screen bg-background`}>
      <CloudRefresh />
      <AppSidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <AppHeader user={user} settings={settings} />
        <MobileNav />
        <main className="min-w-0 flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
