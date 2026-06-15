/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WearableDataPoint {
  time: number;
  x: number;
  y: number;
  z: number;
  magnitude: number;
}

export interface TremorAnalysis {
  peakFrequency: number; // Hz
  peakAmplitude: number; // m/s^2
  severity: "Normal" | "Leve" | "Moderado" | "Severo";
  classification: "Ninguno" | "Temblor de reposo" | "Temblor postural/acción";
  isLeftHandConnected?: boolean;
  detectedHand?: string;
  detectedAxis?: string;
  sustainedTime?: number;
  statusText?: string;
}

export interface SessionLog {
  id: string;
  timestamp: string;
  exerciseType: 
    | "Voz" 
    | "Motricidad - Trazo" 
    | "Motricidad - Tapping"
    | "Juegos - Simón Dice"
    | "Juegos - Cartas Memoria"
    | "Juegos - Sopa Letras"
    | "Juegos - Ajedrez/Damas"
    | "Juegos - Póker Cognitivo"
    | "Juegos - Blackjack Mental"
    | "Juegos - Scrabble Léxico"
    | "Juegos - Puzle Cerebral"
    | "Juegos - Gimnasia Facial"
    | "Juegos - Solitario Rítmico"
    | "Juegos - Burbujas de Precisión"
    | "Juegos - Conexión de Puntos"
    | "Juegos - Laberinto de Pulso"
    | "Juegos - Vocalización Rítmica"
    | "Juegos - Gimnasia Lingual";
  duration: number; // seconds
  metrics: {
    score: number; // 0 - 100
    stability?: number; // 0 - 100 (for voice or motor path)
    averageTremor?: number; // Hz detected during exercise
    peakVolume?: number; // dB (for voice)
    tapConsistency?: number; // % consistency (for tapping)
  };
  notes?: string;
}

export interface ExerciseDefinition {
  id: string;
  title: string;
  description: string;
  type: "Voz" | "Trazado" | "Tapping";
  difficulty: "Bajo" | "Medio" | "Alto";
  estimatedTime: string;
}
