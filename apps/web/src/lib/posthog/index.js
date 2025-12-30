// Barrel file to ensure "../lib/posthog" resolves reliably in all build environments.
import posthogExports from '../posthog.js';

export * from '../posthog.js';
export default posthogExports;

