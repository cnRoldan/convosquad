export function unwrap<T extends { data: unknown; error: { message: string; code?: string } | null }>(result: T): NonNullable<T['data']> {
  if (result.error) throw result.error;
  if (result.data === null || result.data === undefined) throw new Error('El servidor no devolvió el resultado esperado.');
  return result.data as NonNullable<T['data']>;
}

export function backendErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    if (error.code === '23505') return 'Ese nombre, ficha o fecha ya está en uso.';
    if (error.code === '42501') return 'No tienes permiso para realizar esta operación.';
    if (error.code === '23514' || error.code === '22023') return 'Revisa los datos y el estado actual de la operación.';
  }
  return 'No se pudo completar la operación. Comprueba tu conexión y vuelve a intentarlo.';
}
