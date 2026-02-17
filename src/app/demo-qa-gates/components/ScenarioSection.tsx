import { QAGateResults } from '@/features/qa-gates/components/QAGateResults';

interface ScenarioSectionProps {
  title: string;
  taskId: string;
  attempt: number;
  maxAttempts: number;
}

export function ScenarioSection({
  title,
  taskId,
  attempt,
  maxAttempts,
}: ScenarioSectionProps) {
  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">{title}</h2>
      <QAGateResults
        taskId={taskId}
        attempt={attempt}
        maxAttempts={maxAttempts}
      />
    </div>
  );
}
