 
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { useGeneratePlanMutation } from '../store/plansApi';

interface GeneratePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repositoryId: string;
}

export function GeneratePlanDialog({
  open,
  onOpenChange,
  repositoryId,
}: GeneratePlanDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [generatePlan, { isLoading }] = useGeneratePlanMutation();

  const handleGenerate = async () => {
    if (!title.trim() || !description.trim()) return;

    try {
      await generatePlan({
        repositoryId,
        title,
        description,
      }).unwrap();

      // Reset and close
      setTitle('');
      setDescription('');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to generate plan:', error);
      alert('Failed to generate plan. Please try again.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generate Plan with Claude</DialogTitle>
          <DialogDescription>
            Describe the feature you want to build, and Claude will generate a
            detailed implementation plan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              Title
            </label>
            <Input
              id="title"
              type="text"
              placeholder="e.g., Add user authentication"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id="description"
              placeholder="Describe what you want to build in detail. Include any specific requirements, technologies, or constraints."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[200px]"
              disabled={isLoading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!title.trim() || !description.trim() || isLoading}
          >
            {isLoading ? 'Generating...' : 'Generate Plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
