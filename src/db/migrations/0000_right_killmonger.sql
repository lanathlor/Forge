CREATE TABLE `repositories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`current_branch` text,
	`last_commit_sha` text,
	`last_commit_msg` text,
	`is_clean` integer DEFAULT true,
	`last_scanned` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`repository_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`start_branch` text,
	`end_branch` text,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`last_activity` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`prompt` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`current_qa_attempt` integer DEFAULT 1,
	`claude_output` text,
	`starting_commit` text,
	`starting_branch` text,
	`files_changed` text,
	`diff_content` text,
	`committed_sha` text,
	`commit_message` text,
	`rejected_at` integer,
	`rejection_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`started_at` integer,
	`completed_at` integer
);
--> statement-breakpoint
CREATE TABLE `qa_gate_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`enabled` integer DEFAULT true,
	`command` text NOT NULL,
	`timeout` integer DEFAULT 60000,
	`fail_on_error` integer DEFAULT true,
	`order` integer DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `qa_gate_results` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`gate_name` text NOT NULL,
	`status` text NOT NULL,
	`output` text,
	`errors` text,
	`duration` integer,
	`created_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repositories_path_unique` ON `repositories` (`path`);--> statement-breakpoint
CREATE UNIQUE INDEX `qa_gate_configs_name_unique` ON `qa_gate_configs` (`name`);