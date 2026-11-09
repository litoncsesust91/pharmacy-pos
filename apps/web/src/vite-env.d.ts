/// <reference types="vite/client" />
interface Window {
  __posInstallPrompt?: {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };
}
