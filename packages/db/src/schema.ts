import { sql } from "drizzle-orm";
import {
  check,
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const simulationEvidence = pgTable(
  "simulation_evidence",
  {
    id: text("id").primaryKey(),
    chainId: numeric("chain_id", { precision: 78, scale: 0 }).notNull(),
    strategyHash: text("strategy_hash").notNull(),
    blockNumber: numeric("block_number", { precision: 78, scale: 0 }).notNull(),
    blockHash: text("block_hash").notNull(),
    caller: text("caller").notNull(),
    calldataHash: text("calldata_hash").notNull(),
    result: text("result").notNull(),
    response: jsonb("response").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    check("simulation_evidence_id_hex", sql`${table.id} ~ '^0x[0-9a-f]{64}$'`),
    check("simulation_evidence_strategy_hash_hex", sql`${table.strategyHash} ~ '^0x[0-9a-f]{64}$'`),
    check("simulation_evidence_block_hash_hex", sql`${table.blockHash} ~ '^0x[0-9a-f]{64}$'`),
    check("simulation_evidence_caller_hex", sql`${table.caller} ~ '^0x[0-9a-f]{40}$'`),
    check("simulation_evidence_calldata_hash_hex", sql`${table.calldataHash} ~ '^0x[0-9a-f]{64}$'`),
    check("simulation_evidence_result", sql`${table.result} in ('PASS', 'FAIL', 'UNKNOWN')`),
    index("simulation_evidence_strategy_idx").on(
      table.chainId,
      table.strategyHash,
      table.createdAt,
    ),
  ],
);

export const strategies = pgTable(
  "strategies",
  {
    chainId: numeric("chain_id", { precision: 78, scale: 0 }).notNull(),
    strategyHash: text("strategy_hash").notNull(),
    definition: jsonb("definition").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.chainId, table.strategyHash] }),
    check("strategies_hash_hex", sql`${table.strategyHash} ~ '^0x[0-9a-f]{64}$'`),
  ],
);
export const contractDeployments = pgTable(
  "contract_deployments",
  {
    chainId: numeric("chain_id", { precision: 78, scale: 0 }).notNull(),
    kind: text("kind").notNull(),
    address: text("address").notNull(),
    codeHash: text("code_hash").notNull(),
    sourceRevision: text("source_revision").notNull(),
    official: boolean("official").notNull(),
    verifiedAtBlock: numeric("verified_at_block", { precision: 78, scale: 0 }).notNull(),
    verifiedAtHash: text("verified_at_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.chainId, table.kind, table.address, table.codeHash] }),
    check(
      "contract_deployments_kind",
      sql`${table.kind} in ('AQUA', 'MANDATE_APP', 'ENS_REGISTRY', 'ENS_RESOLVER', 'SWAP_TARGET')`,
    ),
    check("contract_deployments_chain_id_positive", sql`${table.chainId} > 0`),
    check("contract_deployments_address_hex", sql`${table.address} ~ '^0x[0-9a-f]{40}$'`),
    check("contract_deployments_code_hash_hex", sql`${table.codeHash} ~ '^0x[0-9a-f]{64}$'`),
    check("contract_deployments_block_uint", sql`${table.verifiedAtBlock} >= 0`),
    check(
      "contract_deployments_verified_hash_hex",
      sql`${table.verifiedAtHash} ~ '^0x[0-9a-f]{64}$'`,
    ),
  ],
);

export const executions = pgTable(
  "executions",
  {
    chainId: numeric("chain_id", { precision: 78, scale: 0 }).notNull(),
    txHash: text("tx_hash").notNull(),
    strategyHash: text("strategy_hash").notNull(),
    caller: text("caller").notNull(),
    amountIn: numeric("amount_in", { precision: 78, scale: 0 }).notNull(),
    amountOut: numeric("amount_out", { precision: 78, scale: 0 }).notNull(),
    usedInputAfter: numeric("used_input_after", { precision: 78, scale: 0 }).notNull(),
    status: text("status").notNull(),
    blockNumber: numeric("block_number", { precision: 78, scale: 0 }).notNull(),
    blockHash: text("block_hash").notNull(),
    transactionIndex: numeric("transaction_index", { precision: 78, scale: 0 })
      .notNull()
      .default("0"),
    confirmationCount: integer("confirmation_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.chainId, table.txHash, table.blockHash] }),
    check("executions_tx_hash_hex", sql`${table.txHash} ~ '^0x[0-9a-f]{64}$'`),
    check("executions_block_hash_hex", sql`${table.blockHash} ~ '^0x[0-9a-f]{64}$'`),
    check("executions_caller_hex", sql`${table.caller} ~ '^0x[0-9a-f]{40}$'`),
    check("executions_strategy_hash_hex", sql`${table.strategyHash} ~ '^0x[0-9a-f]{64}$'`),
    check("executions_chain_id_positive", sql`${table.chainId} > 0`),
    check("executions_block_number_uint", sql`${table.blockNumber} >= 0`),
    check("executions_transaction_index_uint", sql`${table.transactionIndex} >= 0`),
    check(
      "executions_status",
      sql`${table.status} in ('SUBMITTED', 'CONFIRMED', 'REVERTED', 'REORGED')`,
    ),
    check("executions_amount_in_uint", sql`${table.amountIn} >= 0`),
    check("executions_amount_out_uint", sql`${table.amountOut} >= 0`),
    check("executions_used_input_uint", sql`${table.usedInputAfter} >= 0`),
    check("executions_confirmations_uint", sql`${table.confirmationCount} >= 0`),
    index("executions_pending_idx").on(table.chainId, table.status, table.blockNumber),
  ],
);

export const executionEvents = pgTable(
  "execution_events",
  {
    chainId: numeric("chain_id", { precision: 78, scale: 0 }).notNull(),
    blockHash: text("block_hash").notNull(),
    txHash: text("tx_hash").notNull(),
    logIndex: numeric("log_index", { precision: 78, scale: 0 }).notNull(),
    contract: text("contract").notNull(),
    topic0: text("topic0"),
    topics: jsonb("topics").notNull(),
    data: text("data").notNull(),
    kind: text("kind").notNull(),
    decoded: jsonb("decoded").notNull(),
    decoderVersion: integer("decoder_version").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.chainId, table.blockHash, table.txHash, table.logIndex] }),
    foreignKey({
      columns: [table.chainId, table.txHash, table.blockHash],
      foreignColumns: [executions.chainId, executions.txHash, executions.blockHash],
      name: "execution_events_execution_fk",
    }),
    check("execution_events_block_hash_hex", sql`${table.blockHash} ~ '^0x[0-9a-f]{64}$'`),
    check("execution_events_tx_hash_hex", sql`${table.txHash} ~ '^0x[0-9a-f]{64}$'`),
    check("execution_events_contract_hex", sql`${table.contract} ~ '^0x[0-9a-f]{40}$'`),
    check("execution_events_data_hex", sql`${table.data} ~ '^0x([0-9a-f]{2})*$'`),
    check("execution_events_decoder_version", sql`${table.decoderVersion} > 0`),
    check("execution_events_chain_id_positive", sql`${table.chainId} > 0`),
    check("execution_events_log_index_uint", sql`${table.logIndex} >= 0`),
    check(
      "execution_events_topic0_hex",
      sql`${table.topic0} is null or ${table.topic0} ~ '^0x[0-9a-f]{64}$'`,
    ),
  ],
);

