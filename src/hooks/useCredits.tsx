
import { useCredits as useCreditsHook } from "./credits";

// Re-export the hook for backward compatibility
export const useCredits = useCreditsHook;

// Re-export types for backward compatibility
export { CreditTransaction, UserCredits } from "./credits";
