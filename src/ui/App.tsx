// Coquille de l'application : barre du haut, navigation du bas, écrans. Pas de compte : l'appli s'ouvre sur l'Accueil.
import { useRegisterSW } from 'virtual:pwa-register/react';
import { save } from '../data/store';
import type { Currency, Settings } from '../domain/types';
import { ConfirmHost, CurrencyToggle, ToastHost } from './components';
import mark from './assets/logo-mark-96.webp';
import { Icon, type IconName } from './icons';
import { useHashRoute, useMoney } from './hooks';
import { BudgetScreen } from './screens/BudgetScreen';
import { GoalDetail, GoalsScreen } from './screens/GoalsScreen';
import { HomeScreen } from './screens/HomeScreen';
import { HistoryScreen, SimulationDetail } from './screens/HistoryScreen';
import { ScenariosScreen } from './screens/ScenariosScreen';
import { SettingsScreen } from './screens/SettingsScreen';

const TABS: { path: string; label: string; icon: IconName }[] = [
  { path: 'accueil', label: 'Accueil', icon: 'home' },
  { path: 'objectifs', label: 'Objectifs', icon: 'target' },
  { path: 'budget', label: 'Budget', icon: 'chart' },
  { path: 'scenarios', label: 'Scénarios', icon: 'trend' },
  { path: 'historique', label: 'Historique', icon: 'history' },
];

export function App() {
  const [parts, go] = useHashRoute();
  const { settings } = useMoney();
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();

  const [section = 'accueil', id] = parts;
  let screen;
  if (section === 'objectifs' && id) screen = <GoalDetail id={id} go={go} />;
  else if (section === 'budget') screen = <BudgetScreen />;
  else if (section === 'scenarios') screen = <ScenariosScreen />;
  else if (section === 'historique' && id) screen = <SimulationDetail id={id} go={go} />;
  else if (section === 'historique') screen = <HistoryScreen go={go} />;
  else if (section === 'reglages') screen = <SettingsScreen go={go} />;
  else if (section === 'objectifs') screen = <GoalsScreen go={go} />;
  else screen = <HomeScreen go={go} />;

  const setDisplayCurrency = (displayCurrency: Currency) => {
    void save<Settings>('settings', { ...settings, displayCurrency });
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-row">
        <a href="#/accueil" className="brand" aria-label="BudgetVision, accueil">
          <img src={mark} alt="" width="40" height="40" />
          <span className="brand-name">
            Budget<em>Vision</em>
          </span>
        </a>
        <CurrencyToggle value={settings.displayCurrency} onChange={setDisplayCurrency} label="Devise d’affichage" />
        <a href="#/reglages" className={`avatar${section === 'reglages' ? ' active' : ''}`} aria-label="Réglages">
          <Icon name="user" />
        </a>
        </div>
        <p className="statusbar">
          <Icon name="phone" size={14} /> Données enregistrées sur ce téléphone
        </p>
      </header>
      {needRefresh && (
        <button type="button" className="banner banner-info" onClick={() => void updateServiceWorker(true)}>
          Nouvelle version disponible — toucher pour mettre à jour
        </button>
      )}
      <main className="content">{screen}</main>
      <nav className="tabbar" aria-label="Navigation principale">
        {TABS.map((tab) => (
          <a key={tab.path} href={`#/${tab.path}`} className={section === tab.path || (!TABS.some((t) => t.path === section) && section !== 'reglages' && tab.path === 'accueil') ? 'active' : ''}>
            <span className="tab-icon">
              <Icon name={tab.icon} />
            </span>
            {tab.label}
          </a>
        ))}
      </nav>
      <ToastHost />
      <ConfirmHost />
    </div>
  );
}
