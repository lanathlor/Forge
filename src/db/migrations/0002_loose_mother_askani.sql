ALTER TABLE repositories ADD `last_commit_author` text;--> statement-breakpoint
ALTER TABLE repositories ADD `last_commit_timestamp` integer;--> statement-breakpoint
ALTER TABLE repositories ADD `uncommitted_files` text;