export const balanceDeltas = pgTable(
  "balance_deltas",
  {
    chainId: numeric("chain_id", { precision: 78, scale: 0 }).notNull(),
    txHash: text("tx_hash").notNull(),
    blockHash: text("block_hash").notNull(),
    account: text("account").notNull(),
    token: text("token").notNull(),
    source: text("source").notNull(),
    beforeBlockNumber: numeric("before_block_number", { precision: 78, scale: 0 }).notNull(),
    beforeBlockHash: text("before_block_hash").notNull(),
    before: numeric("before_amount", { precision: 78, scale: 0 }).notNull(),
    after: numeric("after_amount", { precision: 78, scale: 0 }).notNull(),
    delta: numeric("delta", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.chainId,
        table.txHash,
        table.blockHash,
        table.account,
        table.token,
        table.source,
      ],
    }),
    foreignKey({
      columns: [table.chainId, table.txHash, table.blockHash],
      foreignColumns: [executions.chainId, executions.txHash, executions.blockHash],
      name: "balance_deltas_execution_fk",
    }),
    check(
      "balance_deltas_source",
      sql`${table.source} in ('RPC_CALL', 'EVENT_RECONSTRUCTION', 'AQUA_RAW_BALANCE')`,
    ),
    check("balance_deltas_chain_id_positive", sql`${table.chainId} > 0`),
    check("balance_deltas_tx_hash_hex", sql`${table.txHash} ~ '^0x[0-9a-f]{64}$'`),
    check("balance_deltas_block_hash_hex", sql`${table.blockHash} ~ '^0x[0-9a-f]{64}$'`),
    check("balance_deltas_account_hex", sql`${table.account} ~ '^0x[0-9a-f]{40}$'`),
    check("balance_deltas_token_hex", sql`${table.token} ~ '^0x[0-9a-f]{40}$'`),
    check(
      "balance_deltas_before_block_hash_hex",
      sql`${table.beforeBlockHash} ~ '^0x[0-9a-f]{64}$'`,
    ),
    check("balance_deltas_before_block_uint", sql`${table.beforeBlockNumber} >= 0`),
    check("balance_deltas_before_uint", sql`${table.before} >= 0`),
    check("balance_deltas_after_uint", sql`${table.after} >= 0`),
    check("balance_deltas_exact", sql`${table.delta} = ${table.after} - ${table.before}`),
  ],
);

