# btubellac-Visualitzacio_dades_PR2

# Rutes en joc — PR2 Visualització de dades (UOC)

Visualització narrativa i interactiva sobre migració d'aus, continuació de la PR1 (`bird_migration_with_origin_destination`).

## Enllaç públic (GitHub Pages)

Visualització: https://btubellac.github.io/btubellac-Visualitzacio_dades_PR2/

Codi: https://github.com/btubellac/btubellac-Visualitzacio_dades_PR2

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

## Ús d'intel·ligència artificial (declaració UOC)

En aquest treball s'ha fet un **ús limitat** d'IA generativa, d'acord amb la normativa de la UOC i la guia *Com hem de citar la IA en els treballs?*

| Aspecte | Detall |
|--------|--------|
| **Eina** | [Cursor](https://cursor.com) (assistent de codi amb model d'IA integrat) |
| **Objectius** | Suport en l'estructura del repositori i la publicació a GitHub Pages; integració de la galeria d'espècies amb imatges; esbossar la idea narrativa general (seccions, textos d'interpretació i guió del vídeo); resoldre errors tècnics (JSON, rutes de fitxers, càrrega de dades). |
| **Prompts (exemples)** | «Com publicar el projecte a GitHub Pages?»; «Les imatges no es carreguen al repositori»; «Els filtres del mapa no funcionen» |
| **Resposta obtinguda** | Propostes de codi (HTML/CSS/JS, script Python), textos orientatius per a la web i el guió del vídeo, i instruccions de desplegament. |
| **Revisió i edició** | Tota la sortida ha estat **revisada, adaptada i validada per l'autora**: selecció del dataset i preguntes (PR1), interpretació de resultats, dades de conservació (IUCN/BirdLife), gravació del vídeo, correccions d'estil i decisions finals de disseny. 

La visualització, les conclusions i el discurs de la memòria/vídeo són responsabilitat de l'autora. L'ús de la IA s'ha limitat a prototipatge i suport tènic, no a la substitució de l'anàlisi ni de la reflexió crítica.

## Autora

Blanca Tubella — Màster en Ciència de Dades, UOC.
