CREATE TABLE "subscription_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"period_days" integer NOT NULL,
	"amount_fen" integer NOT NULL,
	"flux_amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"user_id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"last_payment_order_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_periods" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"out_trade_no" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"flux_amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "epay_orders" ADD COLUMN "order_kind" text DEFAULT 'flux_topup' NOT NULL;--> statement-breakpoint
ALTER TABLE "epay_orders" ADD COLUMN "plan_id" text;--> statement-breakpoint
ALTER TABLE "epay_orders" ADD COLUMN "period_days" integer;--> statement-breakpoint
ALTER TABLE "epay_orders" ADD COLUMN "plan_name" text;--> statement-breakpoint
ALTER TABLE "epay_orders" ADD COLUMN "subject" text;--> statement-breakpoint
ALTER TABLE "epay_orders" ADD COLUMN "period_start" timestamp;--> statement-breakpoint
ALTER TABLE "epay_orders" ADD COLUMN "period_end" timestamp;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscription_plans_enabled_display_order_idx" ON "subscription_plans" USING btree ("enabled","display_order");--> statement-breakpoint
CREATE INDEX "user_subscriptions_status_period_end_idx" ON "user_subscriptions" USING btree ("status","current_period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_periods_out_trade_no_uidx" ON "subscription_periods" USING btree ("out_trade_no");--> statement-breakpoint
CREATE INDEX "subscription_periods_user_id_idx" ON "subscription_periods" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscription_periods_plan_id_idx" ON "subscription_periods" USING btree ("plan_id");
