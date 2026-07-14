const fs = require('fs');

let content = fs.readFileSync('frontend/app/globals.css', 'utf8');

const oldDashboardMain = `.dashboard-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  flex: 1;
  transition: grid-template-columns 0.3s ease;
  position: relative;
  overflow: hidden;
}`;

const newDashboardMain = `.dashboard-main {
  display: flex;
  flex: 1;
  position: relative;
  overflow: hidden;
}`;

content = content.replace(oldDashboardMain, newDashboardMain);

const oldSidebar = `.sidebar {
  background: var(--bg-card);
  backdrop-filter: var(--backdrop-blur);
  border-right: 1px solid var(--border-color);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}`;

const newSidebar = `.sidebar {
  background: var(--bg-card);
  backdrop-filter: var(--backdrop-blur);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  position: absolute;
  top: 16px;
  left: 16px;
  bottom: 16px;
  width: 320px;
  z-index: 10;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  transition: transform 0.3s ease;
}`;

content = content.replace(oldSidebar, newSidebar);

const oldSidebarRight = `.sidebar-right {
  background: var(--bg-card);
  backdrop-filter: var(--backdrop-blur);
  border-left: 1px solid var(--border-color);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}`;

const newSidebarRight = `.sidebar-right {
  background: var(--bg-card);
  backdrop-filter: var(--backdrop-blur);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  position: absolute;
  top: 16px;
  right: 16px;
  bottom: 16px;
  width: 340px;
  z-index: 10;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  transition: transform 0.3s ease;
}`;

content = content.replace(oldSidebarRight, newSidebarRight);

const oldMapViewport = `.map-viewport {
  position: relative;
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}`;

const newMapViewport = `.map-viewport {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  z-index: 1;
  display: flex;
  flex-direction: column;
}`;

content = content.replace(oldMapViewport, newMapViewport);

fs.writeFileSync('frontend/app/globals.css', content);
console.log('globals.css patched for fullscreen map!');
