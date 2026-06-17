export function Cell({
  value, className, onClick,
}: { value: number; className: string; onClick?: () => void }) {
  return (
    <div className={className} onClick={onClick}>
      {value || ''}
    </div>
  );
}
