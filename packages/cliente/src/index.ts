/**
 * Cliente HTTP y carga de datos compartidos entre la PWA y la landing.
 *
 * Sin componentes ni reglas de negocio: eso es de `@bal/ui` y de `@bal/shared`.
 */

export {
  ApiError,
  type Cliente,
  crearCliente,
  type OpcionesDelCliente,
  type OpcionesDePedido,
} from './cliente.js';
export {
  type Carga,
  type OpcionesDeCarga,
  type Recurso,
  useCarga,
  useRecurso,
} from './useCarga.js';
