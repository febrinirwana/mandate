import { CanonicalReceiptEvidenceV1Schema, type CanonicalReceiptEvidenceV1 } from "@mandate/domain";

const sensitiveFieldNames = new Set([
  "apikey",
  "authorization",
  "bearer",
  "mnemonic",
  "password",
  "privatekey",
  "rawsignedtransaction",
  "signedtransaction",
]);

function inspectValue(value: unknown, seen: WeakSet<object>): void {
  if (typeof value === "string") {
    if (/^bearer\s+/i.test(value)) {
      throw new Error("sensitive evidence value is not persistable");
    }
    try {
      const url = new URL(value);
      if (url.username || url.password) {
        throw new Error("credential-bearing URL is not persistable");
      }
    } catch (error) {
      if (error instanceof Error && error.message === "credential-bearing URL is not persistable") {
        throw error;
      }
    }
    return;
  }
  if (!value || typeof value !== "object" || seen.has(value)) return;

  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) => inspectValue(item, seen));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (sensitiveFieldNames.has(key.replace(/[^a-z0-9]/gi, "").toLowerCase())) {
      throw new Error(`sensitive evidence field is not persistable: ${key}`);
    }
    inspectValue(child, seen);
  }
}

export function assertPersistableEvidence(value: unknown): CanonicalReceiptEvidenceV1 {
  inspectValue(value, new WeakSet<object>());
  return CanonicalReceiptEvidenceV1Schema.parse(value);
}
