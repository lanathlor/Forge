'use client';

import { AppLayout } from '../components/AppLayout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';

interface SettingItemProps {
  id: string;
  label: string;
  description: string;
  defaultChecked?: boolean;
}

function SettingItem({
  id,
  label,
  description,
  defaultChecked,
}: SettingItemProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} defaultChecked={defaultChecked} />
    </div>
  );
}

function GeneralSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>General Settings</CardTitle>
        <CardDescription>
          Manage your general application settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SettingItem
          id="notifications"
          label="Enable Notifications"
          description="Receive notifications for task updates and alerts"
        />
        <SettingItem
          id="auto-refresh"
          label="Auto Refresh"
          description="Automatically refresh data in real-time"
          defaultChecked
        />
      </CardContent>
    </Card>
  );
}

function DisplaySettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Display Settings</CardTitle>
        <CardDescription>
          Customize how information is displayed
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SettingItem
          id="compact-view"
          label="Compact View"
          description="Use a more compact layout for lists"
        />
        <SettingItem
          id="show-timestamps"
          label="Show Timestamps"
          description="Display timestamps for tasks and activities"
          defaultChecked
        />
      </CardContent>
    </Card>
  );
}

function QAGateSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>QA Gates</CardTitle>
        <CardDescription>
          Configure default QA gate settings for new repositories
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SettingItem
          id="auto-qa"
          label="Enable Auto QA Gates"
          description="Automatically run QA gates on task completion"
          defaultChecked
        />
        <SettingItem
          id="strict-mode"
          label="Strict Mode"
          description="Require all QA gates to pass before marking tasks complete"
        />
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="h-full overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="mb-6">
            <h1 className="mb-2 text-2xl font-bold">Settings</h1>
            <p className="text-muted-foreground">
              Configure your application preferences and settings.
            </p>
          </div>
          <GeneralSettings />
          <DisplaySettings />
          <QAGateSettings />
        </div>
      </div>
    </AppLayout>
  );
}
