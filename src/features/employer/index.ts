/**
 * features/employer — editable employer profile (nombre/NIF/domicilio/CCC):
 * pure validators + the settings-form hook + screen.
 *
 * Dependency direction (CLAUDE.md §3): depends on `core/` and `types/`
 * (repository interfaces), never on concrete `services/*` implementations.
 */

export * from './domain';
export * from './screens';
