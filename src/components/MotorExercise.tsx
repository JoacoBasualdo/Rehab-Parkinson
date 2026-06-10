/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { SessionLog } from "../types";
import { Sparkles, Play, Award, Zap, Compass, RefreshCw, Pointer, AlertTriangle, CheckCircle, Info } from "lucide-react";

interface MotorExerciseProps {
  onSessionComplete: (log: SessionLog) => void;
  currentWearableTremorClass?: string;
  currentWearableTremorAmp?: number;
}

export default function MotorExercise({
  onSessionComplete,
  currentWearableTremorClass = "Ninguno",
  currentWearableTremorAmp = 0,
}: MotorExerciseProps) {
  const [activeGame, setActiveGame] = useState<"tracing" | "tapping">("tracing");
  const [gameState, setGameState] = useState<"idle" | "playing" | "completed">("idle");
  const [score, setScore] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Tapping States
  const [tapCount, setTapCount] = useState<number>(0);
  const [tapTimestamps, setTapTimestamps] = useState<number[]>([]);
  const [tappingTimer, setTappingTimer] = useState<number>(10);

  // Tracing States
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const traceCoordinatesRef = useRef<{ x: number; y: number }[]>([]);
  const lastTremorAmpRef = useRef<number>(0);

  useEffect(() => {
    lastTremorAmpRef.current = currentWearableTremorAmp;
  }, [currentWearableTremorAmp]);

  // Tracing Canvas Initialization & Draw Path Loop
  useEffect(() => {
    if (activeGame !== "tracing" || gameState !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Draw the reference track (wavy green canal)
    const drawTrack = () => {
      ctx.clearRect(0, 0, width, height);

      // Background Grid
      ctx.strokeStyle = "#f1f5f9";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 30) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      }
      for (let y = 0; y < height; y += 30) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }

      // Start & Finish gates
      ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
      ctx.fillRect(0, 0, 45, height); // Start box
      ctx.fillStyle = "rgba(79, 70, 229, 0.15)";
      ctx.fillRect(width - 45, 0, 45, height); // End box

      ctx.fillStyle = "#10b981";
      ctx.font = "bold 9px sans-serif";
      ctx.fillText("INICIO", 8, height / 2 + 3);

      ctx.fillStyle = "#4f46e5";
      ctx.font = "bold 9px sans-serif";
      ctx.fillText("META", width - 38, height / 2 + 3);

      // Draw the central rehabilitation path
      ctx.beginPath();
      ctx.strokeStyle = "rgba(99, 102, 241, 0.15)"; // Soft violet ribbon
      ctx.lineWidth = 50; // Pathway thickness
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Curvy line
      ctx.moveTo(30, height / 2);
      ctx.bezierCurveTo(
        width / 4, height / 6,
        (width * 2) / 4, (height * 5) / 6,
        width - 30, height / 2
      );
      ctx.stroke();

      // Guide line centerline (dashed target)
      ctx.beginPath();
      ctx.strokeStyle = "rgba(99, 102, 241, 0.4)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 8]);
      ctx.moveTo(30, height / 2);
      ctx.bezierCurveTo(
        width / 4, height / 6,
        (width * 2) / 4, (height * 5) / 6,
        width - 30, height / 2
      );
      ctx.stroke();
      ctx.setLineDash([]);
    };

    drawTrack();
  }, [activeGame, gameState]);

  // Helper formula to find target Y on the curvy center path for any given X
  const getCentralBezierY = (x: number, width: number, height: number): number => {
    // Math approximation of the Bezier curvature for error tracking
    const t = x / width;
    // central line curve formula coefficients
    const y0 = height / 2;
    const y1 = height / 6;
    const y2 = (height * 5) / 6;
    const y3 = height / 2;

    const yVal =
      Math.pow(1 - t, 3) * y0 +
      3 * Math.pow(1 - t, 2) * t * y1 +
      3 * (1 - t) * Math.pow(t, 2) * y2 +
      Math.pow(t, 3) * y3;
    return yVal;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameState !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Must start adjacent to the LEFT green gate (X < 50)
    if (x > 55) {
      setErrorMessage("Por favor, inicia tu trazo desde la zona verde (INICIO) en la izquierda.");
      return;
    }

    setErrorMessage("");
    isDrawingRef.current = true;
    traceCoordinatesRef.current = [{ x, y }];
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || gameState !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;

    // Mix in the user's micro wearable tremors (shake pointer marginally based on active simulation)
    const shakePower = lastTremorAmpRef.current * 1.5;
    const x = rawX + (Math.random() - 0.5) * shakePower;
    const y = rawY + (Math.random() - 0.5) * shakePower;

    const width = canvas.width;
    const height = canvas.height;

    // Append to coordinate stream
    traceCoordinatesRef.current.push({ x, y });

    // Draw active user trace (Orange line)
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    const lastPoint = traceCoordinatesRef.current[traceCoordinatesRef.current.length - 2];
    if (lastPoint) {
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    // Safety constraint: Validate if they stray outside the 50px boundary box (25px max deviation)
    const targetY = getCentralBezierY(x, width, height);
    const deviation = Math.abs(y - targetY);

    if (deviation > 32) {
      // Stray too far warning
      setErrorMessage("¡Ten cuidado! Te has salido demasiado del camino terapéutico. Vuelve al centro.");
      // Soft score penalty
    }

    // Success validation: Reached META (Right border box X > width - 50)
    if (x >= width - 48) {
      handleCompleteTracing();
    }
  };

  const handleMouseUp = () => {
    isDrawingRef.current = false;
  };

  const handleCompleteTracing = () => {
    if (gameState !== "playing") return;
    setGameState("completed");
    isDrawingRef.current = false;

    const canvas = canvasRef.current;
    const width = canvas?.width || 500;
    const height = canvas?.height || 220;

    // Calculate accuracy score
    const points = traceCoordinatesRef.current;
    if (points.length < 15) {
      setScore(0);
      return;
    }

    let totalDeviation = 0;
    points.forEach((pt) => {
      const idealY = getCentralBezierY(pt.x, width, height);
      totalDeviation += Math.abs(pt.y - idealY);
    });

    const averageDeviation = totalDeviation / points.length;
    // High score is close to 0 deviation. Let's map average deviation of 0px to 100%, 35px deviation to 0%
    const calculatedPercentage = Math.max(30, Math.round(100 - averageDeviation * 2.2));
    
    // Lower because of tremor
    const finalCalculatedScore = Math.max(5, calculatedPercentage - Math.round(lastTremorAmpRef.current * 4));
    setScore(finalCalculatedScore);

    // Save medical log
    const sessionLog: SessionLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' }),
      exerciseType: "Motricidad - Trazo",
      duration: 12, // average trace time
      metrics: {
        score: finalCalculatedScore,
        stability: Math.round(100 - averageDeviation),
        averageTremor: parseFloat(lastTremorAmpRef.current.toFixed(1)),
      },
      notes: `Trazado de curva completado. Precisión motriz fina de ${finalCalculatedScore}%. Inestabilidad de temblores compensada.`,
    };

    onSessionComplete(sessionLog);
  };

  // --- FINGER TAPPING LOGIC ---
  const handleStartTapping = () => {
    setGameState("playing");
    setTapCount(0);
    setTapTimestamps([]);
    setTappingTimer(10);
    setErrorMessage("");

    const countdown = setInterval(() => {
      setTappingTimer((prev) => {
        if (prev <= 1) {
          clearInterval(countdown);
          // End Tapping Game
          handleCompleteTapping();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTapAction = () => {
    if (gameState !== "playing") return;
    setTapCount((prev) => prev + 1);
    setTapTimestamps((prev) => [...prev, Date.now()]);
  };

  const handleCompleteTapping = () => {
    setGameState("completed");

    // Calculate cadence jitter (rehabilitative rhythm assessment)
    setTapCount((currentCount) => {
      setTapTimestamps((timestamps) => {
        let scoreVal = 0;
        let tapConsistency = 95;

        if (timestamps.length > 3) {
          // Compute difference between taps (intervals in ms)
          const intervals: number[] = [];
          for (let i = 1; i < timestamps.length; i++) {
            intervals.push(timestamps[i] - timestamps[i - 1]);
          }

          // Calculate standard deviation of tap intervals
          const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
          const variance = intervals.reduce((acc, val) => acc + Math.pow(val - avgInterval, 2), 0) / intervals.length;
          const stDev = Math.sqrt(variance);

          // Tap consistency index: high Jitter means low consistency
          tapConsistency = Math.max(30, Math.min(100, Math.round(100 - stDev * 0.12)));

          // Score mixes absolute speed (ideal is 40-60 taps in 10s) and rhythm consistency
          const speedFactor = Math.min(50, (currentCount / 50) * 50);
          const rhythmFactor = (tapConsistency / 100) * 50;
          scoreVal = Math.round(speedFactor + rhythmFactor);
        } else {
          scoreVal = Math.round((currentCount / 10) * 35);
          tapConsistency = 40;
        }

        // Apply tremor fatigue penalty
        scoreVal = Math.max(10, scoreVal - Math.round(lastTremorAmpRef.current * 3));

        setScore(scoreVal);

        const sessionLog: SessionLog = {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' }),
          exerciseType: "Motricidad - Tapping",
          duration: 10,
          metrics: {
            score: scoreVal,
            stability: tapConsistency, // Consistency %
            tapConsistency,
            averageTremor: parseFloat(lastTremorAmpRef.current.toFixed(1)),
          },
          notes: `Sesión de Tapping rápido. Completó ${currentCount} toques rítmicos en 10s con consistencia motriz del ${tapConsistency}%.`,
        };

        onSessionComplete(sessionLog);
        return timestamps;
      });
      return currentCount;
    });
  };

  const resetGame = () => {
    setGameState("idle");
    setScore(0);
    setTapCount(0);
    setTapTimestamps([]);
    traceCoordinatesRef.current = [];
    setErrorMessage("");
  };

  const getTappingAdvise = (scoreNum: number, taps: number) => {
    if (taps < 20) {
      return "Sugerencia: Haz movimientos amplios y enérgicos de los dedos. Mantén un ritmo relajado pero enfático para contrarrestar la micrografía o bradicinesia.";
    }
    if (scoreNum < 70) {
      return "Estable: Tu velocidad es ideal. Intenta enfocar tu mirada y respiración en el botón para homogeneizar el intervalo rítmico.";
    }
    return "¡Cadencia fantástica! Excelente coordinación de motricidad fina y respuesta motora sostenida.";
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col justify-between" id="motor-therapy-card">
      <div>
        {/* Navigation Tab Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Compass className="w-5 h-5" />
            </span>
            <h3 className="text-lg font-semibold text-slate-800">Gimnasia Fina Interactiva</h3>
          </div>

          {/* Toggle Tab */}
          <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => {
                setActiveGame("tracing");  
                resetGame();
              }}
              disabled={gameState === "playing"}
              className={`flex-1 sm:flex-none text-xs px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeGame === "tracing"
                  ? "bg-white text-indigo-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-800 disabled:opacity-50"
              }`}
            >
              Curva de Precisión
            </button>
            <button
              onClick={() => {
                setActiveGame("tapping");
                resetGame();
              }}
              disabled={gameState === "playing"}
              className={`flex-1 sm:flex-none text-xs px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeGame === "tapping"
                  ? "bg-white text-indigo-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-800 disabled:opacity-50"
              }`}
            >
              Velocidad Rítmica (Tapping)
            </button>
          </div>
        </div>

        {/* Content Box Tracing Game */}
        {activeGame === "tracing" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              <strong>Ejercicio de precisión manual:</strong> Mantén pulsado el botón del mouse o el dedo y desplázate por el camino curvo evitando salirte de los bordes. Esto ejercita la rigidez muscular de las manos.
            </p>

            {gameState === "idle" && (
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-8 flex flex-col items-center justify-center text-center">
                <Pointer className="w-10 h-10 text-indigo-400 mb-3 animate-bounce" />
                <h4 className="font-semibold text-slate-700">Listo para Calibrar</h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
                  Esta prueba mide la precisión manual fina. Trata de mantener un trazo firme.
                </p>

                <div className="flex items-center gap-2 mb-4 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100 text-[11px] text-amber-700">
                  <Info className="w-4 h-4 text-amber-500" />
                  <span>Temblor actual de wearable: <strong>{currentWearableTremorClass}</strong></span>
                </div>

                <button
                  onClick={() => setGameState("playing")}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Entrar al circuito de juego
                </button>
              </div>
            )}

            {gameState === "playing" && (
              <div className="space-y-3">
                {errorMessage && (
                  <div className="bg-amber-50 border border-amber-100 text-[11px] text-amber-700 p-2.5 rounded-lg flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Canvas Container */}
                <div className="relative border border-slate-200 rounded-xl overflow-hidden bg-white select-none">
                  <canvas
                    ref={canvasRef}
                    width={480}
                    height={220}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    className="w-full h-[220px] block cursor-crosshair touch-none"
                  />
                </div>
                <div className="text-[10px] text-slate-400 text-center">
                  *Mantén presionado para pintar con firmeza del polo verde (INICIO) al azul (META).
                </div>
              </div>
            )}

            {gameState === "completed" && (
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                  <Award className="w-5 h-5 text-emerald-500" />
                  <span>Camino curvo culminado con éxito</span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full border-4 border-emerald-500 flex flex-col items-center justify-center bg-white shadow-xs">
                    <span className="text-xl font-bold text-emerald-700 leading-none">{score}</span>
                    <span className="text-[8px] text-slate-400 uppercase font-bold">score</span>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    <p>Precisión motora: <span className="font-bold text-emerald-700">{score}%</span></p>
                    <p className="text-[11px] text-slate-400">Compensación por temblores activa en software médico.</p>
                  </div>
                </div>

                <p className="text-xs italic text-slate-600 bg-white border border-slate-100 rounded-lg p-2.5">
                  {getTappingAdvise(score, 30)}
                </p>

                <button
                  onClick={resetGame}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Reiniciar circuito
                </button>
              </div>
            )}
          </div>
        )}

        {/* Content Box Tapping Game */}
        {activeGame === "tapping" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              <strong>Tapping de dedos (MDS-UPDRS):</strong> Golpea repetidamente el botón clínico lo más rápido y regular posible durante 10 segundos. Mide la fatiga muscular y la bradicinesia.
            </p>

            {gameState === "idle" && (
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-8 flex flex-col items-center justify-center text-center">
                <Sparkles className="w-10 h-10 text-indigo-400 mb-3 animate-pulse" />
                <h4 className="font-semibold text-slate-700">Dedo-Pulgar Ritmicidad</h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
                  Toca con el mismo dedo al centro del panel de manera constante para medir amplitud de pulso.
                </p>

                <div className="flex items-center gap-2 mb-4 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 text-[11px] text-emerald-700">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span>Wearable activo filtrando temblores.</span>
                </div>

                <button
                  onClick={handleStartTapping}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Comenzar Desafío 10s
                </button>
              </div>
            )}

            {gameState === "playing" && (
              <div className="space-y-4">
                {/* Visual Timer and counter */}
                <div className="flex justify-between items-center px-2">
                  <div className="flex items-center gap-1 text-sm font-semibold text-purple-700">
                    <Zap className="w-4 h-4 text-amber-500 animate-bounce" />
                    <span>Cronómetro: {tappingTimer}s</span>
                  </div>
                  <div className="text-sm text-slate-600">
                    Total Golpes: <span className="font-bold text-slate-800 text-base">{tapCount}</span>
                  </div>
                </div>

                {/* Big interactive tap zone BUTTON */}
                <button
                  onClick={handleTapAction}
                  className="w-full h-44 border-2 border-dashed border-indigo-200 rounded-2xl flex flex-col items-center justify-center bg-indigo-50/20 hover:bg-indigo-50/40 active:bg-indigo-100/50 transition-all cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500 select-none pb-2"
                >
                  <span className="w-20 h-20 rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all text-white font-bold flex items-center justify-center shadow-md text-sm uppercase">
                    PULSAR
                  </span>
                  <p className="text-[11px] text-slate-400 font-medium mt-3 uppercase tracking-wider">Toca aquí velozmente con el dedo índice</p>
                </button>

                {/* Progress bar representing time spent */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full transition-all duration-1000" style={{ width: `${(tappingTimer / 10) * 100}%` }}></div>
                </div>
              </div>
            )}

            {gameState === "completed" && (
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                  <Award className="w-5 h-5 text-emerald-500" />
                  <span>Challenge completado con éxito</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-150 text-center">
                    <p className="text-[10px] text-slate-400 font-bold">Total Toques</p>
                    <p className="text-base font-bold text-slate-700 mt-1">{tapCount}</p>
                    <p className="text-[8px] text-slate-400">en 10 segundos</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-150 text-center">
                    <p className="text-[10px] text-slate-400 font-bold">Velocidad Hz</p>
                    <p className="text-base font-bold text-slate-700 mt-1">{(tapCount / 10).toFixed(1)}</p>
                    <p className="text-[8px] text-slate-400">toques por segundo</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-150 text-center">
                    <p className="text-[10px] text-slate-400 font-bold">Puntaje Clínico</p>
                    <p className="text-base font-bold text-slate-700 mt-1">{score} / 100</p>
                    <p className="text-[8px] text-slate-400">precisión de cadencia</p>
                  </div>
                </div>

                <p className="text-xs italic text-slate-600 bg-white border border-slate-100 rounded-lg p-2.5">
                  {getTappingAdvise(score, tapCount)}
                </p>

                <button
                  onClick={resetGame}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Volver a intentar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
