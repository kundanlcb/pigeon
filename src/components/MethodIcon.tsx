import { getMethodColor } from '../utils/styles';

interface MethodIconProps {
  method: string;
  size?: number;
  className?: string;
  tabular?: boolean;
}

export function MethodIcon({ method, className = '', tabular = true }: MethodIconProps) {
  const m = method.toUpperCase();
  const colorClass = getMethodColor(method);
  const widthClass = tabular ? 'w-12' : 'w-auto';

  return (
    <span 
      className={`inline-block font-bold text-[10px] shrink-0 text-left ${widthClass} ${colorClass} ${className}`}
      title={m}
    >
      {m}
    </span>
  );
}
