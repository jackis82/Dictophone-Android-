import React, { useState } from 'react';
import {
  X,
  Smartphone,
  Download,
  ExternalLink,
  Check,
  Copy,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

interface AndroidApkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidApkModal: React.FC<AndroidApkModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (!isOpen) return null;

  const currentUrl = window.location.origin;
  const pwaBuilderUrl = `https://www.pwabuilder.com/report?site=${encodeURIComponent(currentUrl)}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleDownloadWorkflow = () => {
    const yamlContent = `name: Build Android APK (Tauri 2)
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'
      - name: Setup Android SDK
        uses: android-actions/setup-android@v3
      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: aarch64-linux-android,armv7-linux-androideabi,i686-linux-android,x86_64-linux-android
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Build Web Assets
        run: npm run build
      - name: Build Android APK
        run: npx tauri android build --apk
      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: dictophone-android-apk
          path: src-tauri/gen/android/app/build/outputs/apk/universal/release/*.apk
`;
    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'android-build-apk.yml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl text-zinc-100 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white shadow-lg shadow-red-600/30">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Установка APK на Android
              </h2>
              <p className="text-xs text-zinc-400">
                3 способа запустить диктофон как нативное приложение на смартфоне
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Option 1: Native WebAPK / Direct Install */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-red-950/40 to-zinc-900 border border-red-900/40 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-red-600 text-white">
              Рекомендуемый и мгновенный
            </span>
          </div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            Прямая установка WebAPK на смартфон
          </h3>
          <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
            На любом Android устройстве браузер (Google Chrome, Яндекс, Edge) автоматически упаковывает приложение в полноценный <strong>.apk (WebAPK)</strong>. Оно появится в меню приложений Android с собственной иконкой, запускается без интерфейса браузера и работает автономно офлайн!
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {isInstallable && (
              <button
                onClick={install}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Установить сейчас на это устройство</span>
              </button>
            )}

            <button
              onClick={handleCopyUrl}
              className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUrl ? 'Ссылка скопирована!' : 'Скопировать ссылку для смартфона'}</span>
            </button>
          </div>
        </div>

        {/* Option 2: PWABuilder - Generate Standalone .APK in 1 click */}
        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800">
          <h3 className="text-sm font-bold text-white flex items-center justify-between">
            <span>2. Скачать готовый APK файл через PWABuilder</span>
            <span className="text-[10px] text-emerald-400 font-mono">1 клик</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
            Официальный бесплатный сервис от Microsoft и Google (<strong className="text-zinc-200">PWABuilder</strong>) мгновенно анализирует манифест нашего приложения и генерирует готовый файл <strong>.apk</strong> для ручной установки (sideload) или <strong>.aab</strong> для Google Play Store.
          </p>

          <div className="mt-3 flex items-center gap-2">
            <a
              href={pwaBuilderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold border border-zinc-700 transition-colors"
            >
              <span>Сгенерировать APK на PWABuilder</span>
              <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
            </a>
          </div>
        </div>

        {/* Option 3: GitHub Actions / Tauri 2 native compilation */}
        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800">
          <h3 className="text-sm font-bold text-white flex items-center justify-between">
            <span>3. Сборка через GitHub Actions (Tauri 2 / Gradle)</span>
            <span className="text-[10px] text-zinc-400 font-mono">CI/CD</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
            Поскольку в облачной веб-среде AI Studio нет Android SDK и компилятора Rust NDK, вы можете использовать готовый конфигурационный файл GitHub Actions для бесплатной автоматической компиляции универсального нативного APK-файла.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={handleDownloadWorkflow}
              className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>android-build-apk.yml</span>
            </button>

            <a
              href="/dictophone-source-code.zip"
              download="dictophone-source-code.zip"
              className="px-3.5 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Скачать все исходники (.ZIP)</span>
            </a>
          </div>
        </div>

        {/* Close button */}
        <div className="pt-1">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
          >
            Понятно, закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
