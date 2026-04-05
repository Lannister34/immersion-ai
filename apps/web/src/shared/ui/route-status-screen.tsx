import { PlaceholderScreen } from './placeholder-screen';

interface RouteStatusScreenProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function RouteStatusScreen({ eyebrow, title, description }: RouteStatusScreenProps) {
  return <PlaceholderScreen eyebrow={eyebrow} title={title} description={description} />;
}
