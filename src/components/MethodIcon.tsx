import { ArrowDown, Plus, ArrowUpToLine, GitCommitHorizontal, MinusCircle, Eye, Compass, Globe } from 'lucide-react';
import { getMethodColor } from '../utils/styles';

interface MethodIconProps {
  method: string;
  size?: number;
  className?: string;
}

export function MethodIcon({ method, size = 13, className = '' }: MethodIconProps) {
  const m = method.toUpperCase();
  const colorClass = getMethodColor(method);

  const renderIcon = () => {
    switch (m) {
      case 'GET':
        return <ArrowDown size={size} strokeWidth={2.2} />;
      case 'POST':
        return <Plus size={size} strokeWidth={2.5} />;
      case 'PUT':
        return <ArrowUpToLine size={size} strokeWidth={2.2} />;
      case 'PATCH':
        return <GitCommitHorizontal size={size} strokeWidth={2.2} />;
      case 'DELETE':
        return <MinusCircle size={size} strokeWidth={2.2} />;
      case 'HEAD':
        return <Eye size={size} strokeWidth={2} />;
      case 'OPTIONS':
        return <Compass size={size} strokeWidth={2} />;
      default:
        return <Globe size={size} strokeWidth={2} />;
    }
  };

  return (
    <span 
      className={`inline-flex items-center justify-center ${colorClass} ${className}`}
      title={m}
    >
      {renderIcon()}
    </span>
  );
}
