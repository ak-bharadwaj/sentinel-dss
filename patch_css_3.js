const fs = require('fs');

const css = `
/* Fix Dashboard Header Layout */
.dashboard-header {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 16px 24px !important;
  width: 100% !important;
  box-sizing: border-box !important;
}

.controls-section {
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
  background: rgba(10, 15, 30, 0.85) !important;
  padding: 8px 16px !important;
  border-radius: 8px !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  backdrop-filter: blur(8px) !important;
}

.brand-section {
  flex: 1;
}

/* Fix Missing Spin Animation */
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;

fs.appendFileSync('frontend/app/globals.css', css);
console.log('CSS patch applied.');
