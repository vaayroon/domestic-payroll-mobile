ALTER TABLE `payroll_runs` ADD `extra_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `payroll_runs` ADD `days_worked` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `payroll_runs` ADD `days_in_month` integer DEFAULT 0 NOT NULL;