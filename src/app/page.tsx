"use client";

import React, { useState, useEffect, useRef } from 'react';
// Importamos las librerías directamente
import * as tf from '@tensorflow/tfjs';
import * as tmImage from '@teachablemachine/image';

// --- MENSAJES DE RECICLAJE (CORREGIDO) ---
// Las llaves (keys) ahora coinciden EXACTAMENTE con el metadata.json
const infoReciclaje: { [key: string]: string } = {
  'PLÁSTICO': 'Las botellas y envases de plástico van al contenedor amarillo. ¡Recuerda aplastarlos para ahorrar espacio!',
  'METAL': 'Las latas de metal (refrescos, conservas) también van al contenedor amarillo junto con los envases de plástico.',
  'TETRA PAK': 'Los envases de Tetra Pak (leche, jugos) también van al contenedor amarillo. Asegúrate de aplastarlos.',
  'default': 'Material no reconocido. Consulta el punto limpio más cercano para asegurar un reciclaje adecuado.'
};

/**
 * @component App
 * @description Componente principal para identificación de materiales.
 */
export default function App() {
  // --- STATE ---
  const [isLoading, setIsLoading] = useState(true);
  const [prediction, setPrediction] = useState<string>('Identificando...');
  const [confidence, setConfidence] = useState<number>(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [confirmedMaterial, setConfirmedMaterial] = useState<string | null>(null);

  // --- REFS ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const modelRef = useRef<any>(null);
  const confirmationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stablePredictionRef = useRef<string | null>(null);

  // --- CONSTANTS ---
  const MODEL_URL = 'https://teachablemachine.withgoogle.com/models/dZamnarmp/';
  const MODEL_FILE = MODEL_URL + 'model.json';
  const METADATA_FILE = MODEL_URL + 'metadata.json';
  
  // --- LÓGICA DE CONFIRMACIÓN (NUEVO useEffect) ---
  useEffect(() => {
    if (confirmedMaterial || isLoading) return;
    const UMBRAL_CONFIANZA = 90;
    const TIEMPO_CONFIRMACION = 5000;

    const clearTimer = () => {
      if (confirmationTimerRef.current) {
        clearTimeout(confirmationTimerRef.current);
        confirmationTimerRef.current = null;
      }
    };

    if (confidence < UMBRAL_CONFIANZA || prediction === 'Identificando...') {
      clearTimer();
      stablePredictionRef.current = null;
      return;
    }

    if (prediction !== stablePredictionRef.current) {
      clearTimer();
      stablePredictionRef.current = prediction;
      confirmationTimerRef.current = setTimeout(() => {
        console.log(`¡Material confirmado: ${prediction}!`);
        setConfirmedMaterial(prediction); // ¡CONFIRMADO!
      }, TIEMPO_CONFIRMACION);
    }
  }, [prediction, confidence, confirmedMaterial, isLoading]);

  // --- INICIALIZACIÓN Y REINICIO (useEffect MODIFICADO) ---
  useEffect(() => {
    if (confirmedMaterial) {
      if (videoRef.current && videoRef.current.srcObject) {
        console.log("Deteniendo cámara.");
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      return;
    }

    console.log("Inicializando app...");

    async function initializeApp() {
      setIsLoading(true);
      setCameraError(null);
      setPrediction('Identificando...');
      setConfidence(0);

      try {
        if (!tmImage) {
          throw new Error('Librería Teachable Machine no cargada.');
        }
        
        console.log("Iniciando carga de modelo y cámara en paralelo...");
        const modelPromise = tmImage.load(MODEL_FILE, METADATA_FILE);
        const cameraPromise = setupWebcam();
        const [model, _] = await Promise.all([modelPromise, cameraPromise]);
        
        modelRef.current = model;
        console.log("Modelo cargado y cámara lista.");
        requestAnimationFrame(predictionLoop);

      } catch (error) {
        console.error('Initialization error:', error);
        if ((error as Error).name === 'NotAllowedError' || (error as Error).name === 'NotFoundError' || (error as Error).name === 'OverconstrainedError') {
          setCameraError('Acceso a la cámara denegado o no se encontró. Por favor, otorga permiso y refresca.');
        } else {
          setCameraError('Fallo al inicializar la cámara o el modelo.');
        }
        setPrediction('Error');
      } finally {
        setIsLoading(false);
      }
    }

    initializeApp();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      if (confirmationTimerRef.current) {
        clearTimeout(confirmationTimerRef.current);
      }
    };
  }, [confirmedMaterial]);

  // --- CORE FUNCTIONS ---
  const setupWebcam = async () => {
    if (!videoRef.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false
    });
    videoRef.current.srcObject = stream;
    await new Promise((resolve) => {
      if (videoRef.current) {
        videoRef.current.onloadedmetadata = () => {
          resolve(true);
        };
      }
    });
  };

  const predictionLoop = async () => {
    if (!modelRef.current || confirmedMaterial) return;
    if (videoRef.current && videoRef.current.readyState >= 3) {
      const prediction: any[] = await modelRef.current.predict(videoRef.current);
      let bestPrediction = prediction[0];
      for (let i = 1; i < prediction.length; i++) {
        if (prediction[i].probability > bestPrediction.probability) {
          bestPrediction = prediction[i];
        }
      }
      setPrediction(bestPrediction.className);
      setConfidence(bestPrediction.probability * 100);
    }
    if (!confirmedMaterial) {
      requestAnimationFrame(predictionLoop);
    }
  };

  const handleReset = () => {
    setConfirmedMaterial(null);
  };

  // --- RENDER ---
  return (
    // Contenedor principal modificado para apilar tarjetas verticalmente
    <div className="flex flex-col items-center justify-start min-h-screen w-full bg-gray-900 text-white p-4 py-10 font-sans">

      {/* --- ¡NUEVA TARJETA DE INFORMACIÓN! --- */}
      <div className="w-full max-w-lg bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 md:p-8 border border-white/20">
        <h1 className="text-3xl font-bold text-center text-blue-300 mb-4">
          CLASIFICA+
        </h1>
        
        <div className="mb-4">
          <h2 className="text-xl font-semibold mb-2">Propósito</h2>
          <p className="text-gray-300 text-sm">
            Las empresas necesitan clasificar sus residuos para cumplir con regulaciones, optimizar sus procesos de reciclaje y reducir su impacto ambiental.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">¿Cómo funciona?</h2>
          <ul className="list-disc list-inside text-gray-300 text-sm space-y-1">
            <li>Apunta la cámara al material que deseas identificar.</li>
            <li>Mantén el objeto estable por 5 segundos.</li>
            <li>Recibe la clasificación y la información de reciclaje.</li>
          </ul>
        </div>
      </div>

      {/* --- TARJETA DEL ESCÁNER (la que ya teníamos) --- */}
      {/* Añadimos un margen superior (mt-8) para separarla */}
      <div className="w-full max-w-lg bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 md:p-8 border border-white/20 mt-8">
        
        {!confirmedMaterial ? (
          // --- VISTA 1: CÁMARA ---
          <>
            <h1 className="text-3xl font-bold text-center mb-2">
              Identificador de Materiales
            </h1>
            <p className="text-center text-gray-300 mb-6">
              Apunta tu cámara a un objeto por 5 segundos.
            </p>

            <div className="relative w-full aspect-video bg-gray-950 rounded-xl overflow-hidden shadow-lg border border-white/10">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
              />
              
              {(isLoading || cameraError) && (
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  {isLoading && (
                    <div className="flex flex-col items-center">
                      <svg className="animate-spin h-10 w-10 text-white mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-lg font-medium">Cargando Modelo...</span>
                    </div>
                  )}
                  {cameraError && !isLoading && (
                    <div className="text-center text-red-300">
                      <p className="font-semibold text-lg">Error de Cámara</p>
                      <p className="text-sm">{cameraError}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="mt-6 text-center">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                Predicción
              </h2>
              <p className="text-4xl font-bold my-1">
                {prediction}
              </p>
              <p className="text-lg text-gray-300">
                Confianza: {confidence.toFixed(1)}%
              </p>
              
              <div className="w-full bg-gray-700 rounded-full h-2.5 mt-4 overflow-hidden">
                <div 
                  className="bg-blue-500 h-2.5 rounded-full transition-all duration-300 ease-out" 
                  style={{ width: `${confidence}%` }}
                ></div>
              </div>
            </div>
          </>

        ) : (
          // --- VISTA 2: RESULTADO CONFIRMADO ---
          <>
            <h1 className="text-3xl font-bold text-center mb-2">
              ¡Material Confirmado!
            </h1>
            <p className="text-5xl font-extrabold text-center my-4 text-blue-300">
              {confirmedMaterial}
            </p>
            
            <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
              <h2 className="text-lg font-semibold text-white mb-2">
                Cómo reciclar:
              </h2>
              <p className="text-gray-300">
                {infoReciclaje[confirmedMaterial] || infoReciclaje['default']}
              </p>
            </div>

            <button
              onClick={handleReset}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg mt-6 transition-colors duration-200"
            >
              Escanear Otro Material
            </button>
          </>
        )}
        
      </div>
    </div>
  );
}