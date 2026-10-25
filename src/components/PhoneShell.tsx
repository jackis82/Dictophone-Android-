import React, { useState } from 'react';
import { Wifi, Battery, Smartphone, Monitor } from 'lucide-react';

interface PhoneShellProps {
  children: React.ReactNode;
  onOpenApkModal?: () => void;
}

export const PhoneShell: React.FC<PhoneShellProps> = ({ children, onOpenApkModal }) => {
  const [isPhoneFrame, setIsPhoneFrame] = useState(true);

  return (
    <div className="min-h-screen w-full bg-[#050608] flex flex-col items-center justify-center p-0 sm:p-4 select-none relative font-sans text-zinc-100">
      {/* Device Viewport & APK Toggle */}
      <div className="hidden sm:flex fixed top-3 right-3 z-50 items-center gap-1.5 bg-zinc-900/90 border border-zinc-800 p-1 rounded-full shadow-lg backdrop-blur-md">
        {onOpenApkModal && (
          <button
            onClick={onOpenApkModal}
            className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 transition-all cursor-pointer"
            title="Скачать APK файл"
          >
            <span>APK</span>
          </button>
        )}
        <button
          onClick={() => setIsPhoneFrame(true)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
            isPhoneFrame
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
          title="Вид: Android смартфон"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Android</span>
        </button>
        <button
          onClick={() => setIsPhoneFrame(false)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
            !isPhoneFrame
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
          title="Вид: Полный экран"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>Экран</span>
        </button>
      </div>

      {/* Main Container */}
      <div
        className={`w-full bg-[#090a0f] flex flex-col overflow-hidden relative transition-all ${
          isPhoneFrame
            ? 'max-w-[420px] h-[100dvh] sm:h-[860px] sm:max-h-[92vh] sm:rounded-[44px] sm:border-[8px] sm:border-zinc-800 sm:ring-1 sm:ring-zinc-700/60 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)]'
            : 'max-w-2xl min-h-[100dvh] sm:rounded-3xl sm:border border-zinc-800 shadow-2xl'
        }`}
      >
        {/* Android Status Bar */}
        <div className="w-full h-9 px-6 pt-2 shrink-0 flex items-center justify-between text-[11px] font-mono text-zinc-400 select-none z-30">
          <span>12:45</span>

          {/* Android Punch Hole Selfie Camera */}
          {isPhoneFrame && (
            <div className="w-3.5 h-3.5 rounded-full bg-black border border-zinc-800 shadow-inner -mt-1" />
          )}

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold">5G</span>
            <Wifi className="w-3.5 h-3.5" />
            <div className="flex items-center gap-1">
              <span className="text-[10px]">92%</span>
              <Battery className="w-3.5 h-3.5 fill-zinc-400 text-zinc-400" />
            </div>
          </div>
        </div>

        {/* Inner App Content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          {children}
        </div>

        {/* Android Navigation Bar Pill */}
        {isPhoneFrame && (
          <div className="w-full h-5 shrink-0 flex items-center justify-center pb-1">
            <div className="w-32 h-1 rounded-full bg-zinc-600/70" />
          </div>
        )}
      </div>
    </div>
  );
};
