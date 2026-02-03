function SummaryList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="font-medium mb-2">{title}</h3>
      <ul className="list-disc list-inside space-y-1 text-sm">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function ImplementationSummary() {
  const completedComponents = [
    'QA Gate Runner with 3-retry logic (src/lib/qa-gates/runner.ts)',
    'Built-in gate implementations: ESLint, TypeScript, Tests',
    'API endpoints: GET /api/qa-gates, PUT /api/qa-gates/:id',
    'API endpoint: POST /api/tasks/:id/qa-gates/run',
    'API endpoint: GET /api/tasks/:id/qa-gates/results',
    'QA Gate Results UI Component (QAGateResults.tsx)',
  ];

  const keyFeatures = [
    'Automatic retry up to 3 attempts on QA gate failure',
    'Error feedback prepared for Claude re-invocation',
    'Sequential gate execution with early termination',
    'Expandable error output for failed gates',
    'Status badges and duration tracking',
    'Manual re-run and override capabilities',
  ];

  const dbSchema = [
    'qa_gate_configs: Gate configuration (name, command, timeout, order)',
    'qa_gate_results: Execution results per task',
    'tasks.currentQAAttempt: Tracks retry attempts (1-3)',
    'tasks.status: Includes qa_running, qa_failed, waiting_approval',
  ];

  return (
    <div className="pt-8 border-t">
      <h2 className="text-xl font-semibold mb-4">Implementation Summary</h2>
      <div className="bg-muted p-6 rounded-lg space-y-4">
        <SummaryList title="✅ Completed Components:" items={completedComponents} />
        <SummaryList title="🔑 Key Features:" items={keyFeatures} />
        <SummaryList title="📝 Database Schema:" items={dbSchema} />
      </div>
    </div>
  );
}
