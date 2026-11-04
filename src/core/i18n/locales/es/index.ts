import { app } from './app';
import { common } from './common';
import { employees } from './employees';
import { employer } from './employer';
import { language } from './language';
import { payroll } from './payroll';
import { reminder } from './reminder';

export const es = { common, app, language, employees, employer, reminder, payroll } as const;
