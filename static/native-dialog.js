/* Общий диалог для XP-совместимых страниц (используется компонентом native/ui Dialog).
 * Разметка всегда в DOM (SSR), показ/скрытие через инлайн style.display. */
function xpDialogOpen(id) {
	var el = document.getElementById(id);
	if (el) el.style.display = 'block';
}

function xpDialogClose(id) {
	var el = document.getElementById(id);
	if (el) el.style.display = 'none';
}
