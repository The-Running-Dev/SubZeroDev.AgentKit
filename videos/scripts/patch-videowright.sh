#!/usr/bin/env bash
# Re-applies two upstream fixes to node_modules/videowright@0.1.1 that are
# required for `videowright dev` / `videowright render` to work on Windows.
# These patch node_modules directly, so they are LOST on every fresh
# `npm install` and must be re-run afterward. See videos/README.md and
# videos/videos/2026_09_agentkit_architecture/PLAN.md for the full writeup
# of why these are needed.
set -euo pipefail
cd "$(dirname "$0")/.."

VW_HELPERS="node_modules/videowright/dist/cli/vite_helpers.js"
VW_SRC_INDEX="node_modules/videowright/src/index.js"
VW_SRC_TIMING="node_modules/videowright/src/timeline/resolveTiming.js"

if [ ! -f "$VW_HELPERS" ]; then
  echo "videowright not installed (node_modules/videowright missing) -- run npm install first." >&2
  exit 1
fi

# --- Fix 1: missing src/ shims for the dev-server entry ---
# videowright@0.1.1's package.json `files` field ships dist/ (compiled) and
# only src/cli/entry (raw dev-server TS), but src/cli/entry/views/video_view.ts
# imports sibling `../../../index.js` and `../../../timeline/resolveTiming.js`
# expecting full TS source under src/. Shim them to re-export the compiled dist.
mkdir -p "$(dirname "$VW_SRC_TIMING")"
cat > "$VW_SRC_INDEX" << 'EOF'
// Shim: the published videowright@0.1.1 package's `files` allowlist ships
// `dist/` (compiled) and only `src/cli/entry` (raw dev-server TS), but
// src/cli/entry/views/video_view.ts imports sibling `../../../index.js`
// expecting full TS source at `src/`. This re-exports the compiled dist
// build so the dev-server entry resolves. Upstream packaging bug — safe to
// remove once a fixed videowright version is installed.
export * from "../dist/index.js";
EOF
cat > "$VW_SRC_TIMING" << 'EOF'
// Shim, same reason as ../index.js — see comment there.
export * from "../../dist/timeline/resolveTiming.js";
EOF

# --- Fix 2: raw Windows filesystem paths passed to browser import() ---
# vite_helpers.js's globalsVirtualModulePlugin and projectVirtualModulePlugin
# JSON.stringify raw Node fs paths (backslashes on Windows) straight into
# virtual modules that the BROWSER (or Playwright's headless Chromium, for
# render) dynamically import()s. A bare Windows absolute path like
# "D:\foo\bar" triggers the WHATWG URL spec's "Windows drive letter" quirk
# when parsed by the browser, rewriting it to a file:// URL — and pages
# served over http://localhost cannot fetch file:// resources ("Not allowed
# to load local resource"). This patches both plugins to convert to Vite's
# `/@fs/` URL convention before the paths reach the browser.
if grep -q "toBrowserFsUrl" "$VW_HELPERS"; then
  echo "vite_helpers.js already patched, skipping fix 2."
else
  python3 - "$VW_HELPERS" << 'PYEOF'
import sys, re

path = sys.argv[1]
with open(path, "r", encoding="utf-8") as f:
    src = f.read()

def apply_patch(text, old, new, description):
    if old not in text:
        print(f"error: pattern not found for {description} -- upstream videowright likely changed; patch needs updating", file=sys.stderr)
        sys.exit(1)
    return text.replace(old, new, 1)

helper = '''// PATCHED (upstream bug workaround, videowright@0.1.1): globals.timelinePath
// and globals.consumerRoot are raw Node filesystem paths (backslashes on
// Windows). They get JSON.stringified straight into a virtual module that
// the BROWSER (or Playwright's headless Chromium, for render) dynamically
// import()s. A bare Windows absolute path like "D:\\\\foo\\\\bar" triggers the
// WHATWG URL spec's "Windows drive letter" quirk when parsed by the
// browser, which rewrites it to a file:// URL -- and pages served over
// http://localhost are not allowed to fetch file:// resources ("Not allowed
// to load local resource"). Vite's own convention for serving an arbitrary
// filesystem path as a URL is the `/@fs/` prefix with forward slashes; this
// converts only the browser-facing copies of these two paths, leaving the
// Node-side uses of the original `globals`/`consumerRoot` values (fs calls
// elsewhere in this file and in dev.js/render.js) untouched.
function toBrowserFsUrl(p) {
    const posix = p.replace(/\\\\/g, "/");
    return posix.startsWith("/") ? `/@fs${posix}` : `/@fs/${posix}`;
}
const VIRTUAL_GLOBALS_ID = "virtual:vw-globals";'''

src = apply_patch(src, 'const VIRTUAL_GLOBALS_ID = "virtual:vw-globals";', helper, "fix 2 helper insertion")

src = apply_patch(
    src,
    'lines.push(`export const timelinePath = ${JSON.stringify(globals.timelinePath)};`);\n            lines.push(`export const consumerRoot = ${JSON.stringify(globals.consumerRoot)};`);',
    'lines.push(`export const timelinePath = ${JSON.stringify(globals.timelinePath ? toBrowserFsUrl(globals.timelinePath) : globals.timelinePath)};`);\n            lines.push(`export const consumerRoot = ${JSON.stringify(globals.consumerRoot ? toBrowserFsUrl(globals.consumerRoot) : globals.consumerRoot)};`)',
    "fix 2 globalsVirtualModulePlugin",
)

src = apply_patch(
    src,
    '            return `export default ${JSON.stringify(projectInfo)};`;',
    '''            // PATCHED (same upstream bug as globalsVirtualModulePlugin above):
            // each video's timelinePath is a raw Node filesystem path; convert
            // to a browser-fetchable /@fs/ URL before it reaches the browser.
            const browserProjectInfo = {
                ...projectInfo,
                videos: projectInfo.videos.map((v) => ({
                    ...v,
                    timelinePath: v.timelinePath ? toBrowserFsUrl(v.timelinePath) : v.timelinePath,
                })),
            };
            return `export default ${JSON.stringify(browserProjectInfo)};`;''',
    "fix 2 projectVirtualModulePlugin",
)

with open(path, "w", encoding="utf-8") as f:
    f.write(src)
print("Patched", path)
PYEOF
fi

# --- Fix 3: segment folder layout ---
# The installer's setup_new_style.md copies style-pack sample segments as
# flat files (segments/<slug>-sample-<scene>.ts), but the actual runtime
# (discoverSegmentIds in vite_helpers.js) only discovers segments/<id>/index.ts
# (a folder per segment). This is a mismatch between the shipped skill docs
# and the shipped runtime. No automated fix here (the flat sample files
# aren't referenced by any real timeline) -- just noting it: any real
# segment you author must live at segments/<id>/index.ts, not segments/<id>.ts.

echo "videowright patches applied."
