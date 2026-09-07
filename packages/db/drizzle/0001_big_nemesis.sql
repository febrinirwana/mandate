CREATE TABLE "audit_evidence" (
	"chain_id" numeric(78, 0) NOT NULL,
	"tx_hash" text NOT NULL,
	"block_hash" text NOT NULL,
	"audit_version" integer NOT NULL,
	"ordinal" integer NOT NULL,
	"provider" text NOT NULL,
	"response_hash" text NOT NULL,
	CONSTRAINT "audit_evidence_chain_id_tx_hash_block_hash_audit_version_ordinal_pk" PRIMARY KEY("chain_id","tx_hash","block_hash","audit_version","ordinal"),
	CONSTRAINT "audit_evidence_ordinal_uint" CHECK ("audit_evidence"."ordinal" >= 0),
	CONSTRAINT "audit_evidence_hash_hex" CHECK ("audit_evidence"."response_hash" ~ '^0x[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "audits" (
	"chain_id" numeric(78, 0) NOT NULL,
	"tx_hash" text NOT NULL,
	"block_hash" text NOT NULL,
	"audit_version" integer NOT NULL,
	"result" text NOT NULL,
	"checks" jsonb NOT NULL,
	"invalidated_at" timestamp with time zone,
	"invalidation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audits_chain_id_tx_hash_block_hash_audit_version_pk" PRIMARY KEY("chain_id","tx_hash","block_hash","audit_version"),
	CONSTRAINT "audits_result" CHECK ("audits"."result" in ('COMPLIANT', 'NON_COMPLIANT', 'UNKNOWN')),
	CONSTRAINT "audits_version_positive" CHECK ("audits"."audit_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "balance_deltas" (
	"chain_id" numeric(78, 0) NOT NULL,
	"tx_hash" text NOT NULL,
	"block_hash" text NOT NULL,
	"account" text NOT NULL,
	"token" text NOT NULL,
	"source" text NOT NULL,
	"before_block_number" numeric(78, 0) NOT NULL,
	"before_block_hash" text NOT NULL,
	"before_amount" numeric(78, 0) NOT NULL,
	"after_amount" numeric(78, 0) NOT NULL,
	"delta" numeric(78, 0) NOT NULL,
	CONSTRAINT "balance_deltas_chain_id_tx_hash_block_hash_account_token_source_pk" PRIMARY KEY("chain_id","tx_hash","block_hash","account","token","source"),
	CONSTRAINT "balance_deltas_source" CHECK ("balance_deltas"."source" in ('RPC_CALL', 'EVENT_RECONSTRUCTION', 'AQUA_RAW_BALANCE'))
);
--> statement-breakpoint
CREATE TABLE "evidence_invalidations" (
	"chain_id" numeric(78, 0) NOT NULL,
	"tx_hash" text NOT NULL,
	"replaced_block_hash" text NOT NULL,
	"canonical_block_hash" text,
	"reason" text NOT NULL,
	"invalidated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_invalidations_chain_id_tx_hash_replaced_block_hash_reason_pk" PRIMARY KEY("chain_id","tx_hash","replaced_block_hash","reason"),
	CONSTRAINT "evidence_invalidations_reason" CHECK ("evidence_invalidations"."reason" in ('BLOCK_HASH_REPLACED', 'RECEIPT_DISAPPEARED'))
);
--> statement-breakpoint
CREATE TABLE "execution_events" (
	"chain_id" numeric(78, 0) NOT NULL,
	"block_hash" text NOT NULL,
	"tx_hash" text NOT NULL,
	"log_index" numeric(78, 0) NOT NULL,
	"contract" text NOT NULL,
	"topic0" text,
	"topics" jsonb NOT NULL,
	"data" text NOT NULL,
	"kind" text NOT NULL,
	"decoded" jsonb NOT NULL,
	"decoder_version" integer NOT NULL,
	CONSTRAINT "execution_events_chain_id_block_hash_tx_hash_log_index_pk" PRIMARY KEY("chain_id","block_hash","tx_hash","log_index"),
	CONSTRAINT "execution_events_block_hash_hex" CHECK ("execution_events"."block_hash" ~ '^0x[0-9a-f]{64}$'),
	CONSTRAINT "execution_events_tx_hash_hex" CHECK ("execution_events"."tx_hash" ~ '^0x[0-9a-f]{64}$'),
	CONSTRAINT "execution_events_contract_hex" CHECK ("execution_events"."contract" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "execution_events_data_hex" CHECK ("execution_events"."data" ~ '^0x([0-9a-f]{2})*$'),
	CONSTRAINT "execution_events_decoder_version" CHECK ("execution_events"."decoder_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "executions" (
	"chain_id" numeric(78, 0) NOT NULL,
	"tx_hash" text NOT NULL,
	"strategy_hash" text NOT NULL,
	"caller" text NOT NULL,
	"amount_in" numeric(78, 0) NOT NULL,
	"amount_out" numeric(78, 0) NOT NULL,
	"used_input_after" numeric(78, 0) NOT NULL,
	"status" text NOT NULL,
	"block_number" numeric(78, 0) NOT NULL,
	"block_hash" text NOT NULL,
	"confirmation_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "executions_chain_id_tx_hash_pk" PRIMARY KEY("chain_id","tx_hash"),
	CONSTRAINT "executions_tx_hash_hex" CHECK ("executions"."tx_hash" ~ '^0x[0-9a-f]{64}$'),
	CONSTRAINT "executions_block_hash_hex" CHECK ("executions"."block_hash" ~ '^0x[0-9a-f]{64}$'),
	CONSTRAINT "executions_caller_hex" CHECK ("executions"."caller" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "executions_status" CHECK ("executions"."status" in ('SUBMITTED', 'CONFIRMED', 'REVERTED', 'REORGED')),
	CONSTRAINT "executions_amount_in_uint" CHECK ("executions"."amount_in" >= 0),
	CONSTRAINT "executions_amount_out_uint" CHECK ("executions"."amount_out" >= 0),
	CONSTRAINT "executions_used_input_uint" CHECK ("executions"."used_input_after" >= 0),
	CONSTRAINT "executions_confirmations_uint" CHECK ("executions"."confirmation_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "strategies" (
	"chain_id" numeric(78, 0) NOT NULL,
	"strategy_hash" text NOT NULL,
	"definition" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "strategies_chain_id_strategy_hash_pk" PRIMARY KEY("chain_id","strategy_hash"),
	CONSTRAINT "strategies_hash_hex" CHECK ("strategies"."strategy_hash" ~ '^0x[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE INDEX "executions_pending_idx" ON "executions" USING btree ("chain_id","status","block_number");