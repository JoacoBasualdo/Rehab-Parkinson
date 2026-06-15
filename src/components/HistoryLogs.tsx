/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SessionLog } from "../types";
import { Download, Calendar, Trash2, Award, ClipboardList, Shield, FileText, Check } from "lucide-react";

interface HistoryLogsProps {
  logs: SessionLog[];
  onClearHistory: () => void;
  onDeleteLog: (id: string) => void;
}

export default function HistoryLogs({ logs, onClearHistory, onDeleteLog }: HistoryLogsProps) {
  // Aggregate stats
  const totalSessions = logs.length;
  const voiceSess = logs.filter((l) => l.exerciseType === "Voz");
  const motorSess = logs.filter((l) => l.exerciseType.includes("Motricidad"));

  const avgVocalStability =
    voiceSess.length > 0
      ? Math.round(voiceSess.reduce((acc, current) => acc + (current.metrics.stability || 0), 0) / voiceSess.length)
      : 0;

  const avgMotorScore =
    motorSess.length > 0
      ? Math.round(motorSess.reduce((acc, current) => acc + current.metrics.score, 0) / motorSess.length)
      : 0;

  // Simple CSV export simulation
  const handleExportCSV = () => {
    if (logs.length === 0) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID,Fecha,Tipo Ejercicio,Duracion (seg),Score (%),Estabilidad (%),Temblor Promedio (Hz),Notas\n";

    logs.forEach((log) => {
      const csvRow = `${log.id},${log.timestamp},${log.exerciseType},${log.duration},${log.metrics.score},${log.metrics.stability || ""},${log.metrics.averageTremor || ""},"${log.notes || ""}"`;
      csvContent += csvRow + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reporte_rehabilitacion_parkinson_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };



  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs" id="history-panel">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <ClipboardList className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Historial Terapéutico Diario</h3>
            <p className="text-xs text-slate-500 mt-0.5">Reportes clínicos consolidados de motricidad y fonación.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {logs.length > 0 && (
            <>
              <button
                onClick={handleExportCSV}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar Reporte (CSV)</span>
              </button>
              <button
                onClick={onClearHistory}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-red-600 text-xs font-semibold rounded-lg transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Borrar todo</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Aggregate Stats Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
          <p className="text-xs text-slate-500 font-medium">Sesiones Completadas</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-slate-800">{totalSessions}</span>
            <span className="text-[10px] text-slate-500 uppercase font-bold">hoy</span>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
          <p className="text-xs text-slate-500 font-medium">Estabilidad Voces (Promedio)</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-rose-600">{avgVocalStability}%</span>
            <span className="text-[10px] text-slate-500 uppercase font-bold">estabilidad</span>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
          <p className="text-xs text-slate-500 font-medium font-sans">Precisión Motriz (Promedio)</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-indigo-600">{avgMotorScore}%</span>
            <span className="text-[10px] text-slate-500 uppercase font-bold">coordinación</span>
          </div>
        </div>

        <div className="bg-indigo-50/40 p-4 rounded-xl border border-indigo-100 flex flex-col justify-between">
          <span className="text-xs text-indigo-800 font-bold flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-indigo-600" /> Diagnóstico Parkinson
          </span>
          <p className="text-[11px] text-slate-600 leading-tight mt-1">
            Rehabilitación personalizada de motricidad y volumen fónico para tele-asistencia médica.
          </p>
        </div>
      </div>



      {/* Log list table */}
      <div className="overflow-x-auto">
        {logs.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
            <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-600 mt-2">No hay registros de sesiones hoy</p>
            <p className="text-xs text-slate-400 mt-1">Realiza algún ejercicio interactivo arriba para recolectar datos biomédicos.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-medium">
                <th className="py-2 px-3">Hora</th>
                <th className="py-2 px-3">Ejercicio</th>
                <th className="py-2 px-3">Duración</th>
                <th className="py-2 px-3">Precisión / Estabilidad</th>
                <th className="py-2 px-3">Temblor Wearable</th>
                <th className="py-2 px-3">Notas clínicas</th>
                <th className="py-2 px-3 text-center"></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-3 font-mono text-slate-500">{log.timestamp}</td>
                  <td className="py-3 px-3 font-semibold text-slate-700">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full mr-2 ${log.exerciseType === "Voz" ? "bg-rose-500" : "bg-indigo-500"}`}></span>
                    {log.exerciseType}
                  </td>
                  <td className="py-3 px-3 text-slate-600">{log.duration} segundos</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{log.metrics.score}%</span>
                      <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${log.exerciseType === "Voz" ? "bg-rose-500" : "bg-indigo-500"}`} 
                          style={{ width: `${log.metrics.score}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-mono text-slate-500">
                      {log.metrics.averageTremor ? `${log.metrics.averageTremor} Hz` : "Inactivo"}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-500 max-w-xs truncate">{log.notes || "-"}</td>
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => onDeleteLog(log.id)}
                      className="text-slate-400 hover:text-red-500 p-1 rounded-md transition-colors cursor-pointer"
                      title="Eliminar registro"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
