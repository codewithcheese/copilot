import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVSCodeClient } from "../../src/trpc/client";
import {
  createTRPCProxyClient,
  loggerLink,
  TRPCClientError,
  wsLink,
} from "@trpc/client";
import type { AppRouter } from "./app-router";
import { sleep } from "../../src/sleep";

describe("tRPC Client Integration", () => {
  let mockPostMessage: ReturnType<typeof vi.fn>;
  let client: ReturnType<typeof createTRPCProxyClient<AppRouter>>;

  beforeEach(() => {
    vi.resetAllMocks();

    // Mock VSCode API
    mockPostMessage = vi.fn();
    vi.stubGlobal(
      "acquireVsCodeApi",
      vi.fn(() => ({ postMessage: mockPostMessage }))
    );

    // Mock window
    vi.stubGlobal("window", {
      addEventListener: vi.fn((event, handler) => {
        if (event === "message") {
          // Simulate the WebSocket connection opening
          handler({ data: { type: "open" } });
        }
      }),
      removeEventListener: vi.fn(),
    });

    // Create the actual tRPC client
    client = createTRPCProxyClient<AppRouter>({
      links: [
        loggerLink({
          // enabled: (opts) => true,
        }),
        wsLink({
          client: createVSCodeClient(),
        }),
      ],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a query message", async () => {
    const queryPromise = client.hello.query({ name: "Test" });

    await sleep(10);

    // Verify that a message was posted to the VSCode API
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "message",
        data: expect.stringContaining('"method":"query"'),
      })
    );

    // Parse the sent data to verify its structure
    const sentMessage = JSON.parse(mockPostMessage.mock.calls[0]![0].data);
    expect(sentMessage).toMatchObject({
      id: expect.any(Number),
      method: "query",
      params: {
        input: { name: "Test" },
        path: "hello",
      },
    });

    // Simulate a response
    const mockResponse = {
      id: sentMessage.id,
      result: { data: "Hello, Test!" },
    };
    const messageEventListener = (
      window.addEventListener as any
    ).mock.calls.find((call: any) => call[0] === "message")[1];
    messageEventListener({
      data: { type: "message", data: JSON.stringify(mockResponse) },
    });

    const result = await queryPromise;
    expect(result).toBe("Hello, Test!");
  });

  it("handles subscription messages", async () => {
    const messages: any[] = [];
    const subscription = client.onUpdate.subscribe(
      { id: 1 },
      {
        onData: (data) => messages.push(data),
        onError: (err) => console.error(err),
      }
    );

    await sleep(10);

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "message",
        data: expect.stringContaining('"method":"subscription"'),
      })
    );

    const sentMessage = JSON.parse(mockPostMessage.mock.calls[0]![0].data);
    expect(sentMessage).toMatchObject({
      id: expect.any(Number),
      method: "subscription",
      params: {
        input: { id: 1 },
        path: "onUpdate",
      },
    });

    // Simulate multiple responses
    const mockResponses = [
      { id: sentMessage.id, result: { data: { id: 1, data: "Update 1" } } },
      { id: sentMessage.id, result: { data: { id: 1, data: "Update 2" } } },
    ];

    const messageEventListener = (
      window.addEventListener as any
    ).mock.calls.find((call: any) => call[0] === "message")[1];

    mockResponses.forEach((response) => {
      messageEventListener({
        data: { type: "message", data: JSON.stringify(response) },
      });
    });

    // Wait for the messages to be processed
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(messages).toEqual([
      { id: 1, data: "Update 1" },
      { id: 1, data: "Update 2" },
    ]);

    subscription.unsubscribe();
  });

  it("handles errors correctly", async () => {
    const queryPromise = client.getData.query({ id: 999 });

    await sleep(10);

    const sentMessage = JSON.parse(mockPostMessage.mock.calls[0]![0].data);
    const errorResponse = {
      id: sentMessage.id,
      error: { message: "Data not found", code: -32000 },
    };

    const messageEventListener = (
      window.addEventListener as any
    ).mock.calls.find((call: any) => call[0] === "message")[1];
    messageEventListener({
      data: { type: "message", data: JSON.stringify(errorResponse) },
    });

    await expect(queryPromise).rejects.toThrow(TRPCClientError);
  });

  it("sends a mutation message", async () => {
    const mutationPromise = client.updateData.mutate({
      id: 1,
      newData: "Updated",
    });

    await sleep(10);

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "message",
        data: expect.stringContaining('"method":"mutation"'),
      })
    );

    const sentMessage = JSON.parse(mockPostMessage.mock.calls[0]![0].data);
    expect(sentMessage).toMatchObject({
      id: expect.any(Number),
      method: "mutation",
      params: {
        input: { id: 1, newData: "Updated" },
        path: "updateData",
      },
    });

    const mockResponse = {
      id: sentMessage.id,
      result: { data: { id: 1, data: "Updated", updated: true } },
    };
    const messageEventListener = (
      window.addEventListener as any
    ).mock.calls.find((call: any) => call[0] === "message")[1];
    messageEventListener({
      data: { type: "message", data: JSON.stringify(mockResponse) },
    });

    const result = await mutationPromise;
    expect(result).toEqual({ id: 1, data: "Updated", updated: true });
  });

  it("handles request timeout", async () => {
    const timeoutPromise = client.getData.query(
      { id: 1 },
      { signal: AbortSignal.timeout(10) }
    );

    await expect(timeoutPromise).rejects.toThrow("This operation was aborted.");
  });
});
