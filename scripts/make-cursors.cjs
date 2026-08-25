const fs = require('fs');

// Sleek, razor-sharp modern pointer arrow (Default Cursor)
const dDark = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <!-- Subtle cyber glow shadow -->
  <path d="M2.5 1L2.5 19L7.5 14.5L12.5 23L15.5 21.5L10.5 13L17.5 13L2.5 1Z" fill="#000000" opacity="0.4" transform="translate(1, 1.2)"/>
  <!-- Crisp dark border -->
  <path d="M1.5 0L1.5 20L7.2 15L12.5 24L16.2 22L11 13.2L18.5 13.2L1.5 0Z" fill="#05080e"/>
  <!-- Pure brilliant white core -->
  <path d="M2.5 1.5L2.5 17.8L7 13.8L12 22.2L14.2 21L9.2 12.5L16 12.5L2.5 1.5Z" fill="#ffffff"/>
  <!-- Delicate cyber cyan tip accent -->
  <polygon points="2.5,1.5 2.5,6.5 6.5,5" fill="#38bdf8"/>
</svg>`;

const dLight = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <path d="M2.5 1L2.5 19L7.5 14.5L12.5 23L15.5 21.5L10.5 13L17.5 13L2.5 1Z" fill="#000000" opacity="0.2" transform="translate(1, 1.2)"/>
  <path d="M1.5 0L1.5 20L7.2 15L12.5 24L16.2 22L11 13.2L18.5 13.2L1.5 0Z" fill="#ffffff"/>
  <path d="M2.5 1.5L2.5 17.8L7 13.8L12 22.2L14.2 21L9.2 12.5L16 12.5L2.5 1.5Z" fill="#0f172a"/>
  <polygon points="2.5,1.5 2.5,6.5 6.5,5" fill="#0284c7"/>
</svg>`;

// Beautiful, pixel-crafted pointing hand (Hover / Clickable Cursor)
const pDark = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <!-- Subtle depth shadow -->
  <path d="M7 1.5V11L5.5 9.5C4.7 8.7 3.3 8.7 2.5 9.5C1.7 10.3 1.7 11.7 2.5 12.5L7.5 17.5C8.8 18.8 10.5 19.5 12.2 19.5H14.5C16.8 19.5 18.5 17.8 18.5 15.5V9C18.5 8.2 17.8 7.5 17 7.5C16.4 7.5 15.9 7.8 15.6 8.3C15.3 7.8 14.8 7.5 14.2 7.5C13.6 7.5 13.1 7.8 12.8 8.3C12.5 7.8 12 7.5 11.4 7.5C10.6 7.5 10 8.1 10 9V1.5C10 0.7 9.3 0 8.5 0C7.7 0 7 0.7 7 1.5Z" fill="#000000" opacity="0.4" transform="translate(1, 1.2)"/>
  <!-- Crisp dark border -->
  <path d="M6 1.5C6 0.1 7.1 -1 8.5 -1C9.9 -1 11 0.1 11 1.5V6.5C11.4 6.2 11.9 6 12.5 6C13.3 6 14 6.4 14.5 7C15 6.4 15.7 6 16.5 6C17.3 6 18 6.4 18.5 7C19.1 7 20 7.9 20 9V15.5C20 18.5 17.5 21 14.5 21H12.2C10.1 21 8.1 20.2 6.6 18.7L1.6 13.7C0.2 12.3 0.2 10 1.6 8.6C3 7.2 5.3 7.2 6.7 8.6L7 8.9V1.5C7 0.9 6.6 0.5 6 1.5Z" stroke="#05080e" stroke-width="1.5" stroke-linejoin="round" fill="#05080e"/>
  <!-- Pure brilliant white core -->
  <path d="M7 1.5C7 0.7 7.7 0 8.5 0C9.3 0 10 0.7 10 1.5V10.5L11 9.5C11.4 9.1 12 9.1 12.4 9.5C12.8 9.9 12.8 10.5 12.4 10.9L12.5 9.5C12.9 9.1 13.5 9.1 13.9 9.5C14.3 9.9 14.3 10.5 13.9 10.9L14.2 9.5C14.6 9.1 15.2 9.1 15.6 9.5C16 9.9 16 10.5 15.6 10.9V15.5C15.6 17.2 14.2 18.5 12.5 18.5H10.5C8.8 18.5 7.2 17.8 6 16.6L2.3 12.9C1.9 12.5 1.9 11.9 2.3 11.5C2.7 11.1 3.3 11.1 3.7 11.5L5.5 13.3V1.5C5.5 0.7 6.2 0 7 1.5Z" fill="#ffffff"/>
  <!-- Electric cyan index fingertip accent -->
  <circle cx="8.5" cy="2.5" r="1.2" fill="#38bdf8"/>
