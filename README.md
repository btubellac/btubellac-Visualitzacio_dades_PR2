# Visualitzacio_dades_PR2 — Rutes en joc

# Rutes en joc — PR2 Visualització de dades (UOC)

Visualització narrativa i interactiva sobre migració d'aus, continuació de la PR1 (`bird_migration_with_origin_destination`).

## Enllaç públic (GitHub Pages)

Visualització: https://btubellac.github.io/Visualitzacio_dades_PR2---Rutes-en-joc/

Codi: https://github.com/btubellac/Visualitzacio_dades_PR2---Rutes-en-joc

## Requisits

- Python 3.9+ amb `pandas`
- Navegador modern
- Servidor HTTP local (les dades es carreguen per `fetch`)

## Preparació de dades

```bash
pip install pandas
python scripts/prepare_data.py
```

Genera `data/migration_enriched.json` a partir del CSV de la PR1.

**Important:** cal regenerar aquest fitxer després d'actualitzar `prepare_data.py`. Si la pàgina surt buida, torna a executar aquest script i recarrega el navegador (Ctrl+F5).

## Executar en local

```bash
cd PR2
python -m http.server 8080
```

Obre `http://localhost:8080`

## Estructura

- `index.html` — narrativa i seccions per preguntes clau
- `js/main.js` — mapa D3, gràfics i filtres
- `data/species_context.json` — enriquiment real (IUCN, BirdLife, IPCC)
- `data/migration_enriched.json` — agregacions del CSV
- `scripts/prepare_data.py` — pipeline de dades

## Autora

Blanca Tubella — Màster en Ciència de Dades, UOC.
