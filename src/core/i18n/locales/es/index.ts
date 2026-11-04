import { app } from './app';
import { common } from './common';
import { employees } from './employees';
import { employer } from './employer';
import { language } from './language';
import { reminder } from './reminder';

export const es = { common, app, language, employees, employer, reminder } as const;
