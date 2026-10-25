import React, { useState } from 'react';
import { Lock, Delete } from 'lucide-react';
import { LanguageKey, translations } from '../i18n/translations.ts';

interface PinLockModalProps {
  isOpen: boolean;
  correctPin: string;
  lang: LanguageKey;
  onSuccess: () => void;
}

export const PinLockModal: React.FC<PinLockModalProps> = ({
  isOpen,
  correctPin,
  lang,
  onSuccess,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const t = translations[lang];

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(false);
      if (nextPin.length === 4) {
        if (nextPin === correctPin) {
          onSuccess();
          setPin('');
        } else {
          setError(true);
          setTimeout(() => {
            setPin('');
          }, 600);
        }
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    setError(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950 text-white select-none">
      <div className="w-full max-w-xs flex flex-col items-center gap-6">
        <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-lg">
          <Lock className="w-7 h-7 text-red-500" />
        </div>

        <div className="text-center">
          <h2 className="text-lg font-bold">{t.pinModal.enterPin}</h2>
          {error && (
            <p className="text-xs text-red-400 mt-1 animate-shake">
              {t.pinModal.incorrectPin}
            </p>
          )}
        </div>

        {/* 4 dots */}
        <div className="flex items-center gap-4 my-2">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                pin.length > idx
                  ? error
                    ? 'bg-red-500 border-red-500'
                    : 'bg-white border-white scale-110'
                  : 'border-zinc-700 bg-transparent'
              }`}
            />
          ))}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-4 w-full pt-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              onClick={() => handleDigit(digit)}
              className="h-16 rounded-2xl bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 text-xl font-bold font-mono text-white transition-colors flex items-center justify-center"
            >
              {digit}
            </button>
          ))}
          <div />
          <button
            onClick={() => handleDigit('0')}
            className="h-16 rounded-2xl bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 text-xl font-bold font-mono text-white transition-colors flex items-center justify-center"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="h-16 rounded-2xl bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 text-zinc-400 hover:text-white transition-colors flex items-center justify-center"
            aria-label="Стереть"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
