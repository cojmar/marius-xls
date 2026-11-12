# marius-xls — Locații-Excel

Aplicație pentru geocodarea adreselor din fișiere Excel și vizualizarea lor pe hartă (Leaflet + Google Maps în sesiune Electron).

## Varianta în browser

[https://cojmar.github.io/marius-xls/](https://cojmar.github.io/marius-xls/)

> ⚠️ Varianta web **nu este 100% reliable** — geocodarea prin browser poate eșua sau poate fi blocată de Google. Pentru rezultate stabile folosește aplicația de desktop.

## Descărcări (release `APP`)

| Platformă | Descărcare |
|-----------|-----------|
| Windows x64 | [GeoLocation.exe](https://github.com/cojmar/marius-xls/releases/download/APP/GeoLocation.exe) |
| Linux x86_64 | [GeoLocation.AppImage](https://github.com/cojmar/marius-xls/releases/download/APP/GeoLocation.AppImage) |

Pe Linux, după descărcare:

```bash
chmod +x GeoLocation.AppImage
./GeoLocation.AppImage
```

## Rulare locală (Electron)

Codul aplicației este în subfolderul `app/`:

```bash
cd app
npm install   # instalează electron + electron-builder
npm start     # rulează aplicația (electron .)
npm run build # construiește binarele
```

`npm run build` rulează `electron-builder --win --linux --publish never` și produce în `app/dist/`:

- `GeoLocation.exe` — Windows x64 (portable, fără instalare)
- `GeoLocation.AppImage` — Linux x86_64

Cerințe locale: Node.js și npm.
