Chrome Extensions Folder
========================

Place your unpacked Chrome extensions here.

How to add extensions:
1. Download the Chrome extension you want (as a .crx file or unpacked folder)
2. If it's a .crx file, extract it using a tool like 7-Zip
3. Place the entire extracted folder here
4. The extension will be automatically loaded when Discord launches

Example structure:
plugins/
  my-extension/
    manifest.json
    background.js
    content.js
    ...
  another-extension/
    manifest.json
    ...

Note: Each extension must be in its own folder and have a valid manifest.json file.

The extensions are loaded with the following Chrome flags:
--load-extension=[extension folders]
--disable-extensions-except=[extension folders]

This ensures only your specified extensions are loaded for privacy and security.