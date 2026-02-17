'use client';

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/shared/components/ui/card';
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import {
  type StuckDetectionConfig,
  DEFAULT_STUCK_CONFIG,
  StuckDetectionConfigSchema,
} from '@/lib/stuck-detection/types';
import { useStuckDetectionConfig } from '@/shared/hooks/useStuckDetectionConfig';
import {
  Settings,
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  Gauge,
  Timer,
  AlertTriangle,
  ShieldAlert,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

/* ============================================
   TYPES & INTERFACES
   ============================================ */

export interface StuckDetectionSettingsProps {
  /** Initial configuration */
  initialConfig?: Partial<StuckDetectionConfig>;
  /** Callback when settings are saved */
  onSave?: (config: StuckDetectionConfig) => void;
  /** Additional class name */
  className?: string;
}

/* ============================================
   SLIDER COMPONENT
   ============================================ */

interface SliderInputProps {
  label: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  icon?: React.ReactNode;
}

const SLIDER_CLASS = cn(
  'flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer',
  '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4',
  '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer',
  '[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full',
  '[&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer'
);

function SliderHeader({
  label,
  value,
  unit,
  icon,
}: {
  label: string;
  value: number;
  unit: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <Label className="text-sm font-medium">{label}</Label>
      </div>
      <span className="font-mono text-sm text-muted-foreground">
        {value}
        {unit}
      </span>
    </div>
  );
}

function SliderInput({
  label,
  description,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = '',
  icon,
}: SliderInputProps) {
  return (
    <div className="space-y-2">
      <SliderHeader label={label} value={value} unit={unit} icon={icon} />
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={SLIDER_CLASS}
        />
        <Input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-8 w-20 text-sm"
        />
      </div>
    </div>
  );
}

/* ============================================
   TOGGLE COMPONENT
   ============================================ */

interface ToggleInputProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  enabledIcon?: React.ReactNode;
  disabledIcon?: React.ReactNode;
}

function ToggleInput({
  label,
  description,
  value,
  onChange,
  enabledIcon,
  disabledIcon,
}: ToggleInputProps) {
  return (
    <div
      className={cn(
        'flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors',
        value ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30'
      )}
      onClick={() => onChange(!value)}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg',
            value
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {value ? enabledIcon : disabledIcon}
        </div>
        <div>
          <p className="text-sm font-medium">{label}</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      <div
        className={cn(
          'relative h-6 w-10 rounded-full transition-colors',
          value ? 'bg-primary' : 'bg-muted'
        )}
      >
        <div
          className={cn(
            'absolute top-1 h-4 w-4 rounded-full bg-white transition-transform',
            value ? 'translate-x-5' : 'translate-x-1'
          )}
        />
      </div>
    </div>
  );
}

/* ============================================
   SENSITIVITY SELECTOR
   ============================================ */

interface SensitivitySelectorProps {
  value: 'low' | 'medium' | 'high';
  onChange: (value: 'low' | 'medium' | 'high') => void;
}

