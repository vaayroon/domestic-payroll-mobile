// Reminder application layer -- orchestrates the domain against a
// `NotificationScheduler` interface (design D5). Never imports a concrete
// adapter; depends on `@/types` only.

export * from './reconcileReminder';
