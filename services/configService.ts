
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
      let current: SystemConfig = DEFAULT_CONFIG;
      try {
          const localStr = localStorage.getItem('geko_system_config');
          if (localStr) current = JSON.parse(localStr);
      } catch (e) {}
      
      callback(current);

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
    let current = DEFAULT_CONFIG;
    try {
        const currentStr = localStorage.getItem('geko_system_config');
        if (currentStr) current = JSON.parse(currentStr);
    } catch (e) {}
    
    const merged = { ...current, ...newConfig };

    try {
        localStorage.setItem('geko_system_config', JSON.stringify(merged));
    } catch (e) {}
    
    window.dispatchEvent(new CustomEvent('geko-config-update', { detail: merged }));
  }
};
