import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VSCodeSocketPonyFill } from "../../src/trpc/client";

describe("VSCodeSocketPonyFill", () => {
  let socket: VSCodeSocketPonyFill;
  let mockPostMessage: ReturnType<typeof vi.fn>;
  let mockVSCode: { postMessage: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();

    // Set up mocks for each test
    mockPostMessage = vi.fn();
    mockVSCode = {
      postMessage: mockPostMessage,
    };
    vi.stubGlobal(
      "acquireVsCodeApi",
      vi.fn(() => mockVSCode)
    );

    // Mock window object
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      postMessage: vi.fn(),
    });

    // Create a new socket for each test
    socket = new VSCodeSocketPonyFill();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("initializes and adds event listener", () => {
    expect(window.addEventListener).toHaveBeenCalledWith(
      "message",
      expect.any(Function)
    );
  });

  it("sends messages using postMessage", () => {
    const testMessage = "test message";
    socket.send(testMessage);
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: "message",
      data: testMessage,
    });
  });

  it("closes the connection", () => {
    socket.close();
    expect(mockPostMessage).toHaveBeenCalledWith({ type: "close" });
    expect(window.removeEventListener).toHaveBeenCalledWith(
      "message",
      expect.any(Function)
    );
  });

  it("handles incoming messages", () => {
    const messageListener = vi.fn();
    socket.on("message", messageListener);

    const testMessage = "test data";
    const messageEvent = new MessageEvent("message", {
      data: { type: "message", data: testMessage },
    });
    (window.addEventListener as any).mock.calls[0][1](messageEvent);

    expect(messageListener).toHaveBeenCalledWith(testMessage);
  });

  it("handles error messages", () => {
    const errorListener = vi.fn();
    socket.on("error", errorListener);

    const errorMessage = "test error";
    const messageEvent = new MessageEvent("message", {
      data: { type: "error", data: errorMessage },
    });
    (window.addEventListener as any).mock.calls[0][1](messageEvent);

    expect(errorListener).toHaveBeenCalledWith(expect.any(Error));
    expect(errorListener.mock.calls[0][0].message).toBe(errorMessage);
  });

  it("handles close messages", () => {
    const closeListener = vi.fn();
    socket.once("close", closeListener);

    const closeCode = 1000;
    const messageEvent = new MessageEvent("message", {
      data: { type: "close", data: closeCode },
    });
    (window.addEventListener as any).mock.calls[0][1](messageEvent);

    expect(closeListener).toHaveBeenCalledWith(closeCode);
  });
});
