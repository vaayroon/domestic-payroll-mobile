/**
 * DI composition boundary for the mail/share services (design ADR-3). Mirrors
 * `PdfServiceProvider.tsx`'s pattern but is deliberately a SIBLING provider —
 * a PDF sharer/mail sender is not a repository and would pollute that
 * persistence-only abstraction. Imports exclusively from `@/types`, never
 * `expo-sharing`/`expo-mail-composer` directly; the concrete
 * `ExpoSharingPdfSharer`/`ExpoMailSender` are constructed once at the
 * composition root (`src/app/_layout.tsx`) and handed to
 * `<MailServiceProvider>` as props.
 */

import { createContext, useContext, type ReactNode } from 'react';

import type { MailSender, PdfSharer } from '@/types';

interface MailServices {
  readonly pdfSharer: PdfSharer;
  readonly mailSender: MailSender;
}

const MailServiceContext = createContext<MailServices | null>(null);

export function MailServiceProvider({
  pdfSharer,
  mailSender,
  children,
}: MailServices & { children: ReactNode }) {
  return (
    <MailServiceContext.Provider value={{ pdfSharer, mailSender }}>{children}</MailServiceContext.Provider>
  );
}

function useMailServices(): MailServices {
  const services = useContext(MailServiceContext);
  if (!services) {
    throw new Error('usePdfSharer/useMailSender must be called within a <MailServiceProvider>.');
  }
  return services;
}

export function usePdfSharer(): PdfSharer {
  return useMailServices().pdfSharer;
}

export function useMailSender(): MailSender {
  return useMailServices().mailSender;
}
