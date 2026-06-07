window.openReadSession = function(id) {
  alert('OK ' + id);
};
function closeReadModal() {
  document.getElementById('read-modal').classList.remove('open');
}
function readModalEdit() {
  closeReadModal();
  if (window._readModalSessionId) editSession(window._readModalSessionId);
}
