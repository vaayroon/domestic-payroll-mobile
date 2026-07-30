CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`employer_id` text NOT NULL,
	`name` text NOT NULL,
	`nif` text,
	`naf` text,
	`base_gross_cents` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`employer_id`) REFERENCES `employers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `employees_employer_id_idx` ON `employees` (`employer_id`);--> statement-breakpoint
CREATE TABLE `employers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`nif` text,
	`address` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payroll_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`period_year` integer NOT NULL,
	`period_month` integer NOT NULL,
	`gross_cents` integer NOT NULL,
	`ss_deduction_cents` integer NOT NULL,
	`net_cents` integer NOT NULL,
	`prorated` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payroll_runs_employee_id_idx` ON `payroll_runs` (`employee_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_runs_employee_period_unique` ON `payroll_runs` (`employee_id`,`period_year`,`period_month`);