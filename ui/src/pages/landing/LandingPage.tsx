import React from 'react';
import { Database, Shield, Smartphone, Monitor, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-slate-900/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Database className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-white">Atlas</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">Fonctionnalités</a>
            <a href="#stats" className="hover:text-white transition-colors">Données</a>
            <a href="#pricing" className="hover:text-white transition-colors">Tarifs</a>
          </nav>
          <div className="flex items-center gap-4">
            <a href="/login.html" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
              Connexion
            </a>
            <Button onClick={() => window.location.href='/login.html'} className="bg-blue-600 hover:bg-blue-500 text-white rounded-full px-6">
              Accéder au Portail
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Atlas Pro v1.0.2 disponible
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70">
            L'Intelligence Géotechnique <br />
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Centralisée</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Plateforme complète pour la collecte, l'analyse et l'exploitation des données de sols. De l'application terrain à l'interface institutionnelle.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={() => window.location.href='/login.html'} className="h-12 px-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-base font-medium shadow-lg shadow-blue-500/25 w-full sm:w-auto">
              Accéder au Portail <ChevronRight className="ml-2 w-4 h-4" />
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 rounded-full border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-slate-200 text-base font-medium w-full sm:w-auto">
              Télécharger l'app Desktop
            </Button>
          </div>
        </div>
      </section>

      {/* Chiffres clés */}
      <section id="stats" className="py-20 border-y border-white/5 bg-slate-800/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-white mb-2">1,2k+</div>
              <div className="text-slate-400 text-sm font-medium uppercase tracking-wider">Sondages BDD</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-white mb-2">4,5k+</div>
              <div className="text-slate-400 text-sm font-medium uppercase tracking-wider">Essais Labo</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-white mb-2">2x2km</div>
              <div className="text-slate-400 text-sm font-medium uppercase tracking-wider">Résolution Maille</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-white mb-2">99.9%</div>
              <div className="text-slate-400 text-sm font-medium uppercase tracking-wider">Uptime API</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Un écosystème complet</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Une suite d'outils interconnectés pour chaque acteur du projet, du technicien sur site au décideur institutionnel.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl bg-slate-800/50 border border-slate-700 hover:border-blue-500/50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-6">
                <Database className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">API Geo REST</h3>
              <p className="text-slate-400 leading-relaxed">Service backend haute-performance en Rust/Axum. Interpolation IDW, géocodage spatial, et endpoints d'import/export de masse.</p>
            </div>
            
            <div className="p-8 rounded-3xl bg-slate-800/50 border border-slate-700 hover:border-indigo-500/50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-6">
                <Monitor className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Atlas Desktop (MSI)</h3>
              <p className="text-slate-400 leading-relaxed">Application locale Tauri 2.0. Base de données embarquée, mode offline complet, et calculs géospatiaux fluides sans latence.</p>
            </div>
            
            <div className="p-8 rounded-3xl bg-slate-800/50 border border-slate-700 hover:border-pink-500/50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center mb-6">
                <Smartphone className="w-6 h-6 text-pink-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Colab Mobile (PWA)</h3>
              <p className="text-slate-400 leading-relaxed">Interface technicien optimisée pour le terrain. Cache local ServiceWorker, synchro bidirectionnelle, UI tactile.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6 bg-slate-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-sm font-medium mb-4">
              <Shield className="w-4 h-4 text-emerald-400" /> Sécurité RBAC
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Plans Flexibles</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Choisissez le niveau d'accès qui correspond à vos besoins de consultation et de contribution.</p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {/* Free */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col">
              <h3 className="text-lg font-medium text-white mb-2">Accès Libre</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-3xl font-bold text-white">0FCFA</span>
              </div>
              <p className="text-sm text-slate-400 mb-6">Pour une consultation occasionnelle des données publiques de synthèse.</p>
              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex items-start gap-3 text-sm text-slate-300"><Check className="w-4 h-4 text-emerald-500 mt-0.5" /> Consultation carte 28km</li>
                <li className="flex items-start gap-3 text-sm text-slate-300"><Check className="w-4 h-4 text-emerald-500 mt-0.5" /> Indices moyens</li>
              </ul>
              <Button variant="outline" className="w-full rounded-xl border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">Créer un compte</Button>
            </div>

            {/* Academic */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col">
              <h3 className="text-lg font-medium text-white mb-2">Étudiant / Académie</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-3xl font-bold text-white">Gratuit</span>
              </div>
              <p className="text-sm text-slate-400 mb-6">Réservé aux laboratoires universitaires et étudiants certifiés.</p>
              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex items-start gap-3 text-sm text-slate-300"><Check className="w-4 h-4 text-emerald-500 mt-0.5" /> Accès Colab Mobile</li>
                <li className="flex items-start gap-3 text-sm text-slate-300"><Check className="w-4 h-4 text-emerald-500 mt-0.5" /> Saisie terrain</li>
                <li className="flex items-start gap-3 text-sm text-slate-300"><Check className="w-4 h-4 text-emerald-500 mt-0.5" /> Accès API Brut (lecture)</li>
              </ul>
              <Button variant="outline" className="w-full rounded-xl border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">Demande via Université</Button>
            </div>

            {/* Pro */}
            <div className="p-6 rounded-3xl bg-slate-800 border border-blue-500/30 relative flex flex-col shadow-2xl shadow-blue-900/20">
              <div className="absolute top-0 right-6 -translate-y-1/2 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">Populaire</div>
              <h3 className="text-lg font-medium text-white mb-2">Ingénieur Pro</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-3xl font-bold text-white">Abonnement</span>
              </div>
              <p className="text-sm text-blue-200 mb-6">Pour les BET géotechniques et ingénieurs praticiens.</p>
              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex items-start gap-3 text-sm text-slate-200"><Check className="w-4 h-4 text-blue-400 mt-0.5" /> Application Desktop App</li>
                <li className="flex items-start gap-3 text-sm text-slate-200"><Check className="w-4 h-4 text-blue-400 mt-0.5" /> Grille haute-résolution 2km</li>
                <li className="flex items-start gap-3 text-sm text-slate-200"><Check className="w-4 h-4 text-blue-400 mt-0.5" /> Export PDF complet</li>
                <li className="flex items-start gap-3 text-sm text-slate-200"><Check className="w-4 h-4 text-blue-400 mt-0.5" /> Accès au détail des sondages</li>
              </ul>
              <Button className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 text-white">Souscrire Pro</Button>
            </div>

            {/* Enterprise */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col">
              <h3 className="text-lg font-medium text-white mb-2">Institutionnel</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-3xl font-bold text-white">Sur Mesure</span>
              </div>
              <p className="text-sm text-slate-400 mb-6">Pour le Ministère et les institutions de tutelle avec droits avancés.</p>
              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex items-start gap-3 text-sm text-slate-300"><Check className="w-4 h-4 text-emerald-500 mt-0.5" /> Tous les privilèges</li>
                <li className="flex items-start gap-3 text-sm text-slate-300"><Check className="w-4 h-4 text-emerald-500 mt-0.5" /> Interface DB Manager</li>
                <li className="flex items-start gap-3 text-sm text-slate-300"><Check className="w-4 h-4 text-emerald-500 mt-0.5" /> Suivi équipes terrain</li>
                <li className="flex items-start gap-3 text-sm text-slate-300"><Check className="w-4 h-4 text-emerald-500 mt-0.5" /> Export GeoPackage global</li>
              </ul>
              <Button variant="outline" className="w-full rounded-xl border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">Contacter l'équipe Administrateur</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/5 text-center text-slate-500 text-sm">
        <p>© 2026 Atlas Géotechnique. Construit avec passion pour l'ingénierie moderne.</p>
        <div className="mt-4 flex items-center justify-center gap-6">
          <a href="#" className="hover:text-slate-300 transition-colors">Documentation</a>
          <a href="#" className="hover:text-slate-300 transition-colors">Politique de confidentialité</a>
          <a href="#" className="hover:text-slate-300 transition-colors">Mentions légales</a>
        </div>
      </footer>
    </div>
  );
}
