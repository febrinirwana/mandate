"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { Check, ChevronDown, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { keccak256, stringToHex } from "viem";

import { DemoFaucet } from "@/components/mandate/demo-faucet";
import { LocalIssuance } from "@/components/mandate/local-issuance";
import { CopyValue } from "@/components/ui/copy-value";
import { Button } from "@/components/ui/kit";
import {
  authorizationChecklist,
  createIssuanceDefaults,
  deriveAccountPreparationState,
  issuedMandateUrl,
  reviewPolicyDraft,
} from "@/lib/issuance";
import { strategyHash } from "@/lib/mandate";
import type { PolicyDraftV1, PolicyProfileV1 } from "@/lib/policy";
import type { PolicyReadiness } from "@/lib/policy-readiness";
import { buildAuthorityCalls, submitSmartWalletCalls } from "@/lib/privy-wallet";
import type { MandateRuntime } from "@/lib/runtime.server";
import type { WalletState } from "@/lib/wallet";

const ACCOUNT_PREPARATION_TIMEOUT_MS = 30_000;
const PLACEHOLDER_SALT = `0x${"0".repeat(64)}` as const;

const newSalt = () => keccak256(stringToHex(crypto.randomUUID()));

function walletMessage(state: WalletState): string | undefined {
  if (state.kind === "SUBMITTED")
    return `SUBMITTED: ${state.txHash}. Opening the permanent strategy inspector while Sepolia includes the four-call transaction.`;
  if (state.kind === "CONFIRMED")
    return "CONFIRMED: the exact authority is active in canonical Sepolia state.";
  if (state.kind === "REJECTED")
    return "Wallet rejected. The reviewed strategy and completed checks remain available for retry.";
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
  const { authenticated, login, logout, ready } = usePrivy();
  const { client } = useSmartWallets();
  const router = useRouter();
  const maker = client?.account.address?.toLowerCase() as `0x${string}` | undefined;
  const [economicFields, setEconomicFields] = useState({
    maxInput: "1",
    minRate: "1",
    expiresAt: "",
  });
  const [validAfter, setValidAfter] = useState("");
  const [salt, setSalt] = useState<`0x${string}`>();
  const [walletState, setWalletState] = useState<WalletState>({ kind: "IDLE" });
  const [fundingBalance, setFundingBalance] = useState<bigint>();
  const [preparationAttempt, setPreparationAttempt] = useState<number>();
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    const startedAt = Date.now();
    setEconomicFields((current) =>
      current.expiresAt
        ? current
        : {
            ...current,
            ...createIssuanceDefaults(new Date(startedAt), new Date().getTimezoneOffset()),
          },
    );
    setValidAfter(String(Math.floor(startedAt / 1_000)));
    setSalt(newSalt());
  }, [profile]);

  useEffect(() => {
    if (!authenticated || maker) {
      setPreparationAttempt(undefined);
      return;
    }
    if (preparationAttempt !== undefined) return;
    const startedAt = Date.now();
    setPreparationAttempt(startedAt);
    setClock(startedAt);
  }, [authenticated, maker, preparationAttempt, ready]);

  useEffect(() => {
    if (!authenticated || maker || preparationAttempt === undefined) return;
    const delay = Math.max(0, preparationAttempt + ACCOUNT_PREPARATION_TIMEOUT_MS - Date.now());
    const timeout = window.setTimeout(() => setClock(Date.now()), delay);
    return () => window.clearTimeout(timeout);
  }, [authenticated, maker, preparationAttempt]);

  const accountState = deriveAccountPreparationState({
    authenticated,
    privyReady: ready,
    smartAccount: maker,
    attemptStartedAt: preparationAttempt,
    now: clock,
    timeoutMs: ACCOUNT_PREPARATION_TIMEOUT_MS,
  });
  const draft = useMemo<PolicyDraftV1>(
    () => ({
      version: 1,
      agent: profile.agent.name,
      tokenIn: profile.tokenIn.symbol,
      tokenOut: profile.tokenOut.symbol,
      ...economicFields,
    }),
    [economicFields, profile],
  );
  const review = useMemo(
    () =>
      reviewPolicyDraft(draft, profile, {
        maker: maker ?? profile.agent.address,
        validAfter: validAfter || String(Math.floor(Date.now() / 1_000)),
        maxMandateDuration: readiness.kind === "READY" ? readiness.maxMandateDuration : undefined,
        salt: salt ?? PLACEHOLDER_SALT,
      }),
    [draft, maker, profile, readiness, salt, validAfter],
  );
  const strategy = maker && validAfter && salt ? review.strategy : undefined;
  const hash = strategy ? strategyHash(strategy) : undefined;
  const fundingReady =
    !runtime.demoFaucetAmount ||
    Boolean(
      strategy && fundingBalance !== undefined && fundingBalance >= BigInt(strategy.maxInputTotal),
    );
  const readinessReady = readiness.kind === "READY";
  const checklist = authorizationChecklist({
    smartAccountReady: accountState.kind === "READY" && Boolean(client),
    chainReady: readinessReady,
    ensReady: readinessReady,
    fundingReady,
    economicFieldsValid: Boolean(review.strategy),
    batchReady:
      Boolean(strategy && client) &&
      walletState.kind !== "SUBMITTED" &&
      walletState.kind !== "CONFIRMED",
  });
  const activeStage =
    accountState.kind !== "READY" || !client ? 1 : !fundingReady ? 2 : !review.strategy ? 3 : 4;
  const stageClass = (stage: number) =>
    `relative overflow-hidden border p-5 transition-colors ${
      activeStage === stage
        ? "border-accent bg-[var(--accent-ghost)]"
        : activeStage > stage
          ? "border-confirmed/35 bg-confirmed-soft/35"
          : "border-rule bg-raised"
    }`;
  const message = walletMessage(walletState);

  const resetApproval = () => {
    setSalt(newSalt());
    setWalletState({ kind: "IDLE" });
  };

  const retryAccountPreparation = () => {
    window.location.reload();
  };

  const authorize = async () => {
    if (!strategy || !hash || readiness.kind !== "READY" || !checklist.canAuthorize) return;
    const next = await submitSmartWalletCalls(
      client,
      buildAuthorityCalls(readiness.aqua, runtime.mandateApp, strategy),
    );
    setWalletState(next);
    if (next.kind === "SUBMITTED") router.replace(issuedMandateUrl(hash, next.txHash));
  };

  let accountStatus = "Preparing Privy…";
  if (accountState.kind === "SIGNED_OUT") accountStatus = "Not signed in";
  else if (accountState.kind === "AUTHENTICATING") accountStatus = "Authenticating…";
  else if (accountState.kind === "PREPARING_ACCOUNT") accountStatus = "Preparing smart wallet…";
  else if (accountState.kind === "RECOVERABLE_ERROR")
    accountStatus = "Smart wallet preparation needs recovery";
  else if (maker) accountStatus = `${maker.slice(0, 6)}…${maker.slice(-4)}`;

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
          <p className="ledger-label text-ink-3">Owner smart account</p>
          <p className="mono-data mt-1" aria-label={maker ? `Smart wallet ${maker}` : undefined}>
            {accountStatus}
          </p>
          {maker && <CopyValue className="mt-2" value={maker} />}
          {authenticated && (
            <Button className="mt-3" variant="ghost" onClick={() => void logout()}>
              Sign out
            </Button>
          )}
        </div>
      </section>

      <main className="grid lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)]">
        <section className="border-b border-rule px-6 py-10 lg:border-b-0 lg:border-r lg:px-10 lg:py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="ledger-label text-ink-3">Four-stage owner issuance</p>
              <p className="mt-2 max-w-[58ch] text-sm text-ink-2">
                One reviewed smart-wallet transaction activates exactly four protocol calls.
              </p>
            </div>
            <span className="mono-data text-accent">Stage {activeStage} / 4</span>
          </div>
          <div className="mt-6 grid grid-cols-4 gap-1" aria-hidden="true">
            {[1, 2, 3, 4].map((stage) => (
              <span
                key={stage}
                className={`h-1 ${stage <= activeStage ? "bg-accent" : "bg-rule"}`}
              />
            ))}
          </div>
          <ol className="mt-4 grid gap-4" aria-label="Authority issuance stages">
            <li className={stageClass(1)}>
              <p className="ledger-label text-ink-3">01 · connect owner</p>
              <p className="mt-2">
                {accountState.kind === "SIGNED_OUT"
                  ? "Sign in with email or an EVM wallet. Privy creates a separate sponsored owner smart account."
                  : accountState.kind === "READY"
                    ? "Owner smart account ready on Sepolia. Your authentication wallet is not the mandate maker."
                    : "Privy is creating the dedicated owner smart account. Its onchain deployment occurs with the first transaction."}
              </p>
              {accountState.kind === "SIGNED_OUT" && (
                <Button className="mt-4" onClick={() => void login()}>
                  Sign in with email or wallet
                </Button>
              )}
              {accountState.kind === "RECOVERABLE_ERROR" && (
                <div className="mt-4 flex flex-wrap gap-3" role="status">
                  <Button onClick={retryAccountPreparation}>Reload and retry</Button>
                  <Button onClick={() => void logout()} variant="ghost">
                    Sign out
                  </Button>
                </div>
              )}
            </li>

            <li className={stageClass(2)}>
              <p className="ledger-label text-ink-3">02 · fund demo account</p>
              {maker && runtime.demoFaucetAmount ? (
                <DemoFaucet
                  profile={profile}
                  amount={runtime.demoFaucetAmount}
                  required={economicFields.maxInput}
                  maker={maker}
                  client={client}
                  onBalance={setFundingBalance}
                />
              ) : (
                <p className="mt-2">
                  Prepare the owner smart account before checking its demo balance.
                </p>
              )}
            </li>

            <li className={stageClass(3)}>
              <p className="ledger-label text-ink-3">03 · set authority limits</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="ledger-label text-ink-3">
                    Maximum spend · {profile.tokenIn.symbol}
                  </span>
                  <input
                    aria-label="Maximum spend"
                    inputMode="decimal"
                    value={economicFields.maxInput}
                    onChange={(event) => {
                      setEconomicFields((current) => ({
                        ...current,
                        maxInput: event.target.value,
                      }));
                      resetApproval();
                    }}
                    className="min-h-11 border border-rule bg-raised px-3"
                  />
                  {review.issues.maxInput && <p role="alert">{review.issues.maxInput}</p>}
                </label>
                <label className="grid gap-2">
                  <span className="ledger-label text-ink-3">
                    Minimum output rate · {profile.tokenOut.symbol}/{profile.tokenIn.symbol}
                  </span>
                  <input
                    aria-label="Minimum output rate"
                    inputMode="decimal"
                    value={economicFields.minRate}
                    onChange={(event) => {
                      setEconomicFields((current) => ({ ...current, minRate: event.target.value }));
                      resetApproval();
                    }}
                    className="min-h-11 border border-rule bg-raised px-3"
                  />
                  {review.issues.minRate && <p role="alert">{review.issues.minRate}</p>}
                </label>
                <label className="grid gap-2 sm:col-span-2">
                  <span className="ledger-label text-ink-3">Expiry</span>
                  <input
                    aria-label="Expiry"
                    type="datetime-local"
                    value={economicFields.expiresAt}
                    onChange={(event) => {
                      setEconomicFields((current) => ({
                        ...current,
                        expiresAt: event.target.value,
                      }));
                      resetApproval();
                    }}
                    className="min-h-11 border border-rule bg-raised px-3"
                  />
                  {review.issues.expiresAt && <p role="alert">{review.issues.expiresAt}</p>}
                </label>
              </div>
            </li>

            <li className={stageClass(4)}>
              <p className="ledger-label text-ink-3">04 · review and activate</p>
              <ul className="mt-4 grid gap-2" aria-label="Activation readiness">
                {checklist.items.map((item) => (
                  <li key={item.id} className="flex gap-2 text-sm">
                    <Check
                      aria-hidden="true"
                      className={item.complete ? "text-confirmed" : "text-expiring"}
                      size={16}
                    />
                    <span>
                      {item.complete
                        ? "Complete"
                        : item.id === "chain" || item.id === "ens"
                          ? readiness.kind === "BLOCKED"
                            ? readiness.reason
                            : item.reason
                          : item.reason}
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                className="mt-4"
                onClick={() => void authorize()}
                disabled={!checklist.canAuthorize}
              >
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
            </li>
          </ol>
        </section>

        <aside className="bg-raised px-6 py-10 lg:px-8 lg:py-14">
          <p className="ledger-label text-ink-3">Reviewable authority</p>
          {strategy && hash ? (
            <>
              <div className="mt-5 border border-rule bg-paper p-5">
                <p className="ledger-label text-accent">Review required · not authorized</p>
                <h2 className="mt-4 text-[1.65rem] leading-[1.08] tracking-[-0.03em]">
                  {profile.agent.name} may convert up to {economicFields.maxInput}{" "}
                  {profile.tokenIn.symbol} to {profile.tokenOut.symbol}, never below{" "}
                  {economicFields.minRate} {profile.tokenOut.symbol}/{profile.tokenIn.symbol}, until{" "}
                  {new Date(economicFields.expiresAt).toLocaleString()}.
                </h2>
              </div>
              <details className="group mt-5 border-y border-rule">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[0.9375rem] font-medium">
                  Technical strategy evidence
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
              Complete the economic fields and prepare the owner smart account to review the exact
              strategy.
            </p>
          )}
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