</svg>`;

const pLight = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <path d="M7 1.5V11L5.5 9.5C4.7 8.7 3.3 8.7 2.5 9.5C1.7 10.3 1.7 11.7 2.5 12.5L7.5 17.5C8.8 18.8 10.5 19.5 12.2 19.5H14.5C16.8 19.5 18.5 17.8 18.5 15.5V9C18.5 8.2 17.8 7.5 17 7.5C16.4 7.5 15.9 7.8 15.6 8.3C15.3 7.8 14.8 7.5 14.2 7.5C13.6 7.5 13.1 7.8 12.8 8.3C12.5 7.8 12 7.5 11.4 7.5C10.6 7.5 10 8.1 10 9V1.5C10 0.7 9.3 0 8.5 0C7.7 0 7 0.7 7 1.5Z" fill="#000000" opacity="0.2" transform="translate(1, 1.2)"/>
  <path d="M6 1.5C6 0.1 7.1 -1 8.5 -1C9.9 -1 11 0.1 11 1.5V6.5C11.4 6.2 11.9 6 12.5 6C13.3 6 14 6.4 14.5 7C15 6.4 15.7 6 16.5 6C17.3 6 18 6.4 18.5 7C19.1 7 20 7.9 20 9V15.5C20 18.5 17.5 21 14.5 21H12.2C10.1 21 8.1 20.2 6.6 18.7L1.6 13.7C0.2 12.3 0.2 10 1.6 8.6C3 7.2 5.3 7.2 6.7 8.6L7 8.9V1.5C7 0.9 6.6 0.5 6 1.5Z" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round" fill="#ffffff"/>
  <path d="M7 1.5C7 0.7 7.7 0 8.5 0C9.3 0 10 0.7 10 1.5V10.5L11 9.5C11.4 9.1 12 9.1 12.4 9.5C12.8 9.9 12.8 10.5 12.4 10.9L12.5 9.5C12.9 9.1 13.5 9.1 13.9 9.5C14.3 9.9 14.3 10.5 13.9 10.9L14.2 9.5C14.6 9.1 15.2 9.1 15.6 9.5C16 9.9 16 10.5 15.6 10.9V15.5C15.6 17.2 14.2 18.5 12.5 18.5H10.5C8.8 18.5 7.2 17.8 6 16.6L2.3 12.9C1.9 12.5 1.9 11.9 2.3 11.5C2.7 11.1 3.3 11.1 3.7 11.5L5.5 13.3V1.5C5.5 0.7 6.2 0 7 1.5Z" fill="#0f172a"/>
  <circle cx="8.5" cy="2.5" r="1.2" fill="#0284c7"/>
</svg>`;

fs.writeFileSync('public/icons8/cursor-default-dark.svg', dDark);
fs.writeFileSync('public/icons8/cursor-default-light.svg', dLight);
fs.writeFileSync('public/icons8/cursor-pointer-dark.svg', pDark);
fs.writeFileSync('public/icons8/cursor-pointer-light.svg', pLight);
console.log('Crafted premium cyber cursors successfully.');
