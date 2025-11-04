"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  value?: [number, number];
  defaultValue?: [number, number];
  onValueChange?: (value: [number, number]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

/**
 * Range slider component for price filters
 * Supports dual-range (min/max) values
 */
export function Slider({
  value,
  defaultValue = [0, 1000],
  onValueChange,
  min = 0,
  max = 10000,
  step = 1,
  className,
  ...props
}: SliderProps) {
  const [internalValue, setInternalValue] = React.useState<[number, number]>(
    value || defaultValue
  );
  const minValue = value ? value[0] : internalValue[0];
  const maxValue = value ? value[1] : internalValue[1];

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMin = Number.parseFloat(e.target.value);
    const newValue: [number, number] = [Math.min(newMin, maxValue), maxValue];
    if (value === undefined) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMax = Number.parseFloat(e.target.value);
    const newValue: [number, number] = [minValue, Math.max(newMax, minValue)];
    if (value === undefined) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  };

  const minPercent = ((minValue - min) / (max - min)) * 100;
  const maxPercent = ((maxValue - min) / (max - min)) * 100;

  return (
    <div className={cn("relative w-full", className)} {...props}>
      {/* Track */}
      <div className="relative h-2 w-full rounded-full bg-muted">
        {/* Active range */}
        <div
          className="absolute h-2 rounded-full bg-primary"
          style={{
            left: `${minPercent}%`,
            width: `${maxPercent - minPercent}%`,
          }}
        />
      </div>

      {/* Min input */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={minValue}
        onChange={handleMinChange}
        className="absolute top-0 h-2 w-full cursor-pointer appearance-none bg-transparent opacity-0"
        style={{
          zIndex: minValue > maxValue - (max - min) / 10 ? 3 : 2,
        }}
      />

      {/* Max input */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={maxValue}
        onChange={handleMaxChange}
        className="absolute top-0 h-2 w-full cursor-pointer appearance-none bg-transparent opacity-0"
        style={{
          zIndex: 2,
        }}
      />

      {/* Thumb indicators (visual only, interaction via inputs) */}
      <div
        className="pointer-events-none absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-primary bg-background shadow-sm"
        style={{
          left: `${minPercent}%`,
        }}
      />
      <div
        className="pointer-events-none absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-primary bg-background shadow-sm"
        style={{
          left: `${maxPercent}%`,
        }}
      />
    </div>
  );
}

