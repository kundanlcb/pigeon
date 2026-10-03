import { getMethodColor } from '../utils/styles';

interface MethodIconProps {
  method: string;
  size?: number;
  className?: string;
}

export function MethodIcon({ method, className = '' }: MethodIconProps) {
  const m = method.toUpperCase();
  const colorClass = getMethodColor(method);

  return (
    <span 
      className={`inline-block font-bold text-[10px] shrink-0 text-left w-12 ${colorClass} ${className}`}
      title={m}
    >
      {m}
    </span>
  );
}
