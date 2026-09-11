import type { MandateSnapshotV1, PolicyProfileV1 } from "@mandate/domain";

import { CopyValue } from "@/components/ui/copy-value";
import { Stamp } from "@/components/ui/kit";
import { formatTokenAmount } from "@/lib/token-display";

export function AquaBalances({
  snapshot,
  profile,
}: {
  snapshot: MandateSnapshotV1;
  profile?: PolicyProfileV1;
}) {
  const amount = (value: string, token: "in" | "out") =>
    profile
      ? formatTokenAmount(value, token === "in" ? profile.tokenIn : profile.tokenOut)
      : `${value} base units`;
  const physical = [
    {
      label: `${profile?.tokenIn.symbol ?? "tokenIn"} in treasury wallet`,
      value: amount(snapshot.physical.makerTokenIn, "in"),
    },
    {
      label: `${profile?.tokenOut.symbol ?? "tokenOut"} in treasury wallet`,
      value: amount(snapshot.physical.makerTokenOut, "out"),
    },
    {
      label: `${profile?.tokenIn.symbol ?? "tokenIn"} at agent`,
      value: amount(snapshot.physical.agentTokenIn, "in"),
    },
    {
      label: `${profile?.tokenOut.symbol ?? "tokenOut"} at agent`,
      value: amount(snapshot.physical.agentTokenOut, "out"),
    },
    {
      label: `${profile?.tokenIn.symbol ?? "tokenIn"} at Mandate app`,
      value: amount(snapshot.physical.appTokenIn, "in"),
    },
    {
      label: `${profile?.tokenOut.symbol ?? "tokenOut"} at Mandate app`,
      value: amount(snapshot.physical.appTokenOut, "out"),
    },
  ];
  const virtual = [
    {
      label: `${profile?.tokenIn.symbol ?? "tokenIn"} strategy allocation`,
      value: amount(snapshot.aqua.inputBalance, "in"),
    },
    {
      label: `${profile?.tokenOut.symbol ?? "tokenOut"} strategy allocation`,
      value: amount(snapshot.aqua.outputBalance, "out"),
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule pb-3">
        <h3 className="text-[1.0625rem] font-medium tracking-[-0.01em]">Aqua balances</h3>
        <div className="flex items-center gap-2">
          <Stamp
            kind={
              snapshot.aqua.result === "PASS" && snapshot.physical.result === "PASS"
                ? "PASS"
                : "UNKNOWN"
            }
            label={
              snapshot.aqua.result === "PASS" && snapshot.physical.result === "PASS"
                ? "BLOCK-STAMPED"
                : "UNKNOWN"
            }
          />
          <span className="ledger-label text-ink-3">physical vs virtual</span>
        </div>
      </div>
      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <dl>
          <dt className="ledger-label text-ink-3">
            Physical: ERC-20 balances at block {snapshot.block.number}
          </dt>
          {physical.map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-6 border-b border-rule py-2.5"
            >
              <dd className="text-[0.875rem] text-ink-2">{row.label}</dd>
              <dd className="mono-data break-all text-right text-ink">
                {snapshot.physical.result === "PASS" ? row.value : "UNKNOWN"}
              </dd>
            </div>
          ))}
        </dl>
        <dl>
          <dt className="ledger-label text-ink-3">Virtual: Aqua strategy lane</dt>
          {virtual.map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-6 border-b border-rule py-2.5"
            >
              <dd className="text-[0.875rem] text-ink-2">{row.label}</dd>
              <dd className="mono-data text-ink">
                {snapshot.aqua.result === "PASS" ? row.value : "UNKNOWN"}
              </dd>
            </div>
          ))}
          <div className="mono-data mt-3 text-ink-3">
            <CopyValue value={snapshot.aqua.address} />
            <p className="mt-2">
              Virtual balances are per-maker/app/strategy accounting lanes. They are not a second
              wallet balance.
            </p>
          </div>
        </dl>
      </div>
    </div>
  );
}
