import Header from '../components/layout/Header';
import { Map } from 'lucide-react';

export default function MapaInteractivo() {
  return (
    <div className="min-h-screen">
      <Header title="Mapa Interactivo" subtitle="Visualización geográfica por departamento del Perú" />

      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="flex flex-col items-center text-center gap-3 py-16">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Map className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Mapa Interactivo — Fase 3</h3>
            <p className="text-sm text-gray-500 max-w-xl">
              Visualización coropleta de superficie agrícola y oportunidades comerciales por departamento del Perú.
              Se activará cuando se instalen las dependencias de Leaflet y se integren los datos de SIEA superficie agrícola.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
