import unittest
from import_edenred import build_catalog, place


class ImportTest(unittest.TestCase):
    row = ('Shell Norte', '', 'RUTA 9 123  VILLA MARIA  Cordoba', 'CORDOBA,  CORDOBA', 'VILLA MARIA', '')
    official = dict(id='1', nombre_fantasia='Shell Norte', calle='RUTA 9', nro='123', localidad='VILLA MARIA', provincia='Cordoba', latitud='-32.4', longitud='-63.1')

    def build(self, rows=None, official=None):
        return build_catalog(rows or [self.row], official if official is not None else [self.official], 'input.xlsx', '30/09/2026')

    def test_corrects_inverted_export_columns_and_deduplicates(self):
        result = self.build([self.row,self.row])
        self.assertEqual(result['duplicatesRemoved'],1)
        self.assertEqual(result['stations'][0]['localidad'],'VILLA MARIA')
        self.assertEqual(result['stations'][0]['provincia'],'CORDOBA')
        self.assertEqual(result['stations'][0]['lat'],-32.4)

    def test_keeps_unmatched_station_without_inventing_coordinates(self):
        self.assertIsNone(self.build(official=[])['stations'][0]['lat'])

    def test_does_not_choose_between_conflicting_official_coordinates(self):
        self.assertIsNone(self.build(official=[self.official,{**self.official,'id':'2','latitud':'-34'}])['stations'][0]['lat'])

    def test_same_name_with_different_address_is_not_enough(self):
        self.assertIsNone(self.build(official=[{**self.official,'nro':'456'}])['stations'][0]['lat'])

    def test_rejects_coordinate_reused_in_different_localities(self):
        other = {**self.official, 'id':'2', 'localidad':'CORDOBA', 'nombre_fantasia':'Otra estación'}
        self.assertIsNone(self.build(official=[self.official,other])['stations'][0]['lat'])

    def test_normalizes_villa_maria_export_alias(self):
        self.assertEqual(place('V.MARIA - 1'),'VILLA MARIA')

    def test_renamed_station_requires_exact_address(self):
        self.assertEqual(self.build(official=[{**self.official,'nombre_fantasia':'Nombre nuevo'}])['stations'][0]['lat'],-32.4)


if __name__ == '__main__':
    unittest.main()
