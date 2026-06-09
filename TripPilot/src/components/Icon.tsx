interface IconProps {
  name: string;
  size?: number;
  className?: string;
  filled?: boolean;
  style?: React.CSSProperties;
}

export function Icon({ name, size = 24, className = '', filled = false, style }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{
        fontSize: size,
        fontVariationSettings: filled
          ? "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 24"
          : undefined,
        ...style,
      }}
    >
      {name}
    </span>
  );
}
