import { describe, it, expect } from 'vitest';
import {
  tasksApi,
  useGetTaskQuery,
  useGetTaskQAResultsQuery,
  useCreateTaskMutation,
  useRunTaskQAGatesMutation,
  useApproveTaskMutation,
  useRejectTaskMutation,
  useRetryTaskMutation,
  useCancelTaskMutation,
} from '../tasksApi';

describe('tasksApi', () => {
  it('should export tasksApi object', () => {
    expect(tasksApi).toBeDefined();
    expect(typeof tasksApi).toBe('object');
  });

  it('should export useGetTaskQuery hook', () => {
    expect(useGetTaskQuery).toBeDefined();
    expect(typeof useGetTaskQuery).toBe('function');
  });

  it('should export useGetTaskQAResultsQuery hook', () => {
    expect(useGetTaskQAResultsQuery).toBeDefined();
    expect(typeof useGetTaskQAResultsQuery).toBe('function');
  });

  it('should export useCreateTaskMutation hook', () => {
    expect(useCreateTaskMutation).toBeDefined();
    expect(typeof useCreateTaskMutation).toBe('function');
  });

  it('should export useRunTaskQAGatesMutation hook', () => {
    expect(useRunTaskQAGatesMutation).toBeDefined();
    expect(typeof useRunTaskQAGatesMutation).toBe('function');
  });

  it('should export useApproveTaskMutation hook', () => {
    expect(useApproveTaskMutation).toBeDefined();
    expect(typeof useApproveTaskMutation).toBe('function');
  });

  it('should export useRejectTaskMutation hook', () => {
    expect(useRejectTaskMutation).toBeDefined();
    expect(typeof useRejectTaskMutation).toBe('function');
  });

  it('should export useRetryTaskMutation hook', () => {
    expect(useRetryTaskMutation).toBeDefined();
    expect(typeof useRetryTaskMutation).toBe('function');
  });

  it('should export useCancelTaskMutation hook', () => {
    expect(useCancelTaskMutation).toBeDefined();
    expect(typeof useCancelTaskMutation).toBe('function');
  });

  it('should have endpoints defined on tasksApi', () => {
    expect(tasksApi.endpoints).toBeDefined();
    expect(tasksApi.endpoints.getTask).toBeDefined();
    expect(tasksApi.endpoints.getTaskQAResults).toBeDefined();
    expect(tasksApi.endpoints.createTask).toBeDefined();
    expect(tasksApi.endpoints.runTaskQAGates).toBeDefined();
  });

  it('should have util methods on tasksApi', () => {
    expect(typeof tasksApi.util.updateQueryData).toBe('function');
    expect(typeof tasksApi.util.prefetch).toBe('function');
  });
});
