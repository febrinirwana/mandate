import { expect, test, type Page } from "@playwright/test";
import { encodeFunctionData, parseAbi } from "viem";

const RPC_URL = process.env.MANDATE_E2E_RPC_URL ?? "http://127.0.0.1:8545";
const OWNER = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
const AGENT = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc";
const MANDATE_APP = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";
const AMOUNT = 10n * 10n ** 18n;
const venueAbi = parseAbi(["function swap(uint256 amountIn,uint256 amountOut,address recipient)"]);

type RpcResponse = { result?: unknown; error?: { message?: string } };

async function rpc(method: string, params: unknown[] = []) {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = (await response.json()) as RpcResponse;
  if (body.error) throw new Error(body.error.message ?? `${method} failed`);
  return body.result;
}

async function installWallet(page: Page) {
  await page.addInitScript(
    ({ rpcUrl, initialAccount }) => {
      let account = initialAccount;
      let rejectNext = false;
      const request = async ({ method, params = [] }: { method: string; params?: unknown[] }) => {
        if (method === "eth_requestAccounts" || method === "eth_accounts") return [account];
        if (method === "eth_chainId") return "0x7a69";
        if (method === "eth_sendTransaction" && rejectNext) {
          rejectNext = false;
          throw Object.assign(new Error("User rejected the request"), { code: 4001 });
        }
        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        });
        const body = (await response.json()) as RpcResponse;
        if (body.error) throw new Error(body.error.message ?? `${method} failed`);
        return body.result;
      };
      Object.defineProperty(window, "ethereum", {
        configurable: true,
        value: { request },
      });
      Object.defineProperty(window, "__mandateE2e", {
        configurable: true,
        value: {
          setAccount(next: string) {
            account = next;
          },
          rejectNextTransaction() {
            rejectNext = true;
          },
        },
      });
    },
    { rpcUrl: RPC_URL, initialAccount: OWNER },
  );
}

async function setWalletAccount(page: Page, account: string) {
  await page.evaluate((next) => {
    (
      window as unknown as Window & {
        __mandateE2e: { setAccount(value: string): void };
      }
    ).__mandateE2e.setAccount(next);
  }, account);
}

async function rejectNextTransaction(page: Page) {
  await page.evaluate(() => {
    (
      window as unknown as Window & {
        __mandateE2e: { rejectNextTransaction(): void };
      }
    ).__mandateE2e.rejectNextTransaction();
  });
}

async function futureLocalExpiry(page: Page) {
  return page.evaluate(() => {
    const date = new Date(Date.now() + 60 * 60 * 1_000);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  });
}

let snapshot: unknown;

test.beforeEach(async ({ page }) => {
  snapshot = await rpc("evm_snapshot");
  await installWallet(page);
});

test.afterEach(async () => {
  if (snapshot) await rpc("evm_revert", [snapshot]);
});