function SensitivitySelector({ value, onChange }: SensitivitySelectorProps) {
  const options: Array<{
    value: 'low' | 'medium' | 'high';
    label: string;
    description: string;
  }> = [
    {
      value: 'low',
      label: 'Relaxed',
      description: 'Longer thresholds, fewer alerts',
    },
    { value: 'medium', label: 'Balanced', description: 'Default sensitivity' },
    {
      value: 'high',
      label: 'Sensitive',
      description: 'Shorter thresholds, more alerts',
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Gauge className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Sensitivity Level</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Controls how quickly stuck conditions are detected
      </p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex flex-col items-center rounded-lg border p-3 text-center transition-all',
              value === option.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-muted/30 hover:border-primary/50'
            )}
          >
            <span className="text-sm font-medium">{option.label}</span>
            <span className="mt-1 text-[10px] text-muted-foreground">
              {option.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ============================================
   MAIN COMPONENT HOOKS & HELPERS
   ============================================ */

function useSettingsConfig(
  initialConfig?: Partial<StuckDetectionConfig>,
  serverConfig?: StuckDetectionConfig | null
) {
  const [config, setConfig] = useState<StuckDetectionConfig>({
    ...DEFAULT_STUCK_CONFIG,
    ...initialConfig,
  });
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (serverConfig) setConfig(serverConfig);
  }, [serverConfig]);
  useEffect(() => {
    const initial = serverConfig || {
      ...DEFAULT_STUCK_CONFIG,
      ...initialConfig,
    };
    setHasChanges(JSON.stringify(config) !== JSON.stringify(initial));
  }, [config, serverConfig, initialConfig]);

  const updateConfig = useCallback(
    <K extends keyof StuckDetectionConfig>(
      key: K,
      value: StuckDetectionConfig[K]
    ) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  return { config, hasChanges, setHasChanges, updateConfig };
}

function SettingsHeader({
  isExpanded,
  onToggle,
}: {
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="flex cursor-pointer items-center justify-between"
      onClick={onToggle}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
          <Settings className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <CardTitle className="text-sm">Stuck Detection Settings</CardTitle>
          <CardDescription className="text-xs">
            Configure alert thresholds and notifications
          </CardDescription>
        </div>
      </div>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

function ThresholdsSection({
  config,
  updateConfig,
}: {
  config: StuckDetectionConfig;
  updateConfig: <K extends keyof StuckDetectionConfig>(
    key: K,
    value: StuckDetectionConfig[K]
  ) => void;
}) {
  return (
    <div className="space-y-4">
      <h4 className="flex items-center gap-2 text-sm font-medium">
        <Timer className="h-4 w-4 text-muted-foreground" />
        Thresholds
      </h4>
      <SliderInput
        label="No Output Threshold"
        description="Seconds without output before alerting"
        value={config.noOutputThresholdSeconds}
        onChange={(v) => updateConfig('noOutputThresholdSeconds', v)}
        min={10}
        max={300}
        step={5}
        unit="s"
      />
      <SliderInput
        label="Waiting Input Threshold"
        description="Seconds waiting for approval before alerting"
        value={config.waitingInputThresholdSeconds}
        onChange={(v) => updateConfig('waitingInputThresholdSeconds', v)}
        min={10}
        max={300}
        step={5}
        unit="s"
      />
      <SliderInput
        label="Repeated Failure Count"
        description="Consecutive failures before alerting"
        value={config.repeatedFailureCount}
        onChange={(v) => updateConfig('repeatedFailureCount', v)}
        min={1}
        max={10}
        icon={<ShieldAlert className="h-4 w-4 text-muted-foreground" />}
      />
    </div>
  );
}

function NotificationsSection({
  config,
  updateConfig,
}: {
  config: StuckDetectionConfig;
  updateConfig: <K extends keyof StuckDetectionConfig>(
    key: K,
    value: StuckDetectionConfig[K]
  ) => void;
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Notifications</h4>
      <ToggleInput
        label="Toast Notifications"
        description="Show popup alerts when stuck"
        value={config.enableToastNotifications}
        onChange={(v) => updateConfig('enableToastNotifications', v)}
        enabledIcon={<Bell className="h-4 w-4" />}
        disabledIcon={<BellOff className="h-4 w-4" />}
      />
      <ToggleInput
        label="Sound Alerts"
        description="Play sound for critical alerts"
        value={config.enableSoundAlerts}
        onChange={(v) => updateConfig('enableSoundAlerts', v)}
        enabledIcon={<Volume2 className="h-4 w-4" />}
        disabledIcon={<VolumeX className="h-4 w-4" />}
      />
    </div>
  );
}

function SettingsActions({
  hasChanges,
  isSaving,
  onReset,
  onSave,
}: {
  hasChanges: boolean;
  isSaving: boolean;
  onReset: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2 border-t pt-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={onReset}
        disabled={!hasChanges || isSaving}
      >
        <RotateCcw className={cn('mr-1 h-3 w-3', isSaving && 'animate-spin')} />
        Reset
      </Button>
      <Button size="sm" onClick={onSave} disabled={!hasChanges || isSaving}>
        <Save className="mr-1 h-3 w-3" />
        {isSaving ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  );
}

/* ============================================
   MAIN COMPONENT
   ============================================ */

export function StuckDetectionSettings({
  initialConfig,
  onSave,
  className,
}: StuckDetectionSettingsProps) {
  const {
    config: serverConfig,
    loading: _configLoading,
    updateConfig: saveToServer,
    resetConfig: resetOnServer,
  } = useStuckDetectionConfig();
  const { config, hasChanges, setHasChanges, updateConfig } = useSettingsConfig(
    initialConfig,
    serverConfig
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);
      const validated = StuckDetectionConfigSchema.parse(config);
      if (await saveToServer(validated)) {
        onSave?.(validated);
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Invalid configuration:', error);
    } finally {
      setIsSaving(false);
    }
  }, [config, saveToServer, onSave, setHasChanges]);

  const handleReset = useCallback(async () => {
    setIsSaving(true);
    if (await resetOnServer()) setHasChanges(false);
    setIsSaving(false);
  }, [resetOnServer, setHasChanges]);

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <SettingsHeader
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
        />
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-6">
          <ToggleInput
            label="Enable Stuck Detection"
            description="Monitor repositories for stuck conditions"
            value={config.enabled}
            onChange={(v) => updateConfig('enabled', v)}
            enabledIcon={<AlertTriangle className="h-4 w-4" />}
            disabledIcon={<AlertTriangle className="h-4 w-4" />}
          />
          {config.enabled && (
            <>
              <SensitivitySelector
                value={config.sensitivityLevel}
                onChange={(v) => updateConfig('sensitivityLevel', v)}
              />
              <ThresholdsSection config={config} updateConfig={updateConfig} />
              <NotificationsSection
                config={config}
                updateConfig={updateConfig}
              />
            </>
          )}
          <SettingsActions
            hasChanges={hasChanges}
            isSaving={isSaving}
            onReset={handleReset}
            onSave={handleSave}
          />
        </CardContent>
      )}
    </Card>
  );
}

export default StuckDetectionSettings;
