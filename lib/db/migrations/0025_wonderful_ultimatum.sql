CREATE TABLE "task_completions" (
	"user_id" text NOT NULL,
	"task_id" uuid NOT NULL,
	"date" date NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_completions_user_task_date_unique" UNIQUE("user_id","task_id","date")
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "recurrence" varchar(12) DEFAULT 'once' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "weekdays" varchar(7);--> statement-breakpoint
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_user_id_task_id_tasks_user_id_id_fk" FOREIGN KEY ("user_id","task_id") REFERENCES "public"."tasks"("user_id","id") ON DELETE cascade ON UPDATE no action;
