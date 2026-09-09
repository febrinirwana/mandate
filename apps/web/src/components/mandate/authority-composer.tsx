"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { Check, ChevronDown, LockKeyhole } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { keccak256, stringToHex } from "viem";

import { readMandate } from "@/lib/api";
import { DemoFaucet } from "@/components/mandate/demo-faucet";
import { LocalIssuance } from "@/components/mandate/local-issuance";
import { CopyValue } from "@/components/ui/copy-value";
import { Button, ButtonLink } from "@/components/ui/kit";
import { isIssuedAuthority, strategyHash } from "@/lib/mandate";
import { compilePolicy, type PolicyProfileV1 } from "@/lib/policy";
import type { PolicyReadiness } from "@/lib/policy-readiness";
import { buildAuthorityCalls, submitSmartWalletCalls } from "@/lib/privy-wallet";
import type { WalletState } from "@/lib/wallet";
import type { MandateRuntime } from "@/lib/runtime.server";

const newSalt = () => keccak256(stringToHex(crypto.randomUUID()));

function walletMessage(state: WalletState): string | undefined {
  if (state.kind === "SUBMITTED")
    return `SUBMITTED: ${state.txHash}. Awaiting canonical receipt; this is not confirmed.`;
  if (state.kind === "CONFIRMED")
    return "CONFIRMED: the exact authority is active in canonical Sepolia state.";
  if (state.kind === "REJECTED")
    return "Wallet rejected. The reviewed StrategyV1 and completed checks remain available for retry.";
  if (state.kind === "REVERTED") return `REVERTED: ${state.message}`;
  if (state.kind === "UNAVAILABLE") return "Secure smart wallet is unavailable.";
  return undefined;
}

