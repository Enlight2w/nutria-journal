CREATE TABLE `meal_feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`mealId` varchar(80) NOT NULL,
	`signal` enum('saved','skipped','rated') NOT NULL,
	`rating` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meal_feedback_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `progress_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`weightDeciKg` int NOT NULL,
	`notes` text,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `progress_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`age` int NOT NULL,
	`gender` varchar(24) NOT NULL,
	`weightDeciKg` int NOT NULL,
	`heightCm` int NOT NULL,
	`goal` varchar(32) NOT NULL,
	`activityLevel` varchar(32) NOT NULL,
	`dietaryPreference` varchar(120) NOT NULL,
	`workoutRoutine` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_profiles_user_id_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `meal_feedback` ADD CONSTRAINT `meal_feedback_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `progress_entries` ADD CONSTRAINT `progress_entries_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD CONSTRAINT `user_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;