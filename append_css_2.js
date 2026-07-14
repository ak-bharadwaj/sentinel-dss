const fs = require('fs');
const css = `
/* Fix Sidebar Overlap with Header */
.sidebar, .sidebar-right {
  top: 100px !important;
}
`;
fs.appendFileSync('frontend/app/globals.css', css);
