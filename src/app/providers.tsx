'use client';

import { SSHProvider } from '@/components/ssh-provider';
import { I18nProvider } from '@/i18n/provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <SSHProvider>{children}</SSHProvider>
    </I18nProvider>
  );
}
