// Barrel file to ensure `../lib/api` resolves consistently across build environments.
import apiExports from '../api.js';

export * from '../api.js';
export default apiExports;