function IssuanceForm({
  profile,
  runtime,
  readiness,
}: {
  profile: PolicyProfileV1;
  runtime: MandateRuntime;
  readiness: PolicyReadiness;
}) {
  const { authenticated, login, ready } = usePrivy();
  const { client } = useSmartWallets();
  const maker = client?.account.address?.toLowerCase() as `0x${string}` | undefined;
  const [maxInput, setMaxInput] = useState("");
  const [minRate, setMinRate] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [validAfter, setValidAfter] = useState("");
  const [salt, setSalt] = useState<`0x${string}`>();
  const [walletState, setWalletState] = useState<WalletState>({ kind: "IDLE" });
  const [fundingBalance, setFundingBalance] = useState<bigint>();

  useEffect(() => {
    setValidAfter(String(Math.floor(Date.now() / 1_000)));
    setSalt(newSalt());
  }, [profile]);

  const resetApproval = () => {
    setSalt(newSalt());
    setWalletState({ kind: "IDLE" });
  };
  const strategy = useMemo(() => {
    if (!maker || !validAfter || !salt) return undefined;
    try {
      return compilePolicy(
        {
          version: 1,
          agent: profile.agent.name,
          tokenIn: profile.tokenIn.symbol,
          tokenOut: profile.tokenOut.symbol,
          maxInput,
          minRate,
          expiresAt,
        },
        profile,
        {
          maker,
          validAfter,
          salt,
          maxMandateDuration: readiness.kind === "READY" ? readiness.maxMandateDuration : undefined,
        },
      );
    } catch {
      return undefined;
    }
  }, [expiresAt, maker, maxInput, minRate, profile, readiness, salt, validAfter]);
  const hash = strategy ? strategyHash(strategy) : undefined;
  const hasFunding =
    !runtime.demoFaucetAmount ||
    Boolean(
      strategy && fundingBalance !== undefined && fundingBalance >= BigInt(strategy.maxInputTotal),
    );
  const canAuthorize =
    readiness.kind === "READY" &&
    Boolean(strategy && client) &&
    hasFunding &&
    walletState.kind !== "SUBMITTED" &&
    walletState.kind !== "CONFIRMED";
  const authorize = async () => {
    if (!strategy || readiness.kind !== "READY") return;
    setWalletState(
      await submitSmartWalletCalls(
        client,
        buildAuthorityCalls(readiness.aqua, runtime.mandateApp, strategy),
      ),
    );
  };
  const submittedTxHash = walletState.kind === "SUBMITTED" ? walletState.txHash : undefined;
  useEffect(() => {
    if (!hash || !submittedTxHash) return;
    let cancelled = false;
    const confirm = async () => {
      const result = await readMandate(runtime.chainId, hash);
      if (!cancelled && result.kind === "READY" && isIssuedAuthority(result.data, hash)) {
        setWalletState({ kind: "CONFIRMED", txHash: submittedTxHash });
      }
    };
    void confirm();
    const timer = window.setInterval(() => void confirm(), 2_500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [hash, runtime.chainId, submittedTxHash]);
  const message = walletMessage(walletState);

  return (
    <div className="mx-auto max-w-[1440px] border-x border-rule">
      <section className="grid gap-8 border-b border-rule px-6 py-8 lg:grid-cols-[1fr_auto] lg:px-10">
        <div>
          <p className="ledger-label text-ink-3">Issue authority · exact StrategyV1</p>
          <h1 className="display mt-3 text-[clamp(2.5rem,5vw,4.5rem)]">
            Give an agent a boundary, not your keys.
          </h1>
        </div>
        <div className="self-start border border-rule bg-raised px-4 py-3 text-right">
          <p className="ledger-label text-ink-3">Secure owner</p>
          <p className="mono-data mt-1" aria-label={maker ? `Smart wallet ${maker}` : undefined}>
            {!ready
              ? "Preparing Privy…"
              : !authenticated
                ? "Not signed in"
                : maker
                  ? `${maker.slice(0, 6)}…${maker.slice(-4)}`
                  : "Preparing smart wallet…"}
          </p>
        </div>
      </section>

      <main className="grid lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)]">
        <section className="border-b border-rule px-6 py-10 lg:border-b-0 lg:border-r lg:px-10 lg:py-14">
          <p className="ledger-label text-ink-3">Four-step owner issuance</p>
          <ol className="mt-6 grid gap-4" aria-label="Authority issuance steps">
            <li className="border border-rule p-4">
              <p className="ledger-label text-ink-3">01 · owner wallet</p>
              <p className="mt-2">
                {authenticated
                  ? "Owner authenticated; smart-wallet address shown above."
                  : "Sign in before reviewing or signing authority."}
              </p>
              {!authenticated && (
                <Button className="mt-4" onClick={() => void login()}>
                  Sign in with Privy
                </Button>
              )}
              {authenticated && maker && runtime.demoFaucetAmount && (
                <DemoFaucet
                  profile={profile}
                  amount={runtime.demoFaucetAmount}
                  maker={maker}
                  client={client}
                  onBalance={setFundingBalance}
                />
              )}
            </li>
            <li className="border border-rule p-4">
              <p className="ledger-label text-ink-3">02 · live identity and venue</p>
              <p className="mt-2">
                {readiness.kind === "READY"
                  ? "Verified onchain: Aqua, agent ENS identity, token pair, and fixed route all match this profile."
                  : readiness.kind === "BLOCKED"
                    ? readiness.reason
                    : "Live authority checks are unavailable. No transaction can be prepared."}
              </p>
            </li>
            <li className="border border-rule p-4">
              <p className="ledger-label text-ink-3">03 · set economic boundary</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="ledger-label text-ink-3">
                    Maximum spend · {profile.tokenIn.symbol}
                  </span>
                  <input
                    aria-label="Maximum spend"
                    inputMode="decimal"
                    value={maxInput}
                    onChange={(event) => {
                      setMaxInput(event.target.value);
                      resetApproval();
                    }}
                    className="min-h-11 border border-rule bg-raised px-3"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="ledger-label text-ink-3">
                    Minimum output rate · {profile.tokenOut.symbol}/{profile.tokenIn.symbol}
                  </span>
                  <input
                    aria-label="Minimum output rate"
                    inputMode="decimal"
                    value={minRate}
                    onChange={(event) => {
                      setMinRate(event.target.value);
                      resetApproval();
                    }}
                    className="min-h-11 border border-rule bg-raised px-3"
                  />
                </label>
                <label className="grid gap-2 sm:col-span-2">
                  <span className="ledger-label text-ink-3">Expiry</span>
                  <input
                    aria-label="Expiry"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(event) => {
                      setExpiresAt(event.target.value);
                      resetApproval();
                    }}
                    className="min-h-11 border border-rule bg-raised px-3"
                  />
                </label>
              </div>
            </li>
            <li className="border border-rule p-4">
              <p className="ledger-label text-ink-3">04 · atomic smart-wallet authorization</p>
              <p className="mt-2 text-ink-2">
                One reviewed batch: approve {profile.tokenIn.symbol} to Aqua, set{" "}
                {profile.tokenOut.symbol} approval to zero, ship the exact cap to Aqua, then
                activate Mandate.
              </p>
              {strategy && runtime.demoFaucetAmount && !hasFunding && (
                <p role="status" className="mt-3 text-sm text-expiring">
                  Fund this wallet or lower the maximum spend before authorization.
                </p>
              )}
              <Button className="mt-4" onClick={() => void authorize()} disabled={!canAuthorize}>
                <LockKeyhole size={15} aria-hidden="true" />
                {walletState.kind === "CONFIRMED"
                  ? "Authority active"
                  : walletState.kind === "SUBMITTED"
                    ? "Awaiting canonical state"
                    : "Authorize exact four-call batch"}
              </Button>
              {message && (
                <p role="status" className="mono-data mt-3 text-ink-2">
                  {message}
                </p>
              )}
              {walletState.kind === "CONFIRMED" && hash && (
                <ButtonLink className="mt-4" href={`/mandates/${hash}`} arrow>
                  Inspect active authority
                </ButtonLink>
              )}
            </li>
          </ol>
        </section>

        <aside className="bg-raised px-6 py-10 lg:px-8 lg:py-14">
          <p className="ledger-label text-ink-3">Reviewable authority</p>
          {strategy && hash ? (
            <>
              <div className="mt-5 border border-rule bg-paper p-5">
                <p
                  className={`ledger-label ${walletState.kind === "CONFIRMED" ? "text-confirmed" : "text-accent"}`}
                >
                  {walletState.kind === "CONFIRMED"
                    ? "Confirmed · authority active"
                    : "Review required · not authorized"}
                </p>
                <h2 className="mt-4 text-[1.65rem] leading-[1.08] tracking-[-0.03em]">
                  {profile.agent.name} may convert up to {maxInput} {profile.tokenIn.symbol} into{" "}
                  {profile.tokenOut.symbol}.
                </h2>
                <dl className="mt-7 grid gap-4 border-t border-rule pt-5">
                  <div className="flex justify-between gap-4">
                    <dt className="ledger-label text-ink-3">Price floor</dt>
                    <dd className="mono-data text-right">
                      {minRate} {profile.tokenOut.symbol} / {profile.tokenIn.symbol}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="ledger-label text-ink-3">Expiry</dt>
                    <dd className="mono-data text-right">{new Date(expiresAt).toLocaleString()}</dd>
                  </div>
                </dl>
              </div>
              <details className="group mt-5 border-y border-rule">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[0.9375rem] font-medium">
                  Exact ABI/base-unit values
                  <ChevronDown
                    size={16}
                    className="transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="space-y-3 border-t border-rule py-4">
                  <CopyValue value={hash} />
                  <p className="mono-data break-all text-[0.6875rem] leading-5 text-ink-2">
                    maker {strategy.maker}
                    <br />
                    agent {strategy.agent}
                    <br />
                    tokens {strategy.tokenIn} → {strategy.tokenOut}
                    <br />
                    route {strategy.swapTarget} · {strategy.swapSelector}
                    <br />
                    rate {strategy.minRateNumerator}/{strategy.minRateDenominator}
                    <br />
                    cap/call {strategy.maxInputPerCall} · cap/total {strategy.maxInputTotal}
                    <br />
                    valid {strategy.validAfter} → {strategy.validUntil}
                    <br />
                    salt {strategy.salt}
                  </p>
                </div>
              </details>
            </>
          ) : (
            <p role="status" className="mono-data mt-5 text-unknown">
              Complete all economic fields with a connected owner wallet to produce an exact
              StrategyV1 for review.
            </p>
          )}
          <p className="mt-8 border-t border-rule pt-5 text-[0.875rem] leading-relaxed text-ink-2">
            <Check className="mr-2 inline" size={14} aria-hidden="true" />
            The owner key stays in Privy. Mandate receives only the signed transaction and
            constrained strategy.
          </p>
        </aside>
      </main>
    </div>
  );
}

export function AuthorityComposer({ runtime }: { runtime: MandateRuntime }) {
  const [readiness, setReadiness] = useState<PolicyReadiness>({ kind: "UNAVAILABLE" });
  useEffect(() => {
    let cancelled = false;
    if (!runtime.policyProfile) return undefined;
    void fetch("/api/policy-readiness", { cache: "no-store" })
      .then(async (response) => (await response.json()) as PolicyReadiness)
      .then((value) => {
        if (!cancelled)
          setReadiness(
            value.kind === "READY" || value.kind === "BLOCKED" ? value : { kind: "UNAVAILABLE" },
          );
      })
      .catch(() => {
        if (!cancelled) setReadiness({ kind: "UNAVAILABLE" });
      });
    return () => {
      cancelled = true;
    };
  }, [runtime.policyProfile]);
  if (!runtime.policyProfile)
    return (
      <section className="mx-auto max-w-[1440px] border-x border-rule px-6 py-24 lg:px-10">
        <p className="ledger-label text-ink-3">Authority profile unavailable</p>
        <h1 className="display mt-4 text-[clamp(2rem,4vw,3.25rem)]">
          No trusted route is configured.
        </h1>
        <p className="lede mt-4 max-w-[56ch]">
          Mandate will not guess an agent, token pair, ENS identity, or venue. Configure
          MANDATE_POLICY_PROFILE with the verified strategy profile before issuing authority.
        </p>
      </section>
    );
  if (runtime.local)
    return (
      <LocalIssuance profile={runtime.policyProfile} runtime={runtime} readiness={readiness} />
    );
  if (!runtime.privyEnabled)
    return (
      <section className="mx-auto max-w-[1440px] border-x border-rule px-6 py-24 lg:px-10">
        <p className="ledger-label text-ink-3">Secure wallet unavailable</p>
        <h1 className="display mt-4 text-[clamp(2rem,4vw,3.25rem)]">
          Privy needs a public App ID.
        </h1>
        <p className="lede mt-4 max-w-[56ch]">
          Add NEXT_PUBLIC_PRIVY_APP_ID to the web runtime, restart Next, and return here. No owner
          authority can be prepared without an authenticated wallet.
        </p>
      </section>
    );
  return <IssuanceForm profile={runtime.policyProfile} runtime={runtime} readiness={readiness} />;
}
