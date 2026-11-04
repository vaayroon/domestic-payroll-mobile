import { app } from './app';
import { common } from './common';
import { employees } from './employees';
import { language } from './language';

export const es = { common, app, language, employees } as const;
