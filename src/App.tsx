/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { SessionLog, TremorAnalysis } from "./types";
import WearableTracker from "./components/WearableTracker";
import GamesHub from "./components/GamesHub";
import HistoryLogs from "./components/HistoryLogs";
import { 
  Heart, 
  BrainCircuit, 
  Award, 
  ShieldCheck, 
  Lightbulb, 
  Activity, 
  ArrowLeft, 
  Gamepad2, 
  Database,
  ArrowRight
} from "lucide-react";

export default function App() {
  const [currentView, setCurrentView] = useState<"home" | "datos" | "juegos">("home");
  const [logs, setLogs] = useState<SessionLog[]>([
    {
      id: "log-1",
      timestamp: "09:30 AM",
      exerciseType: "Voz",
      duration: 10,
      metrics: {
        score: 84,
        stability: 88,
        peakVolume: 74,
      },
      notes: "Calibración inicial de la vocal 'Ah'. Sostuvo volumen alto arriba de los 65dB de rango.",
    },
    {
      id: "log-2",
      timestamp: "10:15 AM",
      exerciseType: "Motricidad - Tapping",
      duration: 10,
      metrics: {
        score: 75,
        stability: 80,
        averageTremor: 5.6,
      },
      notes: "Sesión de tapping rápido con el wearable encendido. Ritmo regular con leve desaceleración al final.",
    }
  ]);

  const [activeAnalysis, setActiveAnalysis] = useState<TremorAnalysis>({
    peakFrequency: 5.8,
    peakAmplitude: 2.1,
    severity: "Moderado",
    classification: "Temblor de reposo",
  });

  const [wearableWaveMagnitude, setWearableWaveMagnitude] = useState<number>(0);
  const [wearableCoords, setWearableCoords] = useState<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });

  // Handle addition of a completed exercise session
  const handleSessionComplete = (newLog: SessionLog) => {
    setLogs((prev) => [newLog, ...prev]);
  };

  const handleClearHistory = () => {
    setLogs([]);
  };

  const handleDeleteLog = (id: string) => {
    setLogs((prev) => prev.filter((log) => log.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16 font-sans">
      {/* Upper Brand Info strip */}
      <div className="bg-indigo-950 text-indigo-200 py-2.5 px-4 text-xs font-medium border-b border-indigo-900/40">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Sistema Médico de Bio-Retroalimentación para Párkinson</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Monitoreo de Wearable en tiempo real
            </span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        
        {/* VIEW 1: HOME PANEL */}
        {currentView === "home" && (
          <div className="space-y-8 animate-fade-in py-6">
            {/* Elegant Hero / Welcome Banner */}
            <div className="text-center max-w-3xl mx-auto space-y-4">
              <div className="inline-flex items-center justify-center p-3 bg-indigo-50 text-indigo-600 rounded-2xl mb-2">
                <BrainCircuit className="w-12 h-12" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                NeuroRehab Párkinson
              </h1>
              <p className="text-base text-slate-500 leading-relaxed">
                Plataforma terapéutica interactiva para el seguimiento sintomatológico y ejercitación del Párkinson. Sincroniza datos de tu dispositivo wearable para calibrar sesiones de voz y destreza motora.
              </p>
            </div>

            {/* TWO PRIMARY PATHWAYS (BUTTONS) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              
              {/* BUTTON CARD 1: DATOS (WEARABLE SENSORES) */}
              <div 
                onClick={() => setCurrentView("datos")}
                className="group bg-white rounded-2xl border border-slate-100 hover:border-indigo-200 shadow-xs hover:shadow-lg transition-all duration-300 p-8 flex flex-col justify-between cursor-pointer relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500 group-hover:bg-indigo-600 transition-colors" />
                <div className="space-y-4 pl-2">
                  <div className="flex items-center gap-3">
                    <span className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform">
                      <Database className="w-6 h-6" />
                    </span>
                    <h2 className="text-xl font-bold text-slate-800">
                      Datos del Wearable
                    </h2>
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Monitorea los sensores en tiempo real de tu wearable para ver las frecuencias de temblores (en hercios Hz), gravedad de movimiento y variaciones espectrales del acelerómetro.
                  </p>
                </div>
                <div className="mt-8 pt-4 border-t border-slate-50 flex items-center justify-between text-xs font-semibold text-indigo-600 pl-2">
                  <span>Abrir visualizador de sensores</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                </div>
              </div>

              {/* BUTTON CARD 2: JUEGOS (TERAPIA DE EJERCICIOS) */}
              <div 
                onClick={() => setCurrentView("juegos")}
                className="group bg-white rounded-2xl border border-slate-100 hover:border-emerald-200 shadow-xs hover:shadow-lg transition-all duration-300 p-8 flex flex-col justify-between cursor-pointer relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500 group-hover:bg-emerald-600 transition-colors" />
                <div className="space-y-4 pl-2">
                  <div className="flex items-center gap-3">
                    <span className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
                      <Gamepad2 className="w-6 h-6" />
                    </span>
                    <h2 className="text-xl font-bold text-slate-800">
                      Juegos y Ejercicios
                    </h2>
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Accede a desafíos terapéuticos guiados. Entrena la proyección de volumen con prácticas de voz y ejercita la rigidez con dinámicas digitales de motricidad fina y ritmo.
                  </p>
                </div>
                <div className="mt-8 pt-4 border-t border-slate-50 flex items-center justify-between text-xs font-semibold text-emerald-600 pl-2">
                  <span>Acceder a la zona de juegos</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                </div>
              </div>

            </div>

            {/* Quick tips & info strip for home */}
            <div className="max-w-4xl mx-auto bg-slate-100 border border-slate-200 rounded-2xl p-5 flex gap-3">
              <Lightbulb className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-slate-600 space-y-1">
                <span className="font-bold text-slate-750 block">Uso Clínico Recomendado</span>
                <p>
                  El sensor se puede conectar para trackear temblores involuntarios en reposo y acción. Los reportes consolidados se guardan y pueden descargarse directamente para compartir con tu médico o kinesiólogo.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: PORTAL DE DATOS (Persistent mounting for uninterrupted serial/wi-fi telemetry) */}
        <div className={currentView === "datos" ? "space-y-6" : "hidden"}>
          {/* Section Header with Back button */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setCurrentView("home")}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                title="Volver"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Panel de Sensores & Wearable</h1>
                <p className="text-xs text-slate-500">Información del acelerómetro y espectro de temblores acumulados.</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-indigo-50 text-indigo-750 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-indigo-500 animate-pulse" />
                <span>Señal RMS: {wearableWaveMagnitude.toFixed(2)} m/s²</span>
              </div>
              <button
                onClick={() => setCurrentView("home")}
                className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Volver al inicio
              </button>
            </div>
          </div>

          {/* Tracker Panel (Acelerometer charts & spectrum analysis) */}
          <WearableTracker
            onAnalyzeTremor={setActiveAnalysis}
            onDataUpdate={(magnitude, coords) => {
              setWearableWaveMagnitude(magnitude);
              if (coords) {
                setWearableCoords(coords);
              }
            }}
          />

          {/* Historical Logs and CSV Export */}
          <HistoryLogs
            logs={logs}
            onClearHistory={handleClearHistory}
            onDeleteLog={handleDeleteLog}
          />
        </div>

        {/* VIEW 3: PORTAL DE JUEGOS */}
        {currentView === "juegos" && (
          <div className="space-y-6">
            {/* Section Header with Back button */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setCurrentView("home")}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                  title="Volver"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-xl font-bold text-slate-800">Biblioteca de Juegos Interactivos</h1>
                  <p className="text-xs text-slate-500">Ejercicios diseñados clínicamente para mantener la destreza mental y motriz fina.</p>
                </div>
              </div>

              <button
                onClick={() => setCurrentView("home")}
                className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Volver al inicio
              </button>
            </div>

            {/* Games Centralized Hub */}
            <GamesHub
              onSessionComplete={handleSessionComplete}
              currentWearableTremor={activeAnalysis.peakAmplitude}
              currentWearableTremorClass={activeAnalysis.severity}
              currentWearableCoords={wearableCoords}
              currentWearableStatusText={activeAnalysis.statusText}
              logs={logs}
            />
          </div>
        )}

      </main>

      {/* Footer disclaimer */}
      <footer className="mt-16 text-center text-xs text-slate-400 max-w-2xl mx-auto px-4 leading-relaxed">
        <p className="font-semibold text-slate-500">Aviso de Tele-Salud complementaria:</p>
        <p className="mt-1">
          Este sistema biomédico interactivo recopila tendencias y estimaciones físicas. No reemplaza el asesoramiento kinesiología prescrito por neurólogos profesionales.
        </p>
        <div className="mt-4 flex justify-center gap-4 text-[10px]">
          <a href="#" className="hover:underline">Conformidad Médica HIPAA</a>
          <span>•</span>
          <a href="#" className="hover:underline">Privacidad de datos de Wearables</a>
        </div>
      </footer>
    </div>
  );
}
