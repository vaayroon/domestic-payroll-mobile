import type { Catalog } from '../../catalog';
import type { es } from '../es';
import { app } from './app';
import { common } from './common';
import { employees } from './employees';
import { employer } from './employer';
import { language } from './language';
import { payroll } from './payroll';
import { reminder } from './reminder';

export const en: Catalog<typeof es> = { common, app, language, employees, employer, reminder, payroll };
