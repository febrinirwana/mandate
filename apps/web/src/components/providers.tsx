"use client";

import { PrivyProvider, type PrivyClientConfig } from "@privy-io/react-auth";
import { SmartWalletsProvider } from "@privy-io/react-auth/smart-wallets";
import type { ReactNode } from "react";
import { sepolia } from "viem/chains";
import { StyleSheetManager } from "styled-components";

export const PRIVY_CONFIG = {
  defaultChain: sepolia,
  supportedChains: [sepolia],
  loginMethods: ["email", "wallet"],
  embeddedWallets: { ethereum: { createOnLogin: "all-users" } },
} satisfies PrivyClientConfig;

function shouldForwardPrivyProp(prop: string, target: unknown): boolean {
  return typeof target !== "string" || (prop !== "isActive" && prop !== "isactive");
}

export function MandateProviders({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) return children;

  return (
    <StyleSheetManager shouldForwardProp={shouldForwardPrivyProp}>
      <PrivyProvider appId={appId} config={PRIVY_CONFIG}>
        <SmartWalletsProvider>{children}</SmartWalletsProvider>
      </PrivyProvider>
    </StyleSheetManager>
  );
}
