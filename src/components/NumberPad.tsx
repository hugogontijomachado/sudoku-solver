type Props = {
  disabled: boolean;
  onInput: (d: number) => void;
  onErase: () => void;
};

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function NumberPad({ disabled, onInput, onErase }: Props) {
  return (
    <div className="numpad">
      <div className="numpad-grid">
        {DIGITS.map((d) => (
          <button
            key={d}
            type="button"
            className="numpad-btn"
            disabled={disabled}
            onClick={() => onInput(d)}
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          className="numpad-btn numpad-erase"
          disabled={disabled}
          onClick={onErase}
          aria-label="Apagar"
        >
          ⌫
        </button>
      </div>
      {disabled && <div className="numpad-hint">Selecione uma célula para digitar</div>}
    </div>
  );
}
