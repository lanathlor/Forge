import { describe, it, expect } from 'vitest';
import {
  plansApi,
  type PlanWithDetails,
  type GeneratePlanRequest,
  type CreatePlanRequest,
  type UpdatePlanRequest,
  type ReviewPlanRequest,
  type ReviewResult,
  type ApplySuggestionsRequest,
} from '../plansApi';

describe('plansApi', () => {
  describe('endpoints', () => {
    it('should have getPlans endpoint', () => {
      expect(plansApi.endpoints.getPlans).toBeDefined();
    });

    it('should have getPlan endpoint', () => {
      expect(plansApi.endpoints.getPlan).toBeDefined();
    });

    it('should have createPlan endpoint', () => {
      expect(plansApi.endpoints.createPlan).toBeDefined();
    });

    it('should have generatePlan endpoint', () => {
      expect(plansApi.endpoints.generatePlan).toBeDefined();
    });

    it('should have updatePlan endpoint', () => {
      expect(plansApi.endpoints.updatePlan).toBeDefined();
    });

    it('should have deletePlan endpoint', () => {
      expect(plansApi.endpoints.deletePlan).toBeDefined();
    });

    it('should have reviewPlan endpoint', () => {
      expect(plansApi.endpoints.reviewPlan).toBeDefined();
    });

    it('should have applySuggestions endpoint', () => {
      expect(plansApi.endpoints.applySuggestions).toBeDefined();
    });

    it('should have executePlan endpoint', () => {
      expect(plansApi.endpoints.executePlan).toBeDefined();
    });

    it('should have pausePlan endpoint', () => {
      expect(plansApi.endpoints.pausePlan).toBeDefined();
    });

    it('should have resumePlan endpoint', () => {
      expect(plansApi.endpoints.resumePlan).toBeDefined();
    });

    it('should have cancelPlan endpoint', () => {
      expect(plansApi.endpoints.cancelPlan).toBeDefined();
    });

    it('should have phase management endpoints', () => {
      expect(plansApi.endpoints.createPhase).toBeDefined();
      expect(plansApi.endpoints.updatePhase).toBeDefined();
      expect(plansApi.endpoints.deletePhase).toBeDefined();
    });

    it('should have task management endpoints', () => {
      expect(plansApi.endpoints.createPlanTask).toBeDefined();
      expect(plansApi.endpoints.updatePlanTask).toBeDefined();
      expect(plansApi.endpoints.deletePlanTask).toBeDefined();
    });
  });

  describe('types', () => {
    it('should support PlanWithDetails type', () => {
      const planWithDetails: PlanWithDetails = {
        plan: {
          id: 'plan-1',
          repositoryId: 'repo-1',
          title: 'Test Plan',
          description: 'Test',
          status: 'draft',
          totalPhases: 1,
          totalTasks: 2,
          completedTasks: 0,
          completedPhases: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          startedAt: null,
          startingCommit: null,
          completedAt: null,
          createdBy: 'user',
          sourceFile: null,
          currentPhaseId: null,
          currentTaskId: null,
        },
        phases: [],
        tasks: [],
        iterations: [],
      };
      expect(planWithDetails).toBeDefined();
    });

    it('should support GeneratePlanRequest type', () => {
      const request: GeneratePlanRequest = {
        repositoryId: 'repo-1',
        title: 'Test Plan',
        description: 'Build something',
      };
      expect(request.repositoryId).toBe('repo-1');
    });

    it('should support CreatePlanRequest type', () => {
      const request: CreatePlanRequest = {
        repositoryId: 'repo-1',
        title: 'Test Plan',
        description: 'Optional description',
      };
      expect(request.title).toBe('Test Plan');
    });

    it('should support UpdatePlanRequest type', () => {
      const request: UpdatePlanRequest = {
        title: 'Updated Title',
        status: 'ready',
      };
      expect(request.title).toBe('Updated Title');
    });

    it('should support ReviewPlanRequest type', () => {
      const request: ReviewPlanRequest = {
        reviewType: 'refine_descriptions',
        scope: 'all',
      };
      expect(request.reviewType).toBe('refine_descriptions');
    });

    it('should support ReviewResult type', () => {
      const result: ReviewResult = {
        iterationId: 'iter-1',
        suggestions: [
          { type: 'add', target: 'test', reasoning: 'test reason' },
        ],
      };
      expect(result.iterationId).toBe('iter-1');
    });

    it('should support ApplySuggestionsRequest type', () => {
      const request: ApplySuggestionsRequest = {
        iterationId: 'iter-1',
        suggestionIndices: [0, 1, 2],
      };
      expect(request.suggestionIndices.length).toBe(3);
    });
  });
});
