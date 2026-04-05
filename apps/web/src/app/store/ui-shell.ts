import { create } from 'zustand';

interface UiShellState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const useUiShellStore = create<UiShellState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => {
    set((state) => ({
      sidebarCollapsed: !state.sidebarCollapsed,
    }));
  },
}));
