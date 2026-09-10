import {
  ExecutionV1Schema,
  Hash32Schema,
  MandateSnapshotV1Schema,
  PositiveUint256StringSchema,
  ReceiptAuditV1Schema,
  RouteAssessmentRequestV1Schema,
  RouteAssessmentV1Schema,
  SimulationRequestV1Schema,
  SimulationV1Schema,
  type ExecutionV1,
  type MandateSnapshotV1,
  type ReceiptAuditV1,
  type RouteAssessmentRequestV1,
  type RouteAssessmentV1,
  type SimulationRequestV1,
  type SimulationV1,
} from "@mandate/domain";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { timeout } from "hono/timeout";

import { HTTPException } from "hono/http-exception";
const ChainPathSchema = z.object({
  chainId: PositiveUint256StringSchema,
  strategyHash: Hash32Schema,
});
const TransactionPathSchema = z.object({
  chainId: PositiveUint256StringSchema,
  txHash: Hash32Schema,
});
const ErrorSchema = z.object({
  error: z.string(),
  requestId: z.string(),
});

export interface ApiServices {
  readMandate(input: { chainId: string; strategyHash: `0x${string}` }): Promise<MandateSnapshotV1>;
  simulate(input: SimulationRequestV1): Promise<SimulationV1>;
  readExecution(input: { chainId: string; txHash: `0x${string}` }): Promise<ExecutionV1>;
  auditReceipt(input: { chainId: string; txHash: `0x${string}` }): Promise<ReceiptAuditV1>;
  assessRoute(input: RouteAssessmentRequestV1): Promise<RouteAssessmentV1>;
}

export interface ApiOptions {
  maxBodyBytes?: number;
  timeoutMs?: number;
}

export class ApiError extends Error {
  constructor(
    readonly status: 404 | 409 | 503,
    message: string,
  ) {
    super(message);
  }
}
interface ApiEnvironment {
  Variables: {
    requestId: string;
  };
}

const mandateRoute = createRoute({
  method: "get",
  path: "/v1/mandates/{chainId}/{strategyHash}",
  request: { params: ChainPathSchema },
  responses: {
    200: {
      content: { "application/json": { schema: MandateSnapshotV1Schema } },
      description: "Block-bound mandate snapshot",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Invalid request",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Mandate not found",
    },
    503: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Chain read unavailable",
    },
  },
});

const simulationRoute = createRoute({
  method: "post",
  path: "/v1/simulations",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: SimulationRequestV1Schema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: SimulationV1Schema } },
      description: "Bound execution simulation",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Invalid request",
    },
    409: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Previous simulation is stale",
    },
    503: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Chain simulation unavailable",
    },
  },
});

const executionRoute = createRoute({
  method: "get",
  path: "/v1/executions/{chainId}/{txHash}",
  request: { params: TransactionPathSchema },
  responses: {
    200: {
      content: { "application/json": { schema: ExecutionV1Schema } },
      description: "Canonical execution",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Invalid request",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Execution not found",
    },
    503: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Receipt unavailable",
    },
  },
});

const auditRoute = createRoute({
  method: "get",
  operationId: "auditMandateReceipt",
  path: "/v1/receipts/{chainId}/{txHash}/audit",
  request: { params: TransactionPathSchema },
  responses: {
    200: {
      content: { "application/json": { schema: ReceiptAuditV1Schema } },
      description: "Canonical receipt audit",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Invalid request",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Receipt not found",
    },
    503: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Audit evidence unavailable",
    },
  },
});

const routeAssessmentRoute = createRoute({
  method: "post",
  path: "/v1/routes/1inch/assess",
  operationId: "assessOneInchRoute",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: RouteAssessmentRequestV1Schema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: RouteAssessmentV1Schema } },
      description: "Fail-closed 1inch route assessment against one immutable Mandate strategy",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Invalid assessment request",
    },
    503: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Assessment unavailable",
    },
  },
});

const REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

export function createApp(services: ApiServices, options: ApiOptions = {}) {
  const app = new OpenAPIHono<ApiEnvironment>({
    defaultHook: (result, context) => {
      if (!result.success) {
        return context.json({ error: "invalid request", requestId: context.get("requestId") }, 400);
      }
    },
  });
  const maxBodyBytes = options.maxBodyBytes ?? 64 * 1024;
  const timeoutMs = options.timeoutMs ?? 10_000;

  app.use("*", async (context, next) => {
    const supplied = context.req.header("x-request-id");
    const requestId = supplied && REQUEST_ID.test(supplied) ? supplied : crypto.randomUUID();
    context.set("requestId", requestId);
    await next();
    context.header("x-request-id", requestId);
  });
  app.use("/v1/mandates/:chainId/:strategyHash", async (context, next) => {
    if (!ChainPathSchema.safeParse(context.req.param()).success) {
      return context.json({ error: "invalid request", requestId: context.get("requestId") }, 400);
    }
    await next();
  });
  app.use("/v1/executions/:chainId/:txHash", async (context, next) => {
    if (!TransactionPathSchema.safeParse(context.req.param()).success) {
      return context.json({ error: "invalid request", requestId: context.get("requestId") }, 400);
    }
    await next();
  });
  app.use("/v1/receipts/:chainId/:txHash/audit", async (context, next) => {
    if (!TransactionPathSchema.safeParse(context.req.param()).success) {
      return context.json({ error: "invalid request", requestId: context.get("requestId") }, 400);
    }
    await next();
  });
  app.use(
    "/v1/*",
    bodyLimit({
      maxSize: maxBodyBytes,
      onError: () => {
        const requestId = crypto.randomUUID();
        return Response.json(
          { error: "request body too large", requestId },
          { status: 413, headers: { "x-request-id": requestId } },
        );
      },
    }),
  );
  app.use("/v1/*", timeout(timeoutMs));

  app.openapi(mandateRoute, async (context) => {
    const input = context.req.valid("param");
    return context.json(
      await services.readMandate({
        chainId: input.chainId,
        strategyHash: input.strategyHash,
      }),
      200,
    );
  });
  app.openapi(simulationRoute, async (context) =>
    context.json(await services.simulate(context.req.valid("json")), 200),
  );
  app.openapi(executionRoute, async (context) => {
    const input = context.req.valid("param");
    return context.json(
      await services.readExecution({
        chainId: input.chainId,
        txHash: input.txHash,
      }),
      200,
    );
  });
  app.openapi(auditRoute, async (context) => {
    const input = context.req.valid("param");
    return context.json(
      await services.auditReceipt({
        chainId: input.chainId,
        txHash: input.txHash,
      }),
      200,
    );
  });
  app.openapi(routeAssessmentRoute, async (context) =>
    context.json(await services.assessRoute(context.req.valid("json")), 200),
  );

  app.doc("/openapi.json", {
    openapi: "3.1.0",
    info: { title: "Mandate API", version: "1.0.0" },
  });

  app.onError((error, context) => {
    const requestId = context.get("requestId");
    if (error instanceof ApiError) {
      return context.json({ error: error.message, requestId }, error.status);
    }
    if (error instanceof HTTPException) {
      return context.json({ error: "invalid request", requestId }, error.status);
    }
    return context.json({ error: "service unavailable", requestId }, 503);
  });

  return app;
}
