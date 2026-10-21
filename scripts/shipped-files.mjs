// What the release package contains: files and directories, relative to the repo root. demo/fixtures is the fictional sample documents the side panel's preview mode loads.
export const SHIPPED = ['manifest.json', 'background.js', 'background', 'content', 'shared', 'sidepanel', 'vendor', 'icons', 'demo/fixtures'];

// Local-only files (gitignored overrides such as shared/directory-config.local.mjs) are never part of a release package.
export const LOCAL_ONLY = /\.local\.mjs$/;