test("issue, inspect, simulate, execute, receive evidence, revoke, and fail closed", async ({
  page,
}) => {
  await page.goto("/issue");
  await expect(page.getByRole("heading", { name: /Exercise authority/ })).toBeVisible();

  await page.getByRole("button", { name: "Connect local owner wallet" }).click();
  await expect(page.locator(`[aria-label="Local owner ${OWNER}"]`)).toBeVisible();

  await page.getByLabel("Maximum spend").fill("10");
  await page.getByLabel("Minimum output rate").fill("1");
  const expiry = await futureLocalExpiry(page);
  await page.getByLabel("Expiry").fill(expiry);

  const transactionSteps = [
    "Approve LIN to Aqua",
    "Set LOUT Aqua approval to zero",
    "Ship the exact cap into Aqua virtual balance",
    "Activate the exact Mandate StrategyV1",
  ];
  for (const [index, step] of transactionSteps.entries()) {
    await page.getByRole("button", { name: step }).click();
    const next = page.getByRole("button", {
      name: transactionSteps[index + 1] ?? "Authority active",
    });
    const receipt = page.getByRole("button", { name: "Check transaction receipt" });
    await expect
      .poll(async () => (await receipt.isVisible()) || (await next.isVisible()))
      .toBe(true);
    if (await receipt.isVisible()) await receipt.click();
    await expect(next).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Authority active" })).toBeDisabled();

  const inspect = page.getByRole("link", { name: "Inspect active authority" });
  const mandatePath = await inspect.getAttribute("href");
  expect(mandatePath).toMatch(/^\/mandates\/0x[0-9a-f]{64}$/);
  await inspect.click();
  await page.waitForURL(/\/mandates\/0x[0-9a-f]{64}$/);

  await expect(page.getByText("ACTIVE", { exact: true }).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("Total budget", { exact: true })).toBeVisible();
  await expect(page.getByText("Stop authority", { exact: true })).toBeVisible();
  await expect(page.getByText(AGENT, { exact: true }).first()).toBeVisible();

  const failingAmount = AMOUNT + 1n;
  await page.getByLabel("amountIn base units").fill(failingAmount.toString());
  await page.getByLabel("route calldata").fill(
    encodeFunctionData({
      abi: venueAbi,
      functionName: "swap",
      args: [failingAmount, failingAmount, MANDATE_APP],
    }),
  );
  await page.getByRole("button", { name: "Run exact simulation" }).click();
  await expect(page.getByText(/FAIL · DO NOT SUBMIT/)).toBeVisible();

  await page.getByLabel("amountIn base units").fill(AMOUNT.toString());
  await page.getByLabel("route calldata").fill(
    encodeFunctionData({
      abi: venueAbi,
      functionName: "swap",
      args: [AMOUNT, AMOUNT, MANDATE_APP],
    }),
  );
  await page.getByRole("button", { name: "Run exact simulation" }).click();
  await expect(page.getByText(/PASS · SIMULATION ONLY/)).toBeVisible();

  await setWalletAccount(page, AGENT);
  await page.getByRole("button", { name: "Execute from dedicated agent wallet" }).click();
  await expect(page.getByText(/SUBMITTED: 0x[0-9a-f]{64}/)).toBeVisible();
  await expect(page.getByText("CONFIRMED", { exact: true }).first()).toBeVisible({
    timeout: 10_000,
  });

  await setWalletAccount(page, OWNER);
  await page.getByRole("button", { name: "Sign" }).first().click();
  await page.getByRole("button", { name: "Sign owner stop" }).click();
  await expect(page.getByText("REVOKED", { exact: true }).first()).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Run exact simulation" }).click();
  await expect(page.getByText(/FAIL · DO NOT SUBMIT/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Execute from dedicated agent wallet" }),
  ).toBeDisabled();

  await page.setViewportSize({ width: 375, height: 812 });
  const pageScrollsSideways = await page.evaluate(() => {
    window.scrollTo({ left: document.documentElement.scrollWidth, top: window.scrollY });
    return window.scrollX > 0;
  });
  expect(pageScrollsSideways).toBe(false);
});

test("wallet rejection preserves reviewed issuance fields and keyboard access", async ({
  page,
}) => {
  await page.goto("/issue");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();

  await page.getByRole("button", { name: "Connect local owner wallet" }).click();
  await page.getByLabel("Maximum spend").fill("10");
  await page.getByLabel("Minimum output rate").fill("1");
  const expiry = await futureLocalExpiry(page);
  await page.getByLabel("Expiry").fill(expiry);

  await rejectNextTransaction(page);
  await page.getByRole("button", { name: "Approve LIN to Aqua" }).click();
  await expect(
    page.getByText("Wallet rejected. Completed steps and exact fields are preserved."),
  ).toBeVisible();
  await expect(page.getByLabel("Maximum spend")).toHaveValue("10");
  await expect(page.getByLabel("Minimum output rate")).toHaveValue("1");
  await expect(page.getByLabel("Expiry")).toHaveValue(expiry);

  for (const control of [
    page.getByRole("button", { name: "Connect local owner wallet" }),
    page.getByLabel("Maximum spend"),
    page.getByLabel("Minimum output rate"),
    page.getByLabel("Expiry"),
  ]) {
    const box = await control.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  const transitionSeconds = await page
    .getByRole("button", { name: "Connect local owner wallet" })
    .evaluate((element) => {
      const value = getComputedStyle(element).transitionDuration;
      return value.endsWith("ms") ? Number.parseFloat(value) / 1_000 : Number.parseFloat(value);
    });
  expect(transitionSeconds).toBeLessThanOrEqual(0.001);
});
