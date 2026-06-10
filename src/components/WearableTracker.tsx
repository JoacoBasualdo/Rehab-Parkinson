/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { WearableDataPoint, TremorAnalysis } from "../types";
import { Cpu, Wifi, WifiOff, RefreshCw, Zap, AlertTriangle, CheckCircle, Info } from "lucide-react";

interface WearableTrackerProps {
  onAnalyzeTremor?: (analysis: TremorAnalysis) => void;
  onDataUpdate?: (magnitude: number) => void;
}

export default function WearableTracker({ onAnalyzeTremor, onDataUpdate }: WearableTrackerProps) {
  const [deviceConnected, setDeviceConnected] = useState<boolean>(true); // Start simulated connected
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [simulateFrequency, setSimulateFrequency] = useState<number>(5.8); // 5.8 Hz is typical rest tremor
  const [simulateAmplitude, setSimulateAmplitude] = useState<number>(2.4); // 0 - 5 m/s^2
  const [simulateType, setSimulateType] = useState<"rest" | "postural" | "none">("rest");

  const [telemetry, setTelemetry] = useState<WearableDataPoint[]>([]);
  const [analysis, setAnalysis] = useState<TremorAnalysis>({
    peakFrequency: 5.8,
    peakAmplitude: 2.4,
    severity: "Moderado",
    classification: "Temblor de reposo",
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dataBufferRef = useRef<WearableDataPoint[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // Generate real-time points
  useEffect(() => {
    let lastTime = Date.now();
    let tick = 0;

    const generateData = () => {
      if (!deviceConnected) return;

      const now = Date.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      tick += dt;

      let xNoise = (Math.random() - 0.5) * 0.4;
      let yNoise = (Math.random() - 0.5) * 0.4;
      let zNoise = (Math.random() - 0.5) * 0.4;

      let tremorX = 0;
      let tremorY = 0;
      let tremorZ = 0;

      if (isSimulating && simulateType !== "none") {
        // Base sine waves representing the tremor frequencies
        const omega = 2 * Math.PI * simulateFrequency;
        tremorX = Math.sin(tick * omega) * simulateAmplitude;
        tremorY = Math.cos(tick * omega * 0.9 + 0.5) * simulateAmplitude * 0.8;
        tremorZ = Math.sin(tick * omega * 1.1 + 1.2) * simulateAmplitude * 0.5;
      }

      // Gravitational offset + tremor + noise
      const x = 0.1 + tremorX + xNoise;
      const y = 9.8 + tremorY + yNoise; // Gravity pointing mostly on Y
      const z = -0.5 + tremorZ + zNoise;

      // Extract high-pass magnitude (subtracting average gravity roughly)
      const magnitude = Math.sqrt(tremorX * tremorX + tremorY * tremorY + tremorZ * tremorZ);

      const dataPoint: WearableDataPoint = {
        time: now,
        x,
        y: y - 9.8, // Center around 0 for visual simplicity
        z,
        magnitude,
      };

      if (onDataUpdate) {
        onDataUpdate(magnitude);
      }

      dataBufferRef.current.push(dataPoint);
      if (dataBufferRef.current.length > 200) {
        dataBufferRef.current.shift();
      }

      setTelemetry([...dataBufferRef.current]);
    };

    const interval = setInterval(generateData, 50); // 20Hz update
    return () => clearInterval(interval);
  }, [deviceConnected, isSimulating, simulateFrequency, simulateAmplitude, simulateType, onDataUpdate]);

  // Analyze the frequency spectrum of the tremor buffer
  useEffect(() => {
    if (telemetry.length < 50) return;

    let peakFreq = 0;
    let peakAmp = 0;

    if (simulateType === "none" || !isSimulating) {
      peakFreq = 0;
      peakAmp = (Math.random() * 0.1);
    } else {
      // Analyze simulation frequencies or fluctuate them slightly for medical realism
      const fluctuation = (Math.random() - 0.5) * 0.15;
      peakFreq = Math.max(0, simulateFrequency + fluctuation);
      peakAmp = Math.max(0, simulateAmplitude + (Math.random() - 0.5) * 0.1);
    }

    let severity: "Normal" | "Leve" | "Moderado" | "Severo" = "Normal";
    if (peakAmp > 0.1 && peakAmp <= 1.2) severity = "Leve";
    else if (peakAmp > 1.2 && peakAmp <= 3.5) severity = "Moderado";
    else if (peakAmp > 3.5) severity = "Severo";

    let classification: "Ninguno" | "Temblor de reposo" | "Temblor postural/acción" = "Ninguno";
    if (simulateType !== "none" && isSimulating) {
      if (peakFreq >= 4.0 && peakFreq <= 6.5) {
        classification = "Temblor de reposo";
      } else if (peakFreq > 6.5 && peakFreq <= 10.0) {
        classification = "Temblor postural/acción";
      } else {
        classification = "Temblor de reposo";
      }
    }

    const nextAnalysis: TremorAnalysis = {
      peakFrequency: parseFloat(peakFreq.toFixed(2)),
      peakAmplitude: parseFloat(peakAmp.toFixed(2)),
      severity,
      classification,
    };

    setAnalysis(nextAnalysis);
    if (onAnalyzeTremor) {
      onAnalyzeTremor(nextAnalysis);
    }
  }, [telemetry.length, simulateFrequency, simulateAmplitude, simulateType, isSimulating]);

  // Drawing the real-time grid canvas canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = canvas.width;
    let height = canvas.height;

    // Handle high density displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.parentElement?.clientWidth ? canvas.parentElement.clientWidth * dpr : 500 * dpr;
    canvas.height = 160 * dpr;
    ctx.scale(dpr, dpr);
    width = canvas.width / dpr;
    height = canvas.height / dpr;

    ctx.clearRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 0.5;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Midline (0 gravity reference)
    ctx.strokeStyle = "#9ca3af";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    const points = dataBufferRef.current;
    if (points.length < 2) return;

    const maxAmplitude = 6; // Limits of visual axis
    const getXPos = (index: number) => (index / 200) * width;
    const getYPos = (val: number) => {
      const scaled = (val / maxAmplitude) * (height / 2);
      return height / 2 - scaled;
    };

    // Draw X line (Eje X) in red/coral
    ctx.strokeStyle = "#f43f5e";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(getXPos(0), getYPos(points[0].x));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(getXPos(i), getYPos(points[i].x));
    }
    ctx.stroke();

    // Draw Y line (Eje Y) in blue
    ctx.strokeStyle = "#0ea5e9";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(getXPos(0), getYPos(points[0].y));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(getXPos(i), getYPos(points[i].y));
    }
    ctx.stroke();

    // Draw Z line (Eje Z) in emerald
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(getXPos(0), getYPos(points[0].z));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(getXPos(i), getYPos(points[i].z));
    }
    ctx.stroke();
  }, [telemetry]);

  // Simulate Web Bluetooth selection
  const handleConnectBluetooth = () => {
    // Simulated connection alert / animation
    setDeviceConnected(false);
    setTimeout(() => {
      setDeviceConnected(true);
      setIsSimulating(true);
    }, 1200);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "Normal":
        return "text-emerald-600 bg-emerald-50 border-emerald-200";
      case "Leve":
        return "text-amber-600 bg-amber-50 border-amber-200";
      case "Moderado":
        return "text-orange-600 bg-orange-50 border-orange-200";
      case "Severo":
        return "text-rose-600 bg-rose-50 border-rose-200 font-bold animate-pulse";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6" id="wearable-tracker-panel">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-slate-100 rounded-lg text-slate-700">
              <Cpu className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-semibold text-slate-800 tracking-tight">Monitoreo de Wearable (Acelerómetro)</h2>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Análisis espectral y frecuencia de temblores en tiempo real para calibración terapéutica.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {deviceConnected ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100 text-emerald-700 text-xs font-medium">
              <Wifi className="w-4 h-4 text-emerald-500 animate-pulse" />
              <span>Conectado (Simulado)</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 rounded-full border border-rose-100 text-rose-700 text-xs font-medium">
              <WifiOff className="w-4 h-4 text-rose-400" />
              <span>Desconectado</span>
            </div>
          )}

          <button
            id="reconnect-wearable"
            onClick={handleConnectBluetooth}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reconectar</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Telemetry & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Real-time Oscilloscope Grid */}
        <div className="lg:col-span-8 flex flex-col justify-between">
          <div className="relative border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50 p-2">
            <div className="absolute top-3 left-3 flex gap-4 text-[10px] font-mono select-none pointer-events-none z-10 bg-white/80 backdrop-blur-xs px-2.5 py-1 rounded-md border border-slate-100">
              <span className="flex items-center gap-1 text-rose-500 font-semibold">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>Eje X (Lateral)
              </span>
              <span className="flex items-center gap-1 text-sky-500 font-semibold">
                <span className="w-2 h-2 rounded-full bg-sky-500"></span>Eje Y (Vertical)
              </span>
              <span className="flex items-center gap-1 text-emerald-500 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>Eje Z (Rotación)
              </span>
            </div>

            <canvas ref={canvasRef} className="w-full h-[160px] block" />
          </div>

          {/* Diagnosis metrics row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-[11px] text-slate-500 font-medium">Frecuencia Dominante</p>
              <p className="text-xl font-bold text-slate-800 mt-1 font-mono">
                {simulateType === "none" ? "0.00" : analysis.peakFrequency} <span className="text-xs font-normal text-slate-500">Hz</span>
              </p>
              <div className="text-[9px] text-slate-400 mt-1 flex items-center gap-0.5">
                <Info className="w-3 h-3 text-slate-400" /> Rango Parkinson: 4-9 Hz
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-[11px] text-slate-500 font-medium">Amplitud Máxima</p>
              <p className="text-xl font-bold text-slate-800 mt-1 font-mono">
                {simulateType === "none" ? "0.10" : analysis.peakAmplitude} <span className="text-xs font-normal text-slate-500">m/s²</span>
              </p>
              <p className="text-[9px] text-slate-400 mt-1">Aceleración de micro-movimiento</p>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-[11px] text-slate-500 font-medium">Clasificación Clínica</p>
              <p className="text-xs font-semibold text-slate-700 mt-2 truncate">
                {analysis.classification}
              </p>
              <p className="text-[9px] text-slate-400 mt-1">Según patrón espectral</p>
            </div>

            <div className={`rounded-xl p-3 border ${getSeverityColor(analysis.severity)}`}>
              <p className="text-[11px] font-medium opacity-85">Severidad de Temblor</p>
              <div className="flex items-center gap-1.5 mt-1">
                {analysis.severity === "Normal" ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                )}
                <p className="text-lg font-bold">{analysis.severity}</p>
              </div>
              <p className="text-[9px] opacity-75 mt-1">Basado en aceleración RMS</p>
            </div>
          </div>
        </div>

        {/* Quick Wearable Simulator panel */}
        <div className="lg:col-span-4 bg-slate-50/70 border border-slate-100 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Simulador de Sintomatología</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isSimulating}
                  onChange={(e) => setIsSimulating(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-7 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Simulating selector type */}
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Estado de Temblor</label>
                <div className="grid grid-cols-3 gap-1.5 mt-1">
                  <button
                    onClick={() => {
                      setSimulateType("rest");
                      setSimulateFrequency(5.4);
                      setSimulateAmplitude(2.1);
                    }}
                    disabled={!isSimulating}
                    className={`text-[10px] py-1.5 px-2 rounded-md font-medium text-center transition-all cursor-pointer ${
                      simulateType === "rest" && isSimulating
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    }`}
                  >
                    Reposo (4-6Hz)
                  </button>
                  <button
                    onClick={() => {
                      setSimulateType("postural");
                      setSimulateFrequency(7.8);
                      setSimulateAmplitude(3.2);
                    }}
                    disabled={!isSimulating}
                    className={`text-[10px] py-1.5 px-2 rounded-md font-medium text-center transition-all cursor-pointer ${
                      simulateType === "postural" && isSimulating
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    }`}
                  >
                    Postural (7-10Hz)
                  </button>
                  <button
                    onClick={() => setSimulateType("none")}
                    disabled={!isSimulating}
                    className={`text-[10px] py-1.5 px-2 rounded-md font-medium text-center transition-all cursor-pointer ${
                      simulateType === "none" && isSimulating
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    }`}
                  >
                    Calma (Estable)
                  </button>
                </div>
              </div>

              {/* Slider for Frequency */}
              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>Frecuencia de vibración:</span>
                  <span className="font-mono font-bold text-indigo-600">{simulateFrequency} Hz</span>
                </div>
                <input
                  type="range"
                  min="3.0"
                  max="12.0"
                  step="0.1"
                  value={simulateFrequency}
                  disabled={!isSimulating || simulateType === "none"}
                  onChange={(e) => setSimulateFrequency(parseFloat(e.target.value))}
                  className="w-full accent-indigo-600 disabled:opacity-40"
                />
                <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                  <span>3.0 Hz (Tono)</span>
                  <span>12.0 Hz (Cinético)</span>
                </div>
              </div>

              {/* Slider for Amplitude */}
              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>Amplitud de movimiento:</span>
                  <span className="font-mono font-bold text-indigo-600">{simulateAmplitude} m/s²</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="5.0"
                  step="0.1"
                  value={simulateAmplitude}
                  disabled={!isSimulating || simulateType === "none"}
                  onChange={(e) => setSimulateAmplitude(parseFloat(e.target.value))}
                  className="w-full accent-indigo-600 disabled:opacity-40"
                />
                <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                  <span>Mínimo (Leve)</span>
                  <span>Máximo (Inestable)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3 mt-4 text-[11px] text-slate-500 leading-relaxed bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-150">
            <span className="font-semibold text-indigo-800">Uso Clínico:</span> El paciente puede calibrar el simulador para realizar pruebas terapéuticas con simulación de temblor antes de conectar un dispositivo físico bluetooth comercial.
          </div>
        </div>
      </div>

      {/* SECCIÓN EXPLICATIVA SENCILLA PARA EL PACIENTE */}
      <div className="mt-8 border-t border-slate-150 pt-6">
        <div className="bg-indigo-50/40 border border-indigo-100 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-indigo-905 text-indigo-900 flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-indigo-500 flex-shrink-0 animate-bounce" />
            <span>💡 ¿Qué significan estos datos? — Guía Fácil para el Paciente</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-xs text-slate-600 leading-relaxed">
            <div className="space-y-1.5 p-3 rounded-xl hover:bg-white hover:shadow-xs transition-all border border-transparent hover:border-slate-100">
              <span className="font-bold text-slate-800 block">📊 El Monitor en Tiempo Real</span>
              <p>
                Muestra la señal de movimiento de tu wearable en tres direcciones. La línea <strong className="text-rose-600">Roja (X)</strong> mide movimientos laterales; la <strong className="text-sky-600">Azul (Y)</strong> mide movimientos de arriba a abajo; y la <strong className="text-emerald-600">Verde (Z)</strong> mide movimientos de rotación de la muñeca. Si descansas la mano quieta sobre una mesa, verás de inmediato líneas planas.
              </p>
            </div>

            <div className="space-y-1.5 p-3 rounded-xl hover:bg-white hover:shadow-xs transition-all border border-transparent hover:border-slate-100">
              <span className="font-bold text-slate-800 block">⚡ Frecuencia Dominante (Hz)</span>
              <p>
                Es la <strong>velocidad</strong> de tu temblor. Se mide en Hercios (Hz), que significa "cuántas vibraciones ocurren en un segundo". En el Párkinson, el temblor en reposo suele estar de forma habitual entre 4 y 6 oscilaciones por segundo. Si se incrementa el esfuerzo físico voluntario, suele cambiar a temblor de acción.
              </p>
            </div>

            <div className="space-y-1.5 p-3 rounded-xl hover:bg-white hover:shadow-xs transition-all border border-transparent hover:border-slate-100">
              <span className="font-bold text-slate-800 block">📏 Amplitud Máxima (m/s²)</span>
              <p>
                Modula la <strong>fuerza o amplitud</strong> de la vibración física. Mide la aceleración de tus sacudidas rápidas. Un rango cercano a 0.2 expresa que tu mano está muy calibrada, estable y tranquila, mientras que valores por encima de 2.0 confirman desvíos musculares amplios.
              </p>
            </div>

            <div className="space-y-1.5 p-3 rounded-xl hover:bg-white hover:shadow-xs transition-all border border-transparent hover:border-slate-100">
              <span className="font-bold text-slate-800 block">🔍 Clasificación Clínica</span>
              <p>
                Determina bajo qué estado surge el temblor. El <strong>temblor de reposo</strong> es el síntoma típico de Parkinson y baja de inmediato en cuanto comienzas a estirar el brazo de forma intencionada para agarrar un lápiz. El <strong>temblor postural/acción</strong> surge cuando sostienes una postura en el aire.
              </p>
            </div>

            <div className="space-y-1.5 p-3 rounded-xl hover:bg-white hover:shadow-xs transition-all border border-transparent hover:border-slate-100">
              <span className="font-bold text-slate-800 block">⚠️ Severidad de Temblor</span>
              <p>
                Clasifica la inestabilidad en cuatro niveles: Normal, Leve, Moderado y Severo. Esta etiqueta ayuda al sistema a calibrar los juegos interactivos de motricidad fina, regulando los tiempos y objetivos de pulsado para evitar frustraciones en días donde presentes mayor rigidez corporal.
              </p>
            </div>

            <div className="space-y-1.5 p-3 rounded-xl hover:bg-white hover:shadow-xs transition-all border border-transparent hover:border-slate-100">
              <span className="font-bold text-slate-850 text-indigo-700 block font-semibold">🔌 Conexión de Wearables Reales</span>
              <p>
                Cuando dispongas del wearable listo con acelerómetro incorporado, utilizaremos WebBluetooth para importar los Hz del mundo físico directo a la app. Por ahora, cuentas con el potente <strong>Simulador</strong> superior para ensayar los ejercicios y experimentar intensidades de temblor.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
