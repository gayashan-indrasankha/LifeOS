CREATE TABLE "task_checklist_completions" (
	"user_id" text NOT NULL,
	"task_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"date" date NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_checklist_completions_user_task_item_date_unique" UNIQUE("user_id","task_id","item_id","date")
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "checklist_reset_daily" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "task_checklist_completions" ADD CONSTRAINT "task_checklist_completions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_checklist_completions" ADD CONSTRAINT "task_checklist_completions_user_id_task_id_tasks_user_id_id_fk" FOREIGN KEY ("user_id","task_id") REFERENCES "public"."tasks"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_checklist_completions_user_date_idx" ON "task_checklist_completions" USING btree ("user_id","date");