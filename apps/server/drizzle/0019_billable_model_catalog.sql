CREATE TABLE "billable_models" (
	"id" text PRIMARY KEY NOT NULL,
	"capability" text NOT NULL,
	"router_model_id" text NOT NULL,
	"display_name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billable_model_prices" (
	"id" text PRIMARY KEY NOT NULL,
	"model_id" text NOT NULL,
	"flux_per_call" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billable_model_prices" ADD CONSTRAINT "billable_model_prices_model_id_billable_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."billable_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billable_models_capability_router_model_uidx" ON "billable_models" USING btree ("capability","router_model_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billable_model_prices_model_uidx" ON "billable_model_prices" USING btree ("model_id");
