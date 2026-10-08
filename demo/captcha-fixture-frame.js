const kind = new URLSearchParams(location.search).get('kind');
document.querySelector('#recaptcha-anchor').hidden = kind !== 'checkbox';
document.querySelector('#image-section').hidden = kind !== 'image';
document.querySelector('#recaptcha-anchor').onclick = (event) => event.currentTarget.setAttribute('aria-checked', 'true');
const cells = [];
for (let row = 0; row < 3; row++) {
  const tr = document.createElement('tr');
  for (let col = 0; col < 3; col++) {
    const index = row * 3 + col + 1, cell = document.createElement('td'); cell.className = 'rc-imageselect-tile';
    const image = document.createElement('img'); image.alt = `Fixture tile ${index}`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${[1,8,9].includes(index) ? '#e5b252' : '#b9d5df'}"/><text x="40" y="58" font-size="26">${index}</text></svg>`;
    image.src = `data:image/svg+xml;base64,${btoa(svg)}`; cell.append(image); cell.onclick = () => cell.classList.toggle('rc-imageselect-tileselected'); cells.push(cell); tr.append(cell);
  }
  document.querySelector('#tiles').append(tr);
}
document.querySelector('#recaptcha-verify-button').onclick = () => {
  const selected = cells.flatMap((cell, index) => cell.classList.contains('rc-imageselect-tileselected') ? [index + 1] : []);
  document.querySelector('#feedback').textContent = JSON.stringify(selected) === '[1,8,9]' ? 'Fixture selection accepted' : 'Fixture selection rejected';
};
