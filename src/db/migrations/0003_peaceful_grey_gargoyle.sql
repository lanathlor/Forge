CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`repository_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by` text DEFAULT 'user' NOT NULL,
	`source_file` text,
	`current_phase_id` text,
	`current_task_id` text,
	`starting_commit` text,
	`total_phases` integer DEFAULT 0 NOT NULL,
	`completed_phases` integer DEFAULT 0 NOT NULL,
	`total_tasks` integer DEFAULT 0 NOT NULL,
	`completed_tasks` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`started_at` integer,
	`completed_at` integer
);
--> statement-breakpoint
CREATE TABLE `phases` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`order` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`execution_mode` text DEFAULT 'sequential' NOT NULL,
	`pause_after` integer DEFAULT false NOT NULL,
	`total_tasks` integer DEFAULT 0 NOT NULL,
	`completed_tasks` integer DEFAULT 0 NOT NULL,
	`failed_tasks` integer DEFAULT 0 NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plan_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`phase_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`order` integer NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`depends_on` text,
	`can_run_in_parallel` integer DEFAULT false NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`last_qa_results` text,
	`session_id` text,
	`commit_sha` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plan_iterations` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`iteration_type` text NOT NULL,
	`prompt` text,
	`changes` text,
	`changed_by` text NOT NULL,
	`created_at` integer NOT NULL
);
