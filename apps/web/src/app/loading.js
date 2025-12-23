import PageLoader from '../components/PageLoader';

export default function Loading() {
  // Shown while route segments or server components are loading
  return (
    <PageLoader
      message="Loading..."
      size="large"
      fullScreen
      delayMs={300}
      showLogo
    />
  );
}



