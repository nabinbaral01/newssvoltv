import { AnalyticsTracker } from '@/components/site/analytics-tracker';
import { CookieConsent } from '@/components/site/cookie-consent';
import { SiteFooter } from '@/components/site/footer';
import { SiteHeader } from '@/components/site/header';
import { SignupModal } from '@/components/site/signup-modal';
import { currentUser } from '@/lib/permissions';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60] focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-accent-fg"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <CookieConsent />
      <SignupModal signedIn={Boolean(user)} />
      <AnalyticsTracker />
    </div>
  );
}
