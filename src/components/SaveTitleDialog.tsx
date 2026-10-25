import React, { useState, useEffect } from 'react';
import { Check, X, AlertCircle, Sparkles } from 'lucide-react';
import { validateTitle } from '../utils/recorder-logic.ts';
import { LanguageKey, translations } from '../i18n/translations.ts';

interface SaveTitleDialogProps {
  isOpen: boolean;
  suggestedTitle: string;
  existingTitles: string[];
  lang: LanguageKey;
  onSave: (title: string) => void;
  onSaveAuto: () => void;
}

export const SaveTitleDialog: React.FC<SaveTitleDialogProps> = ({
  isOpen,
  suggestedTitle,
  existingTitles,
  lang,
  onSave,
  onSaveAuto,
}) => {
  const [title, setTitle] = useState(suggestedTitle);
  const [validation, setValidation] = useState(validateTitle(suggestedTitle, existingTitles));
  const t = translations[lang];

  useEffect(() => {
    setTitle(suggestedTitle);
    setValidation(validateTitle(suggestedTitle, existingTitles));
  }, [suggestedTitle, existingTitles, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    setValidation(validateTitle(val, existingTitles));
  };

  const handleApplySuggestion = () => {
    if (validation.suggestion) {
      setTitle(validation.suggestion);
      setValidation(validateTitle(validation.suggestion, existingTitles));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validation.valid) {
      onSave(title.trim());
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-dialog-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 p-5 shadow-2xl text-zinc-100 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 id="save-dialog-title" className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              {t.saveDialog.title}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">{t.saveDialog.subtitle}</p>
          </div>
          <button
            onClick={onSaveAuto}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title={t.saveDialog.saveLaterBtn}
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input & Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">{t.saveDialog.nameLabel}</label>
            <div className="relative">
              <input
                type="text"
                value={title}
                onChange={handleChange}
                maxLength={100}
                placeholder={t.saveDialog.namePlaceholder}
                autoFocus
                className={`w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 text-sm font-medium border transition-colors outline-none ${
                  !validation.valid
                    ? 'border-red-500/80 focus:border-red-500 ring-1 ring-red-500/30'
                    : 'border-zinc-700/80 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                }`}
              />
              <span className="absolute right-3 top-3 text-[10px] text-zinc-500">{title.length}/100</span>
            </div>

            {/* Error or duplicate warning */}
            {!validation.valid && (
              <div className="mt-2 text-xs flex flex-col gap-1.5 text-red-400 bg-red-950/40 border border-red-900/50 p-2.5 rounded-xl">
                <div className="flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                  <span>{validation.message}</span>
                </div>
                {validation.suggestion && (
                  <button
                    type="button"
                    onClick={handleApplySuggestion}
                    className="self-start mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-900/60 hover:bg-red-800/80 text-white transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    {t.saveDialog.useSuggestion} <strong>{validation.suggestion}</strong>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="submit"
              disabled={!validation.valid}
              className="w-full h-11 rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              {t.saveDialog.saveBtn}
            </button>

            <button
              type="button"
              onClick={onSaveAuto}
              className="w-full h-9 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition-colors"
            >
              {t.saveDialog.saveLaterBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
