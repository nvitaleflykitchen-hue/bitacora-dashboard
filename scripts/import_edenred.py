"""Import the supplied Edenred XLSX; enrich only unambiguous official matches.

Requires openpyxl. No database writes, geocoding service, or user location.
"""
import argparse
import hashlib
import html
import json
import math
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

import openpyxl

COORDINATES_URL = 'https://edenred.com.ar/wp-json/edenred/v1/estaciones/map'


def normalize(value):
    text = unicodedata.normalize('NFKD', html.unescape(str(value or ''))).encode('ascii', 'ignore').decode().upper()
    return ' '.join(re.findall(r'[A-Z0-9]+', text))


def place(value):
    text = normalize(re.sub(r'\s+-\s+\d+$', '', str(value or '').split(',')[0]))
    if text == 'V MARIA':
        return 'VILLA MARIA'
    if text == 'GRAN BUENOS AIRES':
        return 'BUENOS AIRES'
    return 'CAPITAL FEDERAL' if text in ('CABA', 'CIUDAD AUTONOMA DE BUENOS AIRES') else text


def coordinates(row):
    try:
        lat, lng = float(row['latitud']), float(row['longitud'])
        if -56 <= lat <= -21 and -74 <= lng <= -53:
            return lat, lng
    except (ValueError, TypeError, KeyError):
        pass
    return None


def distance(a, b):
    lat1, lng1, lat2, lng2 = map(math.radians, (*a, *b))
    h = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lng2-lng1)/2)**2
    return 6371 * 2 * math.asin(min(1, math.sqrt(h)))


def build_catalog(sheet_rows, official, source_name, source_date):
    lookup = {}
    addresses = {}
    point_places = {}
    for row in official:
        point = coordinates(row)
        if point:
            point_places.setdefault(point, set()).add((place(row.get('localidad')), place(row.get('provincia'))))
    for row in official:
        point = coordinates(row)
        if not point or len(point_places[point]) > 1:
            continue
        key = (normalize(row.get('nombre_fantasia')), place(row.get('localidad')), place(row.get('provincia')))
        lookup.setdefault(key, []).append(row)
        if str(row.get('nro') or '0') != '0' or re.search(r'\bKM\s*\d', normalize(row.get('calle'))):
            addresses.setdefault(key[1:], []).append(row)
    stations, seen = [], set()
    duplicates = 0
    for number, row in enumerate(sheet_rows, start=5):
        name, _, address, locality, province, *_ = row
        if not name and not address:
            continue
        if not name or not address:
            raise ValueError(f'Fila {number}: falta nombre o dirección')
        # This Edenred report has repeated province names in LOCALIDAD and the
        # actual town in PROVINCIA. Only swap that identifiable export format.
        locality_parts = str(locality or '').split(',')
        if len(locality_parts) == 2 and place(locality_parts[0]) == place(locality_parts[1]):
            locality, province = province, locality_parts[0]
        key = (normalize(name), normalize(address), place(locality), place(province))
        if key in seen:
            duplicates += 1
            continue
        seen.add(key)
        station = dict(id=hashlib.sha256('|'.join(key).encode()).hexdigest()[:16], nombre=html.unescape(str(name)).strip(),
                       direccion=str(address).strip(), localidad=place(locality),
                       provincia=str(province or '').strip(), lat=None, lng=None)
        candidates = lookup.get((key[0], key[2], key[3]), [])
        # Same name and town are not enough: require the street/number present
        # in the Excel address as well. No fuzzy name or locality-centroid match.
        address_key = ' ' + key[1] + ' '
        candidates = [c for c in candidates if normalize(c.get('calle')) and
                      (' ' + normalize(c['calle']) + ' ') in address_key and
                      (str(c.get('nro') or '0') == '0' or
                       (' ' + normalize(c['nro']) + ' ') in address_key)]
        if not candidates:
            # A renamed station may still have an exact street/number match in
            # the same locality and province. Do not match street-only addresses.
            candidates = [c for c in addresses.get((key[2], key[3]), []) if
                          address_key.startswith(' ' + normalize(f"{c['calle']} {c.get('nro') or '0'}") + ' ')]
        if candidates:
            points = [coordinates(c) for c in candidates]
            if all(distance(points[0], point) <= 0.25 for point in points):
                station.update(lat=points[0][0], lng=points[0][1], coordinateSource='Edenred',
                               coordinateIds=sorted(c['id'] for c in candidates))
        stations.append(station)
    if not stations:
        raise ValueError('El Excel no contiene estaciones')
    return dict(source=source_name, sourceDate=source_date, coordinateSource=COORDINATES_URL,
                importedAt=datetime.now(timezone.utc).isoformat(), duplicatesRemoved=duplicates,
                stations=stations)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('excel', type=Path)
    parser.add_argument('--coordinates', type=Path, help='Cached official JSON, for reproducible/offline imports')
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'src/data/edenred.json')
    args = parser.parse_args()
    workbook = openpyxl.load_workbook(args.excel, read_only=True, data_only=True)
    sheet = workbook['Datos']
    headers = [normalize(c.value) for c in sheet[4]]
    if headers[:5] != ['NOMBRE ESTACIONES DE SERVICIO', 'IDENTIFICACION ESTACION DE SERVICIO', 'DIRECCION', 'LOCALIDAD', 'PROVINCIA']:
        raise ValueError('Formato de Excel no reconocido; revisar encabezados antes de importar')
    if args.coordinates:
        official = json.loads(args.coordinates.read_text(encoding='utf-8-sig'))
    else:
        with urlopen(COORDINATES_URL, timeout=60) as response:
            official = json.load(response)
    if official['total'] != len(official['data']):
        raise ValueError('El catálogo oficial de coordenadas está incompleto')
    catalog = build_catalog(sheet.iter_rows(min_row=5, values_only=True), official['data'], args.excel.name, str(sheet['B2'].value))
    workbook.close()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix('.tmp')
    temporary.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(args.output)
    print(json.dumps({'stations': len(catalog['stations']), 'withCoordinates': sum(s['lat'] is not None for s in catalog['stations']),
                      'duplicatesRemoved': catalog['duplicatesRemoved']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
