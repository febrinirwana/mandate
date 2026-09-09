CREATE TABLE "simulation_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"chain_id" numeric(78, 0) NOT NULL,
	"strategy_hash" text NOT NULL,
	"block_number" numeric(78, 0) NOT NULL,
	"block_hash" text NOT NULL,
	"caller" text NOT NULL,
	"calldata_hash" text NOT NULL,
	"result" text NOT NULL,
	"response" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "simulation_evidence_id_hex" CHECK ("simulation_evidence"."id" ~ '^0x[0-9a-f]{64}$'),
	CONSTRAINT "simulation_evidence_strategy_hash_hex" CHECK ("simulation_evidence"."strategy_hash" ~ '^0x[0-9a-f]{64}$'),
	CONSTRAINT "simulation_evidence_block_hash_hex" CHECK ("simulation_evidence"."block_hash" ~ '^0x[0-9a-f]{64}$'),
	CONSTRAINT "simulation_evidence_caller_hex" CHECK ("simulation_evidence"."caller" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "simulation_evidence_calldata_hash_hex" CHECK ("simulation_evidence"."calldata_hash" ~ '^0x[0-9a-f]{64}$'),
	CONSTRAINT "simulation_evidence_result" CHECK ("simulation_evidence"."result" in ('PASS', 'FAIL', 'UNKNOWN'))
);
--> statement-breakpoint
CREATE INDEX "simulation_evidence_strategy_idx" ON "simulation_evidence" USING btree ("chain_id","strategy_hash","created_at");