export const audits = pgTable(
  "audits",
  {
    chainId: numeric("chain_id", { precision: 78, scale: 0 }).notNull(),
    txHash: text("tx_hash").notNull(),
    blockHash: text("block_hash").notNull(),
    auditVersion: integer("audit_version").notNull(),
    result: text("result").notNull(),
    checks: jsonb("checks").notNull(),
    invalidatedAt: timestamp("invalidated_at", { withTimezone: true, mode: "date" }),
    invalidationReason: text("invalidation_reason"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.chainId, table.txHash, table.blockHash, table.auditVersion] }),
    foreignKey({
      columns: [table.chainId, table.txHash, table.blockHash],
      foreignColumns: [executions.chainId, executions.txHash, executions.blockHash],
      name: "audits_execution_fk",
    }),
    check("audits_result", sql`${table.result} in ('COMPLIANT', 'NON_COMPLIANT', 'UNKNOWN')`),
    check("audits_version_positive", sql`${table.auditVersion} > 0`),
    check("audits_chain_id_positive", sql`${table.chainId} > 0`),
    check("audits_tx_hash_hex", sql`${table.txHash} ~ '^0x[0-9a-f]{64}$'`),
    check("audits_block_hash_hex", sql`${table.blockHash} ~ '^0x[0-9a-f]{64}$'`),
    check(
      "audits_invalidation_pair",
      sql`(${table.invalidatedAt} is null and ${table.invalidationReason} is null) or (${table.invalidatedAt} is not null and ${table.invalidationReason} in ('BLOCK_HASH_REPLACED', 'RECEIPT_DISAPPEARED'))`,
    ),
  ],
);

export const auditEvidence = pgTable(
  "audit_evidence",
  {
    chainId: numeric("chain_id", { precision: 78, scale: 0 }).notNull(),
    txHash: text("tx_hash").notNull(),
    blockHash: text("block_hash").notNull(),
    auditVersion: integer("audit_version").notNull(),
    ordinal: integer("ordinal").notNull(),
    provider: text("provider").notNull(),
    responseHash: text("response_hash").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.chainId, table.txHash, table.blockHash, table.auditVersion, table.ordinal],
    }),
    foreignKey({
      columns: [table.chainId, table.txHash, table.blockHash, table.auditVersion],
      foreignColumns: [audits.chainId, audits.txHash, audits.blockHash, audits.auditVersion],
      name: "audit_evidence_audit_fk",
    }),
    check("audit_evidence_ordinal_uint", sql`${table.ordinal} >= 0`),
    check("audit_evidence_hash_hex", sql`${table.responseHash} ~ '^0x[0-9a-f]{64}$'`),
    check("audit_evidence_chain_id_positive", sql`${table.chainId} > 0`),
    check("audit_evidence_tx_hash_hex", sql`${table.txHash} ~ '^0x[0-9a-f]{64}$'`),
    check("audit_evidence_block_hash_hex", sql`${table.blockHash} ~ '^0x[0-9a-f]{64}$'`),
    check("audit_evidence_version_positive", sql`${table.auditVersion} > 0`),
  ],
);

export const evidenceInvalidations = pgTable(
  "evidence_invalidations",
  {
    chainId: numeric("chain_id", { precision: 78, scale: 0 }).notNull(),
    txHash: text("tx_hash").notNull(),
    replacedBlockHash: text("replaced_block_hash").notNull(),
    canonicalBlockHash: text("canonical_block_hash"),
    reason: text("reason").notNull(),
    invalidatedAt: timestamp("invalidated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.chainId, table.txHash, table.replacedBlockHash, table.reason] }),
    check("evidence_invalidations_chain_id_positive", sql`${table.chainId} > 0`),
    check("evidence_invalidations_tx_hash_hex", sql`${table.txHash} ~ '^0x[0-9a-f]{64}$'`),
    check(
      "evidence_invalidations_replaced_hash_hex",
      sql`${table.replacedBlockHash} ~ '^0x[0-9a-f]{64}$'`,
    ),
    check(
      "evidence_invalidations_canonical_hash_hex",
      sql`${table.canonicalBlockHash} is null or ${table.canonicalBlockHash} ~ '^0x[0-9a-f]{64}$'`,
    ),
    check(
      "evidence_invalidations_reason",
      sql`${table.reason} in ('BLOCK_HASH_REPLACED', 'RECEIPT_DISAPPEARED')`,
    ),
  ],
);
