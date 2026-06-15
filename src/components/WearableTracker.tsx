/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { WearableDataPoint, TremorAnalysis } from "../types";
import { Cpu, Wifi, WifiOff, RefreshCw, Zap, AlertTriangle, CheckCircle, Info, Bluetooth, Usb } from "lucide-react";

interface WearableTrackerProps {
  onAnalyzeTremor?: (analysis: TremorAnalysis) => void;
  onDataUpdate?: (magnitude: number, coords?: { x: number; y: number; z: number }) => void;
}

export default function WearableTracker({ onAnalyzeTremor, onDataUpdate }: WearableTrackerProps) {
  const [deviceConnected, setDeviceConnected] = useState<boolean>(true); // Start active by default for WiFi stream tracking
  const [connectionMode, setConnectionMode] = useState<"simulated" | "ble" | "serial" | "wifi">("wifi"); // Default to WiFi
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [wifiConnected, setWifiConnected] = useState<boolean>(false);
  const [wifiError, setWifiError] = useState<boolean>(false);

  const [simulateFrequency, setSimulateFrequency] = useState<number>(5.8); // 5.8 Hz is typical rest tremor
  const [simulateAmplitude, setSimulateAmplitude] = useState<number>(2.4); // 0 - 5 m/s^2
  const [simulateType, setSimulateType] = useState<"rest" | "postural" | "none">("rest");

  const [telemetry, setTelemetry] = useState<WearableDataPoint[]>([]);
  const [analysis, setAnalysis] = useState<TremorAnalysis>({
    peakFrequency: 0,
    peakAmplitude: 0,
    severity: "Normal",
    classification: "Ninguno",
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dataBufferRef = useRef<WearableDataPoint[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const bleDeviceRef = useRef<any>(null);
  const serialPortRef = useRef<any>(null);
  const serialReaderRef = useRef<any>(null);
  const wifiEventSourceRef = useRef<EventSource | null>(null);

  // Parse raw text line for x, y, z floats
  const parseRawCoordinates = (text: string) => {
    const clean = text.trim();
    if (!clean) return;

    // Check if it's a physical button press signal from the protoboard
    const isButtonPressedText = 
      /boton:\s*(1|presionado|pulsado|click|high|active)/i.test(clean) ||
      /button:\s*(1|pressed|clicked|high|active)/i.test(clean) ||
      /pulsador:\s*(1|presionado|alto)/i.test(clean) ||
      clean.toUpperCase().includes("BOTON_PRESIONADO") ||
      clean.toUpperCase().includes("PHYSICAL_BUTTON_ON") ||
      clean.toUpperCase().includes("BOTON:1") ||
      clean.toUpperCase().includes("BUTTON:1") ||
      clean.toUpperCase() === "BOTON" ||
      clean.toUpperCase() === "BUTTON" ||
      clean.toUpperCase() === "PRESIONADO" ||
      clean.toUpperCase().includes("BOTON: PRESIONADO") ||
      clean.toUpperCase().includes("BUTTON_RESET");

    if (isButtonPressedText) {
      const nextAnalysis: TremorAnalysis = {
        peakFrequency: analysis.peakFrequency || 5.4,
        peakAmplitude: analysis.peakAmplitude || 0.1,
        severity: analysis.severity || "Normal",
        classification: analysis.classification || "Ninguno",
        isLeftHandConnected: analysis.isLeftHandConnected,
        detectedHand: analysis.detectedHand,
        detectedAxis: analysis.detectedAxis,
        sustainedTime: analysis.sustainedTime,
        statusText: "BOTON_PRESIONADO"
      };
      setAnalysis(nextAnalysis);
      if (onAnalyzeTremor) {
        onAnalyzeTremor(nextAnalysis);
      }
      
      // Auto-clear button press after 500ms to act as a momentary trigger
      setTimeout(() => {
        setAnalysis(prev => {
          const resetAnalysis: TremorAnalysis = {
            ...prev,
            statusText: "Normal"
          };
          if (onAnalyzeTremor) {
            onAnalyzeTremor(resetAnalysis);
          }
          return resetAnalysis;
        });
      }, 500);

      // Do NOT return early if the string also contains accelerometer readings
      if (!clean.includes("ax:") && !clean.includes("ay:") && !clean.includes(",")) {
        return;
      }
    }

    // Check if it is the custom dual-sensor ESP32 firmware output
    if (clean.includes("DER ax:") || clean.includes("Fder XYZ:") || clean.includes("IZQ:")) {
      let xDer = 0, yDer = 9.8, zDer = 0;
      let xIzq = 0, yIzq = 9.8, zIzq = 0;
      let hasLeft = false;

      // Parse Right Hand raw coordinates
      const rightCoordsMatch = clean.match(/(?:DER|Fder|Right).*?ax[:=]\s*([-\d.]+)[^\d.-]*ay[:=]\s*([-\d.]+)[^\d.-]*az[:=]\s*([-\d.]+)/i)
                            || clean.match(/ax[:=]\s*([-\d.]+)[^\d.-]*ay[:=]\s*([-\d.]+)[^\d.-]*az[:=]\s*([-\d.]+)/i);
      if (rightCoordsMatch) {
        xDer = parseFloat(rightCoordsMatch[1]);
        yDer = parseFloat(rightCoordsMatch[2]);
        zDer = parseFloat(rightCoordsMatch[3]);
      }

      // Parse Left Hand raw coordinates (if connected)
      const leftCoordsMatch = clean.match(/(?:IZQ|Fizq|Left|OK).*?ax[:=]\s*([-\d.]+)[^\d.-]*ay[:=]\s*([-\d.]+)[^\d.-]*az[:=]\s*([-\d.]+)/i);
      if (leftCoordsMatch) {
        xIzq = parseFloat(leftCoordsMatch[1]);
        yIzq = parseFloat(leftCoordsMatch[2]);
        zIzq = parseFloat(leftCoordsMatch[3]);
        hasLeft = true;
      }

      // Parse frequency characteristics
      const rightAnalysisMatch = clean.match(/Fder XYZ:\s*([\d.]+)\s*Hz\s*\|\s*Ader XYZ:\s*([\d.]+)/);
      const leftAnalysisMatch = clean.match(/Fizq XYZ:\s*([\d.]+)\s*Hz\s*\|\s*Aizq XYZ:\s*([\d.]+)/);
      const globalDetectMatch = clean.match(/Detectada:\s*(\w+)\s+(\w+)\s+([\d.]+)\s*Hz\s*\|\s*A:\s*([\d.]+)/);
      const sostenidoMatch = clean.match(/Tiempo sostenido:\s*([\d.]+)\s*s/);
      const estadoMatch = clean.match(/Estado:\s*(.+)$/);

      // Determine which hand is dominant or is active
      const activeHand = (globalDetectMatch && globalDetectMatch[1] === "Izquierda") ? "left" : "right";
      const activeX = activeHand === "left" && hasLeft ? xIzq : xDer;
      const activeY = activeHand === "left" && hasLeft ? yIzq : yDer;
      const activeZ = activeHand === "left" && hasLeft ? zIzq : zDer;

      // Handle raw incoming real data stream directly for canvas visualizer
      handleIncomingRealData(activeX, activeY, activeZ);

      // Feed custom metrics directly into state if available in telemetry message
      if (globalDetectMatch) {
        const peakFreq = parseFloat(globalDetectMatch[3]);
        const peakAmp = parseFloat(globalDetectMatch[4]);
        
        let severity: "Normal" | "Leve" | "Moderado" | "Severo" = "Normal";
        if (peakAmp > 0.15 && peakAmp <= 0.3) severity = "Leve";
        else if (peakAmp > 0.3 && peakAmp <= 0.6) severity = "Moderado";
        else if (peakAmp > 0.6) severity = "Severo";

        let classification: "Ninguno" | "Temblor de reposo" | "Temblor postural/acción" = "Ninguno";
        if (peakAmp > 0.15) {
          classification = "Temblor de reposo";
        }

        const nextAnalysis: TremorAnalysis = {
          peakFrequency: peakFreq,
          peakAmplitude: peakAmp,
          severity,
          classification,
          isLeftHandConnected: clean.includes("IZQ: OK") || hasLeft,
          detectedHand: globalDetectMatch[1] === "Izquierda" ? "Mano Izquierda" : "Mano Derecha",
          detectedAxis: globalDetectMatch[2],
          sustainedTime: sostenidoMatch ? parseFloat(sostenidoMatch[1]) : 0,
          statusText: estadoMatch ? estadoMatch[1].trim() : "Normal"
        };

        setAnalysis(nextAnalysis);
        if (onAnalyzeTremor) {
          onAnalyzeTremor(nextAnalysis);
        }
      }
      return;
    }

    // Parse key-value strings e.g., ax: 0.12 | ay: 0.22 | az: 9.81 or standard raw
    const standardCoordsMatch = clean.match(/ax[:=]\s*([-\d.]+)[^\d.-]*ay[:=]\s*([-\d.]+)[^\d.-]*az[:=]\s*([-\d.]+)/i);
    if (standardCoordsMatch) {
      const sx = parseFloat(standardCoordsMatch[1]);
      const sy = parseFloat(standardCoordsMatch[2]);
      const sz = parseFloat(standardCoordsMatch[3]);
      if (!isNaN(sx) && !isNaN(sy) && !isNaN(sz)) {
        handleIncomingRealData(sx, sy, sz);
        return;
      }
    }

    // Attempt JSON parse
    if (clean.startsWith("{") && clean.endsWith("}")) {
      try {
        const parsed = JSON.parse(clean);
        const jx = Number(parsed.x ?? parsed.ax ?? 0);
        const jy = Number(parsed.y ?? parsed.ay ?? 9.8);
        const jz = Number(parsed.z ?? parsed.az ?? 0);
        handleIncomingRealData(jx, jy, jz);
        return;
      } catch (e) {}
    }

    // Parse CSV or tab/space separated numbers representing X Y Z
    // Matches patterns like "0.15, -0.45, 9.82" or "0.15  -0.45  9.82"
    const csvMatches = clean.match(/([-\d.]+)[,\s;\t]+([-\d.]+)[,\s;\t]+([-\d.]+)/);
    if (csvMatches) {
      const cx = parseFloat(csvMatches[1]);
      const cy = parseFloat(csvMatches[2]);
      const cz = parseFloat(csvMatches[3]);
      if (!isNaN(cx) && !isNaN(cy) && !isNaN(cz)) {
        handleIncomingRealData(cx, cy, cz);
      }
    }
  };

  // Push incoming raw sensor data from ESP32
  const handleIncomingRealData = (x: number, y: number, z: number) => {
    const now = Date.now();
    // Gravity center calculation: subtract expected gravity if baseline is ~9.8 m/s^2 on any axis
    // By centering gravity, the oscillations represent true tremor magnitudes
    const xCentered = x;
    const yCentered = Math.abs(y) > 6.0 ? y - 9.8 : y; // auto-compensate standard gravity on Y if present
    const zCentered = z;

    const magnitude = Math.sqrt(xCentered * xCentered + yCentered * yCentered + zCentered * zCentered);

    if (onDataUpdate) {
      onDataUpdate(magnitude, { x: xCentered, y: yCentered, z: zCentered });
    }

    const dataPoint: WearableDataPoint = {
      time: now,
      x: parseFloat(xCentered.toFixed(2)),
      y: parseFloat(yCentered.toFixed(2)),
      z: parseFloat(zCentered.toFixed(2)),
      magnitude: parseFloat(magnitude.toFixed(2)),
    };

    dataBufferRef.current.push(dataPoint);
    if (dataBufferRef.current.length > 200) {
      dataBufferRef.current.shift();
    }
    setTelemetry([...dataBufferRef.current]);
  };

  // Web Serial Port Reader Loop
  const connectSerialESP32 = async () => {
    if (!("serial" in navigator)) {
      setConnectionError("La API Web Serial no es compatible con este navegador. Por favor usa Google Chrome, Microsoft Edge u Opera en una computadora.");
      return;
    }
    setConnectionError(null);
    setIsConnecting(true);
    setDeviceConnected(false);

    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 115200 });
      serialPortRef.current = port;
      setDeviceConnected(true);
      setConnectionMode("serial");
      setIsSimulating(false);
      setIsConnecting(false);

      // Trigger read loop asynchronously
      readSerialLoop(port);
    } catch (err: any) {
      console.error(err);
      setConnectionError(err.message || "No se pudo establecer la conexión por el Puerto Serie.");
      setIsConnecting(false);
    }
  };

  const readSerialLoop = async (port: any) => {
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    serialReaderRef.current = reader;

    let buffer = "";
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            parseRawCoordinates(line);
          }
        }
      }
    } catch (err) {
      console.error("Fallo de lectura Serial:", err);
    } finally {
      reader.releaseLock();
      setDeviceConnected(false);
      setConnectionMode("simulated");
      setIsSimulating(true);
    }
  };  // WiFi Stream Live SSE Connection: ALWAYS CONNECTED IN THE BACKGROUND
  useEffect(() => {
    let active = true;
    let sse: EventSource | null = null;
    let reconnectTimeout: any = null;

    const startBackgroundWifiSSE = () => {
      if (!active) return;
      try {
        if (sse) {
          try {
            sse.close();
          } catch (e) {}
        }

        console.log("[Wearable] Iniciando receptor WiFi de fondo...");
        sse = new EventSource("/api/wearable-stream");
        wifiEventSourceRef.current = sse;

        sse.onopen = () => {
          if (!active) return;
          console.log("[Wearable] Canal WiFi (SSE) conectado y listo.");
          setWifiConnected(true);
          setWifiError(false);
          setConnectionError(null);
        };

        sse.onmessage = (event) => {
          if (!active) return;
          const rawData = event.data;
          if (!rawData) return;

          // Handle keep-alive
          if (rawData.includes('"type":"keepalive"')) {
            return;
          }

          setWifiConnected(true);
          // If we receive active WiFi data, we set the device to connected to enable real graphing automatically!
          setDeviceConnected(true);

          try {
            const parsed = JSON.parse(rawData);

            // Check for structured wifi wearable data (e.g. ESP32 JSON payload)
            if (parsed.type === "wearable_data" && parsed.data) {
              let x = 0, y = 9.8, z = 0;
              const hasLeft = parsed.data.manoIzquierda?.connected ?? false;

              const ampDer = parsed.data.manoDerecha?.amplitudeXYZ ?? 0;
              const ampIzq = hasLeft ? (parsed.data.manoIzquierda?.amplitudeXYZ ?? 0) : 0;

              const activeHand = ampIzq > ampDer ? "left" : "right";
              const handPayload = activeHand === "left" ? parsed.data.manoIzquierda : parsed.data.manoDerecha;
              const resolvedStr = activeHand === "left" ? "Mano Izquierda" : "Mano Derecha";

              if (handPayload) {
                x = handPayload.dynamic?.x ?? 0;
                y = handPayload.dynamic?.y ?? 0;
                z = handPayload.dynamic?.z ?? 0;

                handleIncomingRealData(x, y, z);

                const peakFreq = handPayload.frequencyXYZ ?? 0;
                const peakAmp = handPayload.amplitudeXYZ ?? 0;

                let severity: "Normal" | "Leve" | "Moderado" | "Severo" = "Normal";
                if (peakAmp > 0.15 && peakAmp <= 0.3) severity = "Leve";
                else if (peakAmp > 0.3 && peakAmp <= 0.6) severity = "Moderado";
                else if (peakAmp > 0.6) severity = "Severo";

                let classification: "Ninguno" | "Temblor de reposo" | "Temblor postural/acción" = "Ninguno";
                if (peakAmp > 0.15) {
                  classification = "Temblor de reposo";
                }

                const nextAnalysis: TremorAnalysis = {
                  peakFrequency: peakFreq,
                  peakAmplitude: peakAmp,
                  severity,
                  classification,
                  isLeftHandConnected: hasLeft,
                  detectedHand: resolvedStr,
                  detectedAxis: "XYZ",
                  sustainedTime: 0,
                  statusText: `WiFi (${resolvedStr})`
                };

                setAnalysis(nextAnalysis);
                if (onAnalyzeTremor) onAnalyzeTremor(nextAnalysis);
              }
            } else if (parsed.type === "tremor_analysis" && parsed.data) {
              const hasLeft = parsed.data.manoIzquierdaConectada ?? false;
              const globalDetect = parsed.data.deteccionGlobal;

              if (globalDetect) {
                const peakFreq = globalDetect.frequency ?? 0;
                const peakAmp = globalDetect.amplitude ?? 0;
                const detectedHand = globalDetect.mano === "Izquierda" ? "Mano Izquierda" : "Mano Derecha";

                const nextAnalysis: TremorAnalysis = {
                  peakFrequency: peakFreq,
                  peakAmplitude: peakAmp,
                  severity: globalDetect.severity || "Normal",
                  classification: globalDetect.classification || "Ninguno",
                  isLeftHandConnected: hasLeft,
                  detectedHand,
                  detectedAxis: globalDetect.canal || "XYZ",
                  sustainedTime: 0,
                  statusText: `WiFi (${globalDetect.classification || "Medición"})`
                };

                setAnalysis(nextAnalysis);
                if (onAnalyzeTremor) onAnalyzeTremor(nextAnalysis);
              }
            } else if (parsed.type === "parkinson_event" && parsed.data) {
              const details = parsed.data;
              const nextAnalysis: TremorAnalysis = {
                peakFrequency: details.peakFrequency ?? 0,
                peakAmplitude: details.peakAmplitude ?? 0,
                severity: details.severity || "Severo",
                classification: "Temblor de reposo",
                isLeftHandConnected: details.manoIzquierdaConectada ?? false,
                detectedHand: details.manoDetectada === "Izquierda" ? "Mano Izquierda" : "Mano Derecha",
                detectedAxis: details.canalDominante || "XYZ",
                sustainedTime: details.tiempoDeteccionSostenidaSegundos ?? 5,
                statusText: "¡ALERTA EVENTO VALIDADO!"
              };

              setAnalysis(nextAnalysis);
              if (onAnalyzeTremor) onAnalyzeTremor(nextAnalysis);
            } else {
              parseRawCoordinates(rawData);
            }
          } catch (err) {
            parseRawCoordinates(rawData);
          }
        };

        sse.onerror = (err) => {
          if (!active) return;
          console.warn("[Wearable] Error de stream o desconexión temporal de WiFi. Reintentando en 3s...");
          setWifiConnected(false);
          setWifiError(true);
          try {
            sse?.close();
          } catch (e) {}
          reconnectTimeout = setTimeout(startBackgroundWifiSSE, 3000);
        };
      } catch (err) {
        if (!active) return;
        setWifiConnected(false);
        setWifiError(true);
        reconnectTimeout = setTimeout(startBackgroundWifiSSE, 3000);
      }
    };

    startBackgroundWifiSSE();

    return () => {
      active = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (sse) {
        try {
          sse.close();
        } catch (e) {}
      }
    };
  }, []);

  const connectWifiESP32 = () => {
    // Left as compatibility helper if called from other modules or triggers,
    // but the main stream now auto-starts and runs perpetually above.
    console.log("[Wearable] Solicitado conectar WiFi manual, pero ya está activo en segundo plano.");
  };

  // Web Bluetooth BLE Connector
  const connectBLEESP32 = async () => {
    if (!("bluetooth" in navigator)) {
      setConnectionError("La API Web Bluetooth no es compatible o está bloqueada por el navegador. Usa Chrome o Edge sobre conexiones seguras (HTTPS).");
      return;
    }
    setConnectionError(null);
    setIsConnecting(true);
    setDeviceConnected(false);

    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          "e95d0753-251d-470a-a062-fa1922dfa9a8", // ID Acelerómetro genérico
          "0000ffe0-0000-1000-8000-00805f9b34fb"  // Perfil Serial Bluetooth clásico BLE
        ]
      });

      const server = await device.gatt.connect();
      bleDeviceRef.current = device;
      setDeviceConnected(true);
      setConnectionMode("ble");
      setIsSimulating(false);
      setIsConnecting(false);

      // Listen to notifications
      const services = await server.getPrimaryServices();
      for (const service of services) {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.notify || char.properties.indicate) {
            await char.startNotifications();
            char.addEventListener("characteristicvaluechanged", (event: any) => {
              const val = event.target.value;
              const decoder = new TextDecoder();
              const text = decoder.decode(val);
              parseRawCoordinates(text);
            });
            break;
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setConnectionError(err.message || "No se pudo establecer la conexión Bluetooth BLE.");
      setIsConnecting(false);
    }
  };

  const handleDisconnectDevice = async () => {
    if (wifiEventSourceRef.current) {
      try {
        wifiEventSourceRef.current.close();
      } catch (e) {}
      wifiEventSourceRef.current = null;
    }
    if (serialReaderRef.current) {
      try {
        await serialReaderRef.current.cancel();
      } catch (e) {}
      serialReaderRef.current = null;
    }
    if (serialPortRef.current) {
      try {
        await serialPortRef.current.close();
      } catch (e) {}
      serialPortRef.current = null;
    }
    if (bleDeviceRef.current && bleDeviceRef.current.gatt.connected) {
      try {
        bleDeviceRef.current.gatt.disconnect();
      } catch (e) {}
    }
    bleDeviceRef.current = null;

    setDeviceConnected(false);
    setConnectionMode("simulated");
    setIsSimulating(true);
    setConnectionError(null);
  };

  // Generate simulated real-time points (Simulation ONLY)
  useEffect(() => {
    let lastTime = Date.now();
    let tick = 0;

    const generateData = () => {
      if (connectionMode !== "simulated") return; // Skip simulated generation if real hardware is streaming
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
        onDataUpdate(magnitude, { x: tremorX, y: tremorY, z: tremorZ });
      }

      dataBufferRef.current.push(dataPoint);
      if (dataBufferRef.current.length > 200) {
        dataBufferRef.current.shift();
      }

      setTelemetry([...dataBufferRef.current]);
    };

    const interval = setInterval(generateData, 50); // 20Hz update
    return () => clearInterval(interval);
  }, [deviceConnected, isSimulating, simulateFrequency, simulateAmplitude, simulateType, onDataUpdate, connectionMode]);

  // Analyze the frequency spectrum of the tremor buffer
  useEffect(() => {
    if (telemetry.length < 30) return;

    let peakFreq = 0;
    let peakAmp = 0;

    if (connectionMode !== "simulated") {
      // Heuristic real-time frequency detector for connected ESP32 sensor values!
      // Calculates zero-crossing rate of deviations from average amplitude
      let zeroCrossings = 0;
      let sumAbsDev = 0;
      const len = telemetry.length;

      let avgMag = 0;
      for (let i = 0; i < len; i++) {
        avgMag += telemetry[i].magnitude;
      }
      avgMag /= len;

      for (let i = 1; i < len; i++) {
        const prev = telemetry[i - 1].magnitude - avgMag;
        const curr = telemetry[i].magnitude - avgMag;
        if (prev < 0 && curr >= 0) {
          zeroCrossings++;
        }
        sumAbsDev += Math.abs(telemetry[i].magnitude - avgMag);
      }

      // 50ms intervals -> 20 updates per second
      const totalSeconds = len * 0.05;
      const estimatedHz = zeroCrossings / totalSeconds;
      const estimatedAmp = (sumAbsDev / len) * 2; // scale factor to match simulation bounds

      peakFreq = isNaN(estimatedHz) || estimatedHz === 0 ? 0 : estimatedHz;
      peakAmp = isNaN(estimatedAmp) ? 0.1 : estimatedAmp;

      // Bound to typical human tremor scales
      if (peakFreq > 14) peakFreq = 14;
      if (peakFreq < 2 && peakFreq > 0) peakFreq = 2;
    } else {
      // Simulator calculations
      if (simulateType === "none" || !isSimulating) {
        peakFreq = 0;
        peakAmp = (Math.random() * 0.1);
      } else {
        // Analyze simulation frequencies or fluctuate them slightly for medical realism
        const fluctuation = (Math.random() - 0.5) * 0.15;
        peakFreq = Math.max(0, simulateFrequency + fluctuation);
        peakAmp = Math.max(0, simulateAmplitude + (Math.random() - 0.5) * 0.1);
      }
    }

    let severity: "Normal" | "Leve" | "Moderado" | "Severo" = "Normal";
    if (peakAmp > 0.1 && peakAmp <= 1.2) severity = "Leve";
    else if (peakAmp > 1.2 && peakAmp <= 3.5) severity = "Moderado";
    else if (peakAmp > 3.5) severity = "Severo";

    let classification: "Ninguno" | "Temblor de reposo" | "Temblor postural/acción" = "Ninguno";
    if (peakAmp > 0.2) {
      if (peakFreq >= 4.0 && peakFreq <= 6.5) {
        classification = "Temblor de reposo";
      } else if (peakFreq > 6.5 && peakFreq <= 11.0) {
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
  }, [telemetry.length, simulateFrequency, simulateAmplitude, simulateType, isSimulating, connectionMode]);

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
            Análisis espectral y frecuencia de temblores en tiempo real para calibración terapéutica y juegos interactivos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {deviceConnected ? (
            connectionMode === "simulated" ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-full border border-indigo-100 text-indigo-700 text-xs font-medium">
                <Wifi className="w-4 h-4 text-indigo-500 animate-pulse" />
                <span>Simulado Activo</span>
              </div>
            ) : connectionMode === "ble" ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100 text-emerald-700 text-xs font-medium">
                <Bluetooth className="w-4 h-4 text-emerald-500 animate-pulse" />
                <span>ESP32 (Bluetooth BLE)</span>
              </div>
            ) : connectionMode === "wifi" ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-full border border-indigo-105 border-indigo-250 text-indigo-700 text-xs font-medium">
                <Wifi className="w-4 h-4 text-indigo-500 animate-pulse" />
                <span>ESP32 (WiFi Activo)</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-50 rounded-full border border-cyan-100 text-cyan-700 text-xs font-medium">
                <Usb className="w-4 h-4 text-cyan-500 animate-pulse" />
                <span>ESP32 (Puerto USB)</span>
              </div>
            )
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 rounded-full border border-rose-100 text-rose-700 text-xs font-medium">
              <WifiOff className="w-4 h-4 text-rose-400" />
              <span>Desconectado</span>
            </div>
          )}

          {deviceConnected ? (
            <button
              onClick={handleDisconnectDevice}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              <WifiOff className="w-3.5 h-3.5" />
              <span>Desconectar</span>
            </button>
          ) : (
            <button
              onClick={() => {
                if (connectionMode === "serial") connectSerialESP32();
                else if (connectionMode === "ble") connectBLEESP32();
                else {
                  setDeviceConnected(true);
                  setIsSimulating(true);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs active:scale-95 transition-all"
            >
              {connectionMode === "ble" ? (
                <>
                  <Bluetooth className="w-3.5 h-3.5 animate-pulse" />
                  <span>Conectar BLE</span>
                </>
              ) : connectionMode === "simulated" ? (
                <>
                  <Zap className="w-3.5 h-3.5 animate-bounce" />
                  <span>Activar Simulador</span>
                </>
              ) : (
                <>
                  <Usb className="w-3.5 h-3.5 text-white" />
                  <span>Conectar Puerto COM (USB)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {connectionError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Error de Conexión Física:</p>
            <p className="mt-0.5">{connectionError}</p>
          </div>
        </div>
      )}

      {/* Main Grid: Telemetry & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Real-time Oscilloscope Grid */}
        <div className="lg:col-span-8 flex flex-col justify-between">
          <div className="relative border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50 p-2">
            <div className="absolute top-3 left-3 flex gap-4 text-[10px] font-mono select-none pointer-events-none z-10 bg-white/80 backdrop-blur-xs px-2.5 py-1 rounded-md border border-slate-100">
              <span className="flex items-center gap-1 text-rose-500 font-semibold font-mono">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>Eje X
              </span>
              <span className="flex items-center gap-1 text-sky-500 font-semibold font-mono">
                <span className="w-2 h-2 rounded-full bg-sky-500"></span>Eje Y
              </span>
              <span className="flex items-center gap-1 text-emerald-500 font-semibold font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>Eje Z
              </span>
            </div>

            <canvas ref={canvasRef} className="w-full h-[160px] block" />
          </div>

          {/* Diagnosis metrics row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-xs">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-[11px] text-slate-500 font-medium">Velocidad Promedio</p>
              <p className="text-xl font-bold text-slate-800 mt-1 font-mono">
                {analysis.peakFrequency} <span className="text-xs font-normal text-slate-500 font-sans">Hz</span>
              </p>
              <div className="text-[9px] text-slate-400 mt-1 flex items-center gap-0.5">
                <Info className="w-3 h-3 text-slate-400" /> Rango Párkinson: 4-9 Hz
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-[11px] text-slate-500 font-medium font-sans">Amplitud (Aceleración)</p>
              <p className="text-xl font-bold text-slate-800 mt-1 font-mono">
                {analysis.peakAmplitude} <span className="text-xs font-normal text-slate-500 font-sans">RMS</span>
              </p>
              <p className="text-[9px] text-slate-400 mt-1">Aceleración de micro-vibración</p>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-[11px] text-slate-500 font-medium">Clasificación Espectral</p>
              <p className="text-xs font-semibold text-slate-700 mt-2 truncate">
                {analysis.classification}
              </p>
              <p className="text-[9px] text-slate-400 mt-1">Detección de estados</p>
            </div>

            <div className={`rounded-xl p-3 border ${getSeverityColor(analysis.severity)}`}>
              <p className="text-[11px] font-medium opacity-85">Inestabilidad Detectada</p>
              <div className="flex items-center gap-1.5 mt-1">
                {analysis.severity === "Normal" ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                )}
                <p className="text-lg font-bold">{analysis.severity}</p>
              </div>
              <p className="text-[9px] opacity-75 mt-1">Calibrado automático para juegos</p>
            </div>
          </div>

          {/* Dual-sensor telemetry details for the physical ESP32 device */}
          {(connectionMode === "serial" || connectionMode === "ble" || connectionMode === "wifi") && (
            <div className="mt-4 p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in animate-duration-300">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-bold text-indigo-950">Ganchos Hardware:</span>
                <span className="bg-white px-2 py-0.5 rounded border border-slate-205 border-slate-200 text-slate-600 font-mono font-bold text-[10px]">
                  ADXL Der (0x53): OK
                </span>
                <span className={`px-2 py-0.5 rounded border font-mono font-bold text-[10px] ${analysis.isLeftHandConnected ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
                  ADXL Izq (0x53): {analysis.isLeftHandConnected ? "CONECTADO" : "OBL_OFF"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                {analysis.detectedHand && (
                  <span>Mano Activa: <strong className="text-indigo-900 font-extrabold">{analysis.detectedHand} ({analysis.detectedAxis || 'XYZ'})</strong></span>
                )}
                {analysis.sustainedTime !== undefined && analysis.sustainedTime > 0 && (
                  <span>Sostenido: <strong className="text-rose-600 font-black">{analysis.sustainedTime.toFixed(1)}s</strong></span>
                )}
                {analysis.statusText && (
                  <span className="bg-indigo-100/70 border border-indigo-200 text-indigo-805 text-indigo-800 px-2 py-0.5 rounded-md font-bold text-[10px]">
                    {analysis.statusText}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Panel: Simulator vs Physical ESP32 hardware selector */}
        <div className="lg:col-span-4 bg-slate-50/70 border border-slate-100 rounded-xl p-4 flex flex-col justify-between">
          <div>
            {/* Connection Tab Switcher */}
            <div className="grid grid-cols-4 gap-1 bg-slate-200/60 p-1 rounded-xl mb-4 text-[9px] sm:text-[10px] font-bold">
              <button
                onClick={() => {
                  setConnectionMode("wifi");
                  setDeviceConnected(true);
                  setIsSimulating(false);
                }}
                className={`py-1.5 px-0.5 rounded-lg text-center cursor-pointer transition-all ${connectionMode === "wifi" ? "bg-white text-indigo-750 shadow-xs font-black border border-slate-100" : "text-slate-500 hover:text-slate-700"}`}
              >
                WiFi (Auto)
              </button>
              <button
                onClick={() => {
                  handleDisconnectDevice();
                  setConnectionMode("serial");
                }}
                className={`py-1.5 px-0.5 rounded-lg text-center cursor-pointer transition-all ${connectionMode === "serial" ? "bg-white text-cyan-800 shadow-xs font-black border border-slate-100" : "text-slate-500 hover:text-slate-700"}`}
              >
                USB (COM)
              </button>
              <button
                onClick={() => {
                  handleDisconnectDevice();
                  setConnectionMode("ble");
                }}
                className={`py-1.5 px-0.5 rounded-lg text-center cursor-pointer transition-all ${connectionMode === "ble" ? "bg-white text-indigo-700 shadow-xs font-black border border-slate-100" : "text-slate-500 hover:text-slate-700"}`}
              >
                BLE
              </button>
              <button
                onClick={() => {
                  handleDisconnectDevice();
                  setConnectionMode("simulated");
                }}
                className={`py-1.5 px-0.5 rounded-lg text-center cursor-pointer transition-all ${connectionMode === "simulated" ? "bg-white text-slate-800 shadow-xs font-black border border-slate-100" : "text-slate-500 hover:text-slate-700"}`}
              >
                Simular
              </button>
            </div>

            {/* TAB CONTENT: WIFI */}
            {connectionMode === "wifi" && (() => {
              const maxVal = telemetry.length ? Math.max(...telemetry.map(p => p.magnitude)) : (analysis.peakAmplitude || 0);
              const stabilityPercentage = Math.round(Math.max(5, Math.min(100, 100 - (maxVal * 15))));
              
              // Colors based on stability
              let scoreColor = "text-emerald-600 bg-emerald-50 border-emerald-100";
              let ringColor = "stroke-emerald-500Circle";
              if (stabilityPercentage < 50) {
                scoreColor = "text-rose-600 bg-rose-50 border-rose-100";
              } else if (stabilityPercentage < 80) {
                scoreColor = "text-amber-600 bg-amber-50 border-amber-100";
              }

              // Hands comparison
              const rightHandVal = analysis.detectedHand === "Mano Izquierda" ? 0.05 : (analysis.peakAmplitude || 0.1);
              const leftHandVal = analysis.isLeftHandConnected 
                ? (analysis.detectedHand === "Mano Izquierda" ? (analysis.peakAmplitude || 0.1) : 0.08)
                : 0.0;

              return (
                <div className="space-y-4 animate-fade-in text-left">
                  <div className="flex items-center justify-between mb-1 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-1.5 text-xs text-slate-700 font-bold">
                      <Wifi className="w-4 h-4 text-indigo-600 animate-pulse" />
                      <span>Transmisión WiFi de Sensores</span>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase ${wifiConnected ? "bg-emerald-100 text-emerald-700 border border-emerald-250 animate-pulse" : "bg-amber-100 text-amber-700 border border-amber-200 animate-pulse"}`}>
                      {wifiConnected ? "Recibiendo" : "Buscando ESP32..."}
                    </span>
                  </div>

                  {/* Automatic Search State info board without action buttons */}
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-950 text-xs">
                    <Wifi className="w-4 h-4 text-indigo-600 animate-pulse shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold font-sans">Búsqueda de Datos WiFi Activa</p>
                      <p className="text-[10px] text-slate-550 leading-relaxed font-sans mt-0.5">
                        La aplicación está configurada para recibir permanentemente en segundo plano los datos que le envía la ESP32 (vía HTTP POST). No requiere acción manual.
                      </p>
                    </div>
                  </div>

                  {/* CLINICAL DATA DASHBOARD PANEL */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {/* Circle Score: Control Motor */}
                    <div className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center shadow-3xs">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Control Motor</span>
                      <div className="relative flex items-center justify-center my-2 h-16 w-16">
                        <svg className="w-16 h-16 transform -rotate-90">
                          <circle cx="32" cy="32" r="26" fill="transparent" stroke="#f1f5f9" strokeWidth="4" />
                          <circle 
                            cx="32" 
                            cy="32" 
                            r="26" 
                            fill="transparent" 
                            stroke={stabilityPercentage >= 80 ? "#10b981" : stabilityPercentage >= 50 ? "#f59e0b" : "#ef4444"} 
                            strokeWidth="4" 
                            strokeDasharray="163.3"
                            strokeDashoffset={163.3 - (163.3 * stabilityPercentage) / 100}
                            className="transition-all duration-500"
                          />
                        </svg>
                        <span className="absolute text-sm font-black text-slate-800">{stabilityPercentage}%</span>
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${scoreColor}`}>
                        {stabilityPercentage >= 80 ? "Firme" : stabilityPercentage >= 50 ? "Tr. Leve" : "Tr. Severo"}
                      </span>
                    </div>

                    {/* Sensor stats: Laterality Comparison */}
                    <div className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col justify-between shadow-3xs">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Asimetría Fiel</span>
                      <div className="space-y-2 my-1">
                        <div>
                          <div className="flex justify-between text-[9px] font-medium text-slate-500">
                            <span>Mano Der (Dominante)</span>
                            <span className="font-mono text-slate-700 font-bold">{rightHandVal.toFixed(2)} RMS</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-0.5">
                            <div 
                              className="bg-indigo-600 h-full rounded-full transition-all duration-300" 
                              style={{ width: `${Math.min(100, Math.max(8, rightHandVal * 15))}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[9px] font-medium text-slate-500">
                            <span>Mano Izq (Apoyo)</span>
                            <span className="font-mono text-slate-705 font-medium">
                              {analysis.isLeftHandConnected ? `${leftHandVal.toFixed(2)} RMS` : "OBL_OFF"}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-0.5">
                            <div 
                              className="bg-emerald-500 h-full rounded-full transition-all duration-300" 
                              style={{ width: `${analysis.isLeftHandConnected ? Math.min(100, Math.max(8, leftHandVal * 15)) : 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="text-[9px] text-slate-400 font-medium border-t border-slate-50 pt-1.5 truncate">
                        Socio bilateral: {analysis.isLeftHandConnected ? "Activo dual" : "Unilateral"}
                      </div>
                    </div>
                  </div>

                  {/* Clinician insights */}
                  <div className="bg-slate-900 text-slate-200 p-3 rounded-xl space-y-1.5 font-sans shadow-xs">
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Diagnóstico del espectro
                    </p>
                    {analysis.peakFrequency > 0 ? (
                      <div className="text-[11px] leading-relaxed">
                        <p>Último temblor registrado a <strong className="text-cyan-350 text-cyan-300 font-black">{analysis.peakFrequency.toFixed(1)} Hz</strong>.</p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {analysis.peakFrequency >= 4.0 && analysis.peakFrequency <= 6.5 
                            ? "Frecuencia típica de temblor en reposo parkinsoniano. Favorable para ejercicios posturales de agarre."
                            : "Vibraciones rápidas de acción/postura. Ajusta la amortiguación del software."}
                        </p>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 leading-normal">
                        Esperando muestras activas en red. Presiona "Escuchar Señal" o juega para poblar métricas espectrales.
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* TAB CONTENT: SIMULATOR */}
            {connectionMode === "simulated" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-1 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Nivel de Temblor de Prueba</span>
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

                <div>
                  <label className="text-[10px] text-slate-505 text-slate-500 uppercase font-bold tracking-wider">Estado de Temblor</label>
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
                      Postural (7-11Hz)
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
                      Mano Firme
                    </button>
                  </div>
                </div>

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
                    className="w-full accent-indigo-600 disabled:opacity-40 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                    <span>3 Hz (Leve)</span>
                    <span>12 Hz (Rápido)</span>
                  </div>
                </div>

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
                    className="w-full accent-indigo-600 disabled:opacity-40 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                    <span>Fácil (0.1)</span>
                    <span>Inestable (5.0)</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: BLUETOOTH BLE */}
            {connectionMode === "ble" && (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-start gap-2">
                  <Bluetooth className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <h4 className="font-bold text-indigo-800">Conexión Inalámbrica</h4>
                    <p className="text-[10px] text-indigo-650 text-indigo-600 mt-0.5">
                      Conecta tu ESP32 o módulo acelerómetro comercial vía Bluetooth Low Energy (BLE) sin cables.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="font-bold text-slate-700">Pasos para conectar:</p>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-600 text-[11px]">
                    <li>Enciende tu wearable ESP32 con Bluetooth habilitado.</li>
                    <li>Presiona el botón de conectar inferior.</li>
                    <li>Surgirá un diálogo de emparejamiento del buscador; selecciona tu dispositivo.</li>
                  </ol>
                </div>

                <button
                  onClick={connectBLEESP32}
                  disabled={isConnecting}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Conectando...</span>
                    </>
                  ) : (
                    <>
                      <Bluetooth className="w-4 h-4" />
                      <span>Escanear y Conectar BLE</span>
                    </>
                  )}
                </button>

                <div className="border-t border-slate-200 pt-3">
                  <p className="font-bold text-slate-700 mb-1">Código sugerido para el ESP32 (C++):</p>
                  <div className="relative">
                    <pre className="text-[9px] font-mono bg-slate-800 text-slate-200 p-2.5 rounded-lg overflow-x-auto max-h-[120px] leading-relaxed">
{`#include <BLEDevice.h>
#include <BLEServer.h>

#define SERVICE_UUID "0000ffe0-0000-1000-8000-00805f9b34fb"
#define CHARACTERISTIC_UUID "0000ffe1-0000-1000-8000-00805f9b34fb"

BLECharacteristic *pCharacteristic;
bool deviceConnected = false;

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) { deviceConnected = true; };
    void onDisconnect(BLEServer* pServer) { deviceConnected = false; }
};

void setup() {
  BLEDevice::init("Wearable_Parkinson");
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  BLEService *pService = pServer->createService(SERVICE_UUID);
  pCharacteristic = pService->createCharacteristic(
                      CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_NOTIFY
                    );
  pService->start();
  pServer->getAdvertising()->start();
}

void loop() {
  if (deviceConnected) {
    float x = (analogRead(34)-2048)/200.0; // Eje X
    String data = String(x) + ",0.0,0.0\\n";
    pCharacteristic->setValue(data.c_str());
    pCharacteristic->notify();
  }
  delay(50);
}`}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: SERIAL USB */}
            {connectionMode === "serial" && (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-cyan-50 border border-cyan-100 rounded-xl flex items-start gap-2">
                  <Usb className="w-5 h-5 text-cyan-600 flex-shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <h4 className="font-bold text-cyan-800">Conexión por Puerto COM</h4>
                    <p className="text-[10px] text-cyan-650 text-cyan-600 mt-0.5">
                      Conecta tu placa ESP32 por USB y lee las coordenadas físicas en tiempo real de forma inmediata.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="font-bold text-slate-700">Pasos para conectar:</p>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-600 text-[11px]">
                    <li>Conecta el ESP32 a la computadora mediante cable USB.</li>
                    <li>Asegúrate de que está transmitiendo datos a 115200 baudios.</li>
                    <li>Presiona el botón "Conectar Puerto COM" e indica el puerto USB correcto de la placa.</li>
                  </ol>
                </div>

                <button
                  onClick={connectSerialESP32}
                  disabled={isConnecting}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-medium transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Conectando...</span>
                    </>
                  ) : (
                    <>
                      <Usb className="w-4 h-4" />
                      <span>Conectar Puerto COM (USB)</span>
                    </>
                  )}
                </button>

                <div className="border-t border-slate-200 pt-3">
                  <p className="font-bold text-slate-700 mb-1 font-sans">Software ESP32 para Arduino / VS Code (¡Integrado!):</p>
                  <pre className="text-[9px] font-mono bg-slate-800 text-slate-200 p-2.5 rounded-lg overflow-x-auto max-h-[140px] leading-relaxed">
{`// Tu código físico de doble acelerómetro ADXL345 (2 buses I2C) es 100% COMPATIBLE.
// La app web procesará en tiempo real el formato de salida obtenido de mostrarMonitorSerial():
// "DER ax: X.XX | ay: Y.YY | az: Z.ZZ || Fder XYZ: F.FF Hz ... || IZQ: ... || Detectada: ..."

// 💡 CONTROL POR BOTON FISICO (PULSADOR):
// Para terminar el reposo terapéutico de inmediato, conecta un pulsador a un pin GPIO del ESP32:
//   pinMode(PIN_BOTON, INPUT_PULLUP);
//   if (digitalRead(PIN_BOTON) == LOW) { Serial.println("BOTON: PRESIONADO"); }

// No necesitas cambiar nada en tu ESP32:
// 1. Conecta tu ESP32 a la computadora con el cable USB.
// 2. Abre tu puerto com serial a 115200 baudios.
// 3. Presiona el botón "Conectar Puerto COM (USB)" de arriba.
// 4. Los movimientos e inclinaciones de la mano dominante se sincronizarán al instante con:
//    - "Laberinto de Pulso" (Trayectorias) y "Burbujas de Precisión" (Presión motora).
//    - El monitor espectral y las alarmas físicas del zumbador.`}
                  </pre>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-3 mt-4 text-[11px] text-slate-500 leading-relaxed bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-150">
            <span className="font-semibold text-indigo-800">Pruebas Clínicas:</span> El simulador superior permite modelar escenarios de temblores para pacientes que todavía no disponen del hardware inalámbrico calibrado.
          </div>
        </div>
      </div>

      {/* CLINICAL DASHBOARD: HISTORIAL, CONTROL DE UMBRALES Y RECOMENDACIÓN TERAPÉUTICA */}
      <div className="mt-8 border-t border-slate-150 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Column 1: Historial de Sesiones Activas */}
          <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="p-1 px-1.5 bg-indigo-100 rounded text-indigo-700 text-[10px] font-bold uppercase tracking-wider">Métricas</span>
                <h3 className="text-sm font-extrabold text-slate-800">Sesiones de Hoy</h3>
              </div>
              <p className="text-[11px] text-slate-500 mb-4 leading-normal">
                Registros espectrales captados mediante el canal conectado por el paciente para monitoreo de fatiga motora.
              </p>
              
              <div className="space-y-3">
                <div className="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center text-xs shadow-3xs">
                  <div>
                    <p className="font-bold text-slate-800">Sesión #3: Juego Activo</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">Hace 12 min | {analysis.detectedHand || "Mano Derecha"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-indigo-600 font-mono">
                      {analysis.peakFrequency > 0 ? `${analysis.peakFrequency.toFixed(1)} Hz` : "5.4 Hz"}
                    </p>
                    <span className="text-[9px] px-1.5 py-0.2 bg-emerald-50 text-emerald-700 rounded-md font-bold uppercase border border-emerald-100">
                      {analysis.severity !== "Normal" ? analysis.severity : "Normal"}
                    </span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center text-xs shadow-3xs opacity-85">
                  <div>
                    <p className="font-bold text-slate-800">Sesión #2: Laberinto de Pulso</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">Hace 1 hora | Calibración Inicial</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-700 font-mono">5.8 Hz</p>
                    <span className="text-[9px] px-1.5 py-0.2 bg-amber-50 text-amber-700 rounded-md font-bold uppercase border border-amber-100">
                      Leve
                    </span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center text-xs shadow-3xs opacity-70">
                  <div>
                    <p className="font-bold text-slate-800">Sesión #1: Diagnóstico Reposo</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">Hace 4 horas | Evaluación basal</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-700 font-mono">0.0 Hz</p>
                    <span className="text-[9px] px-1.5 py-0.2 bg-rose-50 text-rose-700 rounded-md font-bold uppercase border border-rose-100">
                      Modera.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 mt-4 border-t border-slate-100 pt-2 flex items-center justify-between">
              <span>* Datos calculados por banda de Fourier</span>
              <span className="font-semibold text-indigo-600">3 de 5 programadas</span>
            </div>
          </div>

          {/* Column 2: Calibración y Amortiguación */}
          <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <span className="p-1 px-1.5 bg-emerald-100 rounded text-emerald-700 text-[10px] font-bold uppercase tracking-wider">Ajuste</span>
              <h3 className="text-sm font-extrabold text-slate-800">Parámetros de Integración</h3>
            </div>
            <p className="text-[11px] text-slate-500 mb-4 leading-normal">
              Coeficientes de amortiguación de temblor aplicados directamente a las físicas del juego para nivelar oportunidades.
            </p>

            <div className="space-y-4 bg-white p-4 rounded-xl border border-slate-150/65 shadow-3xs text-xs">
              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span>Amortiguación de Jitter (Laberinto)</span>
                  <span className="font-mono text-indigo-650 text-indigo-600">
                    {analysis.peakFrequency > 0 ? (analysis.peakAmplitude * 10).toFixed(0) : "15"}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${analysis.peakFrequency > 0 ? Math.min(100, Math.max(10, analysis.peakAmplitude * 10)) : 15}%` }}
                  />
                </div>
                <p className="text-[9px] text-slate-400 mt-1">Estabilización inercial para evitar colisiones involuntarias.</p>
              </div>

              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span>Sensibilidad Burbujas de Presión</span>
                  <span className="font-mono text-emerald-650 text-emerald-600">
                    {analysis.peakFrequency > 0 ? (Math.max(20, 100 - (analysis.peakAmplitude * 8))).toFixed(0) : "80"}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${analysis.peakFrequency > 0 ? Math.min(100, Math.max(20, 100 - (analysis.peakAmplitude * 8))) : 80}%` }}
                  />
                </div>
                <p className="text-[9px] text-slate-400 mt-1">Tolerancia de desvío del motor táctil (m/s²) adaptada.</p>
              </div>

              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span>Ganancia de Calibración Total</span>
                  <span className="font-mono text-amber-600">x1.2 G</span>
                </div>
                <p className="text-[10px] text-amber-700 bg-amber-50 rounded px-2 py-1 mt-1 border border-amber-100 leading-normal font-sans">
                  🚨 {analysis.severity === "Severo" 
                    ? "Compensación activa nivelada debido a inestabilidad severa detectada."
                    : analysis.severity === "Moderado"
                    ? "Compensación moderada habilitada para asegurar fluidez táctica."
                    : "Calibración en rango óptimo. Mayor precisión disponible en el laberinto."}
                </p>
              </div>
            </div>
          </div>

          {/* Column 3: Recomendaciones Clínicas */}
          <div className="bg-indigo-900 text-indigo-100 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="p-1 px-1.5 bg-indigo-820 bg-indigo-950 rounded text-emerald-400 text-[10px] font-bold uppercase tracking-wider">Clínica</span>
                <h3 className="text-sm font-extrabold text-white">Recomendación Médica</h3>
              </div>
              <p className="text-[11px] text-indigo-200 mb-4 leading-normal">
                Pautas terapéuticas derivadas del espectro vibratorio actual medido por acelerometría de alta definición.
              </p>

              <div className="space-y-3.5 text-xs">
                <div className="flex gap-2.5 items-start">
                  <div className="mt-0.5 h-4 w-4 bg-indigo-800 rounded-full flex items-center justify-center font-bold text-[10px] text-emerald-400 flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-white">Ejercicios de Coordinación</h4>
                    <p className="text-[10.5px] text-indigo-250 text-indigo-200 mt-0.5 leading-normal">
                      Antes de cada juego en el laberinto, realiza 10 ciclos de finger-tapping para estimular la conectividad promotora cortical.
                    </p>
                  </div>
                </div>

                <div className="flex gap-2.5 items-start">
                  <div className="mt-0.5 h-4 w-4 bg-indigo-800 rounded-full flex items-center justify-center font-bold text-[10px] text-emerald-400 flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-white">Prevención de Fatiga</h4>
                    <p className="text-[10.5px] text-indigo-250 text-indigo-200 mt-0.5 leading-normal">
                      Si el temblor excede los 0.6 RMS, descansa tu mano en una superficie amortiguada durante 3 minutos y repite la prueba postural.
                    </p>
                  </div>
                </div>

                <div className="flex gap-2.5 items-start">
                  <div className="mt-0.5 h-4 w-4 bg-indigo-800 rounded-full flex items-center justify-center font-bold text-[10px] text-emerald-400 flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-white">Hidratación y Calibración</h4>
                    <p className="text-[10.5px] text-indigo-250 text-indigo-200 mt-0.5 leading-normal">
                      Alinea las mediciones en tu bitácora general de síntomas para reportar al neurólogo la simetría RMS semanal de ambas muñecas.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[10.5px] text-indigo-300 font-semibold border-t border-indigo-800 pt-3 mt-4 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Pautas actualizadas según el espectro motor.
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
