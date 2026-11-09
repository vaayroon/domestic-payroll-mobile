import type { Catalog } from '../../catalog';
import type { language as es } from '../es/language';

export const language: Catalog<typeof es> = {
  title: 'Language',
  link: 'App language',
  description: 'Choose the interface language. Payslips and emails always stay in Spanish.',
  options: {
    device: 'Follow device language',
    es: 'Español',
    en: 'English',
  },
  selected: 'Selected',
  errors: {
    save_failed: 'Could not save the language. Please try again.',
  },
};
