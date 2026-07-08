CREATE TABLE "epay_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"out_trade_no" text NOT NULL,
	"user_id" text NOT NULL,
	"amount_fen" integer NOT NULL,
	"flux_amount" integer NOT NULL,
	"type" text DEFAULT 'alipay' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"trade_no" text,
	"flux_credited" integer DEFAULT 0 NOT NULL,
	"notify_payload" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"paid_at" timestamp,
	CONSTRAINT "epay_orders_out_trade_no_unique" UNIQUE("out_trade_no")
);
--> statement-breakpoint
CREATE INDEX "epay_orders_user_id_idx" ON "epay_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "epay_orders_status_idx" ON "epay_orders" USING btree ("status");