// @vitest-environment jsdom
import React from 'react';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act, screen, cleanup } from '@testing-library/react';
import { SupportPilotProvider, useSupportPilot } from './SupportPilotContext';

// Test consumer component to capture and test state hooks and functions
const TestConsumer = () => {
  const {
    activeTab,
    setActiveTab,
    isPinned,
    setIsPinned,
    sidebarMode,
    setSidebarMode,
    auditLogs,
    handleAddAuditLog,
    isLocked,
    setIsLocked,
    secondsRemaining,
    setSecondsRemaining,
    theme,
    handleSetTheme
  } = useSupportPilot();

  return (
    <div>
      <div data-testid="active-tab">{activeTab}</div>
      <button data-testid="set-tab-btn" onClick={() => setActiveTab('settings')}>Set Settings</button>
      
      <div data-testid="sidebar-pinned">{isPinned ? 'pinned' : 'unpinned'}</div>
      <button data-testid="toggle-pin-btn" onClick={() => setIsPinned(prev => !prev)}>Toggle Pin</button>
      
      <div data-testid="sidebar-mode">{sidebarMode}</div>
      <button data-testid="set-mode-btn" onClick={() => setSidebarMode('hidden')}>Set Hidden</button>
      
      <div data-testid="theme">{theme}</div>
      <button data-testid="set-theme-btn" onClick={() => handleSetTheme('deepspace')}>Set Deep Space</button>
      
      <div data-testid="is-locked">{isLocked ? 'locked' : 'unlocked'}</div>
      <div data-testid="seconds-remaining">{secondsRemaining}</div>
      <button data-testid="trigger-timeout-btn" onClick={() => setSecondsRemaining(1)}>Trigger Timeout</button>
      
      <div data-testid="audit-log-count">{auditLogs.length}</div>
      <div data-testid="last-audit-action">{auditLogs[0]?.action}</div>
      <button data-testid="add-audit-btn" onClick={() => handleAddAuditLog(
        "Test Operator",
        "Test Action",
        "Test Module",
        "SUCCESS",
        "Test Payload"
      )}>Add Audit</button>
    </div>
  );
};

describe('SupportPilot State Management Unit Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    vi.useFakeTimers();

    // Mock matchMedia for JSDOM
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query.includes('dark'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('should initialize and synchronize sidebar preferences in LocalStorage', () => {
    render(
      <SupportPilotProvider>
        <TestConsumer />
      </SupportPilotProvider>
    );

    expect(screen.getByTestId('sidebar-pinned').textContent).toBe('pinned');
    expect(screen.getByTestId('sidebar-mode').textContent).toBe('slim');

    // Toggle pin preference
    act(() => {
      screen.getByTestId('toggle-pin-btn').click();
    });
    expect(screen.getByTestId('sidebar-pinned').textContent).toBe('unpinned');
    expect(localStorage.getItem('supportpilot_sidebar_pinned')).toBe('false');

    // Change sidebar layout mode
    act(() => {
      screen.getByTestId('set-mode-btn').click();
    });
    expect(screen.getByTestId('sidebar-mode').textContent).toBe('hidden');
    expect(localStorage.getItem('supportpilot_sidebar_mode')).toBe('hidden');
  });

  test('should record and append immutable audit log entries correctly', () => {
    render(
      <SupportPilotProvider>
        <TestConsumer />
      </SupportPilotProvider>
    );

    const initialCount = parseInt(screen.getByTestId('audit-log-count').textContent || '0');

    act(() => {
      screen.getByTestId('add-audit-btn').click();
    });

    expect(screen.getByTestId('audit-log-count').textContent).toBe((initialCount + 1).toString());
    expect(screen.getByTestId('last-audit-action').textContent).toBe('Test Action');
  });

  test('should lock the session automatically on inactivity timeout and reset on active event triggers', () => {
    render(
      <SupportPilotProvider>
        <TestConsumer />
      </SupportPilotProvider>
    );

    expect(screen.getByTestId('is-locked').textContent).toBe('unlocked');
    expect(screen.getByTestId('seconds-remaining').textContent).toBe('900');

    // Advance clocks by 10 seconds
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByTestId('seconds-remaining').textContent).toBe('890');

    // Simulate active mouse interaction event
    act(() => {
      window.dispatchEvent(new Event('mousemove'));
    });
    expect(screen.getByTestId('seconds-remaining').textContent).toBe('900');

    // Advance clocks by the full 900 seconds (15 minutes) to trigger idle auto-lock naturally
    act(() => {
      vi.advanceTimersByTime(900000);
    });
    expect(screen.getByTestId('is-locked').textContent).toBe('locked');
  });

  test('should handle theme changes, persist selection, and modify Document DOM classes', () => {
    render(
      <SupportPilotProvider>
        <TestConsumer />
      </SupportPilotProvider>
    );

    expect(screen.getByTestId('theme').textContent).toBe('slate');

    act(() => {
      screen.getByTestId('set-theme-btn').click();
    });

    expect(screen.getByTestId('theme').textContent).toBe('deepspace');
    expect(localStorage.getItem('supportpilot_theme')).toBe('deepspace');
    expect(document.documentElement.classList.contains('theme-deepspace')).toBe(true);
  });
});
