import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  // Se algum erro acontecer em qualquer componente filho, este método é chamado
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  // Apanha a informação detalhada do erro para log
  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    // Aqui poderias enviar o erro para um serviço de logs (Sentry, etc.)
    console.error("ERRO APANHADO NO VULPE MART:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // O que mostrar quando ocorre um erro crítico
      return (
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6 font-sans">
          <div className="bg-white p-8 rounded-xl shadow-lg border border-red-200 max-w-lg w-full text-center">
            
            <div className="bg-red-50 text-red-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={40} />
            </div>
            
            <h1 className="text-2xl font-bold text-zinc-900 mb-2">
              Ups! Ocorreu um problema.
            </h1>
            
            <p className="text-zinc-600 mb-8">
              O sistema encontrou um erro inesperado. Não te preocupes, os teus dados na base de dados estão seguros.
            </p>

            {/* Mostrar apenas detalhes do erro se estiveres em desenvolvimento (opcional) */}
            <details className="text-left bg-zinc-50 p-4 rounded-lg border border-zinc-200 mb-8 text-xs text-zinc-500 overflow-auto max-h-32">
              <summary className="font-bold cursor-pointer text-zinc-700">Ver detalhes do erro</summary>
              <pre className="mt-2">{this.state.error && this.state.error.toString()}</pre>
            </details>

            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 transition-all text-lg shadow-sm"
            >
              <RefreshCw size={20} />
              Recarregar o Sistema
            </button>
            
          </div>
        </div>
      );
    }

    // Se não houver erro, renderiza a aplicação normalmente
    return this.props.children; 
  }
}