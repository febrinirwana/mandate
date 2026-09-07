import { check, index, jsonb, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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
