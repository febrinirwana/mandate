CREATE TABLE "contract_deployments" (
	"chain_id" numeric(78, 0) NOT NULL,
	"kind" text NOT NULL,
	"address" text NOT NULL,
	"code_hash" text NOT NULL,
	"source_revision" text NOT NULL,
	"official" boolean NOT NULL,
	"verified_at_block" numeric(78, 0) NOT NULL,
	"verified_at_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contract_deployments_chain_id_kind_address_code_hash_pk" PRIMARY KEY("chain_id","kind","address","code_hash"),
	CONSTRAINT "contract_deployments_kind" CHECK ("contract_deployments"."kind" in ('AQUA', 'MANDATE_APP', 'ENS_REGISTRY', 'ENS_RESOLVER', 'SWAP_TARGET')),
	CONSTRAINT "contract_deployments_chain_id_positive" CHECK ("contract_deployments"."chain_id" > 0),
	CONSTRAINT "contract_deployments_address_hex" CHECK ("contract_deployments"."address" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "contract_deployments_code_hash_hex" CHECK ("contract_deployments"."code_hash" ~ '^0x[0-9a-f]{64}$'),
	CONSTRAINT "contract_deployments_block_uint" CHECK ("contract_deployments"."verified_at_block" >= 0),
	CONSTRAINT "contract_deployments_verified_hash_hex" CHECK ("contract_deployments"."verified_at_hash" ~ '^0x[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "executions" DROP CONSTRAINT "executions_chain_id_tx_hash_pk";--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_chain_id_tx_hash_block_hash_pk" PRIMARY KEY("chain_id","tx_hash","block_hash");--> statement-breakpoint
ALTER TABLE "audit_evidence" ADD CONSTRAINT "audit_evidence_chain_id_positive" CHECK ("audit_evidence"."chain_id" > 0);--> statement-breakpoint
ALTER TABLE "audit_evidence" ADD CONSTRAINT "audit_evidence_tx_hash_hex" CHECK ("audit_evidence"."tx_hash" ~ '^0x[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "audit_evidence" ADD CONSTRAINT "audit_evidence_block_hash_hex" CHECK ("audit_evidence"."block_hash" ~ '^0x[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "audit_evidence" ADD CONSTRAINT "audit_evidence_version_positive" CHECK ("audit_evidence"."audit_version" > 0);--> statement-breakpoint
ALTER TABLE "audits" ADD CONSTRAINT "audits_chain_id_positive" CHECK ("audits"."chain_id" > 0);--> statement-breakpoint
ALTER TABLE "audits" ADD CONSTRAINT "audits_tx_hash_hex" CHECK ("audits"."tx_hash" ~ '^0x[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "audits" ADD CONSTRAINT "audits_block_hash_hex" CHECK ("audits"."block_hash" ~ '^0x[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "audits" ADD CONSTRAINT "audits_invalidation_pair" CHECK (("audits"."invalidated_at" is null and "audits"."invalidation_reason" is null) or ("audits"."invalidated_at" is not null and "audits"."invalidation_reason" in ('BLOCK_HASH_REPLACED', 'RECEIPT_DISAPPEARED')));--> statement-breakpoint
ALTER TABLE "balance_deltas" ADD CONSTRAINT "balance_deltas_chain_id_positive" CHECK ("balance_deltas"."chain_id" > 0);--> statement-breakpoint
ALTER TABLE "balance_deltas" ADD CONSTRAINT "balance_deltas_tx_hash_hex" CHECK ("balance_deltas"."tx_hash" ~ '^0x[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "balance_deltas" ADD CONSTRAINT "balance_deltas_block_hash_hex" CHECK ("balance_deltas"."block_hash" ~ '^0x[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "balance_deltas" ADD CONSTRAINT "balance_deltas_account_hex" CHECK ("balance_deltas"."account" ~ '^0x[0-9a-f]{40}$');--> statement-breakpoint
ALTER TABLE "balance_deltas" ADD CONSTRAINT "balance_deltas_token_hex" CHECK ("balance_deltas"."token" ~ '^0x[0-9a-f]{40}$');--> statement-breakpoint
ALTER TABLE "balance_deltas" ADD CONSTRAINT "balance_deltas_before_block_hash_hex" CHECK ("balance_deltas"."before_block_hash" ~ '^0x[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "balance_deltas" ADD CONSTRAINT "balance_deltas_before_block_uint" CHECK ("balance_deltas"."before_block_number" >= 0);--> statement-breakpoint
ALTER TABLE "balance_deltas" ADD CONSTRAINT "balance_deltas_before_uint" CHECK ("balance_deltas"."before_amount" >= 0);--> statement-breakpoint
ALTER TABLE "balance_deltas" ADD CONSTRAINT "balance_deltas_after_uint" CHECK ("balance_deltas"."after_amount" >= 0);--> statement-breakpoint
ALTER TABLE "balance_deltas" ADD CONSTRAINT "balance_deltas_exact" CHECK ("balance_deltas"."delta" = "balance_deltas"."after_amount" - "balance_deltas"."before_amount");--> statement-breakpoint
ALTER TABLE "evidence_invalidations" ADD CONSTRAINT "evidence_invalidations_chain_id_positive" CHECK ("evidence_invalidations"."chain_id" > 0);--> statement-breakpoint
ALTER TABLE "evidence_invalidations" ADD CONSTRAINT "evidence_invalidations_tx_hash_hex" CHECK ("evidence_invalidations"."tx_hash" ~ '^0x[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "evidence_invalidations" ADD CONSTRAINT "evidence_invalidations_replaced_hash_hex" CHECK ("evidence_invalidations"."replaced_block_hash" ~ '^0x[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "evidence_invalidations" ADD CONSTRAINT "evidence_invalidations_canonical_hash_hex" CHECK ("evidence_invalidations"."canonical_block_hash" is null or "evidence_invalidations"."canonical_block_hash" ~ '^0x[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "execution_events" ADD CONSTRAINT "execution_events_chain_id_positive" CHECK ("execution_events"."chain_id" > 0);--> statement-breakpoint
ALTER TABLE "execution_events" ADD CONSTRAINT "execution_events_log_index_uint" CHECK ("execution_events"."log_index" >= 0);--> statement-breakpoint
ALTER TABLE "execution_events" ADD CONSTRAINT "execution_events_topic0_hex" CHECK ("execution_events"."topic0" is null or "execution_events"."topic0" ~ '^0x[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_strategy_hash_hex" CHECK ("executions"."strategy_hash" ~ '^0x[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_chain_id_positive" CHECK ("executions"."chain_id" > 0);--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_block_number_uint" CHECK ("executions"."block_number" >= 0);