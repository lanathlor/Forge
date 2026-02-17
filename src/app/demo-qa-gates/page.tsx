import { ScenarioSection } from './components/ScenarioSection';
import { ImplementationSummary } from './components/ImplementationSummary';

export default function DemoQAGatesPage() {
  return (
    <div className="container mx-auto p-4 lg:p-8">
      <div className="space-y-6">
        <div>
          <h1 className="mb-2 text-3xl font-bold">QA Gate Results Demo</h1>
          <p className="text-muted-foreground">
            Demonstrating the QA gate results component with mock data
          </p>
        </div>

        <div className="space-y-6">
          <ScenarioSection
            title="Scenario 1: All Passed"
            taskId="demo-task-1"
            attempt={1}
            maxAttempts={3}
          />
          <ScenarioSection
            title="Scenario 2: Failed (Attempt 2/3)"
            taskId="demo-task-2"
            attempt={2}
            maxAttempts={3}
          />
          <ScenarioSection
            title="Scenario 3: Max Retries Reached"
            taskId="demo-task-3"
            attempt={3}
            maxAttempts={3}
          />
        </div>

        <ImplementationSummary />
      </div>
    </div>
  );
}
