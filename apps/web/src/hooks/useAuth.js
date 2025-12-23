import { useAuth as useAuthContext } from '../context/AuthContext';

// Thin wrapper that delegates to the AuthContext-based useAuth.
// This keeps imports working while ensuring all auth logic uses the new flow.
export const useAuth = () => {
  return useAuthContext();
};

export default useAuth;

