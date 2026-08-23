import { currentUser } from '@/lib/permissions';
import { getNavigation } from '@/lib/queries';

import { HeaderShell } from './header-client';

/** Server shell: session and navigation are fetched here, never on the client. */
export async function SiteHeader() {
  const [nav, user] = await Promise.all([getNavigation(), currentUser()]);

  return (
    <HeaderShell
      nav={nav}
      user={
        user
          ? { name: user.name, image: user.image, role: user.role, slug: user.slug }
          : null
      }
    />
  );
}
