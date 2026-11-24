const fs = require("fs");
const path = require("path");

const targets = [
  path.join(__dirname, "..", "node_modules", "threejs-miniprogram", "dist", "index.js"),
  path.join(__dirname, "..", "miniprogram_npm", "threejs-miniprogram", "index.js")
];

const brokenStart = "h=(void 0)((o=this,s=function(t){";
const fixedStart = "h=(o=this,s=function(t){";
const brokenEnd = 'exports"],s):s((o=o||self).THREE={}))));return l}';
const fixedEnd = 'exports"],s):s((o=o||self).THREE={})));return l}';

targets.forEach((targetPath) => {
  if (!fs.existsSync(targetPath)) return;

  let code = fs.readFileSync(targetPath, "utf8");
  if (!code.includes(brokenStart)) return;

  code = code.replace(brokenStart, fixedStart);
  code = code.replace(brokenEnd, fixedEnd);
  fs.writeFileSync(targetPath, code);
  console.log(`patched ${path.relative(path.join(__dirname, ".."), targetPath)}`);
});

// Cannon ships a standalone CommonJS build that can run directly in the mini-program.
const cannonSource = path.join(__dirname, '..', 'node_modules', 'cannon', 'build', 'cannon.js');
if (fs.existsSync(cannonSource)) {
  let cannonCode = fs.readFileSync(cannonSource, 'utf8');
  const clockFallback = /if\s*\(typeof performance === 'undefined'\)\s*\{\s*performance\s*=\s*\{\};\s*\}/;
  const localClock = "var performance = { now: function () { return Date.now(); } };";
  if (clockFallback.test(cannonCode)) {
    cannonCode = cannonCode.replace(clockFallback, localClock);
    fs.writeFileSync(cannonSource, cannonCode);
  }
  const cannonTarget = path.join(__dirname, '..', 'miniprogram_npm', 'cannon');
  fs.mkdirSync(cannonTarget, { recursive: true });
  fs.copyFileSync(cannonSource, path.join(cannonTarget, 'index.js'));
  fs.copyFileSync(path.join(__dirname, '..', 'node_modules', 'cannon', 'LICENSE'), path.join(cannonTarget, 'LICENSE'));
}
