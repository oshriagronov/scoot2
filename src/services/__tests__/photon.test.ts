import { describe, expect, it } from 'vitest';
import { photonToPlace } from '../photon';
import { uniquePlaces } from '../place';

describe('photonToPlace', () => {
  it('uses the name as title and the address as subtitle', () => {
    const p = photonToPlace({
      geometry: { coordinates: [34.8050129, 32.1123577] },
      properties: {
        osm_type: 'R',
        osm_id: 17483735,
        name: 'Tel Aviv University',
        street: 'Haim Levanon',
        housenumber: '30',
        district: 'Afeka',
        city: 'Tel Aviv-Yafo',
        country: 'Israel',
      },
    });
    expect(p).toEqual({
      id: 'R17483735',
      title: 'Tel Aviv University',
      subtitle: 'Haim Levanon 30, Afeka, Tel Aviv-Yafo, Israel',
      location: { latitude: 32.1123577, longitude: 34.8050129 },
    });
  });

  it('titles plain addresses with street and number', () => {
    const p = photonToPlace({
      geometry: { coordinates: [34.774952, 32.075316] },
      properties: { osm_type: 'N', osm_id: 1, street: 'Dizengoff', housenumber: '59', city: 'Tel Aviv-Yafo' },
    });
    expect(p.title).toBe('Dizengoff 59');
    expect(p.subtitle).toBe('Tel Aviv-Yafo');
  });

  it('drops results that look identical', () => {
    const a = { id: '1', title: 'A', subtitle: 'X', location: { latitude: 0, longitude: 0 } };
    expect(uniquePlaces([a, { ...a, id: '2' }, { ...a, id: '3', subtitle: 'Y' }]).map((p) => p.id)).toEqual(['1', '3']);
  });
});
