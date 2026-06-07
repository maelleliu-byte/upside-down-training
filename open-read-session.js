alert('fichier chargé');

window.openReadSession = function(id) {
  alert('appelé ' + id);
};

function closeReadModal() {}
function readModalEdit() {}

// Intercepter tous les clics sur cal-rich
document.addEventListener('click', function(e) {
  const card = e.target.closest('.cal-rich');
  if (!card) return;
  const btn = e.target.closest('.cal-action-btn');
  if (btn) return;
  const id = card.dataset.sessionId;
  if (id) openReadSession(id);
}, true);
