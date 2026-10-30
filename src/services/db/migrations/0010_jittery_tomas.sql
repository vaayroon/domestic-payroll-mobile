ALTER TABLE `employees` ADD `receipt_encryption_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `employees` ADD `receipt_password_override` text;