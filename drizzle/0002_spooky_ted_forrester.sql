CREATE TABLE `automation_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(120) NOT NULL,
	`specification` text NOT NULL,
	`cadence` varchar(24) NOT NULL,
	`cronExpression` varchar(96) NOT NULL,
	`timezone` varchar(64) NOT NULL DEFAULT 'UTC',
	`enabled` boolean NOT NULL DEFAULT true,
	`scheduleCronTaskUid` varchar(65),
	`nextExecutionAt` timestamp,
	`lastRunAt` timestamp,
	`lastRunMessage` varchar(240),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `automation_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `automation_schedules` ADD CONSTRAINT `automation_schedules_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `automation_schedules_user_id_index` ON `automation_schedules` (`userId`);--> statement-breakpoint
CREATE INDEX `automation_schedules_task_uid_index` ON `automation_schedules` (`scheduleCronTaskUid`);