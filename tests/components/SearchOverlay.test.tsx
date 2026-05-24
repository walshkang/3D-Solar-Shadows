import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SearchOverlay from '../../src/components/SearchOverlay';

describe('SearchOverlay component tests', () => {
  const defaultProps = {
    onLocationSelect: vi.fn(),
    date: new Date(2026, 4, 24),
    onDateChange: vi.fn(),
    findSunActive: false,
    onToggleFindSun: vi.fn(),
    activeCategory: null,
    onCategoryChange: vi.fn(),
    isLoadingPlaces: false,
    mapMode: 'dark' as const,
    onMapModeChange: vi.fn(),
    showSubwaysMain: false,
    onToggleSubwaysMain: vi.fn(),
    showSubwaysMinimap: false,
    onToggleSubwaysMinimap: vi.fn(),
    showMinimap: true,
    onToggleMinimap: vi.fn()
  };

  it('renders all components and layouts', () => {
    render(<SearchOverlay {...defaultProps} />);

    // Brand logo
    expect(screen.getByText('HELIOS')).toBeInTheDocument();
    expect(screen.getByText('PRO')).toBeInTheDocument();

    // Inputs/buttons
    expect(screen.getByPlaceholderText('Search city, neighborhood...')).toBeInTheDocument();
    expect(screen.getByLabelText(/date selection/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /find sun/i })).toBeInTheDocument();

    // Map style controls
    expect(screen.getByRole('button', { name: /^dark$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^light$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^natural$/i })).toBeInTheDocument();

    // Category options
    expect(screen.getByRole('button', { name: /cafe/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rooftop/i })).toBeInTheDocument();
  });

  it('handles date input changes', () => {
    const handleDateChange = vi.fn();
    render(<SearchOverlay {...defaultProps} onDateChange={handleDateChange} />);

    const dateInput = screen.getByLabelText(/date selection/i);
    // Change date
    fireEvent.change(dateInput, { target: { value: '2026-05-25' } });
    
    expect(handleDateChange).toHaveBeenCalled();
    const newDate = handleDateChange.mock.calls[0][0] as Date;
    const expectedDate = new Date('2026-05-25');
    expectedDate.setHours(defaultProps.date.getHours(), defaultProps.date.getMinutes());
    expect(newDate.getTime()).toBe(expectedDate.getTime());
  });

  it('handles find sun and theme toggle clicks', () => {
    const handleToggleFindSun = vi.fn();
    const handleMapModeChange = vi.fn();
    
    render(
      <SearchOverlay
        {...defaultProps}
        onToggleFindSun={handleToggleFindSun}
        onMapModeChange={handleMapModeChange}
      />
    );

    // Test find sun toggle click
    const findSunBtn = screen.getByRole('button', { name: /find sun/i });
    fireEvent.click(findSunBtn);
    expect(handleToggleFindSun).toHaveBeenCalledTimes(1);

    // Test theme change click
    const lightThemeBtn = screen.getByRole('button', { name: /^light$/i });
    fireEvent.click(lightThemeBtn);
    expect(handleMapModeChange).toHaveBeenCalledWith('light');
  });

  it('handles layers toggle clicks', () => {
    const handleToggleSubwaysMain = vi.fn();
    const handleToggleMinimap = vi.fn();
    const handleToggleSubwaysMinimap = vi.fn();

    render(
      <SearchOverlay
        {...defaultProps}
        onToggleSubwaysMain={handleToggleSubwaysMain}
        onToggleMinimap={handleToggleMinimap}
        onToggleSubwaysMinimap={handleToggleSubwaysMinimap}
      />
    );

    // The toggle switches are buttons without explicit text role, let's find by content or layout
    // Actually, we can click the button using standard query selectors or finding standard elements
    const switchBtns = screen.getAllByRole('button');
    
    // Let's click the Subway Main toggle.
    // In our component, we have labels: Subway Lines (Main), Show Minimap, Subways (Minimap)
    // Clicking the toggle buttons
    const subwayMainText = screen.getByText(/subway lines \(main\)/i);
    // The button is adjacent to it
    const subwayMainBtn = subwayMainText.nextElementSibling as HTMLButtonElement;
    fireEvent.click(subwayMainBtn);
    expect(handleToggleSubwaysMain).toHaveBeenCalledTimes(1);

    const minimapText = screen.getByText(/show minimap/i);
    const minimapBtn = minimapText.nextElementSibling as HTMLButtonElement;
    fireEvent.click(minimapBtn);
    expect(handleToggleMinimap).toHaveBeenCalledTimes(1);

    const subwaysMinimapText = screen.getByText(/subways \(minimap\)/i);
    const subwaysMinimapBtn = subwaysMinimapText.nextElementSibling as HTMLButtonElement;
    fireEvent.click(subwaysMinimapBtn);
    expect(handleToggleSubwaysMinimap).toHaveBeenCalledTimes(1);
  });

  it('performs OSM location searching and returns result selections', async () => {
    const handleLocationSelect = vi.fn();
    const mockNominatimResult = [
      {
        display_name: 'Brooklyn, Kings County, New York, USA',
        lat: '40.6782',
        lon: '-73.9442'
      }
    ];

    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockNominatimResult)
      })
    );

    render(<SearchOverlay {...defaultProps} onLocationSelect={handleLocationSelect} />);

    const searchInput = screen.getByPlaceholderText('Search city, neighborhood...');
    fireEvent.change(searchInput, { target: { value: 'Brooklyn' } });
    
    const searchForm = searchInput.closest('form')!;
    fireEvent.submit(searchForm);

    expect(global.fetch).toHaveBeenCalledWith('https://nominatim.openstreetmap.org/search?format=json&q=Brooklyn&limit=5');

    // Wait for the query result to load
    await waitFor(() => {
      expect(screen.getByText('Brooklyn, Kings County, New York, USA')).toBeInTheDocument();
    });

    // Click the result item
    const resultBtn = screen.getByText('Brooklyn, Kings County, New York, USA');
    fireEvent.click(resultBtn);

    expect(handleLocationSelect).toHaveBeenCalledWith(40.6782, -73.9442);
    // Result dropdown should clear
    expect(screen.queryByText('Brooklyn, Kings County, New York, USA')).not.toBeInTheDocument();
  });

  it('triggers category changes when AI Smart Filter categories are clicked', () => {
    const handleCategoryChange = vi.fn();
    render(
      <SearchOverlay
        {...defaultProps}
        onCategoryChange={handleCategoryChange}
        activeCategory="Cafe"
      />
    );

    // "Cafe" category is active. Clicking it should toggle/clear it (pass null).
    const cafeBtn = screen.getByRole('button', { name: /cafe/i });
    fireEvent.click(cafeBtn);
    expect(handleCategoryChange).toHaveBeenCalledWith(null);

    // "Rooftop" is inactive. Clicking it should set it as active category.
    const rooftopBtn = screen.getByRole('button', { name: /rooftop/i });
    fireEvent.click(rooftopBtn);
    expect(handleCategoryChange).toHaveBeenCalledWith('Rooftop');
  });
});
