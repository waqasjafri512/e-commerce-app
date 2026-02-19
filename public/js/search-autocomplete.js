const searchInput = document.getElementById('search-input');
const suggestionsEl = document.getElementById('suggestions');

if (searchInput && suggestionsEl) {
  searchInput.addEventListener('input', async event => {
    const term = event.target.value.trim();
    if (term.length < 2) {
      suggestionsEl.innerHTML = '';
      return;
    }

    const response = await fetch(`/products/suggestions?term=${encodeURIComponent(term)}`);
    const suggestions = await response.json();

    suggestionsEl.innerHTML = suggestions
      .map(item => `<div style="padding:6px;border:1px solid #ddd;">${item.label}</div>`)
      .join('');
  });
}
