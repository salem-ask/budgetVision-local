import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { db, seedDefaults } from './data/db';
import { requestPersistentStorage } from './ui/storage';
import { App } from './ui/App';
import './ui/styles.css';

// Demande au navigateur de ne pas effacer la base du téléphone en cas de manque de place.
void requestPersistentStorage();

// Catégories et réglages par défaut au premier lancement, puis affichage (aucune attente réseau).
void seedDefaults(db)
  .catch(() => undefined)
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
