// Partage (WhatsApp) sans dépendance.

/** Ouvre WhatsApp avec le texte prêt à envoyer (application sur téléphone, WhatsApp Web sinon). */
export function shareOnWhatsApp(text: string): void {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}
