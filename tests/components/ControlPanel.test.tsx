import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ControlPanel from '../../src/components/ControlPanel';
import type { SolarData } from '../../src/lib/solar';

describe('ControlPanel component tests', () => {
  const mockSolarData: SolarData = {
    azimuth: 180.25,
    elevation: 45.5,
    goldenHourInfo: {
      start: new Date(Date.UTC(2026, 4, 24, 22, 30, 0)),
      end: new Date(Date.UTC(2026, 4, 24, 23, 15, 0))
    },
    blueHourInfo: {
      start: new Date(Date.UTC(2026, 4, 24, 23, 15, 0)),
      end: new Date(Date.UTC(2026, 4, 24, 23, 45, 0))
    },
    lightDirection: [0, 0, 1]
  };

  it('renders time, date, azimuth, and elevation metrics', () => {
    // 12:30 PM local/UTC time
    const testDate = new Date(Date.UTC(2026, 4, 24, 12, 30, 0));
    
    render(
      <ControlPanel
        date={testDate}
        onTimeChange={vi.fn()}
        solarData={mockSolarData}
        onSnapToGoldenHour={vi.fn()}
      />
    );

    // Verify azimuth and elevation are formatted correctly
    expect(screen.getByText('180.25°')).toBeInTheDocument();
    expect(screen.getByText('45.50°')).toBeInTheDocument();

    // Verify Snap button is enabled
    const snapBtn = screen.getByRole('button', { name: /snap to golden hour/i });
    expect(snapBtn).not.toBeDisabled();
  });

  it('triggers onSnapToGoldenHour when snap button clicked', () => {
    const handleSnap = vi.fn();
    render(
      <ControlPanel
        date={new Date()}
        onTimeChange={vi.fn()}
        solarData={mockSolarData}
        onSnapToGoldenHour={handleSnap}
      />
    );

    const snapBtn = screen.getByRole('button', { name: /snap to golden hour/i });
    fireEvent.click(snapBtn);
    expect(handleSnap).toHaveBeenCalledTimes(1);
  });

  it('disables the snap button if golden hour info is missing', () => {
    const dataWithoutGoldenHour: SolarData = {
      ...mockSolarData,
      goldenHourInfo: null
    };

    render(
      <ControlPanel
        date={new Date()}
        onTimeChange={vi.fn()}
        solarData={dataWithoutGoldenHour}
        onSnapToGoldenHour={vi.fn()}
      />
    );

    const snapBtn = screen.getByRole('button', { name: /snap to golden hour/i });
    expect(snapBtn).toBeDisabled();
  });

  it('triggers onTimeChange when dragging the timeline slider', () => {
    const handleTimeChange = vi.fn();
    const testDate = new Date(2026, 4, 24, 10, 0, 0); // 10:00 AM local time
    
    render(
      <ControlPanel
        date={testDate}
        onTimeChange={handleTimeChange}
        solarData={mockSolarData}
        onSnapToGoldenHour={vi.fn()}
      />
    );

    // Timeline slider goes from 0 to 1439 (minutes in a day)
    // 10:00 AM represents 10 * 60 = 600 minutes
    const slider = screen.getByRole('slider');
    expect(slider).toHaveValue('600');

    // Drag slider to 11:30 AM (11 * 60 + 30 = 690)
    fireEvent.change(slider, { target: { value: '690' } });

    expect(handleTimeChange).toHaveBeenCalledTimes(1);
    const newDateArg = handleTimeChange.mock.calls[0][0];
    expect(newDateArg.getHours()).toBe(11);
    expect(newDateArg.getMinutes()).toBe(30);
  });
});
