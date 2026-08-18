import { describe, expect, it } from 'vitest';
import { enlaceEntreApps } from '../src/despliegue.js';

/**
 * Enlaces que cruzan de la PWA a la landing y al revés.
 *
 * **En producción esto no hace nada**, y ese es el punto: un solo origen sirve
 * las dos aplicaciones, así que la ruta relativa ya es correcta. El caso raro
 * es el de desarrollo, donde son dos Vite en puertos distintos y un `/` se
 * queda dentro de la app equivocada.
 */

describe('enlaceEntreApps', () => {
  describe('en producción', () => {
    it('la landing es la raíz', () => {
      expect(enlaceEntreApps('landing', false, 'https://liga.example')).toBe('/');
    });

    it('la PWA cuelga de /app/', () => {
      expect(enlaceEntreApps('app', false, 'https://liga.example')).toBe('/app/');
    });

    /**
     * **La ruta relativa es lo que hace que funcione detrás de cualquier
     * dominio.** Devolver una absoluta acá ataría el build a un host, y el
     * mismo contenedor se sirve desde donde lo pongan.
     */
    it('no mira el origen: la ruta es relativa', () => {
      expect(enlaceEntreApps('landing', false, 'http://localhost:9999')).toBe('/');
    });
  });

  describe('en desarrollo', () => {
    it('la landing vive en su propio puerto', () => {
      expect(enlaceEntreApps('landing', true, 'http://localhost:5173/app/wafl')).toBe(
        'http://localhost:5174/',
      );
    });

    it('la PWA vive en el suyo', () => {
      expect(enlaceEntreApps('app', true, 'http://localhost:5174/torneos')).toBe(
        'http://localhost:5173/app/',
      );
    });

    /**
     * Se conserva el host, no se escribe `localhost`: se prueba desde el
     * celular contra la IP de la máquina, y ahí `localhost` es el celular.
     */
    it('conserva el host desde el que se está mirando', () => {
      expect(enlaceEntreApps('landing', true, 'http://192.168.0.15:5173/app/wafl')).toBe(
        'http://192.168.0.15:5174/',
      );
    });

    it('conserva el protocolo', () => {
      expect(enlaceEntreApps('app', true, 'https://192.168.0.15:5174/')).toBe(
        'https://192.168.0.15:5173/app/',
      );
    });

    /** Lo que venga después del origen sobra: el destino es la raíz de la otra app. */
    it('descarta la ruta y la query del origen', () => {
      expect(enlaceEntreApps('landing', true, 'http://localhost:5173/app/wafl?x=1#y')).toBe(
        'http://localhost:5174/',
      );
    });
  });
});
