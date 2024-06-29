CREATE TABLE `chats` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` text DEFAULT (CURRENT_TIMESTAMP),
	`updatedAt` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `keys` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`serviceId` text NOT NULL,
	`apiKey` text NOT NULL,
	`createdAt` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text NOT NULL,
	`chatId` text NOT NULL,
	`sender` text,
	`recipients` text DEFAULT '[]' NOT NULL,
	`role` text NOT NULL,
	`content` text,
	`data` text,
	`createdAt` text DEFAULT (CURRENT_TIMESTAMP),
	`updatedAt` text DEFAULT (CURRENT_TIMESTAMP),
	PRIMARY KEY(`chatId`, `id`),
	FOREIGN KEY (`chatId`) REFERENCES `chats`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `models` (
	`id` text PRIMARY KEY NOT NULL,
	`keyId` text NOT NULL,
	`name` text NOT NULL,
	`visible` integer NOT NULL,
	`createdAt` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`keyId`) REFERENCES `keys`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`apiType` text NOT NULL,
	`baseURL` text NOT NULL,
	`createdAt` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE INDEX `keyIdIndex` ON `models` (`keyId`);