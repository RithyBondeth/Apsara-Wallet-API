CREATE TABLE "transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"from_wallet_id" uuid NOT NULL,
	"to_wallet_id" uuid NOT NULL,
	"amount_khr" bigint NOT NULL,
	"note" text,
	"date" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_wallet_id_wallets_id_fk" FOREIGN KEY ("from_wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_wallet_id_wallets_id_fk" FOREIGN KEY ("to_wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;