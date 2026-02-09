import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogOverlay,
  DialogPortal,
} from '../dialog';

describe('Dialog Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Dialog', () => {
    it('renders closed by default', () => {
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Test Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('opens when trigger is clicked', async () => {
      const user = userEvent.setup();
      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Test Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByText('Open'));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('renders when open prop is true', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Test Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('does not render when open prop is false', () => {
      render(
        <Dialog open={false}>
          <DialogContent>
            <DialogTitle>Test Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('calls onOpenChange when state changes', async () => {
      const handleOpenChange = vi.fn();
      const user = userEvent.setup();

      render(
        <Dialog onOpenChange={handleOpenChange}>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Test Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByText('Open'));

      expect(handleOpenChange).toHaveBeenCalledWith(true);
    });
  });

  describe('DialogTrigger', () => {
    it('renders as button by default', () => {
      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogTitle>Test</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByRole('button', { name: 'Open Dialog' })).toBeInTheDocument();
    });

    it('renders children when asChild is true', () => {
      render(
        <Dialog>
          <DialogTrigger asChild>
            <a href="#test">Open Link</a>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Test</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      const link = screen.getByText('Open Link');
      expect(link.tagName).toBe('A');
    });
  });

  describe('DialogContent', () => {
    it('renders children', async () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Dialog Title</DialogTitle>
            <p>Dialog content text</p>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByText('Dialog Title')).toBeInTheDocument();
      expect(screen.getByText('Dialog content text')).toBeInTheDocument();
    });

    it('renders close button', async () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Test</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    it('applies custom className', async () => {
      render(
        <Dialog open={true}>
          <DialogContent className="custom-class">
            <DialogTitle>Test</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog.className).toContain('custom-class');
    });

    it('forwards ref', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(
        <Dialog open={true}>
          <DialogContent ref={ref}>
            <DialogTitle>Test</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      expect(ref.current).not.toBeNull();
    });
  });

  describe('DialogHeader', () => {
    it('renders children', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Header Title</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByText('Header Title')).toBeInTheDocument();
    });

    it('has correct display name', () => {
      expect(DialogHeader.displayName).toBe('DialogHeader');
    });
  });

  describe('DialogFooter', () => {
    it('renders children', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Test</DialogTitle>
            <DialogFooter>
              <button>Cancel</button>
              <button>Save</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('has correct display name', () => {
      expect(DialogFooter.displayName).toBe('DialogFooter');
    });
  });

  describe('DialogTitle', () => {
    it('renders text content', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>My Dialog Title</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByText('My Dialog Title')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle className="custom-title">Test</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      const title = screen.getByText('Test');
      expect(title.className).toContain('custom-title');
    });

    it('forwards ref', () => {
      const ref = React.createRef<HTMLHeadingElement>();
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle ref={ref}>Test</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      expect(ref.current).not.toBeNull();
    });
  });

  describe('DialogDescription', () => {
    it('renders text content', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <DialogDescription>This is a description</DialogDescription>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByText('This is a description')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <DialogDescription className="custom-desc">Description</DialogDescription>
          </DialogContent>
        </Dialog>
      );

      const desc = screen.getByText('Description');
      expect(desc.className).toContain('custom-desc');
    });

    it('forwards ref', () => {
      const ref = React.createRef<HTMLParagraphElement>();
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
            <DialogDescription ref={ref}>Test</DialogDescription>
          </DialogContent>
        </Dialog>
      );

      expect(ref.current).not.toBeNull();
    });
  });

  describe('DialogClose', () => {
    it('closes dialog when clicked', async () => {
      const handleOpenChange = vi.fn();
      const user = userEvent.setup();

      render(
        <Dialog open={true} onOpenChange={handleOpenChange}>
          <DialogContent>
            <DialogTitle>Test</DialogTitle>
            <DialogClose>Close Me</DialogClose>
          </DialogContent>
        </Dialog>
      );

      await user.click(screen.getByText('Close Me'));

      expect(handleOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Accessibility', () => {
    it('has accessible dialog role', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Accessible Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('close button has sr-only text', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Test</DialogTitle>
          </DialogContent>
        </Dialog>
      );

      const srText = screen.getByText('Close');
      expect(srText.className).toContain('sr-only');
    });
  });

  describe('Component Integration', () => {
    it('renders complete dialog with all components', async () => {
      const user = userEvent.setup();
      const handleSave = vi.fn();

      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
              <DialogDescription>
                Make changes to your profile here.
              </DialogDescription>
            </DialogHeader>
            <div>
              <input placeholder="Name" />
            </div>
            <DialogFooter>
              <DialogClose>Cancel</DialogClose>
              <button onClick={handleSave}>Save changes</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );

      // Open dialog
      await user.click(screen.getByText('Open Dialog'));

      // Verify all parts render
      await waitFor(() => {
        expect(screen.getByText('Edit Profile')).toBeInTheDocument();
        expect(screen.getByText('Make changes to your profile here.')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
        expect(screen.getByText('Save changes')).toBeInTheDocument();
      });

      // Click save
      await user.click(screen.getByText('Save changes'));
      expect(handleSave).toHaveBeenCalled();
    });
  });

  describe('Exports', () => {
    it('exports all required components', () => {
      expect(Dialog).toBeDefined();
      expect(DialogTrigger).toBeDefined();
      expect(DialogContent).toBeDefined();
      expect(DialogHeader).toBeDefined();
      expect(DialogFooter).toBeDefined();
      expect(DialogTitle).toBeDefined();
      expect(DialogDescription).toBeDefined();
      expect(DialogClose).toBeDefined();
      expect(DialogOverlay).toBeDefined();
      expect(DialogPortal).toBeDefined();
    });
  });
});
