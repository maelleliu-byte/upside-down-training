alert('fichier chargé');

// Override editSession pour voir d'où il est appelé
var _origEditSession = window.editSession;
window.editSession = function(id) {
  alert('editSession appelé depuis : ' + new Error().stack);
  _origEditSession.apply(this, arguments);
};

window.openReadSession = function(id) {
  alert('openReadSession appelé ' + id);
};

function closeReadModal() {}
function readModalEdit() {}
