import * as api from "../src/index.js";
import { expect, it } from "vitest";

it("exports no generic signing or arbitrary transaction capability", () => {
  const exported = Object.keys(api);
  expect("create" in api.PreparedExecution).toBe(false);

  expect(exported).not.toContain("signTransaction");
  expect(exported).not.toContain("sendRawTransaction");
  expect(exported).not.toContain("personal_sign");
  expect(exported).not.toContain("signMessage");
  expect(exported).not.toContain("signTypedData");
  expect(exported).not.toContain("sendTransaction");
  expect(exported).not.toContain("submitTransaction");
});
