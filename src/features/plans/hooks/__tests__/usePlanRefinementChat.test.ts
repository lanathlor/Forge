import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlanRefinementChat, QUICK_ACTIONS } from '../usePlanRefinementChat';

// Mock RTK Query
const mockRefetch = vi.fn();
vi.mock('../../store/plansApi', () => ({
  useGetPlanQuery: vi.fn(() => ({
    data: { plan: { id: 'plan-1', title: 'Test Plan' } },
    refetch: mockRefetch,
  })),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('usePlanRefinementChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefetch.mockResolvedValue({});
  });

  it('should export QUICK_ACTIONS', () => {
    expect(QUICK_ACTIONS).toHaveLength(4);
    expect(QUICK_ACTIONS[0]!.label).toBe('Add detail');
    expect(QUICK_ACTIONS[1]!.label).toBe('Simplify');
    expect(QUICK_ACTIONS[2]!.label).toBe('Add tests');
    expect(QUICK_ACTIONS[3]!.label).toBe('Error handling');
  });

  it('should initialize with empty messages when not enabled', () => {
    const { result } = renderHook(() => usePlanRefinementChat('plan-1', false));
    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.totalApplied).toBe(0);
  });

  it('should add welcome message when enabled with plan data', () => {
    const { result } = renderHook(() => usePlanRefinementChat('plan-1', true));

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]!.role).toBe('assistant');
    expect(result.current.messages[0]!.content).toContain('Test Plan');
  });

  it('should manage input state', () => {
    const { result } = renderHook(() => usePlanRefinementChat('plan-1', true));

    act(() => {
      result.current.setInput('Hello');
    });
    expect(result.current.input).toBe('Hello');
  });

  it('should not send empty messages', async () => {
    const { result } = renderHook(() => usePlanRefinementChat('plan-1', true));

    await act(async () => {
      await result.current.sendMessage('');
    });

    // Only the welcome message, no user message added
    expect(result.current.messages).toHaveLength(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should not send when planId is empty', async () => {
    const { result } = renderHook(() => usePlanRefinementChat('', true));

    await act(async () => {
      await result.current.sendMessage('hello');
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should send message and add user and assistant messages', async () => {
    // Create a mock stream response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"chunk","content":"Response "}\n'));
        controller.enqueue(encoder.encode('data: {"type":"chunk","content":"text"}\n'));
        controller.close();
      },
    });

    mockFetch.mockResolvedValue({
      ok: true,
      body: stream,
    });

    const { result } = renderHook(() => usePlanRefinementChat('plan-1', true));

    await act(async () => {
      await result.current.sendMessage('Make it better');
    });

    // Should have: welcome + user + assistant messages
    expect(result.current.messages.length).toBeGreaterThanOrEqual(3);
    expect(result.current.messages[1]!.role).toBe('user');
    expect(result.current.messages[1]!.content).toBe('Make it better');
  });

  it('should handle stream error response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
    });

    const { result } = renderHook(() => usePlanRefinementChat('plan-1', true));

    await act(async () => {
      await result.current.sendMessage('Make it better');
    });

    // Error should be reflected in the last assistant message
    const lastMsg = result.current.messages[result.current.messages.length - 1];
    expect(lastMsg!.role).toBe('assistant');
    expect(lastMsg!.content).toContain('Failed to get response');
  });

  it('should handle no response body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: null,
    });

    const { result } = renderHook(() => usePlanRefinementChat('plan-1', true));

    await act(async () => {
      await result.current.sendMessage('Make it better');
    });

    const lastMsg = result.current.messages[result.current.messages.length - 1];
    expect(lastMsg!.role).toBe('assistant');
    expect(lastMsg!.content).toContain('No response body');
  });

  it('should handle proposals in stream', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"chunk","content":"Here are changes"}\n'));
        controller.enqueue(
          encoder.encode(
            'data: {"type":"proposals","changes":[{"id":1,"action":"modify_task","label":"Update task 1"}]}\n',
          ),
        );
        controller.close();
      },
    });

    mockFetch.mockResolvedValue({
      ok: true,
      body: stream,
    });

    const { result } = renderHook(() => usePlanRefinementChat('plan-1', true));

    await act(async () => {
      await result.current.sendMessage('Add more detail');
    });

    const lastMsg = result.current.messages[result.current.messages.length - 1];
    expect(lastMsg!.proposals).toHaveLength(1);
    expect(lastMsg!.proposals![0]!.status).toBe('pending');
  });

  it('should handle SSE error events in stream', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"error","message":"Something broke"}\n'));
        controller.close();
      },
    });

    mockFetch.mockResolvedValue({
      ok: true,
      body: stream,
    });

    const { result } = renderHook(() => usePlanRefinementChat('plan-1', true));

    await act(async () => {
      await result.current.sendMessage('Do something');
    });

    const lastMsg = result.current.messages[result.current.messages.length - 1];
    expect(lastMsg!.content).toContain('Something broke');
  });

  it('should set proposal status', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"chunk","content":"Changes"}\n'));
        controller.enqueue(
          encoder.encode(
            'data: {"type":"proposals","changes":[{"id":1,"action":"modify_task","label":"Update task"}]}\n',
          ),
        );
        controller.close();
      },
    });

    mockFetch.mockResolvedValue({
      ok: true,
      body: stream,
    });

    const { result } = renderHook(() => usePlanRefinementChat('plan-1', true));

    await act(async () => {
      await result.current.sendMessage('Add detail');
    });

    const msgIdx = result.current.messages.length - 1;

    act(() => {
      result.current.setProposalStatus(msgIdx, 1, 'accepted');
    });

    expect(result.current.messages[msgIdx]!.proposals![0]!.status).toBe('accepted');

    act(() => {
      result.current.setProposalStatus(msgIdx, 1, 'rejected');
    });

    expect(result.current.messages[msgIdx]!.proposals![0]!.status).toBe('rejected');
  });

  it('should apply accepted proposals', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"chunk","content":"Changes"}\n'));
        controller.enqueue(
          encoder.encode(
            'data: {"type":"proposals","changes":[{"id":1,"action":"modify_task","label":"Update task"}]}\n',
          ),
        );
        controller.close();
      },
    });

    mockFetch.mockResolvedValueOnce({ ok: true, body: stream });

    const { result } = renderHook(() => usePlanRefinementChat('plan-1', true));

    await act(async () => {
      await result.current.sendMessage('Add detail');
    });

    const msgIdx = result.current.messages.length - 1;

    act(() => {
      result.current.setProposalStatus(msgIdx, 1, 'accepted');
    });

    // Mock the apply endpoint
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ applied: 1 }),
    });

    await act(async () => {
      await result.current.applyAccepted(msgIdx);
    });

    expect(result.current.totalApplied).toBe(1);
  });

  it('should skip applyAccepted when no proposals', async () => {
    const { result } = renderHook(() => usePlanRefinementChat('plan-1', true));

    await act(async () => {
      await result.current.applyAccepted(0);
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should accept all and apply', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"chunk","content":"Changes"}\n'));
        controller.enqueue(
          encoder.encode(
            'data: {"type":"proposals","changes":[{"id":1,"action":"modify_task","label":"Task 1"},{"id":2,"action":"add_task","label":"Task 2"}]}\n',
          ),
        );
        controller.close();
      },
    });

    mockFetch.mockResolvedValueOnce({ ok: true, body: stream });

    const { result } = renderHook(() => usePlanRefinementChat('plan-1', true));

    await act(async () => {
      await result.current.sendMessage('Add detail');
    });

    const msgIdx = result.current.messages.length - 1;

    // Mock the apply endpoint
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ applied: 2 }),
    });

    await act(async () => {
      await result.current.acceptAllAndApply(msgIdx);
    });

    expect(result.current.totalApplied).toBe(2);
    const lastMsg = result.current.messages[msgIdx];
    expect(lastMsg!.content).toContain('2 changes applied');
    expect(lastMsg!.proposals).toBeUndefined();
  });

  it('should skip acceptAllAndApply when no proposals', async () => {
    const { result } = renderHook(() => usePlanRefinementChat('plan-1', true));

    await act(async () => {
      await result.current.acceptAllAndApply(0);
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should handle apply failure', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"chunk","content":"Changes"}\n'));
        controller.enqueue(
          encoder.encode(
            'data: {"type":"proposals","changes":[{"id":1,"action":"modify_task","label":"Task 1"}]}\n',
          ),
        );
        controller.close();
      },
    });

    mockFetch.mockResolvedValueOnce({ ok: true, body: stream });

    const { result } = renderHook(() => usePlanRefinementChat('plan-1', true));

    await act(async () => {
      await result.current.sendMessage('Add detail');
    });

    const msgIdx = result.current.messages.length - 1;

    act(() => {
      result.current.setProposalStatus(msgIdx, 1, 'accepted');
    });

    mockFetch.mockResolvedValueOnce({ ok: false });

    await act(async () => {
      await result.current.applyAccepted(msgIdx);
    });

    expect(result.current.totalApplied).toBe(0);
    consoleErrorSpy.mockRestore();
  });

  it('should handle acceptAllAndApply failure', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"chunk","content":"Changes"}\n'));
        controller.enqueue(
          encoder.encode(
            'data: {"type":"proposals","changes":[{"id":1,"action":"modify_task","label":"Task 1"}]}\n',
          ),
        );
        controller.close();
      },
    });

    mockFetch.mockResolvedValueOnce({ ok: true, body: stream });

    const { result } = renderHook(() => usePlanRefinementChat('plan-1', true));

    await act(async () => {
      await result.current.sendMessage('Add detail');
    });

    const msgIdx = result.current.messages.length - 1;

    mockFetch.mockResolvedValueOnce({ ok: false });

    await act(async () => {
      await result.current.acceptAllAndApply(msgIdx);
    });

    expect(result.current.totalApplied).toBe(0);
    consoleErrorSpy.mockRestore();
  });

  it('should reset chat state', () => {
    const { result } = renderHook(() => usePlanRefinementChat('plan-1', true));

    // Should have welcome message
    expect(result.current.messages.length).toBeGreaterThan(0);

    act(() => {
      result.current.resetChat();
    });

    // After reset, the useEffect re-fires and adds welcome message again since enabled + planData
    // So messages won't be empty, but input and totalApplied should be reset
    expect(result.current.input).toBe('');
    expect(result.current.totalApplied).toBe(0);
  });

  it('should clear input when sending from input state', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"chunk","content":"ok"}\n'));
        controller.close();
      },
    });

    mockFetch.mockResolvedValue({ ok: true, body: stream });

    const { result } = renderHook(() => usePlanRefinementChat('plan-1', true));

    act(() => {
      result.current.setInput('Test message');
    });

    await act(async () => {
      await result.current.sendMessage();
    });

    expect(result.current.input).toBe('');
  });

  it('should handle invalid JSON lines in SSE stream', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: not-json\n'));
        controller.enqueue(encoder.encode('data: {"type":"chunk","content":"ok"}\n'));
        controller.enqueue(encoder.encode('not a data line\n'));
        controller.close();
      },
    });

    mockFetch.mockResolvedValue({ ok: true, body: stream });

    const { result } = renderHook(() => usePlanRefinementChat('plan-1', true));

    await act(async () => {
      await result.current.sendMessage('test');
    });

    // Should not crash, last message should have content
    const lastMsg = result.current.messages[result.current.messages.length - 1];
    expect(lastMsg!.role).toBe('assistant');
    expect(lastMsg!.content).toContain('ok');
  });

  it('should strip UPDATES tags from response', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"chunk","content":"Some text <UPDATES>hidden</UPDATES> more text"}\n'));
        controller.close();
      },
    });

    mockFetch.mockResolvedValue({ ok: true, body: stream });

    const { result } = renderHook(() => usePlanRefinementChat('plan-1', true));

    await act(async () => {
      await result.current.sendMessage('test');
    });

    const lastMsg = result.current.messages[result.current.messages.length - 1];
    expect(lastMsg!.content).not.toContain('UPDATES');
    expect(lastMsg!.content).toContain('Some text');
    expect(lastMsg!.content).toContain('more text');
  });

  it('should handle non-Error exception in sendMessage', async () => {
    mockFetch.mockRejectedValue('string error');

    const { result } = renderHook(() => usePlanRefinementChat('plan-1', true));

    await act(async () => {
      await result.current.sendMessage('test');
    });

    const lastMsg = result.current.messages[result.current.messages.length - 1];
    expect(lastMsg!.content).toContain('Unknown error');
  });

  it('should skip applyAccepted when no accepted proposals', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"chunk","content":"Changes"}\n'));
        controller.enqueue(
          encoder.encode(
            'data: {"type":"proposals","changes":[{"id":1,"action":"modify_task","label":"Task 1"}]}\n',
          ),
        );
        controller.close();
      },
    });

    mockFetch.mockResolvedValueOnce({ ok: true, body: stream });

    const { result } = renderHook(() => usePlanRefinementChat('plan-1', true));

    await act(async () => {
      await result.current.sendMessage('Add detail');
    });

    const msgIdx = result.current.messages.length - 1;
    // All proposals are pending, none accepted - this should be a no-op
    const fetchCallsBefore = mockFetch.mock.calls.length;

    await act(async () => {
      await result.current.applyAccepted(msgIdx);
    });

    // No new fetch calls should have been made
    expect(mockFetch.mock.calls.length).toBe(fetchCallsBefore);
  });
});
