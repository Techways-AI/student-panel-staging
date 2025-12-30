// Barrel file to ensure "../lib/posthog" resolves reliably.
import posthogExports from '../posthog';

export * from '../posthog';
export default posthogExports;

