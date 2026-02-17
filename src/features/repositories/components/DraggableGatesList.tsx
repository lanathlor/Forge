'use client';

import { useState, useRef, useCallback } from 'react';
import { QAGateCard } from './QAGateCard';
import type { QAGate, QARunStatusData } from '../types/qa-gates';

interface DraggableGatesListProps {
  gates: QAGate[];
  repositoryId: string;
  runStatus: QARunStatusData | null;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onToggle: (name: string, enabled: boolean) => void;
  onDelete: (name: string) => void;
}

export function DraggableGatesList({
  gates,
  repositoryId,
  runStatus,
  onReorder,
  onToggle,
  onDelete,
}: DraggableGatesListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    dragNodeRef.current = e.currentTarget as HTMLDivElement;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    // Make the drag image slightly transparent
    requestAnimationFrame(() => {
      if (dragNodeRef.current) {
        dragNodeRef.current.style.opacity = '0.5';
      }
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragNodeRef.current) {
      dragNodeRef.current.style.opacity = '1';
    }
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      onReorder(dragIndex, overIndex);
    }
    setDragIndex(null);
    setOverIndex(null);
    dragNodeRef.current = null;
  }, [dragIndex, overIndex, onReorder]);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverIndex(index);
  }, []);

  if (gates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/10 py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <svg
            className="h-8 w-8 text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
        </div>
        <p className="mb-1 text-base font-semibold">
          No Quality Gates Configured
        </p>
        <p className="mb-4 text-sm text-muted-foreground">
          Add gates to validate your code quality before committing
        </p>
        <p className="text-xs text-muted-foreground">
          Click &quot;Add Gate&quot; above or load a preset to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {gates.map((gate, index) => {
        const execution = runStatus?.gates.find(
          (g) => g.gateName === gate.name
        );
        const isOver = overIndex === index && dragIndex !== index;

        return (
          <div
            key={`${gate.name}-${index}`}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnter={(e) => e.preventDefault()}
            className={`transition-transform ${isOver ? 'translate-y-1 border-t-2 border-t-primary' : ''}`}
          >
            <QAGateCard
              gate={gate}
              index={index}
              execution={execution}
              repositoryId={repositoryId}
              onToggle={onToggle}
              onDelete={onDelete}
              isDragging={dragIndex === index}
              dragHandleProps={{
                onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
