
export interface SystemConfig {
  depositAddress: string;
  maintenanceMode: boolean;
}

// Default fallback
const DEFAULT_CONFIG: SystemConfig = {
  depositAddress: "6HmBxJuv9f5P92am6AK18KZGkHGqbNUazYXXKhvrDviw",
  maintenanceMode: false
};

export const configService = {
  // Subscribe to real-time config changes
  subscribe: (callback: (config: SystemConfig) => void) => {
      // Local Mode: Listen to LocalStorage events
      const localStr = localStorage.getItem('geko_system_config');
      callback(localStr ? JSON.parse(localStr) : DEFAULT_CONFIG);

      const handleStorage = (e: any) => {
          if (e.type === 'geko-config-update') {
              callback(e.detail);
          }
      };
      window.addEventListener('geko-config-update', handleStorage);
      return () => window.removeEventListener('geko-config-update', handleStorage);
  },

  // Update configuration
  update: async (newConfig: Partial<SystemConfig>) => {
    const currentStr = localStorage.getItem('geko_system_config');
    const current = currentStr ? JSON.parse(currentStr) : DEFAULT_CONFIG;
    const merged = { ...current, ...newConfig };

    // Always update local cache for immediate UI feedback
    localStorage.setItem('geko_system_config', JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent('geko-config-update', { detail: merged }));
  }
};
