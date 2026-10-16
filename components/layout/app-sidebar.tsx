'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ListChecks,
  NotebookPen,
  Settings,
  CalendarDays,
  Target,
  ClipboardCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { BrandLogo } from '@/components/layout/brand-logo';

const navigation = [
  { name: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Today', href: '/today', icon: LayoutDashboard },
  { name: 'Week', href: '/week', icon: CalendarDays },
  { name: 'Habits', href: '/habits', icon: ListChecks },
  { name: 'Goals & Projects', href: '/goals', icon: Target },
  { name: 'Monthly insights', href: '/review', icon: ClipboardCheck },
  { name: 'Journal', href: '/notes', icon: NotebookPen },
  { name: 'Settings', href: '/settings', icon: Settings },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!window.matchMedia('(max-width: 1023px)').matches) return;
    // Warm off-screen destinations gradually after the current page settles.
    // Checklist item forms are created only when opened, keeping these payloads small.
    const timers = ['/goals', '/review', '/notes', '/settings'].map((href, index) =>
      window.setTimeout(
        () => {
          if (!document.hidden && navigator.onLine) router.prefetch(href);
        },
        1000 + index * 400,
      ),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [router]);

  useEffect(() => {
    if (!window.matchMedia('(max-width: 1023px)').matches) return;
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active) return;
    const navRect = nav.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    if (activeRect.left >= navRect.left && activeRect.right <= navRect.right) return;
    nav.scrollTo({
      left:
        nav.scrollLeft + activeRect.left - navRect.left - (navRect.width - activeRect.width) / 2,
    });
  }, [pathname]);

  return (
    <nav
      ref={navRef}
      aria-label="Mobile navigation"
      className="mobile-nav-scroll sticky top-16 z-30 flex w-full min-w-0 max-w-full gap-1 overflow-x-auto overscroll-x-contain whitespace-nowrap border-b bg-card p-2 lg:hidden"
    >
      {navigation.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          prefetch={true}
          onMouseEnter={() => router.prefetch(item.href)}
          onFocus={() => router.prefetch(item.href)}
          onTouchStart={() => router.prefetch(item.href)}
          aria-current={isActivePath(pathname, item.href) ? 'page' : undefined}
          className={cn(
            'flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
            isActivePath(pathname, item.href)
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent',
          )}
        >
          <item.icon className="h-4 w-4" aria-hidden="true" />
          {item.name}
        </Link>
      ))}
    </nav>
  );
}

interface AppSidebarProps {
  user: { name?: string | null; email: string; image?: string | null };
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r bg-card lg:flex">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b px-6">
        <BrandLogo className="w-full" />
      </div>

      {/* Nav */}
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-4" aria-label="Main navigation">
        {navigation.map((item) => {
          const isActive = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              prefetch={true}
              onMouseEnter={() => router.prefetch(item.href)}
              onFocus={() => router.prefetch(item.href)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <item.icon className="h-4 w-4" aria-hidden />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      <div className="border-t p-4">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold uppercase text-primary-foreground"
            aria-hidden
          >
            {(user.name ?? user.email)[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name ?? 'User'}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
