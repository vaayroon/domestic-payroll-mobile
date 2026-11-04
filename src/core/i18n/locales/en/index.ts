import type { Catalog } from '../../catalog';
import type { es } from '../es';
import { app } from './app';
import { common } from './common';
import { language } from './language';

export const en: Catalog<typeof es> = { common, app, language };
