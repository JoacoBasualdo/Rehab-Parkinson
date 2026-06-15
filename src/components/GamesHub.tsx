/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { SessionLog } from "../types";
import { 
  Gamepad2, 
  Brain, 
  Activity, 
  Award, 
  HelpCircle, 
  Play, 
  RotateCcw, 
  Check, 
  Lock, 
  ArrowRight,
  Sparkles,
  Zap,
  Star,
  Smile,
  RefreshCw,
  Clock,
  ShieldAlert,
  ArrowUpRight
} from "lucide-react";

// Definitions of the 10 games from the Lonestar Neurology article
interface ClinicalGame {
  id: string;
  title: string;
  originalTitle: string;
  description: string;
  benefit: string;
  category: "Cognitivo" | "Motor Fino" | "Expresión & Coordinación";
  isPlayable: boolean;
  difficulty: "Bajo" | "Medio" | "Alto";
}

interface GamesHubProps {
  onSessionComplete: (log: SessionLog) => void;
  currentWearableTremor: number;
  currentWearableTremorClass: "Normal" | "Leve" | "Moderado" | "Severo";
  currentWearableCoords?: { x: number; y: number; z: number };
  logs?: SessionLog[];
}

export default function GamesHub({ 
  onSessionComplete, 
  currentWearableTremor, 
  currentWearableTremorClass, 
  currentWearableCoords = { x: 0, y: 0, z: 0 }, 
  logs = [] 
}: GamesHubProps) {
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"cognitivo" | "motor" | "coordinacion">("cognitivo");

  // Filtering game-related logs specifically to show results under the games tab
  const gameSessions = logs.filter(
    log => log.id.startsWith("simon") || 
           log.id.startsWith("memory") || 
           log.id.startsWith("word") || 
           log.id.startsWith("chess") || 
           log.id.startsWith("poker") || 
           log.id.startsWith("bj") || 
           log.id.startsWith("scrab") || 
           log.id.startsWith("puz") || 
           log.id.startsWith("char") || 
           log.id.startsWith("solit") ||
           log.id.startsWith("bubbles") ||
           log.id.startsWith("dots") ||
           log.id.startsWith("maze") ||
           log.id.startsWith("phon") ||
           log.id.startsWith("ling")
  );

  // --- INDIVIDUAL INTERACTIVE GAMES STATE VARIABLES ---

  // Game 1: SIMON SAYS States
  const [simonSequence, setSimonSequence] = useState<number[]>([]);
  const [simonUserSequence, setSimonUserSequence] = useState<number[]>([]);
  const [simonState, setSimonState] = useState<"idle" | "showing" | "userRun" | "gameOver">("idle");
  const [simonActiveColor, setSimonActiveColor] = useState<number | null>(null);
  const [simonScore, setSimonScore] = useState<number>(0);

  // Game 2: MEMORY CARDS States
  const [memoryCards, setMemoryCards] = useState<{ id: number; symbol: string; isFlipped: boolean; isMatched: boolean }[]>([]);
  const [memorySelected, setMemorySelected] = useState<number[]>([]);
  const [memoryMoves, setMemoryMoves] = useState<number>(0);
  const [memoryCompleted, setMemoryCompleted] = useState<boolean>(false);

  // Game 3: WORD SEARCH (Sopa de letras)
  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [selectedGridLetters, setSelectedGridLetters] = useState<{ r: number; c: number }[]>([]);
  const [selectedWordText, setSelectedWordText] = useState<string>("");

  const targetWords = ["NEURO", "SALUD", "RITMO", "PASO", "VOZ"];
  const gridLetterArray = [
    ["N", "E", "U", "R", "O", "X"],
    ["Y", "S", "A", "L", "U", "D"],
    ["R", "I", "T", "M", "O", "G"],
    ["H", "P", "A", "S", "O", "E"],
    ["V", "O", "Z", "L", "K", "W"],
    ["M", "E", "D", "I", "C", "A"]
  ];

  // Game 4: CHESS & CHECKERS (Damas simplificadas 4x4)
  // Grid represented by single characters: 'U' (User), 'C' (Computer/Bot), '.' (Empty)
  const [checkersBoard, setCheckersBoard] = useState<string[][]>([
    ["C", ".", "C", "."],
    [".", ".", ".", "."],
    [".", ".", ".", "."],
    [".", "U", ".", "U"]
  ]);
  const [checkersSelected, setCheckersSelected] = useState<{ r: number; c: number } | null>(null);
  const [checkersMoves, setCheckersMoves] = useState<number>(0);
  const [checkersState, setCheckersState] = useState<"playing" | "win" | "lose">("playing");

  // Game 5: POKER (Descarte Cognitivo)
  const [pokerHand, setPokerHand] = useState<{ value: string; suit: string; active: boolean }[]>([]);
  const [pokerDiscardsCount, setPokerDiscardsCount] = useState<number>(0);
  const [pokerFeedback, setPokerFeedback] = useState<string>("");
  const [pokerState, setPokerState] = useState<"idle" | "playing" | "complete">("idle");

  const suits = ["♥️", "♦️", "♣️", "♠️"];
  const cardValues = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

  // Game 6: BLACKJACK MENTAL
  const [bjPlayerHand, setBjPlayerHand] = useState<{ val: string; valueNum: number; suit: string }[]>([]);
  const [bjDealerHand, setBjDealerHand] = useState<{ val: string; valueNum: number; suit: string }[]>([]);
  const [bjState, setBjState] = useState<"idle" | "playing" | "playerTurn" | "dealerTurn" | "win" | "lose" | "draw">("idle");
  const [bjScore, setBjScore] = useState<number>(0);

  // Game 7: LETTER SPELLER (Scrabble anagrams)
  const spellerChallenges = [
    { target: "DOPAMINA", shuffled: "AAPDINOM", hint: "Sustancia neurotransmisora reducida en el Parkinson que controla el movimiento." },
    { target: "RIGIDEZ", shuffled: "EGDIIRZ", hint: "Síntoma común caracterizado por tensión e inflexibilidad muscular." },
    { target: "ESTABILIDAD", shuffled: "AADEIIBLSTT", hint: "Cualidad de mantener el pulso y equilibrio postural firme durante actividades." },
    { target: "NEURONA", shuffled: "AENNORU", hint: "Célula cerebral rectora encargada de procesar las señales de movimiento." }
  ];
  const [spellerIndex, setSpellerIndex] = useState<number>(0);
  const [spellerSelections, setSpellerSelections] = useState<string[]>([]);
  const [spellerTries, setSpellerTries] = useState<number>(0);
  const [spellerComplete, setSpellerComplete] = useState<boolean>(false);

  // Game 8: PUZZLE (Mosaico de 2x2 para ser fácilmente realizable con baja frustración)
  const [puzzleTiles, setPuzzleTiles] = useState<number[]>([1, 2, 3, 0]); // 0 represents the empty slot, goal is [1, 2, 3, 0]
  const [puzzleMoves, setPuzzleMoves] = useState<number>(0);
  const [puzzleCompleted, setPuzzleCompleted] = useState<boolean>(false);

  // Game 9: CHARADES (Mímica facial / Orofacial y contra la Inexpresividad/Hipomimia)
  const charadePrompts = [
    { task: "Sonreír exageradamente de oreja a oreja", area: "Amplitud cigomática facial", time: 5 },
    { task: "Inflar ambas mejillas reteniendo aire templado", area: "Musculatura buccinadora (habla)", time: 4 },
    { task: "Alzar las cejas abriendo mucho los ojos", area: "Músculo frontal superior", time: 5 },
    { task: "Pronunciar fuerte la vocal 'O' alargada moviendo labios", area: "Articulación fonoaudiológica bucolabial", time: 6 }
  ];
  const [charadeIdx, setCharadeIdx] = useState<number>(0);
  const [charadeTimer, setCharadeTimer] = useState<number>(0);
  const [charadeActive, setCharadeActive] = useState<boolean>(false);
  const [charadeState, setCharadeState] = useState<"idle" | "holding" | "rating" | "done">("idle");
  const [charadeSelfScore, setCharadeSelfScore] = useState<number>(3); // User rate from 1 to 5 stars

  // Game 10: SOLITARIO RÍTMICO (Secuencia controlada de toques)
  const [solitaireList, setSolitaireList] = useState<{ val: number; matched: boolean }[]>([]);
  const [solitaireTargetNum, setSolitaireTargetNum] = useState<number>(1);
  const [solitaireTicks, setSolitaireTicks] = useState<number>(0); // click attempts
  const [solitaireState, setSolitaireState] = useState<"idle" | "playing" | "completed">("idle");

  // Game 11: BURBUJAS DE PRECISIÓN (Toque preciso de esferas)
  const [bubblesList, setBubblesList] = useState<{ id: number; x: number; y: number; popped: boolean; color: string }[]>([]);
  const [bubblesPoppedCount, setBubblesPoppedCount] = useState<number>(0);
  const [bubblesState, setBubblesState] = useState<"idle" | "playing" | "completed">("idle");
  const [bubblesStartTimestamp, setBubblesStartTimestamp] = useState<number>(0);
  const [bubblesMisses, setBubblesMisses] = useState<number>(0);

  // Game 12: CONEXIÓN DE PUNTOS PROPIOMOTORES (Pulsar en secuencia)
  const [dotsList, setDotsList] = useState<{ id: number; label: number; x: number; y: number; clicked: boolean; color: string }[]>([]);
  const [dotsNextToClick, setDotsNextToClick] = useState<number>(1);
  const [dotsState, setDotsState] = useState<"idle" | "playing" | "completed">("idle");
  const [dotsStartTimestamp, setDotsStartTimestamp] = useState<number>(0);
  const [dotsMisses, setDotsMisses] = useState<number>(0);

  // Game 13: LABERINTO DE ESTABILIDAD TÁCTIL (Trazar senda sin tocar vacíos)
  const [mazeCheckpointIndex, setMazeCheckpointIndex] = useState<number>(0);
  const [mazeState, setMazeState] = useState<"idle" | "playing" | "completed">("idle");
  const [mazeStartTimestamp, setMazeStartTimestamp] = useState<number>(0);
  const [mazeMisses, setMazeMisses] = useState<number>(0);
  const [mazePoints] = useState<{ x: number; y: number; label: string }[]>([
    { x: 15, y: 75, label: "Inicio" },
    { x: 30, y: 30, label: "Paso 1" },
    { x: 50, y: 80, label: "Paso 2" },
    { x: 70, y: 25, label: "Paso 3" },
    { x: 88, y: 65, label: "Meta" }
  ]);

  // Integrated Wearable Motion and Calibration States
  const [mazeControlMode, setMazeControlMode] = useState<"click" | "wearable">("click");
  const [mazeBallPos, setMazeBallPos] = useState<{ x: number; y: number }>({ x: 15, y: 75 });
  const [wearableZeroOffset, setWearableZeroOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [lastMazeCollisionTime, setLastMazeCollisionTime] = useState<number>(0);

  const [bubblesControlMode, setBubblesControlMode] = useState<"click" | "wearable">("click");
  const [bubblesCrosshairPos, setBubblesCrosshairPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [bubblesTargetStabilization, setBubblesTargetStabilization] = useState<{ bubbleId: number; progress: number } | null>(null);

  // Game 14: VOCALIZACIÓN RÍTMICA ("PA-TA-KA" rhythm calibration)
  const [phoneticsState, setPhoneticsState] = useState<"idle" | "playing" | "completed">("idle");
  const [phoneticsActiveBeat, setPhoneticsActiveBeat] = useState<number>(0);
  const [phoneticsPatterns, setPhoneticsPatterns] = useState<string[]>(["PA", "TA", "KA", "PA", "TA", "KA"]);
  const [phoneticsStartTimestamp, setPhoneticsStartTimestamp] = useState<number>(0);
  const [phoneticsHits, setPhoneticsHits] = useState<number>(0);
  const [phoneticsMisses, setPhoneticsMisses] = useState<number>(0);

  // Game 15: GIMNASIA LINGUAL (Tongue and swallowing motor steps)
  const [lingualState, setLingualState] = useState<"idle" | "holding" | "rating" | "done">("idle");
  const [lingualIdx, setLingualIdx] = useState<number>(0);
  const [lingualTimer, setLingualTimer] = useState<number>(0);
  const [lingualSelfScore, setLingualSelfScore] = useState<number>(4);
  const [lingualStartTimestamp, setLingualStartTimestamp] = useState<number>(0);
  const lingualPrompts = [
    { task: "Empujar con fuerza la mejilla izquierda usando la lengua por dentro", area: "Presión lingual interna y motricidad del habla", time: 5 },
    { task: "Empujar con fuerza la mejilla derecha usando la lengua por dentro", area: "Presión lingual interna y coordinación labio-lingual", time: 5 },
    { task: "Tocar el paladar superior con la lengua y tragar saliva de forma consciente", area: "Músculos suprahioideos y prevención de disfagia", time: 6 },
    { task: "Hacer círculos amplios con la lengua rozando los dientes tras labios cerrados", area: "Fuerza del orbicular de los labios y control de sialorrea", time: 7 }
  ];

  const clinicalGames: ClinicalGame[] = [
    {
      id: "simon",
      title: "Simón Dice (Secuencias Ritmo)",
      originalTitle: "Simon Says",
      description: "Juego interactivo de atención rítmica. Repite las secuencias de colores que se iluminan lentamente en pantalla.",
      benefit: "Ejercita la memoria secuencial de corto plazo y la velocidad de respuesta motora coordinando los dedos.",
      category: "Motor Fino",
      isPlayable: true,
      difficulty: "Medio"
    },
    {
      id: "memory",
      title: "Cartas de Memoria",
      originalTitle: "Memory-Matching Card Games",
      description: "Encuentra los pares de símbolos de salud mental y de estimulación de lóbulo temporal ocultos.",
      benefit: "Estimula la memoria de trabajo visual y la atención dividida mientras haces toques precisos.",
      category: "Cognitivo",
      isPlayable: true,
      difficulty: "Bajo"
    },
    {
      id: "wordsearch",
      title: "Sopa de Letras Clínicas",
      originalTitle: "Word Puzzles",
      description: "Encuentra palabras clave del tratamiento del Parkinson ocultas en la cuadrícula de estimulación.",
      benefit: "Ejercita el escaneo visual rápido, agilidad cognitiva espacial y búsqueda ortográfica fina.",
      category: "Cognitivo",
      isPlayable: true,
      difficulty: "Medio"
    },
    {
      id: "chess",
      title: "Ajedrez y Damas Tácticas",
      originalTitle: "Checkers and Chess",
      description: "Consigue la captura precisa de fichas en un tablero de batallas de damas simplificado.",
      benefit: "Fomenta la plasticidad neuronal, cálculo de movimientos previstos y entrena la estabilidad táctil manual reduciendo el temblor intencional.",
      category: "Cognitivo",
      isPlayable: true,
      difficulty: "Alto"
    },
    {
      id: "poker",
      title: "Espectro del Póker de Descarte",
      originalTitle: "Poker",
      description: "Analiza y selecciona cuáles naipes descartar para mejorar la puntuación lógica de tu mano.",
      benefit: "Desarrolla el discernimiento deductivo, planeación ejecutiva rápida y toques sutiles selectivos.",
      category: "Cognitivo",
      isPlayable: true,
      difficulty: "Alto"
    },
    {
      id: "blackjack",
      title: "Cálculo en la Casa Blackjack",
      originalTitle: "BlackJack",
      description: "Partida clásica del 21 rítmico donde se calibra la concentración aritmética y control inhibitorio.",
      benefit: "Entrena el cálculo de probabilidades rápido y combate la rigidez inhibitoria motora fina mediante botones de acción.",
      category: "Cognitivo",
      isPlayable: true,
      difficulty: "Medio"
    },
    {
      id: "scrabble",
      title: "Scrabble: Constructor Léxico",
      originalTitle: "Scrabble",
      description: "Reordena las letras de conceptos médicos para combatir la anomia fónica y fatiga mental.",
      benefit: "Estimula la fluidez léxica y planificación semántica, excelente para acompañar la terapia del habla.",
      category: "Cognitivo",
      isPlayable: true,
      difficulty: "Medio"
    },
    {
      id: "puzzles",
      title: "Puzle Espacial Cerebral",
      originalTitle: "Puzzles",
      description: "Ordena los mosaicos del neocórtex deslizándolos de manera suave y dirigida con el menor número de movimientos.",
      benefit: "Ejercita la destreza visuomotora, velocidad motora de los dedos y espacialidad bidimensional.",
      category: "Motor Fino",
      isPlayable: true,
      difficulty: "Alto"
    },
    {
      id: "charades",
      title: "Gimnasia Fisionómica o Charadas",
      originalTitle: "Charades",
      description: "Realiza y conserva actividades gesticulares con simulación de cronómetro para reducir la inervación inexpresiva en el Parkinson.",
      benefit: "Ejercita la fonoaudiología, previene la disfagia deglutoria, estira los músculos faciales y promueve la expresividad alegre.",
      category: "Expresión & Coordinación",
      isPlayable: true,
      difficulty: "Bajo"
    },
    {
      id: "solitaire",
      title: "Solitario Rítmico Secuencial",
      originalTitle: "Solitaire",
      description: "Ordena una serie barajada de cartas de manera ascendente mediante intervalos de toques rítmicos controlados.",
      benefit: "Regula el tempo de pulsación manual controlando el temblor cinético mediante toques regulados rítmicamente.",
      category: "Motor Fino",
      isPlayable: true,
      difficulty: "Bajo"
    },
    {
      id: "bubbles",
      title: "Burbujas de Precisión Motora",
      originalTitle: "Precision Bubble Popping",
      description: "Toca las esferas de colores que van brotando en pantalla en el menor tiempo posible para reeducar la puntería intencional.",
      benefit: "Ejercita la coordinación de la mirada con el dedo (óculo-manual) y reduce la dismetría atenuando temblores rápidos.",
      category: "Motor Fino",
      isPlayable: true,
      difficulty: "Bajo"
    },
    {
      id: "dots",
      title: "Conexión de Puntos Propiomotores",
      originalTitle: "Motor Trail Connecting (1-5)",
      description: "Presiona los círculos de colores de manera estrictamente numérica del 1 al 5 en el menor tiempo posible.",
      benefit: "Ejercita la puntería focalizada de micro-trayectos y ayuda a regular la desaceleración interarticular voluntaria reduciendo el titubeo del temblor.",
      category: "Motor Fino",
      isPlayable: true,
      difficulty: "Medio"
    },
    {
      id: "maze",
      title: "Laberinto de Estabilidad Táctil",
      originalTitle: "Steady Trace Corridor",
      description: "Recorre y presiona la senda sinuosa de hitos guiados del Inicio al Fin sin tocar el espacio vacío de la pantalla.",
      benefit: "Entrena el pulso continuo bajo tensión espacial e inhibe desviaciones espasmódicas ante la fatiga interdigital física.",
      category: "Motor Fino",
      isPlayable: true,
      difficulty: "Alto"
    },
    {
      id: "phonetics",
      title: "Vocalización Rítmica de Fonemas",
      originalTitle: "Rhythmic Speech Pacer",
      description: "Pronuncia y presiona las de sílabas fonoaudiológicas fundamentales ('PA', 'TA', 'KA') en estricta sincronía con los latidos del metrónomo visual.",
      benefit: "Combate la fatiga o hipofonía (pérdida de fuerza en la voz) y ayuda a restaurar la cadencia prosódica de la conversación familiar.",
      category: "Expresión & Coordinación",
      isPlayable: true,
      difficulty: "Medio"
    },
    {
      id: "lingual",
      title: "Entrenamiento Lingual-Deglutorio",
      originalTitle: "Tongue Swallowing Coordinator",
      description: "Ejecuta los movimientos linguodeglutores propuestos en pantalla, conservando la fuerza muscular contra el temporizador.",
      benefit: "Tonifica los músculos orofaríngeos previniendo la disfagia (dificultad para deglutir) y ayuda a moderar la salivación involuntaria.",
      category: "Expresión & Coordinación",
      isPlayable: true,
      difficulty: "Medio"
    }
  ];

  const filteredGames = clinicalGames.filter(game => {
    if (activeTab === "todos") return true;
    if (activeTab === "cognitivo" && game.category === "Cognitivo") return true;
    if (activeTab === "motor" && game.category === "Motor Fino") return true;
    if (activeTab === "coordinacion" && game.category === "Expresión & Coordinación") return true;
    return false;
  });

  // --- PLAYABLE 1: SIMON SAYS FUNCTIONS ---
  const startSimon = () => {
    setSimonSequence([Math.floor(Math.random() * 4)]);
    setSimonUserSequence([]);
    setSimonScore(0);
    setSimonState("showing");
  };

  useEffect(() => {
    if (simonState === "showing" && simonSequence.length > 0) {
      let i = 0;
      const interval = setInterval(() => {
        setSimonActiveColor(simonSequence[i]);
        setTimeout(() => setSimonActiveColor(null), 400);
        i++;
        if (i >= simonSequence.length) {
          clearInterval(interval);
          setTimeout(() => setSimonState("userRun"), 500);
        }
      }, 700);
      return () => clearInterval(interval);
    }
  }, [simonState, simonSequence]);

  const handleSimonPadClick = (colorId: number) => {
    if (simonState !== "userRun") return;
    setSimonActiveColor(colorId);
    setTimeout(() => setSimonActiveColor(null), 150);

    const nextUserSeq = [...simonUserSequence, colorId];
    setSimonUserSequence(nextUserSeq);

    const currentStep = nextUserSeq.length - 1;
    if (nextUserSeq[currentStep] !== simonSequence[currentStep]) {
      setSimonState("gameOver");
      
      const sessionLog: SessionLog = {
        id: "simon-" + Math.random().toString(36).substr(2, 5),
        timestamp: new Date().toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' }),
        exerciseType: "Juegos - Simón Dice",
        duration: 25,
        metrics: {
          score: Math.min(100, simonScore * 12),
          stability: Math.max(40, 100 - Math.round(currentWearableTremor * 6)),
          averageTremor: parseFloat(currentWearableTremor.toFixed(1)),
        },
        notes: `Simón Dice: Racha de ${simonScore} tonos seguidos. Estimulación fonoacústica y motora rítmica.`
      };
      onSessionComplete(sessionLog);
      return;
    }

    if (nextUserSeq.length === simonSequence.length) {
      setSimonScore(prev => prev + 1);
      setSimonUserSequence([]);
      setSimonState("showing");
      setSimonSequence(prev => [...prev, Math.floor(Math.random() * 4)]);
    }
  };


  // --- PLAYABLE 2: MEMORY CARD FUNCTIONS ---
  const initializeMemory = () => {
    const symbols = ["🧠", "❤️", "⚡", "🧩", "🌟", "🍏"];
    const doubledSymbols = [...symbols, ...symbols];
    const shuffled = doubledSymbols
      .map((sym, index) => ({ id: index, symbol: sym, isFlipped: false, isMatched: false }))
      .sort(() => Math.random() - 0.5);
    
    setMemoryCards(shuffled);
    setMemorySelected([]);
    setMemoryMoves(0);
    setMemoryCompleted(false);
  };

  useEffect(() => {
    if (selectedGameId === "memory") {
      initializeMemory();
    }
  }, [selectedGameId]);

  const handleCardClick = (id: number) => {
    if (memoryCompleted || memorySelected.length >= 2) return;
    const clickedCard = memoryCards.find(c => c.id === id);
    if (!clickedCard || clickedCard.isFlipped || clickedCard.isMatched) return;

    setMemoryCards(prev => prev.map(c => c.id === id ? { ...c, isFlipped: true } : c));
    const nextSelected = [...memorySelected, id];
    setMemorySelected(nextSelected);

    if (nextSelected.length === 2) {
      setMemoryMoves(m => m + 1);
      const [firstId, secondId] = nextSelected;
      const firstCard = memoryCards.find(c => c.id === firstId);
      const secondCard = memoryCards.find(c => c.id === secondId);

      if (firstCard && secondCard && firstCard.symbol === secondCard.symbol) {
        setTimeout(() => {
          setMemoryCards(prev => prev.map(c => 
            c.id === firstId || c.id === secondId 
              ? { ...c, isMatched: true } 
              : c
          ));
          setMemorySelected([]);

          setMemoryCards(current => {
            const allDone = current.every(c => c.isMatched || c.id === firstId || c.id === secondId);
            if (allDone) {
              setMemoryCompleted(true);
              const scoreVal = Math.max(30, 100 - (memoryMoves * 2.5));
              const sessionLog: SessionLog = {
                id: "memory-" + Math.random().toString(36).substr(2, 5),
                timestamp: new Date().toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' }),
                exerciseType: "Juegos - Cartas Memoria",
                duration: 35,
                metrics: {
                  score: Math.round(scoreVal),
                  stability: Math.max(50, 100 - Math.round(currentWearableTremor * 4)),
                  averageTremor: parseFloat(currentWearableTremor.toFixed(1)),
                },
                notes: `Cartas de Memoria: Finalizado en ${memoryMoves + 1} movimientos. Alta retención visual en lóbulo temporal.`
              };
              onSessionComplete(sessionLog);
            }
            return current;
          });
        }, 600);
      } else {
        setTimeout(() => {
          setMemoryCards(prev => prev.map(c => 
            c.id === firstId || c.id === secondId 
              ? { ...c, isFlipped: false } 
              : c
          ));
          setMemorySelected([]);
        }, 1100);
      }
    }
  };


  // --- PLAYABLE 3: WORD SEARCH (SOPA DE LETRAS) ---
  const handleKeyLetterClick = (r: number, c: number, char: string) => {
    const isAlreadySelected = selectedGridLetters.some(item => item.r === r && item.c === c);
    let nextSelected = [...selectedGridLetters];
    if (isAlreadySelected) {
      nextSelected = nextSelected.filter(item => !(item.r === r && item.c === c));
    } else {
      nextSelected.push({ r, c });
    }
    setSelectedGridLetters(nextSelected);

    const word = nextSelected.map(pos => gridLetterArray[pos.r][pos.c]).join("");
    setSelectedWordText(word);

    const matchedIdx = targetWords.findIndex(tw => tw === word || tw === word.split("").reverse().join(""));
    if (matchedIdx !== -1 && !foundWords.includes(targetWords[matchedIdx])) {
      const matchWord = targetWords[matchedIdx];
      const newFound = [...foundWords, matchWord];
      setFoundWords(newFound);
      setSelectedGridLetters([]);
      setSelectedWordText("");

      if (newFound.length === targetWords.length) {
        const sessionLog: SessionLog = {
          id: "word-" + Math.random().toString(36).substr(2, 5),
          timestamp: new Date().toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' }),
          exerciseType: "Juegos - Sopa Letras",
          duration: 50,
          metrics: {
            score: 100,
            stability: Math.max(50, 100 - Math.round(currentWearableTremor * 3)),
            averageTremor: parseFloat(currentWearableTremor.toFixed(1)),
          },
          notes: "Sopa de letras: Resolvió 5/5 conceptos clínicos mediante movimientos finos de barrido visual."
        };
        onSessionComplete(sessionLog);
      }
    }
  };

  const clearWordSelection = () => {
    setSelectedGridLetters([]);
    setSelectedWordText("");
  };

  const resetWordsearch = () => {
    setFoundWords([]);
    setSelectedGridLetters([]);
    setSelectedWordText("");
  };


  // --- PLAYABLE 4: CHESS & CHECKERS (DAMAS TÁCTICAS) ---
  const startCheckers = () => {
    setCheckersBoard([
      ["C", ".", "C", "."],
      [".", ".", ".", "."],
      [".", ".", ".", "."],
      [".", "U", ".", "U"]
    ]);
    setCheckersSelected(null);
    setCheckersMoves(0);
    setCheckersState("playing");
  };

  const handleCheckerCellClick = (r: number, c: number) => {
    if (checkersState !== "playing") return;

    const cellValue = checkersBoard[r][c];

    // Select own piece
    if (cellValue === "U") {
      setCheckersSelected({ r, c });
      return;
    }

    // Attempt a move
    if (checkersSelected && cellValue === ".") {
      const fromR = checkersSelected.r;
      const fromC = checkersSelected.c;

      // Rules: slide diagonal forward (upwards for User)
      const diffR = r - fromR;
      const diffC = Math.abs(c - fromC);

      // Simple Diagonal Move (1 square forward)
      if (diffR === -1 && diffC === 1) {
        executeCheckersMove(fromR, fromC, r, c);
        return;
      }

      // Simple Jump/Capture Move (2 squares diagonal jumping over 'C')
      if (diffR === -2 && diffC === 2) {
        const midR = fromR + diffR / 2;
        const midC = fromC + (c - fromC) / 2;
        if (checkersBoard[midR][midC] === "C") {
          executeCheckersCapture(fromR, fromC, midR, midC, r, c);
          return;
        }
      }
    }
  };

  const executeCheckersMove = (fromR: number, fromC: number, toR: number, toC: number) => {
    const nextBoard = checkersBoard.map(row => [...row]);
    nextBoard[fromR][fromC] = ".";
    nextBoard[toR][toC] = "U";
    setCheckersBoard(nextBoard);
    setCheckersSelected(null);
    setCheckersMoves(moves => moves + 1);
    triggerCheckersBotTurn(nextBoard, true);
  };

  const executeCheckersCapture = (fromR: number, fromC: number, midR: number, midC: number, toR: number, toC: number) => {
    const nextBoard = checkersBoard.map(row => [...row]);
    nextBoard[fromR][fromC] = ".";
    nextBoard[midR][midC] = "."; // captured!
    nextBoard[toR][toC] = "U";
    setCheckersBoard(nextBoard);
    setCheckersSelected(null);
    setCheckersMoves(moves => moves + 1);
    triggerCheckersBotTurn(nextBoard, false);
  };

  const triggerCheckersBotTurn = (boardState: string[][], wasSimpleMove: boolean) => {
    // Check if player won of computer has no pieces
    const botPieces: { r: number; c: number }[] = [];
    boardState.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell === "C") botPieces.push({ r, c });
      });
    });

    if (botPieces.length === 0) {
      handleCheckersFinished("win");
      return;
    }

    // Bot tries to do a simple diagonal move down
    setTimeout(() => {
      const nextBoard = boardState.map(row => [...row]);
      let botMoved = false;

      // Simple greedy check for moves for Bot 'C'
      for (const p of botPieces) {
        const possibleMoves = [
          { r: p.r + 1, c: p.c - 1 },
          { r: p.r + 1, c: p.c + 1 }
        ];

        for (const m of possibleMoves) {
          if (m.r >= 0 && m.r < 4 && m.c >= 0 && m.c < 4 && nextBoard[m.r][m.c] === ".") {
            nextBoard[p.r][p.c] = ".";
            nextBoard[m.r][m.c] = "C";
            botMoved = true;
            break;
          }
        }
        if (botMoved) break;
      }

      setCheckersBoard(nextBoard);

      // Check user pieces count left
      const userPieces: { r: number; c: number }[] = [];
      nextBoard.forEach((row, r) => {
        row.forEach((cell, c) => {
          if (cell === "U") userPieces.push({ r, c });
        });
      });

      if (userPieces.length === 0) {
        handleCheckersFinished("lose");
      }
    }, 600);
  };

  const handleCheckersFinished = (outcome: "win" | "lose") => {
    setCheckersState(outcome);
    let finalScore = outcome === "win" ? 100 : 35;
    if (checkersMoves > 0) {
      finalScore = Math.max(30, finalScore - checkersMoves);
    }

    // Log the checkers activity
    const sessionLog: SessionLog = {
      id: "chess-" + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' }),
      exerciseType: "Juegos - Ajedrez/Damas",
      duration: 40,
      metrics: {
        score: Math.round(finalScore),
        stability: Math.max(45, 100 - Math.round(currentWearableTremor * 5)),
        averageTremor: parseFloat(currentWearableTremor.toFixed(1)),
      },
      notes: `Damas Tácticas: Resultado ${outcome === "win" ? "Victoria" : "Derrota"} en ${checkersMoves} movimientos. Excelente ejercicio de toma de decisiones motoras.`
    };
    onSessionComplete(sessionLog);
  };


  // --- PLAYABLE 5: POKER FUNCTIONS ---
  const generatePokerHand = () => {
    const newHand = [];
    for (let i = 0; i < 5; i++) {
      const val = cardValues[Math.floor(Math.random() * cardValues.length)];
      const suit = suits[Math.floor(Math.random() * suits.length)];
      newHand.push({ value: val, suit, active: false });
    }
    setPokerHand(newHand);
    setPokerDiscardsCount(0);
    setPokerFeedback("");
    setPokerState("playing");
  };

  const togglePokerSelect = (idx: number) => {
    if (pokerState !== "playing") return;
    setPokerHand(prev => prev.map((card, i) => i === idx ? { ...card, active: !card.active } : card));
  };

  const executeDiscard = () => {
    if (pokerState !== "playing") return;

    const cardsToDiscard = pokerHand.filter(c => c.active).length;
    
    // Replace selected cards with new ones
    const finalHand = pokerHand.map(card => {
      if (card.active) {
        const val = cardValues[Math.floor(Math.random() * cardValues.length)];
        const suit = suits[Math.floor(Math.random() * suits.length)];
        return { value: val, suit, active: false };
      }
      return card;
    });

    setPokerHand(finalHand);
    setPokerDiscardsCount(cardsToDiscard);

    // Dynamic Clinical grading based on combinations
    const valuesOnly = finalHand.map(c => c.value);
    const valueCounts: { [key: string]: number } = {};
    valuesOnly.forEach(v => valueCounts[v] = (valueCounts[v] || 0) + 1);
    const maxDuplicates = Math.max(...Object.values(valueCounts));

    let score = 50;
    let handName = "Carta Alta";

    if (maxDuplicates === 4) {
      score = 95;
      handName = "Póker (Cuatro Iguales)";
    } else if (maxDuplicates === 3) {
      score = 80;
      handName = "Trío (Tres Iguales)";
    } else if (maxDuplicates === 2) {
      const pairs = Object.values(valueCounts).filter(c => c === 2).length;
      if (pairs === 2) {
        score = 75;
        handName = "Doble Pareja";
      } else {
        score = 65;
        handName = "Una Pareja";
      }
    }

    // Suit check for Flush (same suit)
    const isFlush = finalHand.every(c => c.suit === finalHand[0].suit);
    if (isFlush) {
      score = 90;
      handName = "Color (Mismo Palo)";
    }

    setPokerFeedback(`Mano obtenida: ${handName}. Has descartado ${cardsToDiscard} carta(s).`);
    setPokerState("complete");

    // Session log complete
    const sessionLog: SessionLog = {
      id: "poker-" + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' }),
      exerciseType: "Juegos - Póker Cognitivo",
      duration: 30,
      metrics: {
        score: score,
        stability: Math.max(50, 100 - Math.round(currentWearableTremor * 4)),
        averageTremor: parseFloat(currentWearableTremor.toFixed(1)),
      },
      notes: `Póker Terapéutico: Logró un ${handName} descartando ${cardsToDiscard} cartas. Estimula planeación lógica.`
    };
    onSessionComplete(sessionLog);
  };


  // --- PLAYABLE 6: BLACKJACK MENTAL ---
  const startBlackjack = () => {
    const rawDeck = [
      { val: "2", n: 2 }, { val: "3", n: 3 }, { val: "4", n: 4 }, { val: "5", n: 5 }, { val: "6", n: 6 },
      { val: "7", n: 7 }, { val: "8", n: 8 }, { val: "9", n: 9 }, { val: "10", n: 10 },
      { val: "J", n: 10 }, { val: "Q", n: 10 }, { val: "K", n: 10 }, { val: "A", n: 11 }
    ];

    const pickCard = () => {
      const card = rawDeck[Math.floor(Math.random() * rawDeck.length)];
      const suit = suits[Math.floor(Math.random() * suits.length)];
      return { val: card.val, valueNum: card.n, suit };
    };

    const p1 = pickCard();
    const p2 = pickCard();
    const d1 = pickCard();

    setBjPlayerHand([p1, p2]);
    setBjDealerHand([d1]);
    setBjState("playerTurn");
  };

  const getHandSum = (hand: { valueNum: number }[]) => {
    let sum = hand.reduce((acc, c) => acc + c.valueNum, 0);
    // Adjust aces from 11 to 1 if over 21
    let aces = hand.filter((c: any) => c.val === "A").length;
    while (sum > 21 && aces > 0) {
      sum -= 10;
      aces -= 1;
    }
    return sum;
  };

  const handleBlackjackHit = () => {
    if (bjState !== "playerTurn") return;

    const rawDeck = [
      { val: "2", n: 2 }, { val: "3", n: 3 }, { val: "4", n: 4 }, { val: "5", n: 5 }, { val: "6", n: 6 },
      { val: "7", n: 7 }, { val: "8", n: 8 }, { val: "9", n: 9 }, { val: "10", n: 10 },
      { val: "J", n: 10 }, { val: "Q", n: 10 }, { val: "K", n: 10 }, { val: "A", n: 11 }
    ];

    const pickCard = () => {
      const card = rawDeck[Math.floor(Math.random() * rawDeck.length)];
      const suit = suits[Math.floor(Math.random() * suits.length)];
      return { val: card.val, valueNum: card.n, suit };
    };

    const nextHand = [...bjPlayerHand, pickCard()];
    setBjPlayerHand(nextHand);

    const sum = getHandSum(nextHand);
    if (sum > 21) {
      setBjState("lose");
      saveBlackjackLog("Derrota por exceso (Pasó de 21)", 40);
    }
  };

  const handleBlackjackStand = () => {
    if (bjState !== "playerTurn") return;

    const rawDeck = [
      { val: "2", n: 2 }, { val: "3", n: 3 }, { val: "4", n: 4 }, { val: "5", n: 5 }, { val: "6", n: 6 },
      { val: "7", n: 7 }, { val: "8", n: 8 }, { val: "9", n: 9 }, { val: "10", n: 10 },
      { val: "J", n: 10 }, { val: "Q", n: 10 }, { val: "K", n: 10 }, { val: "A", n: 11 }
    ];

    const pickCard = () => {
      const card = rawDeck[Math.floor(Math.random() * rawDeck.length)];
      const suit = suits[Math.floor(Math.random() * suits.length)];
      return { val: card.val, valueNum: card.n, suit };
    };

    // Dealer turn logic: Dealer hits up to 16
    let currentDealer = [...bjDealerHand];
    while (getHandSum(currentDealer) < 17) {
      currentDealer.push(pickCard());
    }

    setBjDealerHand(currentDealer);

    const pSum = getHandSum(bjPlayerHand);
    const dSum = getHandSum(currentDealer);

    if (dSum > 21 || pSum > dSum) {
      setBjState("win");
      setBjScore(s => s + 1);
      saveBlackjackLog("Victoria sobresaliente contra la casa", 100);
    } else if (dSum > pSum) {
      setBjState("lose");
      saveBlackjackLog("La banca sumó una cifra mayor", 50);
    } else {
      setBjState("draw");
      saveBlackjackLog("Empate técnico", 70);
    }
  };

  const saveBlackjackLog = (outcomeText: string, computedScore: number) => {
    const sessionLog: SessionLog = {
      id: "bj-" + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' }),
      exerciseType: "Juegos - Blackjack Mental",
      duration: 25,
      metrics: {
        score: computedScore,
        stability: Math.max(50, 100 - Math.round(currentWearableTremor * 4.5)),
        averageTremor: parseFloat(currentWearableTremor.toFixed(1)),
      },
      notes: `Blackjack Mental: ${outcomeText}. Refuerza control óculo-motor y lóbulo frontal de toma de decisiones rápidas.`
    };
    onSessionComplete(sessionLog);
  };


  // --- PLAYABLE 7: SCRABBLE FUNCTIONS ---
  const startSpeller = () => {
    setSpellerSelections([]);
    setSpellerTries(0);
    setSpellerComplete(false);
  };

  const handleSpellerLetterClick = (letter: string, index: number) => {
    if (spellerComplete) return;
    setSpellerSelections(prev => [...prev, letter]);
  };

  const verifySpellerWord = () => {
    const builtWord = spellerSelections.join("");
    const targetWord = spellerChallenges[spellerIndex].target;

    setSpellerTries(t => t + 1);

    if (builtWord === targetWord) {
      setSpellerComplete(true);
      
      // Log Complete
      const scoreVal = Math.max(40, 100 - (spellerTries * 15));
      const sessionLog: SessionLog = {
        id: "scrab-" + Math.random().toString(36).substr(2, 5),
        timestamp: new Date().toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' }),
        exerciseType: "Juegos - Scrabble Léxico",
        duration: 35,
        metrics: {
          score: scoreVal,
          stability: Math.max(50, 100 - Math.round(currentWearableTremor * 3.5)),
          averageTremor: parseFloat(currentWearableTremor.toFixed(1)),
        },
        notes: `Scrabble Léxico: Reconstruyó la palabra '${targetWord}' con éxito. Gran ejercicio del habla cerebral.`
      };
      onSessionComplete(sessionLog);
    } else {
      // clear or try again
      setSpellerSelections([]);
    }
  };

  useEffect(() => {
    startSpeller();
  }, [spellerIndex, selectedGameId]);


  // --- PLAYABLE 8: PUZZLE (Mosaico 2x2 para lóbulo parietal) ---
  const initializePuzzle = () => {
    // Generate simple random shuffle (2x2 is very accessible and won't frustrate)
    const configurations = [
      [2, 1, 3, 0],
      [1, 3, 0, 2],
      [3, 0, 1, 2],
      [2, 3, 1, 0]
    ];
    const chosen = configurations[Math.floor(Math.random() * configurations.length)];
    setPuzzleTiles(chosen);
    setPuzzleMoves(0);
    setPuzzleCompleted(false);
  };

  useEffect(() => {
    if (selectedGameId === "puzzles") {
      initializePuzzle();
    }
  }, [selectedGameId]);

  const handlePuzzleTileClick = (index: number) => {
    if (puzzleCompleted) return;

    // Find zero (empty slot position)
    const zeroIndex = puzzleTiles.indexOf(0);
    const validSwaps: { [key: number]: number[] } = {
      0: [1, 2],
      1: [0, 3],
      2: [0, 3],
      3: [1, 2]
    };

    if (validSwaps[zeroIndex].includes(index)) {
      // Swap elements
      const newTiles = [...puzzleTiles];
      newTiles[zeroIndex] = puzzleTiles[index];
      newTiles[index] = 0;
      setPuzzleTiles(newTiles);
      setPuzzleMoves(m => m + 1);

      // Check win condition
      if (newTiles[0] === 1 && newTiles[1] === 2 && newTiles[2] === 3 && newTiles[3] === 0) {
        setPuzzleCompleted(true);
        const scoreVal = Math.max(40, 100 - (puzzleMoves * 4));
        const sessionLog: SessionLog = {
          id: "puz-" + Math.random().toString(36).substr(2, 5),
          timestamp: new Date().toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' }),
          exerciseType: "Juegos - Puzle Cerebral",
          duration: 30,
          metrics: {
            score: scoreVal,
            stability: Math.max(45, 100 - Math.round(currentWearableTremor * 4)),
            averageTremor: parseFloat(currentWearableTremor.toFixed(1)),
          },
          notes: `Puzzle Neocórtex: Resuelto en ${puzzleMoves + 1} toques dirigidos. Estimulación de coordinación tridimensional.`
        };
        onSessionComplete(sessionLog);
      }
    }
  };


  // --- PLAYABLE 9: GIMNASIA FISIONÓMICA (Charadas de Parkinson) ---
  const launchCharadeTimer = () => {
    const duration = charadePrompts[charadeIdx].time;
    setCharadeTimer(duration);
    setCharadeState("holding");
    setCharadeActive(true);
  };

  useEffect(() => {
    let interval: any = null;
    if (charadeActive && charadeTimer > 0) {
      interval = setInterval(() => {
        setCharadeTimer(t => t - 1);
      }, 1000);
    } else if (charadeTimer === 0 && charadeActive) {
      setCharadeActive(false);
      setCharadeState("rating");
    }
    return () => clearInterval(interval);
  }, [charadeActive, charadeTimer]);

  const submitCharadeRating = () => {
    setCharadeState("done");

    // Complete session with self evaluated parameters
    const sessionLog: SessionLog = {
      id: "char-" + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' }),
      exerciseType: "Juegos - Gimnasia Facial",
      duration: 15,
      metrics: {
        score: charadeSelfScore * 20,
        stability: Math.max(70, 100 - Math.round(currentWearableTremor * 2)),
        averageTremor: parseFloat(currentWearableTremor.toFixed(1)),
      },
      notes: `Gimnasia Orofacial: Completó el estímulo fisionómico (${charadePrompts[charadeIdx].task}). Nivel percibido de elasticidad: ${charadeSelfScore}/5 estrellas.`
    };
    onSessionComplete(sessionLog);
  };

  const nextCharade = () => {
    const nextIdx = (charadeIdx + 1) % charadePrompts.length;
    setCharadeIdx(nextIdx);
    setCharadeState("idle");
    setCharadeTimer(0);
    setCharadeActive(false);
  };


  // --- PLAYABLE 10: SOLITARIO SECUENCIAL (Control de temblor cinético) ---
  const initializeSolitaire = () => {
    const baseNums = [1, 2, 3, 4, 5, 6];
    // Shuffle
    const shuffled = baseNums
      .map(n => ({ val: n, matched: false }))
      .sort(() => Math.random() - 0.5);

    setSolitaireList(shuffled);
    setSolitaireTargetNum(1);
    setSolitaireTicks(0);
    setSolitaireState("playing");
  };

  const handleSolitaireCardClick = (num: number, idx: number) => {
    if (solitaireState !== "playing") return;

    setSolitaireTicks(t => t + 1);

    if (num === solitaireTargetNum) {
      // Success toque
      setSolitaireList(prev => prev.map((item, i) => i === idx ? { ...item, matched: true } : item));
      const nextTarget = solitaireTargetNum + 1;
      setSolitaireTargetNum(nextTarget);

      if (nextTarget > 6) {
        setSolitaireState("completed");
        
        // Log finished Solitaire
        const cleanScore = Math.max(30, 100 - (solitaireTicks - 6) * 10);
        const sessionLog: SessionLog = {
          id: "solit-" + Math.random().toString(36).substr(2, 5),
          timestamp: new Date().toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' }),
          exerciseType: "Juegos - Solitario Rítmico",
          duration: 30,
          metrics: {
            score: cleanScore,
            stability: Math.max(50, 100 - Math.round(currentWearableTremor * 4.5)),
            averageTremor: parseFloat(currentWearableTremor.toFixed(1)),
          },
          notes: `Solitario Rítmico completado en ${solitaireTicks} toques totales. Modula el ritmo motor voluntario.`
        };
        onSessionComplete(sessionLog);
      }
    }
  };

  // --- INTEGRATED WEARABLE PHYSICAL CONTROLLERS ---
  const calibrateWearableZero = () => {
    setWearableZeroOffset({
      x: currentWearableCoords.x,
      y: currentWearableCoords.y
    });
  };

  const distToSegment = (x: number, y: number, x1: number, y1: number, x2: number, y2: number) => {
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = -1;
    if (len_sq !== 0) param = dot / len_sq;

    let xx, yy;
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // 1. Maze Wearable Coordinates Reaction Loop
  useEffect(() => {
    if (selectedGameId === "maze" && mazeState === "playing" && mazeControlMode === "wearable") {
      const xDiff = currentWearableCoords.x - wearableZeroOffset.x;
      const yDiff = currentWearableCoords.y - wearableZeroOffset.y;

      setMazeBallPos(prev => {
        const sensitivity = 0.95;
        let newX = prev.x + xDiff * sensitivity;
        let newY = prev.y + yDiff * sensitivity;

        if (newX < 1) newX = 1;
        if (newX > 99) newX = 99;
        if (newY < 1) newY = 1;
        if (newY > 99) newY = 99;

        // Auto check checkpoint triggers
        const targetPt = mazePoints[mazeCheckpointIndex];
        if (targetPt) {
          const dist = Math.sqrt(Math.pow(newX - targetPt.x, 2) + Math.pow(newY - targetPt.y, 2));
          if (dist < 6.5) {
            // Must delay or immediately run checkpoint advance
            setTimeout(() => handleMazeCheckpointClick(mazeCheckpointIndex), 0);
          }
        }

        // Corridor deviation checking
        const activeTargetIdx = mazeCheckpointIndex;
        const prevPt = activeTargetIdx > 0 ? mazePoints[activeTargetIdx - 1] : mazePoints[0];
        const nextPt = activeTargetIdx < mazePoints.length ? mazePoints[activeTargetIdx] : mazePoints[mazePoints.length - 1];
        
        const pathDistance = distToSegment(newX, newY, prevPt.x, prevPt.y, nextPt.x, nextPt.y);
        
        if (pathDistance > 11.5) {
          const now = Date.now();
          if (now - lastMazeCollisionTime > 600) {
            setMazeMisses(m => m + 1);
            setLastMazeCollisionTime(now);
          }
        }

        return { x: newX, y: newY };
      });
    }
  }, [currentWearableCoords, selectedGameId, mazeState, mazeControlMode, mazeCheckpointIndex, wearableZeroOffset, lastMazeCollisionTime]);

  // 2. Bubbles Wearable Coordinates Reaction Loop
  useEffect(() => {
    if (selectedGameId === "bubbles" && bubblesState === "playing" && bubblesControlMode === "wearable") {
      const xDiff = currentWearableCoords.x - wearableZeroOffset.x;
      const yDiff = currentWearableCoords.y - wearableZeroOffset.y;

      setBubblesCrosshairPos(prev => {
        const sensitivity = 0.95;
        // Jitter mapping to the physical accelerometer tremor level
        const tremorJitterX = (Math.random() - 0.5) * currentWearableTremor * 0.4;
        const tremorJitterY = (Math.random() - 0.5) * currentWearableTremor * 0.4;

        let newX = prev.x + (xDiff * sensitivity) + tremorJitterX;
        let newY = prev.y + (yDiff * sensitivity) + tremorJitterY;

        if (newX < 1) newX = 1;
        if (newX > 99) newX = 99;
        if (newY < 1) newY = 1;
        if (newY > 99) newY = 99;

        return { x: newX, y: newY };
      });
    }
  }, [currentWearableCoords, selectedGameId, bubblesState, bubblesControlMode, wearableZeroOffset, currentWearableTremor]);

  // Handle continuous hover stabilization updates
  useEffect(() => {
    if (selectedGameId === "bubbles" && bubblesState === "playing" && bubblesControlMode === "wearable") {
      const interval = setInterval(() => {
        const hoveredBubble = bubblesList.find(b => {
          if (b.popped) return false;
          const dist = Math.sqrt(Math.pow(bubblesCrosshairPos.x - b.x, 2) + Math.pow(bubblesCrosshairPos.y - b.y, 2));
          return dist < 8.5;
        });

        if (hoveredBubble) {
          setBubblesTargetStabilization(stabil => {
            if (stabil && stabil.bubbleId === hoveredBubble.id) {
              const incrementalStep = Math.max(4, 18 - Math.round(currentWearableTremor * 1.5));
              const nextProgress = stabil.progress + incrementalStep;
              if (nextProgress >= 100) {
                handleBubbleClick(hoveredBubble.id);
                return null;
              }
              return { bubbleId: hoveredBubble.id, progress: nextProgress };
            } else {
              return { bubbleId: hoveredBubble.id, progress: 10 };
            }
          });
        } else {
          setBubblesTargetStabilization(null);
        }
      }, 100);

      return () => clearInterval(interval);
    }
  }, [selectedGameId, bubblesState, bubblesControlMode, bubblesCrosshairPos, bubblesList, currentWearableTremor]);

  // --- PLAYABLE 11: BURBUJAS DE PRECISIÓN MOTORA ---
  const startBubbles = () => {
    const colors = ["bg-rose-500", "bg-sky-500", "bg-emerald-500", "bg-amber-500", "bg-indigo-500"];
    const newList = Array.from({ length: 5 }, (_, i) => ({
      id: i,
      x: 10 + Math.random() * 80,
      y: 15 + Math.random() * 70,
      popped: false,
      color: colors[i % colors.length],
    }));
    setBubblesList(newList);
    setBubblesPoppedCount(0);
    setBubblesMisses(0);
    setBubblesStartTimestamp(Date.now());
    setBubblesState("playing");
    setBubblesCrosshairPos({ x: 50, y: 50 });
    setBubblesTargetStabilization(null);
  };

  const handleBubbleClick = (id: number) => {
    if (bubblesState !== "playing") return;

    setBubblesList(prev => prev.map(b => b.id === id ? { ...b, popped: true } : b));
    const nextCount = bubblesPoppedCount + 1;
    setBubblesPoppedCount(nextCount);

    if (nextCount >= 5) {
      setBubblesState("completed");
      const elapsed = (Date.now() - bubblesStartTimestamp) / 1000;
      const score = Math.max(30, 100 - Math.round(elapsed * 2.5) - (bubblesMisses * 5));
      const logId = "bubbles-" + Math.random().toString(36).substr(2, 5);
      const sessionLog: SessionLog = {
        id: logId,
        timestamp: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
        exerciseType: "Juegos - Burbujas de Precisión",
        duration: Math.round(elapsed),
        metrics: {
          score: Math.round(score),
          stability: Math.max(50, 100 - Math.round(currentWearableTremor * 4.2)),
          averageTremor: parseFloat(currentWearableTremor.toFixed(1)),
        },
        notes: `Burbujas de Precisión: Reventó 5 esferas móviles en ${elapsed.toFixed(1)} segundos con ${bubblesMisses} fallos. Estimulación propioceptiva.`
      };
      onSessionComplete(sessionLog);
    }
  };

  // --- PLAYABLE 12: CONEXIÓN DE PUNTOS ---
  const startDots = () => {
    const coords = [
      { x: 15, y: 25 },
      { x: 80, y: 20 },
      { x: 48, y: 50 },
      { x: 20, y: 80 },
      { x: 75, y: 75 }
    ];
    // Randomize placing positions of the numerals
    const shuffledCoords = [...coords].sort(() => Math.random() - 0.5);
    const colors = ["bg-sky-500", "bg-indigo-500", "bg-violet-500", "bg-purple-500", "bg-fuchsia-500"];
    const newList = Array.from({ length: 5 }, (_, i) => ({
      id: i,
      label: i + 1,
      x: shuffledCoords[i].x,
      y: shuffledCoords[i].y,
      clicked: false,
      color: colors[i % colors.length]
    }));
    setDotsList(newList);
    setDotsNextToClick(1);
    setDotsMisses(0);
    setDotsStartTimestamp(Date.now());
    setDotsState("playing");
  };

  const handleDotClick = (label: number) => {
    if (dotsState !== "playing") return;

    if (label === dotsNextToClick) {
      setDotsList(prev => prev.map(d => d.label === label ? { ...d, clicked: true } : d));
      const nextNum = dotsNextToClick + 1;
      setDotsNextToClick(nextNum);

      if (nextNum > 5) {
        setDotsState("completed");
        const elapsed = (Date.now() - dotsStartTimestamp) / 1000;
        const score = Math.max(30, 100 - Math.round(elapsed * 2.2) - (dotsMisses * 6));
        const logId = "dots-" + Math.random().toString(36).substr(2, 5);
        const sessionLog: SessionLog = {
          id: logId,
          timestamp: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
          exerciseType: "Juegos - Conexión de Puntos",
          duration: Math.round(elapsed),
          metrics: {
            score: Math.round(score),
            stability: Math.max(50, 100 - Math.round(currentWearableTremor * 4.5) - (dotsMisses * 3)),
            averageTremor: parseFloat(currentWearableTremor.toFixed(1)),
          },
          notes: `Conexión de Puntos: Secuenció de 1 al 5 en ${elapsed.toFixed(1)} segundos con ${dotsMisses} desvíos. Estimulación propioceptiva.`
        };
        onSessionComplete(sessionLog);
      }
    } else {
      setDotsMisses(prev => prev + 1);
    }
  };

  // --- PLAYABLE 13: LABERINTO DE ESTABILIDAD TÁCTIL ---
  const startMaze = () => {
    setMazeCheckpointIndex(0);
    setMazeMisses(0);
    setMazeStartTimestamp(Date.now());
    setMazeState("playing");
  };

  const handleMazeCheckpointClick = (idx: number) => {
    if (mazeState !== "playing") return;

    if (idx === mazeCheckpointIndex) {
      const nextIdx = mazeCheckpointIndex + 1;
      setMazeCheckpointIndex(nextIdx);

      if (nextIdx >= mazePoints.length) {
        setMazeState("completed");
        const elapsed = (Date.now() - mazeStartTimestamp) / 1000;
        const score = Math.max(30, 100 - Math.round(elapsed * 2.0) - (mazeMisses * 8));
        const logId = "maze-" + Math.random().toString(36).substr(2, 5);
        const sessionLog: SessionLog = {
          id: logId,
          timestamp: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
          exerciseType: "Juegos - Laberinto de Pulso",
          duration: Math.round(elapsed),
          metrics: {
            score: Math.round(score),
            stability: Math.max(45, 100 - Math.round(currentWearableTremor * 4.0) - (mazeMisses * 5)),
            averageTremor: parseFloat(currentWearableTremor.toFixed(1)),
          },
          notes: `Laberinto de Pulso: Recorrió 5 nodos de trayectoria en ${elapsed.toFixed(1)} segundos con ${mazeMisses} toques errados de muralla.`
        };
        onSessionComplete(sessionLog);
      }
    } else {
      setMazeMisses(prev => prev + 1);
    }
  };

  // --- PLAYABLE 14: VOCALIZACIÓN RÍTMICA ---
  const startPhonetics = () => {
    setPhoneticsState("idle");
    setPhoneticsActiveBeat(0);
    setPhoneticsHits(0);
    setPhoneticsMisses(0);
  };

  const launchPhonetics = () => {
    setPhoneticsState("playing");
    setPhoneticsStartTimestamp(Date.now());
    setPhoneticsActiveBeat(0);
    setPhoneticsHits(0);
    setPhoneticsMisses(0);
  };

  const handlePhoneticSyllableClick = (syllable: string) => {
    if (phoneticsState !== "playing") return;

    const expected = phoneticsPatterns[phoneticsActiveBeat];
    let incrementHits = 0;
    if (syllable === expected) {
      setPhoneticsHits(h => {
        incrementHits = h + 1;
        return h + 1;
      });
    } else {
      setPhoneticsMisses(m => m + 1);
      incrementHits = phoneticsHits;
    }

    const nextBeat = phoneticsActiveBeat + 1;
    if (nextBeat >= phoneticsPatterns.length) {
      setPhoneticsState("completed");
      const elapsed = (Date.now() - phoneticsStartTimestamp) / 1000;
      const totalElements = phoneticsPatterns.length;
      const score = Math.round((incrementHits / totalElements) * 100);
      
      const logId = "phon-" + Math.random().toString(36).substr(2, 5);
      const sessionLog: SessionLog = {
        id: logId,
        timestamp: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
        exerciseType: "Juegos - Vocalización Rítmica",
        duration: Math.round(elapsed),
        metrics: {
          score: score,
          stability: Math.max(50, 100 - (phoneticsMisses * 15)),
          averageTremor: parseFloat(currentWearableTremor.toFixed(1)),
        },
        notes: `Rhythm Speech Pacer: Completó PA-TA-KA vocalizado en ${elapsed.toFixed(1)}s con ${score}% de sincronía silábica.`
      };
      onSessionComplete(sessionLog);
    } else {
      setPhoneticsActiveBeat(nextBeat);
    }
  };

  // --- PLAYABLE 15: GIMNASIA LINGUAL ---
  const startLingual = () => {
    setLingualState("idle");
    setLingualIdx(0);
    setLingualTimer(0);
    setLingualSelfScore(4);
  };

  const launchLingualTimer = () => {
    setLingualState("holding");
    setLingualTimer(lingualPrompts[lingualIdx].time);
  };

  const submitLingualRating = () => {
    setLingualState("done");
  };

  const nextLingual = () => {
    const nextIdx = lingualIdx + 1;
    if (nextIdx >= lingualPrompts.length) {
      setLingualState("completed" as any);
      const elapsed = 24; 
      const score = Math.round(lingualSelfScore * 20); 
      const logId = "ling-" + Math.random().toString(36).substr(2, 5);
      const sessionLog: SessionLog = {
        id: logId,
        timestamp: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
        exerciseType: "Juegos - Gimnasia Lingual",
        duration: elapsed,
        metrics: {
          score: score,
          stability: Math.max(60, score - 5),
          averageTremor: parseFloat(currentWearableTremor.toFixed(1)),
        },
        notes: `Gimnasia Lingual: Completó 4 secuencias de tonificación con auto-percepción de ${lingualSelfScore}/5 de amplitud del habla.`
      };
      onSessionComplete(sessionLog);
    } else {
      setLingualIdx(nextIdx);
      setLingualState("idle");
    }
  };

  useEffect(() => {
    let interval: any = null;
    if (lingualState === "holding" && lingualTimer > 0) {
      interval = setInterval(() => {
        setLingualTimer(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            setLingualState("rating");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [lingualState, lingualTimer]);

  return (
    <div className="space-y-6" id="games-hub-system">
      
      {/* If no game is selected, show category selectors + All 10 games from Lonestar Neurology article */}
      {!selectedGameId ? (
        <div className="space-y-6">
          {/* Tabs configuration menu */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-xs">
            <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-indigo-500 animate-pulse" />
              <span>Agrupación Temática de Ejercitación:</span>
            </span>

            <div className="flex flex-wrap bg-slate-50 p-1 rounded-lg border border-slate-200">
              {[
                { id: "cognitivo", label: "Lógica y Cognitivo" },
                { id: "motor", label: "Coordinación y Motor Fino" },
                { id: "coordinacion", label: "Gimnasia Orofacial" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? "bg-white text-indigo-600 shadow-xs border border-slate-100"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grouped Games by Theme */}
          <div className="space-y-10">
            {[
              {
                id: "cognitivo",
                title: "🧠 Estimulación Cognitiva y Lógica Cerebral",
                description: "Ejercicios clínicos que estimulan la memoria visual de trabajo, velocidad de cálculo, planificación secuencial y destreza deductiva.",
                gameIds: ["memory", "wordsearch", "chess", "poker", "blackjack", "scrabble"],
                themeTag: "Cognitivo"
              },
              {
                id: "motor",
                title: "✍️ Coordinación Motora Fina y Control Rítmico",
                description: "Ejercicios enfocados en regular el pulso manual, reducir la dactilografía espasmódica, calibrar la precisión óculo-manual y atenuar temblores.",
                gameIds: ["simon", "puzzles", "solitaire", "bubbles", "dots", "maze"],
                themeTag: "Motor Fino"
              },
              {
                id: "coordinacion",
                title: "😊 Gimnasia Facial y Expresividad (Habla)",
                description: "Prácticas fonoaudiológicas guiadas destinadas a estirar la fisionomía, previniendo la parálisis protectora o inexpresividad (hipomimia).",
                gameIds: ["charades", "phonetics", "lingual"],
                themeTag: "Expresión & Coordinación"
              }
            ]
              .filter(theme => activeTab === theme.id)
              .map((theme) => {
                const themeGames = clinicalGames.filter(game => theme.gameIds.includes(game.id));
                if (themeGames.length === 0) return null;

                return (
                  <div key={theme.id} className="space-y-4">
                    {/* Header Group Banner */}
                    <div className="bg-slate-50/80 border border-slate-200/60 p-4 rounded-xl">
                      <h3 className="text-sm font-extrabold text-indigo-950 flex items-center gap-1.5">
                        {theme.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        {theme.description}
                      </p>
                    </div>

                    {/* Games Grid inside Category */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {themeGames.map((game, idx) => (
                        <div 
                          key={game.id}
                          className="bg-white border border-slate-100 rounded-xl p-5 flex flex-col justify-between hover:shadow-md hover:border-indigo-105 transition-all group relative border-l-4 border-l-indigo-650 border-l-indigo-500"
                          id={`game-${game.id}`}
                        >
                          <span className="absolute top-4 right-4 text-[10px] font-bold text-indigo-400 font-mono bg-indigo-50 px-2 py-0.5 rounded-md">
                            {game.difficulty === "Bajo" ? "★☆☆" : game.difficulty === "Medio" ? "★★☆" : "★★★"} {game.difficulty}
                          </span>

                          <div className="space-y-3">
                            <span className="text-[10px] uppercase font-bold py-0.5 px-2 rounded-full bg-slate-100 text-slate-650 inline-block">
                              {game.category}
                            </span>

                            <div>
                              <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                                {game.title}
                              </h4>
                              <p className="text-[10px] text-slate-400 italic">Formato clínico: {game.originalTitle}</p>
                            </div>

                            <p className="text-xs text-slate-500 leading-relaxed">{game.description}</p>
                          </div>

                          {/* Benefits and Action Trigger */}
                          <div className="mt-4 pt-3 border-t border-slate-50 bg-slate-50/50 -mx-5 -mb-5 p-4 rounded-b-xl space-y-3">
                            <div className="text-[11px] text-slate-600 leading-relaxed flex items-start gap-1.5">
                              <Brain className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 mt-0.5" />
                              <span><strong>Beneficio Parkinson:</strong> {game.benefit}</span>
                            </div>

                            <button
                              onClick={() => {
                                if (game.id === "bubbles") {
                                  startBubbles();
                                } else if (game.id === "dots") {
                                  startDots();
                                } else if (game.id === "maze") {
                                  startMaze();
                                } else if (game.id === "phonetics") {
                                  startPhonetics();
                                } else if (game.id === "lingual") {
                                  startLingual();
                                }
                                setSelectedGameId(game.id);
                              }}
                              className="w-full flex items-center justify-center gap-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5 fill-white" />
                              <span>Iniciar Versión Interactiva</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* DYNAMIC METRIC LISTING & CALIBRATION DASHBOARD IN GAMES SECTION */}
          {(() => {
            const precisionSessions = gameSessions.filter(
              s => s.exerciseType.includes("Burbujas") || 
                   s.exerciseType.includes("Puntos") || 
                   s.exerciseType.includes("Laberinto")
            );

            const avgScore = precisionSessions.length > 0
              ? Math.round(precisionSessions.reduce((acc, s) => acc + s.metrics.score, 0) / precisionSessions.length)
              : null;

            const avgStability = precisionSessions.length > 0
              ? Math.round(precisionSessions.reduce((acc, s) => acc + (s.metrics.stability || 0), 0) / precisionSessions.length)
              : null;

            const avgTime = precisionSessions.length > 0
              ? (precisionSessions.reduce((acc, s) => acc + s.duration, 0) / precisionSessions.length).toFixed(1)
              : null;

            return (
              <div className="border border-slate-150 rounded-2xl bg-white p-6 mt-8 space-y-6 shadow-sm">
                
                {/* Live Diagnostics Card */}
                <div className="bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-100 rounded-xl p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <h4 className="text-xs uppercase tracking-wider font-extrabold text-indigo-700 flex items-center gap-1.5 font-mono">
                        <Zap className="w-4 h-4 text-amber-500 animate-bounce" />
                        <span>Métricas de Calibración Motora Activa</span>
                      </h4>
                      <h3 className="text-sm font-black text-slate-800">Cómputo Lúdico de Precisión</h3>
                    </div>
                    {avgStability !== null && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-full animate-pulse self-start sm:self-center">
                        ✓ Calibración Establecidas
                      </span>
                    )}
                  </div>

                  {precisionSessions.length === 0 ? (
                    <div className="py-2 text-xs text-slate-500 leading-relaxed max-w-lg">
                      <p>
                        Aún no se computan estadísticas agregadas de motricidad. Completa actividades interactivas de precisión como <strong className="text-indigo-600 font-semibold">Burbujas de Precisión, Conexión de Puntos o Laberinto de Senda</strong> para calibrar tu reporte automatizado de rango articular.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                      <div className="bg-white border border-slate-150/80 p-3 rounded-lg text-center shadow-xs">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Destreza de Trazado</span>
                        <span className="text-xl font-extrabold text-indigo-600 block mt-1">{avgScore}%</span>
                        <span className="text-[9px] text-slate-500 block mt-0.5">Visomotora general</span>
                      </div>
                      <div className="bg-white border border-slate-150/80 p-3 rounded-lg text-center shadow-xs">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Estabilidad Intencional</span>
                        <span className={`text-xl font-extrabold block mt-1 ${avgStability! >= 80 ? "text-emerald-600" : avgStability! >= 60 ? "text-amber-500" : "text-rose-500"}`}>{avgStability}%</span>
                        <span className="text-[9px] text-slate-500 block mt-0.5">Control de temblores</span>
                      </div>
                      <div className="bg-white border border-slate-150/80 p-3 rounded-lg text-center shadow-xs">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Reacción Media</span>
                        <span className="text-xl font-extrabold text-slate-700 block mt-1 font-mono">{avgTime}s</span>
                        <span className="text-[9px] text-slate-500 block mt-0.5">Duración por fase</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                      <Award className="w-5 h-5 animate-pulse" />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 font-sans">Tus Últimos Resultados de Juegos</h3>
                      <p className="text-[11px] text-slate-500">Historial exclusivo de rendimiento lúdico y estabilidad motriz.</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 bg-slate-50 rounded-lg border border-slate-150 text-slate-600">
                    Total Sesiones: {gameSessions.length}
                  </span>
                </div>

                {gameSessions.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    <Gamepad2 className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-1 animate-pulse" />
                    <p>Aún no has completado juegos interactivos en esta sesión.</p>
                    <p className="text-[11px] text-slate-400 mt-1">¡Inicia cualquiera de las 13 actividades superiores para registrar tus métricas!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {gameSessions.map((session, index) => (
                  <div key={session.id || index} className="bg-white border border-slate-150 p-4 rounded-xl flex flex-col justify-between hover:shadow-xs transition-shadow">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-750 rounded-full text-[10px] font-mono font-bold">
                          {session.exerciseType}
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {session.timestamp}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-800 line-clamp-1">
                        Socio-Sesión Terapéutica
                      </h4>

                      <p className="text-[11px] text-slate-500 leading-relaxed italic line-clamp-2">
                        "{session.notes}"
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <p className="text-[9px] text-slate-400 font-semibold uppercase">Puntaje</p>
                        <p className="font-bold text-indigo-600 font-sans text-sm">{session.metrics.score}%</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400 font-semibold uppercase">Estabilidad</p>
                        <p className="font-bold text-emerald-600 font-sans text-sm">{session.metrics.stability}%</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400 font-semibold uppercase">Temblor</p>
                        <p className="font-bold text-slate-700 font-mono text-sm">{session.metrics.averageTremor} Hz</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
              </div>
            );
          })()}
        </div>
      ) : (
        /* ACTIVE CHOSEN INTERACTIVE GAME VIEW PANEL */
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm animate-fade-in space-y-6">
          {/* Inner Back Title Header */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-slate-100">
            <div>
              <button 
                onClick={() => setSelectedGameId(null)}
                className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                &larr; Volver a las 10 actividades de Lonestar
              </button>
              <h2 className="text-lg font-bold text-slate-800 mt-2">
                {clinicalGames.find(g => g.id === selectedGameId)?.title}
              </h2>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Mitigación Wearable</span>
              <span className="text-xs font-mono font-semibold text-emerald-600">
                Temblor: {currentWearableTremorClass} ({currentWearableTremor} Hz/Rms)
              </span>
            </div>
          </div>

          {/* ACTIVE CHOSEN GAME CONTENT BODY */}

          {/* GAME 1: SIMON SAYS */}
          {selectedGameId === "simon" && (
            <div className="max-w-md mx-auto space-y-6 text-center">
              <p className="text-xs text-slate-500 leading-relaxed">
                Presta atención a la secuencia coordinada de colores. Tu wearable sincroniza el ritmo para calcular tu tiempo de respuesta motora fina al presionar el panel.
              </p>

              {simonState === "idle" && (
                <div className="py-8 bg-slate-50 rounded-xl space-y-4">
                  <span className="inline-block p-3 bg-indigo-50 text-indigo-600 rounded-full">
                    <Sparkles className="w-8 h-8" />
                  </span>
                  <p className="text-xs font-medium text-slate-600">Completa tantas secuencias rítmicas de colores como puedas</p>
                  <button
                    onClick={startSimon}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg cursor-pointer"
                  >
                    Iniciar Simón Dice
                  </button>
                </div>
              )}

              {(simonState === "showing" || simonState === "userRun") && (
                <div className="space-y-6">
                  <div className="inline-block px-3 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-full text-xs font-medium">
                    {simonState === "showing" ? "🤖 Simón está parpadeando la secuencia de estimulación..." : "👈 ¡Tu turno! Presiona los botones"}
                  </div>

                  <div className="grid grid-cols-2 gap-4 max-w-[240px] mx-auto">
                    {[
                      { id: 0, color: "bg-rose-500 border-rose-600", activeColor: "bg-rose-300 ring-rose-500", label: "ROJO" },
                      { id: 1, color: "bg-sky-500 border-sky-600", activeColor: "bg-sky-300 ring-sky-500", label: "AZUL" },
                      { id: 2, color: "bg-emerald-500 border-emerald-600", activeColor: "bg-emerald-300 ring-emerald-500", label: "VERDE" },
                      { id: 3, color: "bg-amber-500 border-amber-600", activeColor: "bg-amber-300 ring-amber-500", label: "AMARILLO" }
                    ].map((pad) => (
                      <button
                        key={pad.id}
                        disabled={simonState !== "userRun"}
                        onClick={() => handleSimonPadClick(pad.id)}
                        className={`w-24 h-24 rounded-2xl border-b-4 transition-all flex items-center justify-center text-xs text-white font-bold cursor-pointer hover:opacity-90 ${
                          simonActiveColor === pad.id ? `${pad.activeColor} scale-95 ring-4` : pad.color
                        }`}
                      >
                        {pad.label}
                      </button>
                    ))}
                  </div>

                  <div className="text-sm font-semibold text-slate-700">
                    Aciertos correctos de la secuencia: <span className="font-mono text-base font-bold text-indigo-600">{simonScore}</span>
                  </div>
                </div>
              )}

              {simonState === "gameOver" && (
                <div className="p-5 bg-rose-50 border border-rose-100 rounded-xl space-y-3">
                  <p className="text-sm font-bold text-rose-800">Secuencia rítmica finalizada</p>
                  <p className="text-xs text-slate-600">Alcanzaste <strong className="text-base text-rose-700">{simonScore}</strong> repeticiones exitosas antes de un desvío motriz.</p>
                  
                  <div className="flex gap-2 justify-center pt-2">
                    <button
                      onClick={startSimon}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Reintentar
                    </button>
                    <button
                      onClick={() => setSelectedGameId(null)}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-lg cursor-pointer"
                    >
                      Volver
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GAME 2: MEMORY MATCH */}
          {selectedGameId === "memory" && (
            <div className="max-w-md mx-auto space-y-6 text-center">
              <p className="text-xs text-slate-500">
                Toca las cartas para darlas vuelta y emparejar las figuras de salud. Ejercita atención ejecutiva y calibración del temblor manual.
              </p>

              <div className="grid grid-cols-4 gap-3 max-w-[320px] mx-auto">
                {memoryCards.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => handleCardClick(card.id)}
                    className={`h-16 rounded-xl border font-bold text-2xl transition-all cursor-pointer flex items-center justify-center ${
                      card.isFlipped || card.isMatched
                        ? "bg-indigo-50 border-indigo-200 text-indigo-600 transform scale-95"
                        : "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-400"
                    }`}
                  >
                    {card.isFlipped || card.isMatched ? card.symbol : "?"}
                  </button>
                ))}
              </div>

              <div className="flex justify-between items-center max-w-[320px] mx-auto text-xs text-slate-600 font-medium">
                <span>Intentos: <strong>{memoryMoves}</strong></span>
                <span>Filtro de temblor: <strong className="text-emerald-605">Activo</strong></span>
              </div>

              {memoryCompleted && (
                <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-xl space-y-3">
                  <p className="text-sm font-bold text-emerald-800">¡Felicidades, emparejado completo!</p>
                  <p className="text-xs text-slate-650">Terminaste el juego de atención visual en <strong className="text-emerald-700 font-mono text-sm">{memoryMoves} intentos</strong>.</p>
                  
                  <div className="flex gap-2 justify-center pt-2">
                    <button
                      onClick={initializeMemory}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Jugar otra vez
                    </button>
                    <button
                      onClick={() => setSelectedGameId(null)}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-lg cursor-pointer"
                    >
                      Volver
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GAME 3: WORDSEARCH SOPA DE LETRAS */}
          {selectedGameId === "wordsearch" && (
            <div className="max-w-md mx-auto space-y-6">
              <p className="text-xs text-slate-500 text-center">
                Haz clic consecutivo en las celdas para seleccionar las letras de una palabra. Encuentra las 5 palabras del tratamiento: <strong className="text-indigo-600">NEURO, SALUD, RITMO, PASO, VOZ</strong>.
              </p>

              <div className="grid grid-cols-6 gap-2 max-w-[280px] mx-auto bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                {gridLetterArray.map((row, rIdx) => 
                  row.map((char, cIdx) => {
                    const isSelected = selectedGridLetters.some(item => item.r === rIdx && item.c === cIdx);
                    return (
                      <button
                        key={`${rIdx}-${cIdx}`}
                        onClick={() => handleKeyLetterClick(rIdx, cIdx, char)}
                        className={`w-9 h-9 font-bold font-mono text-sm rounded-lg transition-all cursor-pointer flex items-center justify-center border ${
                          isSelected
                            ? "bg-amber-505 bg-amber-500 text-white border-amber-600 transform scale-95"
                            : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {char}
                      </button>
                    );
                  })
                )}
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Borrador: {selectedWordText || "_"}</span>
                  {selectedWordText && (
                    <button 
                      onClick={clearWordSelection}
                      className="text-[10px] text-red-500 hover:underline font-semibold"
                    >
                      Limpiar selección
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 justify-center">
                  {targetWords.map((word) => {
                    const found = foundWords.includes(word);
                    return (
                      <span
                        key={word}
                        className={`px-3 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1 ${
                          found
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-400 border border-slate-200"
                        }`}
                      >
                        {found && <Check className="w-3 h-3" />}
                        {word}
                      </span>
                    );
                  })}
                </div>

                {foundWords.length === targetWords.length && (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 text-center rounded-xl space-y-2">
                    <p className="text-xs font-bold text-emerald-800">Sopa de letras completada</p>
                    <p className="text-[11px] text-slate-650">Su agudeza visual y escaneo motor fino han sido calibrados exitosamente.</p>
                    <button
                      onClick={resetWordsearch}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg cursor-pointer"
                    >
                      Reiniciar sopa de letras
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* GAME 4: CHESS & CHECKERS */}
          {selectedGameId === "chess" && (
            <div className="max-w-md mx-auto space-y-6 text-center">
              <p className="text-xs text-slate-500">
                Selecciona tus fichas rojas (<strong>U</strong>) y llévalas diagonalmente a celdas vacías (<strong>.</strong>) o salta sobre fichas contrarias grises (<strong>C</strong>) para comerlas. Entrena precisión táctil del pulsor.
              </p>

              <div className="grid grid-cols-4 gap-2 max-w-[200px] mx-auto bg-slate-50 p-2 rounded-xl border border-slate-200">
                {checkersBoard.map((row, rIdx) =>
                  row.map((cell, cIdx) => {
                    const isSelected = checkersSelected?.r === rIdx && checkersSelected?.c === cIdx;
                    return (
                      <button
                        key={`${rIdx}-${cIdx}`}
                        onClick={() => handleCheckerCellClick(rIdx, cIdx)}
                        className={`w-11 h-11 border rounded-lg font-bold text-sm transition-all focus:outline-none flex items-center justify-center ${
                          (rIdx + cIdx) % 2 === 0 ? "bg-slate-100" : "bg-white"
                        } ${
                          isSelected ? "ring-2 ring-indigo-500 border-indigo-400" : "border-slate-200"
                        }`}
                      >
                        {cell === "U" && (
                          <span className="w-7 h-7 bg-red-500 text-white flex items-center justify-center rounded-full text-xs shadow-sm font-black ring-1 ring-red-400">
                            U
                          </span>
                        )}
                        {cell === "C" && (
                          <span className="w-7 h-7 bg-slate-400 text-slate-800 flex items-center justify-center rounded-full text-xs shadow-sm font-black ring-1 ring-slate-350">
                            C
                          </span>
                        )}
                        {cell === "." && <span className="text-slate-300">•</span>}
                      </button>
                    );
                  })
                )}
              </div>

              <div className="flex justify-between items-center max-w-[200px] mx-auto text-xs text-slate-500">
                <span>Movimientos: <strong>{checkersMoves}</strong></span>
                <button 
                  onClick={startCheckers}
                  className="text-indigo-600 hover:underline flex items-center gap-1 font-semibold"
                >
                  <RefreshCw className="w-3 h-3" /> Reiniciar
                </button>
              </div>

              {checkersState === "win" && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <p className="text-xs font-bold text-emerald-800">¡Excelente victoria estratégica!</p>
                  <p className="text-[11px] text-slate-600">Has derrotado las fichas contrarias en {checkersMoves} movimientos precisos con tu pulso motor calibrado.</p>
                </div>
              )}

              {checkersState === "lose" && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl">
                  <p className="text-xs font-bold text-rose-800">¡Bajas piezas aliadas!</p>
                  <p className="text-[11px] text-slate-650">No quedan fichas aliadas para comandar. Intenta otra ronda de práctica.</p>
                  <button
                    onClick={startCheckers}
                    className="mt-2 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] rounded-lg font-bold"
                  >
                    Volver a jugar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* GAME 5: POKER */}
          {selectedGameId === "poker" && (
            <div className="max-w-md mx-auto space-y-6 text-center">
              <p className="text-xs text-slate-500">
                Te hemos repartido una mano de 5 naipes. Selecciona cuáles quieres descartar marcando la opción y pulsa el botón para recibir cartas de repuesto.
              </p>

              {pokerState === "idle" && (
                <div className="py-6 bg-slate-50 rounded-xl space-y-3">
                  <p className="text-xs font-semibold text-slate-650">¿Listo para medir tu discernimiento de parejas?</p>
                  <button
                    onClick={generatePokerHand}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg"
                  >
                    Repartir Mano de Naipes
                  </button>
                </div>
              )}

              {pokerState === "playing" && (
                <div className="space-y-6">
                  <div className="flex justify-center gap-2">
                    {pokerHand.map((card, idx) => (
                      <button
                        key={idx}
                        onClick={() => togglePokerSelect(idx)}
                        className={`w-14 h-20 rounded-xl border-2 flex flex-col justify-between p-2 cursor-pointer transition-all ${
                          card.active 
                            ? "bg-amber-50 border-amber-500 scale-95" 
                            : "bg-white border-slate-200 hover:border-indigo-400"
                        }`}
                      >
                        <span className="text-xs font-bold">{card.value}</span>
                        <span className="text-lg self-center">{card.suit}</span>
                        <span className="text-[8px] font-semibold text-slate-400">
                          {card.active ? "DESCARTE" : "CONSERVAR"}
                        </span>
                      </button>
                    ))}
                  </div>

                  <p className="text-[11px] text-slate-600">Toca las cartas que deseas cambiar y luego presiona "Ejecutar Descarte Terapéutico"</p>

                  <button
                    onClick={executeDiscard}
                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                  >
                    Confirmar Cambio de Cartas & Calificar
                  </button>
                </div>
              )}

              {pokerState === "complete" && (
                <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-xl space-y-4">
                  <div className="flex justify-center gap-2">
                    {pokerHand.map((card, idx) => (
                      <div
                        key={idx}
                        className="w-14 h-20 rounded-xl bg-white border border-indigo-200 flex flex-col justify-between p-2 shadow-xs"
                      >
                        <span className="text-xs font-bold text-slate-800">{card.value}</span>
                        <span className="text-lg text-slate-700 self-center">{card.suit}</span>
                        <span className="text-[7px] font-bold text-indigo-500">MANO</span>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs font-bold text-indigo-800">{pokerFeedback}</p>
                  
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={generatePokerHand}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                    >
                      Jugar de nuevo
                    </button>
                    <button
                      onClick={() => setSelectedGameId(null)}
                      className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Volver menú
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GAME 6: BLACKJACK */}
          {selectedGameId === "blackjack" && (
            <div className="max-w-md mx-auto space-y-6 text-center">
              <p className="text-xs text-slate-500">
                Objetivo: Acércate lo más posible a 21 sin pasarte. Pulsa "Pedir Carta" para sumar o "Plantarse" para comparar contra la casa.
              </p>

              {bjState === "idle" && (
                <div className="py-6 bg-slate-50 rounded-xl space-y-3">
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2.5 py-1 rounded-full uppercase">
                    Rachas ganadoras: {bjScore} partidas
                  </span>
                  <p className="text-xs text-slate-500">Pon a prueba tu agilidad de cálculo matemático.</p>
                  <button
                    onClick={startBlackjack}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                  >
                    Iniciar Partida de Blackjack
                  </button>
                </div>
              )}

              {bjState === "playerTurn" && (
                <div className="space-y-6">
                  {/* Cards display */}
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tus cartas (Suma: {getHandSum(bjPlayerHand)})</p>
                      <div className="flex justify-center gap-2 mt-1">
                        {bjPlayerHand.map((c, i) => (
                          <div key={i} className="w-12 h-16 bg-white border border-slate-300 rounded-lg flex flex-col justify-between p-1 shadow-xs">
                            <span className="text-[11px] font-bold">{c.val}</span>
                            <span className="text-base self-center">{c.suit}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mesa del Dealer (Banca)</p>
                      <div className="flex justify-center gap-2 mt-1">
                        {bjDealerHand.map((c, i) => (
                          <div key={i} className="w-12 h-16 bg-slate-100 border border-slate-300 rounded-lg flex flex-col justify-between p-1">
                            <span className="text-[11px] font-bold text-slate-700">{c.val}</span>
                            <span className="text-base self-center">{c.suit}</span>
                          </div>
                        ))}
                        <div className="w-12 h-16 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-center font-bold text-slate-400 text-sm">
                          ?
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center gap-3 pt-3">
                    <button
                      onClick={handleBlackjackHit}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                    >
                      Pedir Carta (+1)
                    </button>
                    <button
                      onClick={handleBlackjackStand}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                    >
                      Plantarse (Comparar)
                    </button>
                  </div>
                </div>
              )}

              {["win", "lose", "draw"].includes(bjState) && (
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                  <div className="flex justify-center gap-6">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold">TU SUMA</p>
                      <p className="text-lg font-bold text-slate-700">{getHandSum(bjPlayerHand)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold">BANCA SUMA</p>
                      <p className="text-lg font-bold text-slate-700">{getHandSum(bjDealerHand)}</p>
                    </div>
                  </div>

                  <div className={`p-2.5 rounded-lg text-xs font-bold ${
                    bjState === "win" ? "bg-emerald-50 text-emerald-800" : bjState === "lose" ? "bg-rose-50 text-rose-800" : "bg-slate-100 text-slate-700"
                  }`}>
                    {bjState === "win" ? "🏆 ¡Ronda ganada!" : bjState === "lose" ? "💥 ¡La casa se queda con la ronda!" : "🤝 ¡Empate!"}
                  </div>

                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={startBlackjack}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                    >
                      Repetir Ronda
                    </button>
                    <button
                      onClick={() => setBjState("idle")}
                      className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-750 text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Menu principal
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GAME 7: SCRABBLE (Formador Léxico) */}
          {selectedGameId === "scrabble" && (
            <div className="max-w-md mx-auto space-y-6 text-center">
              <p className="text-xs text-slate-500">
                Pista: <span className="font-semibold text-slate-800">"{spellerChallenges[spellerIndex].hint}"</span>
              </p>

              <div className="space-y-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-300 min-h-[50px] flex items-center justify-center gap-2">
                  {spellerSelections.map((l, i) => (
                    <span key={i} className="w-8 h-8 bg-indigo-600 text-white text-sm font-bold flex items-center justify-center rounded-lg shadow-sm">
                      {l}
                    </span>
                  ))}
                  {spellerSelections.length === 0 && (
                    <span className="text-xs text-slate-400">Presiona las fichas de abajo en orden</span>
                  )}
                </div>

                <div className="flex justify-center gap-1.5 flex-wrap">
                  {spellerChallenges[spellerIndex].shuffled.split("").map((letter, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSpellerLetterClick(letter, idx)}
                      className="w-10 h-10 bg-white hover:bg-indigo-50 border border-slate-300 hover:border-indigo-500 text-slate-750 font-extrabold text-sm rounded-lg cursor-pointer transition-all active:scale-95 flex items-center justify-center"
                    >
                      {letter}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 justify-center pt-2">
                <button
                  onClick={verifySpellerWord}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Confirmar Palabra
                </button>
                <button
                  onClick={startSpeller}
                  className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Limpiar Todo
                </button>
              </div>

              {spellerComplete && (
                <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-xl space-y-3">
                  <p className="text-xs font-bold text-emerald-800">🎉 ¡Concepto Clínico Correcto!</p>
                  <p className="text-[11px] text-slate-650">Palabra formada: <strong>{spellerChallenges[spellerIndex].target}</strong></p>
                  
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => {
                        const next = (spellerIndex + 1) % spellerChallenges.length;
                        setSpellerIndex(next);
                      }}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                    >
                      Siguiente Palabra
                    </button>
                    <button
                      onClick={() => setSelectedGameId(null)}
                      className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-750 text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Menú Juegos
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GAME 8: PUZZLE */}
          {selectedGameId === "puzzles" && (
            <div className="max-w-md mx-auto space-y-6 text-center">
              <p className="text-xs text-slate-500">
                Mueve los fragmentos del cerebro para encastrarlos. Haz clic en un mosaico numerado adyacente a la celda vacía (punto gris) para intercambiar de lugar. Objetivo: <strong>[1, 2, 3]</strong> y vacío al final.
              </p>

              <div className="grid grid-cols-2 gap-2 max-w-[120px] mx-auto bg-slate-100 p-2 rounded-xl border border-slate-200">
                {puzzleTiles.map((tile, idx) => (
                  <button
                    key={idx}
                    onClick={() => handlePuzzleTileClick(idx)}
                    className={`w-12 h-12 rounded-lg font-bold text-xs flex items-center justify-center transition-all ${
                      tile === 0 
                        ? "bg-slate-300 border border-slate-400 text-slate-600 animate-pulse" 
                        : "bg-indigo-650 bg-indigo-600 hover:bg-indigo-750 text-white font-extrabold border-b-2 border-indigo-750 active:scale-95"
                    }`}
                  >
                    {tile === 0 ? "▪️" : `PEDAZO ${tile}`}
                  </button>
                ))}
              </div>

              <div className="flex justify-between items-center max-w-[120px] mx-auto text-xs text-slate-500">
                <span>Jugadas: <strong>{puzzleMoves}</strong></span>
                <button 
                  onClick={initializePuzzle}
                  className="text-indigo-600 hover:underline flex items-center gap-0.5 font-bold"
                >
                  <RefreshCw className="w-3 h-3" /> Reiniciar
                </button>
              </div>

              {puzzleCompleted && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl space-y-2">
                  <p className="text-xs font-bold text-emerald-800">¡Neuro-Puzzle Resuelto con Éxito!</p>
                  <p className="text-[11px] text-slate-600">Completaste la restauración del mosaico del neocórtex en {puzzleMoves} movimientos.</p>
                </div>
              )}
            </div>
          )}

          {/* GAME 9: CHARADES (Gimnasia Facial de Parkinson) */}
          {selectedGameId === "charades" && (
            <div className="max-w-md mx-auto space-y-6 text-center">
              <p className="text-xs text-slate-505 text-slate-500">
                Estimula y activa tus músculos faciales haciendo la mímica frente a la pantalla y sosteniendo la gesticulación mientras dura el cronómetro.
              </p>

              <div className="p-6 bg-slate-50 border border-slate-150 rounded-2xl space-y-4">
                <span className="inline-block p-1 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-md uppercase">
                  Área muscular a elongar: {charadePrompts[charadeIdx].area}
                </span>

                <h3 className="text-base font-extrabold text-slate-800 leading-snug">
                  "{charadePrompts[charadeIdx].task}"
                </h3>

                {charadeState === "idle" && (
                  <button
                    onClick={launchCharadeTimer}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                  >
                    ¡Comenzar Retención de {charadePrompts[charadeIdx].time} Segundos!
                  </button>
                )}

                {charadeState === "holding" && (
                  <div className="space-y-3">
                    <div className="w-16 h-16 rounded-full border-4 border-amber-500 flex items-center justify-center mx-auto text-xl font-bold font-mono text-amber-700 animate-pulse bg-amber-50">
                      {charadeTimer}s
                    </div>
                    <p className="text-xs font-semibold text-amber-800">¡Sostén la mímica con energía y fuerza!</p>
                  </div>
                )}

                {charadeState === "rating" && (
                  <div className="space-y-4">
                    <p className="text-xs font-bold text-slate-700">¿Cómo percibiste la flexibilidad y elongación?</p>
                    
                    <div className="flex justify-center gap-2">
                      {[1, 2, 3, 4, 5].map((stars) => (
                        <button
                          key={stars}
                          onClick={() => setCharadeSelfScore(stars)}
                          className={`text-2xl transition-all cursor-pointer ${
                            stars <= charadeSelfScore ? "text-amber-400 font-bold" : "text-slate-300"
                          }`}
                        >
                          ★
                        </button>
                      ))}
                    </div>

                    <p className="text-[10px] text-slate-400">1: Muy rígido / 5: Excelente flexibilidad cigomática</p>

                    <button
                      onClick={submitCharadeRating}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                    >
                      Calificar Retención Orofacial
                    </button>
                  </div>
                )}

                {charadeState === "done" && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl space-y-2">
                    <p className="text-[11px] font-bold text-emerald-800">¡Excelente retención!</p>
                    <p className="text-[10px] text-slate-650">Ayuda a prevenir rigidez fonológica o disfagia.</p>
                    
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={nextCharade}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg"
                      >
                        Siguiente Actividad
                      </button>
                      <button
                        onClick={() => setSelectedGameId(null)}
                        className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-semibold rounded-lg"
                      >
                        Salir
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* GAME 10: SOLITARIO */}
          {selectedGameId === "solitaire" && (
            <div className="max-w-md mx-auto space-y-6 text-center">
              <p className="text-xs text-slate-500">
                Pulsación rítmica regulada. Haz clic en las cartas desordenadas siguiendo de forma ascendente el contador (actual: <strong className="text-indigo-650 text-indigo-600 text-sm">Carta {solitaireTargetNum}</strong>). Calma el temblor corporal.
              </p>

              {solitaireState === "idle" && (
                <div className="py-6 bg-slate-50 rounded-xl space-y-3">
                  <p className="text-xs font-medium text-slate-500">Estimulación rítmica propioceptiva.</p>
                  <button
                    onClick={initializeSolitaire}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                  >
                    Repartir Fichas de Solitario
                  </button>
                </div>
              )}

              {solitaireState === "playing" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto">
                    {solitaireList.map((card, idx) => (
                      <button
                        key={idx}
                        disabled={card.matched}
                        onClick={() => handleSolitaireCardClick(card.val, idx)}
                        className={`h-16 rounded-xl border font-bold text-sm transition-all flex flex-col justify-between p-2 cursor-pointer ${
                          card.matched
                            ? "bg-emerald-50 border-emerald-200 text-emerald-400 rotate-3 opacity-60"
                            : "bg-white hover:bg-indigo-50 border-slate-300 text-slate-750 active:scale-95 hover:shadow-xs border-b-4 hover:border-b-2"
                        }`}
                      >
                        <span className="text-[10px] font-mono text-slate-400">NAIPE</span>
                        <span className="text-base font-extrabold">{card.val}</span>
                      </button>
                    ))}
                  </div>

                  <div className="flex justify-between items-center max-w-[240px] mx-auto text-[11px] text-slate-500 font-medium">
                    <span>Número Objetivo: <strong className="text-indigo-600">{solitaireTargetNum <= 6 ? solitaireTargetNum : "Completo"}</strong></span>
                    <span>Toques totales: <strong>{solitaireTicks}</strong></span>
                  </div>
                </div>
              )}

              {solitaireState === "completed" && (
                <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-xl space-y-3">
                  <p className="text-sm font-bold text-emerald-800">¡Ordenamiento solitario terminado!</p>
                  <p className="text-xs text-slate-650">Completaste la secuencia en un ritmo de <strong className="text-sm text-emerald-700 font-mono">{solitaireTicks} clics totales</strong>.</p>
                  
                  <div className="flex gap-2 justify-center pt-2">
                    <button
                      onClick={initializeSolitaire}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                    >
                      Jugar otra vez
                    </button>
                    <button
                      onClick={() => setSelectedGameId(null)}
                      className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Volver menú
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GAME 11: BURBUJAS DE PRECISIÓN MOTORA */}
          {selectedGameId === "bubbles" && (
            <div className="max-w-md mx-auto space-y-4 text-center animate-fade-in">
              <p className="text-xs text-slate-500">
                Calibración de la estabilidad y tiempo de reacción óculo-manual. Revienta las esferas que surgen en el tablero.
              </p>

              {/* Selector de Modo de Control de Juego */}
              <div className="flex justify-center gap-1.5 p-1 bg-slate-100 rounded-xl max-w-[250px] mx-auto text-[11px] font-bold">
                <button
                  onClick={() => setBubblesControlMode("click")}
                  className={`flex-1 py-1.5 px-2 rounded-lg cursor-pointer transition-all ${bubblesControlMode === "click" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-850"}`}
                >
                  Toque de Mouse
                </button>
                <button
                  onClick={() => setBubblesControlMode("wearable")}
                  className={`flex-1 py-1.5 px-2 rounded-lg cursor-pointer transition-all ${bubblesControlMode === "wearable" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-850"}`}
                >
                  Wearable ESP32
                </button>
              </div>

              {bubblesControlMode === "wearable" && bubblesState === "playing" && (
                <div className="flex flex-col gap-1.5 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-[10px] text-slate-600 max-w-sm mx-auto">
                  <div className="flex justify-between items-center text-indigo-950 font-bold">
                    <span className="flex items-center gap-1">🎮 Control por Movimiento</span>
                    <button
                      onClick={calibrateWearableZero}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold text-[9px] cursor-pointer shadow-xs"
                    >
                      Calibrar Centro
                    </button>
                  </div>
                  <p className="text-left text-[9px] text-slate-500 leading-relaxed">
                    Sustenta tu mano con el sensor en reposo cómodo y presiona <strong>Calibrar Centro</strong>. Inclina el dispositivo (o usa las teclas <strong>W, A, S, D</strong> / flechas) para llevar la mira sobre una burbuja y sostenla allí hasta reventarla.
                  </p>
                </div>
              )}

              {bubblesState === "idle" && (
                <div className="py-6 bg-slate-50 rounded-xl space-y-3 border border-slate-100">
                  <p className="text-xs font-medium text-slate-500">Estimulación motriz fina propiomuscular.</p>
                  <button
                    onClick={startBubbles}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg cursor-pointer shadow-xs"
                  >
                    Repartir Burbujas de Precisión
                  </button>
                </div>
              )}

              {bubblesState === "playing" && (
                <div className="space-y-4">
                  {/* The interactive box representing coordinates */}
                  <div 
                    onClick={() => {
                      if (bubblesControlMode === "click") {
                        setBubblesMisses(m => m + 1);
                      }
                    }}
                    className="relative w-full h-[260px] bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden shadow-inner select-none"
                    style={{
                      cursor: bubblesControlMode === "wearable" ? "none" : "crosshair"
                    }}
                  >
                    {/* Grid lines styling to look like a high tech rehabilitation radar */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px]" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(79,70,229,0.06),transparent)]" />

                    <span className="absolute top-2 left-2 text-[9px] font-mono font-bold text-slate-400 select-none bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700 z-10">
                      MODO: {bubblesControlMode === "wearable" ? "Vías Acelerómetro ESP32 / Teclas" : "Puntero Táctil"}
                    </span>

                    {/* Laser Target Reticle for Wearable control mode */}
                    {bubblesControlMode === "wearable" && (
                      <div
                        style={{
                          left: `${bubblesCrosshairPos.x}%`,
                          top: `${bubblesCrosshairPos.y}%`,
                        }}
                        className="absolute w-8 h-8 -ml-4 -mt-4 pointer-events-none z-20 flex items-center justify-center transition-all duration-75"
                      >
                        {/* Circle outer dotted ticker */}
                        <div className="absolute inset-0 border-2 border-dashed border-indigo-500 rounded-full animate-spin [animation-duration:8s]"></div>
                        {/* Dot center center */}
                        <div className="w-1.5 h-1.5 bg-rose-500 rounded-full"></div>
                        {/* Cross hairs line */}
                        <div className="absolute w-4 h-[1px] bg-indigo-500/80"></div>
                        <div className="absolute h-4 w-[1px] bg-indigo-500/80"></div>
                        
                        {/* Active hover calibration pulse */}
                        {bubblesTargetStabilization && (
                          <div className="absolute -inset-2 border-2 border-emerald-500 rounded-full animate-ping"></div>
                        )}
                      </div>
                    )}

                    {/* Pop-able Bubbles inside */}
                    {bubblesList.map((bubble) => !bubble.popped && (
                      <button
                        key={bubble.id}
                        disabled={bubblesControlMode === "wearable"} // click disabled in wearable mode, lock-on only
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBubbleClick(bubble.id);
                        }}
                        style={{
                          left: `${bubble.x}%`,
                          top: `${bubble.y}%`,
                        }}
                        className={`absolute w-12 h-12 -ml-6 -mt-6 rounded-full flex flex-col items-center justify-center text-white font-black text-lg select-none shadow-lg transition-all border-2 border-white/25 active:scale-90 ${bubble.color} ${bubblesControlMode === "click" ? "cursor-pointer animate-pulse" : ""}`}
                      >
                        🎯
                        {/* Progress ring if currently locking on using hands physical tremor */}
                        {bubblesControlMode === "wearable" && bubblesTargetStabilization && bubblesTargetStabilization.bubbleId === bubble.id && (
                          <div className="absolute inset-0 bg-slate-905/70 bg-black/85 rounded-full flex flex-col items-center justify-center text-[9px] font-black pointer-events-none">
                            <span className="text-[7px] text-emerald-400 font-bold uppercase leading-none mb-0.5">Estable</span>
                            <span className="text-emerald-300 font-mono">{bubblesTargetStabilization.progress}%</span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-slate-500 font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span>Progreso: <strong className="text-indigo-600 font-bold">{bubblesPoppedCount} de 5</strong></span>
                    <span>Toques fallidos: <strong className="text-rose-500 font-bold">{bubblesMisses}</strong></span>
                    <span>Transcurrido: <strong className="text-slate-700 font-mono">{((Date.now() - bubblesStartTimestamp) / 1000).toFixed(0)}s</strong></span>
                  </div>
                </div>
              )}

              {bubblesState === "completed" && (
                <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-xl space-y-3">
                  <p className="text-sm font-bold text-emerald-800">¡Burbujas reventadas por completo!</p>
                  <p className="text-xs text-slate-600">Completaste la estimulación con un total de <strong className="text-emerald-700 font-mono">{bubblesMisses} toques fallidos</strong>.</p>
                  
                  <div className="flex gap-2 justify-center pt-2">
                    <button
                      onClick={startBubbles}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                    >
                      Jugar otra vez
                    </button>
                    <button
                      onClick={() => setSelectedGameId(null)}
                      className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Volver menú
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GAME 12: CONEXIÓN DE PUNTOS PROPIOMOTORES */}
          {selectedGameId === "dots" && (
            <div className="max-w-md mx-auto space-y-4 text-center animate-fade-in">
              <p className="text-xs text-slate-500">
                Calibración visual y dactilar rápida. Presiona las esferas numeradas estrictamente en orden ascendente (<strong className="text-indigo-600 font-extrabold">1 ➔ 2 ➔ 3 ➔ 4 ➔ 5</strong>).
              </p>

              {dotsState === "idle" && (
                <div className="py-6 bg-slate-50 rounded-xl space-y-3">
                  <p className="text-xs font-medium text-slate-500 font-sans">Estimulación de velocidad kinésica fina.</p>
                  <button
                    onClick={startDots}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg cursor-pointer shadow-xs"
                  >
                    Repartir Puntos de Precisión
                  </button>
                </div>
              )}

              {dotsState === "playing" && (
                <div className="space-y-4">
                  {/* The interactive box representing coordinates */}
                  <div 
                    onClick={() => setDotsMisses(m => m + 1)}
                    className="relative w-full h-[260px] bg-slate-100 border border-slate-200 rounded-xl overflow-hidden cursor-crosshair shadow-inner"
                  >
                    {/* Connective lines between already clicked dots */}
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
                      {dotsList.map((dot, index) => {
                        if (dot.clicked && index < dotsList.length) {
                          const nextDot = dotsList.find(d => d.label === dot.label + 1);
                          if (nextDot && nextDot.clicked) {
                            return (
                              <line
                                key={`line-${dot.id}`}
                                x1={`${dot.x}`}
                                y1={`${dot.y}`}
                                x2={`${nextDot.x}`}
                                y2={`${nextDot.y}`}
                                stroke="rgb(79, 70, 229)"
                                strokeWidth="1.5"
                                strokeDasharray="2,2"
                              />
                            );
                          }
                        }
                        return null;
                      })}
                    </svg>

                    <span className="absolute top-2 left-2 text-[9px] font-mono font-bold text-slate-400 select-none bg-white/80 px-1.5 py-0.5 rounded border border-slate-100">
                      Trazar del 1 al 5 en orden (Prisa y Pulso)
                    </span>

                    {/* Active next guidance indicator line to the next number from previous clicked */}
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none opacity-50">
                      {(() => {
                        if (dotsNextToClick > 1 && dotsNextToClick <= 5) {
                          const prevDot = dotsList.find(d => d.label === dotsNextToClick - 1);
                          const currentDot = dotsList.find(d => d.label === dotsNextToClick);
                          if (prevDot && currentDot) {
                            return (
                              <line
                                x1={`${prevDot.x}`}
                                y1={`${prevDot.y}`}
                                x2={`${currentDot.x}`}
                                y2={`${currentDot.y}`}
                                stroke="rgb(245, 158, 11)"
                                strokeWidth="1"
                                className="animate-pulse"
                              />
                            );
                          }
                        }
                        return null;
                      })()}
                    </svg>

                    {dotsList.map((dot) => (
                      <button
                        key={dot.id}
                        onClick={(e) => {
                          e.stopPropagation(); // Avoid triggering a miss on coordinate box background
                          handleDotClick(dot.label);
                        }}
                        style={{
                          left: `${dot.x}%`,
                          top: `${dot.y}%`,
                        }}
                        className={`absolute w-12 h-12 -ml-6 -mt-6 rounded-full flex flex-col items-center justify-center text-white font-black text-sm select-none shadow-md cursor-pointer transition-all active:scale-90 ${
                          dot.clicked 
                            ? "bg-slate-300 pointer-events-none border border-slate-400" 
                            : dot.label === dotsNextToClick
                              ? `${dot.color} scale-110 ring-4 ring-indigo-300 animate-pulse`
                              : `${dot.color} opacity-85`
                        }`}
                      >
                        <span>{dot.label}</span>
                        {dot.clicked && <span className="text-[8px] leading-none">✓</span>}
                      </button>
                    ))}
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-slate-500 font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span>Siguiente número: <strong className="text-indigo-600 font-extrabold">{dotsNextToClick <= 5 ? dotsNextToClick : "¡Hecho!"}</strong></span>
                    <span>Toques fallidos: <strong className="text-rose-500 font-bold">{dotsMisses}</strong></span>
                    <span>Transcurrido: <strong className="text-slate-700 font-mono">{((Date.now() - dotsStartTimestamp) / 1000).toFixed(0)}s</strong></span>
                  </div>
                </div>
              )}

              {dotsState === "completed" && (
                <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-xl space-y-3">
                  <p className="text-sm font-bold text-emerald-800">¡Conexión completada exitosamente!</p>
                  <p className="text-xs text-slate-600">Completaste las micro-trayectorias con <strong className="text-emerald-700 font-mono">{dotsMisses} errores de orden</strong>.</p>
                  
                  <div className="flex gap-2 justify-center pt-2">
                    <button
                      onClick={startDots}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                    >
                      Jugar otra vez
                    </button>
                    <button
                      onClick={() => setSelectedGameId(null)}
                      className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Volver menú
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GAME 13: LABERINTO DE ESTABILIDAD TÁCTIL */}
          {selectedGameId === "maze" && (
            <div className="max-w-md mx-auto space-y-4 text-center animate-fade-in">
              <p className="text-xs text-slate-500">
                Resistencia de pulso táctil. Lleva la trayectoria del <strong className="text-indigo-600 font-extrabold">Inicio al Fin</strong> siguiendo el canal sombreado gris sin salirte al vacío.
              </p>

              {/* Selector de Modo de Control de Juego */}
              <div className="flex justify-center gap-1.5 p-1 bg-slate-100 rounded-xl max-w-[250px] mx-auto text-[11px] font-bold">
                <button
                  onClick={() => setMazeControlMode("click")}
                  className={`flex-1 py-1.5 px-2 rounded-lg cursor-pointer transition-all ${mazeControlMode === "click" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-850"}`}
                >
                  Toque de Mouse
                </button>
                <button
                  onClick={() => setMazeControlMode("wearable")}
                  className={`flex-1 py-1.5 px-2 rounded-lg cursor-pointer transition-all ${mazeControlMode === "wearable" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-850"}`}
                >
                  Wearable ESP32
                </button>
              </div>

              {mazeControlMode === "wearable" && mazeState === "playing" && (
                <div className="flex flex-col gap-1.5 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-[10px] text-slate-600 max-w-sm mx-auto">
                  <div className="flex justify-between items-center text-indigo-950 font-bold">
                    <span className="flex items-center gap-1">🎮 Control por Movimiento</span>
                    <button
                      onClick={calibrateWearableZero}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold text-[9px] cursor-pointer shadow-xs"
                    >
                      Calibrar Centro
                    </button>
                  </div>
                  <p className="text-left text-[9px] text-slate-500 leading-relaxed">
                    Sustenta tu mano con el sensor en reposo cómodo y presiona <strong>Calibrar Centro</strong>. Inclina el dispositivo (o usa las teclas <strong>W, A, S, D</strong> / flechas) para deslizar la bolita por el canal gris hasta los hitos.
                  </p>
                </div>
              )}

              {mazeState === "idle" && (
                <div className="py-6 bg-slate-50 rounded-xl space-y-3 border border-slate-100">
                  <p className="text-xs font-medium text-slate-500 font-sans">Estimulación de velocidad kinésica de precisión.</p>
                  <button
                    onClick={startMaze}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg cursor-pointer shadow-xs"
                  >
                    Iniciar Laberinto de Senda
                  </button>
                </div>
              )}

              {mazeState === "playing" && (
                <div className="space-y-4">
                  {/* The interactive box representing coordinates */}
                  <div 
                    onClick={() => {
                      if (mazeControlMode === "click") {
                        setMazeMisses(m => m + 1);
                      }
                    }}
                    className="relative w-full h-[260px] bg-slate-105 bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden shadow-inner select-none"
                    style={{
                      cursor: mazeControlMode === "wearable" ? "none" : "crosshair"
                    }}
                  >
                    {/* Grid lines styling to look like a high tech rehabilitation radar */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px]" />

                    {/* Responsive corridor pathway using 0-100 grid inside SVG */}
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
                      {/* Grey track */}
                      <polyline
                        points={mazePoints.map(p => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.08)"
                        strokeWidth="11"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* Subdued inner corridor guides */}
                      <polyline
                        points={mazePoints.map(p => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke="rgba(99, 102, 241, 0.15)"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* Cleared track (indigo highlighter) */}
                      {mazeCheckpointIndex > 0 && (
                        <polyline
                          points={mazePoints.slice(0, mazeCheckpointIndex + 1).map((p, i) => i <= mazeCheckpointIndex ? `${p.x},${p.y}` : "").join(' ')}
                          fill="none"
                          stroke="rgb(129, 140, 248)"
                          strokeWidth="3.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                    </svg>

                    <span className="absolute top-2 left-2 text-[9px] font-mono font-bold text-slate-400 select-none bg-slate-805/80 bg-slate-800 px-2 py-0.5 rounded border border-slate-700 z-10 animate-pulse">
                      Senda: Evita desvíos del canal
                    </span>

                    {/* Dynamic Rolling Ball for ESP32 Wearable control mode */}
                    {mazeControlMode === "wearable" && (
                      <div
                        style={{
                          left: `${mazeBallPos.x}%`,
                          top: `${mazeBallPos.y}%`,
                        }}
                        className="absolute w-5 h-5 -ml-2.5 -mt-2.5 bg-indigo-500 border-2 border-white rounded-full shadow-lg z-25 pointer-events-none transition-all duration-75 flex items-center justify-center animate-pulse"
                      >
                        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                      </div>
                    )}

                    {mazePoints.map((point, index) => {
                      const isActive = index === mazeCheckpointIndex;
                      const isCleared = index < mazeCheckpointIndex;
                      return (
                        <button
                          key={index}
                          disabled={mazeControlMode === "wearable"} // lock-on tracking only, click disabled
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMazeCheckpointClick(index);
                          }}
                          style={{
                            left: `${point.x}%`,
                            top: `${point.y}%`,
                          }}
                          className={`absolute w-10 h-10 -ml-5 -mt-5 rounded-full flex flex-col items-center justify-center text-[10px] font-black select-none shadow-md transition-all ${
                            isCleared
                              ? "bg-indigo-600 text-indigo-100 border border-indigo-500 pointer-events-none scale-90"
                              : isActive
                                ? "bg-amber-500 text-white animate-pulse ring-4 ring-amber-300 scale-110 z-10"
                                : "bg-slate-800 text-slate-500 pointer-events-none opacity-40"
                          }`}
                        >
                          <span>{isCleared ? "✓" : point.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-slate-500 font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span>Hito actual: <strong className="text-indigo-600 font-extrabold">{mazeCheckpointIndex < mazePoints.length ? mazePoints[mazeCheckpointIndex].label : "¡Meta!"}</strong></span>
                    <span>Desvíos de pulso / colisión: <strong className="text-rose-500 font-bold">{mazeMisses}</strong></span>
                    <span>Transcurrido: <strong className="text-slate-700 font-mono">{((Date.now() - mazeStartTimestamp) / 1000).toFixed(0)}s</strong></span>
                  </div>
                </div>
              )}

              {mazeState === "completed" && (
                <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-xl space-y-3">
                  <p className="text-sm font-bold text-emerald-800">¡Senda de estabilidad completada!</p>
                  <p className="text-xs text-slate-600">Completaste la calibración con un total de <strong className="text-emerald-700 font-mono">{mazeMisses} desvíos táctiles</strong> sobre el fondo.</p>
                  
                  <div className="flex gap-2 justify-center pt-2">
                    <button
                      onClick={startMaze}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                    >
                      Jugar otra vez
                    </button>
                    <button
                      onClick={() => setSelectedGameId(null)}
                      className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Volver menú
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GAME 14: VOCALIZACIÓN RÍTMICA */}
          {selectedGameId === "phonetics" && (
            <div className="max-w-md mx-auto space-y-4 text-center animate-fade-in">
              <p className="text-xs text-slate-500">
                Pauta de Vocalización Rítmica. Di en voz alta cada sílaba e inténtalo marcar rítmicamente. Silabación objetivo: <strong className="text-indigo-600 font-extrabold">PA ➔ TA ➔ KA ➔ PA ➔ TA ➔ KA</strong>.
              </p>

              {phoneticsState === "idle" && (
                <div className="py-6 bg-slate-50 rounded-xl space-y-3">
                  <p className="text-xs font-medium text-slate-500 font-sans">Estimulación de velocidad e intensidad fonoaudiológica.</p>
                  <button
                    onClick={launchPhonetics}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg cursor-pointer shadow-xs"
                  >
                    Iniciar Actividad Rítmica de Voz
                  </button>
                </div>
              )}

              {phoneticsState === "playing" && (
                <div className="space-y-6">
                  {/* Visual beat track */}
                  <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl flex justify-center items-center gap-3">
                    {phoneticsPatterns.map((pat, idx) => {
                      const isActive = idx === phoneticsActiveBeat;
                      const isCleared = idx < phoneticsActiveBeat;
                      return (
                        <div
                          key={idx}
                          className={`w-12 h-12 rounded-xl flex flex-col justify-center items-center transition-all ${
                            isActive
                              ? "bg-amber-500 border-2 border-amber-600 text-white font-extrabold scale-110 shadow-md animate-pulse"
                              : isCleared
                                ? "bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold opacity-60"
                                : "bg-white border border-slate-200 text-slate-400"
                          }`}
                        >
                          <span className="text-xs font-black">{pat}</span>
                          <span className="text-[8px] leading-tight font-mono">{idx + 1}</span>
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-xs text-slate-500">
                    Vocaliza bien fuerte y presiona el botón de la sílaba dorada activa:
                  </p>

                  <div className="grid grid-cols-3 gap-3">
                    {["PA", "TA", "KA"].map((syllable) => {
                      const currentExpected = phoneticsPatterns[phoneticsActiveBeat];
                      const isTarget = syllable === currentExpected;
                      return (
                        <button
                          key={syllable}
                          onClick={() => handlePhoneticSyllableClick(syllable)}
                          className={`py-3.5 rounded-xl text-base font-black border transition-all cursor-pointer ${
                            isTarget
                              ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-md animate-pulse scale-105"
                              : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200 active:bg-slate-100"
                          }`}
                        >
                          {syllable}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-slate-500 font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-2">
                    <span>Aciertos: <strong className="text-emerald-600 font-black">{phoneticsHits}</strong></span>
                    <span>Desvíos: <strong className="text-rose-500 font-bold">{phoneticsMisses}</strong></span>
                    <span>Fase: <strong className="text-slate-700 font-mono">{phoneticsActiveBeat + 1} / 6</strong></span>
                  </div>
                </div>
              )}

              {phoneticsState === "completed" && (
                <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-xl space-y-3">
                  <p className="text-sm font-bold text-emerald-800">¡Sincronización de sílabas finalizada!</p>
                  <p className="text-xs text-slate-650">
                    Has completado la calibración prosódica orofacial con <strong className="text-emerald-700 font-bold">{phoneticsHits} aciertos</strong> del metrónomo.
                  </p>
                  
                  <div className="flex gap-2 justify-center pt-2">
                    <button
                      onClick={launchPhonetics}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg cursor-pointer animate-fade-in"
                    >
                      Jugar otra vez
                    </button>
                    <button
                      onClick={() => setSelectedGameId(null)}
                      className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Volver menú
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GAME 15: GIMNASIA LINGUAL */}
          {selectedGameId === "lingual" && (
            <div className="max-w-md mx-auto space-y-4 text-center animate-fade-in">
              <p className="text-xs text-slate-500">
                Calibración de tono lingual y deglución. Realiza los ejercicios que se detallan a continuación y sostén la fuerza contra la rigidez protectora facial.
              </p>

              <div className="p-6 bg-slate-50 border border-slate-150 rounded-2xl space-y-4">
                <span className="inline-block p-1 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-md uppercase">
                  Región lingual: {lingualPrompts[lingualIdx].area}
                </span>

                <h3 className="text-base font-extrabold text-slate-800 leading-snug">
                  "{lingualPrompts[lingualIdx].task}"
                </h3>

                {lingualState === "idle" && (
                  <button
                    onClick={launchLingualTimer}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                  >
                    ¡Comenzar Retención de {lingualPrompts[lingualIdx].time} Segundos!
                  </button>
                )}

                {lingualState === "holding" && (
                  <div className="space-y-3">
                    <div className="w-16 h-16 rounded-full border-4 border-amber-500 flex items-center justify-center mx-auto text-xl font-bold font-mono text-amber-700 animate-pulse bg-amber-50">
                      {lingualTimer}s
                    </div>
                    <p className="text-xs font-semibold text-amber-800">¡Sostén la tensión orofaríngea sin aflojar!</p>
                  </div>
                )}

                {lingualState === "rating" && (
                  <div className="space-y-4">
                    <p className="text-xs font-bold text-slate-700">¿Cómo estimas el nivel de fuerza lingual que ejerciste?</p>
                    
                    <div className="flex justify-center gap-2">
                      {[1, 2, 3, 4, 5].map((stars) => (
                        <button
                          key={stars}
                          onClick={() => setLingualSelfScore(stars)}
                          className={`text-2xl transition-all cursor-pointer ${
                            stars <= lingualSelfScore ? "text-amber-400 font-bold" : "text-slate-300"
                          }`}
                        >
                          ★
                        </button>
                      ))}
                    </div>

                    <p className="text-[10px] text-slate-400">1: Baja tonicación / 5: Excelente presión gloseal superior</p>

                    <button
                      onClick={submitLingualRating}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                    >
                      Confirmar Ejercitación Lingual
                    </button>
                  </div>
                )}

                {lingualState === "done" && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl space-y-2">
                    <p className="text-[11px] font-bold text-emerald-800">¡Retención registrada con éxito!</p>
                    <p className="text-[10px] text-slate-600">Ayuda a conservar el tono mandibular y prevenir atascamiento fónico.</p>
                    
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={nextLingual}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg cursor-pointer"
                      >
                        Siguiente Actividad
                      </button>
                      <button
                        onClick={() => setSelectedGameId(null)}
                        className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-semibold rounded-lg cursor-pointer"
                      >
                        Volver menú
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-[10px] text-slate-400">
            <span>Guía Lonestar Neurology para Parkinson</span>
            <span>Sistema Inteligente de Evaluación Clínica</span>
          </div>
        </div>
      )}

    </div>
  );
}
