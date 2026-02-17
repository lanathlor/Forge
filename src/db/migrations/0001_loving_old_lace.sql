CREATE TABLE `qa_gate_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`gate_name` text NOT NULL,
	`command` text NOT NULL,
	`status` text NOT NULL,
	`output` text,
	`error` text,
	`exit_code` integer,
	`duration` integer,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`order` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `qa_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `qa_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`repository_id` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`duration` integer,
	FOREIGN KEY (`repository_id`) REFERENCES `repositories`(`id`) ON UPDATE no action ON DELETE no action
);
