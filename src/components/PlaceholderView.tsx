import { Construction } from 'lucide-react';

interface PlaceholderViewProps {
  title: string;
  description: string;
}

export default function PlaceholderView({ title, description }: PlaceholderViewProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-4 animate-fade-in">
        <Construction className="w-12 h-12 text-white/20 mx-auto" />
        <h2 className="text-lg font-bold text-white/60">{title}</h2>
        <p className="text-sm text-white/30">{description}</p>
      </div>
    </div>
  );
}
